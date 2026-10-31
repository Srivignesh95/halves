# Architecture: Halves (a rebuild of Splitwise's core features)

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js 15 (App Router) + TypeScript, React 19 server actions | one codebase for UI and API, server components keep balance math on the server |
| styling | Tailwind 3 mapped to CSS variables from `replica/design/tokens.json` | components use roles (`bg-surface`, `text-owe`), never hex |
| database | Postgres (Neon or Supabase in prod, local Postgres in dev) | relational data, real constraints, integer cents |
| ORM | Drizzle ORM + postgres.js, migrations by drizzle-kit | typed SQL, no native engine binaries to download, migrations checked in under `drizzle/` |
| auth | own email + password: bcrypt hashes, random session token in an http-only cookie, sha256 of token stored in `Session` | no third party needed for the core loop; swap to Auth.js later for Google sign-in |
| validation | zod on every server action | never trust the form |
| payments | none at MVP. Stripe Checkout + Billing later for a Pro tier | see `/replica-launch` |
| email | Resend (later) for invites and reminders | invites work without it: placeholder users claim on sign up |
| jobs | Vercel Cron hitting `/api/cron/recurring` daily, guarded by `CRON_SECRET` | recurring expenses |
| hosting | Vercel | zero-config Next.js |

## Schema

Tables: 10 (`users`, `sessions`, `friendships`, `groups`, `group_members`, `expenses`,
`expense_shares`, `comments`, `expense_revisions`, `activities`). See `src/db/schema.ts` and the generated SQL in `drizzle/0000_init.sql`.

Access rules: **data-layer checks**. Every read and write goes through
`src/lib/access.ts` (`assertGroupMember`, `assertCanSeeExpense`). A user can see a
group only if they are a member, and an expense only if it is in one of their
groups or they have a share in it.

Money: integer cents + ISO currency per expense. Balances are always grouped by
currency, never summed across currencies.

Hard constraints in the database:

- `expense_shares` unique on `(expense_id, user_id)`
- `group_members` primary key `(group_id, user_id)`, `friendships` primary key `(user_id, friend_id)` plus a not-self check
- `amount_cents > 0`, `paid_cents >= 0`, `owed_cents >= 0` (check constraints in the first migration)
- GIN index on `activities.user_ids` for the feed
- sum(paid) = sum(owed) = amount is enforced in `src/lib/splits.ts` before the
  transaction that writes the shares, and re-checked inside it

## API (server actions and route handlers)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `signup` | create user or claim invited placeholder, start session | anyone | name, email, password | redirect /dashboard | F06 |
| action `login` / `logout` | session | anyone / user | email, password | redirect | F06 |
| action `deleteAccount` | delete if all balances are zero | user | confirm | redirect / | F06 |
| action `createGroup` | group + members (+ placeholder users) | user | name, type, emails | redirect group | F03 |
| action `addMember` / `removeMember` | membership | member | email / userId | revalidate | F03 |
| action `updateGroup` | rename, simplify toggle | member | name, simplify | revalidate | F04 |
| action `deleteGroup` | only when settled | member | id | redirect | F03 |
| action `addFriend` | friendship both ways | user | email | redirect friend | F03 |
| action `saveExpense` | create or edit, writes shares + revision + activity | member / participant | expense form | redirect expense | F01, F05 |
| action `deleteExpense` / `restoreExpense` | soft delete | member / participant | id | revalidate | F05 |
| action `addComment` | comment + activity | can see expense | body | revalidate | F05 |
| action `settleUp` | payment expense (payer paid X, payee owed X) | user | from, to, amount, currency, group? | redirect | F02 |
| GET `/api/export` | CSV of every expense involving me | user | none | text/csv | |
| GET `/api/cron/recurring` | create due recurring copies | cron (`Authorization: Bearer CRON_SECRET`) | none | count | |

Webhooks in: none yet (Stripe later). Webhooks out: none.
Jobs: `recurring`, daily 06:00 UTC, copies due expenses and advances `nextOccursOn`.

## The parts that bite

- **rounding**: 10.00 split 3 ways is 3.34 / 3.33 / 3.33. Remainder cents go by largest
  fractional part, ties broken by participant order, so the same input always gives
  the same output. Percent and shares use the same largest-remainder method.
- **multi-payer debts**: within one expense, debtors are matched to creditors greedily
  in a stable order. Pairwise balances are the sum of those edges.
- **simplify debts**: on a group's net balances per currency, repeatedly match the
  largest creditor with the largest debtor. At most n-1 transfers, never changes
  anyone's net.
- **time zones**: expense `date` is a Postgres `date`, not an instant. No
  midnight-UTC "yesterday" bugs.
- **idempotency**: the cron job claims each expense by updating `nextOccursOn` with a
  `where` on the old value, so two overlapping runs cannot double-create.
- **races**: double submit on Save is blocked by a disabled pending button plus the
  server action being one transaction.
- **removing members**: blocked while their group balance is non-zero, so history
  never points at someone who silently vanished.
- **deletion / GDPR**: account delete is blocked with open balances; when allowed,
  the user is anonymised (name "Deleted user", email freed) so other people's
  history stays correct.

## Build order

1. **Vertical slice**: S02, S03, S04, S07, S08, S11. Tables User, Session, Group,
   GroupMember, Expense, ExpenseShare. Equal split only.
2. **Must-haves**: all split types, edit/delete, friends (S10, S14), settle up (S13),
   account delete (S15).
3. **Should-haves**: multi-payer, simplify debts, activity (S05), comments, restore,
   categories, currencies, recurring.
4. **Could-haves**: revisions, CSV export, search (done); charts, default split,
   receipts, offline (next).
5. **Fixes from `/replica-entrepreneur`**: run it before branding. Candidate
   gaps to verify with real, linked reviews: the free-tier daily expense limit,
   ads, search being paid.

## Change log

- 2026-10-26: ORM switched from Prisma to Drizzle during the build. Same schema and
  constraints; Drizzle needs no engine binaries, so it runs anywhere npm runs.
