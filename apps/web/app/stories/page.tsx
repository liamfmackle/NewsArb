"use client";

import { useQuery } from "@tanstack/react-query";
import { StoryCard } from "@/components/StoryCard";
import { Button } from "@/components/ui/button";
import { storiesApi, Story } from "@/lib/api";
import { useState } from "react";
import Link from "next/link";

export default function StoriesPage() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ["stories", page],
    queryFn: () => storiesApi.list({ page, limit }),
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Failed to load stories</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Stories</h1>
          <p className="text-muted-foreground mt-1">
            Discover and back breaking news stories
          </p>
        </div>
        <Link href="/stories/submit">
          <Button>Submit Story</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : data?.stories.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">No stories yet</p>
          <Link href="/stories/submit">
            <Button>Be the first to submit</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data?.stories.map((story: Story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>

          {data && data.total > limit && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page * limit >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
