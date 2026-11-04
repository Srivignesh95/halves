"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A sidebar / tab link that highlights itself on the current page (or a page under it). */
export function NavLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  const path = usePathname() ?? "";
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2.5 truncate rounded-md px-3 py-2 transition ${
        active ? "bg-accent/10 font-semibold text-accent shadow-[inset_0_0_0_1px_rgb(var(--c-accent)/0.18)]" : "text-text/85 hover:bg-bg/60 hover:text-text"
      } ${className}`}
    >
      {children}
    </Link>
  );
}
