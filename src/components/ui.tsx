import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatMoney } from "@/lib/money";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-accent-hover to-accent text-on-accent shadow-[0_6px_16px_-6px_rgb(var(--c-accent)/0.6)] hover:brightness-110 active:translate-y-px",
  secondary: "glass text-text hover:bg-bg/90 active:translate-y-px",
  ghost: "text-accent hover:bg-accent/10",
  danger: "bg-danger text-on-accent shadow-[0_6px_16px_-6px_rgb(var(--c-danger)/0.6)] hover:brightness-110 active:translate-y-px",
};
export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
    size === "sm" ? "h-8 px-3.5 text-xs" : "h-11 px-5 text-sm"
  } ${variants[variant]}`;
}

export function Button({ variant = "primary", size = "md", className = "", ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...rest} />;
}

export function LinkButton({ variant = "primary", size = "md", className = "", ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...rest} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="glass rounded-lg px-6 py-12 text-center">
      <svg aria-hidden width="44" height="44" viewBox="0 0 64 64" className="mx-auto mb-3 opacity-80">
        <path d="M30 14 A18 18 0 0 0 30 50 Z" fill="rgb(var(--c-accent))" />
        <path d="M34 14 A18 18 0 0 1 34 50 Z" fill="none" stroke="rgb(var(--c-accent))" strokeWidth="4" />
      </svg>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

const tints = ["bg-accent/15 text-accent", "bg-owed/15 text-owed", "bg-owe/15 text-owe", "bg-text/10 text-text", "bg-accent/25 text-accent-hover", "bg-muted/20 text-text"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Avatar({ id, name, size = 32, v }: { id: string; name: string; size?: number; v?: number }) {
  if (UUID.test(id)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/avatar/${id}${v ? `?v=${v}` : ""}`} alt="" aria-hidden width={size} height={size} loading="lazy" decoding="async"
        className="shrink-0 rounded-full bg-surface object-cover" style={{ width: size, height: size }} />
    );
  }
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full text-xs font-bold ${tints[h % tints.length]}`} style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

/** Positive = they owe you. Words carry the direction, colour backs it up. */
export function Balance({ amounts, owesYou = "owes you", youOwe = "you owe", align = "right" }: { amounts: [string, number][]; owesYou?: string; youOwe?: string; align?: "left" | "right" }) {
  if (amounts.length === 0) return <span className="text-sm text-muted">settled up</span>;
  return (
    <span className={`flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      {amounts.map(([c, v]) => (
        <span key={c} className={`text-sm ${v > 0 ? "text-owed" : "text-owe"}`}>
          <span className="text-xs">{v > 0 ? owesYou : youOwe} </span>
          <strong>{formatMoney(Math.abs(v), c)}</strong>
        </span>
      ))}
    </span>
  );
}

export function Flash({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-md border px-3.5 py-2.5 text-sm font-medium ${kind === "error" ? "border-danger/30 bg-danger/10 text-danger" : "border-success/30 bg-success/10 text-success"}`}>
      {children}
    </p>
  );
}
