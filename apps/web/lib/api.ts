const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, token } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(response.status, error.message || "Request failed");
  }

  return response.json();
}

// Stories
export const storiesApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api<{ stories: Story[]; total: number }>(`/stories?${new URLSearchParams(params as Record<string, string>)}`),

  get: (id: string) => api<Story>(`/stories/${id}`),

  create: (data: CreateStoryInput, token: string) =>
    api<Story>("/stories", { method: "POST", body: data, token }),
};

// Markets
export const marketsApi = {
  get: (storyId: string) => api<Market>(`/markets/${storyId}`),

  stake: (marketId: string, amount: number, token: string) =>
    api<Position>(`/markets/${marketId}/stake`, { method: "POST", body: { amount }, token }),
};

// Virality
export const viralityApi = {
  get: (storyId: string) => api<ViralityData>(`/virality/${storyId}`),

  latest: (storyId: string) => api<ViralitySnapshot>(`/virality/${storyId}/latest`),

  trending: (params?: { limit?: number; trend?: string }) =>
    api<{ stories: Story[] }>(`/virality?${new URLSearchParams(params as Record<string, string>)}`),
};

// Users
export const usersApi = {
  me: (token: string) => api<User>("/users/me", { token }),

  positions: (token: string) =>
    api<Position[]>("/users/me/positions", { token }),

  transactions: (token: string) =>
    api<Transaction[]>("/users/me/transactions", { token }),
};

// Types (will be moved to shared package)
export type ViralityTrend = "rising" | "stable" | "declining";

export interface Story {
  id: string;
  title: string;
  url: string;
  description: string;
  sourceDomain: string;
  submitterId: string;
  status: "pending" | "active" | "capped" | "rejected";
  aiClassification: string | null;
  currentViralityScore: number | null;
  peakViralityScore: number | null;
  viralityTrend: ViralityTrend | null;
  createdAt: string;
  market?: Market;
}

export interface Market {
  id: string;
  storyId: string;
  totalPool: number;
  participantCount: number;
  status: "open" | "capped" | "settled";
  settledAt: string | null;
  settlementReason: string | null;
  createdAt: string;
}

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

export interface Position {
  id: string;
  userId: string;
  marketId: string;
  stakeAmount: number;
  entryPoolSize: number;
  entryTime: string;
  payoutAmount: number | null;
  status: "active" | "paid_out";
  market?: Market;
  story?: Story;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  walletAddress: string | null;
  balance: number;
  kycStatus: "none" | "pending" | "verified";
}

export interface Transaction {
  id: string;
  userId: string;
  type: "deposit" | "withdrawal" | "stake" | "payout" | "fee";
  amount: number;
  referenceId: string | null;
  createdAt: string;
}

export interface CreateStoryInput {
  title: string;
  url: string;
  description: string;
  initialStake: number;
}
