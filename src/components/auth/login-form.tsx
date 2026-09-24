"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await login({ username, password });
        const target = searchParams.get("from") || "/";
        router.push(target);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sign in.");
      }
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <h1 className="text-base font-semibold text-foreground">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Kusi Safaris Rates &amp; Quotes</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <Button type="submit" variant="primary" disabled={isPending} className="w-full justify-center">
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
