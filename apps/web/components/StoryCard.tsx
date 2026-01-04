import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKudos, formatRelativeTime, truncateText } from "@/lib/utils";
import { ViralityBadgeCompact } from "@/components/ViralityBadge";
import { StoryStatusBadge } from "@/components/StoryStatusBadge";
import type { Story } from "@/lib/api";

interface StoryCardProps {
  story: Story;
}

export function StoryCard({ story }: StoryCardProps) {
  const kudosPool = story.kudosPool ?? 0;
  const discoverers = story.discovererCount ?? 0;

  return (
    <Card className="hover-lift bg-surface border-border hover:border-gold/30 transition-all duration-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg leading-tight font-normal">
          <Link
            href={`/stories/${story.id}`}
            className="hover-underline"
          >
            {truncateText(story.title, 80)}
          </Link>
        </CardTitle>
        <div className="flex items-center gap-3 text-sm text-muted-custom">
          <span className="font-mono">{story.sourceDomain}</span>
          <span className="slash-divider mx-0" />
          <span>{formatRelativeTime(new Date(story.createdAt))}</span>
          <span className="slash-divider mx-0" />
          <ViralityBadgeCompact
            score={story.currentViralityScore ?? null}
            trend={story.viralityTrend ?? null}
          />
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-muted-custom line-clamp-2">
          {story.description}
        </p>
        {story.aiClassification && (
          <span className="inline-block mt-2 px-2 py-0.5 text-xs font-mono tracking-wide border border-border text-muted-custom">
            {story.aiClassification}
          </span>
        )}
        <div className="mt-2">
          <StoryStatusBadge status={story.status} variant="compact" />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-4 text-sm font-mono">
          <span className="data-value">
            <span className="data-label">kudos</span>{" "}
            <span className="text-gold">{formatKudos(kudosPool)}</span>
          </span>
          <span className="data-value">
            <span className="data-label">discoverers</span>{" "}
            {discoverers}
          </span>
        </div>
        <Link href={`/stories/${story.id}`}>
          <Button variant="gold" size="sm">
            view story
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
