"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { localTodayISO } from "@/lib/dates";
import { ActionForm, SubmitButton, type FormAction } from "./forms";
import { Button, Flash } from "./ui";
import { scanReceipt } from "@/app/actions/receipt";
import { CURRENCIES, centsToInput, formatMoney, isCurrency, parseMoney } from "@/lib/money";
import { MONEY_CATEGORIES, PAYMENT_KINDS, paymentKindLabel } from "@/lib/money-categories";
import { shrinkPhoto } from "@/lib/image-client";
import { allocate } from "@/lib/splits";
import { isStaleDeployError, reloadForNewVersion } from "@/lib/stale";

type Person = { id: string; name: string };
type GroupOpt = { id: string; name: string; currency: string; members: Person[] };
type SplitType = "equal" | "exact" | "percent" | "shares";
type PaymentOpt = { id: string; kind: string; label: string; last4: string | null; name: string };
type Item = { key: number; name: string; amount: string; category: string };

export type MoneyFormInitial = {
  id?: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  category: string;
  notes: string;
  paymentId: string;
  items: { name: string; amount: string; category: string }[];
  /** already split on Halves: amount and currency are changed there */
  linked?: boolean;
};

const SPLIT_LABELS: Record<SplitType, string> = { equal: "Equally", exact: "Amounts", percent: "Percent", shares: "Shares" };

