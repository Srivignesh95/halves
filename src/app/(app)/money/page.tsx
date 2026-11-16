import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { monthData } from "@/lib/money-data";
import { monthKey, monthLabel, monthRange, shiftMonth } from "@/lib/money-report";
import { emailMoneyReport } from "@/app/actions/money";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "My Money" };

export default async function MyMoney({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const thisMonth = monthKey(new Date());
  const month = sp.month && monthRange(sp.month) ? sp.month : thisMonth;
  const { entries, report, payName, catName } = await monthData(me.id, month);

  return (
    <>
      <PageHeader
        title="My Money"
        sub="Your own spending: what you pay for, plus your share of everything on Halves."
        actions={<>
          <LinkButton href="/money/new">Add expense</LinkButton>
          <LinkButton href="/money/emis" variant="secondary">EMIs</LinkButton>
          <LinkButton href="/money/settings" variant="secondary">Settings</LinkButton>
        </>}
      />

      <nav aria-label="Month" className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2 whitespace-nowrap">
        <Link className="link text-sm" href={`/money?month=${shiftMonth(month, -1)}`}>← {monthLabel(shiftMonth(month, -1), "short")}</Link>
        <h2 className="text-lg font-bold">{monthLabel(month)}</h2>
        {month < thisMonth ? <Link className="link justify-self-end text-sm" href={`/money?month=${shiftMonth(month, 1)}`}>{monthLabel(shiftMonth(month, 1), "short")} →</Link> : <span />}
      </nav>

      {report.length === 0 ? (
        <EmptyState title="Nothing recorded this month">
          Scan a receipt or add an expense by hand. Your share of Halves expenses shows up here on its own.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {report.map((c) => {
            const max = Math.max(...c.byCategory.map(([, v]) => v), 1);
            return (
              <Card key={c.currency} className="p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Spent in {c.currency}</p>
                    <p className="text-3xl font-extrabold tabular-nums">{formatMoney(c.totalCents, c.currency)}</p>
                    <p className="mt-1 text-xs text-muted">
                      {[
                        c.emiCount > 0 && `EMIs ${formatMoney(c.emiCents, c.currency)}`,
                        c.halvesShareCents > 0 && `Your share on Halves ${formatMoney(c.halvesShareCents, c.currency)}`,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {c.topCard && (
                    <div className="rounded-md bg-accent/10 px-4 py-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Most used card</p>
                      <p className="font-bold">{payName(c.topCard.id)}</p>
                      <p className="text-xs text-muted">{formatMoney(c.topCard.cents, c.currency)} · {c.topCard.count} payment{c.topCard.count === 1 ? "" : "s"}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <section>
                    <h3 className="section-title">By category</h3>
                    <ul className="space-y-2">
                      {c.byCategory.map(([k, v]) => (
                        <li key={k}>
                          <div className="flex justify-between text-sm"><span>{catName(k)}</span><strong className="tabular-nums">{formatMoney(v, c.currency)}</strong></div>
                          <div className="mt-1 h-1.5 rounded-full bg-bg/70"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(2, (v / max) * 100)}%` }} /></div>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3 className="section-title">By payment method</h3>
                    {c.byPayment.length === 0 ? <p className="text-sm text-muted">Only Halves shares this month.</p> : (
                      <ul className="divide-y divide-border/60 text-sm">
                        {c.byPayment.map((p) => (
                          <li key={p.id || "none"} className="flex justify-between py-1.5">
                            <span>{payName(p.id)} <span className="text-xs text-muted">· {p.count}×</span></span>
                            <strong className="tabular-nums">{formatMoney(p.cents, c.currency)}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-muted">Full amounts charged, including what friends owe you back.</p>
                  </section>
                </div>
              </Card>
            );
          })}

          <Card className="p-5">
            <h3 className="section-title">Entries</h3>
            <ul className="divide-y divide-border/60">
              {entries.map((e) => (
                <li key={`${e.kind}-${e.id}`}>
                  <Link href={e.href} className="flex items-center justify-between gap-3 rounded-md px-1 py-2.5 transition hover:bg-bg/50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.description}</span>
                      <span className="block text-xs text-muted">
                        {formatDate(e.date)} · {catName(e.category)}
                        {e.payment && ` · ${e.payment}`}
                        {e.emi && e.category !== "emi" && " · EMI"}
                        {e.kind === "halves" && " · from Halves"}
                        {e.kind === "personal" && e.split && " · split on Halves"}
                      </span>
                    </span>
                    <span className="text-right">
                      <strong className="block tabular-nums">{formatMoney(e.myCents, e.currency)}</strong>
                      {e.kind === "personal" && e.split && e.amountCents !== e.myCents && <span className="block text-xs text-muted">of {formatMoney(e.amountCents, e.currency)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Card className="mt-6 p-5">
        <h3 className="mb-1 font-semibold">Monthly report by email</h3>
        <p className="mb-3 text-sm text-muted">Sent at the start of every month for the month before. Want this month&apos;s now?</p>
        <ActionForm action={emailMoneyReport}>
          <input type="hidden" name="month" value={month} />
          <SubmitButton variant="secondary">Email me the {monthLabel(month)} report</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
