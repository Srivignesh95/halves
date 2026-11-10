import Link from "next/link";
import { verifySignup } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Check your email" };

export default async function VerifySignup({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const email = ((await searchParams).email ?? "").slice(0, 320);
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Check your email</h1>
      <p className="mb-4 text-sm text-muted">
        We sent a 6-digit code to <strong className="text-text">{email || "your email"}</strong>. Enter it to finish signing up. It works for 15 minutes.
      </p>
      <ActionForm action={verifySignup} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <div>
          <label className="label" htmlFor="code">Code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus
            className="field text-center font-mono text-2xl tracking-[0.5em]" placeholder="000000" />
        </div>
        <SubmitButton className="w-full">Finish signing up</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-muted">
        No email? Check Spam, or <Link className="link" href={`/signup?email=${encodeURIComponent(email)}`}>go back and try again</Link>.
      </p>
    </>
  );
}
