"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { storiesApi } from "@/lib/api";
import { ArrowLeft } from "lucide-react";

export default function SubmitStoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    description: "",
    initialStake: "",
  });
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: () =>
      storiesApi.create(
        {
          title: formData.title,
          url: formData.url,
          description: formData.description,
          initialStake: parseFloat(formData.initialStake),
        },
        session?.accessToken as string
      ),
    onSuccess: (story) => {
      router.push(`/stories/${story.id}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to submit story");
    },
  });

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-muted-foreground mb-4">
          You need to sign in to submit a story
        </p>
        <Link href="/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!formData.url.trim()) {
      setError("URL is required");
      return;
    }
    try {
      new URL(formData.url);
    } catch {
      setError("Please enter a valid URL");
      return;
    }
    if (!formData.description.trim()) {
      setError("Description is required");
      return;
    }
    const stake = parseFloat(formData.initialStake);
    if (isNaN(stake) || stake <= 0) {
      setError("Please enter a valid stake amount");
      return;
    }

    submitMutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/stories"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Stories
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Submit a Breaking Story</CardTitle>
          <CardDescription>
            Share a news story you believe will go viral. Your initial stake
            seeds the market and positions you as the first backer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Story Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Enter a concise, descriptive title"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="url">Source URL</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder="https://..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Briefly describe the story and why you think it will go viral"
                className="mt-1 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div>
              <Label htmlFor="initialStake">Initial Stake ($)</Label>
              <Input
                id="initialStake"
                type="number"
                step="0.01"
                min="1"
                value={formData.initialStake}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    initialStake: e.target.value,
                  }))
                }
                placeholder="10.00"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your stake seeds the market. Minimum $1.00
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Story"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
