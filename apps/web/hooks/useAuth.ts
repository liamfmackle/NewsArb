"use client";

import { useSession } from "next-auth/react";
import { useAccount, useDisconnect } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";

export function useAuth() {
  const { data: session, status } = useSession();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const queryClient = useQueryClient();

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  // Fetch user data when authenticated
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => usersApi.me(session?.accessToken as string),
    enabled: isAuthenticated && !!session?.accessToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Link wallet mutation
  const linkWalletMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/users/me/wallet`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({ walletAddress }),
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to link wallet");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  // Check if current wallet matches linked wallet
  const isWalletLinked = user?.walletAddress && address
    ? user.walletAddress.toLowerCase() === address.toLowerCase()
    : false;

  const hasLinkedWallet = !!user?.walletAddress;

  return {
    // Session state
    session,
    isAuthenticated,
    isLoading: isLoading || userLoading,

    // User data
    user,

    // Wallet state
    walletAddress: address,
    isWalletConnected: isConnected,
    isWalletLinked,
    hasLinkedWallet,

    // Actions
    linkWallet: linkWalletMutation.mutateAsync,
    isLinkingWallet: linkWalletMutation.isPending,
    linkWalletError: linkWalletMutation.error,
    disconnectWallet: disconnect,
  };
}

export function useRequireAuth(redirectTo = "/login") {
  const { isAuthenticated, isLoading } = useAuth();

  return {
    isAuthenticated,
    isLoading,
    shouldRedirect: !isLoading && !isAuthenticated,
    redirectTo,
  };
}
