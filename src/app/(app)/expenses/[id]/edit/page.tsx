import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db, expenses } from "@/lib/db";
import { assertUuid, canSeeExpense } from "@/lib/access";
import { expenseFormOptions } from "@/lib/form-options";
import { saveExpense } from "@/app/actions/expenses";
import { ExpenseForm } from "@/components/expense-form";
import { PageHeader } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { toISODate } from "@/lib/dates";

export const metadata = { title: "Edit expense" };

export default async function EditExpense({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  assertUuid(id);
  const e = await db.query.expenses.findFirst({ where: eq(expenses.id, id), with: { shares: { with: { user: { columns: { id: true, name: true } } } }, receipt: { columns: { createdAt: true } } } });
  if (!e || !(await canSeeExpense(e, me.id))) notFound();
  if (e.isPayment || e.deletedAt) redirect(`/expenses/${id}`);
  const { groups, friends } = await expenseFormOptions(me.id);
  // keep people who are on the expense even if no longer a friend, so editing never drops them silently
  const extra = e.shares.map((s) => s.user).filter((u) => u.id !== me.id && !friends.some((f) => f.id === u.id));
  const payers = e.shares.filter((s) => s.paidCents > 0);
  const valueFor = (s: (typeof e.shares)[number]) =>
    e.splitType === "exact" ? centsToInput(s.owedCents) : e.splitType === "percent" || e.splitType === "shares" ? String(Number(s.splitInput ?? 0)) : "";
  return (
    <>
      <PageHeader title="Edit expense" />
      <div className="max-w-2xl">
        <ExpenseForm
          action={saveExpense}
          me={{ id: me.id, name: me.name }}
          groups={groups}
          friends={[...friends, ...extra]}
          initial={{
            id: e.id,
            groupId: e.groupId,
            description: e.description,
            amount: centsToInput(e.amountCents),
            currency: e.currency,
            date: toISODate(e.date),
            category: e.category,
            notes: e.notes ?? "",
            recurrence: e.recurrence,
            splitType: e.splitType,
            payers: payers.map((s) => ({ userId: s.userId, amount: centsToInput(s.paidCents) })),
            receiptVersion: e.receipt ? e.receipt.createdAt.getTime() : undefined,
            participants: e.shares.filter((s) => s.owedCents > 0 || s.splitInput !== null).map((s) => ({ userId: s.userId, value: valueFor(s) })),
          }}
        />
      </div>
    </>
  );
}
