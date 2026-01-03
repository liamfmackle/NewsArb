// User types
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  walletAddress: string | null;
  balance: number;
  kycStatus: KycStatus;
  role: UserRole;
  createdAt: string;
}

export type KycStatus = "none" | "pending" | "verified" | "rejected";
export type UserRole = "user" | "admin";

// Story types
export interface Story {
  id: string;
  title: string;
  url: string;
  description: string;
  sourceDomain: string;
  submitterId: string;
  canonicalEventId: string | null;
  status: StoryStatus;
  aiClassification: string | null;
  safetyFlags: string[];
  // Virality tracking
  currentViralityScore: number | null;
  peakViralityScore: number | null;
  viralityTrend: ViralityTrend | null;
  createdAt: string;
  market?: Market;
  submitter?: Pick<User, "id" | "displayName">;
}

export type StoryStatus = "pending" | "active" | "capped" | "rejected";
export type ViralityTrend = "rising" | "stable" | "declining";

// Market types
export interface Market {
  id: string;
  storyId: string;
  totalPool: number;
  participantCount: number;
  status: MarketStatus;
  capThreshold: number | null;
  createdAt: string;
  cappedAt: string | null;
  settledAt: string | null;
  settlementReason: string | null;
  story?: Story;
  positions?: Position[];
}

export type MarketStatus = "open" | "capped" | "settled";

// Virality types
export interface ViralitySnapshot {
  id: string;
  storyId: string;
  articleCount: number;
  socialMentions: number;
  searchInterest: number;
  engagementRate: number;
  viralityScore: number;
  velocityChange: number;
  trend: ViralityTrend;
  timestamp: string;
}

export interface ViralityData {
  storyId: string;
  title: string;
  current: {
    score: number | null;
    peak: number | null;
    trend: ViralityTrend | null;
  };
  isDecaying: boolean;
  decayReason?: string;
  history: Array<{
    timestamp: string;
    score: number;
    trend: ViralityTrend;
    velocityChange: number;
  }>;
}

// Position types
export interface Position {
  id: string;
  userId: string;
  marketId: string;
  stakeAmount: number;
  entryPoolSize: number;
  entryTime: string;
  payoutAmount: number | null;
  status: PositionStatus;
  user?: Pick<User, "id" | "displayName">;
  market?: Market;
  story?: Pick<Story, "id" | "title" | "sourceDomain">;
}

export type PositionStatus = "active" | "paid_out";

// Transaction types
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  referenceId: string | null;
  createdAt: string;
}

export type TransactionType = "deposit" | "withdrawal" | "stake" | "payout" | "fee";

// API Request/Response types
export interface CreateStoryInput {
  title: string;
  url: string;
  description: string;
  initialStake: number;
}

export interface StakeInput {
  amount: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthResponse {
  user: Pick<User, "id" | "email" | "displayName" | "balance">;
  token: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// AI Classification types
export interface ClassificationResult {
  category: string;
  flags: string[];
  approved: boolean;
  reason?: string;
}

// Constants
export const STORY_CATEGORIES = [
  "breaking_news",
  "politics",
  "technology",
  "business",
  "entertainment",
  "sports",
  "science",
  "satire",
  "rumor",
  "unverifiable",
] as const;

export type StoryCategory = (typeof STORY_CATEGORIES)[number];

export const PLATFORM_FEE_RATE = 0.05; // 5%
export const MIN_STAKE_AMOUNT = 1;
export const DEFAULT_USER_BALANCE = 100;
