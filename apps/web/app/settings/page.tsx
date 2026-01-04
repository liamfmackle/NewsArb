"use client";

import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Star, Trophy } from "lucide-react";
import { formatKudos, formatRank } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.displayName || "");

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName: string }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/users/me`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">settings</h1>

      {/* Profile Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            profile
          </CardTitle>
          <CardDescription>manage your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">email</Label>
            <Input
              id="email"
              value={user?.email || ""}
              disabled
              className="mt-1 bg-muted"
            />
            <p className="text-xs text-muted-foreground mt-1">
              email cannot be changed
            </p>
          </div>

          <div>
            <Label htmlFor="displayName">display name</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="how others see you"
              />
              <Button
                onClick={() => updateProfileMutation.mutate({ displayName })}
                disabled={updateProfileMutation.isPending || displayName === user?.displayName}
              >
                {updateProfileMutation.isPending ? "saving..." : "save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kudos Stats */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[var(--gold)]" />
            kudos
          </CardTitle>
          <CardDescription>your reputation on NewsArb</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">total kudos</p>
              <p className="text-2xl font-bold font-mono text-[var(--gold)]">
                {formatKudos(user?.totalKudos || 0)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">this week</p>
              <p className="text-2xl font-bold font-mono">
                {formatKudos(user?.weeklyKudos || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[var(--muted)]" />
              <div>
                <p className="font-medium">all-time rank</p>
                <p className="text-sm text-muted-foreground">
                  weekly: {formatRank(user?.weeklyRank || null)}
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold font-mono">
              {formatRank(user?.allTimeRank || null)}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            kudos are non-transferable reputation points earned by discovering
            stories that go viral. earlier discoverers earn more kudos.
          </p>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>account</CardTitle>
          <CardDescription>account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div>
              <p className="font-medium">member since</p>
              <p className="text-sm text-muted-foreground">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "unknown"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
