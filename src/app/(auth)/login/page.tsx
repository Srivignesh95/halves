import Link from "next/link";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Log in" };

export default function Login() {
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Log in</h1>
      <ActionForm action={login} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
        <SubmitButton className="w-full">Log in</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-muted">New here? <Link className="link" href="/signup">Create an account</Link></p>
    </>
  );
}
