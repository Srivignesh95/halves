# Build log: Halves

| screen | date | status | notes |
| --- | --- | --- | --- |
| shell + tokens | 2026-10-26 | done | Tailwind mapped to CSS variables from tokens.json; contrast 13 pairs, 0 AA failures |
| S01 landing | 2026-10-26 | done | own copy; no ads / no daily limit as the line under the hero |
| S02 sign up | 2026-10-26 | done | claims an invited placeholder with the same email |
| S03 log in | 2026-10-26 | done | constant-time compare for unknown emails |
| S04 dashboard | 2026-10-26 | done | per currency totals, owe / owed columns, groups and friends repeated below on mobile |
| S05 activity | 2026-10-26 | done | GIN-indexed `user_ids` array |
| S06 all expenses | 2026-10-26 | done | search on description and notes, CSV export link |
| S07 group | 2026-10-26 | done | balances, who pays whom (simplified or pairwise), one-click "record" into settle up |
| S08 new group | 2026-10-26 | done | invite by email list |
| S09 group settings | 2026-10-26 | done | simplify toggle; remove / delete blocked while balances are open |
| S10 friend | 2026-10-26 | done | overall + per group breakdown |
| S11 add / edit expense | 2026-10-26 | done | 4 split types, multi-payer, live preview using the same allocate() as the server |
| S12 expense detail | 2026-10-26 | done | shares table, comments, edit history, delete / restore |
| S13 settle up | 2026-10-26 | done | prefilled from the real balance |
| S14 add friend | 2026-10-26 | done | |
| S15 account | 2026-10-26 | done | delete anonymises; blocked with open balances |

Harder than expected: pairwise debts with several payers (solved by settling each
expense on its own, then netting per pair), and Prisma's engine download being blocked
in the build sandbox, which moved the ORM to Drizzle.

Screens done 15 of 15. Must-haves 16 of 16. Parity 93.2.
