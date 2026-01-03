"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function DepositCancelPage() {
  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">
            Your payment was cancelled. No funds have been charged to your
            account.
          </p>

          <div className="p-4 bg-muted rounded-lg text-sm text-left space-y-2">
            <p className="font-medium">Common reasons for cancellation:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Changed your mind about the deposit amount</li>
              <li>Wanted to use a different payment method</li>
              <li>Accidentally closed the payment page</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/portfolio">
              <Button className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </Link>
            <Link href="/stories">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Stories
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
