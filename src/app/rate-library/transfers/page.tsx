import { listTransferRates } from "@/lib/actions/rate-library";
import { getExchangeRateMicros } from "@/lib/settings";
import { TransferLibraryClient } from "@/components/rate-library/transfer-client";

export default async function TransferRateLibraryPage() {
  const [items, rateMicros] = await Promise.all([
    listTransferRates({ includeArchived: true }),
    getExchangeRateMicros(),
  ]);
  return <TransferLibraryClient items={items} rateMicros={rateMicros} />;
}
