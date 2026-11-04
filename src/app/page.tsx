import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Avatar, LinkButton } from "@/components/ui";
import { Logo } from "@/components/logo";

const points = [
  { t: "Split it any way", d: "Equally, by exact amounts, by percentage or by shares. Several people can pay for one bill.", i: "M12 3v18M3 12h18" },
  { t: "Know where you stand", d: "One number per person, across every group and every currency.", i: "M4 19V9M10 19V5M16 19v-7M22 19H2" },
  { t: "Fewer payments", d: "Simplify debts turns a tangle of IOUs into the fewest transfers that settle everyone.", i: "M4 7h11l-3-3M20 17H9l3 3" },
  { t: "Nothing gets lost", d: "Edit history, comments, and deleted expenses you can bring back.", i: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" },
];

// Illustration of the dashboard with made-up names, so visitors see what they get.
const preview = [
  { id: "p1", name: "Maya", text: "owes you", amount: "$42.50", owed: true },
  { id: "p2", name: "Jordan", text: "you owe", amount: "$18.00", owed: false },
  { id: "p3", name: "Priya", text: "owes you", amount: "$7.25", owed: true },
];

export default async function Landing() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo size={32} />
        <nav className="flex gap-2">
          <LinkButton href="/login" variant="ghost">Log in</LinkButton>
          <LinkButton href="/signup">Sign up</LinkButton>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-owed" /> Free. No ads. No daily limits.
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Shared costs,
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-transparent">without the awkward maths.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">Log what you paid for roommates, trips and dinners. Halves keeps a running tally so nobody has to.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup">Start free</LinkButton>
            <LinkButton href="/login" variant="secondary">I have an account</LinkButton>
          </div>
        </div>

        <div aria-hidden className="relative mx-auto w-full max-w-sm">
          <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-accent/30 via-transparent to-owed/20 blur-2xl" />
          <div className="card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Total balance</div>
            <div className="mt-1 text-4xl font-extrabold tracking-tight text-owed">+$31.75</div>
            <ul className="mt-4 space-y-1">
              {preview.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-md px-2 py-2">
                  <Avatar id={p.id} name={p.name} />
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className={`text-sm ${p.owed ? "text-owed" : "text-owe"}`}>
                    <span className="text-xs">{p.text} </span>
                    <strong>{p.amount}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card absolute -bottom-6 -left-4 hidden px-4 py-3 text-sm sm:block">
            <span className="font-semibold">Cabin weekend</span>
            <span className="ml-2 text-muted">split 4 ways</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <ul className="grid gap-4 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p.t} className="card flex gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={p.i} /></svg>
              </span>
              <span>
                <h2 className="font-semibold">{p.t}</h2>
                <p className="mt-1 text-sm text-muted">{p.d}</p>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted">© Halves</footer>
    </main>
  );
}
