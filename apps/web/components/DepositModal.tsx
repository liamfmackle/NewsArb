"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentsApi, Currency } from "@/lib/api";
import { X, CreditCard, Loader2 } from "lucide-react";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { data: session } = useSession();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // Fetch supported currencies on mount
  useEffect(() => {
    if (isOpen) {
      setIsLoadingCurrencies(true);
      paymentsApi
        .currencies()
        .then((data) => {
          setCurrencies(data.currencies);
        })
        .catch((err) => {
          console.error("Failed to load currencies:", err);
          // Fallback to USD if API fails
          setCurrencies([{ code: "usd", symbol: "$", name: "US Dollar", minAmount: 100 }]);
        })
        .finally(() => {
          setIsLoadingCurrencies(false);
        });
    }
  }, [isOpen]);

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

  const selectedCurrency = currencies.find((c) => c.code === currency);
  const minAmount = selectedCurrency ? selectedCurrency.minAmount / 100 : 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!session?.accessToken) {
      setError("Please sign in to deposit");
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < minAmount) {
      setError(`Minimum deposit is ${selectedCurrency?.symbol || "$"}${minAmount.toFixed(2)}`);
      return;
    }

    setIsLoading(true);
    try {
      // Convert to smallest currency unit (cents)
      const amountInCents = Math.round(depositAmount * 100);
      const result = await paymentsApi.createCheckout(
        amountInCents,
        currency,
        session.accessToken
      );

      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      } else {
        setError("Failed to create checkout session");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create checkout");
    } finally {
      setIsLoading(false);
    }
  };

  const quickAmounts = [10, 25, 50, 100];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-md mx-4 p-6 animate-in fade-in-0 zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="h-5 w-5 text-[var(--gold)]" />
          <h2 className="text-xl font-semibold">add funds</h2>
        </div>

        {isLoadingCurrencies ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="currency">currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono">{c.symbol}</span>
                        <span>{c.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amount">amount</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] font-mono">
                  {selectedCurrency?.symbol || "$"}
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min={minAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">
                minimum: {selectedCurrency?.symbol || "$"}
                {minAmount.toFixed(2)}
              </p>
            </div>

            {/* Quick amount buttons */}
            <div className="flex gap-2">
              {quickAmounts.map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setAmount(amt.toString())}
                >
                  {selectedCurrency?.symbol || "$"}
                  {amt}
                </Button>
              ))}
            </div>

            <div className="p-3 bg-[var(--surface-secondary)] rounded-md text-sm space-y-2 border border-[var(--border)]">
              <p className="text-[var(--muted)]">
                you will be redirected to Stripe to complete your payment securely.
              </p>
              <p className="text-[var(--muted)] text-xs">
                funds will be converted to USD and added to your wallet balance.
              </p>
            </div>

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
                disabled={isLoading || !amount}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    processing...
                  </>
                ) : (
                  "continue to payment"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
