"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { scanReceipt } from "@/app/actions/receipt";
import type { ScannedReceipt } from "@/lib/receipt";
import { splitByItem, type TipMode } from "@/lib/itemize";
import { formatMoney, parseMoney, centsToInput } from "@/lib/money";
import { shrinkPhoto } from "@/lib/image-client";
import { Button, Flash } from "./ui";

type Person = { id: string; name: string };
type Item = { key: number; name: string; price: string; taxed: boolean; taxCodes: string[]; people: string[] };
type Tax = { key: number; label: string; code?: string; amount: string };

export type ReceiptFill = { description?: string; amount?: string; date?: string; currency?: string };
export type ItemSplit = { amountCents: number; owed: Record<string, number> } | null;

/**
 * "Scan a receipt": reads the photo with Claude, fills in the expense, and optionally splits it item by item.
 * onFill: put merchant, total, date and currency into the form.
 * onItemSplit: the exact amount each person owes from the items (null = go back to the normal split).
 */
export function ReceiptPanel({ people, me, currency, onFill, onItemSplit }: {
  people: Person[];
  me: string;
  currency: string;
  onFill: (f: ReceiptFill) => void;
  onItemSplit: (s: ItemSplit) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "done">("idle");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ScannedReceipt | null>(null);
  const [mode, setMode] = useState<"total" | "items">("total");
  const [items, setItems] = useState<Item[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [discount, setDiscount] = useState("0.00");
  const [tip, setTip] = useState("0.00");
  const [tipMode, setTipMode] = useState<TipMode>("proportional");

  async function onPick(file?: File) {
    setError(null);
    if (!file) return;
    setStatus("reading");
    setNote("Preparing the photo…");
    try {
      const blob = await shrinkPhoto(file, 2400, () => setNote("Converting your iPhone photo…"));
      setNote("Reading the receipt…");
      const data = new FormData();
      data.set("receipt", new File([blob], "receipt.jpg", { type: "image/jpeg" }));
      const res = await scanReceipt(data);
      if (!res.ok) throw new Error(res.error);
      const r = res.receipt;
      setReceipt(r);
      const everyone = people.map((p) => p.id);
      setItems(r.items.map((it, i) => ({ key: i, name: it.name, price: centsToInput(it.priceCents), taxed: it.taxed, taxCodes: it.taxCodes, people: everyone })));
      setTaxes(r.taxes.map((t, i) => ({ key: i, label: t.label, code: t.code, amount: centsToInput(t.amountCents) })));
      setDiscount(centsToInput(r.discountCents));
      setTip(centsToInput(r.tipCents));
      setMode("total");
      onItemSplit(null);
      onFill({ description: r.merchant || "Receipt", amount: centsToInput(r.totalCents), date: r.date || undefined, currency: r.currency || undefined });
      setStatus("done");
      setNote(`${res.left} scan${res.left === 1 ? "" : "s"} left today.`);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === "unreadable" ? "That photo couldn't be opened. Try a JPEG or PNG." : msg);
      setStatus(receipt ? "done" : "idle");
      setNote(null);
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  // live item-by-item result
  const result = useMemo(() => {
    if (mode !== "items") return null;
    try {
      const r = splitByItem({
        items: items.map((it) => ({ name: it.name || "Item", priceCents: parseMoney(it.price) ?? 0, taxed: it.taxed, taxCodes: it.taxCodes, people: it.people })),
        taxes: taxes.map((t) => ({ label: t.label, code: t.code, amountCents: parseMoney(t.amount) ?? 0 })),
        tipCents: parseMoney(tip) ?? 0,
        tipMode,
        discountCents: parseMoney(discount) ?? 0,
      });
      return { ...r, error: null as string | null };
    } catch (e) {
      return { owed: new Map<string, number>(), totalCents: 0, subtotalCents: 0, warnings: [], error: (e as Error).message };
    }
  }, [mode, items, taxes, tip, tipMode, discount]);

  // push the result into the form's split as exact amounts
  useEffect(() => {
    if (mode !== "items" || !result || result.error) { if (mode === "items") onItemSplit(null); return; }
    onItemSplit({ amountCents: result.totalCents, owed: Object.fromEntries(result.owed) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, result]);

  const setItem = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const togglePerson = (it: Item, id: string) => setItem(it.key, { people: it.people.includes(id) ? it.people.filter((p) => p !== id) : [...it.people, id] });
  const short = (p: Person) => (p.id === me ? "You" : p.name.split(" ")[0]);
  const diff = receipt && result && !result.error ? result.totalCents - receipt.totalCents : 0;

  return (
    <section className="card p-4" aria-label="Receipt">
      <input ref={input} id="receipt-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{receipt ? receipt.merchant || "Receipt" : "Have a receipt?"}</h2>
          <p className="text-xs text-muted" aria-live="polite">
            {status === "reading" ? note : receipt ? `Read ${receipt.items.length} item${receipt.items.length === 1 ? "" : "s"}, total ${formatMoney(receipt.totalCents, receipt.currency || currency)}. Check it before saving.${note ? " " + note : ""}` : "Snap a photo and Halves fills in the amount, or splits it item by item."}
          </p>
        </div>
        <Button type="button" size="sm" variant={receipt ? "secondary" : "primary"} disabled={status === "reading"} aria-busy={status === "reading"} onClick={() => input.current?.click()}>
          {status === "reading" ? "Reading…" : receipt ? "Scan another" : "Scan a receipt"}
        </Button>
      </div>
      {error && <div className="mt-3"><Flash kind="error">{error}</Flash></div>}

      {receipt && (
        <>
          <div role="tablist" aria-label="How to split the receipt" className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-bg/60 p-1 shadow-[inset_0_0_0_1px_rgb(var(--c-border)/0.8)]">
            {(["total", "items"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); if (m === "total") { onItemSplit(null); onFill({ amount: centsToInput(receipt.totalCents) }); } }}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${mode === m ? "bg-accent text-on-accent shadow" : "hover:bg-bg"}`}>
                {m === "total" ? "Split the total" : "Split by item"}
              </button>
            ))}
          </div>

          {mode === "items" && (
            <div className="mt-4 space-y-4">
              <ul className="divide-y divide-border/60">
                {items.map((it) => (
                  <li key={it.key} className="space-y-2 py-3">
                    <div className="flex items-center gap-2">
                      <input aria-label="Item name" className="field flex-1" value={it.name} onChange={(e) => setItem(it.key, { name: e.target.value })} />
                      <input aria-label={`Price of ${it.name}`} className="field w-24 text-right" inputMode="decimal" value={it.price} onChange={(e) => setItem(it.key, { price: e.target.value })} />
                      <button type="button" aria-label={`Remove ${it.name}`} className="rounded-full px-2 py-1 text-muted hover:bg-bg/60 hover:text-danger" onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}>×</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {people.map((p) => {
                        const on = it.people.includes(p.id);
                        return (
                          <button key={p.id} type="button" aria-pressed={on} onClick={() => togglePerson(it, p.id)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgb(var(--c-accent)/0.35)]" : "bg-bg/50 text-muted shadow-[inset_0_0_0_1px_rgb(var(--c-border))]"}`}>
                            {short(p)}
                          </button>
                        );
                      })}
                      <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                        <input type="checkbox" checked={it.taxed} onChange={(e) => setItem(it.key, { taxed: e.target.checked })} />
                        Taxed{it.taxCodes.length ? ` (${it.taxCodes.join(", ")})` : ""}
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
              <Button type="button" size="sm" variant="ghost" onClick={() => setItems((xs) => [...xs, { key: Date.now(), name: "", price: "", taxed: true, taxCodes: [], people: people.map((p) => p.id) }])}>+ Add a line</Button>

              <div className="grid gap-3 rounded-md bg-bg/40 p-3 text-sm sm:grid-cols-2">
                {taxes.map((t) => (
                  <label key={t.key} className="flex items-center justify-between gap-2">
                    <span className="text-muted">{t.label}</span>
                    <input className="field w-24 text-right" inputMode="decimal" value={t.amount} onChange={(e) => setTaxes((xs) => xs.map((x) => (x.key === t.key ? { ...x, amount: e.target.value } : x)))} />
                  </label>
                ))}
                <label className="flex items-center justify-between gap-2">
                  <span className="text-muted">Discount on the bill</span>
                  <input className="field w-24 text-right" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span className="text-muted">Tip</span>
                  <input className="field w-24 text-right" inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} />
                </label>
                <label className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                  <span className="whitespace-nowrap text-muted">Share the tip</span>
                  <select className="field w-full sm:w-auto" value={tipMode} onChange={(e) => setTipMode(e.target.value as TipMode)}>
                    <option value="proportional">by what each person ordered</option>
                    <option value="equal">equally</option>
                  </select>
                </label>
              </div>

              {result?.error ? (
                <Flash kind="error">{result.error}</Flash>
              ) : result && (
                <div className="space-y-2">
                  <ul className="text-sm">
                    {people.filter((p) => result.owed.has(p.id)).map((p) => (
                      <li key={p.id} className="flex justify-between py-0.5"><span>{p.id === me ? "You" : p.name}</span><strong className="tabular-nums">{formatMoney(result.owed.get(p.id)!, currency)}</strong></li>
                    ))}
                  </ul>
                  {diff !== 0 && (
                    <Flash kind="error">
                      These lines add up to {formatMoney(result.totalCents, currency)}, but the receipt says {formatMoney(receipt.totalCents, currency)} ({diff > 0 ? "+" : "-"}{formatMoney(Math.abs(diff), currency)}). Check the prices and tax above.
                    </Flash>
                  )}
                  {result.warnings.map((w) => <p key={w} className="text-xs text-muted">{w}</p>)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
