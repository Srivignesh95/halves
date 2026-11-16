import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { assertUuid } from "@/lib/access";
import { db, personalExpenseItems, personalExpenses } from "@/lib/db";
import { moneyOptions } from "@/lib/money-data";
import { paymentLabel } from "@/lib/money-categories";
import { savePersonalExpense } from "@/app/actions/money";
import { MoneyForm } from "@/components/money-form";
import { PageHeader } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { toISODate } from "@/lib/dates";

export const metadata = { title: "Edit expense" };

export default async function EditMoneyExpense({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  assertUuid(id);
  const e = await db.query.personalExpenses.findFirst({
    where: and(eq(personalExpenses.id, id), eq(personalExpenses.userId, me.id)),
    with: { items: { orderBy: asc(personalExpenseItems.position) }, paymentMethod: true },
  });
  if (!e) notFound();
  const { payments, customCategories } = await moneyOptions(me.id);
  // a removed card still shows on its old expenses
  if (e.paymentMethod && !payments.some((p) => p.id === e.paymentMethod!.id)) {
    const m = e.paymentMethod;
    payments.push({ id: m.id, kind: m.kind, label: m.label, last4: m.last4, name: paymentLabel(m) });
  }
  return (
    <>
      <PageHeader title="Edit expense" sub={e.halvesExpenseId ? "The split itself is changed on Halves." : undefined} />
      <div className="max-w-2xl">
        <MoneyForm
          action={savePersonalExpense}
          me={{ id: me.id, name: me.name }}
          groups={[]}
          friends={[]}
          payments={payments}
          customCategories={customCategories}
          initial={{
            id: e.id,
            description: e.description,
            amount: centsToInput(e.amountCents),
            currency: e.currency,
            date: toISODate(e.date),
            category: e.category,
            notes: e.notes ?? "",
            paymentId: e.paymentMethodId ?? "",
            items: e.items.map((it) => ({ name: it.name, amount: centsToInput(it.amountCents), category: it.category })),
            linked: !!e.halvesExpenseId,
          }}
        />
      </div>
    </>
  );
}
