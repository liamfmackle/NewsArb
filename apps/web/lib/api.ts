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
    message: string,
    public data?: unknown
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

  const data = await response.json().catch(() => ({ message: "Request failed" }));

  if (!response.ok) {
    throw new ApiError(response.status, data.message || "Request failed", data);
  }

  return data;
}

// Stories
export const storiesApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api<{ stories: Story[]; total: number }>(
      `/stories?${new URLSearchParams(params as Record<string, string>)}`
    ),

  get: (id: string) => api<StoryDetail>(`/stories/${id}`),

  create: (data: CreateStoryInput, token: string) =>
    api<StoryCreateResponse>("/stories", { method: "POST", body: data, token }),

  discover: (id: string, token: string) =>
    api<DiscoveryResponse>(`/stories/${id}/discover`, { method: "POST", token }),

  checkMatch: (data: { title: string; url?: string; description: string }, token: string) =>
    api<MatchCheckResult>("/stories/check-match", { method: "POST", body: data, token }),
};

// Markets (now story clusters/discovery)
export const marketsApi = {
  get: (storyId: string) => api<StoryCluster>(`/markets/${storyId}`),

  discover: (storyId: string, token: string) =>
    api<DiscoveryResponse>(`/markets/${storyId}/discover`, { method: "POST", token }),

  getDiscoverers: (storyId: string) =>
    api<Discoverer[]>(`/markets/${storyId}/discoverers`),
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

  update: (data: { displayName?: string }, token: string) =>
    api<User>("/users/me", { method: "PATCH", body: data, token }),

  kudos: (token: string) => api<KudosStats>("/users/me/kudos", { token }),

  submissions: (token: string) => api<Submission[]>("/users/me/submissions", { token }),

  kudosHistory: (token: string, limit?: number) =>
    api<KudosHistoryEntry[]>(
      `/users/me/kudos-history${limit ? `?limit=${limit}` : ""}`,
      { token }
    ),

  profile: (userId: string) => api<UserProfile>(`/users/${userId}/profile`),

  discoveries: (userId: string, limit?: number) =>
    api<UserDiscovery[]>(
      `/users/${userId}/discoveries${limit ? `?limit=${limit}` : ""}`
    ),
};

// Leaderboards
export const leaderboardsApi = {
  weekly: (limit?: number) =>
    api<{ leaderboard: LeaderboardEntry[]; type: "weekly" }>(
      `/leaderboards/weekly${limit ? `?limit=${limit}` : ""}`
    ),

  allTime: (limit?: number) =>
    api<{ leaderboard: LeaderboardEntry[]; type: "all-time" }>(
      `/leaderboards/all-time${limit ? `?limit=${limit}` : ""}`
    ),

  stories: (limit?: number) =>
    api<{ stories: TopStory[] }>(
      `/leaderboards/stories${limit ? `?limit=${limit}` : ""}`
    ),

  me: (token: string) =>
    api<{ user: { id: string; displayName: string | null }; stats: KudosStats }>(
      "/leaderboards/me",
      { token }
    ),
};

// Types
export type ViralityTrend = "rising" | "stable" | "declining";
export type StoryStatus = "pending" | "active" | "settled" | "rejected";
export type KudosReason = "early_discovery" | "viral_bonus" | "first_discoverer" | "weekly_reset";

export interface Story {
  id: string;
  title: string;
  url: string | null;
  description: string;
  sourceDomain: string;
  submitterId: string;
  status: StoryStatus;
  aiClassification: string | null;
  currentViralityScore: number | null;
  peakViralityScore: number | null;
  viralityTrend: ViralityTrend | null;
  kudosPool: number;
  kudosDistributed: boolean;
  discovererCount: number;
  createdAt: string;
  submitter?: {
    id: string;
    displayName: string | null;
  };
}

export interface StoryDetail extends Story {
  discoverers: Discoverer[];
  viralitySnapshots?: ViralitySnapshot[];
}

export interface StoryCluster {
  id: string;
  storyId: string;
  status: StoryStatus;
  discovererCount: number;
  kudosPool: number;
  kudosDistributed: boolean;
  story: Story;
  discoverers: Discoverer[];
  viralityHistory: Array<{
    timestamp: string;
    score: number;
    trend: ViralityTrend;
  }>;
}

export interface Discoverer {
  id: string;
  rank?: number;
  user: {
    id: string;
    displayName: string | null;
    totalKudos?: number;
    allTimeRank?: number;
  };
  submittedAt: string;
  kudosEarned: number;
  isOriginal: boolean;
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

export interface Submission {
  id: string;
  userId: string;
  storyId: string;
  submittedAt: string;
  kudosEarned: number;
  isOriginal: boolean;
  story: {
    id: string;
    title: string;
    sourceDomain: string;
    currentViralityScore: number | null;
    peakViralityScore: number | null;
    status: StoryStatus;
  } | null;
}

export interface KudosHistoryEntry {
  id: string;
  amount: number;
  reason: KudosReason;
  storyId: string | null;
  createdAt: string;
  story?: {
    title: string;
  } | null;
}

export interface KudosStats {
  totalKudos: number;
  weeklyKudos: number;
  allTimeRank: number | null;
  weeklyRank: number | null;
  totalDiscoveries: number;
  originalDiscoveries: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  totalKudos: number;
  weeklyKudos: number;
  allTimeRank: number | null;
  weeklyRank: number | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string | null;
  totalKudos: number;
  weeklyKudos: number;
  allTimeRank: number | null;
  weeklyRank: number | null;
  createdAt: string;
  totalDiscoveries: number;
  originalDiscoveries: number;
}

export interface UserDiscovery {
  id: string;
  submittedAt: string;
  kudosEarned: number;
  isOriginal: boolean;
  story: {
    id: string;
    title: string;
    sourceDomain: string;
    currentViralityScore: number | null;
    peakViralityScore: number | null;
    status: StoryStatus;
    createdAt: string;
  } | null;
}

export interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    displayName: string | null;
    email: string;
  };
  kudos: number;
  discoveries: number;
}

export interface TopStory {
  rank: number;
  id: string;
  title: string;
  sourceDomain: string;
  peakViralityScore: number | null;
  kudosPool: number;
  status: StoryStatus;
  createdAt: string;
  submitter: {
    id: string;
    displayName: string | null;
  };
  discovererCount: number;
}

export interface CreateStoryInput {
  title: string;
  url?: string;
  description: string;
  forceNew?: boolean;
  discoverStoryId?: string;
}

export interface StoryCreateResponse extends Story {
  message: string;
  isOriginalDiscoverer: boolean;
}

export interface DiscoveryResponse {
  id: string;
  storyId: string;
  submittedAt: string;
  isOriginal: boolean;
  message: string;
  story: {
    id: string;
    title: string;
    sourceDomain: string;
  };
}

export interface MatchCheckResult {
  type: "duplicate" | "match_result";
  message?: string;
  decision?: string;
  confidence?: number;
  reasoning?: string;
  suggestedAction?: string;
  existingStory?: {
    id: string;
    title: string;
    similarity?: number;
  };
  bestMatch?: {
    storyId: string;
    title: string;
    description: string;
    discovererCount: number;
    scores?: {
      semantic: number;
      entity: number;
      temporal: number;
      composite: number;
    };
  };
  otherCandidates?: Array<{
    storyId: string;
    title: string;
    discovererCount: number;
    composite: number;
  }>;
  entities?: {
    people: string[];
    organizations: string[];
    locations: string[];
    events: string[];
    dates: string[];
    topics: string[];
  };
}

export { ApiError };
