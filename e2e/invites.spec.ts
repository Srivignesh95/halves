// Invite emails. Needs the server started with MAIL_OUTBOX_DIR=.outbox (see password-reset.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const OUTBOX = path.resolve(".outbox");

async function mailsTo(email: string) {
  const files = (await readdir(OUTBOX).catch(() => [] as string[])).filter((f) => f.endsWith(`-${email}.json`)).sort();
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(OUTBOX, f), "utf8")) as { subject: string; text: string }));
}
async function waitForMail(email: string, n = 1) {
  for (let i = 0; i < 40; i++) {
    const m = await mailsTo(email);
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

test("adding a friend who isn't on Halves emails them an invite with a prefilled sign-up link", async ({ page, context }) => {
  const email = `pal${Date.now()}@example.com`;
  await login(page, "ana@example.com");
  await page.goto("/friends/new");
  await page.getByLabel("Name").fill("Sam Lee");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(`We emailed ${email} an invite`)).toBeVisible();

  const [mail] = await waitForMail(email);
  expect(mail.subject).toBe("Ana Ruiz added you on Halves");
  const link = mail.text.match(/https?:\/\/\S+\/signup\?email=\S+/)![0];

  // resend straight away is refused: one invite a day
  await page.getByRole("button", { name: "Resend invite" }).click();
  await expect(page.getByText("already went to this email in the last 24 hours")).toBeVisible();
  expect(await mailsTo(email)).toHaveLength(1);

  // the link opens sign-up with the email filled in
  await context.clearCookies();
  const url = new URL(link);
  await page.goto(url.pathname + url.search);
  await expect(page.getByLabel("Email")).toHaveValue(email);
});

test("adding an existing user as a friend sends no invite", async ({ page }) => {
  await login(page, "ben@example.com");
  await page.goto("/friends/new");
  await page.getByLabel("Email").fill("dev@example.com");
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page).toHaveURL(/\/friends\/[0-9a-f-]{36}$/);
  await new Promise((r) => setTimeout(r, 1000));
  expect(await mailsTo("dev@example.com")).toHaveLength(0);
});

test("creating a group with a new email sends a group invite", async ({ page }) => {
  const email = `grp${Date.now()}@example.com`;
  await login(page, "chloe@example.com");
  await page.goto("/groups/new");
  await page.getByLabel("Group name").fill("Ski weekend");
  await page.getByLabel("People to add (emails)").fill(email);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: "Ski weekend" })).toBeVisible();
  const [mail] = await waitForMail(email);
  expect(mail.subject).toBe("Chloe Martin added you to Ski weekend on Halves");
});
