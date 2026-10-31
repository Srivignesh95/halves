import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-bold">Not here</h1>
      <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/dashboard" className="link mt-6 inline-block">Back to your dashboard</Link>
    </main>
  );
}
