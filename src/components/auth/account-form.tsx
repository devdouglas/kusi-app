"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCredentials } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function AccountForm({ username }: { username: string }) {
  const router = useRouter();
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword && newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    startTransition(async () => {
      try {
        await updateCredentials({
          currentPassword,
          newUsername: newUsername !== username ? newUsername : undefined,
          newPassword: newPassword || undefined,
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update your account.");
      }
    });
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <h2 className="text-base font-semibold text-foreground">Sign-in details</h2>
        <p className="mt-1 text-sm text-muted">Change your username and/or password.</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="newUsername">Username</Label>
            <Input
              id="newUsername"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Leave blank to keep your current password"
            />
          </div>
          {newPassword && (
            <div>
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          )}
          <div className="border-t border-border pt-4">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <p className="mt-1.5 text-[12px] text-muted">Required to confirm any change.</p>
          </div>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
            {saved && <span className="text-[13px] text-sage-700">Saved</span>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
