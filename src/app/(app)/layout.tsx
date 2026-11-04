import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sidebar } from "@/lib/data";
import { logout } from "@/app/actions/auth";
import { Avatar } from "@/components/ui";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";

const icons = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
};
const Icon = ({ d }: { d: string }) => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const { groups, friends } = await sidebar(me.id);
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-20 rounded-none border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard" aria-label="Halves home"><Logo size={30} /></Link>
          <div className="flex items-center gap-2">
            <Link href="/account" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition hover:bg-bg/60">
              <Avatar id={me.id} name={me.name} size={30} />
              <span className="hidden sm:inline">{me.name}</span>
            </Link>
            <form action={logout}>
              <button className="rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-bg/60 hover:text-text">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[232px_1fr] md:gap-8 md:py-8">
        <aside className="min-w-0 text-sm md:sticky md:top-24 md:self-start">
          <nav aria-label="Main" className="glass flex gap-1 overflow-x-auto rounded-lg p-1.5 md:flex-col">
            <NavLink href="/dashboard"><Icon d={icons.home} />Dashboard</NavLink>
            <NavLink href="/activity"><Icon d={icons.activity} />Activity</NavLink>
            <NavLink href="/expenses"><Icon d={icons.list} />All expenses</NavLink>
          </nav>
          <div className="glass mt-4 hidden rounded-lg p-3 md:block">
            <div className="section-title flex items-center justify-between">Groups <Link href="/groups/new" className="normal-case tracking-normal text-accent">+ add</Link></div>
            {groups.length === 0 ? <p className="px-2 pb-1 text-xs text-muted">No groups yet</p> : (
              <ul>{groups.map((g) => <li key={g.id}><NavLink href={`/groups/${g.id}`} className="py-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-accent/60" />{g.name}</NavLink></li>)}</ul>
            )}
            <div className="section-title mt-4 flex items-center justify-between">Friends <Link href="/friends/new" className="normal-case tracking-normal text-accent">+ add</Link></div>
            {friends.length === 0 ? <p className="px-2 pb-1 text-xs text-muted">No friends yet</p> : (
              <ul>{friends.map((f) => <li key={f.id}><NavLink href={`/friends/${f.id}`} className="py-1.5"><Avatar id={f.id} name={f.name} size={20} />{f.name}</NavLink></li>)}</ul>
            )}
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
