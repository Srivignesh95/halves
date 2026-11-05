// Reminders and balance emails. Needs the server started with MAIL_OUTBOX_DIR=.outbox.
import { expect, test, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const OUTBOX = path.resolve(".outbox");
// only emails whose subject starts with `prefix`, so other test files' emails don't count
async function mailsTo(email: string, prefix = "") {
  const files = (await readdir(OUTBOX).catch(() => [] as string[])).filter((f) => f.endsWith(`-${email}.json`)).sort();
  const all = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(OUTBOX, f), "utf8")) as { subject: string; text: string }));
  return all.filter((m) => m.subject.startsWith(prefix));
}
async function waitForMail(email: string, prefix: string, n = 1) {
  for (let i = 0; i < 40; i++) {
    const m = await mailsTo(email, prefix);
    if (m.length >= n) return m;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`expected ${n} email(s) to ${email}`);
}
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("send a reminder to a friend who owes you; one a day", async ({ page }) => {
  await login(page, "ana@example.com");
  await page.locator("a:visible", { hasText: "Ben Okafor" }).first().click();
  await expect(page).toHaveURL(/\/friends\//);
  await page.getByPlaceholder("Add a note (optional)").fill("For the hydro and rent, thanks!");
  await page.getByRole("button", { name: "Send reminder" }).click();
  await expect(page.getByText("Reminder sent to Ben Okafor.")).toBeVisible();
  const [mail] = await waitForMail("ben@example.com", "Reminder");
  expect(mail.subject).toMatch(/^Reminder from Ana Ruiz: you owe \$\d/);
  expect(mail.text).toContain("For the hydro and rent, thanks!");

  await page.getByRole("button", { name: "Send reminder" }).click();
  await expect(page.getByText("You already sent a reminder today")).toBeVisible();
  expect(await mailsTo("ben@example.com", "Reminder")).toHaveLength(1);
});

test("no reminder button for someone who doesn't owe you", async ({ page }) => {
  await login(page, "ana@example.com");
  await page.locator("a:visible", { hasText: "Dev Patel" }).first().click();
  await expect(page).toHaveURL(/\/friends\//);
  await expect(page.getByRole("button", { name: "Send reminder" })).toHaveCount(0);
});

test("email me my balances sends a summary with both directions", async ({ page }) => {
  await login(page, "ben@example.com");
  await page.goto("/account");
  await page.getByRole("button", { name: "Email me my balances" }).click();
  await expect(page.getByText("Sent your balances to ben@example.com.")).toBeVisible();
  const [mail] = await waitForMail("ben@example.com", "Your Halves balances");
  expect(mail.subject).toContain("Your Halves balances");
  expect(mail.text).toContain("You owe Ana Ruiz");
  expect(mail.text).toContain("Stop these emails");
});

test("weekly digest cron: needs the secret, skips people who opted out, once a week", async ({ page, request }) => {
  // Dev turns the weekly email off
  await login(page, "dev@example.com");
  await page.goto("/account");
  await page.getByLabel(/Weekly balance email/).uncheck();
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Saved")).toBeVisible();

  expect((await request.get("/api/cron/digest")).status()).toBe(401);
  const secret = execSync("node -e \"process.loadEnvFile('.env');process.stdout.write(process.env.CRON_SECRET)\"").toString();
  const first = await (await request.get("/api/cron/digest", { headers: { Authorization: `Bearer ${secret}` } })).json();
  expect(first.sent).toBeGreaterThan(0);
  expect(await mailsTo("dev@example.com", "Your Halves balances")).toHaveLength(0);
  const again = await (await request.get("/api/cron/digest", { headers: { Authorization: `Bearer ${secret}` } })).json();
  expect(again.sent).toBe(0);
});
