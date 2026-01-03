"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Wallet, Link, Unlink, Check } from "lucide-react";
import { useState } from "react";

export function WalletButton() {
  const {
    isAuthenticated,
    isWalletConnected,
    isWalletLinked,
    hasLinkedWallet,
    walletAddress,
    user,
    linkWallet,
    isLinkingWallet,
  } = useAuth();

  const [showLinkPrompt, setShowLinkPrompt] = useState(false);

  const handleLinkWallet = async () => {
    if (!walletAddress) return;
    try {
      await linkWallet(walletAddress);
      setShowLinkPrompt(false);
    } catch (error) {
      console.error("Failed to link wallet:", error);
    }
  };

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button
                    onClick={openConnectModal}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} variant="destructive" size="sm">
                    Wrong network
                  </Button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  {/* Show link status for authenticated users */}
                  {isAuthenticated && !hasLinkedWallet && (
                    <Button
                      onClick={handleLinkWallet}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={isLinkingWallet}
                    >
                      <Link className="h-4 w-4" />
                      {isLinkingWallet ? "Linking..." : "Link Wallet"}
                    </Button>
                  )}

                  {isAuthenticated && hasLinkedWallet && isWalletLinked && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="h-3 w-3" />
                      Linked
                    </span>
                  )}

                  {isAuthenticated && hasLinkedWallet && !isWalletLinked && (
                    <span className="text-xs text-yellow-600">
                      Different wallet
                    </span>
                  )}

                  <Button
                    onClick={openAccountModal}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Wallet className="h-4 w-4" />
                    {account.displayName}
                  </Button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
