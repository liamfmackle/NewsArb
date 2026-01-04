import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  classifyStory,
  checkDuplicateStory,
  generateEmbedding,
  findRelatedStories,
} from "../ai/classifier.js";
import {
  determineMatch,
  extractEntities,
  type SubmissionContext,
} from "../ai/matcher.js";
import { getCache, setCache, deleteCache } from "../lib/redis.js";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

type StoryWithSubmitterAndCount = {
  id: string;
  title: string;
  url: string | null;
  description: string;
  sourceDomain: string;
  status: string;
  aiClassification: string | null;
  currentViralityScore: number | null;
  peakViralityScore: number | null;
  viralityTrend: string | null;
  kudosPool: number;
  kudosDistributed: boolean;
  createdAt: Date;
  submitter: { id: string; displayName: string | null };
  _count: { submissions: number };
};

type SubmissionWithUser = {
  id: string;
  user: { id: string; displayName: string | null };
  submittedAt: Date;
  kudosEarned: number;
  isOriginal: boolean;
};

const createStorySchema = z.object({
  title: z.string().min(5).max(200),
  url: z.string().url().optional().or(z.literal("")),
  description: z.string().min(10).max(1000),
  // Optional: user explicitly chooses to create new story even if match exists
  forceNew: z.boolean().optional(),
  // Optional: user confirms discovering an existing story
  discoverStoryId: z.string().optional(),
});

const checkMatchSchema = z.object({
  title: z.string().min(5).max(200),
  url: z.string().url().optional().or(z.literal("")),
  description: z.string().min(10).max(1000),
});

