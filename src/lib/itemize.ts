// Split a receipt by item: each person pays for their items, plus their fair part of tax, tip and discounts.
// Everything is integer cents and the result always adds up exactly (largest-remainder rounding).

import { allocate } from "./splits";

export type ReceiptItem = {
  name: string;
  priceCents: number; // line total after any discount on that line
  taxed: boolean; // false = no tax on this line (e.g. basic groceries)
  taxCodes?: string[]; // which tax lines apply, when the receipt says (e.g. ["G"] but not ["P"])
  people: string[]; // who shares this item, split evenly
};
export type TaxLine = { label: string; code?: string; amountCents: number };
export type TipMode = "proportional" | "equal";

export type ItemizedInput = {
  items: ReceiptItem[];
  taxes: TaxLine[];
  tipCents: number;
  tipMode: TipMode;
  discountCents: number; // whole-bill discount, shared in proportion to what people ordered
};

export type ItemizedResult = {
  owed: Map<string, number>; // userId -> cents
  totalCents: number;
  subtotalCents: number;
  warnings: string[];
};

const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

/** Share `amount` across people in proportion to `weights` (person -> cents). Exact to the cent. */
function shareByWeight(amount: number, weights: Map<string, number>, order: string[]): Map<string, number> {
  const people = order.filter((p) => (weights.get(p) ?? 0) > 0);
  const out = new Map<string, number>();
  if (amount === 0 || people.length === 0) return out;
  allocate(amount, people.map((p) => weights.get(p)!)).forEach((c, i) => out.set(people[i], c));
  return out;
}

/** Does tax line `t` apply to `item`? Codes win when both sides have them; otherwise the taxed toggle decides. */
function taxApplies(item: ReceiptItem, t: TaxLine) {
  if (!item.taxed) return false;
  if (t.code && item.taxCodes && item.taxCodes.length > 0) return item.taxCodes.map((c) => c.toUpperCase()).includes(t.code.toUpperCase());
  return true;
}

export function splitByItem(input: ItemizedInput): ItemizedResult {
  const warnings: string[] = [];
  const order: string[] = [];
  const seen = (p: string) => { if (!order.includes(p)) order.push(p); };
  input.items.forEach((it) => it.people.forEach(seen));

  // 1. items, each split evenly between the people on it
  const base = new Map<string, number>(); // what each person ordered, before tax/tip/discount
  const perItem: Map<string, number>[] = [];
  for (const it of input.items) {
    const share = new Map<string, number>();
    if (it.priceCents < 0) throw new Error(`"${it.name}" has a negative price`);
    if (it.priceCents > 0 && it.people.length === 0) throw new Error(`Pick who had "${it.name}"`);
    if (it.people.length) allocate(it.priceCents, it.people.map(() => 1)).forEach((c, i) => share.set(it.people[i], c));
    perItem.push(share);
    for (const [p, c] of share) add(base, p, c);
  }
  const subtotal = [...base.values()].reduce((a, b) => a + b, 0);
  const owed = new Map(base);

  // 2. whole-bill discount, in proportion to what each person ordered
  if (input.discountCents > 0) {
    const d = shareByWeight(Math.min(input.discountCents, subtotal), base, order);
    for (const [p, c] of d) add(owed, p, -c);
  }

  // 3. each tax line over only the items it applies to
  for (const t of input.taxes) {
    if (t.amountCents <= 0) continue;
    const taxable = new Map<string, number>();
    input.items.forEach((it, i) => { if (taxApplies(it, t)) for (const [p, c] of perItem[i]) add(taxable, p, c); });
    let weights = taxable;
    if ([...taxable.values()].every((v) => v === 0)) {
      warnings.push(`No item is marked as taxed for "${t.label}", so it was shared across everything.`);
      weights = base;
    }
    for (const [p, c] of shareByWeight(t.amountCents, weights, order)) add(owed, p, c);
  }

  // 4. tip: by what people ordered, or equally
  if (input.tipCents > 0) {
    const w = input.tipMode === "equal" ? new Map(order.map((p) => [p, 1])) : base;
    for (const [p, c] of shareByWeight(input.tipCents, w, order)) add(owed, p, c);
  }

  for (const [p, c] of owed) if (c === 0) owed.delete(p);
  const total = [...owed.values()].reduce((a, b) => a + b, 0);
  return { owed, totalCents: total, subtotalCents: subtotal, warnings };
}
