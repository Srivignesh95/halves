"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { Button, Flash } from "./ui";

export type ActionState = { error?: string; ok?: string } | undefined;
export type FormAction = (prev: ActionState, data: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

export function SubmitButton({ children, variant = "primary", size = "md", className = "" }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; className?: string }) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending} className={className}>
      {children}
    </Button>
  );
}

/**
 * A form bound to a server action that returns { error } or { ok }. Shows the message and blocks double submit.
 * Fields keep what the person typed when the action returns an error (React would otherwise clear them);
 * pass resetOnSuccess to clear the form after a successful submit, e.g. a comment box.
 */
export function ActionForm({ action, children, className = "", confirm, resetOnSuccess = false }: { action: FormAction; children: ReactNode; className?: string; confirm?: string; resetOnSuccess?: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !pending && resetOnSuccess && !state?.error) ref.current?.reset();
    if (!pending) submitted.current = false;
  }, [state, pending, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(e.currentTarget);
        submitted.current = true;
        startTransition(() => formAction(data));
      }}
    >
      {state?.error && <div className="mb-3"><Flash kind="error">{state.error}</Flash></div>}
      {state?.ok && <div className="mb-3"><Flash kind="ok">{state.ok}</Flash></div>}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}
