"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton, type FormAction } from "./forms";
import { CATEGORIES, RECURRENCES } from "@/lib/constants";
import { CURRENCIES, formatMoney, parseMoney } from "@/lib/money";
import { allocate } from "@/lib/splits";

type Person = { id: string; name: string };
type GroupOpt = { id: string; name: string; currency: string; members: Person[] };
type SplitType = "equal" | "exact" | "percent" | "shares";

export type ExpenseFormInitial = {
  id?: string;
  groupId: string | null;
  description: string;
  amount: string;
  currency: string;
  date: string;
  category: string;
  notes: string;
  recurrence: string;
  splitType: SplitType;
  payers: { userId: string; amount: string }[];
  participants: { userId: string; value: string }[];
};

const SPLIT_LABELS: Record<SplitType, string> = { equal: "Equally", exact: "Exact amounts", percent: "Percentages", shares: "Shares" };

export function ExpenseForm({ action, me, groups, friends, initial }: { action: FormAction; me: Person; groups: GroupOpt[]; friends: Person[]; initial: ExpenseFormInitial }) {
  const [groupId, setGroupId] = useState<string | null>(initial.groupId);
  const [description, setDescription] = useState(initial.description);
  const [amount, setAmount] = useState(initial.amount);
  const [currency, setCurrency] = useState(initial.currency);
  const [date, setDate] = useState(initial.date);
  const [category, setCategory] = useState(initial.category);
  const [notes, setNotes] = useState(initial.notes);
  const [recurrence, setRecurrence] = useState(initial.recurrence);
  const [splitType, setSplitType] = useState<SplitType>(initial.splitType);
  const [payers, setPayers] = useState<Record<string, string>>(Object.fromEntries(initial.payers.map((p) => [p.userId, p.amount])));
  const [included, setIncluded] = useState<Set<string>>(new Set(initial.participants.map((p) => p.userId)));
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(initial.participants.map((p) => [p.userId, p.value])));

  const people: Person[] = useMemo(() => {
    if (groupId) return groups.find((g) => g.id === groupId)?.members ?? [];
    return [me, ...friends];
  }, [groupId, groups, friends, me]);

  const amountCents = parseMoney(amount) ?? 0;
  const payerIds = Object.keys(payers).filter((id) => people.some((p) => p.id === id));
  const multiPayer = payerIds.length > 1;
  const chosen = people.filter((p) => included.has(p.id));

  // live preview of what each person owes, same maths as the server
  const preview = useMemo(() => {
    const out = new Map<string, number>();
    try {
      if (splitType === "equal" && chosen.length) allocate(amountCents, chosen.map(() => 1)).forEach((c, i) => out.set(chosen[i].id, c));
      if (splitType === "exact") chosen.forEach((p) => out.set(p.id, parseMoney(values[p.id] ?? "") ?? 0));
      if (splitType === "percent" || splitType === "shares") {
        const w = chosen.map((p) => Math.max(0, Math.round((Number(values[p.id]) || 0) * 10000)));
        if (w.some((x) => x > 0)) allocate(amountCents, w).forEach((c, i) => out.set(chosen[i].id, c));
      }
    } catch {
      /* preview only */
    }
    return out;
  }, [splitType, chosen, values, amountCents]);

  const status = useMemo(() => {
    if (splitType === "exact") {
      const sum = chosen.reduce((a, p) => a + (parseMoney(values[p.id] ?? "") ?? 0), 0);
      return { ok: sum === amountCents, text: `${formatMoney(sum, currency)} of ${formatMoney(amountCents, currency)}` };
    }
    if (splitType === "percent") {
      const sum = chosen.reduce((a, p) => a + (Number(values[p.id]) || 0), 0);
      return { ok: Math.abs(sum - 100) < 1e-9, text: `${sum.toFixed(2)}% of 100%` };
    }
    return null;
  }, [splitType, chosen, values, amountCents, currency]);

  const paidSum = payerIds.reduce((a, id) => a + (parseMoney(payers[id] ?? "") ?? 0), 0);

  function switchGroup(next: string) {
    const gid = next || null;
    setGroupId(gid);
    const list = gid ? groups.find((g) => g.id === gid)?.members ?? [] : [me, ...friends];
    setIncluded(new Set(list.map((p) => p.id)));
    setPayers({ [me.id]: "" });
    const g = groups.find((x) => x.id === gid);
    if (g && !initial.id) setCurrency(g.currency);
  }

  const payload = JSON.stringify({
    id: initial.id,
    groupId,
    description,
    amount,
    currency,
    date,
    category,
    notes,
    recurrence,
    splitType,
    payers: payerIds.map((id) => ({ userId: id, amount: multiPayer ? payers[id] || "0" : amount })),
    participants: chosen.map((p) => ({ userId: p.id, value: values[p.id] ?? "" })),
  });

  return (
    <ActionForm action={action} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="group">With</label>
          <select id="group" className="field" value={groupId ?? ""} onChange={(e) => switchGroup(e.target.value)} disabled={!!initial.id}>
            <option value="">No group (you and friends)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <input id="description" className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} required placeholder="Groceries, rent, cabin deposit..." />
        </div>
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <div className="flex gap-2">
            <select aria-label="Currency" className="field w-24" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input id="amount" className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="recurrence">Repeats</label>
          <select id="recurrence" className="field" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {RECURRENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="card p-4">
        <legend className="float-left mb-3 w-full text-sm font-semibold">Who paid</legend>
        <ul className="clear-both space-y-2">
          {people.map((p) => {
            const on = p.id in payers;
            return (
              <li key={p.id} className="flex items-center gap-3">
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const next = { ...payers };
                      if (e.target.checked) next[p.id] = "";
                      else delete next[p.id];
                      setPayers(next);
                    }}
                  />
                  {p.id === me.id ? "You" : p.name}
                </label>
                {on && multiPayer && (
                  <input aria-label={`Amount ${p.name} paid`} className="field w-32" inputMode="decimal" value={payers[p.id]} onChange={(e) => setPayers({ ...payers, [p.id]: e.target.value })} placeholder="0.00" />
                )}
              </li>
            );
          })}
        </ul>
        {multiPayer && (
          <p className={`mt-2 text-xs ${paidSum === amountCents ? "text-muted" : "text-danger"}`}>
            Paid {formatMoney(paidSum, currency)} of {formatMoney(amountCents, currency)}
          </p>
        )}
      </fieldset>

      <fieldset className="card p-4">
        <legend className="float-left mb-3 w-full text-sm font-semibold">Split</legend>
        <div role="tablist" aria-label="Split type" className="clear-both mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-bg/60 p-1 shadow-[inset_0_0_0_1px_rgb(var(--c-border)/0.8)] sm:inline-grid sm:grid-cols-4 sm:rounded-full">
          {(Object.keys(SPLIT_LABELS) as SplitType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={splitType === t}
              onClick={() => setSplitType(t)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${splitType === t ? "bg-accent text-on-accent shadow" : "text-text hover:bg-bg"}`}
            >
              {SPLIT_LABELS[t]}
            </button>
          ))}
        </div>
        <ul className="clear-both space-y-2">
          {people.map((p) => {
            const on = included.has(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const next = new Set(included);
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                      setIncluded(next);
                    }}
                  />
                  <span className="truncate">{p.id === me.id ? "You" : p.name}</span>
                </label>
                {on && splitType !== "equal" && (
                  <div className="flex items-center gap-1">
                    <input
                      aria-label={`${SPLIT_LABELS[splitType]} for ${p.name}`}
                      className="field w-24"
                      inputMode="decimal"
                      value={values[p.id] ?? ""}
                      onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
                      placeholder={splitType === "shares" ? "1" : "0"}
                    />
                    <span className="w-4 text-xs text-muted">{splitType === "percent" ? "%" : ""}</span>
                  </div>
                )}
                <span className="w-24 text-right text-sm tabular-nums text-muted">{on ? formatMoney(preview.get(p.id) ?? 0, currency) : "-"}</span>
              </li>
            );
          })}
        </ul>
        {status && <p className={`mt-3 text-xs ${status.ok ? "text-muted" : "text-danger"}`}>{status.text}</p>}
      </fieldset>

      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" className="field" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <SubmitButton>{initial.id ? "Save changes" : "Save expense"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
