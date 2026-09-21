import { listAccommodations } from "@/lib/actions/rate-library";
import { getExchangeRateMicros } from "@/lib/settings";
import { AccommodationLibraryClient } from "@/components/rate-library/accommodation-client";

export default async function AccommodationRateLibraryPage() {
  const [items, rateMicros] = await Promise.all([
    listAccommodations({ includeArchived: true }),
    getExchangeRateMicros(),
  ]);
  return <AccommodationLibraryClient items={items} rateMicros={rateMicros} />;
}
