import { prisma } from "../lib/prisma.js";
import { PrismaClient } from "@prisma/client";
import { deleteCache } from "../lib/redis.js";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

type WeeklyUserData = {
  id: string;
  displayName: string | null;
  email: string;
  weeklyKudos: number;
  weeklyRank: number | null;
  _count: { submissions: number };
};

type AllTimeUserData = {
  id: string;
  displayName: string | null;
  email: string;
  totalKudos: number;
  allTimeRank: number | null;
  _count: { submissions: number };
};

// Kudos scoring constants
const BASE_KUDOS = 100;
const MAX_EARLY_BONUS = 100;
const MAX_TIMING_BONUS = 50;
const FIRST_SUBMITTER_MULTIPLIER = 2.0;

// Submission type for kudos calculation
interface SubmissionWithTiming {
  id: string;
  userId: string;
  submittedAt: Date;
  isOriginal: boolean;
}

/**
 * Calculate kudos for a single submission
 *
 * Formula:
 * - baseKudos = 100 (for participating)
 * - earlyBonus = max(0, 100 - (submissionOrder - 1) * 10)  // Earlier = more kudos
 * - timingBonus = max(0, 50 - hoursSinceFirst * 5)          // Within first hours
 * - viralityBonus = floor(peakViralityScore / 10) * 5       // Higher virality = more
 * - totalKudos = (base + early + timing + virality) * multiplier
 * - First submitter multiplier: 2x
 */
function calculateKudosForSubmission(
  submissionOrder: number,
  peakViralityScore: number,
  hoursSinceFirstSubmission: number,
  isFirstSubmitter: boolean
): number {
  // Base kudos for participating
  const baseKudos = BASE_KUDOS;

  // Early bird bonus (first submitters get more)
  // First submitter gets 100 bonus, decays by 10 for each subsequent submitter
  const earlyBonus = Math.max(0, MAX_EARLY_BONUS - (submissionOrder - 1) * 10);

  // Timing bonus (submitted within first hours of story breaking)
  // Full 50 bonus if submitted immediately, decays by 5 per hour
  const timingBonus = Math.max(0, MAX_TIMING_BONUS - hoursSinceFirstSubmission * 5);

  // Virality bonus (story went viral)
  // 5 kudos for each 10 points of virality
  const viralityBonus = Math.floor(peakViralityScore / 10) * 5;

  // First submitter multiplier
  const multiplier = isFirstSubmitter ? FIRST_SUBMITTER_MULTIPLIER : 1.0;

  return Math.floor((baseKudos + earlyBonus + timingBonus + viralityBonus) * multiplier);
}

/**
 * Calculate and distribute kudos for all submissions on a story
 * Called when a story's virality peaks/settles
 */
