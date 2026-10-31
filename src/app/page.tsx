import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LinkButton } from "@/components/ui";

export default async function Landing() {
  if (await currentUser()) redirect("/dashboard");
  const points = [
    ["Split it any way", "Equally, by exact amounts, by percentage or by shares. Several people can pay for one bill."],
    ["Know where you stand", "One number per person, across every group and every currency."],
    ["Fewer payments", "Simplify debts turns a tangle of IOUs into the fewest transfers that settle everyone."],
    ["Nothing gets lost", "Edit history, comments, and deleted expenses you can bring back."],
  ];
  return (
    <main>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="text-lg font-bold">Halves</span>
        <nav className="flex gap-2">
          <LinkButton href="/login" variant="ghost">Log in</LinkButton>
          <LinkButton href="/signup">Sign up</LinkButton>
        </nav>
      </header>
      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Shared costs, without the awkward maths.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">Log what you paid for roommates, trips and dinners. Halves keeps a running tally so nobody has to.</p>
        <div className="mt-8 flex gap-3">
          <LinkButton href="/signup">Start free</LinkButton>
          <LinkButton href="/login" variant="secondary">I have an account</LinkButton>
        </div>
      </section>
      <section className="border-t border-border bg-surface">
        <ul className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-2">
          {points.map(([t, d]) => (
            <li key={t} className="card p-5">
              <h2 className="font-semibold">{t}</h2>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ul>
      </section>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-xs text-muted">Halves. No ads, no daily limits.</footer>
    </main>
  );
}
