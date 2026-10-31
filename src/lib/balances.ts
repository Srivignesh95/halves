// Who owes whom. `from` owes `to` `amountCents` in `currency`.

import type { ShareRow } from "./splits";

export type Edge = { from: string; to: string; amountCents: number; currency: string };
export type ExpenseLike = { currency: string; shares: ShareRow[] };

/** Net position per currency per user: positive = is owed money, negative = owes. */
export function netBalances(expenses: ExpenseLike[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const e of expenses) {
    let m = out.get(e.currency);
    if (!m) out.set(e.currency, (m = new Map()));
    for (const s of e.shares) m.set(s.userId, (m.get(s.userId) ?? 0) + s.paidCents - s.owedCents);
  }
  return out;
}

/**
 * Settle a set of net positions with as few transfers as greedy matching gives:
 * biggest debtor pays biggest creditor, repeat. At most n-1 transfers, nobody's net changes.
 */
export function settleNet(net: Map<string, number>, currency: string): Edge[] {
  const creditors: [string, number][] = [];
  const debtors: [string, number][] = [];
  for (const [id, v] of net) {
    if (v > 0) creditors.push([id, v]);
    else if (v < 0) debtors.push([id, -v]);
  }
  const byAmount = (a: [string, number], b: [string, number]) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1);
  const edges: Edge[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const c = creditors[0];
    const d = debtors[0];
    const x = Math.min(c[1], d[1]);
    edges.push({ from: d[0], to: c[0], amountCents: x, currency });
    c[1] -= x;
    d[1] -= x;
    if (c[1] === 0) creditors.shift();
    if (d[1] === 0) debtors.shift();
  }
  return edges;
}

/** Pairwise debts without simplification: each expense settled on its own, then netted per pair. */
export function pairwiseDebts(expenses: ExpenseLike[]): Edge[] {
  const pair = new Map<string, number>(); // key "currency|a|b" with a<b, value: positive = a owes b
  for (const e of expenses) {
    const net = new Map<string, number>();
    for (const s of e.shares) net.set(s.userId, (net.get(s.userId) ?? 0) + s.paidCents - s.owedCents);
    for (const edge of settleNet(net, e.currency)) {
      const [a, b] = edge.from < edge.to ? [edge.from, edge.to] : [edge.to, edge.from];
      const sign = edge.from === a ? 1 : -1;
      const key = `${e.currency}|${a}|${b}`;
      pair.set(key, (pair.get(key) ?? 0) + sign * edge.amountCents);
    }
  }
  const edges: Edge[] = [];
  for (const [key, v] of pair) {
    if (v === 0) continue;
    const [currency, a, b] = key.split("|");
    edges.push(v > 0 ? { from: a, to: b, amountCents: v, currency } : { from: b, to: a, amountCents: -v, currency });
  }
  return edges;
}

/** Debts inside one group, simplified or not. */
export function groupDebts(expenses: ExpenseLike[], simplify: boolean): Edge[] {
  if (!simplify) return pairwiseDebts(expenses);
  const edges: Edge[] = [];
  for (const [currency, net] of netBalances(expenses)) edges.push(...settleNet(net, currency));
  return edges;
}

/** From one person's point of view: per other person, per currency. Positive = they owe me. */
export function balancesFor(me: string, edges: Edge[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  const add = (other: string, currency: string, v: number) => {
    let m = out.get(other);
    if (!m) out.set(other, (m = new Map()));
    m.set(currency, (m.get(currency) ?? 0) + v);
  };
  for (const e of edges) {
    if (e.to === me) add(e.from, e.currency, e.amountCents);
    else if (e.from === me) add(e.to, e.currency, -e.amountCents);
  }
  for (const [other, m] of out) {
    for (const [c, v] of m) if (v === 0) m.delete(c);
    if (m.size === 0) out.delete(other);
  }
  return out;
}

/** Totals for the dashboard header, per currency. */
export function totals(perPerson: Map<string, Map<string, number>>) {
  const owed = new Map<string, number>();
  const owe = new Map<string, number>();
  for (const m of perPerson.values()) {
    for (const [c, v] of m) {
      if (v > 0) owed.set(c, (owed.get(c) ?? 0) + v);
      else owe.set(c, (owe.get(c) ?? 0) - v);
    }
  }
  return { owed, owe };
}
