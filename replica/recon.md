# Recon map: Splitwise (web, with iOS/Android as reference)

Scope: shared expenses between friends and groups. Add an expense, split it any
way, see who owes whom, simplify debts, settle up. Not payments rails, not card
import, not OCR.
For: a self-hosted / sellable alternative (working name **Halves**, placeholder
until `/replica-brand` runs the name checks).
Date: 2026-10-26

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site | https://www.splitwise.com/ | core vs Pro feature list, split types, offline, currencies |
| 2 | Pro page | https://www.splitwise.com/pro | what is gated: unlimited expenses, charts, receipt scanning, itemization, search, currency conversion, default splits, transaction import (US) |
| 3 | App Store listing | https://apps.apple.com/us/app/splitwise/id458023433 | multiple payers, recurring (weekly, fortnightly, monthly, yearly), comments, edit history, restore deleted, Venmo/PayPal/Paytm, CSV export, JSON backups (Pro) |
| 4 | public API docs | https://dev.splitwise.com/ | linked from the site, not read in this pass. Read before refining the data model |
| 5 | the user's own account | n/a | not used in this pass. Drive through it to confirm states marked "guess" |

Read on 2026-10-26. No source code, bundles or private endpoints were looked at.

## Core loop

Someone pays for a shared thing, logs it with a split, and everyone sees an
up-to-date "you owe / you are owed" until someone records a settle up.

## Screens

| ID | screen | route | purpose | key components | states |
| --- | --- | --- | --- | --- | --- |
| S01 | landing | `/` | pitch, sign up CTA | hero, feature grid | logged out only |
| S02 | sign up | `/signup` | create account (or claim an invited placeholder) | form | error: email taken, weak password |
| S03 | log in | `/login` | session | form | error: wrong password |
| S04 | dashboard | `/dashboard` | total balance, you owe list, you are owed list | balance summary, person rows, add expense + settle up buttons | empty (all settled), filled, multi-currency |
| S05 | recent activity | `/activity` | feed of adds, edits, deletes, payments, comments | activity rows | empty, filled |
| S06 | all expenses | `/expenses` | every expense involving me | expense rows, month dividers | empty, filled |
| S07 | group | `/groups/[id]` | group expenses + group balances + suggested repayments | expense rows, balance sidebar | empty, filled, all settled |
| S08 | new group | `/groups/new` | name, type, members by email | form, member chips | error: no name |
| S09 | group settings | `/groups/[id]/settings` | rename, add/remove member, simplify debts toggle, delete | toggle, member list | can't remove member with non-zero balance |
| S10 | friend | `/friends/[id]` | everything shared with one person, balance across groups | expense rows, balance header | empty, settled, owe, owed |
| S11 | add / edit expense | `/expenses/new`, `/expenses/[id]/edit` | description, amount, currency, date, category, payer(s), split type, recurrence, notes | money input, split editor | split doesn't add up, no participants |
| S12 | expense detail | `/expenses/[id]` | who paid, who owes what, comments, edit history, delete / restore | share table, comment box | deleted (restorable), payment |
| S13 | settle up | `/settle` | record cash/other payment between two people, optionally in a group | person pickers, amount prefilled from balance | nothing owed |
| S14 | add friend | `/friends/new` | invite by email (placeholder user until they sign up) | form | already friends, self |
| S15 | account | `/account` | name, default currency, export CSV, delete account | form, danger zone | |

## Flows

```
F01 Add a shared expense in a group (core)
    S04 -> S07 -> S11 -> S07 (balances updated)
    happy path clicks: 5 (open group, Add expense, fill, choose split, Save)
    edge: unequal split doesn't sum, cents remainder (10.00 / 3), multiple payers,
          member removed later, other currency, back button mid-form, double submit

F02 Settle up
    S04 -> S13 -> S04
    happy path clicks: 3
    edge: partial payment, overpayment flips direction, payment in a group vs outside

F03 Create a group and invite people
    S04 -> S08 -> S07
    edge: invitee has no account (placeholder), duplicate email, inviting yourself

F04 See what I owe a friend across everything
    S04 -> S10
    edge: balances in two currencies, group with simplify on vs off

F05 Fix a mistake
    S12 -> S11 (edit) or S12 delete -> restore
    edge: edit by a different member, edit after a settle up

F06 Sign up / log in / delete account
    S02 / S03 / S15
    edge: invited email claims placeholder, delete with open balances (blocked)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, hover, focus, disabled, pending | all |
| MoneyInput | with currency select | invalid, focus | S11, S13 |
| SplitEditor | equal, exact, percent, shares | sums ok / remainder shown | S11 |
| BalanceText | owes, owed, settled | | S04, S07, S10 |
| PersonRow | avatar initials + name + balance | | S04, S07, S10 |
| ExpenseRow | expense, payment | deleted | S06, S07, S10 |
| ActivityRow | add, edit, delete, restore, payment, comment, group | | S05 |
| Sidebar nav | groups list, friends list | empty | all app screens |
| Toggle | | on, off | S09 |
| Flash message | success, error | | all forms |

## Inferred data model

```
User         id, email, name, password_hash (null = invited placeholder), default_currency
             evidence: sign up, invite by email (source 1,3). confidence: high
Group        id, name, type (home|trip|couple|other), simplify_debts, created_by
             evidence: source 1 "groups", simplify debts. confidence: high
GroupMember  group_id, user_id
Friendship   user_id, friend_id (stored both directions)
             confidence: medium (friends can share non-group expenses)
Expense      id, group_id (nullable), description, amount_cents, currency, date,
             category, split_type (equal|exact|percent|shares), is_payment,
             recurrence (none|weekly|fortnightly|monthly|yearly), next_occurs_on,
             notes, deleted_at, created_by
             evidence: source 1 split types, source 3 recurring + restore. confidence: high
ExpenseShare expense_id, user_id, paid_cents, owed_cents, (percent|shares input)
             evidence: multiple payers (source 3). Every participant has a paid and an
             owed share; balances are sum(paid - owed). confidence: high (guess on storage)
Comment      expense_id, user_id, body
Activity     actor_id, type, group_id, expense_id, user_ids[], summary
ExpenseRevision expense_id, editor_id, snapshot json  (edit history, source 3)
```

Relationships: User n-n Group (GroupMember), User n-n User (Friendship),
Group 1-n Expense, Expense 1-n ExpenseShare, Expense 1-n Comment.

## Feature matrix

See `features.csv`. Must: 16, should: 9, could: 7, skip: 5.

## Out of scope (cannot or should not be cloned)

- Venmo / PayPal / Paytm hand-off (their partner deals; needs your own agreements)
- The card / bank transaction import (US banking aggregator contract)
- Their payment and card products
- Their user network: your users start at zero
- Exchange-rate data: needs your own Open Exchange Rates (or similar) key if built

## Size

Screens 15, flows 6, entities 9. Hard parts: rounding remainder cents fairly,
multi-payer pairwise debts, simplify-debts correctness, multi-currency balances,
recurring jobs, offline entry. Size: **M** (a few weeks to parity on web; mobile
and offline push it to L).
