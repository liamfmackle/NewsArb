/**
 * AI Submission Matcher
 *
 * The core intellectual property for NewsArb's market pooling system.
 * This module analyzes incoming news submissions and determines whether they
 * should join an existing market pool or create a new one.
 *
 * The matcher uses multiple signals to identify when different submissions
 * are reporting on the same underlying news event:
 *
 * 1. Semantic Similarity - Embedding-based content matching
 * 2. Entity Overlap - Named entity recognition (people, orgs, locations)
 * 3. Temporal Proximity - Breaking news time-window analysis
 * 4. Category Alignment - News category matching
 * 5. Source Analysis - Domain credibility and overlap
 *
 * This enables "emergent pools" where stakes naturally aggregate around
 * developing stories as they break.
 */

import OpenAI from "openai";
import { prisma } from "../lib/prisma.js";
import { cosineSimilarity, generateEmbedding } from "./classifier.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// Types
// ============================================================================

export interface ExtractedEntities {
  people: string[]; // Named individuals (e.g., "Elon Musk", "Joe Biden")
  organizations: string[]; // Companies, agencies, govts (e.g., "Tesla", "FBI")
  locations: string[]; // Countries, cities, regions (e.g., "Ukraine", "Silicon Valley")
  events: string[]; // Specific incidents (e.g., "2024 Election", "SpaceX Launch")
  dates: string[]; // Temporal references (e.g., "Monday", "Q4 2024")
  topics: string[]; // Key themes (e.g., "AI regulation", "cryptocurrency crash")
}

export interface MatchCandidate {
  storyId: string;
  title: string;
  description: string;
  category: string | null;
  canonicalEventId: string | null;
  kudosPool: number;
  participantCount: number;
  createdAt: Date;

  // Computed scores
  semanticScore: number; // 0-1 embedding similarity
  entityScore: number; // 0-1 entity overlap (Jaccard)
  temporalScore: number; // 0-1 time proximity score
  categoryScore: number; // 0-1 category match
  compositeScore: number; // Weighted combination
}

export interface MatchResult {
  decision: "exact_match" | "likely_match" | "related" | "no_match";
  confidence: number;
  candidates: MatchCandidate[];
  bestMatch: MatchCandidate | null;
  reasoning: string;
  suggestedAction: "join_existing" | "create_new" | "user_confirm";
}

export interface SubmissionContext {
  title: string;
  description: string;
  url?: string;
  sourceDomain: string;
  category?: string;
  embedding?: number[];
  entities?: ExtractedEntities;
}

// ============================================================================
// Configuration
// ============================================================================

const MATCH_CONFIG = {
  // Score weights for composite calculation
  weights: {
    semantic: 0.35, // Embedding similarity weight
    entity: 0.35, // Entity overlap weight
    temporal: 0.15, // Time proximity weight
    category: 0.10, // Category match weight
    source: 0.05, // Source domain bonus
  },

  // Thresholds for match decisions
  thresholds: {
    exactMatch: 0.80, // Auto-join existing market
    likelyMatch: 0.60, // Suggest match, user confirms
    related: 0.40, // Show as related, create new
    minSemantic: 0.50, // Minimum semantic similarity to consider
  },

  // Time window for breaking news (in hours)
  temporalWindow: {
    peak: 6, // Full temporal score within this window
    decay: 48, // Score decays to 0 by this point
  },

  // Maximum candidates to evaluate
  maxCandidates: 20,
};

// ============================================================================
// Entity Extraction
// ============================================================================

/**
 * Extract named entities from a news submission using GPT.
 * This provides the structured data needed for entity-based matching.
 */
export async function extractEntities(
  title: string,
  description: string,
  url?: string
): Promise<ExtractedEntities> {
  const defaultEntities: ExtractedEntities = {
    people: [],
    organizations: [],
    locations: [],
    events: [],
    dates: [],
    topics: [],
  };

  if (!process.env.OPENAI_API_KEY) {
    return defaultEntities;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a named entity recognition system for news articles. Extract entities from the provided news submission and return a JSON object.

For each category, extract ONLY the most important and specific entities:

- people: Full names of specific individuals mentioned (not generic roles)
- organizations: Companies, government agencies, institutions, political parties
- locations: Countries, cities, regions, specific places
- events: Specific named events, incidents, or occurrences (e.g., "2024 US Election", "SpaceX Starship Launch")
- dates: Explicit time references (dates, days, periods)
- topics: 2-4 key themes or subjects the story is about

IMPORTANT:
- Normalize names (e.g., "Elon Musk" not "Musk" or "Mr. Musk")
- Use official organization names (e.g., "Federal Bureau of Investigation" or "FBI")
- Be specific with events (include year/context if clear)
- Keep topics broad but meaningful (e.g., "AI regulation" not just "AI")
- Return empty arrays if no entities of that type exist`,
        },
        {
          role: "user",
          content: `Title: ${title}

Description: ${description}${url ? `

Source: ${url}` : ""}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.1, // Low temperature for consistent extraction
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return defaultEntities;
    }

    const parsed = JSON.parse(content);

    // Validate and normalize the response
    return {
      people: normalizeEntityArray(parsed.people),
      organizations: normalizeEntityArray(parsed.organizations),
      locations: normalizeEntityArray(parsed.locations),
      events: normalizeEntityArray(parsed.events),
      dates: normalizeEntityArray(parsed.dates),
      topics: normalizeEntityArray(parsed.topics),
    };
  } catch (error) {
    console.error("Entity extraction error:", error);
    return defaultEntities;
  }
}

