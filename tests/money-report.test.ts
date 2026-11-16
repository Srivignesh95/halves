import { describe, expect, it } from "vitest";
import { buildReport, monthRange, previousMonth, shiftMonth, spreadOverItems, toSlices, type ReportExpense } from "@/lib/money-report";
import { fromHalvesCategory, isCustomKey, moneyCategoryLabel, paymentLabel, toHalvesCategory } from "@/lib/money-categories";

const exp = (o: Partial<ReportExpense>): ReportExpense => ({
  amountCents: 1000, myShareCents: 1000, currency: "CAD", category: "other", paymentMethodId: null, isEmi: false, splitOnHalves: false, ...o,
});

describe("spreadOverItems", () => {
  it("puts everything in the fallback category when there are no items", () => {
    expect(spreadOverItems(1234, [], "dining")).toEqual([["dining", 1234]]);
  });
  it("spreads tax over item categories in proportion, to the cent", () => {
    // 10 groceries + 5 shopping, total 16.95 with tax
    const r = new Map(spreadOverItems(1695, [{ amountCents: 1000, category: "groceries" }, { amountCents: 500, category: "shopping" }], "other"));
    expect(r.get("groceries")).toBe(1130);
    expect(r.get("shopping")).toBe(565);
  });
  it("merges items with the same category and always sums to the amount", () => {
    const parts = spreadOverItems(999, [{ amountCents: 333, category: "a" }, { amountCents: 333, category: "b" }, { amountCents: 334, category: "a" }], "x");
    expect(parts.reduce((s, [, v]) => s + v, 0)).toBe(999);
    expect(parts.length).toBe(2);
  });
  it("ignores zero-priced items", () => {
    expect(spreadOverItems(500, [{ amountCents: 0, category: "a" }], "fallback")).toEqual([["fallback", 500]]);
  });
});

describe("buildReport", () => {
  const cards = new Set(["visa", "amex"]);

  it("keeps currencies apart", () => {
    const r = buildReport([exp({ currency: "CAD", myShareCents: 1000 }), exp({ currency: "INR", myShareCents: 50000, amountCents: 50000 })], [], cards);
    expect(r.map((c) => [c.currency, c.totalCents])).toEqual([["CAD", 1000], ["INR", 50000]]);
  });

  it("counts only your share for split expenses, but the full amount against the card", () => {
    const r = buildReport([exp({ amountCents: 6000, myShareCents: 2000, paymentMethodId: "visa", splitOnHalves: true })], [], cards)[0];
    expect(r.totalCents).toBe(2000);
    expect(r.halvesShareCents).toBe(2000);
    expect(r.byPayment).toEqual([{ id: "visa", cents: 6000, count: 1 }]);
  });

  it("adds your share of Halves expenses other people entered", () => {
    const r = buildReport([], [{ owedCents: 1500, paidCents: 0, currency: "CAD", category: "dining" }], cards)[0];
    expect(r.totalCents).toBe(1500);
    expect(r.byCategory).toEqual([["dining", 1500]]);
    expect(r.byPayment).toEqual([]);
    expect(r.topCard).toBeNull();
  });

  it("picks the card with the most money on it, ignoring cash and UPI", () => {
    const r = buildReport([
      exp({ amountCents: 9000, myShareCents: 9000, paymentMethodId: "cash" }),
      exp({ amountCents: 3000, myShareCents: 3000, paymentMethodId: "visa" }),
      exp({ amountCents: 2000, myShareCents: 2000, paymentMethodId: "visa" }),
      exp({ amountCents: 4000, myShareCents: 4000, paymentMethodId: "amex" }),
    ], [], cards)[0];
    expect(r.byPayment[0].id).toBe("cash");
    expect(r.topCard).toEqual({ id: "visa", cents: 5000, count: 2 });
  });

  it("counts EMIs in the total and on their own", () => {
    const r = buildReport([exp({ myShareCents: 25000, amountCents: 25000, isEmi: true, category: "emi" }), exp({ myShareCents: 1000 })], [], cards)[0];
    expect(r.totalCents).toBe(26000);
    expect(r.emiCents).toBe(25000);
    expect(r.emiCount).toBe(1);
    expect(r.byCategory[0]).toEqual(["emi", 25000]);
  });

  it("sorts categories largest first and sums to the total", () => {
    const r = buildReport([
      exp({ myShareCents: 1695, amountCents: 1695, items: [{ amountCents: 1000, category: "groceries" }, { amountCents: 500, category: "shopping" }] }),
      exp({ myShareCents: 3000, amountCents: 3000, category: "dining" }),
    ], [], cards)[0];
    expect(r.byCategory.map(([k]) => k)).toEqual(["dining", "groceries", "shopping"]);
    expect(r.byCategory.reduce((s, [, v]) => s + v, 0)).toBe(r.totalCents);
  });
});

describe("months", () => {
  it("gives the first days of the month and the next", () => {
    const r = monthRange("2026-12")!;
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-12-01");
    expect(r.to.toISOString().slice(0, 10)).toBe("2027-01-01");
  });
  it("rejects nonsense", () => {
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("abc")).toBeNull();
  });
  it("steps across year ends", () => {
    expect(previousMonth(new Date("2027-01-01T06:00:00Z"))).toBe("2026-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("categories and payment names", () => {
  it("maps Halves categories both ways", () => {
    expect(fromHalvesCategory("food")).toBe("dining");
    expect(fromHalvesCategory("utilities")).toBe("bills");
    expect(fromHalvesCategory("unknown")).toBe("other");
    expect(toHalvesCategory("fuel")).toBe("transport");
    expect(toHalvesCategory("dining")).toBe("food");
  });
  it("labels custom categories", () => {
    const key = "c:0b8f6c0e-6d6a-4c39-9a53-5e1b1d2f3a4b";
    expect(isCustomKey(key)).toBe(true);
    expect(moneyCategoryLabel(key, new Map([[key, "Pets"]]))).toBe("Pets");
    expect(moneyCategoryLabel("dining")).toBe("Dining");
  });
  it("names a card with its last 4 digits", () => {
    expect(paymentLabel({ kind: "credit_card", label: "Visa", last4: "1234" })).toBe("Visa ••1234");
    expect(paymentLabel({ kind: "cash", label: "Cash", last4: null })).toBe("Cash");
  });
});

describe("toSlices", () => {
  const name = (k: string) => k.toUpperCase();
  it("keeps up to six categories as they are, largest first", () => {
    const s = toSlices([["a", 100], ["b", 300], ["c", 200]], name);
    expect(s.map((x) => x.key)).toEqual(["b", "c", "a"]);
    expect(s[0].label).toBe("B");
  });
  it("folds everything past the fifth into Other when there are more than six", () => {
    const rows: [string, number][] = [["a", 70], ["b", 60], ["c", 50], ["d", 40], ["e", 30], ["f", 20], ["g", 10]];
    const s = toSlices(rows, name);
    expect(s).toHaveLength(6);
    expect(s[5]).toEqual({ key: "__other", label: "Other (2 categories)", cents: 30 });
    expect(s.reduce((t, x) => t + x.cents, 0)).toBe(280);
  });
  it("drops empty categories", () => {
    expect(toSlices([["a", 0], ["b", 5]], name).map((x) => x.key)).toEqual(["b"]);
  });
});
