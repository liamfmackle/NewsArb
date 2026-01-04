// Centralized color constants for consistent styling across the app

export const TREND_COLORS = {
  rising: "text-green-400",
  stable: "text-yellow-400",
  declining: "text-red-400",
} as const;

export const TREND_BG_COLORS = {
  rising: "bg-green-400/20",
  stable: "bg-yellow-400/20",
  declining: "bg-red-400/20",
} as const;

export const TRANSACTION_COLORS = {
  deposit: "text-green-400",
  payout: "text-green-400",
  stake: "text-red-400",
  withdrawal: "text-red-400",
  fee: "text-[var(--muted)]",
} as const;

export const STATUS_COLORS = {
  verified: {
    bg: "bg-green-500/20",
    text: "text-green-400",
  },
  pending: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
  },
  none: {
    bg: "bg-[var(--surface-tertiary)]",
    text: "text-[var(--muted)]",
  },
  active: {
    bg: "bg-green-500/20",
    text: "text-green-400",
  },
  settled: {
    bg: "bg-[var(--surface-tertiary)]",
    text: "text-[var(--muted)]",
  },
} as const;

// Helper function to get transaction color
export function getTransactionColor(type: string): string {
  return TRANSACTION_COLORS[type as keyof typeof TRANSACTION_COLORS] || "";
}

// Helper function to get trend color
export function getTrendColor(trend: string | null): string {
  if (!trend) return "text-[var(--muted)]";
  return TREND_COLORS[trend as keyof typeof TREND_COLORS] || "text-[var(--muted)]";
}

// Helper function to get status colors
export function getStatusColors(status: string): { bg: string; text: string } {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.none;
}
