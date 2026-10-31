import { timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lte, ne } from "drizzle-orm";
import { db, expenses, expenseShares } from "@/lib/db";
import { fromISODate, nextOccurrence, todayISO } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** Copies every due recurring expense. Safe to run twice: each copy is claimed by moving nextOccursOn first. */
export async function GET(req: Request) {
  if (!authorised(req)) return new Response("Unauthorized", { status: 401 });
  const today = fromISODate(todayISO())!;
  const due = await db.query.expenses.findMany({
    where: and(isNull(expenses.deletedAt), ne(expenses.recurrence, "none"), lte(expenses.nextOccursOn, today)),
    with: { shares: true },
    limit: 500,
  });
  let created = 0;
  for (const t of due) {
    let occurs = t.nextOccursOn!;
    for (let i = 0; i < 24 && occurs <= today; i++) {
      const next = nextOccurrence(occurs, t.recurrence, t.date.getUTCDate());
      const made = await db.transaction(async (tx) => {
        const claim = await tx.update(expenses).set({ nextOccursOn: next }).where(and(eq(expenses.id, t.id), eq(expenses.nextOccursOn, occurs))).returning({ id: expenses.id });
        if (claim.length !== 1) return false;
        const [copy] = await tx
          .insert(expenses)
          .values({ groupId: t.groupId, description: t.description, amountCents: t.amountCents, currency: t.currency, date: occurs, category: t.category, splitType: t.splitType, notes: t.notes, createdById: t.createdById })
          .returning({ id: expenses.id });
        await tx.insert(expenseShares).values(t.shares.map((s) => ({ expenseId: copy.id, userId: s.userId, paidCents: s.paidCents, owedCents: s.owedCents, splitInput: s.splitInput })));
        await logActivity(tx, { type: "expense_added", actorId: t.createdById, userIds: t.shares.map((s) => s.userId), groupId: t.groupId, expenseId: copy.id, summary: `Repeating expense "${t.description}" (${formatMoney(t.amountCents, t.currency)}) was added` });
        return true;
      });
      if (!made) break;
      created++;
      if (!next) break;
      occurs = next;
    }
  }
  return Response.json({ checked: due.length, created });
}
