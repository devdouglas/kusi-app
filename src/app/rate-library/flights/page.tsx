import { listFlightRates } from "@/lib/actions/rate-library";
import { getExchangeRateMicros } from "@/lib/settings";
import { FlightLibraryClient } from "@/components/rate-library/flight-client";

export default async function FlightRateLibraryPage() {
  const [items, rateMicros] = await Promise.all([
    listFlightRates({ includeArchived: true }),
    getExchangeRateMicros(),
  ]);
  return <FlightLibraryClient items={items} rateMicros={rateMicros} />;
}
