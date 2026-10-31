# Test plan: Halves

Build: local  Date: 2026-10-26  Env: local Postgres 16, seed data (`npm run db:reset`)

Automated: `npm test` (33 unit tests on split, balance, money and date maths) and
`npx playwright test` (11 end-to-end specs in `e2e/core.spec.ts`, reseeded before every run).

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F04-H1 | balances across groups | happy | log in as Ana | Chloe owes 813.33, Ben owes 536.42 (house 766.07 minus trip 229.65), Ana owes Dev 75.00 | e2e | pass |
| F01-H1 | add group expense | happy | house, 10.00 split equally 3 ways | 3.34 / 3.33 / 3.33 | e2e | pass |
| F01-E1 | | edge: exact split short | 30.00, exact 10/10/5 | "5.00 short" error, nothing saved, fix and save works | e2e | pass |
| F01-E2 | | edge: remainder cents always sum | 0..500 cents over 5 weight sets | sum equals amount every time | unit | pass |
| F01-E3 | | edge: percent not 100 | 50 + 40 | "90.00%, not 100%" | unit | pass |
| F01-E4 | | edge: multi-payer does not add up | 2 payers, 20 of 30 | error | unit | pass |
| F01-E5 | | edge: double submit | click Save twice | button disabled while pending, one expense | manual | not run yet |
| F01-E6 | | edge: two currencies | CAD and USD between the same people | balances shown per currency, never summed | unit | pass |
| F02-H1 | settle up with a friend | happy | Dev, friend Ana, Settle up | amount prefilled 75.00, saving brings it to "settled up" | e2e | pass |
| F02-E1 | | edge: overpayment | pay more than owed | direction flips, shown as the other person owing | unit (balances) | pass |
| F03-H1 | create group with an invitee | happy | Chloe creates group with a new email, adds 20.00 | invitee signs up with that email and sees "you owe 10.00" | e2e | pass |
| F03-E1 | | edge: remove member with balance | settings, Remove | blocked with message | e2e | pass |
| F05-H1 | delete and restore | happy | delete Internet, restore | deleted banner, then gone | e2e | pass |
| F05-E1 | | edge: edit keeps history | edit description | revision listed with the old values, split unchanged | e2e | pass |
| F06-N1 | log in | negative: wrong password | | "Email or password is wrong", no account hint | e2e | pass |
| SEC-1 | access | second user's data | Dev opens Ana's house group URL | 404 | e2e | pass |
| SEC-2 | access | cron without secret | GET /api/cron/recurring | 401 | manual (curl) | pass |
| JOB-1 | recurring | run twice | monthly expense due, cron twice | copies created once, second run creates 0 | manual (curl) | pass |
| UI-1 | layout | mobile width | 390x844 screenshots of S01, S04, S07, S11 | no horizontal scroll, all controls reachable | manual (screenshots in clone-screens/) | pass |

Not yet covered: axe accessibility scan (add `@axe-core/playwright`), slow network,
expired session mid-form, screen reader pass.
