// End-to-end tests for the core flows in replica/recon.md. Run against seeded data:
//   npm run db:seed && npm run build && npm start   (or let playwright start `npm run dev`)
//   npx playwright test
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeEach(async ({ page }) => {
  // fail on console errors and server errors
  page.on("console", (m) => {
    // a 404 page is an expected outcome in the access test; anything else fails
    if (m.type() === "error" && !m.text().includes("status of 404")) throw new Error(`console error: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 500) throw new Error(`${r.status()} on ${r.url()}`);
  });
});

test("F04 dashboard shows balances across groups, simplified, per person", async ({ page }) => {
  await login(page, "ana@example.com");
  const owed = page.locator("section", { has: page.getByRole("heading", { name: "You are owed" }) });
  await expect(owed).toContainText("Chloe Martin");
  await expect(owed).toContainText("$813.33");
  await expect(owed).toContainText("Ben Okafor");
  await expect(owed).toContainText("$536.42"); // 766.07 in the house minus 229.65 on the trip
  const owe = page.locator("section", { has: page.getByRole("heading", { name: "You owe" }) });
  await expect(owe).toContainText("Dev Patel");
  await expect(owe).toContainText("$75.00");
});

test("F01 add an expense with an exact split that does not add up, then fix it", async ({ page }) => {
  await login(page, "ana@example.com");
  await page.getByRole("link", { name: "Maple St house" }).first().click();
  await expect(page).toHaveURL(/\/groups\//);
  await page.getByRole("link", { name: "Add an expense" }).click();
  await expect(page).toHaveURL(/\/expenses\/new\?group=/);
  await page.getByLabel("Description").fill("Pizza night");
  await page.getByLabel("Amount", { exact: true }).fill("30");
  await page.getByRole("tab", { name: "Exact amounts" }).click();
  await page.getByLabel("Exact amounts for Ana Ruiz").fill("10");
  await page.getByLabel("Exact amounts for Ben Okafor").fill("10");
  await page.getByLabel("Exact amounts for Chloe Martin").fill("5");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("The split is 5.00 short of the total")).toBeVisible();
  await page.getByLabel("Exact amounts for Chloe Martin").fill("10");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("heading", { name: "Pizza night" })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("$30.00");
});

test("F01 equal split of 10.00 three ways gives the extra cent to one person", async ({ page }) => {
  await login(page, "ben@example.com");
  await page.goto("/expenses/new");
  await page.getByLabel("With").selectOption({ label: "Maple St house" });
  await page.getByLabel("Description").fill("Paper towels");
  await page.getByLabel("Amount", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save expense" }).click();
  const table = page.getByRole("table");
  await expect(table).toContainText("$3.34");
  await expect(table.getByText("$3.33")).toHaveCount(2);
});

test("F05 delete and restore an expense", async ({ page }) => {
  await login(page, "ana@example.com");
  await page.goto("/expenses?q=Internet");
  await page.getByRole("link", { name: /Internet/ }).click();
  await expect(page).toHaveURL(/\/expenses\/[0-9a-f-]{36}$/);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete expense" }).click();
  await expect(page.getByText("was deleted")).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("was deleted")).toHaveCount(0);
});

test("F02 settle up with a friend brings the balance to zero", async ({ page }) => {
  await login(page, "dev@example.com");
  await page.getByRole("link", { name: "Ana Ruiz" }).first().click();
  await expect(page).toHaveURL(/\/friends\//);
  await page.getByRole("link", { name: "Settle up" }).click();
  await expect(page).toHaveURL(/\/settle\?with=/);
  // prefilled from the balance: Ana owes Dev 75.00 for the concert
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("75.00");
  await expect(page.getByLabel("Who paid")).toHaveValue(/.+/);
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page).toHaveURL(/\/friends\//);
  await expect(page.getByRole("complementary").last()).toContainText("settled up");
});

test("F03 create a group and invite someone who has no account yet; they claim it on sign up", async ({ page, context }) => {
  const stamp = Date.now();
  const invitee = `newbie${stamp}@example.com`;
  await login(page, "chloe@example.com");
  await page.goto("/groups/new");
  await page.getByLabel("Group name").fill(`Book club ${stamp}`);
  await page.getByLabel("People to add (emails)").fill(invitee);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: `Book club ${stamp}` })).toBeVisible();
  await page.getByRole("link", { name: "Add an expense" }).click();
  await expect(page).toHaveURL(/\/expenses\/new\?group=/);
  await page.getByLabel("Description").fill("Snacks");
  await page.getByLabel("Amount", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("heading", { name: "Snacks" })).toBeVisible();

  await context.clearCookies();
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("New Person");
  await page.getByLabel("Email").fill(invitee);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "You owe" }) })).toContainText("$10.00");
});

test("second user's data is invisible: a group you are not in is a 404", async ({ page, context }) => {
  await login(page, "ana@example.com");
  await page.getByRole("link", { name: "Maple St house" }).first().click();
  await expect(page).toHaveURL(/\/groups\//);
  const url = page.url();
  await context.clearCookies();
  await login(page, "dev@example.com");
  const res = await page.goto(url);
  expect(res?.status()).toBe(404);
});

test("CSV export downloads with a header row", async ({ page }) => {
  await login(page, "ana@example.com");
  const res = await page.request.get("/api/export");
  expect(res.status()).toBe(200);
  expect((await res.text()).split("\n")[0]).toContain("date,description");
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByLabel("Password").fill("nope-nope");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong")).toBeVisible();
});

test("F05 editing an expense keeps a revision with the old values", async ({ page }) => {
  await login(page, "ana@example.com");
  await page.goto("/expenses?q=Groceries");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await expect(page).toHaveURL(/\/expenses\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByLabel("Description").fill("Groceries and snacks");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Groceries and snacks" })).toBeVisible();
  await expect(page.getByText(/Before: .Groceries. \$87\.23/)).toBeVisible();
  await expect(page.getByRole("table")).toContainText("$29.08"); // split unchanged
});

test("F03 removing a member who still has a balance is blocked", async ({ page }) => {
  await login(page, "ana@example.com");
  await page.locator("a:visible", { hasText: "Maple St house" }).first().click();
  await expect(page).toHaveURL(/\/groups\//);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("listitem").filter({ hasText: "Ben Okafor" }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("They still have a balance in this group")).toBeVisible();
});

test("a wrong password keeps the email typed in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByLabel("Password").fill("nope-nope");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is wrong")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("ana@example.com");
});

test("posting a comment clears the box", async ({ page }) => {
  await login(page, "ana@example.com");
  await page.goto("/expenses?q=rent");
  await page.getByRole("link", { name: /October rent/ }).click();
  await expect(page).toHaveURL(/\/expenses\/[0-9a-f-]{36}$/);
  await page.getByLabel("Add a comment").fill("Paid by e-transfer");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Paid by e-transfer" })).toBeVisible();
  await expect(page.getByLabel("Add a comment")).toHaveValue("");
});

test("remove a friend added by mistake; blocked while there's a balance", async ({ page }) => {
  const email = `typo${Date.now()}@example.com`;
  await login(page, "ana@example.com");
  await page.goto("/friends/new");
  await page.getByLabel("Name").fill("Wrong Email");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page).toHaveURL(/\/friends\//);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove Wrong Email" }).click();
  await expect(page).toHaveURL(/\/dashboard\?removed=1$/);
  await expect(page.getByText("Friend removed.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Wrong Email" })).toHaveCount(0);

  // Chloe still owes Ana for the house, so removing her is refused
  await page.locator("a:visible", { hasText: "Chloe Martin" }).first().click();
  await expect(page).toHaveURL(/\/friends\//);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove Chloe Martin" }).click();
  await expect(page.getByText("Settle up first. You can only remove")).toBeVisible();
});