export async function storiesRoutes(fastify: FastifyInstance) {
  // List stories
  fastify.get("/", async (request) => {
    const { page = "1", limit = "10", status = "active" } = request.query as {
      page?: string;
      limit?: string;
      status?: string;
    };
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    // Check cache
    const cacheKey = `stories:${status}:${pageNum}:${limitNum}`;
    const cached = await getCache<{ stories: any[]; total: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        where: { status: status as any },
        include: {
          submitter: {
            select: { id: true, displayName: true },
          },
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.story.count({ where: { status: status as any } }),
    ]);

    // Map to include discovererCount
    const mappedStories = stories.map((story: StoryWithSubmitterAndCount) => ({
      ...story,
      discovererCount: story._count.submissions,
    }));

    const result = { stories: mappedStories, total };
    await setCache(cacheKey, result, 30); // Cache for 30 seconds

    return result;
  });

  // Get single story
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const story = await prisma.story.findUnique({
      where: { id },
      include: {
        submitter: {
          select: { id: true, displayName: true },
        },
        submissions: {
          include: {
            user: {
              select: { id: true, displayName: true },
            },
          },
          orderBy: { submittedAt: "asc" },
          take: 10,
        },
        _count: {
          select: { submissions: true },
        },
        viralitySnapshots: {
          orderBy: { timestamp: "desc" },
          take: 10,
        },
      },
    });

    if (!story) {
      return reply.status(404).send({ message: "Story not found" });
    }

    return {
      ...story,
      discovererCount: story._count.submissions,
      discoverers: story.submissions.map((sub: SubmissionWithUser, index: number) => ({
        rank: index + 1,
        user: sub.user,
        submittedAt: sub.submittedAt,
        kudosEarned: sub.kudosEarned,
        isOriginal: sub.isOriginal,
      })),
    };
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

  // Check for matching stories before submission (authenticated)
  // This allows the frontend to show match suggestions before committing
  fastify.post("/check-match", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const result = checkMatchSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input", errors: result.error.flatten() });
    }

    const { title, url, description } = result.data;
    const sourceDomain = url ? new URL(url).hostname.replace("www.", "") : "user";

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
        storyId: matchResult.bestMatch.storyId,
        title: matchResult.bestMatch.title,
        description: matchResult.bestMatch.description,
        discovererCount: matchResult.bestMatch.participantCount,
        scores: {
          semantic: Math.round(matchResult.bestMatch.semanticScore * 100),
          entity: Math.round(matchResult.bestMatch.entityScore * 100),
          temporal: Math.round(matchResult.bestMatch.temporalScore * 100),
          composite: Math.round(matchResult.bestMatch.compositeScore * 100),
        },
      } : null,
      otherCandidates: matchResult.candidates.slice(1, 5).map((c) => ({
        storyId: c.storyId,
        title: c.title,
        discovererCount: c.participantCount,
        composite: Math.round(c.compositeScore * 100),
      })),
      entities, // Return extracted entities for display
    };
  });

  // Create story / Submit discovery (authenticated)
  fastify.post("/", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const result = createStorySchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input", errors: result.error.flatten() });
    }

    const { title, url, description, forceNew, discoverStoryId } = result.data;
    const userId = (request as any).user.userId;

    // Extract domain from URL (or use "user" if no URL provided)
    const sourceDomain = url ? new URL(url).hostname.replace("www.", "") : "user";

    // If user wants to discover an existing story
    if (discoverStoryId) {
      return await discoverExistingStory(userId, discoverStoryId, reply);
    }

    // Check for exact URL duplicate
    const duplicateCheck = await checkDuplicateStory(title, description, url);
    if (duplicateCheck.isDuplicate && duplicateCheck.similarStory) {
      // Instead of rejecting, offer to discover the existing story
      return reply.status(300).send({
        message: "This story already exists. Would you like to discover it?",
        existingStory: {
          id: duplicateCheck.similarStory.id,
          title: duplicateCheck.similarStory.title,
        },
        actions: {
          discover: {
            method: "POST",
            path: "/stories",
            body: { ...result.data, discoverStoryId: duplicateCheck.similarStory.id },
          },
        },
      });
    }

    // Generate embedding and extract entities
    const embedding = await generateEmbedding(`${title} ${description}`);
    const entities = await extractEntities(title, description, url);

    // AI classification
    const classification = await classifyStory(title, description, url);

    // Run the matcher unless user explicitly wants a new story
    if (!forceNew) {
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

      // For exact matches, offer to discover existing story
      if (matchResult.decision === "exact_match" && matchResult.bestMatch) {
        return reply.status(300).send({
          message: "This story matches an existing one. Would you like to discover it?",
          matchResult: {
            decision: matchResult.decision,
            confidence: Math.round(matchResult.confidence * 100),
            reasoning: matchResult.reasoning,
            bestMatch: {
              storyId: matchResult.bestMatch.storyId,
              title: matchResult.bestMatch.title,
              description: matchResult.bestMatch.description,
              discovererCount: matchResult.bestMatch.participantCount,
            },
          },
          actions: {
            discover: {
              method: "POST",
              path: "/stories",
              body: { ...result.data, discoverStoryId: matchResult.bestMatch.storyId },
            },
            createNew: {
              method: "POST",
              path: "/stories",
              body: { ...result.data, forceNew: true },
            },
          },
        });
      }

      // For likely matches, return the suggestion for user confirmation
      if (matchResult.decision === "likely_match" && matchResult.bestMatch) {
        return reply.status(300).send({
          message: "A similar story exists. Would you like to discover it instead?",
          matchResult: {
            decision: matchResult.decision,
            confidence: Math.round(matchResult.confidence * 100),
            reasoning: matchResult.reasoning,
            bestMatch: {
              storyId: matchResult.bestMatch.storyId,
              title: matchResult.bestMatch.title,
              description: matchResult.bestMatch.description,
              discovererCount: matchResult.bestMatch.participantCount,
            },
          },
          actions: {
            discover: {
              method: "POST",
              path: "/stories",
              body: { ...result.data, discoverStoryId: matchResult.bestMatch.storyId },
            },
            createNew: {
              method: "POST",
              path: "/stories",
              body: { ...result.data, forceNew: true },
            },
          },
        });
      }
    }

    // Create new story
    const story = await prisma.$transaction(async (tx: TransactionClient) => {
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

      // Create story with entities
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
          matchDecision: "create_new",
        },
      });

      // Create submission for the original discoverer
      await tx.submission.create({
        data: {
          userId,
          storyId: newStory.id,
          isOriginal: true,
        },
      });

      return newStory;
    });

    // Invalidate cache
    await deleteCache("stories:*");

    return {
      ...story,
      message: "Story submitted! You are the first discoverer.",
      isOriginalDiscoverer: true,
    };
  });

  // Discover an existing story (add yourself as a discoverer)
  fastify.post("/:id/discover", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user.userId;

    return await discoverExistingStory(userId, id, reply);
  });
}

/**
 * Helper function to add a discovery to an existing story
 */
async function discoverExistingStory(
  userId: string,
  storyId: string,
  reply: any
) {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      title: true,
      status: true,
      _count: { select: { submissions: true } },
    },
  });

  if (!story) {
    return reply.status(404).send({ message: "Story not found" });
  }

  if (story.status !== "active" && story.status !== "pending") {
    return reply.status(400).send({ message: "Story is no longer accepting discoveries" });
  }

  // Check if user already discovered this story
  const existingSubmission = await prisma.submission.findFirst({
    where: { userId, storyId },
  });

  if (existingSubmission) {
    return reply.status(409).send({ message: "You have already discovered this story" });
  }

  // Check if this is the first submission (original discoverer)
  const isOriginal = story._count.submissions === 0;

  // Create submission
  const submission = await prisma.submission.create({
    data: {
      userId,
      storyId,
      isOriginal,
    },
    include: {
      story: {
        select: {
          id: true,
          title: true,
          sourceDomain: true,
        },
      },
    },
  });

  // Invalidate cache
  await deleteCache("stories:*");

  return {
    id: submission.id,
    storyId: submission.storyId,
    submittedAt: submission.submittedAt,
    isOriginal: submission.isOriginal,
    message: isOriginal
      ? "You are the first to discover this story!"
      : "Discovery recorded! You'll earn kudos when the story peaks.",
    story: submission.story,
  };
}
