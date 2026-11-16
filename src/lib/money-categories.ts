// Spending categories for My Money. Standard keys are fixed; a person's own ones are stored as "c:<id>".

export const MONEY_CATEGORIES = [
  ["groceries", "Groceries"],
  ["dining", "Dining"],
  ["transport", "Transport"],
  ["fuel", "Fuel"],
  ["shopping", "Shopping"],
  ["bills", "Bills and utilities"],
  ["rent", "Rent"],
  ["emi", "EMI"],
  ["entertainment", "Entertainment"],
  ["health", "Health"],
  ["travel", "Travel"],
  ["other", "Other"],
] as const;

export type StandardCategory = (typeof MONEY_CATEGORIES)[number][0];
export const STANDARD_KEYS = MONEY_CATEGORIES.map(([k]) => k) as readonly string[];

export const customKey = (id: string) => `c:${id}`;
export const isCustomKey = (k: string) => /^c:[0-9a-f-]{36}$/i.test(k);

/** Label for a category key. `custom` maps custom keys to their names. */
export function moneyCategoryLabel(key: string, custom: Map<string, string> = new Map()): string {
  return MONEY_CATEGORIES.find(([k]) => k === key)?.[1] ?? custom.get(key) ?? "Other";
}

// Halves' own categories, mapped both ways.
const FROM_HALVES: Record<string, StandardCategory> = {
  general: "other", food: "dining", groceries: "groceries", rent: "rent", utilities: "bills", transport: "transport",
  travel: "travel", entertainment: "entertainment", household: "shopping", gifts: "shopping", other: "other",
};
const TO_HALVES: Record<string, string> = {
  groceries: "groceries", dining: "food", transport: "transport", fuel: "transport", shopping: "household", bills: "utilities",
  rent: "rent", emi: "general", entertainment: "entertainment", health: "general", travel: "travel", other: "other",
};
export const fromHalvesCategory = (c: string): StandardCategory => FROM_HALVES[c] ?? "other";
export const toHalvesCategory = (c: string): string => TO_HALVES[c] ?? "general";

export const PAYMENT_KINDS = [
  ["credit_card", "Credit card"],
  ["debit_card", "Debit card"],
  ["upi", "UPI"],
  ["cash", "Cash"],
  ["bank_transfer", "Bank transfer"],
  ["other", "Other"],
] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number][0];
export const paymentKindLabel = (k: string) => PAYMENT_KINDS.find(([x]) => x === k)?.[1] ?? "Other";
export const isCard = (k: string) => k === "credit_card" || k === "debit_card";

/** "Visa ••1234" style name for a payment method. */
export function paymentLabel(m: { kind: string; label: string; last4: string | null }): string {
  return m.last4 ? `${m.label} ••${m.last4}` : m.label;
}
