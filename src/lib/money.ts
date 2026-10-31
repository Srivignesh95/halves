// Money helpers. Everything is integer cents; strings only at the edges.

export const CURRENCIES = [
  "CAD", "USD", "EUR", "GBP", "INR", "AUD", "NZD", "JPY", "CHF", "SGD", "AED", "MXN",
] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MAX_CENTS = 100_000_000; // 1,000,000.00 per expense

export function isCurrency(v: string): v is Currency {
  return (CURRENCIES as readonly string[]).includes(v);
}

/** "1,234.5" -> 123450. Returns null for anything that is not a positive-or-zero amount with at most 2 decimals. */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/[,\s]/g, "").replace(/^\$/, "");
  if (!/^\d+(\.\d{0,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
  return cents;
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** Plain decimal for form inputs: 123450 -> "1234.50" */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
