"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StoryStats } from "@/components/StoryStats";
import { ViralityChart } from "@/components/ViralityChart";
import { ViralityBadge } from "@/components/ViralityBadge";
import { storiesApi, marketsApi } from "@/lib/api";
import { formatRelativeTime, formatKudos } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Users, Crown, CheckCircle } from "lucide-react";

export default function StoryPage() {
  const params = useParams();
  const storyId = params.id as string;
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: story, isLoading: storyLoading } = useQuery({
    queryKey: ["story", storyId],
    queryFn: () => storiesApi.get(storyId),
  });

  const discoverMutation = useMutation({
    mutationFn: () => storiesApi.discover(storyId, session?.accessToken as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story", storyId] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  if (storyLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-muted-custom mb-4 font-mono">story not found</p>
        <Link href="/stories">
          <Button variant="outline">back to stories</Button>
        </Link>
      </div>
    );
  }

  const isSettled = story.kudosDistributed;
  const hasDiscovered = story.discoverers?.some(
    (d) => d.user.id === session?.user?.id
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/stories"
        className="inline-flex items-center gap-2 text-muted-custom hover:text-foreground mb-6 font-mono text-sm hover-underline"
      >
        <span className="text-gold">/</span> stories
      </Link>

      {/* Story Header */}
      <div className="bg-surface border border-border p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl font-normal">{story.title}</h1>
          <ViralityBadge
            score={story.currentViralityScore ?? null}
            trend={story.viralityTrend ?? null}
            size="lg"
            showLabel
          />
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-custom mb-4 font-mono">
          <span>{story.sourceDomain}</span>
          <span className="slash-divider" />
          <span>{formatRelativeTime(new Date(story.createdAt))}</span>
          {story.url && (
            <>
              <span className="slash-divider" />
              <a
                href={story.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover-underline"
              >
                source
              </a>
            </>
          )}
        </div>

        <p className="text-muted-custom mb-4">{story.description}</p>

        {story.aiClassification && (
          <div className="flex items-center gap-2">
            <span className="data-label">classification</span>
            <span className="px-2 py-0.5 text-xs font-mono border border-border text-muted-custom">
              {story.aiClassification}
            </span>
          </div>
        )}
      </div>

      {/* Story Stats */}
      <div className="mb-6">
        <h2 className="text-lg font-mono mb-4">
          <span className="text-gold">/</span> stats
        </h2>
        <StoryStats
          story={story}
          discovererCount={story.discovererCount}
          kudosPool={story.kudosPool}
          status={story.status}
        />
      </div>

      {/* Virality Chart */}
      <div className="mb-6">
        <h2 className="text-lg font-mono mb-4">
          <span className="text-gold">/</span> virality
        </h2>
        <ViralityChart storyId={storyId} />
      </div>

      {/* Discoverers List */}
      {story.discoverers && story.discoverers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-mono mb-4">
            <span className="text-gold">/</span> discoverers
          </h2>
          <div className="border border-border rounded-lg overflow-hidden">
            {story.discoverers.map((discoverer, index) => (
              <div
                key={discoverer.id}
                className={`flex items-center justify-between p-4 ${
                  index !== story.discoverers.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                    discoverer.isOriginal
                      ? "bg-[var(--gold)] text-black"
                      : "bg-[var(--surface-secondary)] text-[var(--muted)]"
                  }`}>
                    {discoverer.isOriginal ? (
                      <Crown className="h-4 w-4" />
                    ) : (
                      <span className="text-sm font-mono">{index + 1}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {discoverer.user.displayName || "Anonymous"}
                      {discoverer.isOriginal && (
                        <span className="text-xs px-2 py-0.5 bg-[var(--gold)]/10 text-[var(--gold)] rounded">
                          first
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatRelativeTime(new Date(discoverer.submittedAt))}
                    </p>
                  </div>
                </div>
                {discoverer.kudosEarned > 0 && (
                  <div className="flex items-center gap-1 text-[var(--gold)] font-mono">
                    <Star className="h-4 w-4" />
                    +{formatKudos(discoverer.kudosEarned)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discover CTA */}
      {!isSettled && (
        <div className="flex justify-center py-6">
          {session ? (
            hasDiscovered ? (
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>you discovered this story</span>
              </div>
            ) : (
              <Button
                variant="gold"
                size="lg"
                onClick={() => discoverMutation.mutate()}
                disabled={discoverMutation.isPending}
              >
                {discoverMutation.isPending ? "discovering..." : "i discovered this"}
              </Button>
            )
          ) : (
            <Link href="/login">
              <Button variant="gold" size="lg">sign in to discover</Button>
            </Link>
          )}
        </div>
      )}

      {isSettled && (
        <div className="text-center py-6 border border-[var(--gold)]/20 bg-[var(--gold)]/5 rounded-lg">
          <p className="text-[var(--gold)] font-mono flex items-center justify-center gap-2">
            <Star className="h-5 w-5" />
            kudos have been distributed for this story
          </p>
        </div>
      )}

      {discoverMutation.isError && (
        <div className="text-center py-4 text-red-500">
          {discoverMutation.error instanceof Error
            ? discoverMutation.error.message
            : "failed to record discovery"}
        </div>
      )}
    </div>
  );
}