/**
 * Normalize entity arrays - ensure lowercase, trim, dedupe
 */
function normalizeEntityArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return [...new Set(
    arr
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0)
  )];
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate Jaccard similarity between two entity sets.
 * Used for measuring entity overlap between submissions.
 */
function jaccardSimilarity(set1: string[], set2: string[]): number {
  if (set1.length === 0 && set2.length === 0) return 0;

  const s1 = new Set(set1.map((s) => s.toLowerCase()));
  const s2 = new Set(set2.map((s) => s.toLowerCase()));

  const intersection = new Set([...s1].filter((x) => s2.has(x)));
  const union = new Set([...s1, ...s2]);

  return intersection.size / union.size;
}

/**
 * Calculate entity overlap score between two submissions.
 * Weights different entity types by importance for news matching.
 */
function calculateEntityScore(
  entities1: ExtractedEntities,
  entities2: ExtractedEntities
): number {
  // Weight different entity types by importance for matching
  const entityWeights = {
    events: 0.30, // Specific events are strong signals
    people: 0.25, // Key people involved
    organizations: 0.20, // Organizations involved
    topics: 0.15, // Topical alignment
    locations: 0.10, // Location context
  };

  let totalScore = 0;

  totalScore += jaccardSimilarity(entities1.events, entities2.events) * entityWeights.events;
  totalScore += jaccardSimilarity(entities1.people, entities2.people) * entityWeights.people;
  totalScore += jaccardSimilarity(entities1.organizations, entities2.organizations) * entityWeights.organizations;
  totalScore += jaccardSimilarity(entities1.topics, entities2.topics) * entityWeights.topics;
  totalScore += jaccardSimilarity(entities1.locations, entities2.locations) * entityWeights.locations;

  return totalScore;
}

/**
 * Calculate temporal proximity score.
 * Breaking news stories close in time are more likely to be related.
 */
function calculateTemporalScore(submissionTime: Date, candidateTime: Date): number {
  const hoursDiff = Math.abs(
    (submissionTime.getTime() - candidateTime.getTime()) / (1000 * 60 * 60)
  );

  const { peak, decay } = MATCH_CONFIG.temporalWindow;

  if (hoursDiff <= peak) {
    return 1.0; // Full score within peak window
  } else if (hoursDiff >= decay) {
    return 0.0; // No temporal boost beyond decay window
  } else {
    // Linear decay from peak to decay window
    return 1.0 - (hoursDiff - peak) / (decay - peak);
  }
}

/**
 * Calculate category match score.
 */
function calculateCategoryScore(
  category1: string | null | undefined,
  category2: string | null | undefined
): number {
  if (!category1 || !category2) return 0.5; // Neutral if category unknown

  if (category1.toLowerCase() === category2.toLowerCase()) {
    return 1.0;
  }

  // Partial credit for related categories
  const relatedCategories: Record<string, string[]> = {
    breaking_news: ["politics", "business", "technology"],
    politics: ["breaking_news", "business"],
    technology: ["business", "science", "breaking_news"],
    business: ["technology", "politics", "breaking_news"],
    science: ["technology"],
    entertainment: ["sports"],
    sports: ["entertainment"],
  };

  const related = relatedCategories[category1.toLowerCase()] || [];
  if (related.includes(category2.toLowerCase())) {
    return 0.5;
  }

  return 0.0;
}

/**
 * Calculate source domain score bonus.
 * Same source or related sources get a small boost.
 */
