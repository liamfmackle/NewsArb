"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold mb-2">Stake on Story</h2>
        <p className="text-sm text-muted-foreground mb-6 line-clamp-2">
          {storyTitle}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount">Stake Amount</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
            <p className="text-xs text-muted-foreground mt-1">
              Balance: {formatCurrency(userBalance)}
            </p>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="p-3 bg-muted rounded-md text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Pool</span>
                <span>{formatCurrency(currentPool)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Share</span>
                <span>{potentialShare.toFixed(2)}%</span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !amount}
            >
              {isSubmitting ? "Staking..." : "Confirm Stake"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
