"use client";

import { Star, Activity, TrendingUp, Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstimatedKudosPreview } from "@/components/EstimatedKudosPreview";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface WelcomeBannerProps {
  isFirstDiscoverer: boolean;
  submissionOrder: number;
  onDismiss: () => void;
  className?: string;
}

export function WelcomeBanner({
  isFirstDiscoverer,
  submissionOrder,
  onDismiss,
  className,
}: WelcomeBannerProps) {
  return (
    <div
      className={cn(
        "relative p-6 rounded-lg border-2 border-[var(--gold)]/50 bg-[var(--gold)]/5",
        className
      )}
    >
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-[var(--gold)]" />
        <h3 className="text-lg font-semibold">
          {isFirstDiscoverer
            ? "you're the first discoverer!"
            : "you discovered this story!"}
        </h3>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">
          what happens next:
        </h4>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-[var(--gold)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Activity className="h-3 w-3 text-[var(--gold)]" />
            </div>
            <p className="text-sm">
              we'll track this story's spread across the web
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-[var(--gold)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <TrendingUp className="h-3 w-3 text-[var(--gold)]" />
            </div>
            <p className="text-sm">
              when virality peaks, the story "settles"
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-[var(--gold)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Gift className="h-3 w-3 text-[var(--gold)]" />
            </div>
            <p className="text-sm">
              kudos are distributed to all discoverers
            </p>
          </div>
        </div>
      </div>

      <EstimatedKudosPreview
        submissionOrder={submissionOrder}
        isFirstDiscoverer={isFirstDiscoverer}
        className="mb-4"
      />

      <div className="flex items-center gap-3">
        <Link href="/portfolio">
          <Button variant="gold" size="sm">
            view your portfolio
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={onDismiss}>
          got it
        </Button>
      </div>
    </div>
  );
}
