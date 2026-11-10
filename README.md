# Halves

Halves helps friends, roommates and groups share costs. Add what you paid, split it any way you like, and Halves keeps a running tally of who owes whom until someone settles up.

Live at **https://halves.svkzone.com**

---

## What it does

- **Groups and friends.** Make a group for your home, a trip or a couple, or split one-on-one with a friend.
- **Safe sign-up.** New accounts confirm their email with a 6-digit code, and repeated wrong passwords lock the login for 15 minutes.
- **Invite by email.** Add someone who isn't on Halves yet. They get an invite email, and everything you added for them is waiting when they sign up.
- **Split any way.** Equally, by exact amounts, by percentage or by shares. Several people can pay for one bill, and the leftover cents are always shared fairly.
- **Scan receipts.** Take a photo and Halves reads the shop, items, tax and total. Split the total, or split item by item with tax only on the taxed items.
- **Receipt photos.** Attach a photo to any expense and view it later.
- **Clear balances.** One number per person across every group, kept separate for each currency.
- **Simplify debts.** Turns a tangle of IOUs into the fewest payments that settle everyone.
- **Settle up.** Record a payment, with the amount filled in from the real balance.
- **Reminders and summaries.** Send a friend a reminder of what they owe, get a weekly email of your balances, or ask for one any time.
- **The everyday extras.** Activity feed, comments, edit history, restore deleted expenses, recurring expenses, search, CSV export, profile photos, forgot password, dark mode.
- **Works like an app on your phone.** Add it to your iPhone or Android home screen.

---

## Built with

| Part | What it uses |
| --- | --- |
| App | Next.js 15 (App Router, server actions), React 19, TypeScript |
| Look | Tailwind CSS on design tokens, light and dark mode |
| Database | Postgres on Neon, with Drizzle ORM and drizzle-kit migrations |
| Sign in | Email and password (bcrypt), secure session cookies |
| Email | Any SMTP mailbox (Hostinger mail here) or Resend |
| Receipt reading | Claude Haiku 5.5 through the Anthropic API |
| Photo storage | Vercel Blob (private) |
| Hosting | Vercel, with two scheduled jobs |
| Tests | Vitest (maths) and Playwright (the app in a real browser) |

---

## Before you start

You need:

