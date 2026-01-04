"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { formatKudos } from "@/lib/utils";

function SlashDivider() {
  return <span className="slash-divider" />;
}

export function Navbar() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-1 font-mono text-lg tracking-wider hover:text-[var(--gold)] transition-colors"
          >
            <span className="text-[var(--gold)]">/</span>
            newsarb
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center">
            <Link
              href="/stories"
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hover-underline px-1"
            >
              stories
            </Link>
            <SlashDivider />
            <Link
              href="/stories/submit"
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hover-underline px-1"
            >
              submit
            </Link>
            <SlashDivider />
            <Link
              href="/leaderboards"
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hover-underline px-1"
            >
              leaderboards
            </Link>
            {isAuthenticated && (
              <>
                <SlashDivider />
                <Link
                  href="/portfolio"
                  className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hover-underline px-1"
                >
                  portfolio
                </Link>
              </>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse bg-[var(--surface-secondary)]" />
            ) : isAuthenticated ? (
              <>
                {/* Kudos display */}
                {user && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-secondary)] border border-[var(--border)]">
                    <span className="text-[var(--gold)] font-mono text-xs tracking-wider">
                      kudos
                    </span>
                    <span className="text-sm font-mono tabular-nums">
                      {formatKudos(user.totalKudos)}
                    </span>
                  </div>
                )}

                <UserMenu />
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    sign in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">get started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className="font-mono text-lg">
              {mobileMenuOpen ? "×" : "≡"}
            </span>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[var(--border)] animate-fade-in">
            <div className="flex flex-col gap-3">
              <Link
                href="/stories"
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="text-[var(--gold)]">/</span>
                stories
              </Link>
              <Link
                href="/stories/submit"
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="text-[var(--gold)]">/</span>
                submit
              </Link>
              <Link
                href="/leaderboards"
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="text-[var(--gold)]">/</span>
                leaderboards
              </Link>
              {isAuthenticated && (
                <>
                  <Link
                    href="/portfolio"
                    className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-[var(--gold)]">/</span>
                    portfolio
                  </Link>
                  <Link
                    href="/settings"
                    className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-[var(--gold)]">/</span>
                    settings
                  </Link>
                  {user && (
                    <div className="flex items-center gap-2 text-sm font-mono mt-2 pt-2 border-t border-[var(--border)]">
                      <span className="text-[var(--gold)]">kudos</span>
                      <span className="tabular-nums">
                        {formatKudos(user.totalKudos)}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="pt-4 mt-2 border-t border-[var(--border)] space-y-3">
                {isAuthenticated ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    sign out
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">
                        sign in
                      </Button>
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button className="w-full">get started</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
