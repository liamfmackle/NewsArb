import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatKudos(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function formatRank(rank: number | null): string {
  if (rank === null) return "-";
  return `#${rank}`;
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// Kudos estimation utilities
export function estimateKudos(
  submissionOrder: number,
  estimatedVirality: number,
  isFirstDiscoverer: boolean
): number {
  const base = 100;
  const early = Math.max(0, 100 - (submissionOrder - 1) * 10);
  const timing = 40; // Assume quick submission
  const virality = Math.floor(estimatedVirality / 10) * 5;
  const multiplier = isFirstDiscoverer ? 2.0 : 1.0;
  return Math.floor((base + early + timing + virality) * multiplier);
}

export interface KudosEstimate {
  minimum: number;
  typical: { min: number; max: number };
  viral: { min: number; max: number };
}

export function getKudosEstimates(
  submissionOrder: number,
  isFirstDiscoverer: boolean
): KudosEstimate {
  return {
    minimum: estimateKudos(submissionOrder, 10, isFirstDiscoverer),
    typical: {
      min: estimateKudos(submissionOrder, 30, isFirstDiscoverer),
      max: estimateKudos(submissionOrder, 50, isFirstDiscoverer),
    },
    viral: {
      min: estimateKudos(submissionOrder, 70, isFirstDiscoverer),
      max: estimateKudos(submissionOrder, 100, isFirstDiscoverer),
    },
  };
}
