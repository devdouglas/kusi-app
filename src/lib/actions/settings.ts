"use server";

import { revalidatePath } from "next/cache";
import { getSettings, updateExchangeRate } from "@/lib/settings";

export async function getSettingsAction() {
  return getSettings();
}

export async function updateExchangeRateAction(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Exchange rate must be a positive number.");
  }
  const settings = await updateExchangeRate(rate);
  revalidatePath("/settings");
  return settings;
}
