"use client";

import { TREND_COLORS } from "@/lib/colors";

interface ViralityBadgeProps {
  score: number | null;
  trend: "rising" | "stable" | "declining" | null;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ViralityBadge({
  score,
  trend,
  showLabel = false,
  size = "md",
}: ViralityBadgeProps) {
  if (score === null) {
    return null;
  }

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const trendArrows = {
    rising: "^",
    stable: "-",
    declining: "v",
  };

  const trendColor = trend ? TREND_COLORS[trend] : "text-muted";
  const trendArrow = trend ? trendArrows[trend] : "";

  // Score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-gold";
    if (score >= 40) return "text-foreground";
    return "text-muted";
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono ${sizeClasses[size]} bg-surface-secondary rounded border border-border`}
    >
      {showLabel && <span className="text-muted text-xs tracking-wider">virality</span>}
      <span className={`font-semibold ${getScoreColor(score)}`}>{score.toFixed(0)}</span>
      {trend && (
        <span className={`${trendColor} font-bold`} title={`trend: ${trend}`}>
          {trendArrow}
        </span>
      )}
    </div>
  );
}

// Compact version for story cards
export function ViralityBadgeCompact({
  score,
  trend,
}: {
  score: number | null;
  trend: "rising" | "stable" | "declining" | null;
}) {
  if (score === null) {
    return (
      <span className="text-xs text-muted font-mono">--</span>
    );
  }

  const trendArrows = {
    rising: "^",
    stable: "-",
    declining: "v",
  };

  const trendColor = trend ? TREND_COLORS[trend] : "";
  const trendArrow = trend ? trendArrows[trend] : "";

  return (
    <span className="text-xs font-mono inline-flex items-center gap-0.5">
      <span className="text-gold">{score.toFixed(0)}</span>
      {trend && <span className={trendColor}>{trendArrow}</span>}
    </span>
  );
}
