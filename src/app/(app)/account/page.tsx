import { requireUser } from "@/lib/auth";
import { deleteAccount, updateAccount } from "@/app/actions/auth";
import { emailMyBalances } from "@/app/actions/notifications";
import { AvatarUploader } from "@/components/avatar-uploader";
import { eq } from "drizzle-orm";
import { avatars, db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { CURRENCIES } from "@/lib/money";

export const metadata = { title: "Your account" };

export default async function Account() {
  const me = await requireUser();
  const [photo] = await db.select({ at: avatars.updatedAt }).from(avatars).where(eq(avatars.userId, me.id)).limit(1);
  return (
    <>
      <PageHeader title="Your account" sub={me.email} />
      <div className="max-w-lg space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Profile photo</h2>
          <AvatarUploader userId={me.id} name={me.name} version={photo ? photo.at.getTime() : 0} hasPhoto={!!photo} />
        </Card>
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
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="emailDigest" defaultChecked={me.emailDigest} className="mt-1" />
              <span>
                <strong className="block">Weekly balance email</strong>
                <span className="text-muted">Every Monday, a summary of who owes you and who you owe. Only sent when you have open balances.</span>
              </span>
            </label>
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Your balances by email</h2>
          <p className="mb-3 text-sm text-muted">Get the summary right now, to {me.email}.</p>
          <ActionForm action={emailMyBalances}>
            <SubmitButton variant="secondary">Email me my balances</SubmitButton>
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
