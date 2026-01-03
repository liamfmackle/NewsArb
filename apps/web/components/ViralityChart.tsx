"use client";

import { useQuery } from "@tanstack/react-query";
import { viralityApi, type ViralityData } from "@/lib/api";
import { ViralityBadge } from "./ViralityBadge";

interface ViralityChartProps {
  storyId: string;
}

export function ViralityChart({ storyId }: ViralityChartProps) {
  const { data, isLoading, error } = useQuery<ViralityData>({
    queryKey: ["virality", storyId],
    queryFn: () => viralityApi.get(storyId),
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <div className="bg-surface border border-border p-4 animate-pulse">
        <div className="h-4 bg-surface-secondary rounded w-24 mb-4" />
        <div className="h-32 bg-surface-secondary rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-surface border border-border p-4">
        <p className="text-muted-custom text-sm font-mono">
          virality data unavailable
        </p>
      </div>
    );
  }

  const { current, isDecaying, decayReason, history } = data;

  // Find max score for scaling
  const maxScore = Math.max(
    current.peak ?? 0,
    ...history.map((h) => h.score),
    100
  );

  return (
    <div className="bg-surface border border-border p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="data-label">virality</span>
        <ViralityBadge
          score={current.score}
          trend={current.trend}
          size="md"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <span className="data-label">current</span>
          <p className="font-mono text-lg text-gold">
            {current.score?.toFixed(0) ?? "--"}
          </p>
        </div>
        <div>
          <span className="data-label">peak</span>
          <p className="font-mono text-lg">
            {current.peak?.toFixed(0) ?? "--"}
          </p>
        </div>
        <div>
          <span className="data-label">trend</span>
          <p
            className={`font-mono text-lg ${
              current.trend === "rising"
                ? "text-green-400"
                : current.trend === "declining"
                  ? "text-red-400"
                  : "text-yellow-400"
            }`}
          >
            {current.trend ?? "--"}
          </p>
        </div>
      </div>

      {/* Mini chart */}
      {history.length > 0 && (
        <div className="h-24 flex items-end gap-1">
          {history
            .slice(0, 12)
            .reverse()
            .map((point, i) => {
              const height = (point.score / maxScore) * 100;
              const barColor =
                point.trend === "rising"
                  ? "bg-green-400"
                  : point.trend === "declining"
                    ? "bg-red-400"
                    : "bg-yellow-400";

              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end"
                  title={`${point.score.toFixed(0)} (${point.trend})`}
                >
                  <div
                    className={`w-full ${barColor} opacity-60 hover:opacity-100 transition-opacity rounded-t`}
                    style={{ height: `${height}%`, minHeight: "4px" }}
                  />
                </div>
              );
            })}
        </div>
      )}

      {/* Decay warning */}
      {isDecaying && (
        <div className="border border-red-400/50 bg-red-400/10 p-3 rounded">
          <p className="text-sm font-mono text-red-400">
            <span className="text-red-500">!</span> settlement approaching
          </p>
          {decayReason && (
            <p className="text-xs text-muted-custom mt-1">{decayReason}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function ViralityMini({
  score,
  trend,
  peak,
}: {
  score: number | null;
  trend: "rising" | "stable" | "declining" | null;
  peak: number | null;
}) {
  if (score === null) {
    return null;
  }

  const trendColors = {
    rising: "text-green-400",
    stable: "text-yellow-400",
    declining: "text-red-400",
  };

  return (
    <div className="flex items-center gap-3 font-mono text-sm">
      <span>
        <span className="data-label">score</span>{" "}
        <span className="text-gold">{score.toFixed(0)}</span>
      </span>
      {peak && peak > score && (
        <span>
          <span className="data-label">peak</span>{" "}
          <span className="text-muted-custom">{peak.toFixed(0)}</span>
        </span>
      )}
      {trend && (
        <span className={trendColors[trend]}>
          {trend === "rising" ? "^" : trend === "declining" ? "v" : "-"}
        </span>
      )}
    </div>
  );
}
