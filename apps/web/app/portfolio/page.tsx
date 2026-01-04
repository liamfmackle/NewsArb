"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usersApi } from "@/lib/api";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { Wallet, TrendingUp, History } from "lucide-react";

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

  const { data: positions, isLoading: positionsLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => usersApi.positions(session?.accessToken as string),
    enabled: !!session?.accessToken,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => usersApi.transactions(session?.accessToken as string),
    enabled: !!session?.accessToken,
  });

  if (status === "loading" || userLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="h-32 bg-[var(--surface-secondary)] animate-pulse rounded-lg mb-6" />
        <div className="h-64 bg-[var(--surface-secondary)] animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const activePositions = positions?.filter((p) => p.status === "active") || [];
  const totalStaked = activePositions.reduce((sum, p) => sum + p.stakeAmount, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">portfolio</h1>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted)]">
              balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-[var(--muted)]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-[var(--gold)]">
              {formatCurrency(user?.balance || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted)]">
              active stakes
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--muted)]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{formatCurrency(totalStaked)}</p>
            <p className="text-xs text-[var(--muted)]">
              {activePositions.length} position
              {activePositions.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted)]">
              kyc status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span
              className={`inline-block px-2 py-1 text-xs rounded-full ${
                user?.kycStatus === "verified"
                  ? "bg-green-500/20 text-green-400"
                  : user?.kycStatus === "pending"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-[var(--surface-tertiary)] text-[var(--muted)]"
              }`}
            >
              {user?.kycStatus === "verified"
                ? "verified"
                : user?.kycStatus === "pending"
                  ? "pending"
                  : "not started"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Active Positions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>active positions</CardTitle>
        </CardHeader>
        <CardContent>
          {positionsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-[var(--surface-secondary)] animate-pulse rounded"
                />
              ))}
            </div>
          ) : activePositions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[var(--muted)] mb-4">
                you don&apos;t have any active positions
              </p>
              <Link href="/stories">
                <Button>explore stories</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activePositions.map((position) => (
                <Link
                  key={position.id}
                  href={`/stories/${position.story?.id}`}
                  className="block p-4 rounded-lg border border-[var(--border)] hover:border-[var(--gold)] bg-[var(--surface-secondary)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {position.story?.title || "unknown story"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        staked {formatRelativeTime(new Date(position.entryTime))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold font-mono text-[var(--gold)]">
                        {formatCurrency(position.stakeAmount)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        pool at entry: {formatCurrency(position.entryPoolSize)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>recent transactions</CardTitle>
          <History className="h-5 w-5 text-[var(--muted)]" />
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-[var(--surface-secondary)] animate-pulse rounded"
                />
              ))}
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <p className="text-center text-[var(--muted)] py-8">
              no transactions yet
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 10).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
                >
                  <div>
                    <p className="font-medium">{tx.type}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatRelativeTime(new Date(tx.createdAt))}
                    </p>
                  </div>
                  <p
                    className={`font-semibold font-mono ${
                      tx.type === "payout" || tx.type === "deposit"
                        ? "text-green-400"
                        : tx.type === "stake" || tx.type === "withdrawal"
                          ? "text-red-400"
                          : ""
                    }`}
                  >
                    {tx.type === "payout" || tx.type === "deposit" ? "+" : "-"}
                    {formatCurrency(Math.abs(tx.amount))}
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
