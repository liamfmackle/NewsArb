import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { manualKudosDistribution } from "../jobs/kudosCalculator.js";

type SubmissionData = {
  id: string;
  user: { id: string; displayName: string | null };
  submittedAt: Date;
  kudosEarned: number;
  isOriginal: boolean;
};

type ViralitySnapshotData = {
  timestamp: Date;
  viralityScore: number;
  trend: string | null;
};

type SubmissionWithUser = {
  id: string;
  user: { id: string; displayName: string | null; totalKudos: number; allTimeRank: number | null };
  submittedAt: Date;
  kudosEarned: number;
  isOriginal: boolean;
};

export async function marketsRoutes(fastify: FastifyInstance) {
  // Get story cluster by ID (formerly "market")
  // This route is kept for backwards compatibility - returns story with discoverers
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    // First check if it's a story ID
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
        },
        canonicalEvent: true,
        viralitySnapshots: {
          orderBy: { timestamp: "desc" },
          take: 10,
        },
      },
    });

    if (!story) {
      return reply.status(404).send({ message: "Story not found" });
    }

    // Return story data in a format similar to old market response
    return {
      id: story.id,
      storyId: story.id,
      status: story.status,
      discovererCount: story.submissions.length,
      kudosPool: story.kudosPool,
      kudosDistributed: story.kudosDistributed,
      story: {
        id: story.id,
        title: story.title,
        url: story.url,
        description: story.description,
        sourceDomain: story.sourceDomain,
        aiClassification: story.aiClassification,
        currentViralityScore: story.currentViralityScore,
        peakViralityScore: story.peakViralityScore,
        viralityTrend: story.viralityTrend,
        createdAt: story.createdAt,
        submitter: story.submitter,
      },
      discoverers: story.submissions.map((sub: SubmissionData) => ({
        id: sub.id,
        user: sub.user,
        submittedAt: sub.submittedAt,
        kudosEarned: sub.kudosEarned,
        isOriginal: sub.isOriginal,
      })),
      canonicalEvent: story.canonicalEvent,
      viralityHistory: story.viralitySnapshots.map((snap: ViralitySnapshotData) => ({
        timestamp: snap.timestamp,
        score: snap.viralityScore,
        trend: snap.trend,
      })),
    };
  });

  // Submit discovery for a story (replaces stake)
  fastify.post("/:id/discover", { preHandler: [(fastify as any).authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user.userId;

    // Get story
    const story = await prisma.story.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!story) {
      return reply.status(404).send({ message: "Story not found" });
    }

    if (story.status !== "active" && story.status !== "pending") {
      return reply.status(400).send({ message: "Story is no longer accepting discoveries" });
    }

    // Check if user already discovered this story
    const existingSubmission = await prisma.submission.findFirst({
      where: { userId, storyId: id },
    });

    if (existingSubmission) {
      return reply.status(409).send({ message: "You have already discovered this story" });
    }

    // Check if this is the first submission (original discoverer)
    const existingCount = await prisma.submission.count({
      where: { storyId: id },
    });

    const isOriginal = existingCount === 0;

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        userId,
        storyId: id,
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

    return {
      id: submission.id,
      storyId: submission.storyId,
      submittedAt: submission.submittedAt,
      isOriginal: submission.isOriginal,
      message: isOriginal
        ? "You are the first to discover this story!"
        : "Discovery recorded. You will earn kudos when the story peaks.",
      story: submission.story,
    };
  });

  // Manually distribute kudos (admin only)
  fastify.post("/:id/distribute-kudos", { preHandler: [(fastify as any).authenticateAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const story = await prisma.story.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!story) {
      return reply.status(404).send({ message: "Story not found" });
    }

    const result = await manualKudosDistribution(id);

    if (!result.success) {
      return reply.status(400).send({ message: result.message });
    }

    return {
      message: result.message,
      totalKudos: result.totalKudos,
    };
  });

  // Get discoverers for a story
  fastify.get("/:id/discoverers", async (request, reply) => {
    const { id } = request.params as { id: string };

    const story = await prisma.story.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!story) {
      return reply.status(404).send({ message: "Story not found" });
    }

    const submissions = await prisma.submission.findMany({
      where: { storyId: id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            totalKudos: true,
            allTimeRank: true,
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    });

    return submissions.map((sub: SubmissionWithUser, index: number) => ({
      rank: index + 1,
      user: sub.user,
      submittedAt: sub.submittedAt,
      kudosEarned: sub.kudosEarned,
      isOriginal: sub.isOriginal,
    }));
  });
}
