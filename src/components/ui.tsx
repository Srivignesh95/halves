import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatMoney } from "@/lib/money";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-border bg-bg text-text hover:bg-surface",
  ghost: "text-accent hover:bg-surface",
  danger: "bg-danger text-on-accent hover:opacity-90",
};
export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
    size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm"
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
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

const tints = ["bg-accent/15 text-accent", "bg-owed/15 text-owed", "bg-owe/15 text-owe", "bg-text/10 text-text", "bg-accent/25 text-accent-hover", "bg-muted/20 text-text"];
export function Avatar({ id, name, size = 32 }: { id: string; name: string; size?: number }) {
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
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-sm border px-3 py-2 text-sm ${kind === "error" ? "border-danger/40 bg-danger/5 text-danger" : "border-success/40 bg-success/5 text-success"}`}>
      {children}
    </p>
  );
}
