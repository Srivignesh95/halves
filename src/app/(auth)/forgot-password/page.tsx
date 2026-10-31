import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/password";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPassword() {
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Forgot your password?</h1>
      <p className="mb-4 text-sm text-muted">Enter the email you signed up with and we&apos;ll send you a link to choose a new one.</p>
      <ActionForm action={requestPasswordReset} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <SubmitButton className="w-full">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-muted"><Link className="link" href="/login">Back to log in</Link></p>
    </>
  );
}