function calculateSourceScore(domain1: string, domain2: string): number {
  if (domain1.toLowerCase() === domain2.toLowerCase()) {
    return 1.0; // Same source - could be same story
  }

  // Major news sources often cover same stories
  const majorSources = new Set([
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "cnn.com",
    "nytimes.com",
    "washingtonpost.com",
    "theguardian.com",
    "wsj.com",
    "bloomberg.com",
  ]);

  if (majorSources.has(domain1) && majorSources.has(domain2)) {
    return 0.3; // Both major sources - slight boost
  }

  return 0.0;
}

// ============================================================================
// Main Matching Logic
// ============================================================================

/**
 * Find matching stories for a new submission.
 * This is the core matching algorithm that analyzes all active stories
 * and returns scored candidates.
 */
export async function findMatchingMarkets(
  submission: SubmissionContext
): Promise<MatchCandidate[]> {
  const now = new Date();

  // Get active stories
  const activeStories = await prisma.story.findMany({
    where: {
      status: { in: ["active", "pending"] },
    },
    select: {
      id: true,
      title: true,
      description: true,
      embedding: true,
      aiClassification: true,
      canonicalEventId: true,
      sourceDomain: true,
      createdAt: true,
      kudosPool: true,
      _count: {
        select: { submissions: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100, // Limit initial fetch
  });

  // Generate embedding for submission if not provided
  const submissionEmbedding =
    submission.embedding ||
    (await generateEmbedding(`${submission.title} ${submission.description}`));

  // Extract entities for submission if not provided
  const submissionEntities =
    submission.entities ||
    (await extractEntities(submission.title, submission.description, submission.url));

  const candidates: MatchCandidate[] = [];

  for (const story of activeStories) {
    // Calculate semantic score
    let semanticScore = 0;
    if (submissionEmbedding && story.embedding) {
      const storyEmbedding = JSON.parse(story.embedding) as number[];
      semanticScore = cosineSimilarity(submissionEmbedding, storyEmbedding);
    }

    // Skip if semantic similarity is below minimum threshold
    if (semanticScore < MATCH_CONFIG.thresholds.minSemantic) {
      continue;
    }

    // Extract entities from candidate (cached in future, extracted now)
    const candidateEntities = await extractEntities(
      story.title,
      story.description,
      "" // URL not stored separately
    );

    // Calculate all scores
    const entityScore = calculateEntityScore(submissionEntities, candidateEntities);
    const temporalScore = calculateTemporalScore(now, story.createdAt);
    const categoryScore = calculateCategoryScore(
      submission.category,
      story.aiClassification
    );
    const sourceScore = calculateSourceScore(
      submission.sourceDomain,
      story.sourceDomain
    );

    // Calculate composite score
    const { weights } = MATCH_CONFIG;
    const compositeScore =
      semanticScore * weights.semantic +
      entityScore * weights.entity +
      temporalScore * weights.temporal +
      categoryScore * weights.category +
      sourceScore * weights.source;

    candidates.push({
      storyId: story.id,
      title: story.title,
      description: story.description,
      category: story.aiClassification,
      canonicalEventId: story.canonicalEventId,
      kudosPool: story.kudosPool,
      participantCount: story._count.submissions,
      createdAt: story.createdAt,
      semanticScore,
      entityScore,
      temporalScore,
      categoryScore,
      compositeScore,
    });
  }

  // Sort by composite score and return top candidates
  return candidates
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, MATCH_CONFIG.maxCandidates);
}

/**
 * Determine match result for a submission.
 * Returns the match decision with reasoning and suggested action.
 */
export async function determineMatch(
  submission: SubmissionContext
): Promise<MatchResult> {
  const candidates = await findMatchingMarkets(submission);

  if (candidates.length === 0) {
    return {
      decision: "no_match",
      confidence: 1.0,
      candidates: [],
      bestMatch: null,
      reasoning: "No existing markets found with sufficient similarity.",
      suggestedAction: "create_new",
    };
  }

  const bestMatch = candidates[0];
  const { thresholds } = MATCH_CONFIG;

  // Determine decision based on composite score
  if (bestMatch.compositeScore >= thresholds.exactMatch) {
    return {
      decision: "exact_match",
      confidence: bestMatch.compositeScore,
      candidates,
      bestMatch,
      reasoning: generateMatchReasoning(bestMatch, "exact"),
      suggestedAction: "join_existing",
    };
  } else if (bestMatch.compositeScore >= thresholds.likelyMatch) {
    return {
      decision: "likely_match",
      confidence: bestMatch.compositeScore,
      candidates,
      bestMatch,
      reasoning: generateMatchReasoning(bestMatch, "likely"),
      suggestedAction: "user_confirm",
    };
  } else if (bestMatch.compositeScore >= thresholds.related) {
    return {
      decision: "related",
      confidence: bestMatch.compositeScore,
      candidates: candidates.filter((c) => c.compositeScore >= thresholds.related),
      bestMatch,
      reasoning: generateMatchReasoning(bestMatch, "related"),
      suggestedAction: "create_new",
    };
  }

  return {
    decision: "no_match",
    confidence: 1.0 - bestMatch.compositeScore,
    candidates: [],
    bestMatch: null,
    reasoning: "No existing markets match closely enough.",
    suggestedAction: "create_new",
  };
}

/**
 * Generate human-readable reasoning for a match.
 */
function generateMatchReasoning(
  candidate: MatchCandidate,
  matchType: "exact" | "likely" | "related"
): string {
  const parts: string[] = [];

  if (candidate.semanticScore > 0.8) {
    parts.push("very similar content");
  } else if (candidate.semanticScore > 0.6) {
    parts.push("similar content");
  }

  if (candidate.entityScore > 0.5) {
    parts.push("overlapping key entities");
  }

  if (candidate.temporalScore > 0.8) {
    parts.push("reported around the same time");
  }

  if (candidate.categoryScore === 1.0) {
    parts.push("same news category");
  }

  const reasonList = parts.length > 0 ? parts.join(", ") : "moderate similarity";

  switch (matchType) {
    case "exact":
      return `This submission appears to be about the same event: ${reasonList}. ` +
        `The existing story has ${candidate.participantCount} discoverer(s).`;
    case "likely":
      return `This submission is likely about the same event (${reasonList}). ` +
        `Consider discovering the existing story with ${candidate.participantCount} discoverer(s).`;
    case "related":
      return `This submission is related but may be distinct (${reasonList}). ` +
        `A separate story is recommended.`;
    default:
      return reasonList;
  }
}

// ============================================================================
// AI-Powered Match Verification
// ============================================================================

/**
 * Use GPT to verify whether two stories are about the same event.
 * This is used for borderline cases where confidence is between 0.6-0.8.
 */
export async function verifyMatchWithAI(
  submission: SubmissionContext,
  candidate: MatchCandidate
): Promise<{
  isSameEvent: boolean;
  confidence: number;
  reasoning: string;
}> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      isSameEvent: false,
      confidence: 0.5,
      reasoning: "AI verification unavailable",
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are analyzing whether two news submissions are about the SAME specific news event or story.

Two submissions are about the SAME EVENT if they:
- Report on the same specific incident, announcement, or development
- Reference the same key people, organizations, and actions
- Would logically be grouped together in a news aggregator

Two submissions are DIFFERENT EVENTS if they:
- Are about the same general topic but different specific incidents
- Happen at different times or involve different key players
- Would be separate stories in a news aggregator

Return a JSON object with:
- isSameEvent: boolean
- confidence: number 0-1 (how confident you are)
- reasoning: brief explanation

Be STRICT - only return isSameEvent: true if they are clearly the same specific story.`,
        },
        {
          role: "user",
          content: `SUBMISSION 1 (New):
Title: ${submission.title}
Description: ${submission.description}
Source: ${submission.sourceDomain}

SUBMISSION 2 (Existing Market):
Title: ${candidate.title}
Description: ${candidate.description}

Are these about the same specific news event?`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { isSameEvent: false, confidence: 0.5, reasoning: "No AI response" };
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("AI match verification error:", error);
    return {
      isSameEvent: false,
      confidence: 0.5,
      reasoning: "AI verification failed",
    };
  }
}

// ============================================================================
// Batch Entity Extraction (for caching)
// ============================================================================

/**
 * Extract and store entities for all stories that don't have them.
 * Run as a background job to populate entity data.
 */
export async function batchExtractEntities(): Promise<number> {
  const stories = await prisma.story.findMany({
    where: {
      status: { in: ["active", "pending"] },
    },
    select: {
      id: true,
      title: true,
      description: true,
      url: true,
    },
  });

  // Note: In production, you'd store entities in the database
  // For now, this extracts them for logging/debugging
  let processed = 0;

  for (const story of stories) {
    try {
      const entities = await extractEntities(story.title, story.description, story.url ?? undefined);
      console.log(`Extracted entities for story ${story.id}:`, entities);
      processed++;
    } catch (error) {
      console.error(`Failed to extract entities for story ${story.id}:`, error);
    }
  }

  return processed;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get match statistics for monitoring.
 */
export function getMatchConfig() {
  return { ...MATCH_CONFIG };
}

/**
 * Adjust match thresholds dynamically (for A/B testing or tuning).
 */
export function updateMatchThresholds(thresholds: Partial<typeof MATCH_CONFIG.thresholds>) {
  Object.assign(MATCH_CONFIG.thresholds, thresholds);
}
