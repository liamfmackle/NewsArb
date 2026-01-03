import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  classifyStory,
  checkDuplicateStory,
  generateEmbedding,
  findRelatedStories,
} from "../ai/classifier.js";
import {
  determineMatch,
  extractEntities,
  verifyMatchWithAI,
  type SubmissionContext,
  type MatchResult,
} from "../ai/matcher.js";
import { getCache, setCache, deleteCache } from "../lib/redis.js";

const createStorySchema = z.object({
  title: z.string().min(5).max(200),
  url: z.string().url(),
  description: z.string().min(10).max(1000),
  initialStake: z.number().min(1),
  // Optional: user explicitly chooses to create new market even if match exists
  forceNewMarket: z.boolean().optional(),
  // Optional: user confirms joining a specific market
  joinMarketId: z.string().optional(),
});

const checkMatchSchema = z.object({
  title: z.string().min(5).max(200),
  url: z.string().url(),
  description: z.string().min(10).max(1000),
});

export async function storiesRoutes(fastify: FastifyInstance) {
  // List stories
  fastify.get("/", async (request) => {
    const { page = "1", limit = "10" } = request.query as { page?: string; limit?: string };
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    // Check cache
    const cacheKey = `stories:${pageNum}:${limitNum}`;
    const cached = await getCache<{ stories: any[]; total: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        where: { status: "active" },
        include: {
          market: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.story.count({ where: { status: "active" } }),
    ]);

    const result = { stories, total };
    await setCache(cacheKey, result, 30); // Cache for 30 seconds

    return result;
  });

  // Get single story
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const story = await prisma.story.findUnique({
      where: { id },
      include: {
        market: true,
        submitter: {
          select: { id: true, displayName: true },
        },
      },
    });

    if (!story) {
      return reply.status(404).send({ message: "Story not found" });
    }

    return story;
  });

  // Get related stories
  fastify.get("/:id/related", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = "5" } = request.query as { limit?: string };

    const story = await prisma.story.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!story) {
      return reply.status(404).send({ message: "Story not found" });
    }

    const related = await findRelatedStories(id, parseInt(limit, 10));
    return { related };
  });

  // Check for matching markets before submission (authenticated)
  // This allows the frontend to show match suggestions before committing
  fastify.post("/check-match", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const result = checkMatchSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input", errors: result.error.flatten() });
    }

    const { title, url, description } = result.data;
    const sourceDomain = new URL(url).hostname.replace("www.", "");

    // Check for exact URL duplicate first
    const duplicateCheck = await checkDuplicateStory(title, description, url);
    if (duplicateCheck.isDuplicate && duplicateCheck.similarStory) {
      return {
        type: "duplicate",
        message: "This exact story already exists",
        existingStory: {
          id: duplicateCheck.similarStory.id,
          title: duplicateCheck.similarStory.title,
          similarity: 100,
        },
      };
    }

    // Generate embedding and extract entities
    const embedding = await generateEmbedding(`${title} ${description}`);
    const entities = await extractEntities(title, description, url);

    // Run the matcher
    const submission: SubmissionContext = {
      title,
      description,
      url,
      sourceDomain,
      embedding: embedding || undefined,
      entities,
    };

    const matchResult = await determineMatch(submission);

    return {
      type: "match_result",
      decision: matchResult.decision,
      confidence: Math.round(matchResult.confidence * 100),
      reasoning: matchResult.reasoning,
      suggestedAction: matchResult.suggestedAction,
      bestMatch: matchResult.bestMatch ? {
        marketId: matchResult.bestMatch.marketId,
        storyId: matchResult.bestMatch.storyId,
        title: matchResult.bestMatch.title,
        description: matchResult.bestMatch.description,
        totalPool: matchResult.bestMatch.totalPool,
        participantCount: matchResult.bestMatch.participantCount,
        scores: {
          semantic: Math.round(matchResult.bestMatch.semanticScore * 100),
          entity: Math.round(matchResult.bestMatch.entityScore * 100),
          temporal: Math.round(matchResult.bestMatch.temporalScore * 100),
          composite: Math.round(matchResult.bestMatch.compositeScore * 100),
        },
      } : null,
      otherCandidates: matchResult.candidates.slice(1, 5).map((c) => ({
        marketId: c.marketId,
        storyId: c.storyId,
        title: c.title,
        totalPool: c.totalPool,
        participantCount: c.participantCount,
        composite: Math.round(c.compositeScore * 100),
      })),
      entities, // Return extracted entities for display
    };
  });

  // Create story (authenticated)
  fastify.post("/", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const result = createStorySchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input", errors: result.error.flatten() });
    }

    const { title, url, description, initialStake, forceNewMarket, joinMarketId } = result.data;
    const userId = (request as any).user.userId;

    // Check user balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.balance < initialStake) {
      return reply.status(400).send({ message: "Insufficient balance" });
    }

    // Extract domain from URL
    const sourceDomain = new URL(url).hostname.replace("www.", "");

    // Check for exact URL duplicate
    const duplicateCheck = await checkDuplicateStory(title, description, url);
    if (duplicateCheck.isDuplicate && duplicateCheck.similarStory) {
      return reply.status(409).send({
        message: "A similar story already exists",
        similarStory: {
          id: duplicateCheck.similarStory.id,
          title: duplicateCheck.similarStory.title,
          similarity: Math.round(duplicateCheck.similarStory.similarity * 100),
        },
      });
    }

    // Generate embedding and extract entities
    const embedding = await generateEmbedding(`${title} ${description}`);
    const entities = await extractEntities(title, description, url);

    // AI classification
    const classification = await classifyStory(title, description, url);

    // If user wants to join a specific market, validate and add stake
    if (joinMarketId) {
      return await joinExistingMarket(
        userId,
        joinMarketId,
        initialStake,
        title,
        description,
        url,
        sourceDomain,
        embedding,
        entities,
        classification,
        reply
      );
    }

    // Run the matcher unless user explicitly wants a new market
    if (!forceNewMarket) {
      const submission: SubmissionContext = {
        title,
        description,
        url,
        sourceDomain,
        category: classification.category,
        embedding: embedding || undefined,
        entities,
      };

      const matchResult = await determineMatch(submission);

      // For exact matches, auto-join the existing market
      if (matchResult.decision === "exact_match" && matchResult.bestMatch) {
        return await joinExistingMarket(
          userId,
          matchResult.bestMatch.marketId,
          initialStake,
          title,
          description,
          url,
          sourceDomain,
          embedding,
          entities,
          classification,
          reply,
          matchResult.bestMatch.compositeScore,
          "exact_match"
        );
      }

      // For likely matches, return the suggestion for user confirmation
      if (matchResult.decision === "likely_match" && matchResult.bestMatch) {
        return reply.status(300).send({
          message: "A similar market exists. Would you like to join it?",
          matchResult: {
            decision: matchResult.decision,
            confidence: Math.round(matchResult.confidence * 100),
            reasoning: matchResult.reasoning,
            bestMatch: {
              marketId: matchResult.bestMatch.marketId,
              storyId: matchResult.bestMatch.storyId,
              title: matchResult.bestMatch.title,
              description: matchResult.bestMatch.description,
              totalPool: matchResult.bestMatch.totalPool,
              participantCount: matchResult.bestMatch.participantCount,
            },
          },
          actions: {
            joinMarket: {
              method: "POST",
              path: "/stories",
              body: { ...result.data, joinMarketId: matchResult.bestMatch.marketId },
            },
            createNew: {
              method: "POST",
              path: "/stories",
              body: { ...result.data, forceNewMarket: true },
            },
          },
        });
      }
    }

    // Create new story and market
    const story = await prisma.$transaction(async (tx: typeof prisma) => {
      // Create or find canonical event
      let canonicalEventId: string | null = null;

      if (embedding) {
        const canonicalEvent = await tx.canonicalEvent.create({
          data: {
            title,
            description,
            embedding: JSON.stringify(embedding),
            entitiesPeople: JSON.stringify(entities.people),
            entitiesOrgs: JSON.stringify(entities.organizations),
            entitiesLocations: JSON.stringify(entities.locations),
            entitiesEvents: JSON.stringify(entities.events),
            entitiesTopics: JSON.stringify(entities.topics),
            category: classification.category,
            sourceDomains: JSON.stringify([sourceDomain]),
            storyCount: 1,
          },
        });
        canonicalEventId = canonicalEvent.id;
      }

      // Create story with entities and match metadata
      const newStory = await tx.story.create({
        data: {
          title,
          url,
          description,
          sourceDomain,
          submitterId: userId,
          canonicalEventId,
          status: classification.approved ? "active" : "pending",
          aiClassification: classification.category,
          safetyFlags: JSON.stringify(classification.flags),
          embedding: embedding ? JSON.stringify(embedding) : null,
          // Store extracted entities
          entitiesPeople: JSON.stringify(entities.people),
          entitiesOrgs: JSON.stringify(entities.organizations),
          entitiesLocations: JSON.stringify(entities.locations),
          entitiesEvents: JSON.stringify(entities.events),
          entitiesTopics: JSON.stringify(entities.topics),
          entitiesExtractedAt: new Date(),
          // Match metadata
          matchDecision: "create_new",
        },
      });

      // Create market
      const market = await tx.market.create({
        data: {
          storyId: newStory.id,
          totalPool: initialStake,
          participantCount: 1,
          status: "open",
        },
      });

      // Create position
      await tx.position.create({
        data: {
          userId,
          marketId: market.id,
          stakeAmount: initialStake,
          entryPoolSize: initialStake,
          status: "active",
        },
      });

      // Deduct user balance
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: initialStake } },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          type: "stake",
          amount: -initialStake,
          referenceId: market.id,
        },
      });

      return { ...newStory, market };
    });

    // Invalidate cache
    await deleteCache("stories:1:10");

    return story;
  });
}

