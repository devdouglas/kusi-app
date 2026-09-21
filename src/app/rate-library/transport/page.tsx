import { listTransportRates } from "@/lib/actions/rate-library";
import { getExchangeRateMicros } from "@/lib/settings";
import { TransportLibraryClient } from "@/components/rate-library/transport-client";

export default async function TransportRateLibraryPage() {
  const [items, rateMicros] = await Promise.all([
    listTransportRates({ includeArchived: true }),
    getExchangeRateMicros(),
  ]);
  return <TransportLibraryClient items={items} rateMicros={rateMicros} />;
}