export function MoneyForm({ action, me, groups, friends, payments, customCategories, initial }: {
  action: FormAction;
  me: Person;
  groups: GroupOpt[];
  friends: Person[];
  payments: PaymentOpt[];
  customCategories: { key: string; name: string }[];
  initial: MoneyFormInitial;
}) {
  const editing = !!initial.id;
  const [description, setDescription] = useState(initial.description);
  const [amount, setAmount] = useState(initial.amount);
  const [currency, setCurrency] = useState(initial.currency);
  const [date, setDate] = useState(initial.date);
  const [category, setCategory] = useState(initial.category);
  const [notes, setNotes] = useState(initial.notes);
  const [items, setItems] = useState<Item[]>(initial.items.map((it, i) => ({ key: i, ...it })));
  // the server only knows today in UTC; a new expense defaults to today where you are
  useEffect(() => {
    if (!editing) setDate((d) => (d === initial.date ? localTodayISO() : d));
  }, [editing, initial.date]);

  // payment: an existing id, "new", or "" (not picked yet)
  const [paymentId, setPaymentId] = useState(initial.paymentId);
  const [newKind, setNewKind] = useState("credit_card");
  const [newLabel, setNewLabel] = useState("");
  const [newLast4, setNewLast4] = useState("");

  // split on Halves
  const [split, setSplit] = useState(false);
  const [withWho, setWithWho] = useState(""); // "g:<id>" or "f:<id>"
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});

  // receipt scanning
  const fileInput = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const categoryOptions = [...MONEY_CATEGORIES.map(([k, l]) => ({ key: k as string, name: l as string })), ...customCategories];

  async function onPick(file?: File) {
    setScanError(null);
    if (!file) return;
    setScanning(true);
    setScanNote("Preparing the photo…");
    try {
      const blob = await shrinkPhoto(file, 2400, () => setScanNote("Converting your iPhone photo…"));
      setScanNote("Reading the receipt…");
      const data = new FormData();
      data.set("receipt", new File([blob], "receipt.jpg", { type: "image/jpeg" }));
      const res = await scanReceipt(data);
      if (!res.ok) throw new Error(res.error);
      const r = res.receipt;
      setDescription((r.merchant || "Receipt").slice(0, 120));
      setAmount(centsToInput(r.totalCents));
      if (r.date) setDate(r.date);
      if (r.currency && isCurrency(r.currency)) setCurrency(r.currency);
      setCategory(r.category);
      setItems(r.items.map((it, i) => ({ key: i, name: it.name, amount: centsToInput(it.priceCents), category: it.category })));

      let how = "";
      if (r.payment) {
        const p = r.payment;
        const match =
          (p.last4 && payments.find((m) => m.last4 === p.last4)) ||
          (!p.last4 && payments.find((m) => m.kind === p.kind && (!p.brand || m.label.toLowerCase() === p.brand.toLowerCase())));
        if (match) {
          setPaymentId(match.id);
          how = ` Paid with ${match.name}.`;
        } else {
          setPaymentId("new");
          setNewKind(p.kind);
          setNewLabel(p.brand || paymentKindLabel(p.kind));
          setNewLast4(p.last4);
          how = " Found a new payment method; check it below.";
        }
      } else {
        setPaymentId("");
        how = " The receipt doesn't show how you paid, so pick it below.";
      }
      setScanNote(`Read ${r.items.length} item${r.items.length === 1 ? "" : "s"}. Check everything before saving.${how} ${res.left} scan${res.left === 1 ? "" : "s"} left today.`);
    } catch (e) {
      if (isStaleDeployError(e) && reloadForNewVersion()) return;
      const msg = (e as Error).message;
      setScanError(msg === "unreadable" ? "That photo couldn't be opened. Try a JPEG or PNG." : msg);
      setScanNote(null);
    } finally {
      setScanning(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  // who the split is with
  const people: Person[] = useMemo(() => {
    if (withWho.startsWith("g:")) return groups.find((g) => g.id === withWho.slice(2))?.members ?? [];
    if (withWho.startsWith("f:")) {
      const f = friends.find((x) => x.id === withWho.slice(2));
      return f ? [me, f] : [];
    }
    return [];
  }, [withWho, groups, friends, me]);

  function pickWho(v: string) {
    setWithWho(v);
    let list: Person[] = [];
    if (v.startsWith("g:")) list = groups.find((g) => g.id === v.slice(2))?.members ?? [];
    if (v.startsWith("f:")) list = [me, ...friends.filter((f) => f.id === v.slice(2))];
    setIncluded(new Set(list.map((p) => p.id)));
    setValues({});
  }

  const amountCents = parseMoney(amount) ?? 0;
  const chosen = people.filter((p) => included.has(p.id));
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
  const splitStatus = useMemo(() => {
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

  const itemsSum = items.reduce((a, it) => a + (parseMoney(it.amount) ?? 0), 0);
  const setItem = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const payload = JSON.stringify({
    id: initial.id,
    description,
    amount,
    currency,
    date,
    category,
    notes,
    payment: paymentId === "new" ? { create: { kind: newKind, label: newLabel, last4: newLast4 } } : paymentId ? { id: paymentId } : null,
    items: items.map((it) => ({ name: it.name, amount: it.amount || "0", category: it.category })),
    split: split && !editing
      ? {
          groupId: withWho.startsWith("g:") ? withWho.slice(2) : null,
          splitType,
          participants: chosen.map((p) => ({ userId: p.id, value: values[p.id] ?? "" })),
        }
      : null,
  });

  return (
    <ActionForm action={action} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      {!editing && (
        <section className="card p-4" aria-label="Receipt">
          <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Have a receipt or screenshot?</h2>
              <p className="text-xs text-muted" aria-live="polite">{scanNote ?? "Bills, online orders and UPI screenshots. Fills in everything below, with a category for each item."}</p>
            </div>
            <Button type="button" size="sm" disabled={scanning} aria-busy={scanning} onClick={() => fileInput.current?.click()}>
              {scanning ? "Reading…" : "Scan a receipt"}
            </Button>
          </div>
          {scanError && <div className="mt-3"><Flash kind="error">{scanError}</Flash></div>}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <input id="description" className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} required placeholder="Shop, restaurant, bill..." />
        </div>
        <div>
          <label className="label" htmlFor="amount">Amount{initial.linked ? " (change it on Halves)" : ""}</label>
          <div className="flex gap-2">
            <select aria-label="Currency" className="field w-24" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={initial.linked}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input id="amount" className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required disabled={initial.linked} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
          <Link href="/money/settings#categories" className="link mt-1 inline-block text-xs">Add your own category</Link>
        </div>
        <div>
          <label className="label" htmlFor="payment">Paid with</label>
          <select id="payment" className="field" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} required>
            <option value="" disabled>Pick how you paid</option>
            {payments.map((p) => <option key={p.id} value={p.id}>{p.name} · {paymentKindLabel(p.kind)}</option>)}
            <option value="new">+ Add a new one</option>
          </select>
        </div>
      </div>

      {paymentId === "new" && (
        <fieldset className="card grid gap-3 p-4 sm:grid-cols-3">
          <legend className="sr-only">New payment method</legend>
          <div>
            <label className="label" htmlFor="newKind">Type</label>
            <select id="newKind" className="field" value={newKind} onChange={(e) => setNewKind(e.target.value)}>
              {PAYMENT_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="newLabel">Name</label>
            <input id="newLabel" className="field" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={40} placeholder="Amex Cobalt, Cash, GPay..." />
          </div>
          <div>
            <label className="label" htmlFor="newLast4">Last 4 digits (optional)</label>
            <input id="newLast4" className="field" inputMode="numeric" value={newLast4} onChange={(e) => setNewLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" />
          </div>
          <p className="text-xs text-muted sm:col-span-3">It&apos;s remembered for next time. Never enter the full card number.</p>
        </fieldset>
      )}

      {items.length > 0 && (
        <fieldset className="card p-4">
          <legend className="float-left mb-2 w-full text-sm font-semibold">Items</legend>
          <ul className="clear-both divide-y divide-border/60">
            {items.map((it) => (
              <li key={it.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-2 sm:grid-cols-[1fr_10rem_6rem_auto]">
                <input aria-label="Item name" className="field col-span-3 sm:col-span-1" value={it.name} onChange={(e) => setItem(it.key, { name: e.target.value })} />
                <select aria-label={`Category of ${it.name}`} className="field" value={it.category} onChange={(e) => setItem(it.key, { category: e.target.value })}>
                  {categoryOptions.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
                <input aria-label={`Price of ${it.name}`} className="field w-24 text-right" inputMode="decimal" value={it.amount} onChange={(e) => setItem(it.key, { amount: e.target.value })} />
                <button type="button" aria-label={`Remove ${it.name}`} className="rounded-full px-2 py-1 text-muted hover:bg-bg/60 hover:text-danger" onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}>×</button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setItems((xs) => [...xs, { key: Date.now(), name: "", amount: "", category }])}>+ Add a line</Button>
            <p className="text-xs text-muted">
              Items add up to {formatMoney(itemsSum, currency)}. Tax and tip are shared across the item categories.
            </p>
          </div>
        </fieldset>
      )}
      {items.length === 0 && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setItems([{ key: Date.now(), name: description, amount: amount, category }])}>
          + Split into items with different categories
        </Button>
      )}

      {!editing && (
        <fieldset className="card p-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" checked={split} onChange={(e) => setSplit(e.target.checked)} />
            <span>
              <strong className="block">Split on Halves</strong>
              <span className="text-muted">Adds it to Halves as paid by you. Only your share counts as your spending.</span>
            </span>
          </label>
          {split && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="withWho">Split with</label>
                <select id="withWho" className="field" value={withWho} onChange={(e) => pickWho(e.target.value)}>
                  <option value="" disabled>Pick a friend or group</option>
                  {friends.length > 0 && <optgroup label="Friends">{friends.map((f) => <option key={f.id} value={`f:${f.id}`}>{f.name}</option>)}</optgroup>}
                  {groups.length > 0 && <optgroup label="Groups">{groups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>}
                </select>
                {friends.length === 0 && groups.length === 0 && <p className="mt-1 text-xs text-muted">Add a friend or group on Halves first.</p>}
              </div>
              {people.length > 0 && (
                <>
                  <div role="tablist" aria-label="Split type" className="grid grid-cols-4 gap-1 rounded-full bg-bg/60 p-1 shadow-[inset_0_0_0_1px_rgb(var(--c-border)/0.8)]">
                    {(Object.keys(SPLIT_LABELS) as SplitType[]).map((t) => (
                      <button key={t} type="button" role="tab" aria-selected={splitType === t} onClick={() => setSplitType(t)}
                        className={`rounded-full px-2 py-2 text-xs font-semibold transition ${splitType === t ? "bg-accent text-on-accent shadow" : "text-text hover:bg-bg"}`}>
                        {SPLIT_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <ul className="space-y-2">
                    {people.map((p) => {
                      const on = included.has(p.id);
                      return (
                        <li key={p.id} className="flex items-center gap-3">
                          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                            <input type="checkbox" checked={on} onChange={(e) => {
                              const next = new Set(included);
                              if (e.target.checked) next.add(p.id); else next.delete(p.id);
                              setIncluded(next);
                            }} />
                            <span className="truncate">{p.id === me.id ? "You" : p.name}</span>
                          </label>
                          {on && splitType !== "equal" && (
                            <div className="flex items-center gap-1">
                              <input aria-label={`${SPLIT_LABELS[splitType]} for ${p.name}`} className="field w-20" inputMode="decimal" value={values[p.id] ?? ""}
                                onChange={(e) => setValues({ ...values, [p.id]: e.target.value })} placeholder={splitType === "shares" ? "1" : "0"} />
                              <span className="w-4 text-xs text-muted">{splitType === "percent" ? "%" : ""}</span>
                            </div>
                          )}
                          <span className="w-24 text-right text-sm tabular-nums text-muted">{on ? formatMoney(preview.get(p.id) ?? 0, currency) : "-"}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {splitStatus && <p className={`text-xs ${splitStatus.ok ? "text-muted" : "text-danger"}`}>{splitStatus.text}</p>}
                  <p className="rounded-md bg-accent/10 px-3 py-2 text-xs font-medium text-accent">
                    Your share: {formatMoney(preview.get(me.id) ?? 0, currency)}. That&apos;s what counts in your monthly spending.
                  </p>
                </>
              )}
            </div>
          )}
        </fieldset>
      )}

      <div>
        <label className="label" htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" className="field" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <SubmitButton>{editing ? "Save changes" : "Save expense"}</SubmitButton>
    </ActionForm>
  );
}
