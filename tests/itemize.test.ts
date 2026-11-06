import { describe, expect, it } from "vitest";
import { splitByItem } from "@/lib/itemize";

const obj = (m: Map<string, number>) => Object.fromEntries(m);

describe("splitByItem", () => {
  it("the Ontario example: tax only on taxed items, shared bread untaxed", () => {
    const r = splitByItem({
      items: [
        { name: "Pasta", priceCents: 1800, taxed: true, people: ["vicky"] },
        { name: "Bread", priceCents: 400, taxed: false, people: ["vicky", "sam"] },
        { name: "Wine", priceCents: 2000, taxed: true, people: ["sam"] },
      ],
      taxes: [{ label: "HST", code: "H", amountCents: 494 }],
      tipCents: 0, tipMode: "proportional", discountCents: 0,
    });
    expect(obj(r.owed)).toEqual({ vicky: 2234, sam: 2460 });
    expect(r.totalCents).toBe(4694);
  });

  it("no tax on the receipt: everyone pays just their items", () => {
    const r = splitByItem({
      items: [
        { name: "Milk", priceCents: 529, taxed: false, people: ["a"] },
        { name: "Eggs", priceCents: 649, taxed: false, people: ["b"] },
      ],
      taxes: [], tipCents: 0, tipMode: "proportional", discountCents: 0,
    });
    expect(obj(r.owed)).toEqual({ a: 529, b: 649 });
  });

  it("BC-style GST + PST: PST only on the item that carries it", () => {
    const r = splitByItem({
      items: [
        { name: "Restaurant meal", priceCents: 2000, taxed: true, taxCodes: ["G"], people: ["a"] },
        { name: "Beer", priceCents: 1000, taxed: true, taxCodes: ["G", "P"], people: ["b"] },
      ],
      taxes: [
        { label: "GST", code: "G", amountCents: 150 },
        { label: "PST", code: "P", amountCents: 100 },
      ],
      tipCents: 0, tipMode: "proportional", discountCents: 0,
    });
    // GST 150 split 2000:1000 = 100/50; PST only on beer = 100
    expect(obj(r.owed)).toEqual({ a: 2100, b: 1150 });
  });

  it("tip by what people ordered vs equally", () => {
    const items = [
      { name: "Steak", priceCents: 3000, taxed: false, people: ["a"] },
      { name: "Salad", priceCents: 1000, taxed: false, people: ["b"] },
    ];
    expect(obj(splitByItem({ items, taxes: [], tipCents: 800, tipMode: "proportional", discountCents: 0 }).owed)).toEqual({ a: 3600, b: 1200 });
    expect(obj(splitByItem({ items, taxes: [], tipCents: 800, tipMode: "equal", discountCents: 0 }).owed)).toEqual({ a: 3400, b: 1400 });
  });

  it("whole-bill discount comes off in proportion", () => {
    const r = splitByItem({
      items: [
        { name: "A", priceCents: 3000, taxed: false, people: ["a"] },
        { name: "B", priceCents: 1000, taxed: false, people: ["b"] },
      ],
      taxes: [], tipCents: 0, tipMode: "proportional", discountCents: 400,
    });
    expect(obj(r.owed)).toEqual({ a: 2700, b: 900 });
  });

  it("odd cents always add up exactly, even with three-way shared items", () => {
    for (let tax = 0; tax < 300; tax += 7) {
      const r = splitByItem({
        items: [
          { name: "Pizza", priceCents: 2399, taxed: true, people: ["a", "b", "c"] },
          { name: "Pop", priceCents: 299, taxed: true, people: ["a"] },
          { name: "Chips", priceCents: 101, taxed: false, people: ["b", "c"] },
        ],
        taxes: [{ label: "HST", amountCents: tax }],
        tipCents: 333, tipMode: "proportional", discountCents: 0,
      });
      expect(r.totalCents).toBe(2399 + 299 + 101 + tax + 333);
    }
  });

  it("tax with no taxed items falls back to everything and says so", () => {
    const r = splitByItem({
      items: [{ name: "A", priceCents: 1000, taxed: false, people: ["a"] }],
      taxes: [{ label: "HST", amountCents: 130 }],
      tipCents: 0, tipMode: "proportional", discountCents: 0,
    });
    expect(r.totalCents).toBe(1130);
    expect(r.warnings[0]).toMatch(/No item is marked as taxed/);
  });

  it("an item with a price but nobody on it is an error", () => {
    expect(() => splitByItem({ items: [{ name: "Mystery", priceCents: 500, taxed: false, people: [] }], taxes: [], tipCents: 0, tipMode: "equal", discountCents: 0 })).toThrow(/Pick who had/);
  });
});
