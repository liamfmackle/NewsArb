"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
      setError(err instanceof Error ? err.message : "failed to submit story");
    },
  });

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto">
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-[var(--muted)] mb-4">
          you need to sign in to submit a story
        </p>
        <Link href="/login">
          <Button>sign in</Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError("title is required");
      return;
    }
    if (formData.url.trim()) {
      try {
        new URL(formData.url);
      } catch {
        setError("please enter a valid url");
        return;
      }
    }
    if (!formData.description.trim()) {
      setError("description is required");
      return;
    }
    const stake = parseFloat(formData.initialStake);
    if (isNaN(stake) || stake <= 0) {
      setError("please enter a valid stake amount");
      return;
    }

    submitMutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/stories"
        className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-[var(--foreground)] mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        back to stories
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>submit a breaking story</CardTitle>
          <CardDescription>
            share a news story you believe will go viral. your initial stake
            seeds the market and positions you as the first backer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">story title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="enter a concise, descriptive title"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="url">source url (optional)</Label>
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
              <Label htmlFor="description">description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="briefly describe the story and why you think it will go viral"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="initialStake">initial stake ($)</Label>
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
              <p className="text-xs text-[var(--muted)] mt-1">
                your stake seeds the market. minimum $1.00
              </p>
            </div>

            <FormError>{error}</FormError>

            <Button
              type="submit"
              className="w-full"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "submitting..." : "submit story"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
