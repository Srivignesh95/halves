"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, Flash } from "./ui";

export type ActionState = { error?: string; ok?: string } | undefined;
export type FormAction = (prev: ActionState, data: FormData) => Promise<ActionState>;

export function SubmitButton({ children, variant = "primary", size = "md", className = "" }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending} className={className}>
      {children}
    </Button>
  );
}

/** A form bound to a server action that returns { error } or { ok }. Shows the message, blocks double submit. */
export function ActionForm({ action, children, className = "", confirm }: { action: FormAction; children: ReactNode; className?: string; confirm?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {state?.error && <div className="mb-3"><Flash kind="error">{state.error}</Flash></div>}
      {state?.ok && <div className="mb-3"><Flash kind="ok">{state.ok}</Flash></div>}
      {children}
    </form>
  );
}
