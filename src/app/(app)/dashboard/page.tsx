import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dashboard, sidebar } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { displayName } from "@/lib/users";
import { Avatar, Balance, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Dashboard" };

function Totals({ m }: { m: Map<string, number> }) {
  if (m.size === 0) return <span className="text-muted">{formatMoney(0, "CAD")}</span>;
  return <>{[...m.entries()].map(([c, v]) => <span key={c} className="block">{formatMoney(v, c)}</span>)}</>;
}

export default async function Dashboard() {
  const me = await requireUser();
  const [{ rows, owed, owe }, nav] = await Promise.all([dashboard(me.id), sidebar(me.id)]);
  const theyOwe = rows.filter((r) => r.amounts.some(([, v]) => v > 0));
  const iOwe = rows.filter((r) => r.amounts.some(([, v]) => v < 0));
  const net = new Map<string, number>();
  for (const [c, v] of owed) net.set(c, (net.get(c) ?? 0) + v);
  for (const [c, v] of owe) net.set(c, (net.get(c) ?? 0) - v);

  const Row = ({ r, sign }: { r: (typeof rows)[number]; sign: 1 | -1 }) => (
    <li>
      <Link href={`/friends/${r.user.id}`} className="flex items-center gap-3 rounded-sm px-2 py-2 hover:bg-surface">
        <Avatar id={r.user.id} name={displayName(r.user)} />
        <span className="min-w-0 flex-1 truncate font-medium">{displayName(r.user)}</span>
        <Balance amounts={r.amounts.filter(([, v]) => Math.sign(v) === sign)} owesYou="owes you" youOwe="you owe" />
      </Link>
    </li>
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <LinkButton href="/expenses/new">Add an expense</LinkButton>
            <LinkButton href="/settle" variant="secondary">Settle up</LinkButton>
          </>
        }
      />
      <Card className="mb-6 grid grid-cols-3 divide-x divide-border text-center">
        <div className="p-4">
          <div className="text-xs text-muted">Total balance</div>
          <div className={`mt-1 font-semibold ${[...net.values()].some((v) => v < 0) ? "text-owe" : "text-owed"}`}>
            {net.size === 0 ? <span className="text-muted">all settled</span> : [...net.entries()].map(([c, v]) => <span key={c} className="block">{v >= 0 ? "+" : "-"}{formatMoney(Math.abs(v), c)}</span>)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted">You owe</div>
          <div className="mt-1 font-semibold text-owe"><Totals m={owe} /></div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted">You are owed</div>
          <div className="mt-1 font-semibold text-owed"><Totals m={owed} /></div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="You're all settled up">
          <p>Add an expense, or <Link className="link" href="/groups/new">start a group</Link> for your home or next trip.</p>
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">You owe</h2>
            {iOwe.length ? <ul>{iOwe.map((r) => <Row key={r.user.id} r={r} sign={-1} />)}</ul> : <p className="px-2 text-sm text-muted">You don&apos;t owe anything.</p>}
          </section>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">You are owed</h2>
            {theyOwe.length ? <ul>{theyOwe.map((r) => <Row key={r.user.id} r={r} sign={1} />)}</ul> : <p className="px-2 text-sm text-muted">Nobody owes you anything.</p>}
          </section>
        </div>
      )}

      <section className="mt-8 grid gap-6 md:hidden">
        <div>
          <h2 className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wide text-muted">Groups <Link href="/groups/new" className="text-accent normal-case">+ add</Link></h2>
          <ul>{nav.groups.map((g) => <li key={g.id}><Link className="block rounded-sm px-2 py-2 hover:bg-surface" href={`/groups/${g.id}`}>{g.name}</Link></li>)}</ul>
        </div>
        <div>
          <h2 className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wide text-muted">Friends <Link href="/friends/new" className="text-accent normal-case">+ add</Link></h2>
          <ul>{nav.friends.map((f) => <li key={f.id}><Link className="block rounded-sm px-2 py-2 hover:bg-surface" href={`/friends/${f.id}`}>{f.name}</Link></li>)}</ul>
        </div>
      </section>
    </>
  );
}
