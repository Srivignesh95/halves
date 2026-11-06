import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { categoryLabel } from "@/lib/constants";
import { EmptyState } from "./ui";

export type ExpenseRowData = {
  id: string;
  description: string;
  amountCents: number;
  currency: string;
  date: Date;
  category: string;
  isPayment: boolean;
  deletedAt: Date | null;
  group: { id: string; name: string } | null;
  receipt?: { expenseId: string } | null;
  shares: { userId: string; paidCents: number; owedCents: number; user: { id: string; name: string } }[];
};

function myLine(e: ExpenseRowData, me: string) {
  const mine = e.shares.find((s) => s.userId === me);
  const payers = e.shares.filter((s) => s.paidCents > 0);
  const payerText = payers.length > 1 ? `${payers.length} people paid` : payers[0]?.userId === me ? "you paid" : `${payers[0]?.user.name ?? "someone"} paid`;
  if (e.isPayment) {
    const to = e.shares.find((s) => s.owedCents > 0);
    return { payerText: `${payers[0]?.userId === me ? "You" : payers[0]?.user.name} paid ${to?.userId === me ? "you" : to?.user.name}`, net: 0, mine: !!mine };
  }
  return { payerText, net: mine ? mine.paidCents - mine.owedCents : 0, mine: !!mine };
}

export function ExpenseList({ expenses, me, showGroup = false, empty }: { expenses: ExpenseRowData[]; me: string; showGroup?: boolean; empty: string }) {
  if (expenses.length === 0) return <EmptyState title={empty} />;
  let lastMonth = "";
  return (
    <ul className="card divide-y divide-border/60 overflow-hidden">
      {expenses.map((e) => {
        const month = e.date.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
        const header = month !== lastMonth ? ((lastMonth = month), month) : null;
        const { payerText, net, mine } = myLine(e, me);
        return (
          <li key={e.id}>
            {header && <div className="bg-bg/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{header}</div>}
            <Link href={`/expenses/${e.id}`} className={`flex items-center gap-4 px-4 py-3.5 transition hover:bg-bg/50 ${e.deletedAt ? "opacity-60" : ""}`}>
              <span className="flex w-11 shrink-0 flex-col items-center rounded-md bg-bg/60 py-1 leading-tight shadow-[inset_0_0_0_1px_rgb(var(--c-border)/0.7)]">
                <span className="text-[10px] font-semibold uppercase text-muted">{e.date.toLocaleDateString("en-CA", { month: "short", timeZone: "UTC" }).replace(".", "")}</span>
                <span className="text-base font-bold">{e.date.getUTCDate()}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-medium ${e.deletedAt ? "line-through" : ""}`}>
                  {e.isPayment ? "Payment" : e.description}
                  {e.receipt && (
                    <svg role="img" aria-label="has a receipt photo" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ml-1.5 inline-block align-[-1px] text-muted">
                      <path d="m21 12-8.6 8.6a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 0 1 5.7 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.8l7.9-7.9" />
                    </svg>
                  )}
                  {e.deletedAt && <span className="ml-2 text-xs font-normal no-underline">(deleted)</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  {payerText} {!e.isPayment && formatMoney(e.amountCents, e.currency)}
                  {!e.isPayment && ` · ${categoryLabel(e.category)}`}
                  {showGroup && e.group && ` · ${e.group.name}`}
                </span>
              </span>
              <span className="w-32 shrink-0 text-right text-sm">
                {e.isPayment ? (
                  <span className="text-muted">{formatMoney(e.amountCents, e.currency)}</span>
                ) : !mine ? (
                  <span className="text-xs text-muted">not involved</span>
                ) : net === 0 ? (
                  <span className="text-xs text-muted">no balance</span>
                ) : (
                  <span className={net > 0 ? "text-owed" : "text-owe"}>
                    <span className="block text-xs">{net > 0 ? "you lent" : "you borrowed"}</span>
                    <strong>{formatMoney(Math.abs(net), e.currency)}</strong>
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
