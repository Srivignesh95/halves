"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import type { Slice } from "@/lib/money-report";

const COLORS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)", "var(--viz-6)"];

const colorOf = (s: Slice, i: number) => (s.key === "__other" ? "var(--viz-other)" : COLORS[i % COLORS.length]);
const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);

// a ring segment from angle a0 to a1 (radians, 0 = 12 o'clock, clockwise)
function arc(a0: number, a1: number, r: number, ri: number, c: number) {
  const p = (a: number, rad: number) => `${c + rad * Math.sin(a)} ${c - rad * Math.cos(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} L ${p(a1, ri)} A ${ri} ${ri} 0 ${large} 0 ${p(a0, ri)} Z`;
}

/** Donut of spending by category, with a list of every slice's amount and share. Tap or hover a slice to read it. */
export function CategoryDonut({ slices, currency }: { slices: Slice[]; currency: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.cents, 0);
  const size = 200, c = size / 2, r = 92, ri = 60;
  const shown = active === null ? null : slices[active];

  let a = 0;
  const paths = slices.map((s, i) => {
    const a0 = a;
    a += total > 0 ? (s.cents / total) * Math.PI * 2 : 0;
    return { s, i, a0, a1: a };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-48 w-48 shrink-0" role="img"
        aria-label={`Spending by category: ${slices.map((s) => `${s.label} ${pct(s.cents, total)}%`).join(", ")}`}
        onMouseLeave={() => setActive(null)}>
        {slices.length === 1 ? (
          <circle cx={c} cy={c} r={(r + ri) / 2} fill="none" stroke={colorOf(slices[0], 0)} strokeWidth={r - ri}
            onMouseEnter={() => setActive(0)} onClick={() => setActive(active === 0 ? null : 0)} />
        ) : paths.map(({ s, i, a0, a1 }) => (
          <path key={s.key} d={arc(a0, a1, active === i ? r + 4 : r, ri, c)} fill={colorOf(s, i)}
            // a 2px gap in the card's colour between slices
            stroke="rgb(var(--glass))" strokeWidth={2} strokeLinejoin="round"
            opacity={active === null || active === i ? 1 : 0.45}
            className="cursor-pointer transition-opacity"
            onMouseEnter={() => setActive(i)} onClick={() => setActive(active === i ? null : i)} />
        ))}
        <text x={c} y={c - 6} textAnchor="middle" className="fill-muted text-[11px]">{shown ? shown.label.split(" (")[0] : "Total"}</text>
        <text x={c} y={c + 14} textAnchor="middle" className="fill-text text-[17px] font-bold tabular-nums">{formatMoney(shown ? shown.cents : total, currency)}</text>
        {shown && <text x={c} y={c + 32} textAnchor="middle" className="fill-muted text-[11px] tabular-nums">{pct(shown.cents, total)}%</text>}
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-1 text-sm">
        {slices.map((s, i) => (
          <li key={s.key}>
            <button type="button" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition ${active === i ? "bg-bg/70" : ""}`}>
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: colorOf(s, i) }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="w-12 text-right text-xs tabular-nums text-muted">{pct(s.cents, total)}%</span>
              <strong className="w-24 text-right tabular-nums">{formatMoney(s.cents, currency)}</strong>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
