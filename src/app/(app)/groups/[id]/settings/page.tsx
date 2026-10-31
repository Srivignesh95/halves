import { requireUser } from "@/lib/auth";
import { asc, eq } from "drizzle-orm";
import { db, groupMembers, groups } from "@/lib/db";
import { assertGroupMember, assertUuid } from "@/lib/access";
import { addMember, deleteGroup, removeMember, updateGroup } from "@/app/actions/groups";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Card, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Group settings" };

export default async function GroupSettings({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  assertUuid(id);
  await assertGroupMember(id, me.id);
  const g = (await db.query.groups.findFirst({ where: eq(groups.id, id), with: { members: { with: { user: { columns: { id: true, name: true, email: true, passwordHash: true } } }, orderBy: asc(groupMembers.joinedAt) } } }))!;
  return (
    <>
      <PageHeader title="Group settings" sub={g.name} actions={<LinkButton href={`/groups/${g.id}`} variant="secondary">Back to group</LinkButton>} />
      <div className="max-w-2xl space-y-6">
        <Card className="p-5">
          <ActionForm action={updateGroup} className="space-y-4">
            <input type="hidden" name="groupId" value={g.id} />
            <div>
              <label className="label" htmlFor="name">Group name</label>
              <input id="name" name="name" defaultValue={g.name} maxLength={80} required className="field" />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="simplifyDebts" defaultChecked={g.simplifyDebts} className="mt-1" />
              <span>
                <strong className="block">Simplify debts</strong>
                <span className="text-muted">Combine debts so the group settles with the fewest payments. Nobody ends up owing more in total.</span>
              </span>
            </label>
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Members</h2>
          <ul className="mb-4 divide-y divide-border">
            {g.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 py-2">
                <Avatar id={m.userId} name={m.user.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.user.name}{m.userId === me.id && " (you)"}</span>
                  <span className="block truncate text-xs text-muted">{m.user.email}{!m.user.passwordHash && " · invited"}</span>
                </span>
                <ActionForm action={removeMember} confirm={m.userId === me.id ? "Leave this group?" : `Remove ${m.user.name}?`}>
                  <input type="hidden" name="groupId" value={g.id} />
                  <input type="hidden" name="userId" value={m.userId} />
                  <SubmitButton variant="ghost" size="sm">{m.userId === me.id ? "Leave" : "Remove"}</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={addMember} className="flex flex-wrap items-end gap-2" resetOnSuccess>
            <input type="hidden" name="groupId" value={g.id} />
            <div className="min-w-48 flex-1">
              <label className="label" htmlFor="email">Add someone by email</label>
              <input id="email" name="email" type="email" required className="field" />
            </div>
            <SubmitButton variant="secondary">Add</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="border-danger/40 p-5">
          <h2 className="mb-1 font-semibold text-danger">Delete group</h2>
          <p className="mb-3 text-sm text-muted">Only possible once every balance in the group is zero. This removes the group and its expenses for everyone.</p>
          <ActionForm action={deleteGroup} confirm="Delete this group for everyone?">
            <input type="hidden" name="groupId" value={g.id} />
            <SubmitButton variant="danger">Delete group</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
