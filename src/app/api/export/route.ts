import { currentUser } from "@/lib/auth";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, expenses, expenseShares } from "@/lib/db";
import { expensesWithShareFor } from "@/lib/data";
import { toISODate } from "@/lib/dates";

const cell = (v: string | number) => {
  const s = String(v);
  // quote, and neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET() {
  const me = await currentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const rows = await db.query.expenses.findMany({
    where: and(isNull(expenses.deletedAt), expensesWithShareFor(me.id)),
    orderBy: asc(expenses.date),
    with: { group: { columns: { name: true } }, shares: { where: eq(expenseShares.userId, me.id) } },
  });
  const lines = [["date", "description", "category", "group", "currency", "total", "you_paid", "your_share", "your_net", "type"].join(",")];
  for (const e of rows) {
    const s = e.shares[0];
    lines.push(
      [toISODate(e.date), e.description, e.category, e.group?.name ?? "", e.currency, (e.amountCents / 100).toFixed(2), (s.paidCents / 100).toFixed(2), (s.owedCents / 100).toFixed(2), ((s.paidCents - s.owedCents) / 100).toFixed(2), e.isPayment ? "payment" : "expense"]
        .map(cell)
        .join(","),
    );
  }
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="halves-${toISODate(new Date())}.csv"` },
  });
}
