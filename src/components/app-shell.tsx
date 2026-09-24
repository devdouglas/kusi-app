"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import clsx from "clsx";
import packageJson from "../../package.json";
import { SignOutButton } from "@/components/auth/sign-out-button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/rate-library", label: "Rate Library" },
  { href: "/quotes/new", label: "Quote Builder" },
  { href: "/quotes", label: "Saved Quotes" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/quotes/new") return pathname === "/quotes/new";
  if (href === "/quotes") return pathname.startsWith("/quotes") && pathname !== "/quotes/new";
  return pathname.startsWith(href);
}

export function AppShell({ children, username }: { children: ReactNode; username?: string | null }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-3">
          <Link href="/" className="flex shrink-0 flex-col">
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sage-500 text-sm font-semibold text-white">
                K
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                Kusi Safaris <span className="font-normal text-muted">Rates &amp; Quotes</span>
              </span>
            </span>
            <span className="pl-[42px] text-[11px] font-medium text-muted">
              v{packageJson.version}
            </span>
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sage-500 text-white"
                      : "text-foreground/70 hover:bg-sage-50 hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {username && (
            <div className="flex shrink-0 items-center gap-3">
              <Link href="/account" className="text-[13px] font-medium text-foreground/70 hover:text-foreground hover:underline">
                {username}
              </Link>
              <span className="text-border">·</span>
              <SignOutButton />
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
