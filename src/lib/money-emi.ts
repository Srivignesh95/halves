import "server-only";
import { and, eq, isNull, lte, type SQL } from "drizzle-orm";
import { db, emis, personalExpenses } from "./db";
import { fromISODate, nextOccurrence, todayISO } from "./dates";

/**
 * Turns every due EMI payment into a personal expense. Safe to run twice: each payment is claimed by
 * moving nextDueOn first. Catches up at most 24 missed payments per EMI per run.
 */
export async function runDueEmis(userId?: string): Promise<number> {
  const today = fromISODate(todayISO())!;
  const where: SQL[] = [isNull(emis.stoppedAt), lte(emis.nextDueOn, today)];
  if (userId) where.push(eq(emis.userId, userId));
  const due = await db.select().from(emis).where(and(...where)).limit(1000);
  let created = 0;
  for (const e of due) {
    let occurs = e.nextDueOn!;
    let left = e.paymentsLeft;
    for (let i = 0; i < 24 && occurs <= today && (left === null || left > 0); i++) {
      const next = nextOccurrence(occurs, e.frequency, e.startsOn.getUTCDate());
      const nextLeft = left === null ? null : left - 1;
      const finished = nextLeft === 0;
      const made = await db.transaction(async (tx) => {
        const claim = await tx
          .update(emis)
          .set({ nextDueOn: finished ? null : next, paymentsLeft: nextLeft, stoppedAt: finished ? new Date() : null })
          .where(and(eq(emis.id, e.id), eq(emis.nextDueOn, occurs), isNull(emis.stoppedAt)))
          .returning({ id: emis.id });
        if (claim.length !== 1) return false;
        await tx.insert(personalExpenses).values({
          userId: e.userId,
          description: e.lender ? `${e.name} (${e.lender})` : e.name,
          amountCents: e.amountCents,
          currency: e.currency,
          date: occurs,
          category: e.category,
          paymentMethodId: e.paymentMethodId,
          emiId: e.id,
          notes: nextLeft === null ? null : nextLeft === 0 ? "Last payment" : `${nextLeft} payment${nextLeft === 1 ? "" : "s"} left after this`,
        });
        return true;
      });
      if (!made) break;
      created++;
      if (finished || !next) break;
      occurs = next;
      left = nextLeft;
    }
  }
  return created;
}
