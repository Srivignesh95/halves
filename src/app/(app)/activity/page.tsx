import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { arrayContains, desc } from "drizzle-orm";
import { activities, db } from "@/lib/db";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Recent activity" };

export default async function Activity() {
  const me = await requireUser();
  const items = await db.query.activities.findMany({
    where: arrayContains(activities.userIds, [me.id]),
    orderBy: desc(activities.createdAt),
    limit: 100,
    with: { actor: { columns: { id: true, name: true } }, group: { columns: { name: true } } },
  });
  return (
    <>
      <PageHeader title="Recent activity" />
      {items.length === 0 ? (
        <EmptyState title="Nothing yet">Anything you or your friends add will show up here.</EmptyState>
      ) : (
        <ul className="card divide-y divide-border/60 overflow-hidden">
          {items.map((a) => {
            const body = (
              <span className="flex items-start gap-3 px-4 py-3">
                <Avatar id={a.actor.id} name={a.actor.name} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{a.summary}{a.group && <span className="text-muted"> in {a.group.name}</span>}</span>
                  <time className="block text-xs text-muted" dateTime={a.createdAt.toISOString()}>{a.createdAt.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</time>
                </span>
              </span>
            );
            return <li key={a.id}>{a.expenseId ? <Link href={`/expenses/${a.expenseId}`} className="block transition hover:bg-bg/50">{body}</Link> : a.groupId ? <Link href={`/groups/${a.groupId}`} className="block transition hover:bg-bg/50">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </>
  );
}
