import { prisma } from "@/lib/prisma";
import { rateToMicros } from "@/lib/money";

const SETTINGS_ID = "singleton";
const DEFAULT_RATE = 130; // sensible starting default; user edits in Settings

/** Fetches the singleton Settings row, creating it with a default rate on first use. */
export async function getSettings() {
  const settings = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (settings) return settings;
  // upsert (rather than create) so concurrent first-time reads — e.g. many
  // pages statically generating in parallel — don't race on the unique id.
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID, rateMicros: rateToMicros(DEFAULT_RATE) },
  });
}

export async function getExchangeRateMicros(): Promise<number> {
  const settings = await getSettings();
  return settings.rateMicros;
}

export async function updateExchangeRate(rate: number) {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: { rateMicros: rateToMicros(rate) },
    create: { id: SETTINGS_ID, rateMicros: rateToMicros(rate) },
  });
}
