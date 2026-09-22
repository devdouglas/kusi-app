import { listParks } from "@/lib/actions/rate-library";
import { getExchangeRateMicros } from "@/lib/settings";
import { ParkLibraryClient } from "@/components/rate-library/park-client";

export default async function ParkRateLibraryPage() {
  const [items, rateMicros] = await Promise.all([listParks({ includeArchived: true }), getExchangeRateMicros()]);
  return <ParkLibraryClient items={items} rateMicros={rateMicros} />;
}
