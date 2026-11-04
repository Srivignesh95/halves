import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dashboard, sidebar } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { displayName } from "@/lib/users";
import { Avatar, Balance, Card, EmptyState, Flash, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Dashboard" };

function Totals({ m }: { m: Map<string, number> }) {
  if (m.size === 0) return <span className="text-muted">{formatMoney(0, "CAD")}</span>;
  return <>{[...m.entries()].map(([c, v]) => <span key={c} className="block">{formatMoney(v, c)}</span>)}</>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ reset?: string; removed?: string }> }) {
  const sp = await searchParams;
  const justReset = sp.reset === "1";
  const justRemoved = sp.removed === "1";
  const me = await requireUser();
  const [{ rows, owed, owe }, nav] = await Promise.all([dashboard(me.id), sidebar(me.id)]);
  const theyOwe = rows.filter((r) => r.amounts.some(([, v]) => v > 0));
  const iOwe = rows.filter((r) => r.amounts.some(([, v]) => v < 0));
  const net = new Map<string, number>();
  for (const [c, v] of owed) net.set(c, (net.get(c) ?? 0) + v);
  for (const [c, v] of owe) net.set(c, (net.get(c) ?? 0) - v);

  const Row = ({ r, sign }: { r: (typeof rows)[number]; sign: 1 | -1 }) => (
    <li>
      <Link href={`/friends/${r.user.id}`} className="flex items-center gap-3 rounded-md px-2 py-2.5 transition hover:bg-bg/60">
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
      {justReset && <div className="mb-4"><Flash kind="ok">Password changed. Other devices have been signed out.</Flash></div>}
      {justRemoved && <div className="mb-4"><Flash kind="ok">Friend removed.</Flash></div>}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="card col-span-2 p-5 sm:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Total balance</div>
          <div className={`mt-2 text-3xl font-extrabold tracking-tight ${[...net.values()].some((v) => v < 0) ? "text-owe" : "text-owed"}`}>
            {net.size === 0 ? <span className="text-muted">All settled</span> : [...net.entries()].map(([c, v]) => <span key={c} className="block">{v >= 0 ? "+" : "-"}{formatMoney(Math.abs(v), c)}</span>)}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><span className="h-2 w-2 rounded-full bg-owe" />You owe</div>
          <div className="mt-2 text-xl font-bold text-owe"><Totals m={owe} /></div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><span className="h-2 w-2 rounded-full bg-owed" />You are owed</div>
          <div className="mt-2 text-xl font-bold text-owed"><Totals m={owed} /></div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="You're all settled up">
          <p>Add an expense, or <Link className="link" href="/groups/new">start a group</Link> for your home or next trip.</p>
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <section className="card p-3">
            <h2 className="section-title px-2 pt-1">You owe</h2>
            {iOwe.length ? <ul>{iOwe.map((r) => <Row key={r.user.id} r={r} sign={-1} />)}</ul> : <p className="px-2 pb-2 text-sm text-muted">You don&apos;t owe anything.</p>}
          </section>
          <section className="card p-3">
            <h2 className="section-title px-2 pt-1">You are owed</h2>
            {theyOwe.length ? <ul>{theyOwe.map((r) => <Row key={r.user.id} r={r} sign={1} />)}</ul> : <p className="px-2 pb-2 text-sm text-muted">Nobody owes you anything.</p>}
          </section>
        </div>
      )}

      <section className="mt-6 grid gap-4 md:hidden">
        <div className="card p-3">
          <h2 className="section-title flex justify-between px-2 pt-1">Groups <Link href="/groups/new" className="normal-case tracking-normal text-accent">+ add</Link></h2>
          {nav.groups.length === 0 ? <p className="px-2 pb-2 text-sm text-muted">No groups yet</p> : <ul>{nav.groups.map((g) => <li key={g.id}><Link className="flex items-center gap-2.5 rounded-md px-2 py-2.5 hover:bg-bg/60" href={`/groups/${g.id}`}><span className="h-2 w-2 rounded-full bg-accent/60" />{g.name}</Link></li>)}</ul>}
        </div>
        <div className="card p-3">
          <h2 className="section-title flex justify-between px-2 pt-1">Friends <Link href="/friends/new" className="normal-case tracking-normal text-accent">+ add</Link></h2>
          {nav.friends.length === 0 ? <p className="px-2 pb-2 text-sm text-muted">No friends yet</p> : <ul>{nav.friends.map((f) => <li key={f.id}><Link className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-bg/60" href={`/friends/${f.id}`}><Avatar id={f.id} name={f.name} size={26} />{f.name}</Link></li>)}</ul>}
        </div>
      </section>
    </>
  );
}
