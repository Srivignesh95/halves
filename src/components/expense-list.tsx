import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
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
    <ul className="divide-y divide-border rounded-md border border-border">
      {expenses.map((e) => {
        const month = e.date.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
        const header = month !== lastMonth ? ((lastMonth = month), month) : null;
        const { payerText, net, mine } = myLine(e, me);
        return (
          <li key={e.id}>
            {header && <div className="bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{header}</div>}
            <Link href={`/expenses/${e.id}`} className={`flex items-center gap-4 px-4 py-3 hover:bg-surface ${e.deletedAt ? "opacity-60" : ""}`}>
              <span className="w-12 shrink-0 text-center text-xs text-muted">{formatDate(e.date).split(",")[0]}</span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-medium ${e.deletedAt ? "line-through" : ""}`}>
                  {e.isPayment ? "Payment" : e.description}
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
