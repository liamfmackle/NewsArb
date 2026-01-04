"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils";
import { X } from "lucide-react";

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStake: (amount: number) => Promise<unknown>;
  storyTitle: string;
  currentPool: number;
  userBalance: number;
}

export function StakeModal({
  isOpen,
  onClose,
  onStake,
  storyTitle,
  currentPool,
  userBalance,
}: StakeModalProps) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const stakeAmount = parseFloat(amount);
    if (isNaN(stakeAmount) || stakeAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (stakeAmount > userBalance) {
      setError("Insufficient balance");
      return;
    }

    setIsSubmitting(true);
    try {
      await onStake(stakeAmount);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stake");
    } finally {
      setIsSubmitting(false);
    }
  };

  const potentialShare = amount
    ? (parseFloat(amount) / (currentPool + parseFloat(amount))) * 100
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-md mx-4 p-6 animate-in fade-in-0 zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold mb-2">stake on story</h2>
        <p className="text-sm text-[var(--muted)] mb-6 line-clamp-2">
          {storyTitle}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount">stake amount</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                $
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              balance: {formatCurrency(userBalance)}
            </p>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="p-3 bg-[var(--surface-secondary)] rounded-md text-sm space-y-1 border border-[var(--border)]">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">current pool</span>
                <span>{formatCurrency(currentPool)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">your share</span>
                <span className="text-[var(--gold)]">{potentialShare.toFixed(2)}%</span>
              </div>
            </div>
          )}

          <FormError>{error}</FormError>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !amount}
            >
              {isSubmitting ? "staking..." : "confirm stake"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
