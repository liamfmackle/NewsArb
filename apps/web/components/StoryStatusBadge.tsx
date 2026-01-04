"use client";

import { Clock, Activity, Star, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StoryStatus = "pending" | "active" | "settled" | "rejected";

interface StatusConfig {
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  icon: LucideIcon;
}

const STATUS_CONFIG: Record<StoryStatus, StatusConfig> = {
  pending: {
    label: "awaiting verification",
    description: "our ai is reviewing your story",
    bgColor: "bg-yellow-500/20",
    textColor: "text-yellow-400",
    icon: Clock,
  },
  active: {
    label: "tracking virality",
    description: "monitoring how viral this gets",
    bgColor: "bg-green-500/20",
    textColor: "text-green-400",
    icon: Activity,
  },
  settled: {
    label: "kudos distributed",
    description: "story peaked - kudos awarded!",
    bgColor: "bg-[var(--gold)]/20",
    textColor: "text-[var(--gold)]",
    icon: Star,
  },
  rejected: {
    label: "not accepted",
    description: "this story didn't meet our criteria",
    bgColor: "bg-red-500/20",
    textColor: "text-red-400",
    icon: XCircle,
  },
};

interface StoryStatusBadgeProps {
  status: string;
  variant?: "default" | "compact" | "large";
  showDescription?: boolean;
  className?: string;
}

export function StoryStatusBadge({
  status,
  variant = "default",
  showDescription = false,
  className,
}: StoryStatusBadgeProps) {
  const config = STATUS_CONFIG[status as StoryStatus] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono",
          config.bgColor,
          config.textColor,
          className
        )}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  }

  if (variant === "large") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg",
            config.bgColor
          )}
        >
          <Icon className={cn("h-5 w-5", config.textColor)} />
          <span className={cn("text-lg font-semibold", config.textColor)}>
            {config.label}
          </span>
        </div>
        {showDescription && (
          <p className="text-sm text-muted-foreground pl-1">
            {config.description}
          </p>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn("flex items-center gap-2", config.textColor)}>
        <Icon className="h-4 w-4" />
        <span className="font-semibold">{config.label}</span>
      </div>
      {showDescription && (
        <p className="text-xs text-muted-foreground mt-0.5">
          {config.description}
        </p>
      )}
    </div>
  );
}

// Export for use in other components
export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status as StoryStatus]?.label || status;
}

export function getStatusDescription(status: string): string {
  return STATUS_CONFIG[status as StoryStatus]?.description || "";
}
