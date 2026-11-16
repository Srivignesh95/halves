import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, emis } from "@/lib/db";
import { moneyOptions } from "@/lib/money-data";
import { paymentLabel } from "@/lib/money-categories";
import { addEmi, deleteEmi, stopEmi } from "@/app/actions/money";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { CURRENCIES, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { LocalDateInput } from "@/components/local-date-input";

export const metadata = { title: "EMIs" };

export default async function Emis() {
  const me = await requireUser();
  const [list, { payments }] = await Promise.all([
    db.query.emis.findMany({ where: eq(emis.userId, me.id), orderBy: desc(emis.createdAt), with: { paymentMethod: true } }),
    moneyOptions(me.id),
  ]);
  const active = list.filter((e) => !e.stoppedAt);
  const ended = list.filter((e) => e.stoppedAt);
  const freq = (f: string) => (f === "monthly" ? "every month" : "every 2 weeks");

  const row = (e: (typeof list)[number]) => (
    <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-semibold">{e.name}{e.lender && <span className="font-normal text-muted"> · {e.lender}</span>}</p>
        <p className="text-xs text-muted">
          {formatMoney(e.amountCents, e.currency)} {freq(e.frequency)}
          {e.paymentMethod && ` · ${paymentLabel(e.paymentMethod)}`}
          {e.nextDueOn && ` · next on ${formatDate(e.nextDueOn)}`}
          {e.paymentsLeft !== null && ` · ${e.paymentsLeft} payment${e.paymentsLeft === 1 ? "" : "s"} left`}
          {e.stoppedAt && ` · ended ${formatDate(e.stoppedAt)}`}
        </p>
      </div>
      <div className="flex gap-2">
        {!e.stoppedAt && (
          <ActionForm action={stopEmi} confirm={`Stop "${e.name}"? No more payments will be added.`}>
            <input type="hidden" name="id" value={e.id} />
            <SubmitButton variant="secondary" size="sm">Stop</SubmitButton>
          </ActionForm>
        )}
        <ActionForm action={deleteEmi} confirm={`Remove "${e.name}"? Payments already added stay in your history.`}>
          <input type="hidden" name="id" value={e.id} />
          <SubmitButton variant="ghost" size="sm">Remove</SubmitButton>
        </ActionForm>
      </div>
    </li>
  );

  return (
    <>
      <PageHeader title="EMIs" sub="Each payment is added to My Money on its due date and counts in that month's spending." actions={<LinkButton href="/money" variant="secondary">Back to My Money</LinkButton>} />
      <div className="max-w-2xl space-y-6">
        {active.length === 0 ? <EmptyState title="No EMIs yet">Add a loan or instalment below.</EmptyState> : (
          <Card className="px-5 py-2"><ul className="divide-y divide-border/60">{active.map(row)}</ul></Card>
        )}

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Add an EMI</h2>
          <ActionForm action={addEmi} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" name="name" className="field" maxLength={60} required placeholder="Car loan, phone, laptop..." />
            </div>
            <div>
              <label className="label" htmlFor="lender">Lender (optional)</label>
              <input id="lender" name="lender" className="field" maxLength={60} placeholder="TD, HDFC, Affirm..." />
            </div>
            <div>
              <label className="label" htmlFor="amount">Amount each time</label>
              <div className="flex gap-2">
                <select aria-label="Currency" name="currency" className="field w-24" defaultValue={me.defaultCurrency}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input id="amount" name="amount" className="field" inputMode="decimal" placeholder="0.00" required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="frequency">How often</label>
              <select id="frequency" name="frequency" className="field" defaultValue="monthly">
                <option value="monthly">Every month</option>
                <option value="fortnightly">Every 2 weeks (bi-weekly)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nextDue">Next payment date</label>
              <LocalDateInput id="nextDue" name="nextDue" required />
            </div>
            <div>
              <label className="label" htmlFor="paymentsLeft">Payments left (optional)</label>
              <input id="paymentsLeft" name="paymentsLeft" className="field" inputMode="numeric" placeholder="Leave empty to keep going" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="paymentMethodId">Paid from (optional)</label>
              <select id="paymentMethodId" name="paymentMethodId" className="field" defaultValue="">
                <option value="">Not recorded</option>
                {payments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><SubmitButton>Add EMI</SubmitButton></div>
          </ActionForm>
        </Card>

        {ended.length > 0 && (
          <Card className="px-5 py-2">
            <h2 className="section-title pt-3">Ended</h2>
            <ul className="divide-y divide-border/60">{ended.map(row)}</ul>
          </Card>
        )}
      </div>
    </>
  );
}
