# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner plus their friends, roommates and partner. They use it mostly on phones, often from a home-screen shortcut (PWA), to split shared costs: rent, bills, groceries, trips and dinners. Money is mostly in CAD, sometimes INR. My Money is used only by the owner, to track their own spending.

## Product Purpose

Halves keeps a running, fair tally of who owes whom across friends and groups until someone settles up. My Money adds personal spending tracking on top: scanned or hand-entered expenses, EMIs and cards, and a monthly report. Success means expenses get entered quickly in the moment and everyone trusts the balances.

## Positioning

Shared costs and personal spending live in one app with one account. Splitting an expense on Halves and counting only your share in your own spending happen in the same step, so nothing is entered twice.

## Operating Context

- Entering an expense right after paying: at a till, a restaurant table or on a bus, one-handed, often from a receipt photo.
- Checking balances and settling up between friends.
- Reading the monthly spending email and looking back at past months.
- Currencies stay separate and are never converted.

## Capabilities and Constraints

- Next.js 15 (App Router, server actions), React 19, Tailwind CSS, Postgres (Neon) with Drizzle, deployed on Vercel. Works as an installable PWA.
- Light and dark mode both supported.
- Features: groups and friends, splits (equal, exact, percent, shares), receipt scanning with Claude, itemised splits, settle up, reminders, a weekly digest, activity, comments, edit history, recurring expenses, CSV export, profile photos, and My Money (personal expenses, items with categories, payment methods, EMIs, custom categories, a monthly report and a category chart).

## Brand Commitments

- The name **Halves**.
- The half-filled circle logo (`public/logo.svg`, `src/components/logo.tsx`).
- Everything else visual is open to change.

## Evidence on Hand

- Seed data only (fake people such as Ana, Ben, Chloe and Dev in `src/db/seed.ts`). There are no testimonials, customers or metrics, and none should be invented.

## Product Principles

1. Fast to enter, especially one-handed on a phone.
2. Money is exact: integer cents, separate currencies, splits that always add up.
3. Clear words carry meaning ("owes you", "you owe"); colour only supports them.
4. Shared and personal views never double count.

## Accessibility & Inclusion

Standard good practice: readable text, WCAG AA contrast in both light and dark mode, and keyboard and screen-reader support.
