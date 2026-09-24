"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/actions/auth";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await logout();
        router.push("/login");
        router.refresh();
      }}
      className="text-[13px] font-medium text-foreground/70 hover:text-foreground hover:underline disabled:opacity-60"
    >
      Sign out
    </button>
  );
}
