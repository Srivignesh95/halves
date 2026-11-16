// The monthly spending report, as pure maths so it can be tested without a database.
// Everything is integer cents, kept separate per currency.

import { allocate } from "./splits";

export type ReportExpense = {
  amountCents: number; // full amount paid
  /** what counts as your spending: your share when split on Halves, else the full amount */
  myShareCents: number;
  currency: string;
  category: string;
  /** receipt lines with their own category; the share is spread over them in proportion */
  items?: { amountCents: number; category: string }[];
  /** null when not recorded */
  paymentMethodId: string | null;
  isEmi: boolean;
  splitOnHalves: boolean;
};

/** Your share of a Halves expense that wasn't entered through My Money (e.g. a friend added it). */
export type HalvesShare = { owedCents: number; paidCents: number; currency: string; category: string };

export type CurrencyReport = {
  currency: string;
  totalCents: number;
  byCategory: [string, number][]; // largest first
  /** full amounts charged, per payment method id ("" = not recorded) */
  byPayment: { id: string; cents: number; count: number }[];
  topCard: { id: string; cents: number; count: number } | null;
  emiCents: number;
  emiCount: number;
  halvesShareCents: number; // your share of everything split on Halves
};

/** Spread `cents` over item categories in proportion to the item amounts. */
export function spreadOverItems(cents: number, items: { amountCents: number; category: string }[] | undefined, fallback: string): [string, number][] {
  const usable = (items ?? []).filter((i) => i.amountCents > 0);
  if (usable.length === 0 || cents === 0) return [[fallback, cents]];
  const parts = allocate(cents, usable.map((i) => i.amountCents));
  const m = new Map<string, number>();
  usable.forEach((it, n) => m.set(it.category, (m.get(it.category) ?? 0) + parts[n]));
  return [...m.entries()];
}

export function buildReport(expenses: ReportExpense[], halves: HalvesShare[], cardIds: Set<string>): CurrencyReport[] {
  const per = new Map<string, {
    total: number; cats: Map<string, number>; pay: Map<string, { cents: number; count: number }>; emi: number; emiCount: number; halves: number;
  }>();
  const bucket = (c: string) => {
    let b = per.get(c);
    if (!b) per.set(c, (b = { total: 0, cats: new Map(), pay: new Map(), emi: 0, emiCount: 0, halves: 0 }));
    return b;
  };
  for (const e of expenses) {
    const b = bucket(e.currency);
    b.total += e.myShareCents;
    for (const [cat, v] of spreadOverItems(e.myShareCents, e.items, e.category)) b.cats.set(cat, (b.cats.get(cat) ?? 0) + v);
    const pid = e.paymentMethodId ?? "";
    const p = b.pay.get(pid) ?? { cents: 0, count: 0 };
    p.cents += e.amountCents;
    p.count += 1;
    b.pay.set(pid, p);
    if (e.isEmi) { b.emi += e.myShareCents; b.emiCount += 1; }
    if (e.splitOnHalves) b.halves += e.myShareCents;
  }
  for (const h of halves) {
    if (h.owedCents <= 0) continue;
    const b = bucket(h.currency);
    b.total += h.owedCents;
    b.cats.set(h.category, (b.cats.get(h.category) ?? 0) + h.owedCents);
    b.halves += h.owedCents;
  }
  const out: CurrencyReport[] = [];
  for (const [currency, b] of per) {
    if (b.total === 0 && b.pay.size === 0) continue;
    const byPayment = [...b.pay.entries()].map(([id, v]) => ({ id, ...v })).sort((x, y) => y.cents - x.cents || y.count - x.count);
    const topCard = byPayment.find((p) => cardIds.has(p.id)) ?? null;
    out.push({
      currency,
      totalCents: b.total,
      byCategory: [...b.cats.entries()].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]),
      byPayment,
      topCard,
      emiCents: b.emi,
      emiCount: b.emiCount,
      halvesShareCents: b.halves,
    });
  }
  return out.sort((a, b) => a.currency.localeCompare(b.currency));
}

/** "2026-10" -> first day and first day of the next month, as UTC dates. */
export function monthRange(month: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return null;
  return { from: new Date(Date.UTC(y, mo, 1)), to: new Date(Date.UTC(y, mo + 1, 1)) };
}

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function previousMonth(d: Date): string {
  return monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
}

export function shiftMonth(month: string, by: number): string {
  const r = monthRange(month)!;
  return monthKey(new Date(Date.UTC(r.from.getUTCFullYear(), r.from.getUTCMonth() + by, 1)));
}

export function monthLabel(month: string, style: "long" | "short" = "long"): string {
  const r = monthRange(month);
  return r ? r.from.toLocaleDateString("en-CA", { month: style, year: "numeric", timeZone: "UTC" }) : month;
}
