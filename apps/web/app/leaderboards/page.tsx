"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { leaderboardsApi } from "@/lib/api";
import { formatKudos, formatRelativeTime, formatRank } from "@/lib/utils";
import { Trophy, Star, TrendingUp, Users, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type TabType = "weekly" | "all-time" | "stories";

export default function LeaderboardsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("weekly");

  const { data: weeklyData, isLoading: weeklyLoading } = useQuery({
    queryKey: ["leaderboard-weekly"],
    queryFn: () => leaderboardsApi.weekly(50),
  });

  const { data: allTimeData, isLoading: allTimeLoading } = useQuery({
    queryKey: ["leaderboard-all-time"],
    queryFn: () => leaderboardsApi.allTime(50),
  });

  const { data: storiesData, isLoading: storiesLoading } = useQuery({
    queryKey: ["leaderboard-stories"],
    queryFn: () => leaderboardsApi.stories(20),
  });

  const isLoading = activeTab === "weekly" ? weeklyLoading : activeTab === "all-time" ? allTimeLoading : storiesLoading;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="h-8 w-8 text-[var(--gold)]" />
        <h1 className="text-3xl font-bold">leaderboards</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("weekly")}
          className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "weekly"
              ? "text-[var(--gold)] border-[var(--gold)]"
              : "text-[var(--muted)] border-transparent hover:text-[var(--foreground)]"
          }`}
        >
          this week
        </button>
        <button
          onClick={() => setActiveTab("all-time")}
          className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "all-time"
              ? "text-[var(--gold)] border-[var(--gold)]"
              : "text-[var(--muted)] border-transparent hover:text-[var(--foreground)]"
          }`}
        >
          all time
        </button>
        <button
          onClick={() => setActiveTab("stories")}
          className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "stories"
              ? "text-[var(--gold)] border-[var(--gold)]"
              : "text-[var(--muted)] border-transparent hover:text-[var(--foreground)]"
          }`}
        >
          top stories
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : activeTab === "stories" ? (
        <div className="space-y-3">
          {storiesData?.stories.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-[var(--muted)] mb-4">no viral stories yet</p>
                <Link href="/stories/submit">
                  <Button>submit a story</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            storiesData?.stories.map((story) => (
              <Link
                key={story.id}
                href={`/stories/${story.id}`}
                className="block"
              >
                <Card className="hover:border-[var(--gold)] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${
                        story.rank === 1 ? "bg-[var(--gold)] text-black" :
                        story.rank === 2 ? "bg-gray-300 text-black" :
                        story.rank === 3 ? "bg-orange-400 text-black" :
                        "bg-[var(--surface-secondary)] text-[var(--muted)]"
                      }`}>
                        {story.rank <= 3 ? <Crown className="h-5 w-5" /> : story.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{story.title}</p>
                        <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                          <span>{story.sourceDomain}</span>
                          <span className="slash-divider" />
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {story.discovererCount}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-[var(--gold)] font-mono font-semibold">
                          <Star className="h-4 w-4" />
                          {formatKudos(story.kudosPool)}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          peak: {story.peakViralityScore?.toFixed(1) || "-"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {(activeTab === "weekly" ? weeklyData?.leaderboard : allTimeData?.leaderboard)?.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-[var(--muted)] mb-4">no discoverers yet</p>
                <Link href="/stories">
                  <Button>start discovering</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            (activeTab === "weekly" ? weeklyData?.leaderboard : allTimeData?.leaderboard)?.map((entry) => (
              <Card key={entry.user.id} className="hover:border-[var(--gold)] transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${
                      entry.rank === 1 ? "bg-[var(--gold)] text-black" :
                      entry.rank === 2 ? "bg-gray-300 text-black" :
                      entry.rank === 3 ? "bg-orange-400 text-black" :
                      "bg-[var(--surface-secondary)] text-[var(--muted)]"
                    }`}>
                      {entry.rank <= 3 ? <Crown className="h-5 w-5" /> : entry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {entry.user.displayName || entry.user.email?.split("@")[0]}
                      </p>
                      <div className="text-sm text-[var(--muted)]">
                        {entry.discoveries} discoveries
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[var(--gold)] font-mono font-semibold">
                        <Star className="h-4 w-4" />
                        {formatKudos(entry.kudos)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">kudos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
