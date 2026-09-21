import type { ReactNode } from "react";
import { RateLibraryTabs } from "@/components/rate-library/tabs";

export default function RateLibraryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Rate Library</h1>
        <p className="mt-1 text-sm text-muted">Create, organise and update supplier prices.</p>
      </div>
      <RateLibraryTabs />
      {children}
    </div>
  );
}
