import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-surface px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-lg font-bold">Halves</Link>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
