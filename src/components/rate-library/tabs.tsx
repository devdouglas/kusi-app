"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

const ITEMS = [
  { href: "/rate-library/accommodation", label: "Accommodation" },
  { href: "/rate-library/transport", label: "Private Transport & Guide" },
  { href: "/rate-library/train", label: "Train" },
  { href: "/rate-library/transfers", label: "Taxi Transfer" },
  { href: "/rate-library/activities", label: "Activities" },
  { href: "/rate-library/parks", label: "Park Entrance Fees" },
  { href: "/rate-library/flights", label: "Domestic Flights" },
];

export function RateLibraryTabs() {
  const pathname = usePathname();
  return <Tabs items={ITEMS} active={pathname} />;
}
