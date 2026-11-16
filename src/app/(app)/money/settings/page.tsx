import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, moneyReportPrefs } from "@/lib/db";
import { moneyOptions } from "@/lib/money-data";
import { MONEY_CATEGORIES, PAYMENT_KINDS, paymentKindLabel } from "@/lib/money-categories";
import { addCategory, addPaymentMethod, deleteCategory, removePaymentMethod, setMoneyReport } from "@/app/actions/money";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "My Money settings" };

export default async function MoneySettings() {
  const me = await requireUser();
  const [{ payments, customCategories }, [prefs]] = await Promise.all([
    moneyOptions(me.id),
    db.select().from(moneyReportPrefs).where(eq(moneyReportPrefs.userId, me.id)).limit(1),
  ]);
  return (
    <>
      <PageHeader title="My Money settings" actions={<LinkButton href="/money" variant="secondary">Back to My Money</LinkButton>} />
      <div className="max-w-2xl space-y-6">
        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Monthly report</h2>
          <ActionForm action={setMoneyReport} className="space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={prefs?.enabled ?? true} className="mt-1" />
              <span className="text-muted">Email me last month&apos;s spending on the 1st of each month, to {me.email}.</span>
            </label>
            <SubmitButton size="sm">Save</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Payment methods</h2>
          <p className="mb-3 text-sm text-muted">Optional. New ones are also saved when you add them on an expense. Never enter a full card number.</p>
          {payments.length > 0 && (
            <ul className="mb-4 divide-y divide-border/60 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{p.name} <span className="text-xs text-muted">· {paymentKindLabel(p.kind)}</span></span>
                  <ActionForm action={removePaymentMethod} confirm={`Remove ${p.name}? Past expenses still show it.`}>
                    <input type="hidden" name="id" value={p.id} />
                    <SubmitButton variant="ghost" size="sm">Remove</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addPaymentMethod} resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-[9rem_1fr_7rem_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="kind">Type</label>
              <select id="kind" name="kind" className="field" defaultValue="credit_card">
                {PAYMENT_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="label">Name</label>
              <input id="label" name="label" className="field" maxLength={40} required placeholder="Amex Cobalt" />
            </div>
            <div>
              <label className="label" htmlFor="last4">Last 4</label>
              <input id="last4" name="last4" className="field" inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="1234" />
            </div>
            <SubmitButton size="sm">Add</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 id="categories" className="mb-1 font-semibold">Categories</h2>
          <p className="mb-3 text-sm text-muted">
            Standard: {MONEY_CATEGORIES.map(([, l]) => l).join(", ")}. Add your own below.
          </p>
          {customCategories.length > 0 && (
            <ul className="mb-4 divide-y divide-border/60 text-sm">
              {customCategories.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3 py-2">
                  <span>{c.name}</span>
                  <ActionForm action={deleteCategory} confirm={`Remove "${c.name}"? Its expenses move to Other.`}>
                    <input type="hidden" name="id" value={c.key.slice(2)} />
                    <SubmitButton variant="ghost" size="sm">Remove</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addCategory} resetOnSuccess>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label" htmlFor="catName">New category</label>
                <input id="catName" name="name" className="field" maxLength={30} required placeholder="Kids, Pets, Gym..." />
              </div>
              <SubmitButton size="sm">Add</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
