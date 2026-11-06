// Attaching a photo to any expense, replacing/removing it, and who can see it.
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("attach a photo to a hand-entered expense, then remove it when editing", async ({ page, context }) => {
  await login(page, "ana@example.com");
  await page.locator("a:visible", { hasText: "Maple St house" }).first().click();
  await expect(page).toHaveURL(/\/groups\//);
  await page.getByRole("link", { name: "Add an expense" }).click();
  await expect(page).toHaveURL(/\/expenses\/new\?group=/);
  await page.getByLabel("Description").fill("Hardware store");
  await page.getByLabel("Amount", { exact: true }).fill("30");
  await page.locator("#attach-photo").setInputFiles(path.resolve("e2e/fixtures/receipt.jpg"));
  await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("heading", { name: "Hardware store" })).toBeVisible();

  const img = page.getByRole("img", { name: "Receipt for Hardware store" });
  await expect(img).toBeVisible();
  const src = (await img.getAttribute("src"))!;
  expect((await page.request.get(src)).status()).toBe(200);
  const expenseUrl = page.url();

  // Dev isn't in this group: he can't see the photo
  const other = await context.browser()!.newContext({ baseURL: new URL(expenseUrl).origin });
  const devPage = await other.newPage();
  await login(devPage, "dev@example.com");
  expect((await devPage.request.get(src)).status()).toBe(404);
  await other.close();

  // edit: remove the photo
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByRole("img", { name: "Receipt photo" })).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Hardware store" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Receipt for Hardware store" })).toHaveCount(0);
  const id = expenseUrl.split("/").pop();
  expect((await page.request.get(`/api/receipt/${id}`)).status()).toBe(404);
});