export async function calculateKudos(storyId: string): Promise<{
  success: boolean;
  totalKudosDistributed: number;
  submissionsProcessed: number;
}> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      title: true,
      peakViralityScore: true,
      kudosDistributed: true,
      submissions: {
        orderBy: { submittedAt: "asc" },
        select: {
          id: true,
          userId: true,
          submittedAt: true,
          isOriginal: true,
        },
      },
    },
  });

  if (!story) {
    console.error(`[Kudos] Story ${storyId} not found`);
    return { success: false, totalKudosDistributed: 0, submissionsProcessed: 0 };
  }

  if (story.kudosDistributed) {
    console.log(`[Kudos] Story ${storyId} already has kudos distributed`);
    return { success: false, totalKudosDistributed: 0, submissionsProcessed: 0 };
  }

  if (story.submissions.length === 0) {
    console.log(`[Kudos] Story ${storyId} has no submissions`);
    return { success: false, totalKudosDistributed: 0, submissionsProcessed: 0 };
  }

  const peakVirality = story.peakViralityScore ?? 0;
  const firstSubmissionTime = story.submissions[0].submittedAt;
  let totalKudosDistributed = 0;

  await prisma.$transaction(async (tx: TransactionClient) => {
    // Process each submission
    for (let i = 0; i < story.submissions.length; i++) {
      const submission = story.submissions[i];
      const submissionOrder = i + 1;
      const hoursSinceFirst =
        (submission.submittedAt.getTime() - firstSubmissionTime.getTime()) / (1000 * 60 * 60);

      const kudosEarned = calculateKudosForSubmission(
        submissionOrder,
        peakVirality,
        hoursSinceFirst,
        submission.isOriginal
      );

      totalKudosDistributed += kudosEarned;

      // Update submission with kudos earned
      await tx.submission.update({
        where: { id: submission.id },
        data: { kudosEarned },
      });

      // Update user's total and weekly kudos
      await tx.user.update({
        where: { id: submission.userId },
        data: {
          totalKudos: { increment: kudosEarned },
          weeklyKudos: { increment: kudosEarned },
        },
      });

      // Create kudos history entry
      const reason = submission.isOriginal ? "first_discoverer" : "early_discovery";
      await tx.kudosHistory.create({
        data: {
          userId: submission.userId,
          amount: kudosEarned,
          reason,
          storyId: story.id,
        },
      });

      // If story was highly viral, add bonus kudos entry
      if (peakVirality >= 50) {
        const viralBonus = Math.floor(peakVirality / 10) * 5;
        await tx.kudosHistory.create({
          data: {
            userId: submission.userId,
            amount: viralBonus,
            reason: "viral_bonus",
            storyId: story.id,
          },
        });
      }
    }

    // Mark story as having kudos distributed
    await tx.story.update({
      where: { id: storyId },
      data: {
        kudosDistributed: true,
        kudosPool: totalKudosDistributed,
        status: "settled",
      },
    });
  });

  console.log(
    `[Kudos] Story ${storyId} settled. Total kudos: ${totalKudosDistributed}, Submissions: ${story.submissions.length}`
  );

  // Update leaderboards after kudos distribution
  await updateLeaderboards();

  // Invalidate relevant caches
  await deleteCache("stories:*");
  await deleteCache("leaderboards:*");

  return {
    success: true,
    totalKudosDistributed,
    submissionsProcessed: story.submissions.length,
  };
}

/**
 * Update weekly and all-time leaderboard rankings
 */
export async function updateLeaderboards(): Promise<{
  weeklyUpdated: number;
  allTimeUpdated: number;
}> {
  // Update weekly rankings
  const weeklyUsers = await prisma.user.findMany({
    where: { weeklyKudos: { gt: 0 } },
    orderBy: { weeklyKudos: "desc" },
    select: { id: true },
  });

  let weeklyUpdated = 0;
  for (let i = 0; i < weeklyUsers.length; i++) {
    await prisma.user.update({
      where: { id: weeklyUsers[i].id },
      data: { weeklyRank: i + 1 },
    });
    weeklyUpdated++;
  }

  // Update all-time rankings
  const allTimeUsers = await prisma.user.findMany({
    where: { totalKudos: { gt: 0 } },
    orderBy: { totalKudos: "desc" },
    select: { id: true },
  });

  let allTimeUpdated = 0;
  for (let i = 0; i < allTimeUsers.length; i++) {
    await prisma.user.update({
      where: { id: allTimeUsers[i].id },
      data: { allTimeRank: i + 1 },
    });
    allTimeUpdated++;
  }

  console.log(`[Kudos] Leaderboards updated: ${weeklyUpdated} weekly, ${allTimeUpdated} all-time`);

  return { weeklyUpdated, allTimeUpdated };
}

/**
 * Reset weekly kudos for all users (run weekly via cron)
 */
