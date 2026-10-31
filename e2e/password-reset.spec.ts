// Forgot password, end to end. Needs the server started with MAIL_OUTBOX_DIR=.outbox
// (no real email transport), so the test can read the reset email from disk.
import { expect, test } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const OUTBOX = path.resolve(".outbox");

async function latestMailTo(email: string) {
  for (let i = 0; i < 40; i++) {
    const files = (await readdir(OUTBOX).catch(() => [] as string[])).filter((f) => f.endsWith(`-${email}.json`)).sort();
    if (files.length) return JSON.parse(await readFile(path.join(OUTBOX, files.at(-1)!), "utf8")) as { text: string; subject: string };
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email to ${email}`);
}

test("forgot password: email link sets a new password, works once, old password stops working", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email").fill("chloe@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that email has a Halves account")).toBeVisible();

  const mail = await latestMailTo("chloe@example.com");
  expect(mail.subject).toBe("Reset your Halves password");
  const link = mail.text.match(/https?:\/\/\S+\/reset-password\?token=[\w-]+/)![0];
  const url = new URL(link);

  await page.goto(url.pathname + url.search);
  await page.getByLabel("New password").fill("brand-new-pass");
  await page.getByLabel("Type it again").fill("does-not-match");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("The two passwords don't match")).toBeVisible();

  await page.getByLabel("New password").fill("brand-new-pass");
  await page.getByLabel("Type it again").fill("brand-new-pass");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/dashboard\?reset=1$/);
  await expect(page.getByText("Password changed")).toBeVisible();

  // the link only works once
  await page.goto(url.pathname + url.search);
  await expect(page.getByRole("heading", { name: "This link doesn't work any more" })).toBeVisible();

  // old password fails, new one works
  await context.clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill("chloe@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong")).toBeVisible();
  await page.getByLabel("Password").fill("brand-new-pass");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("forgot password: unknown email gets the same answer and no email", async ({ page }) => {
  const email = `nobody${Date.now()}@example.com`;
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that email has a Halves account")).toBeVisible();
  await new Promise((r) => setTimeout(r, 1500));
  const files = (await readdir(OUTBOX).catch(() => [] as string[])).filter((f) => f.includes(email));
  expect(files).toHaveLength(0);
});

test("forgot password: a made-up token is rejected", async ({ page }) => {
  await page.goto("/reset-password?token=" + "x".repeat(43));
  await expect(page.getByRole("heading", { name: "This link doesn't work any more" })).toBeVisible();
});

test("forgot password: at most 3 emails an hour to the same address", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("ben@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If that email has a Halves account")).toBeVisible();
  }
  await new Promise((r) => setTimeout(r, 1500));
  const files = (await readdir(OUTBOX).catch(() => [] as string[])).filter((f) => f.endsWith("-ben@example.com.json"));
  expect(files).toHaveLength(3);
});
