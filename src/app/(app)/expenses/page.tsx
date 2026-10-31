import { requireUser } from "@/lib/auth";
import { and, desc, ilike, inArray, isNull, or } from "drizzle-orm";
import { db, expenses as E } from "@/lib/db";
import { expenseListWith, expensesWithShareFor, groupsOf } from "@/lib/data";
import { ExpenseList } from "@/components/expense-list";
import { LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "All expenses" };

export default async function AllExpenses({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireUser();
  const q = (await searchParams).q?.trim().slice(0, 100) ?? "";
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const expenses = await db.query.expenses.findMany({
    where: and(
      isNull(E.deletedAt),
      or(expensesWithShareFor(me.id), inArray(E.groupId, groupsOf(me.id))),
      q ? or(ilike(E.description, like), ilike(E.notes, like)) : undefined,
    ),
    orderBy: [desc(E.date), desc(E.createdAt)],
    limit: 300,
    with: expenseListWith,
  });
  return (
    <>
      <PageHeader title="All expenses" actions={<><a href="/api/export" className="text-sm link self-center">Export CSV</a><LinkButton href="/expenses/new">Add an expense</LinkButton></>} />
      <form className="mb-4" role="search">
        <label htmlFor="q" className="sr-only">Search expenses</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search descriptions and notes" className="field" />
      </form>
      <ExpenseList expenses={expenses} me={me.id} showGroup empty={q ? `Nothing matches "${q}"` : "No expenses yet"} />
    </>
  );
}
