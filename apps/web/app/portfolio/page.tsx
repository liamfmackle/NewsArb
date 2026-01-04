"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usersApi } from "@/lib/api";
import { formatKudos, formatRelativeTime, formatRank } from "@/lib/utils";
import { Star, Trophy, History, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const reasonLabels: Record<string, string> = {
  early_discovery: "Early Discovery",
  viral_bonus: "Viral Bonus",
  first_discoverer: "First Discoverer",
  weekly_reset: "Weekly Reset",
};

export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/portfolio");
    }
  }, [status, router]);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => usersApi.me(session?.accessToken as string),
    enabled: !!session?.accessToken,
  });

  const { data: kudosStats, isLoading: kudosLoading } = useQuery({
    queryKey: ["kudos-stats"],
    queryFn: () => usersApi.kudos(session?.accessToken as string),
    enabled: !!session?.accessToken,
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ["submissions"],
    queryFn: () => usersApi.submissions(session?.accessToken as string),
    enabled: !!session?.accessToken,
  });

  const { data: kudosHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["kudos-history"],
    queryFn: () => usersApi.kudosHistory(session?.accessToken as string, 20),
    enabled: !!session?.accessToken,
  });

  if (status === "loading" || userLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-32 rounded-lg mb-6" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const activeSubmissions = submissions?.filter((s) => s.story?.status === "active") || [];
  const settledSubmissions = submissions?.filter((s) => s.story?.status === "settled") || [];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">portfolio</h1>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted)]">
              total kudos
            </CardTitle>
            <Star className="h-4 w-4 text-[var(--gold)]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-[var(--gold)]">
              {formatKudos(kudosStats?.totalKudos || user?.totalKudos || 0)}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {formatKudos(kudosStats?.weeklyKudos || user?.weeklyKudos || 0)} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted)]">
              rank
            </CardTitle>
            <Trophy className="h-4 w-4 text-[var(--muted)]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {formatRank(kudosStats?.allTimeRank || user?.allTimeRank || null)}
            </p>
            <p className="text-xs text-[var(--muted)]">
              weekly: {formatRank(kudosStats?.weeklyRank || user?.weeklyRank || null)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted)]">
              discoveries
            </CardTitle>
            <Sparkles className="h-4 w-4 text-[var(--muted)]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {kudosStats?.totalDiscoveries || submissions?.length || 0}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {kudosStats?.originalDiscoveries || submissions?.filter(s => s.isOriginal).length || 0} first discoveries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Discoveries */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>active discoveries</CardTitle>
        </CardHeader>
        <CardContent>
          {submissionsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded" />
              ))}
            </div>
          ) : activeSubmissions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[var(--muted)] mb-4">
                you haven&apos;t discovered any active stories
              </p>
              <Link href="/stories">
                <Button>explore stories</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSubmissions.map((submission) => (
                <Link
                  key={submission.id}
                  href={`/stories/${submission.storyId}`}
                  className="block p-4 rounded-lg border border-[var(--border)] hover:border-[var(--gold)] bg-[var(--surface-secondary)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {submission.story?.title || "unknown story"}
                        {submission.isOriginal && (
                          <span className="text-xs px-2 py-0.5 bg-[var(--gold)]/10 text-[var(--gold)] rounded">
                            first
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        discovered {formatRelativeTime(new Date(submission.submittedAt))}
                      </p>
                    </div>
                    <div className="text-right">
                      {submission.kudosEarned > 0 && (
                        <p className="font-semibold font-mono text-[var(--gold)]">
                          +{formatKudos(submission.kudosEarned)} kudos
                        </p>
                      )}
                      <p className="text-xs text-[var(--muted)]">
                        {submission.story?.status || "pending"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settled Discoveries */}
      {settledSubmissions.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>settled discoveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settledSubmissions.slice(0, 5).map((submission) => (
                <Link
                  key={submission.id}
                  href={`/stories/${submission.storyId}`}
                  className="block p-4 rounded-lg border border-[var(--border)] hover:border-[var(--gold)] bg-[var(--surface-secondary)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {submission.story?.title || "unknown story"}
                        {submission.isOriginal && (
                          <span className="text-xs px-2 py-0.5 bg-[var(--gold)]/10 text-[var(--gold)] rounded">
                            first
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        discovered {formatRelativeTime(new Date(submission.submittedAt))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold font-mono text-[var(--gold)]">
                        +{formatKudos(submission.kudosEarned)} kudos
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kudos History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>kudos history</CardTitle>
          <History className="h-5 w-5 text-[var(--muted)]" />
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          ) : !kudosHistory || kudosHistory.length === 0 ? (
            <p className="text-center text-[var(--muted)] py-8">
              no kudos earned yet
            </p>
          ) : (
            <div className="space-y-2">
              {kudosHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {reasonLabels[entry.reason] || entry.reason}
                    </p>
                    {entry.story && (
                      <p className="text-xs text-[var(--muted)] truncate max-w-[200px]">
                        {entry.story.title}
                      </p>
                    )}
                    <p className="text-xs text-[var(--muted)]">
                      {formatRelativeTime(new Date(entry.createdAt))}
                    </p>
                  </div>
                  <p className={`font-semibold font-mono ${entry.amount >= 0 ? 'text-[var(--gold)]' : 'text-red-500'}`}>
                    {entry.amount >= 0 ? '+' : ''}{formatKudos(entry.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