export async function resetWeeklyKudos(): Promise<{ usersReset: number }> {
  // Get all users with weekly kudos before reset
  const usersWithKudos = await prisma.user.findMany({
    where: { weeklyKudos: { gt: 0 } },
    select: { id: true, weeklyKudos: true },
  });

  await prisma.$transaction(async (tx: TransactionClient) => {
    // Create history entries for the reset
    for (const user of usersWithKudos) {
      await tx.kudosHistory.create({
        data: {
          userId: user.id,
          amount: -user.weeklyKudos,
          reason: "weekly_reset",
        },
      });
    }

    // Reset all weekly kudos and ranks
    await tx.user.updateMany({
      data: {
        weeklyKudos: 0,
        weeklyRank: null,
      },
    });
  });

  console.log(`[Kudos] Weekly reset complete: ${usersWithKudos.length} users reset`);

  // Invalidate leaderboard cache
  await deleteCache("leaderboards:*");

  return { usersReset: usersWithKudos.length };
}

/**
 * Get kudos history for a user
 */
export async function getUserKudosHistory(
  userId: string,
  limit: number = 20
): Promise<
  Array<{
    id: string;
    amount: number;
    reason: string;
    storyId: string | null;
    createdAt: Date;
    story?: { title: string } | null;
  }>
> {
  return prisma.kudosHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      story: {
        select: { title: true },
      },
    },
  });
}

/**
 * Get weekly leaderboard
 */
export async function getWeeklyLeaderboard(limit: number = 50): Promise<
  Array<{
    rank: number;
    user: {
      id: string;
      displayName: string | null;
      email: string;
    };
    kudos: number;
    discoveries: number;
  }>
> {
  const users = await prisma.user.findMany({
    where: { weeklyKudos: { gt: 0 } },
    orderBy: { weeklyKudos: "desc" },
    take: limit,
    select: {
      id: true,
      displayName: true,
      email: true,
      weeklyKudos: true,
      weeklyRank: true,
      _count: {
        select: { submissions: true },
      },
    },
  });

  return users.map((u: WeeklyUserData) => ({
    rank: u.weeklyRank ?? 0,
    user: {
      id: u.id,
      displayName: u.displayName,
      email: u.email,
    },
    kudos: u.weeklyKudos,
    discoveries: u._count.submissions,
  }));
}

/**
 * Get all-time leaderboard
 */
export async function getAllTimeLeaderboard(limit: number = 50): Promise<
  Array<{
    rank: number;
    user: {
      id: string;
      displayName: string | null;
      email: string;
    };
    kudos: number;
    discoveries: number;
  }>
> {
  const users = await prisma.user.findMany({
    where: { totalKudos: { gt: 0 } },
    orderBy: { totalKudos: "desc" },
    take: limit,
    select: {
      id: true,
      displayName: true,
      email: true,
      totalKudos: true,
      allTimeRank: true,
      _count: {
        select: { submissions: true },
      },
    },
  });

  return users.map((u: AllTimeUserData) => ({
    rank: u.allTimeRank ?? 0,
    user: {
      id: u.id,
      displayName: u.displayName,
      email: u.email,
    },
    kudos: u.totalKudos,
    discoveries: u._count.submissions,
  }));
}

/**
 * Get user's kudos stats
 */
export async function getUserKudosStats(userId: string): Promise<{
  totalKudos: number;
  weeklyKudos: number;
  allTimeRank: number | null;
  weeklyRank: number | null;
  totalDiscoveries: number;
  originalDiscoveries: number;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totalKudos: true,
      weeklyKudos: true,
      allTimeRank: true,
      weeklyRank: true,
      _count: {
        select: { submissions: true },
      },
      submissions: {
        where: { isOriginal: true },
        select: { id: true },
      },
    },
  });

  if (!user) return null;

  return {
    totalKudos: user.totalKudos,
    weeklyKudos: user.weeklyKudos,
    allTimeRank: user.allTimeRank,
    weeklyRank: user.weeklyRank,
    totalDiscoveries: user._count.submissions,
    originalDiscoveries: user.submissions.length,
  };
}
