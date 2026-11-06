// Profile photos: upload, shows in the header, remove falls back to initials.
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("upload a profile photo, see it in the header, then remove it", async ({ page }) => {
  await login(page, "dev@example.com");
  await page.goto("/account");
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeVisible();
  await page.locator("#photo").setInputFiles(path.resolve("public/icon-512.png"));
  await expect(page.getByText("Photo updated")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();

  // the header avatar now points at a versioned photo, served as a resized JPEG
  await page.reload();
  const src = await page.locator("header img").first().getAttribute("src");
  expect(src).toMatch(/^\/api\/avatar\/[0-9a-f-]{36}\?v=\d+$/);
  const res = await page.request.get(src!);
  expect(res.headers()["content-type"]).toBe("image/jpeg");
  expect((await res.body()).length).toBeLessThan(60_000);

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Photo removed")).toBeVisible();
  const id = src!.split("/").pop()!.split("?")[0];
  const after = await page.request.get(`/api/avatar/${id}`);
  expect(after.headers()["content-type"]).toBe("image/svg+xml");
});

test("avatars need you to be logged in", async ({ request }) => {
  const res = await request.get("/api/avatar/00000000-0000-0000-0000-000000000000");
  expect(res.status()).toBe(401);
});

test("an iPhone HEIC photo is converted and uploaded", async ({ page }) => {
  await login(page, "ben@example.com");
  await page.goto("/account");
  await page.locator("#photo").setInputFiles(path.resolve("e2e/fixtures/iphone-photo.heic"));
  await expect(page.getByText("Photo updated")).toBeVisible({ timeout: 30_000 });
  await page.reload();
  const src = await page.locator("header img").first().getAttribute("src");
  expect(src).toMatch(/\?v=\d+$/);
  expect((await page.request.get(src!)).headers()["content-type"]).toBe("image/jpeg");
});

test("a file that isn't a photo gets a clear message", async ({ page }) => {
  await login(page, "ana@example.com");
  await page.goto("/account");
  await page.locator("#photo").setInputFiles(path.resolve("e2e/fixtures/not-a-photo.jpg"));
  await expect(page.getByText("isn't a photo we can open")).toBeVisible();
});
