import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getViralityHistory, updateStoryVirality, isViralityDecaying } from "../services/virality.js";

export async function viralityRoutes(fastify: FastifyInstance) {
  // Get virality for a story
  fastify.get("/:storyId", async (request, reply) => {
    const { storyId } = request.params as { storyId: string };

    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        title: true,
        currentViralityScore: true,
        peakViralityScore: true,
        viralityTrend: true,
      },
    });

    if (!story) {
      return reply.status(404).send({ message: "Story not found" });
    }

    // Get history
    const history = await getViralityHistory(storyId, 20);

    // Check decay status
    const decayStatus = await isViralityDecaying(storyId);

    return {
      storyId: story.id,
      title: story.title,
      current: {
        score: story.currentViralityScore,
        peak: story.peakViralityScore,
        trend: story.viralityTrend,
      },
      isDecaying: decayStatus.isDecaying,
      decayReason: decayStatus.reason,
      history,
    };
  });

  // Get latest virality snapshot for a story
  fastify.get("/:storyId/latest", async (request, reply) => {
    const { storyId } = request.params as { storyId: string };

    const snapshot = await prisma.viralitySnapshot.findFirst({
      where: { storyId },
      orderBy: { timestamp: "desc" },
    });

    if (!snapshot) {
      return reply.status(404).send({ message: "No virality data found" });
    }

    return snapshot;
  });

  // Manually trigger virality update for a story (admin only)
  fastify.post(
    "/:storyId/refresh",
    { preHandler: [(fastify as any).authenticateAdmin] },
    async (request, reply) => {
      const { storyId } = request.params as { storyId: string };

      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { id: true },
      });

      if (!story) {
        return reply.status(404).send({ message: "Story not found" });
      }

      await updateStoryVirality(storyId);

      // Get updated data
      const updated = await prisma.story.findUnique({
        where: { id: storyId },
        select: {
          currentViralityScore: true,
          peakViralityScore: true,
          viralityTrend: true,
        },
      });

      return {
        message: "Virality updated",
        ...updated,
      };
    }
  );

  // Get virality leaderboard (top trending stories)
  fastify.get("/", async (request) => {
    const { limit = "10", trend } = request.query as { limit?: string; trend?: string };

    const whereClause: any = {
      status: "active",
      currentViralityScore: { not: null },
    };

    if (trend && ["rising", "stable", "declining"].includes(trend)) {
      whereClause.viralityTrend = trend;
    }

    const stories = await prisma.story.findMany({
      where: whereClause,
      orderBy: { currentViralityScore: "desc" },
      take: parseInt(limit, 10),
      select: {
        id: true,
        title: true,
        sourceDomain: true,
        currentViralityScore: true,
        peakViralityScore: true,
        viralityTrend: true,
        market: {
          select: {
            totalPool: true,
            participantCount: true,
            status: true,
          },
        },
      },
    });

    return { stories };
  });
}
