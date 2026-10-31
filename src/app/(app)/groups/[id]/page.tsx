import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { db, expenses, groups } from "@/lib/db";
import { assertGroupMember, assertUuid } from "@/lib/access";
import { expenseListWith } from "@/lib/data";
import { groupDebts, netBalances } from "@/lib/balances";
import { formatMoney } from "@/lib/money";
import { ExpenseList } from "@/components/expense-list";
import { Avatar, Card, LinkButton, PageHeader } from "@/components/ui";
import { GROUP_TYPES } from "@/lib/constants";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  assertUuid(id);
  await assertGroupMember(id, me.id);
  const group = (await db.query.groups.findFirst({
    where: eq(groups.id, id),
    with: {
      members: { with: { user: { columns: { id: true, name: true } } } },
      expenses: { orderBy: [desc(expenses.date), desc(expenses.createdAt)], with: expenseListWith, limit: 500 },
    },
  }))!;
  const live = group.expenses.filter((e) => !e.deletedAt);
  const net = netBalances(live);
  const debts = groupDebts(live, group.simplifyDebts);
  const name = new Map(group.members.map((m) => [m.userId, m.user.name]));
  for (const e of group.expenses) for (const s of e.shares) if (!name.has(s.userId)) name.set(s.userId, s.user.name);
  const who = (uid: string) => (uid === me.id ? "You" : name.get(uid) ?? "Former member");
  const spent = new Map<string, number>();
  for (const e of live) if (!e.isPayment) spent.set(e.currency, (spent.get(e.currency) ?? 0) + e.amountCents);

  return (
    <>
      <PageHeader
        title={group.name}
        sub={`${GROUP_TYPES.find(([k]) => k === group.type)?.[1]} · ${group.members.length} ${group.members.length === 1 ? "person" : "people"}`}
        actions={
          <>
            <LinkButton href={`/expenses/new?group=${group.id}`}>Add an expense</LinkButton>
            <LinkButton href={`/settle?group=${group.id}`} variant="secondary">Settle up</LinkButton>
            <LinkButton href={`/groups/${group.id}/settings`} variant="ghost">Settings</LinkButton>
          </>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <ExpenseList expenses={group.expenses} me={me.id} empty="No expenses in this group yet" />
        <aside className="space-y-6">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Group balances</h2>
            <ul className="space-y-2">
              {group.members.map((m) => {
                const amounts = [...net.entries()].map(([c, mm]) => [c, mm.get(m.userId) ?? 0] as const).filter(([, v]) => v !== 0);
                return (
                  <li key={m.userId} className="flex items-start gap-2 text-sm">
                    <Avatar id={m.userId} name={m.user.name} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{who(m.userId)}</span>
                      {amounts.length === 0 ? (
                        <span className="text-xs text-muted">settled up</span>
                      ) : (
                        amounts.map(([c, v]) => (
                          <span key={c} className={`block text-xs ${v > 0 ? "text-owed" : "text-owe"}`}>
                            {v > 0 ? "gets back" : "owes"} {formatMoney(Math.abs(v), c)}
                          </span>
                        ))
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="p-4">
            <h2 className="mb-1 text-sm font-semibold">Who pays whom</h2>
            <p className="mb-3 text-xs text-muted">{group.simplifyDebts ? "Simplified to the fewest payments." : "Simplify debts is off for this group."}</p>
            {debts.length === 0 ? (
              <p className="text-sm text-muted">Everyone is settled up.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {debts.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{who(d.from)} → {who(d.to)}</span>
                    <span className="flex items-center gap-2">
                      <strong className="tabular-nums">{formatMoney(d.amountCents, d.currency)}</strong>
                      {(d.from === me.id || d.to === me.id) && (
                        <Link className="link text-xs" href={`/settle?group=${group.id}&from=${d.from}&to=${d.to}&amount=${(d.amountCents / 100).toFixed(2)}&currency=${d.currency}`}>record</Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {spent.size > 0 && (
            <Card className="p-4 text-sm">
              <h2 className="mb-1 font-semibold">Total spent</h2>
              {[...spent.entries()].map(([c, v]) => <div key={c}>{formatMoney(v, c)}</div>)}
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
