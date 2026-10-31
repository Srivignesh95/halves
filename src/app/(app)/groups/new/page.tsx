import { requireUser } from "@/lib/auth";
import { createGroup } from "@/app/actions/groups";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { GROUP_TYPES } from "@/lib/constants";
import { CURRENCIES } from "@/lib/money";

export const metadata = { title: "New group" };

export default async function NewGroup() {
  const me = await requireUser();
  return (
    <>
      <PageHeader title="Start a group" sub="For a home, a trip, a couple, or anything you share." />
      <ActionForm action={createGroup} className="max-w-lg space-y-4">
        <div>
          <label className="label" htmlFor="name">Group name</label>
          <input id="name" name="name" required maxLength={80} className="field" placeholder="Banff weekend" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="type">Type</label>
            <select id="type" name="type" className="field" defaultValue="other">
              {GROUP_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="defaultCurrency">Currency</label>
            <select id="defaultCurrency" name="defaultCurrency" className="field" defaultValue={me.defaultCurrency}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="emails">People to add (emails)</label>
          <textarea id="emails" name="emails" rows={3} className="field" placeholder="sam@example.com, priya@example.com" aria-describedby="emails-hint" />
          <p id="emails-hint" className="mt-1 text-xs text-muted">Separate with commas or new lines. People without an account can claim theirs by signing up with that email.</p>
        </div>
        <SubmitButton>Create group</SubmitButton>
      </ActionForm>
    </>
  );
}
