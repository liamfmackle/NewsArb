"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketStats } from "@/components/MarketStats";
import { StakeModal } from "@/components/StakeModal";
import { ViralityChart } from "@/components/ViralityChart";
import { ViralityBadge } from "@/components/ViralityBadge";
import { storiesApi, marketsApi, usersApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function StoryPage() {
  const params = useParams();
  const storyId = params.id as string;
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [showStakeModal, setShowStakeModal] = useState(false);

  const { data: story, isLoading: storyLoading } = useQuery({
    queryKey: ["story", storyId],
    queryFn: () => storiesApi.get(storyId),
  });

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => usersApi.me(session?.accessToken as string),
    enabled: !!session?.accessToken,
  });

  const stakeMutation = useMutation({
    mutationFn: (amount: number) =>
      marketsApi.stake(story!.market!.id, amount, session?.accessToken as string),
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

  const isSettled = story.market?.status === "settled";

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
          <span className="slash-divider" />
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover-underline"
          >
            source
          </a>
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

      {/* Two column layout for market and virality */}
      {story.market && (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Market Stats */}
          <div>
            <h2 className="text-lg font-mono mb-4">
              <span className="text-gold">/</span> market
            </h2>
            <MarketStats market={story.market} />

            {/* Settlement info if settled */}
            {isSettled && story.market.settlementReason && (
              <div className="mt-4 p-3 border border-muted bg-surface-secondary font-mono text-sm">
                <span className="data-label">settled</span>
                <p className="text-muted-custom mt-1">{story.market.settlementReason}</p>
              </div>
            )}
          </div>

          {/* Virality Chart */}
          <div>
            <h2 className="text-lg font-mono mb-4">
              <span className="text-gold">/</span> virality
            </h2>
            <ViralityChart storyId={storyId} />
          </div>
        </div>
      )}

      {/* Stake CTA */}
      {story.market && !isSettled && (
        <div className="flex justify-center py-6">
          {session ? (
            <Button variant="gold" size="lg" onClick={() => setShowStakeModal(true)}>
              stake on this story
            </Button>
          ) : (
            <Link href="/login">
              <Button variant="gold" size="lg">sign in to stake</Button>
            </Link>
          )}
        </div>
      )}

      {isSettled && (
        <div className="text-center py-6">
          <p className="text-muted-custom font-mono">
            this market has been settled
          </p>
        </div>
      )}

      {story.market && user && (
        <StakeModal
          isOpen={showStakeModal}
          onClose={() => setShowStakeModal(false)}
          onStake={stakeMutation.mutateAsync}
          storyTitle={story.title}
          currentPool={story.market.totalPool}
          userBalance={user.balance}
        />
      )}
    </div>
  );
}
