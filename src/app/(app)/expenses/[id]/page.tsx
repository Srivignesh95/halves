import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { asc, desc, eq } from "drizzle-orm";
import { comments, db, expenseRevisions, expenses, expenseShares } from "@/lib/db";
import { assertUuid, canSeeExpense } from "@/lib/access";
import { addComment, deleteExpense, restoreExpense } from "@/app/actions/expenses";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Card, Flash, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { categoryLabel, RECURRENCES } from "@/lib/constants";

export default async function ExpenseDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  assertUuid(id);
  const e = await db.query.expenses.findFirst({
    where: eq(expenses.id, id),
    with: {
      shares: { with: { user: { columns: { id: true, name: true } } }, orderBy: desc(expenseShares.paidCents) },
      group: { columns: { id: true, name: true } },
      createdBy: { columns: { name: true } },
      comments: { with: { user: { columns: { id: true, name: true } } }, orderBy: asc(comments.createdAt) },
      revisions: { with: { editor: { columns: { name: true } } }, orderBy: desc(expenseRevisions.createdAt), limit: 20 },
    },
  });
  if (!e || !(await canSeeExpense(e, me.id))) notFound();
  const who = (u: { id: string; name: string }) => (u.id === me.id ? "You" : u.name);

  return (
    <>
      <PageHeader
        title={e.isPayment ? "Payment" : e.description}
        sub={
          <>
            <strong className="text-text">{formatMoney(e.amountCents, e.currency)}</strong> · {formatDate(e.date)}
            {!e.isPayment && ` · ${categoryLabel(e.category)}`}
            {e.group ? <> · <Link className="link" href={`/groups/${e.group.id}`}>{e.group.name}</Link></> : " · no group"}
            {e.recurrence !== "none" && ` · ${RECURRENCES.find(([k]) => k === e.recurrence)?.[1]}`}
          </>
        }
        actions={!e.deletedAt && !e.isPayment ? <LinkButton href={`/expenses/${e.id}/edit`} variant="secondary">Edit</LinkButton> : undefined}
      />

      {e.deletedAt && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Flash kind="error">This expense was deleted and doesn&apos;t count toward balances.</Flash>
          <ActionForm action={restoreExpense}>
            <input type="hidden" name="id" value={e.id} />
            <SubmitButton variant="secondary" size="sm">Restore</SubmitButton>
          </ActionForm>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <table className="w-full text-sm">
              <caption className="sr-only">Who paid and who owes</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-4 py-2 text-right font-medium">Paid</th>
                  <th className="px-4 py-2 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {e.shares.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2"><Avatar id={s.user.id} name={s.user.name} size={24} />{who(s.user)}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.paidCents ? formatMoney(s.paidCents, e.currency) : "-"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {s.owedCents ? formatMoney(s.owedCents, e.currency) : "-"}
                      {e.splitType === "percent" && s.splitInput !== null && <span className="ml-1 text-xs text-muted">({Number(s.splitInput)}%)</span>}
                      {e.splitType === "shares" && s.splitInput !== null && <span className="ml-1 text-xs text-muted">({Number(s.splitInput)} sh)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {e.notes && (
            <Card className="p-4">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Notes</h2>
              <p className="whitespace-pre-wrap text-sm">{e.notes}</p>
            </Card>
          )}
          <p className="text-xs text-muted">Added by {e.createdBy.name} on {e.createdAt.toLocaleDateString("en-CA", { dateStyle: "medium" })}.</p>
          {!e.deletedAt && (
            <ActionForm action={deleteExpense} confirm="Delete this expense? You can restore it later.">
              <input type="hidden" name="id" value={e.id} />
              <SubmitButton variant="ghost" size="sm" className="!text-danger">Delete {e.isPayment ? "payment" : "expense"}</SubmitButton>
            </ActionForm>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Comments</h2>
            {e.comments.length === 0 && <p className="mb-3 text-sm text-muted">No comments yet.</p>}
            <ul className="mb-3 space-y-3">
              {e.comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium">{who(c.user)}</span> <span className="text-xs text-muted">{c.createdAt.toLocaleDateString("en-CA", { dateStyle: "medium" })}</span>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
            <ActionForm action={addComment} className="space-y-2">
              <input type="hidden" name="id" value={e.id} />
              <label htmlFor="body" className="sr-only">Add a comment</label>
              <textarea id="body" name="body" rows={2} maxLength={1000} required className="field" placeholder="Add a comment" />
              <SubmitButton size="sm">Post</SubmitButton>
            </ActionForm>
          </Card>
          {e.revisions.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">Edit history</h2>
              <ul className="space-y-1 text-xs text-muted">
                {e.revisions.map((r) => {
                  const snap = r.snapshot as { description?: string; amountCents?: number; currency?: string };
                  return (
                    <li key={r.id}>
                      {r.editor.name} edited on {r.createdAt.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}. Before: &ldquo;{snap.description}&rdquo; {snap.amountCents !== undefined && snap.currency && formatMoney(snap.amountCents, snap.currency)}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
