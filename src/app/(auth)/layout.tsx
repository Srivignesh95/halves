import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-16 sm:items-center">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex justify-center" aria-label="Halves home"><Logo size={34} /></Link>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
