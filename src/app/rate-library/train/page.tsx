import { listTrainJourneys } from "@/lib/actions/rate-library";
import { getExchangeRateMicros } from "@/lib/settings";
import { TrainLibraryClient } from "@/components/rate-library/train-client";

export default async function TrainRateLibraryPage() {
  const [items, rateMicros] = await Promise.all([
    listTrainJourneys({ includeArchived: true }),
    getExchangeRateMicros(),
  ]);
  return <TrainLibraryClient items={items} rateMicros={rateMicros} />;
}
