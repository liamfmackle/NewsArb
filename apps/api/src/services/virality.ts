import { prisma } from "../lib/prisma.js";

// Types for virality metrics
interface RawMetrics {
  articleCount: number;
  socialMentions: number;
  searchInterest: number;
  engagementRate: number;
}

interface ViralityResult {
  score: number;
  velocityChange: number;
  trend: "rising" | "stable" | "declining";
  metrics: RawMetrics;
}

// Weight configuration for virality score
const WEIGHTS = {
  articleCount: 0.3,
  socialMentions: 0.3,
  searchInterest: 0.25,
  engagementRate: 0.15,
};

// Thresholds for trend detection
const VELOCITY_THRESHOLDS = {
  rising: 5, // Score increased by more than 5 points
  declining: -5, // Score decreased by more than 5 points
};

/**
 * Fetch article count from NewsAPI
 * In production, this would call the real NewsAPI
 */
async function fetchArticleCount(title: string, url: string): Promise<number> {
  const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

  if (!NEWSAPI_KEY) {
    // Return simulated data for development
    return Math.floor(Math.random() * 50) + 1;
  }

  try {
    // Extract keywords from title for search
    const keywords = encodeURIComponent(title.split(" ").slice(0, 5).join(" "));
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${keywords}&sortBy=publishedAt&pageSize=1&apiKey=${NEWSAPI_KEY}`
    );

    if (!response.ok) {
      console.error("NewsAPI error:", response.status);
      return 0;
    }

    const data = (await response.json()) as { totalResults?: number };
    return data.totalResults || 0;
  } catch (error) {
    console.error("Error fetching article count:", error);
    return 0;
  }
}

/**
 * Fetch social mentions
 * In production, this would aggregate from Twitter, Reddit, etc.
 */
async function fetchSocialMentions(title: string, url: string): Promise<number> {
  // For MVP, simulate social mentions
  // In production, integrate with social APIs
  return Math.floor(Math.random() * 100) + 10;
}

/**
 * Fetch search interest (Google Trends proxy)
 * Returns 0-100 scale
 */
async function fetchSearchInterest(title: string): Promise<number> {
  // For MVP, simulate search interest
  // In production, use Google Trends API or pytrends
  return Math.floor(Math.random() * 100);
}

/**
 * Calculate engagement rate based on available metrics
 */
function calculateEngagementRate(
  articleCount: number,
  socialMentions: number,
  searchInterest: number
): number {
  // Normalize and combine metrics
  const normalizedArticles = Math.min(articleCount / 100, 1);
  const normalizedSocial = Math.min(socialMentions / 500, 1);
  const normalizedSearch = searchInterest / 100;

  return (normalizedArticles + normalizedSocial + normalizedSearch) / 3;
}

/**
 * Calculate the virality score from raw metrics
 */
function calculateViralityScore(metrics: RawMetrics): number {
  // Normalize metrics to 0-100 scale
  const normalizedArticles = Math.min((metrics.articleCount / 100) * 100, 100);
  const normalizedSocial = Math.min((metrics.socialMentions / 500) * 100, 100);
  const normalizedSearch = metrics.searchInterest; // Already 0-100
  const normalizedEngagement = metrics.engagementRate * 100;

  // Weighted average
  const score =
    normalizedArticles * WEIGHTS.articleCount +
    normalizedSocial * WEIGHTS.socialMentions +
    normalizedSearch * WEIGHTS.searchInterest +
    normalizedEngagement * WEIGHTS.engagementRate;

  return Math.round(score * 10) / 10; // Round to 1 decimal
}

/**
 * Determine trend based on velocity
 */
function determineTrend(velocityChange: number): "rising" | "stable" | "declining" {
  if (velocityChange >= VELOCITY_THRESHOLDS.rising) {
    return "rising";
  } else if (velocityChange <= VELOCITY_THRESHOLDS.declining) {
    return "declining";
  }
  return "stable";
}

/**
 * Get the previous virality score for a story
 */
async function getPreviousScore(storyId: string): Promise<number | null> {
  const lastSnapshot = await prisma.viralitySnapshot.findFirst({
    where: { storyId },
    orderBy: { timestamp: "desc" },
    select: { viralityScore: true },
  });

  return lastSnapshot?.viralityScore ?? null;
}

/**
 * Main function to calculate virality for a story
 */
export async function calculateVirality(
  storyId: string,
  title: string,
  url: string
): Promise<ViralityResult> {
  // Fetch raw metrics
  const [articleCount, socialMentions, searchInterest] = await Promise.all([
    fetchArticleCount(title, url),
    fetchSocialMentions(title, url),
    fetchSearchInterest(title),
  ]);

  const engagementRate = calculateEngagementRate(articleCount, socialMentions, searchInterest);

  const metrics: RawMetrics = {
    articleCount,
    socialMentions,
    searchInterest,
    engagementRate,
  };

  // Calculate score
  const score = calculateViralityScore(metrics);

  // Get previous score for velocity calculation
  const previousScore = await getPreviousScore(storyId);
  const velocityChange = previousScore !== null ? score - previousScore : 0;

  // Determine trend
  const trend = determineTrend(velocityChange);

  return {
    score,
    velocityChange,
    trend,
    metrics,
  };
}

/**
 * Update virality for a single story
 */
export async function updateStoryVirality(storyId: string): Promise<void> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, title: true, url: true, peakViralityScore: true },
  });

  if (!story) {
    console.error(`Story ${storyId} not found`);
    return;
  }

  const result = await calculateVirality(story.id, story.title, story.url);

  // Create snapshot
  await prisma.viralitySnapshot.create({
    data: {
      storyId: story.id,
      articleCount: result.metrics.articleCount,
      socialMentions: result.metrics.socialMentions,
      searchInterest: result.metrics.searchInterest,
      engagementRate: result.metrics.engagementRate,
      viralityScore: result.score,
      velocityChange: result.velocityChange,
      trend: result.trend,
    },
  });

  // Update story with current virality
  const newPeak = Math.max(story.peakViralityScore ?? 0, result.score);

  await prisma.story.update({
    where: { id: story.id },
    data: {
      currentViralityScore: result.score,
      peakViralityScore: newPeak,
      viralityTrend: result.trend,
    },
  });
}

/**
 * Update virality for all active stories
 */
export async function updateAllActiveVirality(): Promise<{
  updated: number;
  errors: number;
}> {
  const activeStories = await prisma.story.findMany({
    where: {
      status: "active",
      market: {
        status: "open",
      },
    },
    select: { id: true },
  });

  let updated = 0;
  let errors = 0;

  for (const story of activeStories) {
    try {
      await updateStoryVirality(story.id);
      updated++;
    } catch (error) {
      console.error(`Error updating virality for story ${story.id}:`, error);
      errors++;
    }
  }

  console.log(`Virality update complete: ${updated} updated, ${errors} errors`);
  return { updated, errors };
}

/**
 * Get virality history for a story
 */
export async function getViralityHistory(
  storyId: string,
  limit: number = 20
): Promise<
  Array<{
    timestamp: Date;
    score: number;
    trend: string;
    velocityChange: number;
  }>
> {
  const snapshots = await prisma.viralitySnapshot.findMany({
    where: { storyId },
    orderBy: { timestamp: "desc" },
    take: limit,
    select: {
      timestamp: true,
      viralityScore: true,
      trend: true,
      velocityChange: true,
    },
  });

  return snapshots.map((s) => ({
    timestamp: s.timestamp,
    score: s.viralityScore,
    trend: s.trend,
    velocityChange: s.velocityChange,
  }));
}

/**
 * Check if a story's virality is decaying (for settlement)
 */
export async function isViralityDecaying(storyId: string): Promise<{
  isDecaying: boolean;
  reason?: string;
}> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      currentViralityScore: true,
      peakViralityScore: true,
    },
  });

  if (!story) {
    return { isDecaying: false };
  }

  // Get last 3 snapshots
  const snapshots = await prisma.viralitySnapshot.findMany({
    where: { storyId },
    orderBy: { timestamp: "desc" },
    take: 3,
    select: {
      trend: true,
      velocityChange: true,
      viralityScore: true,
    },
  });

  if (snapshots.length < 3) {
    return { isDecaying: false, reason: "Not enough data" };
  }

  // Condition 1: All declining for 3 consecutive checks
  const allDeclining = snapshots.every((s) => s.trend === "declining");

  // Condition 2: Sustained negative velocity
  const avgVelocity =
    snapshots.reduce((sum, s) => sum + s.velocityChange, 0) / snapshots.length;
  const sustainedDecline = avgVelocity < -5;

  // Condition 3: Dropped 40% from peak
  const { currentViralityScore, peakViralityScore } = story;
  const droppedFromPeak =
    peakViralityScore &&
    currentViralityScore &&
    (peakViralityScore - currentViralityScore) / peakViralityScore > 0.4;

  if ((allDeclining && sustainedDecline) || droppedFromPeak) {
    let reason = "";
    if (droppedFromPeak) {
      reason = `Score dropped from peak ${peakViralityScore?.toFixed(1)} to ${currentViralityScore?.toFixed(1)} (>40% decline)`;
    } else {
      reason = `Sustained decline: avg velocity ${avgVelocity.toFixed(1)} over 3 checks`;
    }

    return { isDecaying: true, reason };
  }

  return { isDecaying: false };
}
