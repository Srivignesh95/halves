import { describe, expect, it } from "vitest";
import { balancesFor, groupDebts, netBalances, pairwiseDebts, settleNet, totals } from "@/lib/balances";

const exp = (currency: string, rows: [string, number, number][]) => ({
  currency,
  shares: rows.map(([userId, paidCents, owedCents]) => ({ userId, paidCents, owedCents })),
});

describe("balances", () => {
  // A paid 30 for A,B,C. B paid 30 for B,C. -> net A +20, B +10, C -30
  const expenses = [exp("CAD", [["A", 3000, 1000], ["B", 0, 1000], ["C", 0, 1000]]), exp("CAD", [["B", 3000, 1500], ["C", 0, 1500]])];

  it("nets per currency", () => {
    const n = netBalances(expenses).get("CAD")!;
    expect(Object.fromEntries(n)).toEqual({ A: 2000, B: 500, C: -2500 });
  });

  it("simplified debts preserve every net and use at most n-1 transfers", () => {
    const edges = groupDebts(expenses, true);
    expect(edges.length).toBeLessThanOrEqual(2);
    const n = new Map<string, number>();
    for (const e of edges) {
      n.set(e.to, (n.get(e.to) ?? 0) + e.amountCents);
      n.set(e.from, (n.get(e.from) ?? 0) - e.amountCents);
    }
    expect(Object.fromEntries(n)).toEqual({ A: 2000, B: 500, C: -2500 });
  });

  it("pairwise debts net out opposite directions", () => {
    // A pays 10 for B, B pays 4 for A -> B owes A 6
    const edges = pairwiseDebts([exp("CAD", [["A", 1000, 0], ["B", 0, 1000]]), exp("CAD", [["B", 400, 0], ["A", 0, 400]])]);
    expect(edges).toEqual([{ from: "B", to: "A", amountCents: 600, currency: "CAD" }]);
  });

  it("keeps currencies apart", () => {
    const edges = groupDebts([exp("CAD", [["A", 1000, 0], ["B", 0, 1000]]), exp("USD", [["B", 1000, 0], ["A", 0, 1000]])], true);
    const mine = balancesFor("A", edges);
    expect(Object.fromEntries(mine.get("B")!)).toEqual({ CAD: 1000, USD: -1000 });
    const t = totals(mine);
    expect(t.owed.get("CAD")).toBe(1000);
    expect(t.owe.get("USD")).toBe(1000);
  });

  it("a payment settles a debt to zero", () => {
    const edges = groupDebts([exp("CAD", [["A", 1000, 0], ["B", 0, 1000]]), exp("CAD", [["B", 1000, 0], ["A", 0, 1000]])], false);
    expect(edges).toEqual([]);
  });

  it("settleNet is deterministic", () => {
    const net = new Map([["x", 100], ["y", 100], ["z", -200]]);
    expect(settleNet(net, "CAD")).toEqual(settleNet(new Map([["y", 100], ["z", -200], ["x", 100]]), "CAD"));
  });
});
