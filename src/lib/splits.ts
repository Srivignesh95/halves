// Turning an amount and a split into per-person owed cents.
// Deterministic: the same input always gives the same cents, in participant order.

export type SplitType = "equal" | "exact" | "percent" | "shares";

export class SplitError extends Error {}

/**
 * Largest-remainder allocation of `amount` cents by integer weights.
 * Sum of the result is exactly `amount`. Ties go to the earlier participant.
 */
export function allocate(amount: number, weights: number[]): number[] {
  if (!Number.isInteger(amount) || amount < 0) throw new SplitError("Amount must be whole cents");
  if (weights.some((w) => !Number.isInteger(w) || w < 0)) throw new SplitError("Weights must be whole, non-negative numbers");
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new SplitError("Nobody is in this split");
  const A = BigInt(amount);
  const T = BigInt(total);
  const base = weights.map((w) => (A * BigInt(w)) / T);
  const rems = weights.map((w, i) => ({ i, r: (A * BigInt(w)) % T }));
  let left = amount - base.reduce((a, b) => a + Number(b), 0);
  rems.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  const out = base.map(Number);
  for (const { i } of rems) {
    if (left <= 0) break;
    if (weights[i] === 0) continue;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

const SCALE = 10_000; // 4 decimal places for percent and shares input

function toScaled(v: number): number {
  if (!Number.isFinite(v) || v < 0) throw new SplitError("Values must be zero or more");
  return Math.round(v * SCALE);
}

export type Participant = {
  userId: string;
  /** exact: cents. percent: 0-100. shares: any non-negative number. Ignored for equal. */
  value?: number;
};

export function computeOwed(amount: number, type: SplitType, participants: Participant[]): { userId: string; owedCents: number }[] {
  if (participants.length === 0) throw new SplitError("Pick at least one person to split with");
  const ids = participants.map((p) => p.userId);
  if (new Set(ids).size !== ids.length) throw new SplitError("Someone is in the split twice");

  let owed: number[];
  switch (type) {
    case "equal":
      owed = allocate(amount, participants.map(() => 1));
      break;
    case "exact": {
      owed = participants.map((p) => {
        const v = p.value ?? 0;
        if (!Number.isInteger(v) || v < 0) throw new SplitError("Exact amounts must be whole cents");
        return v;
      });
      const sum = owed.reduce((a, b) => a + b, 0);
      if (sum !== amount) {
        const diff = amount - sum;
        throw new SplitError(
          diff > 0 ? `The split is ${(diff / 100).toFixed(2)} short of the total` : `The split is ${(-diff / 100).toFixed(2)} over the total`,
        );
      }
      break;
    }
    case "percent": {
      const w = participants.map((p) => toScaled(p.value ?? 0));
      const sum = w.reduce((a, b) => a + b, 0);
      if (sum !== 100 * SCALE) throw new SplitError(`Percentages add up to ${(sum / SCALE).toFixed(2)}%, not 100%`);
      owed = allocate(amount, w);
      break;
    }
    case "shares": {
      const w = participants.map((p) => toScaled(p.value ?? 0));
      if (w.reduce((a, b) => a + b, 0) === 0) throw new SplitError("Give at least one person a share");
      owed = allocate(amount, w);
      break;
    }
    default:
      throw new SplitError("Unknown split type");
  }
  return participants.map((p, i) => ({ userId: p.userId, owedCents: owed[i] }));
}

export type ShareRow = { userId: string; paidCents: number; owedCents: number };

/** Merge payers and owed shares into one row per person, and check the books balance. */
export function buildShares(amount: number, payers: { userId: string; paidCents: number }[], owed: { userId: string; owedCents: number }[]): ShareRow[] {
  const paidSum = payers.reduce((a, p) => a + p.paidCents, 0);
  if (payers.length === 0) throw new SplitError("Pick who paid");
  if (payers.some((p) => !Number.isInteger(p.paidCents) || p.paidCents < 0)) throw new SplitError("Paid amounts must be zero or more");
  if (paidSum !== amount) throw new SplitError(`Payers add up to ${(paidSum / 100).toFixed(2)}, not ${(amount / 100).toFixed(2)}`);
  const owedSum = owed.reduce((a, o) => a + o.owedCents, 0);
  if (owedSum !== amount) throw new SplitError("The split does not add up to the total");

  const rows = new Map<string, ShareRow>();
  const order: string[] = [];
  const row = (userId: string) => {
    let r = rows.get(userId);
    if (!r) {
      r = { userId, paidCents: 0, owedCents: 0 };
      rows.set(userId, r);
      order.push(userId);
    }
    return r;
  };
  for (const p of payers) row(p.userId).paidCents += p.paidCents;
  for (const o of owed) row(o.userId).owedCents += o.owedCents;
  return order.map((id) => rows.get(id)!).filter((r) => r.paidCents > 0 || r.owedCents > 0);
}
