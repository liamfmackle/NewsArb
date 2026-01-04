"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold mb-4">something went wrong</h1>
      <p className="text-[var(--muted)] mb-6">an unexpected error occurred</p>
      <Button onClick={reset}>try again</Button>
    </div>
  );
}