/**
 * Helper function to join an existing market with a new stake.
 * This is called when a submission is matched to an existing market.
 */
async function joinExistingMarket(
  userId: string,
  marketId: string,
  stakeAmount: number,
  title: string,
  description: string,
  url: string,
  sourceDomain: string,
  embedding: number[] | null,
  entities: { people: string[]; organizations: string[]; locations: string[]; events: string[]; dates: string[]; topics: string[] },
  classification: { category: string; flags: string[]; approved: boolean },
  reply: any,
  matchConfidence?: number,
  matchDecision?: string
) {
  // Validate the market exists and is open
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { story: true },
  });

  if (!market) {
    return reply.status(404).send({ message: "Market not found" });
  }

  if (market.status !== "open") {
    return reply.status(400).send({ message: "Market is no longer accepting stakes" });
  }

  // Check if user already has a position in this market
  const existingPosition = await prisma.position.findFirst({
    where: { userId, marketId },
  });

  const result = await prisma.$transaction(async (tx: typeof prisma) => {
    // Record the submission as a story linked to the existing market's canonical event
    const submissionStory = await tx.story.create({
      data: {
        title,
        url,
        description,
        sourceDomain,
        submitterId: userId,
        canonicalEventId: market.story.canonicalEventId,
        status: "active", // Matched stories are auto-approved
        aiClassification: classification.category,
        safetyFlags: JSON.stringify(classification.flags),
        embedding: embedding ? JSON.stringify(embedding) : null,
        entitiesPeople: JSON.stringify(entities.people),
        entitiesOrgs: JSON.stringify(entities.organizations),
        entitiesLocations: JSON.stringify(entities.locations),
        entitiesEvents: JSON.stringify(entities.events),
        entitiesTopics: JSON.stringify(entities.topics),
        entitiesExtractedAt: new Date(),
        matchedToMarketId: marketId,
        matchConfidence: matchConfidence,
        matchDecision: matchDecision || "user_confirmed",
      },
    });

    // Update canonical event with new entities (merge)
    if (market.story.canonicalEventId) {
      const canonicalEvent = await tx.canonicalEvent.findUnique({
        where: { id: market.story.canonicalEventId },
      });

      if (canonicalEvent) {
        const mergedPeople = mergeEntityArrays(
          canonicalEvent.entitiesPeople,
          entities.people
        );
        const mergedOrgs = mergeEntityArrays(
          canonicalEvent.entitiesOrgs,
          entities.organizations
        );
        const mergedLocations = mergeEntityArrays(
          canonicalEvent.entitiesLocations,
          entities.locations
        );
        const mergedEvents = mergeEntityArrays(
          canonicalEvent.entitiesEvents,
          entities.events
        );
        const mergedTopics = mergeEntityArrays(
          canonicalEvent.entitiesTopics,
          entities.topics
        );
        const mergedDomains = mergeEntityArrays(
          canonicalEvent.sourceDomains,
          [sourceDomain]
        );

        await tx.canonicalEvent.update({
          where: { id: market.story.canonicalEventId },
          data: {
            entitiesPeople: JSON.stringify(mergedPeople),
            entitiesOrgs: JSON.stringify(mergedOrgs),
            entitiesLocations: JSON.stringify(mergedLocations),
            entitiesEvents: JSON.stringify(mergedEvents),
            entitiesTopics: JSON.stringify(mergedTopics),
            sourceDomains: JSON.stringify(mergedDomains),
            storyCount: { increment: 1 },
          },
        });
      }
    }

    // Get current pool size before adding stake
    const currentPoolSize = market.totalPool;

    // Update or create position
    if (existingPosition) {
      // Add to existing position (user adding more stake)
      await tx.position.update({
        where: { id: existingPosition.id },
        data: {
          stakeAmount: { increment: stakeAmount },
          // Note: entryPoolSize stays the same (their original entry point)
        },
      });
    } else {
      // Create new position
      await tx.position.create({
        data: {
          userId,
          marketId,
          stakeAmount,
          entryPoolSize: currentPoolSize + stakeAmount, // Entry at current pool + their stake
          status: "active",
        },
      });
    }

    // Update market
    await tx.market.update({
      where: { id: marketId },
      data: {
        totalPool: { increment: stakeAmount },
        participantCount: existingPosition ? undefined : { increment: 1 },
      },
    });

    // Deduct user balance
    await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: stakeAmount } },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: "stake",
        amount: -stakeAmount,
        referenceId: marketId,
      },
    });

    // Fetch updated market
    const updatedMarket = await tx.market.findUnique({
      where: { id: marketId },
      include: { story: true },
    });

    return {
      action: "joined_existing_market",
      submission: submissionStory,
      market: updatedMarket,
      matchInfo: {
        confidence: matchConfidence ? Math.round(matchConfidence * 100) : null,
        decision: matchDecision,
      },
    };
  });

  // Invalidate cache
  await deleteCache("stories:1:10");

  return result;
}

/**
 * Merge entity arrays, deduplicating and preserving order.
 */
function mergeEntityArrays(
  existingJson: string | null,
  newEntities: string[]
): string[] {
  const existing: string[] = existingJson ? JSON.parse(existingJson) : [];
  const merged = new Set([...existing, ...newEntities.map((e) => e.toLowerCase())]);
  return [...merged];
}
