import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Sign up" };

export default function Signup() {
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Create your account</h1>
      <p className="mb-4 text-sm text-muted">If a friend already added you, use the same email and your shared expenses will be waiting.</p>
      <ActionForm action={signup} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" autoComplete="name" required maxLength={60} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" aria-describedby="pw-hint" />
          <p id="pw-hint" className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>
        <SubmitButton className="w-full">Sign up</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-muted">Already have an account? <Link className="link" href="/login">Log in</Link></p>
    </>
  );
}
