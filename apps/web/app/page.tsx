"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { storiesApi } from "@/lib/api";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { ViralityBadgeCompact } from "@/components/ViralityBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, ArrowRight } from "lucide-react";

export default function Home() {
  const { data, isLoading } = useQuery({
    queryKey: ["trending-stories"],
    queryFn: () => storiesApi.list({ limit: 5 }),
  });

  const stories = data?.stories || [];

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="text-center py-16 max-w-2xl">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          <span className="text-gold">back</span> breaking news
        </h1>
        <p className="text-lg text-muted-custom mb-8">
          stake early on stories you believe will go viral.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/stories">
            <Button size="lg" className="bg-[var(--gold)] hover:bg-[var(--gold-dim)] text-black">
              explore stories
            </Button>
          </Link>
          <Link href="/stories/submit">
            <Button size="lg" variant="outline" className="border-[var(--border)] hover:border-[var(--gold)]">
              submit a story
            </Button>
          </Link>
        </div>
      </section>

      {/* Trending Stories */}
      <section className="w-full max-w-4xl py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm tracking-terminal text-muted-custom uppercase flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold" />
            trending markets
          </h2>
          <Link href="/stories" className="text-sm text-muted-custom hover:text-gold flex items-center gap-1 hover-underline">
            view all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-12 border border-[var(--border)] rounded-lg bg-surface">
            <p className="text-muted-custom mb-4">no active markets yet</p>
            <Link href="/stories/submit">
              <Button variant="outline" className="border-[var(--gold)] text-gold hover:bg-[var(--gold)] hover:text-black">
                be the first to submit
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map((story) => (
              <Link
                key={story.id}
                href={`/stories/${story.id}`}
                className="block group"
              >
                <div className="flex items-center justify-between p-4 border border-[var(--border)] rounded-lg bg-surface hover:border-[var(--gold)] transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-medium truncate group-hover:text-gold transition-colors">
                      {story.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-custom">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {story.market?.participantCount || 0}
                      </span>
                      <span className="slash-divider" />
                      <span>{formatRelativeTime(new Date(story.createdAt))}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <ViralityBadgeCompact
                      score={story.currentViralityScore}
                      trend={story.viralityTrend as "rising" | "stable" | "declining" | null}
                    />
                    <div className="text-right">
                      <div className="text-lg font-mono text-gold font-semibold">
                        {formatCurrency(story.market?.totalPool || 0)}
                      </div>
                      <div className="text-xs text-muted-custom">pool</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Stats Bar */}
      {stories.length > 0 && (
        <section className="w-full max-w-4xl py-8 border-t border-[var(--border)]">
          <div className="flex justify-center gap-12">
            <div className="text-center">
              <div className="text-2xl font-mono text-gold font-semibold">
                {formatCurrency(stories.reduce((sum, s) => sum + (s.market?.totalPool || 0), 0))}
              </div>
              <div className="text-xs text-muted-custom tracking-terminal uppercase mt-1">total staked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-mono font-semibold">
                {stories.length}
              </div>
              <div className="text-xs text-muted-custom tracking-terminal uppercase mt-1">active markets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-mono font-semibold">
                {stories.reduce((sum, s) => sum + (s.market?.participantCount || 0), 0)}
              </div>
              <div className="text-xs text-muted-custom tracking-terminal uppercase mt-1">participants</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
