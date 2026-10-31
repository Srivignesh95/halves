import { describe, expect, it } from "vitest";
import { parseMoney } from "@/lib/money";
import { fromISODate, nextOccurrence, toISODate } from "@/lib/dates";

describe("parseMoney", () => {
  it.each([
    ["12", 1200], ["12.5", 1250], ["12.50", 1250], ["1,234.56", 123456], [".5", 50], ["$3", 300], ["0", 0],
  ])("%s -> %d", (s, c) => expect(parseMoney(s)).toBe(c));
  it.each(["", "abc", "1.234", "-5", "1e3", "10000000.01"])("rejects %s", (s) => expect(parseMoney(s)).toBeNull());
});

describe("dates", () => {
  it("rejects impossible dates", () => {
    expect(fromISODate("2026-02-30")).toBeNull();
    expect(fromISODate("2026-02-28")).not.toBeNull();
  });
  it("monthly clamps to month end and keeps the anchor", () => {
    const jan31 = fromISODate("2026-01-31")!;
    const feb = nextOccurrence(jan31, "monthly", 31)!;
    expect(toISODate(feb)).toBe("2026-02-28");
    expect(toISODate(nextOccurrence(feb, "monthly", 31)!)).toBe("2026-03-31");
  });
  it("weekly and fortnightly", () => {
    const d = fromISODate("2026-10-26")!;
    expect(toISODate(nextOccurrence(d, "weekly")!)).toBe("2026-11-02");
    expect(toISODate(nextOccurrence(d, "fortnightly")!)).toBe("2026-11-09");
  });
});
