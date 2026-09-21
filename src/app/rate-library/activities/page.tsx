import { listActivityRates } from "@/lib/actions/rate-library";
import { getExchangeRateMicros } from "@/lib/settings";
import { ActivityLibraryClient } from "@/components/rate-library/activity-client";

export default async function ActivityRateLibraryPage() {
  const [items, rateMicros] = await Promise.all([
    listActivityRates({ includeArchived: true }),
    getExchangeRateMicros(),
  ]);
  return <ActivityLibraryClient items={items} rateMicros={rateMicros} />;
}
