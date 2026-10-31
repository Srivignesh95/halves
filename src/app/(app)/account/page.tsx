import { requireUser } from "@/lib/auth";
import { deleteAccount, updateAccount } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { CURRENCIES } from "@/lib/money";

export const metadata = { title: "Your account" };

export default async function Account() {
  const me = await requireUser();
  return (
    <>
      <PageHeader title="Your account" sub={me.email} />
      <div className="max-w-lg space-y-6">
        <Card className="p-5">
          <ActionForm action={updateAccount} className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" name="name" defaultValue={me.name} maxLength={60} required className="field" />
            </div>
            <div>
              <label className="label" htmlFor="defaultCurrency">Default currency</label>
              <select id="defaultCurrency" name="defaultCurrency" defaultValue={me.defaultCurrency} className="field">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Your data</h2>
          <p className="mb-3 text-sm text-muted">Every expense you&apos;re part of, as a spreadsheet.</p>
          <a href="/api/export" className="link text-sm">Download CSV</a>
        </Card>
        <Card className="border-danger/40 p-5">
          <h2 className="mb-1 font-semibold text-danger">Delete account</h2>
          <p className="mb-3 text-sm text-muted">Settle every balance first. Your name is removed from other people&apos;s history and you can&apos;t log in again.</p>
          <ActionForm action={deleteAccount} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="confirm">Type DELETE to confirm</label>
              <input id="confirm" name="confirm" autoComplete="off" className="field" />
            </div>
            <SubmitButton variant="danger">Delete my account</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
