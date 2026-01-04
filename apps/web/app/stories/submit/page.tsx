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
import { storiesApi, MatchCheckResult } from "@/lib/api";
import { ArrowLeft, AlertCircle, CheckCircle, Users } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Confetti, useConfetti } from "@/components/Confetti";
import { EstimatedKudosPreview } from "@/components/EstimatedKudosPreview";

export default function SubmitStoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const confetti = useConfetti();
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchCheckResult | null>(null);

  const checkMatchMutation = useMutation({
    mutationFn: () =>
      storiesApi.checkMatch(
        {
          title: formData.title,
          url: formData.url || undefined,
          description: formData.description,
        },
        session?.accessToken as string
      ),
    onSuccess: (result) => {
      setMatchResult(result);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "failed to check for matches");
    },
  });

  const submitMutation = useMutation({
    mutationFn: (options?: { forceNew?: boolean; discoverStoryId?: string }) =>
      storiesApi.create(
        {
          title: formData.title,
          url: formData.url || undefined,
          description: formData.description,
          forceNew: options?.forceNew,
          discoverStoryId: options?.discoverStoryId,
        },
        session?.accessToken as string
      ),
    onSuccess: (story) => {
      const isFirst = story.isOriginalDiscoverer;

      // Show success toast
      toast({
        title: isFirst ? "you're the first discoverer!" : "story discovered!",
        description: isFirst
          ? "2x kudos multiplier activated. we'll notify you when the story peaks."
          : "we'll track virality and notify you when kudos are ready.",
        variant: "success",
      });

      // Trigger confetti for first discoverer
      if (isFirst) {
        confetti.trigger();
      }

      // Delayed redirect to let user see celebration
      setTimeout(() => {
        router.push(`/stories/${story.id}?justSubmitted=true`);
      }, isFirst ? 2000 : 1000);
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

  const handleCheckMatch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMatchResult(null);

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

    checkMatchMutation.mutate();
  };

  const handleSubmitNew = () => {
    submitMutation.mutate({ forceNew: true });
  };

  const handleDiscoverExisting = (storyId: string) => {
    submitMutation.mutate({ discoverStoryId: storyId });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Confetti isActive={confetti.isActive} onComplete={confetti.onComplete} />

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
            share a news story you believe will go viral. be among the first to
            discover it and earn kudos when it peaks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!matchResult ? (
            <form onSubmit={handleCheckMatch} className="space-y-4">
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

              <FormError>{error}</FormError>

              <Button
                type="submit"
                className="w-full"
                disabled={checkMatchMutation.isPending}
              >
                {checkMatchMutation.isPending ? "checking..." : "check for matches"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {matchResult.type === "duplicate" ? (
                <div className="p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium">similar story found</p>
                      <p className="text-sm text-[var(--muted)] mt-1">
                        {matchResult.message}
                      </p>
                    </div>
                  </div>
                </div>
              ) : matchResult.bestMatch ? (
                <div className="space-y-4">
                  <div className="p-4 border border-[var(--gold)]/20 bg-[var(--gold)]/5 rounded-lg">
                    <p className="font-medium mb-2">we found a similar story</p>
                    <div className="p-3 bg-[var(--surface-secondary)] rounded">
                      <p className="font-medium">{matchResult.bestMatch.title}</p>
                      <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">
                        {matchResult.bestMatch.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-[var(--muted)]">
                        <Users className="h-4 w-4" />
                        <span>{matchResult.bestMatch.discovererCount} discoverers</span>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--muted)] mt-3">
                      {matchResult.reasoning}
                    </p>
                  </div>

                  <EstimatedKudosPreview
                    submissionOrder={(matchResult.bestMatch?.discovererCount || 0) + 1}
                    isFirstDiscoverer={false}
                  />

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => handleDiscoverExisting(matchResult.bestMatch!.storyId)}
                      disabled={submitMutation.isPending}
                      variant="gold"
                    >
                      {submitMutation.isPending ? "discovering..." : "discover this story"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSubmitNew}
                      disabled={submitMutation.isPending}
                    >
                      submit as new story anyway
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setMatchResult(null)}
                    >
                      go back and edit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium">no matching stories found</p>
                        <p className="text-sm text-[var(--muted)] mt-1">
                          you'll be the first to discover this story!
                        </p>
                      </div>
                    </div>
                  </div>

                  <EstimatedKudosPreview
                    submissionOrder={1}
                    isFirstDiscoverer={true}
                  />

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleSubmitNew}
                      disabled={submitMutation.isPending}
                      variant="gold"
                    >
                      {submitMutation.isPending ? "submitting..." : "submit story"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setMatchResult(null)}
                    >
                      go back and edit
                    </Button>
                  </div>
                </div>
              )}

              <FormError>{error}</FormError>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
