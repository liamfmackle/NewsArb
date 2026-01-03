"use client";

import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletButton } from "@/components/WalletButton";
import { useAccount } from "wagmi";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Shield, Wallet, User } from "lucide-react";

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const { user, session, isWalletLinked, hasLinkedWallet, linkWallet, isLinkingWallet } = useAuth();
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
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

  const handleLinkWallet = async () => {
    if (!address) return;
    try {
      await linkWallet(address);
    } catch (error) {
      console.error("Failed to link wallet:", error);
    }
  };

  const copyAddress = () => {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Profile Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email || ""}
              disabled
              className="mt-1 bg-muted"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed
            </p>
          </div>

          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others see you"
              />
              <Button
                onClick={() => updateProfileMutation.mutate({ displayName })}
                disabled={updateProfileMutation.isPending || displayName === user?.displayName}
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet
          </CardTitle>
          <CardDescription>
            Connect and link your Web3 wallet for enhanced features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current connection status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div>
              <p className="font-medium">Wallet Connection</p>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? `Connected: ${shortenAddress(address!)}`
                  : "Not connected"}
              </p>
            </div>
            <WalletButton />
          </div>

          {/* Linked wallet info */}
          {hasLinkedWallet && (
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    Linked Wallet
                    <Check className="h-4 w-4 text-green-600" />
                  </p>
                  <p className="text-sm font-mono text-muted-foreground">
                    {shortenAddress(user!.walletAddress!)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={copyAddress}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <a
                    href={`https://etherscan.io/address/${user?.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>

              {isConnected && !isWalletLinked && (
                <p className="text-sm text-yellow-600 mt-2">
                  Connected wallet differs from linked wallet
                </p>
              )}
            </div>
          )}

          {/* Link wallet prompt */}
          {isConnected && !hasLinkedWallet && (
            <div className="p-4 rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground mb-3">
                Link your connected wallet to your account for wallet-based
                authentication and future Web3 features.
              </p>
              <Button onClick={handleLinkWallet} disabled={isLinkingWallet}>
                {isLinkingWallet ? "Linking..." : "Link Wallet to Account"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div>
              <p className="font-medium">KYC Status</p>
              <p className="text-sm text-muted-foreground">
                {user?.kycStatus === "verified"
                  ? "Identity verified"
                  : user?.kycStatus === "pending"
                    ? "Verification in progress"
                    : "Not started"}
              </p>
            </div>
            <span
              className={`px-3 py-1 text-sm rounded-full ${
                user?.kycStatus === "verified"
                  ? "bg-green-100 text-green-800"
                  : user?.kycStatus === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
              }`}
            >
              {user?.kycStatus === "verified"
                ? "Verified"
                : user?.kycStatus === "pending"
                  ? "Pending"
                  : "Not Verified"}
            </span>
          </div>

          {user?.kycStatus === "none" && (
            <p className="text-sm text-muted-foreground">
              KYC verification will be required for withdrawals above certain
              thresholds. This feature is coming soon.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
