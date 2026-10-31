import { describe, expect, it } from "vitest";
import { allocate, buildShares, computeOwed, SplitError } from "@/lib/splits";

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${i}` }));

describe("allocate", () => {
  it("splits 10.00 three ways as 3.34 / 3.33 / 3.33", () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
  });
  it("always sums to the amount", () => {
    for (let amount = 0; amount < 500; amount += 7) {
      for (const w of [[1, 2, 3], [5, 5], [1, 0, 1], [3333, 3333, 3334], [7]]) {
        expect(allocate(amount, w).reduce((a, b) => a + b, 0)).toBe(amount);
      }
    }
  });
  it("never gives remainder cents to a zero weight", () => {
    expect(allocate(1, [0, 1])).toEqual([0, 1]);
  });
  it("rejects an all-zero split", () => {
    expect(() => allocate(100, [0, 0])).toThrow(SplitError);
  });
});

describe("computeOwed", () => {
  it("equal", () => {
    expect(computeOwed(1001, "equal", ids(2)).map((r) => r.owedCents)).toEqual([501, 500]);
  });
  it("exact must add up", () => {
    expect(() => computeOwed(1000, "exact", [{ userId: "a", value: 400 }, { userId: "b", value: 500 }])).toThrow(/short/);
    expect(() => computeOwed(1000, "exact", [{ userId: "a", value: 600 }, { userId: "b", value: 500 }])).toThrow(/over/);
    expect(computeOwed(1000, "exact", [{ userId: "a", value: 400 }, { userId: "b", value: 600 }]).map((r) => r.owedCents)).toEqual([400, 600]);
  });
  it("percent must be 100", () => {
    expect(() => computeOwed(1000, "percent", [{ userId: "a", value: 50 }, { userId: "b", value: 40 }])).toThrow(/90.00%/);
    expect(computeOwed(1000, "percent", [{ userId: "a", value: 33.33 }, { userId: "b", value: 33.33 }, { userId: "c", value: 33.34 }]).map((r) => r.owedCents)).toEqual([333, 333, 334]);
  });
  it("shares", () => {
    expect(computeOwed(9000, "shares", [{ userId: "a", value: 2 }, { userId: "b", value: 1 }]).map((r) => r.owedCents)).toEqual([6000, 3000]);
  });
  it("rejects duplicates and empty", () => {
    expect(() => computeOwed(100, "equal", [])).toThrow(SplitError);
    expect(() => computeOwed(100, "equal", [{ userId: "a" }, { userId: "a" }])).toThrow(/twice/);
  });
});

describe("buildShares", () => {
  it("merges payer and owed rows", () => {
    const owed = computeOwed(3000, "equal", ids(3));
    expect(buildShares(3000, [{ userId: "u0", paidCents: 3000 }], owed)).toEqual([
      { userId: "u0", paidCents: 3000, owedCents: 1000 },
      { userId: "u1", paidCents: 0, owedCents: 1000 },
      { userId: "u2", paidCents: 0, owedCents: 1000 },
    ]);
  });
  it("multi-payer must add up", () => {
    const owed = computeOwed(3000, "equal", ids(3));
    expect(() => buildShares(3000, [{ userId: "u0", paidCents: 1000 }, { userId: "u1", paidCents: 1000 }], owed)).toThrow(/Payers/);
  });
});
