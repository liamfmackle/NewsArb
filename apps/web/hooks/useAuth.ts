"use client";

import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";

export function useAuth() {
  const { data: session, status } = useSession();
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

  // Invalidate user data
  const refreshUser = () => {
    queryClient.invalidateQueries({ queryKey: ["user"] });
  };

  return {
    // Session state
    session,
    isAuthenticated,
    isLoading: isLoading || userLoading,

    // User data
    user,

    // Actions
    refreshUser,
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
