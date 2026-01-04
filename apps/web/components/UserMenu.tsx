"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatKudos, formatRank } from "@/lib/utils";
import {
  User,
  Settings,
  LogOut,
  Trophy,
  ChevronDown,
  Star,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function UserMenu() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <User className="h-4 w-4" />
        {user.displayName || user.email?.split("@")[0]}
        <ChevronDown className="h-3 w-3" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border bg-popover shadow-lg z-50">
          <div className="p-2 border-b">
            <p className="text-sm font-medium">{user.displayName || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 text-xs">
                <Star className="h-3 w-3 text-[var(--gold)]" />
                <span className="font-medium">{formatKudos(user.totalKudos)} kudos</span>
              </div>
              {user.allTimeRank && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy className="h-3 w-3" />
                  <span>{formatRank(user.allTimeRank)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-1">
            <Link
              href="/portfolio"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted"
            >
              <User className="h-4 w-4" />
              Portfolio
            </Link>
            <Link
              href="/leaderboards"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted"
            >
              <Trophy className="h-4 w-4" />
              Leaderboards
            </Link>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>

          <div className="border-t p-1">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-muted text-left"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
