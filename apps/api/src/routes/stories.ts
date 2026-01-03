import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  classifyStory,
  checkDuplicateStory,
  generateEmbedding,
  findRelatedStories,
} from "../ai/classifier.js";
import { getCache, setCache, deleteCache } from "../lib/redis.js";

const createStorySchema = z.object({
  title: z.string().min(5).max(200),
  url: z.string().url(),
  description: z.string().min(10).max(1000),
  initialStake: z.number().min(1),
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

  // Create story (authenticated)
  fastify.post("/", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const result = createStorySchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input", errors: result.error.flatten() });
    }

    const { title, url, description, initialStake } = result.data;
    const userId = (request as any).user.userId;

    // Check user balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.balance < initialStake) {
      return reply.status(400).send({ message: "Insufficient balance" });
    }

    // Extract domain from URL
    const sourceDomain = new URL(url).hostname.replace("www.", "");

    // Check for duplicate story (with semantic similarity)
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

    // AI classification
    const classification = await classifyStory(title, description, url);

    // Generate embedding for the story
    const embedding = await generateEmbedding(`${title} ${description}`);

    // Create story, market, and position in transaction
    const story = await prisma.$transaction(async (tx: typeof prisma) => {
      // Create or find canonical event if this is the first story of its kind
      let canonicalEventId: string | null = null;

      if (embedding) {
        // Create a new canonical event for this story (it's unique)
        const canonicalEvent = await tx.canonicalEvent.create({
          data: {
            title,
            description,
            embedding: JSON.stringify(embedding),
          },
        });
        canonicalEventId = canonicalEvent.id;
      }

      // Create story
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
