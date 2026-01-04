"use client";

import { Check, Clock, Activity, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type StoryStatus = "pending" | "active" | "settled" | "rejected";

interface JourneyStep {
  id: string;
  label: string;
  description: string;
}

const JOURNEY_STEPS: JourneyStep[] = [
  { id: "submitted", label: "submitted", description: "your discovery is recorded" },
  { id: "verified", label: "verified", description: "confirmed as newsworthy" },
  { id: "tracking", label: "tracking", description: "monitoring virality" },
  { id: "settled", label: "settled", description: "kudos distributed!" },
];

function getStepStatus(
  stepIndex: number,
  storyStatus: StoryStatus
): "completed" | "current" | "upcoming" {
  const statusIndex = {
    pending: 0,
    active: 2,
    settled: 3,
    rejected: -1,
  };

  const currentIndex = statusIndex[storyStatus];

  if (storyStatus === "rejected") {
    return stepIndex === 0 ? "completed" : "upcoming";
  }

  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

interface StoryJourneyProps {
  status: string;
  className?: string;
}

export function StoryJourney({ status, className }: StoryJourneyProps) {
  const storyStatus = status as StoryStatus;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {JOURNEY_STEPS.map((step, index) => {
          const stepStatus = getStepStatus(index, storyStatus);
          const isLast = index === JOURNEY_STEPS.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    stepStatus === "completed" && "bg-[var(--gold)] border-[var(--gold)]",
                    stepStatus === "current" && "border-[var(--gold)] bg-[var(--gold)]/20 animate-pulse",
                    stepStatus === "upcoming" && "border-border bg-muted"
                  )}
                >
                  {stepStatus === "completed" ? (
                    <Check className="h-5 w-5 text-black" />
                  ) : stepStatus === "current" ? (
                    <Loader2 className="h-5 w-5 text-[var(--gold)] animate-spin" />
                  ) : (
                    <span className="text-sm text-muted-foreground">{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium text-center",
                    stepStatus === "completed" && "text-[var(--gold)]",
                    stepStatus === "current" && "text-[var(--gold)]",
                    stepStatus === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] text-center max-w-[80px] hidden sm:block",
                    stepStatus === "upcoming" ? "text-muted-foreground/50" : "text-muted-foreground"
                  )}
                >
                  {step.description}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-all duration-300",
                    getStepStatus(index + 1, storyStatus) !== "upcoming"
                      ? "bg-[var(--gold)]"
                      : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Compact version for cards
export function StoryJourneyCompact({ status, className }: StoryJourneyProps) {
  const storyStatus = status as StoryStatus;
  const currentStepIndex = {
    pending: 0,
    active: 2,
    settled: 3,
    rejected: 0,
  }[storyStatus];

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {JOURNEY_STEPS.map((step, index) => (
        <div
          key={step.id}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-all",
            index <= currentStepIndex ? "bg-[var(--gold)]" : "bg-border"
          )}
          title={step.label}
        />
      ))}
    </div>
  );
}
