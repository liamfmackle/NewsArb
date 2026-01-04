"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/alert";
import { GoogleIcon } from "@/components/icons/GoogleIcon";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }

    if (!/[a-zA-Z]/.test(formData.password)) {
      setError("password must contain at least one letter");
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      setError("password must contain at least one number");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            displayName: formData.displayName || undefined,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "registration failed");
      }

      // Auto sign in after registration
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        router.push("/login");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>create account</CardTitle>
          <CardDescription>
            join newsarb and start backing breaking stories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="you@example.com"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="displayName">display name (optional)</Label>
              <Input
                id="displayName"
                type="text"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
                placeholder="how others will see you"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="min 8 chars, letter + number"
                className="mt-1"
                required
                minLength={8}
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                at least 8 characters with one letter and one number
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                placeholder="repeat your password"
                className="mt-1"
                required
              />
            </div>

            <FormError>{error}</FormError>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "creating account..." : "create account"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--surface)] px-2 text-[var(--muted)]">
                or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon className="mr-2" />
            google
          </Button>

          <p className="text-center text-sm text-[var(--muted)] mt-6">
            already have an account?{" "}
            <Link href="/login" className="text-[var(--gold)] hover:underline">
              sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
