"use client";

import { useState, useEffect } from "react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Add Funds</h2>
        </div>

        {isLoadingCurrencies ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select currency" />
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
              <Label htmlFor="amount">Amount</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
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
              <p className="text-xs text-muted-foreground mt-1">
                Minimum: {selectedCurrency?.symbol || "$"}
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

            <div className="p-3 bg-muted rounded-md text-sm space-y-2">
              <p className="text-muted-foreground">
                You will be redirected to Stripe to complete your payment securely.
              </p>
              <p className="text-muted-foreground text-xs">
                Funds will be converted to USD and added to your wallet balance.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

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
                disabled={isLoading || !amount}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  "Continue to Payment"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
