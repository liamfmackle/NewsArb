import OpenAI from "openai";
import { prisma } from "../lib/prisma.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ClassificationResult {
  category: string;
  flags: string[];
  approved: boolean;
  reason?: string;
}

export async function classifyStory(
  title: string,
  description: string,
  url?: string
): Promise<ClassificationResult> {
  // If no API key, return default approval
  if (!process.env.OPENAI_API_KEY) {
    return {
      category: "news",
      flags: [],
      approved: true,
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a content classifier for a news prediction market platform. Analyze the story and return a JSON object with:
- category: one of "breaking_news", "politics", "technology", "business", "entertainment", "sports", "science", "satire", "rumor", "unverifiable"
- flags: array of any concerning flags like "misinformation_risk", "hate_content", "harassment", "illegal_activity", "manipulation_risk", "low_credibility"
- approved: boolean - true if this is a legitimate news story that can be traded on, false if it should be rejected
- reason: optional string explaining rejection if approved is false

Be strict about rejecting:
- Satire or parody content
- Unverifiable rumors
- Content targeting individuals' private lives
- Content that could incentivize harmful actions
- Clear misinformation`,
        },
        {
          role: "user",
          content: `Title: ${title}\n\nDescription: ${description}${url ? `\n\nURL: ${url}` : ""}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { category: "news", flags: [], approved: true };
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Classification error:", error);
    // Default to pending review if AI fails
    return {
      category: "pending_review",
      flags: ["ai_classification_failed"],
      approved: false,
      reason: "Automated classification failed - pending manual review",
    };
  }
}

// Cosine similarity between two embedding vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const SIMILARITY_THRESHOLD = 0.85;

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarStory?: {
    id: string;
    title: string;
    similarity: number;
    canonicalEventId: string | null;
  };
  canonicalEventId?: string;
}

export async function checkDuplicateStory(
  title: string,
  description: string,
  url?: string
): Promise<DuplicateCheckResult> {
  // Check for exact URL match first (only if URL provided)
  if (url) {
    const urlMatch = await prisma.story.findFirst({
      where: { url },
      select: {
        id: true,
        title: true,
        canonicalEventId: true,
      },
    });

    if (urlMatch) {
      return {
        isDuplicate: true,
        similarStory: {
          id: urlMatch.id,
          title: urlMatch.title,
          similarity: 1.0,
          canonicalEventId: urlMatch.canonicalEventId,
        },
        canonicalEventId: urlMatch.canonicalEventId || undefined,
      };
    }
  }

  // Generate embedding for the new story
  const newEmbedding = await generateEmbedding(`${title} ${description}`);
  if (!newEmbedding) {
    // Can't check similarity without embeddings
    return { isDuplicate: false };
  }

  // Get all active stories with embeddings
  const existingStories = await prisma.story.findMany({
    where: {
      status: { in: ["active", "pending"] },
      embedding: { not: null },
    },
    select: {
      id: true,
      title: true,
      embedding: true,
      canonicalEventId: true,
    },
  });

  // Find the most similar story
  let bestMatch: { story: typeof existingStories[0]; similarity: number } | null = null;

  for (const story of existingStories) {
    if (!story.embedding) continue;

    const storyEmbedding = JSON.parse(story.embedding) as number[];
    const similarity = cosineSimilarity(newEmbedding, storyEmbedding);

    if (similarity >= SIMILARITY_THRESHOLD) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { story, similarity };
      }
    }
  }

  if (bestMatch) {
    return {
      isDuplicate: true,
      similarStory: {
        id: bestMatch.story.id,
        title: bestMatch.story.title,
        similarity: bestMatch.similarity,
        canonicalEventId: bestMatch.story.canonicalEventId,
      },
      canonicalEventId: bestMatch.story.canonicalEventId || undefined,
    };
  }

  return { isDuplicate: false };
}

// Find stories related to a given story
export async function findRelatedStories(
  storyId: string,
  limit: number = 5
): Promise<Array<{ id: string; title: string; similarity: number }>> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { embedding: true, canonicalEventId: true },
  });

  if (!story) return [];

  // First, get stories in the same canonical event
  if (story.canonicalEventId) {
    const canonicalStories = await prisma.story.findMany({
      where: {
        canonicalEventId: story.canonicalEventId,
        id: { not: storyId },
        status: "active",
      },
      select: { id: true, title: true },
      take: limit,
    });

    return canonicalStories.map((s: { id: string; title: string }) => ({
      id: s.id,
      title: s.title,
      similarity: 1.0, // Same canonical event = highly related
    }));
  }

  // Otherwise, find similar by embedding
  if (!story.embedding) return [];

  const storyEmbedding = JSON.parse(story.embedding) as number[];

  const otherStories = await prisma.story.findMany({
    where: {
      id: { not: storyId },
      status: "active",
      embedding: { not: null },
    },
    select: { id: true, title: true, embedding: true },
  });

  const withSimilarity = otherStories
    .map((s: { id: string; title: string; embedding: string | null }) => {
      const embedding = JSON.parse(s.embedding!) as number[];
      return {
        id: s.id,
        title: s.title,
        similarity: cosineSimilarity(storyEmbedding, embedding),
      };
    })
    .filter((s: { id: string; title: string; similarity: number }) => s.similarity >= 0.7) // Related threshold is lower than duplicate
    .sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)
    .slice(0, limit);

  return withSimilarity;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0]?.embedding || null;
  } catch (error) {
    console.error("Embedding error:", error);
    return null;
  }
}
