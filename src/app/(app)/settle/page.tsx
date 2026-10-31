import { requireUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db, groups } from "@/lib/db";
import { isGroupMember, UUID_RE } from "@/lib/access";
import { friendBreakdown, groupEdges } from "@/lib/data";
import { settleUp } from "@/app/actions/expenses";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, PageHeader } from "@/components/ui";
import { CURRENCIES, isCurrency, parseMoney, centsToInput } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { expenseFormOptions } from "@/lib/form-options";

export const metadata = { title: "Settle up" };

type SP = { with?: string; group?: string; from?: string; to?: string; amount?: string; currency?: string };

export default async function Settle({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const { friends } = await expenseFormOptions(me.id);
  const groupId = sp.group && UUID_RE.test(sp.group) && (await isGroupMember(sp.group, me.id)) ? sp.group : null;
  const group = groupId ? await db.query.groups.findFirst({ where: eq(groups.id, groupId), with: { members: { with: { user: { columns: { id: true, name: true } } } } } }) : null;
  const people = group ? group.members.map((m) => m.user) : [{ id: me.id, name: me.name }, ...friends];
  if (people.length < 2) return (<><PageHeader title="Settle up" /><EmptyState title="Nobody to settle with yet">Add a friend or join a group first.</EmptyState></>);

  // prefill: explicit params, else the biggest thing between me and the chosen person / group
  let from = sp.from && people.some((p) => p.id === sp.from) ? sp.from : "";
  let to = sp.to && people.some((p) => p.id === sp.to) ? sp.to : "";
  let amount = sp.amount && parseMoney(sp.amount) !== null ? sp.amount : "";
  let currency = sp.currency && isCurrency(sp.currency) ? sp.currency : group?.defaultCurrency ?? me.defaultCurrency;
  if (!from && sp.with && friends.some((f) => f.id === sp.with)) {
    const { total } = await friendBreakdown(me.id, sp.with);
    const [c, v] = total[0] ?? [currency, 0];
    [from, to] = v > 0 ? [sp.with, me.id] : [me.id, sp.with];
    if (v !== 0) { amount = centsToInput(Math.abs(v)); currency = c; }
  }
  if (!from && group) {
    const mine = (await groupEdges(group.id, group.simplifyDebts)).filter((e) => e.from === me.id || e.to === me.id).sort((a, b) => b.amountCents - a.amountCents)[0];
    if (mine) { from = mine.from; to = mine.to; amount = centsToInput(mine.amountCents); currency = mine.currency; }
  }
  if (!from) { from = me.id; to = people.find((p) => p.id !== me.id)!.id; }

  const label = (p: { id: string; name: string }) => (p.id === me.id ? "You" : p.name);
  return (
    <>
      <PageHeader title="Settle up" sub={group ? `In ${group.name}` : "Record a payment made outside the app (cash, e-transfer, anything)."} />
      <ActionForm action={settleUp} className="max-w-md space-y-4">
        <input type="hidden" name="groupId" value={group?.id ?? ""} />
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <label className="label" htmlFor="fromId">Who paid</label>
            <select id="fromId" name="fromId" defaultValue={from} className="field">
              {people.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
            </select>
          </div>
          <span className="pb-2 text-muted" aria-hidden>→</span>
          <div>
            <label className="label" htmlFor="toId">Paid to</label>
            <select id="toId" name="toId" defaultValue={to} className="field">
              {people.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <div className="flex gap-2">
            <select aria-label="Currency" name="currency" defaultValue={currency} className="field w-24">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input id="amount" name="amount" inputMode="decimal" defaultValue={amount} required className="field" placeholder="0.00" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" name="date" type="date" defaultValue={todayISO()} required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="notes">Note (optional)</label>
          <input id="notes" name="notes" maxLength={500} className="field" placeholder="e-Transfer" />
        </div>
        <SubmitButton>Record payment</SubmitButton>
      </ActionForm>
    </>
  );
}
