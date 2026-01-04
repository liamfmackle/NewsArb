import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserKudosHistory, getUserKudosStats } from "../services/kudos.js";

// Local types for submission data
interface StoryData {
  id: string;
  title: string;
  sourceDomain: string;
  currentViralityScore: number | null;
  peakViralityScore: number | null;
  status: string;
}

interface SubmissionWithStory {
  id: string;
  userId: string;
  storyId: string;
  submittedAt: Date;
  kudosEarned: number;
  isOriginal: boolean;
  story: StoryData | null;
}

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
});

export async function usersRoutes(fastify: FastifyInstance) {
  // Get current user
  fastify.get("/me", { preHandler: [(fastify as any).authenticate] }, async (request) => {
    const userId = (request as any).user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        totalKudos: true,
        weeklyKudos: true,
        allTimeRank: true,
        weeklyRank: true,
        createdAt: true,
      },
    });

    return user;
  });

  // Update current user
  fastify.patch("/me", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const result = updateProfileSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({ message: "Invalid input", errors: result.error.flatten() });
    }

    const { displayName } = result.data;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined && { displayName }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        totalKudos: true,
        weeklyKudos: true,
        allTimeRank: true,
        weeklyRank: true,
      },
    });

    return user;
  });

  // Get user's kudos stats
  fastify.get("/me/kudos", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const userId = (request as any).user.userId;

    const stats = await getUserKudosStats(userId);

    if (!stats) {
      return reply.status(404).send({ message: "User not found" });
    }

    return stats;
  });

  // Get user's submissions (replaces positions)
  fastify.get("/me/submissions", { preHandler: [(fastify as any).authenticate] }, async (request) => {
    const userId = (request as any).user.userId;

    const submissions = await prisma.submission.findMany({
      where: { userId },
      include: {
        story: {
          select: {
            id: true,
            title: true,
            sourceDomain: true,
            currentViralityScore: true,
            peakViralityScore: true,
            status: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    // Flatten the response
    return submissions.map((sub: SubmissionWithStory) => ({
      id: sub.id,
      userId: sub.userId,
      storyId: sub.storyId,
      submittedAt: sub.submittedAt,
      kudosEarned: sub.kudosEarned,
      isOriginal: sub.isOriginal,
      story: sub.story,
    }));
  });

  // Get user's kudos history (replaces transactions)
  fastify.get("/me/kudos-history", { preHandler: [(fastify as any).authenticate] }, async (request) => {
    const userId = (request as any).user.userId;
    const { limit } = request.query as { limit?: string };

    const history = await getUserKudosHistory(userId, limit ? parseInt(limit, 10) : 20);

    return history;
  });

  // Get public user profile
  fastify.get("/:id/profile", async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        totalKudos: true,
        weeklyKudos: true,
        allTimeRank: true,
        weeklyRank: true,
        createdAt: true,
        _count: {
          select: { submissions: true },
        },
        submissions: {
          where: { isOriginal: true },
          select: { id: true },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    return {
      id: user.id,
      displayName: user.displayName,
      totalKudos: user.totalKudos,
      weeklyKudos: user.weeklyKudos,
      allTimeRank: user.allTimeRank,
      weeklyRank: user.weeklyRank,
      createdAt: user.createdAt,
      totalDiscoveries: user._count.submissions,
      originalDiscoveries: user.submissions.length,
    };
  });

  // Get user's top discoveries
  fastify.get("/:id/discoveries", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit } = request.query as { limit?: string };

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const submissions = await prisma.submission.findMany({
      where: { userId: id },
      include: {
        story: {
          select: {
            id: true,
            title: true,
            sourceDomain: true,
            currentViralityScore: true,
            peakViralityScore: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { kudosEarned: "desc" },
      take: limit ? parseInt(limit, 10) : 10,
    });

    return submissions.map((sub: { id: string; submittedAt: Date; kudosEarned: number; isOriginal: boolean; story: StoryData | null }) => ({
      id: sub.id,
      submittedAt: sub.submittedAt,
      kudosEarned: sub.kudosEarned,
      isOriginal: sub.isOriginal,
      story: sub.story,
    }));
  });
}
