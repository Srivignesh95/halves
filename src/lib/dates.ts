// Calendar dates as "YYYY-MM-DD" strings in UTC so a date never shifts a day.

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromISODate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || toISODate(d) !== s ? null : d;
}

export type Recurrence = "none" | "weekly" | "fortnightly" | "monthly" | "yearly";

/** Next occurrence. Monthly and yearly keep the anchor day, clamped to the month end (Jan 31 -> Feb 28 -> Mar 31). */
export function nextOccurrence(from: Date, r: Recurrence, anchorDay = from.getUTCDate()): Date | null {
  const d = new Date(from);
  switch (r) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      return d;
    case "fortnightly":
      d.setUTCDate(d.getUTCDate() + 14);
      return d;
    case "monthly":
    case "yearly": {
      const y = d.getUTCFullYear() + (r === "yearly" ? 1 : 0);
      const m = d.getUTCMonth() + (r === "monthly" ? 1 : 0);
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      return new Date(Date.UTC(y, m, Math.min(anchorDay, last)));
    }
    default:
      return null;
  }
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
