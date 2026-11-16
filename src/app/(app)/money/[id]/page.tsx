import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { assertUuid } from "@/lib/access";
import { db, personalExpenseItems, personalExpenses } from "@/lib/db";
import { customCategoryNames } from "@/lib/money-data";
import { moneyCategoryLabel, paymentKindLabel, paymentLabel } from "@/lib/money-categories";
import { deletePersonalExpense } from "@/app/actions/money";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "Expense" };

export default async function MoneyExpense({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  assertUuid(id);
  const e = await db.query.personalExpenses.findFirst({
    where: and(eq(personalExpenses.id, id), eq(personalExpenses.userId, me.id)),
    with: {
      paymentMethod: true,
      items: { orderBy: asc(personalExpenseItems.position) },
      halvesExpense: { columns: { id: true, deletedAt: true }, with: { shares: { columns: { userId: true, owedCents: true } } } },
      emi: { columns: { id: true, name: true } },
    },
  });
  if (!e) notFound();
  const custom = await customCategoryNames(me.id);
  const cat = (k: string) => moneyCategoryLabel(k, custom);
  const live = e.halvesExpense && !e.halvesExpense.deletedAt ? e.halvesExpense : null;
  const mine = live ? live.shares.find((s) => s.userId === me.id)?.owedCents ?? 0 : e.amountCents;

  return (
    <>
      <PageHeader
        title={e.description}
        sub={`${formatDate(e.date)} · ${cat(e.category)}`}
        actions={<>
          <LinkButton href={`/money/${e.id}/edit`} variant="secondary">Edit</LinkButton>
          <LinkButton href={`/money?month=${e.date.toISOString().slice(0, 7)}`} variant="ghost">Back to month</LinkButton>
        </>}
      />
      <div className="max-w-2xl space-y-6">
        <Card className="p-5">
          <p className="text-3xl font-extrabold tabular-nums">{formatMoney(e.amountCents, e.currency)}</p>
          {live && <p className="mt-1 text-sm text-muted">Your share: <strong className="text-text">{formatMoney(mine, e.currency)}</strong>. Only this counts as your spending.</p>}
          <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Paid with</dt>
            <dd>{e.paymentMethod ? `${paymentLabel(e.paymentMethod)} (${paymentKindLabel(e.paymentMethod.kind)})` : "Not recorded"}</dd>
            {e.emi && <><dt className="text-muted">EMI</dt><dd><Link className="link" href="/money/emis">{e.emi.name}</Link></dd></>}
            {e.halvesExpense && (
              <>
                <dt className="text-muted">On Halves</dt>
                <dd>{live ? <Link className="link" href={`/expenses/${live.id}`}>See the split</Link> : "Deleted on Halves, so the full amount counts"}</dd>
              </>
            )}
            {e.notes && <><dt className="text-muted">Notes</dt><dd className="whitespace-pre-wrap">{e.notes}</dd></>}
          </dl>
        </Card>

        {e.items.length > 0 && (
          <Card className="p-5">
            <h2 className="section-title">Items</h2>
            <ul className="divide-y divide-border/60 text-sm">
              {e.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0"><span className="block truncate">{it.name}</span><span className="text-xs text-muted">{cat(it.category)}</span></span>
                  <span className="tabular-nums">{formatMoney(it.amountCents, e.currency)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="border-danger/40 p-5">
          <ActionForm action={deletePersonalExpense} confirm="Delete this expense? This can't be undone.">
            <input type="hidden" name="id" value={e.id} />
            {live && (
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" name="alsoHalves" defaultChecked /> Also delete it on Halves (it can be restored there)
              </label>
            )}
            <SubmitButton variant="danger" size="sm">Delete expense</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
