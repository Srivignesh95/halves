# Halves

Split shared costs with friends and groups: add an expense, split it any way, see who
owes whom, simplify debts, settle up. A clean-room rebuild of a popular bill-splitting app's core features (see `replica/recon.md`),
made with the [Replica skill](https://github.com/Jakeschincariol/replica-skill)
(recon, architect, design, build, backend, test, diff).

"Halves" is a working name. Run `/replica-brand` (name checks, logo brief, voice)
before launch.

## Stack

Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind 3 on design
tokens · Postgres · Drizzle ORM + drizzle-kit · zod · bcrypt sessions · Vitest · Playwright.

## Run it locally

You need Node 20+ and Postgres 14+.

```bash
npm install
cp .env.example .env            # then fill DATABASE_URL, CRON_SECRET, APP_URL
createdb halves                  # or any empty Postgres database
npm run db:migrate               # applies drizzle/0000_init.sql
npm run db:seed                  # 4 fake people, 2 groups; password: password123
npm run dev                      # http://localhost:3000, log in as ana@example.com
```

## Scripts

| script | does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | unit tests: split maths, balances, simplify debts, money, dates |
| `npm run test:e2e` | Playwright, 11 flows; reseeds the database first (dev DB only) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | new migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` / `db:reset` | seed / wipe and reseed |
| `npm run contrast` | WCAG check on `replica/design/tokens.json` |
| `npm run parity` | feature parity score from `replica/features.csv` |
| `npm run sweep` | finds any leftover name, domain or colour of the original |

## What's in it

- Groups (home, trip, couple, other) and one-on-one friends
- Invite by email before someone has an account; they claim it by signing up
- Expenses split equally, by exact amounts, percentages or shares, with fair remainder cents
- Several payers on one expense
- Balances per person across all groups, kept apart per currency (12 currencies)
- Simplify debts per group (greedy largest-creditor/largest-debtor, at most n-1 payments)
- Settle up, prefilled from the real balance
- Activity feed, comments, edit history, delete and restore
- Categories, notes, recurring expenses (weekly, fortnightly, monthly, yearly) via a daily cron
- Search and CSV export (both paid features on the original)
- Account deletion that anonymises you without breaking other people's history

Not yet: charts, receipt photos, default split per group, offline entry, password
reset email, Google sign-in, rate limiting. See `replica/parity.md`.

## Layout

```
src/
  app/                 routes (app router); (app)/ needs a session, (auth)/ is log in / sign up
    actions/           server actions: auth, groups, friends, expenses (+ settle up)
    api/export         CSV download
    api/cron/recurring daily job, Bearer CRON_SECRET
  components/          ui primitives, forms, expense form (split editor), expense list
  db/                  schema.ts, seed.ts, reset.ts
  lib/                 splits.ts, balances.ts, money.ts, dates.ts  (pure, unit tested)
                       auth, access, data, users, activity  (server only)
drizzle/               SQL migrations
e2e/                   Playwright specs
tests/                 Vitest unit tests
tools/                 contrast.py, parity.py, sweep.py from the Replica skill
replica/               the planning trail: recon, features, architecture, design tokens,
                       test plan, bugs, build log, parity, brand config, screenshots
```

## Deploy (short version)

Vercel + Neon (or Supabase) Postgres. Set `DATABASE_URL`, `CRON_SECRET`, `APP_URL`;
run `npm run db:migrate` against the production database; `vercel.json` schedules the
recurring job. Before going live: rebrand, add rate limits on log in / sign up, a privacy
policy, and run `/replica-deploy`'s preflight.

## Clean room

Built from public pages only (marketing site, Pro page, App Store listing, read
2026-10-26). No source code, assets, copy or private APIs of the original were used.
Check trademarks for your final name and talk to a lawyer before selling. This is not
legal advice.