1. **Node.js 20.12 or newer.** Check with `node -v`. Download it from [nodejs.org](https://nodejs.org) if needed.
2. **Git.** Check with `git --version`.
3. **A Postgres database.** The easiest is a free [Neon](https://neon.tech) project. A local Postgres works too.
4. Optional, for the live site: accounts on **GitHub**, **Vercel** and **Anthropic**, and a mailbox for sending email.

The commands below are written for Windows PowerShell. They work the same in a Mac or Linux terminal, except where noted.

---

## Part 1: Run it on your computer

### Step 1. Get the code

```powershell
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

If you have the project as a zip instead, unzip it and `cd` into the `halves` folder (the one with `package.json` in it).

### Step 2. Install the packages

```powershell
npm install
```

npm may report some "vulnerabilities". Don't run `npm audit fix --force`; it upgrades major versions and breaks the build. See [Troubleshooting](#troubleshooting).

### Step 3. Create your settings file

```powershell
Copy-Item .env.example .env
notepad .env
```

(On Mac or Linux: `cp .env.example .env`.)

Fill in at least these three:

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
CRON_SECRET=any-long-random-string-of-32-characters-or-more
APP_URL=http://localhost:3000
```

**Getting `DATABASE_URL` from Neon:** open your Neon project, click **Connect**, click **Show password**, copy the connection string, and paste it after `DATABASE_URL=`. Remove `&channel_binding=require` from the end if it's there, because the database driver doesn't support it.

Everything else in `.env` is optional on your computer. See [Settings reference](#settings-reference).

### Step 4. Create the tables

```powershell
npm run db:migrate
```

### Step 5. Add sample data (optional)

```powershell
npm run db:seed
```

This adds four sample people and two groups. Every sample account uses the password `password123`, for example `ana@example.com`.

**Don't run this on the live database.** Anyone could log in to those sample accounts.

### Step 6. Start the app

```powershell
npm run dev
```

Open **http://localhost:3000** and log in (with a sample account) or sign up.

Without email settings, emails such as password resets are printed in the terminal where `npm run dev` is running, so you can test them without sending anything.

---

## Part 2: Put it online

### Step 1. Push the code to GitHub

Create an empty **private** repository on GitHub, then from the project folder:

```powershell
git init
git add .
git commit -m "Halves"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Your `.env` file is never uploaded; `.gitignore` excludes it. Check with `git status` before committing if you're unsure.

To check where a push will go: `git remote -v` shows the repository, and `git branch -vv` shows the branch.

### Step 2. Create a separate live database

Use a **separate** Neon project (or branch) for the live site, not the one you test with. Copy its connection string the same way as before, but with **Connection pooling** turned on (the host name contains `-pooler`). Pooling suits Vercel, where each request can open a new connection.

Create the tables in it from your computer, temporarily pointing `.env` at the live database:

```powershell
npm run db:migrate
```

Skip `db:seed` here. Then point `.env` back at your test database.

### Step 3. Deploy on Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub and click **Add New → Project**.
2. Import your repository. If the app sits in a subfolder of the repo, set **Root Directory** to that folder.
3. Under **Environment Variables**, add the required ones (see [Settings reference](#settings-reference)):
   - `DATABASE_URL`: the live, pooled connection string
   - `CRON_SECRET`: a long random string
   - `APP_URL`: leave as `http://localhost:3000` for now
4. Click **Deploy**. When it finishes, you get a link such as `https://halves-xyz.vercel.app`.
5. Change `APP_URL` to that link (or your own domain, from Step 4), then redeploy from **Deployments → ⋯ → Redeploy**.

Settings only take effect after a redeploy. Whenever you change one, redeploy.

### Step 4. Use your own domain (optional)

Example: `halves.svkzone.com`, with DNS managed at Hostinger.

1. In Vercel, go to **Settings → Domains → Add** and enter `halves.yourdomain.com`. Vercel shows a CNAME record.
2. In Hostinger hPanel, go to **Domains → yourdomain.com → DNS / Nameservers → Manage DNS records**.
3. If a record named `halves` already exists (for example an `ALIAS` created by Hostinger), delete **only that one**.
4. Add a record: Type `CNAME`, Name `halves`, Target the value Vercel showed, TTL default.
5. Wait 5 to 30 minutes, then click **Refresh** in Vercel. HTTPS is set up automatically.
6. Set `APP_URL` to `https://halves.yourdomain.com` and redeploy.

This only adds the subdomain. Your main website and email are not affected.

### Step 5. Turn on email

Email is used for password resets, invites, reminders and balance summaries.

**Option A: a mailbox you already have (Hostinger mail shown here)**

1. In hPanel, go to **Emails** and create a mailbox, for example `noreply@yourdomain.com`. Note the exact spelling.
2. Add these in Vercel (and in your local `.env` to test):

   | Setting | Value |
   | --- | --- |
   | `MAIL_FROM` | `Halves <noreply@yourdomain.com>` |
   | `SMTP_HOST` | `smtp.hostinger.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | `noreply@yourdomain.com` (the full address, exactly as created) |
   | `SMTP_PASS` | the mailbox's own password |

3. Test the settings from your computer: `npm run mail:test you@example.com`. You want `Sent: 250` and the email in your inbox. Check Spam the first time.
4. Add the same settings in Vercel, redeploy, then use **Forgot password?** on the live site with your own email to confirm.

**Option B: Resend.** Verify your domain at [resend.com](https://resend.com), then set `RESEND_API_KEY` and `MAIL_FROM`. If `RESEND_API_KEY` is set, it's used instead of SMTP.

### Step 6. Turn on receipt scanning

1. At [console.anthropic.com](https://console.anthropic.com), add a payment method. A $5 prepay is plenty to start.
2. Set a monthly spend limit under **Billing → Limits**.
3. Create a key under **API Keys** and add it in Vercel as `ANTHROPIC_API_KEY`.
4. Redeploy.

Each scan costs a fraction of a cent with Claude Haiku 5.5. Each person can scan up to 20 receipts a day (change with `RECEIPT_SCANS_PER_DAY`). Receipt photos are sent to Anthropic to be read; mention this in your privacy policy.

### Step 7. Turn on photo storage

1. In Vercel, open the project and go to **Storage → Create Database → Blob**. Choose **Private** access if asked.
2. Connect it to the project for **Production** and **Preview**. Vercel adds `BLOB_READ_WRITE_TOKEN` for you.
3. Redeploy.

Without a Blob store, photos are kept in the database. That's fine on your computer, but the live site needs the Blob store.

### Step 8. Scheduled jobs

These run automatically on Vercel from `vercel.json`, with no setup:

| Job | When | What it does |
| --- | --- | --- |
| `/api/cron/recurring` | Daily, 06:00 UTC | Adds recurring expenses that are due |
| `/api/cron/digest` | Mondays, 14:00 UTC | Emails everyone with open balances a summary |

Vercel sends your `CRON_SECRET` with each run; requests without it are refused.

### Step 9. Add it to your phone

- **iPhone:** open the site in **Safari**, tap **Share → Add to Home Screen → Add**.
- **Android:** open it in **Chrome**, tap **⋮ → Add to Home screen** (or **Install app**).

To pick up a new icon later, remove it from the home screen and add it again.

### Before inviting real people

- [ ] The live database has no sample data (no `password123` accounts)
- [ ] Your database password has been changed if it was ever shared or pasted anywhere
- [ ] Email works (`npm run mail:test` shows `Sent: 250`, and a sign-up code arrives)
- [ ] `APP_URL` is your real address
- [ ] A privacy policy mentions Neon (data), Vercel (hosting, photos), your email provider and Anthropic (receipt reading)

---

## Settings reference

| Setting | Needed? | What it's for |
| --- | --- | --- |
| `DATABASE_URL` | **Required** | Postgres connection string |
| `CRON_SECRET` | **Required** | Protects the scheduled jobs. 32+ random characters |
| `APP_URL` | **Required** | The site's address, used in email links |
| `MAIL_FROM` | For email | Sender, e.g. `Halves <noreply@yourdomain.com>` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | For email (Option A) | Your mailbox's sending settings |
| `RESEND_API_KEY` | For email (Option B) | Use Resend instead of SMTP |
| `ANTHROPIC_API_KEY` | For receipt scanning | Your Anthropic API key |
| `RECEIPT_MODEL` | Optional | Defaults to `claude-haiku-5-5` |
| `RECEIPT_SCANS_PER_DAY` | Optional | Daily scans per person, default 20 |
| `BLOB_READ_WRITE_TOKEN` | For photos on the live site | Added by Vercel when you connect a Blob store |

Mark secret values (passwords, keys, tokens) as **Sensitive** in Vercel.

---

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the app locally with live reload |
| `npm run build` then `npm start` | Build and run the production version |
| `npm run db:generate` | Create a new migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the database in `.env` |
| `npm run db:seed` | Add sample data (test databases only) |
| `npm run db:reset` | Wipe everything and re-add sample data (test databases only) |
| `npm run db:studio` | Browse the database in your web browser |
| `npm test` | Unit tests for the money maths |
| `npm run test:e2e` | Browser tests of every main flow. Wipes and reseeds the database in `.env`, so test databases only |
| `npm run typecheck` | Check the TypeScript |
| `npm run mail:test you@example.com` | Check your email settings |

**After pulling new code:** run `npm install` and `npm run db:migrate` (on your test database, and on the live one before deploying), then push.

---

## Project layout

```
src/
  app/            pages and server actions
    (app)/        pages that need you to be logged in
    (auth)/       log in, sign up, forgot and reset password
    actions/      what forms do on the server
    api/          photos, CSV export, scheduled jobs, mail test
  components/     buttons, forms, the expense form, receipt panel, lists
  db/             database schema, sample data, reset script
  lib/            split and balance maths, money, dates, email, receipts, storage
drizzle/          database migrations (SQL)
e2e/              browser tests and test files
tests/            unit tests
public/           logo, favicon, app icons
replica/          the planning notes: research, features, architecture, design tokens, test plan
tools/            design, parity and rebrand check scripts (MIT, see tools/LICENSE)
```

---

## Troubleshooting

**`Please provide required params for Postgres driver: url: ''`**
`.env` is missing, or `DATABASE_URL` is empty. Check the file is named exactly `.env` (not `.env.txt`) and sits next to `package.json`. Also check `node -v` is 20.12 or newer.

**`unrecognized configuration parameter "channel_binding"`**
Remove `&channel_binding=require` from `DATABASE_URL`.

**`535 5.7.8 authentication failed` when sending email**
The mailbox name or password doesn't match. Log in to webmail with exactly the `SMTP_USER` and `SMTP_PASS` you set (watch for `no-reply` vs `noreply`). In `.env`, put a password containing `#` in double quotes.

**Sign-up code, password reset or invite email never arrives**
Check Spam. Each address gets at most 5 sign-up codes an hour, 3 reset emails an hour and 1 invite a day, so repeated tries go quiet on purpose. Every sent email is logged in Vercel as `[mail] sent ...`; a failure is logged with the reason.

**`Server Action "..." was not found on the server`**
A page opened before a deploy is running the old version. The app reloads itself when this happens; otherwise reload the page, or close and reopen the home-screen app.

**`Too many wrong attempts` at log in**
Five wrong passwords for one email lock it for 15 minutes. Wait, or use **Forgot password?**.

**`That file isn't a photo we can open`**
Use a JPEG, PNG or iPhone (HEIC) photo. Other formats aren't supported.

**npm reports vulnerabilities**
Most are in development-only tools (tests, migrations, build) and never reach the live site. Don't run `npm audit fix --force`, which installs breaking major versions. Upgrade packages one at a time and run the tests after each.

**Hydration warning about `data-gr-...` or `cz-shortcut-listen`**
Browser extensions (Grammarly, ColorZilla) add these attributes. It's harmless.

---

## Credits

Halves was created with **Claude**, Anthropic's AI assistant, working with Srivignesh Kavle Sathyanarayanan (Vicky). It was planned and built using the [Replica skill](https://github.com/Jakeschincariol/replica-skill) by Jake Schincariol.

It is an independent, clean-room project. It was built from publicly available information about how bill-splitting apps work. No code, design assets, logos or text from any other app were used. Halves is not affiliated with or endorsed by any other company or product.

## Copyright

Copyright © 2026 Srivignesh Kavle Sathyanarayanan (Vicky). All rights reserved.

See [LICENSE](LICENSE) for details. The scripts in `tools/` are under the MIT License (see `tools/LICENSE`), and npm packages keep their own licences.
