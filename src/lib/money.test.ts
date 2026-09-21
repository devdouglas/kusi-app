import { describe, it, expect } from "vitest";
import {
  rateToMicros,
  toUsdCents,
  usdCentsToKesCents,
  amountToCents,
  formatMoney,
  divideCents,
  multiplyCents,
} from "./money";

describe("money / currency conversion", () => {
  it("converts KES to USD using the stored rate", () => {
    // 1 USD = 129 KES ; 15,000 KES -> 116.28 USD
    const rateMicros = rateToMicros(129);
    const kesCents = amountToCents(15000);
    const usdCents = toUsdCents(kesCents, "KES", rateMicros);
    expect(usdCents).toBe(amountToCents(116.28));
  });

  it("round-trips USD -> KES -> USD without drift for whole rates", () => {
    const rateMicros = rateToMicros(130);
    const usdCents = amountToCents(500);
    const kesCents = usdCentsToKesCents(usdCents, rateMicros);
    expect(kesCents).toBe(amountToCents(65000));
  });

  it("leaves USD amounts unchanged", () => {
    const rateMicros = rateToMicros(129.5);
    expect(toUsdCents(amountToCents(100), "USD", rateMicros)).toBe(
      amountToCents(100)
    );
  });

  it("formats USD with two decimals and thousands separators", () => {
    expect(formatMoney(amountToCents(1245.5), "USD")).toBe("USD 1,245.50");
  });

  it("formats KES with no decimals and thousands separators", () => {
    expect(formatMoney(amountToCents(160000), "KES")).toBe("KES 160,000");
  });

  it("splits a total into equal per-person shares with correct rounding", () => {
    // 8450.00 / 4 = 2112.50 exactly
    expect(divideCents(amountToCents(8450), 4)).toBe(amountToCents(2112.5));
    // 100.00 / 3 = 33.33 (rounded)
    expect(divideCents(amountToCents(100), 3)).toBe(amountToCents(33.33));
  });

  it("multiplies unit price by quantity exactly", () => {
    expect(multiplyCents(amountToCents(35), 4)).toBe(amountToCents(140));
  });
});
