import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, expenses as E, users } from "@/lib/db";
import { areFriends, assertUuid } from "@/lib/access";
import { expenseListWith, expensesWithShareFor, friendBreakdown } from "@/lib/data";
import { displayName } from "@/lib/users";
import { ExpenseList } from "@/components/expense-list";
import { Avatar, Balance, Card, Flash, LinkButton, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { removeFriend, resendInvite } from "@/app/actions/friends";
import { sendReminder } from "@/app/actions/notifications";

export default async function FriendPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invited?: string }> }) {
  const justInvited = (await searchParams).invited === "1";
  const me = await requireUser();
  const { id } = await params;
  assertUuid(id);
  if (id === me.id || !(await areFriends(me.id, id))) notFound();
  const [friend] = await db.select().from(users).where(eq(users.id, id));
  const [{ parts, total }, expenses] = await Promise.all([
    friendBreakdown(me.id, id),
    db.query.expenses.findMany({
      where: and(isNull(E.deletedAt), expensesWithShareFor(me.id), expensesWithShareFor(id)),
      orderBy: [desc(E.date), desc(E.createdAt)],
      limit: 300,
      with: expenseListWith,
    }),
  ]);
  const name = displayName(friend);
  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar id={friend.id} name={name} size={36} />{name}</span>}
        sub={friend.passwordHash ? friend.email : `${friend.email} · hasn't signed up yet`}
        actions={
          <>
            <LinkButton href={`/expenses/new?friend=${friend.id}`}>Add an expense</LinkButton>
            <LinkButton href={`/settle?with=${friend.id}`} variant="secondary">Settle up</LinkButton>
          </>
        }
      />
      {justInvited && <div className="mb-4"><Flash kind="ok">We emailed {friend.email} an invite to join Halves.</Flash></div>}
      {!friend.passwordHash && !friend.deletedAt && (
        <ActionForm action={resendInvite} className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted">
          <input type="hidden" name="friendId" value={friend.id} />
          <span>{name} hasn&apos;t joined yet. You can still add expenses with them.</span>
          <SubmitButton variant="secondary" size="sm">Resend invite</SubmitButton>
        </ActionForm>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <ExpenseList expenses={expenses} me={me.id} showGroup empty={`Nothing shared with ${name} yet`} />
        <aside>
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Overall</h2>
            <Balance amounts={total} owesYou={`${name} owes you`} youOwe={`you owe ${name}`} align="left" />
            {parts.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                {parts.map((p) => (
                  <li key={p.groupId ?? "none"} className="flex items-start justify-between gap-2">
                    {p.groupId ? <Link className="link truncate" href={`/groups/${p.groupId}`}>{p.name}</Link> : <span className="truncate">{p.name}</span>}
                    <Balance amounts={p.amounts} owesYou="owes you" youOwe="you owe" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {total.some(([, v]) => v > 0) && !friend.deletedAt && (
            <Card className="mt-6 p-4">
              <h2 className="mb-1 text-sm font-semibold">Send a reminder</h2>
              <p className="mb-3 text-xs text-muted">Emails {name} how much they owe you. One reminder a day.</p>
              <ActionForm action={sendReminder} className="space-y-2" resetOnSuccess>
                <input type="hidden" name="friendId" value={friend.id} />
                <label htmlFor="note" className="sr-only">Add a note (optional)</label>
                <input id="note" name="note" maxLength={300} placeholder="Add a note (optional)" className="field" />
                <SubmitButton size="sm">Send reminder</SubmitButton>
              </ActionForm>
            </Card>
          )}
          <Card className="mt-6 p-4">
            <h2 className="mb-1 text-sm font-semibold">Remove friend</h2>
            <p className="mb-3 text-xs text-muted">
              {total.length > 0 ? "Settle up first. You can remove a friend once the balance between you is zero." : `Takes ${name} off your friends list. Shared groups and past expenses stay as they are.`}
            </p>
            <ActionForm action={removeFriend} confirm={`Remove ${name} from your friends?`}>
              <input type="hidden" name="friendId" value={friend.id} />
              <SubmitButton variant="ghost" size="sm" className="!text-danger">Remove {name}</SubmitButton>
            </ActionForm>
          </Card>
        </aside>
      </div>
    </>
  );
}
