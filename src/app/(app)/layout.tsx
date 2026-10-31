import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sidebar } from "@/lib/data";
import { logout } from "@/app/actions/auth";
import { Avatar } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const { groups, friends } = await sidebar(me.id);
  const nav = [
    ["/dashboard", "Dashboard"],
    ["/activity", "Recent activity"],
    ["/expenses", "All expenses"],
  ];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-lg font-bold">Halves</Link>
          <div className="flex items-center gap-3">
            <Link href="/account" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <Avatar id={me.id} name={me.name} size={28} />
              <span className="hidden sm:inline">{me.name}</span>
            </Link>
            <form action={logout}>
              <button className="text-sm text-muted hover:text-text">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="space-y-6 text-sm">
          <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-sm px-2 py-1.5 font-medium hover:bg-surface">{label}</Link>
            ))}
          </nav>
          <div className="hidden md:block">
            <div className="mb-1 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Groups <Link href="/groups/new" className="text-accent normal-case tracking-normal">+ add</Link>
            </div>
            {groups.length === 0 ? <p className="px-2 text-xs text-muted">No groups yet</p> : (
              <ul>{groups.map((g) => <li key={g.id}><Link href={`/groups/${g.id}`} className="block truncate rounded-sm px-2 py-1 hover:bg-surface">{g.name}</Link></li>)}</ul>
            )}
          </div>
          <div className="hidden md:block">
            <div className="mb-1 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Friends <Link href="/friends/new" className="text-accent normal-case tracking-normal">+ add</Link>
            </div>
            {friends.length === 0 ? <p className="px-2 text-xs text-muted">No friends yet</p> : (
              <ul>{friends.map((f) => <li key={f.id}><Link href={`/friends/${f.id}`} className="block truncate rounded-sm px-2 py-1 hover:bg-surface">{f.name}</Link></li>)}</ul>
            )}
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
