"use client";

import { Star, TrendingUp, Zap, Info } from "lucide-react";
import { getKudosEstimates, formatKudos } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface EstimatedKudosPreviewProps {
  submissionOrder: number;
  isFirstDiscoverer: boolean;
  className?: string;
  variant?: "default" | "compact";
}

export function EstimatedKudosPreview({
  submissionOrder,
  isFirstDiscoverer,
  className,
  variant = "default",
}: EstimatedKudosPreviewProps) {
  const estimates = getKudosEstimates(submissionOrder, isFirstDiscoverer);

  if (variant === "compact") {
    return (
      <div className={cn("text-sm", className)}>
        <span className="text-muted-foreground">estimated: </span>
        <span className="text-[var(--gold)] font-semibold">
          {formatKudos(estimates.typical.min)}-{formatKudos(estimates.viral.max)}
        </span>
        <span className="text-muted-foreground"> kudos</span>
      </div>
    );
  }

  return (
    <div className={cn("p-4 rounded-lg border bg-card", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-4 w-4 text-[var(--gold)]" />
        <span className="text-sm font-medium">estimated kudos potential</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-3 w-3 text-[var(--gold)]" />
            <span>if story goes viral</span>
          </div>
          <span className="font-mono text-[var(--gold)] font-semibold">
            {formatKudos(estimates.viral.min)}-{formatKudos(estimates.viral.max)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>typical story</span>
          </div>
          <span className="font-mono">
            {formatKudos(estimates.typical.min)}-{formatKudos(estimates.typical.max)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="w-3 h-3 flex items-center justify-center text-xs">—</span>
            <span>minimum (story peaks)</span>
          </div>
          <span className="font-mono text-muted-foreground">
            {formatKudos(estimates.minimum)}
          </span>
        </div>
      </div>

      {isFirstDiscoverer && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs">
            <Info className="h-3 w-3 text-[var(--gold)]" />
            <span className="text-[var(--gold)]">
              you're the first discoverer — 2x kudos bonus!
            </span>
          </div>
        </div>
      )}

      {!isFirstDiscoverer && submissionOrder <= 10 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>you're discoverer #{submissionOrder} — early bird bonus active</span>
          </div>
        </div>
      )}
    </div>
  );
}
