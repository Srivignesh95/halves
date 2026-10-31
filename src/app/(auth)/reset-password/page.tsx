import Link from "next/link";
import { checkResetToken, resetPassword } from "@/app/actions/password";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const found = await checkResetToken(token);
  if (!found) {
    return (
      <>
        <h1 className="mb-2 text-xl font-bold">This link doesn&apos;t work any more</h1>
        <p className="mb-4 text-sm text-muted">Reset links expire after 30 minutes and only work once.</p>
        <Link className="link text-sm" href="/forgot-password">Send me a new link</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Choose a new password</h1>
      <p className="mb-4 text-sm text-muted">For {found.user.email}. You&apos;ll be signed out on every other device.</p>
      <ActionForm action={resetPassword} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" aria-describedby="pw-hint" />
          <p id="pw-hint" className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>
        <div>
          <label className="label" htmlFor="confirm">Type it again</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="field" />
        </div>
        <SubmitButton className="w-full">Save new password</SubmitButton>
      </ActionForm>
    </>
  );
}
