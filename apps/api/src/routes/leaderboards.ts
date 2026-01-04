import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { getWeeklyLeaderboard, getAllTimeLeaderboard, updateLeaderboards } from "../services/kudos.js";
import { getCache, setCache } from "../lib/redis.js";

type StoryWithCount = Prisma.StoryGetPayload<{
  select: {
    id: true;
    title: true;
    sourceDomain: true;
    peakViralityScore: true;
    kudosPool: true;
    status: true;
    createdAt: true;
    submitter: { select: { id: true; displayName: true } };
    _count: { select: { submissions: true } };
  };
}>;

export async function leaderboardsRoutes(fastify: FastifyInstance) {
  // Get weekly leaderboard
  fastify.get("/weekly", async (request) => {
    const { limit = "50" } = request.query as { limit?: string };
    const limitNum = Math.min(parseInt(limit, 10), 100);

    // Check cache
    const cacheKey = `leaderboards:weekly:${limitNum}`;
    const cached = await getCache<any[]>(cacheKey);
    if (cached) {
      return { leaderboard: cached, type: "weekly" };
    }

    const leaderboard = await getWeeklyLeaderboard(limitNum);

    // Cache for 5 minutes
    await setCache(cacheKey, leaderboard, 300);

    return { leaderboard, type: "weekly" };
  });

  // Get all-time leaderboard
  fastify.get("/all-time", async (request) => {
    const { limit = "50" } = request.query as { limit?: string };
    const limitNum = Math.min(parseInt(limit, 10), 100);

    // Check cache
    const cacheKey = `leaderboards:all-time:${limitNum}`;
    const cached = await getCache<any[]>(cacheKey);
    if (cached) {
      return { leaderboard: cached, type: "all-time" };
    }

    const leaderboard = await getAllTimeLeaderboard(limitNum);

    // Cache for 5 minutes
    await setCache(cacheKey, leaderboard, 300);

    return { leaderboard, type: "all-time" };
  });

  // Get top viral stories
  fastify.get("/stories", async (request) => {
    const { limit = "20" } = request.query as { limit?: string };
    const limitNum = Math.min(parseInt(limit, 10), 50);

    // Check cache
    const cacheKey = `leaderboards:stories:${limitNum}`;
    const cached = await getCache<any[]>(cacheKey);
    if (cached) {
      return { stories: cached };
    }

    const stories = await prisma.story.findMany({
      where: {
        status: { in: ["active", "settled"] },
        peakViralityScore: { not: null },
      },
      orderBy: { peakViralityScore: "desc" },
      take: limitNum,
      select: {
        id: true,
        title: true,
        sourceDomain: true,
        peakViralityScore: true,
        kudosPool: true,
        status: true,
        createdAt: true,
        submitter: {
          select: { id: true, displayName: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    const mappedStories = stories.map((story: StoryWithCount, index: number) => ({
      rank: index + 1,
      id: story.id,
      title: story.title,
      sourceDomain: story.sourceDomain,
      peakViralityScore: story.peakViralityScore,
      kudosPool: story.kudosPool,
      status: story.status,
      createdAt: story.createdAt,
      submitter: story.submitter,
      discovererCount: story._count.submissions,
    }));

    // Cache for 5 minutes
    await setCache(cacheKey, mappedStories, 300);

    return { stories: mappedStories };
  });

  // Get current user's rank (authenticated)
  fastify.get("/me", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userId = (request as any).user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        totalKudos: true,
        weeklyKudos: true,
        allTimeRank: true,
        weeklyRank: true,
        _count: {
          select: { submissions: true },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
      },
      stats: {
        totalKudos: user.totalKudos,
        weeklyKudos: user.weeklyKudos,
        allTimeRank: user.allTimeRank,
        weeklyRank: user.weeklyRank,
        discoveries: user._count.submissions,
      },
    };
  });

  // Admin: Force leaderboard recalculation
  fastify.post("/recalculate", { preHandler: [(fastify as any).authenticateAdmin] }, async () => {
    const result = await updateLeaderboards();

    return {
      message: "Leaderboards recalculated",
      weeklyUpdated: result.weeklyUpdated,
      allTimeUpdated: result.allTimeUpdated,
    };
  });
}
