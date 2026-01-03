"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { paymentsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";

export default function DepositSuccessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const sessionId = searchParams.get("session_id");

  const [paymentStatus, setPaymentStatus] = useState<{
    status: string;
    amountTotal: number;
    currency: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session?.accessToken && sessionId) {
      paymentsApi
        .getCheckoutStatus(sessionId, session.accessToken)
        .then((data) => {
          setPaymentStatus(data);
          // Invalidate user query to refresh balance
          queryClient.invalidateQueries({ queryKey: ["user"] });
        })
        .catch((err) => {
          console.error("Failed to get payment status:", err);
          setError("Failed to verify payment status");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (status === "authenticated" && !sessionId) {
      setError("Missing session ID");
      setIsLoading(false);
    }
  }, [status, session, sessionId, router, queryClient]);

  if (status === "loading" || isLoading) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verifying payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Link href="/portfolio">
              <Button>Go to Portfolio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = paymentStatus?.status === "paid";
  const amountInDollars = (paymentStatus?.amountTotal || 0) / 100;

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">
            {isPaid ? "Payment Successful!" : "Payment Processing"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {isPaid ? (
            <>
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">
                  Amount deposited
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(amountInDollars)}
                </p>
                {paymentStatus?.currency !== "usd" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Converted from {paymentStatus?.currency?.toUpperCase()}
                  </p>
                )}
              </div>

              <p className="text-muted-foreground">
                Your funds have been added to your wallet and are ready to use.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Your payment is being processed. This usually takes a few seconds.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Link href="/stories">
              <Button className="w-full">
                Start Staking
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button variant="outline" className="w-full">
                View Portfolio
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
