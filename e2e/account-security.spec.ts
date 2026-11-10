// Sign-up email codes and login lockouts.
import { expect, test } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";

async function codeSentTo(email: string) {
  for (let i = 0; i < 40; i++) {
    const files = (await readdir(".outbox").catch(() => [] as string[])).filter((f) => f.endsWith(`-${email}.json`)).sort();
    for (const f of files.reverse()) {
      const code = (JSON.parse(await readFile(`.outbox/${f}`, "utf8")) as { subject: string }).subject.match(/^(\d{6}) is your Halves code$/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no code for ${email}`);
}

test("sign-up needs the emailed code; a wrong code is refused and counted", async ({ page }) => {
  const email = `fresh${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Fresh Person");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/signup\/verify\?email=/);
  await expect(page.getByText(email)).toBeVisible();

  // no account exists yet: logging in fails
  const code = await codeSentTo(email);
  const wrong = code === "000000" ? "111111" : "000000";
  await page.getByLabel("Code").fill(wrong);
  await page.getByRole("button", { name: "Finish signing up" }).click();
  await expect(page.getByText("That code isn't right. 4 tries left.")).toBeVisible();

  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Finish signing up" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("an account isn't created until the code is entered", async ({ page }) => {
  const email = `pending${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Not Yet");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/signup\/verify/);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong")).toBeVisible();
});

test("five wrong passwords lock that email for a while, even with the right password", async ({ page, context }) => {
  // a fresh account of its own, so the lock doesn't affect other tests
  const email = `lockme${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Lock Me");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.getByLabel("Code").fill(await codeSentTo(email));
  await page.getByRole("button", { name: "Finish signing up" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await context.clearCookies();

  await page.goto("/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(`wrong-${i}`);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email or password is wrong")).toBeVisible();
  }
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/Too many wrong attempts/)).toBeVisible();
});

test("the old mail test page is gone", async ({ request }) => {
  expect((await request.get("/api/mail-test?to=a@b.co&key=x")).status()).toBe(404);
});
