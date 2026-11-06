// Receipt scanning, end to end, against a stand-in for the Claude API.
// Start the app with ANTHROPIC_BASE_URL=http://127.0.0.1:4010 ANTHROPIC_API_KEY=test-key for this file.
import { expect, test, type Page } from "@playwright/test";
import http from "node:http";
import path from "node:path";

let server: http.Server;
let lastRequest: { headers: http.IncomingHttpHeaders; body: any } | null = null;
let reply: "receipt" | "not-a-receipt" = "receipt";

const RECEIPT = {
  is_receipt: true, merchant: "Corner Bistro", date: "2026-11-05", currency: "CAD",
  items: [
    { name: "Pasta", price: 18.0, taxed: true, tax_codes: ["H"] },
    { name: "Bread", price: 4.0, taxed: false, tax_codes: [] },
    { name: "Wine", price: 20.0, taxed: true, tax_codes: ["H"] },
  ],
  subtotal: 42.0, taxes: [{ label: "HST 13%", code: "H", amount: 4.94 }], discount: 0, tip: 0, total: 46.94,
};

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastRequest = { headers: req.headers, body: JSON.parse(raw) };
      const input = reply === "receipt" ? RECEIPT : { is_receipt: false, items: [], taxes: [], total: 0 };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "msg_test", type: "message", role: "assistant", content: [{ type: "tool_use", id: "tu_1", name: "record_receipt", input }], stop_reason: "tool_use" }));
    });
  });
  await new Promise<void>((r) => server.listen(4010, "127.0.0.1", r));
});
test.afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("scan a receipt and split it by item: tax only on taxed items, cents add up", async ({ page }) => {
  reply = "receipt";
  await login(page, "ana@example.com");
  await page.locator("a:visible", { hasText: "Maple St house" }).first().click();
  await expect(page).toHaveURL(/\/groups\//);
  await page.getByRole("link", { name: "Add an expense" }).click();
  await expect(page).toHaveURL(/\/expenses\/new\?group=/);

  await page.locator("#receipt-photo").setInputFiles(path.resolve("e2e/fixtures/receipt.jpg"));
  await expect(page.getByLabel("Description")).toHaveValue("Corner Bistro");
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("46.94");

  // what we sent to "Claude": the right model, headers and a JPEG image
  expect(lastRequest!.body.model).toBe("claude-haiku-5-5");
  expect(lastRequest!.headers["x-api-key"]).toBe("test-key");
  expect(lastRequest!.body.messages[0].content[0].source.media_type).toBe("image/jpeg");

  await page.getByRole("tab", { name: "Split by item" }).click();
  const rows = page.getByRole("region", { name: "Receipt" }).locator("li");
  // Pasta: just me. Bread: me and Ben. Wine: just Ben.
  await rows.nth(0).getByRole("button", { name: "Ben" }).click();
  await rows.nth(0).getByRole("button", { name: "Chloe" }).click();
  await rows.nth(1).getByRole("button", { name: "Chloe" }).click();
  await rows.nth(2).getByRole("button", { name: "You" }).click();
  await rows.nth(2).getByRole("button", { name: "Chloe" }).click();

  await expect(page.getByText("Filled in from the receipt items")).toBeVisible();
  await expect(page.getByLabel("Exact amounts for Ana Ruiz")).toHaveValue("22.34");
  await expect(page.getByLabel("Exact amounts for Ben Okafor")).toHaveValue("24.60");
  await expect(page.getByText(/These lines add up to/)).toHaveCount(0);

  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("heading", { name: "Corner Bistro" })).toBeVisible();
  const table = page.getByRole("table");
  await expect(table).toContainText("$22.34");
  await expect(table).toContainText("$24.60");
  await expect(table).toContainText("$46.94");
});

test("a changed price that no longer matches the receipt total is flagged", async ({ page }) => {
  reply = "receipt";
  await login(page, "ana@example.com");
  await page.goto("/expenses/new");
  await page.locator("#receipt-photo").setInputFiles(path.resolve("e2e/fixtures/receipt.jpg"));
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("46.94");
  await page.getByRole("tab", { name: "Split by item" }).click();
  await page.getByLabel("Price of Wine").fill("25.00");
  await expect(page.getByText(/These lines add up to .* but the receipt says \$46\.94/)).toBeVisible();
});

test("a photo that isn't a receipt gets a clear message", async ({ page }) => {
  reply = "not-a-receipt";
  await login(page, "ana@example.com");
  await page.goto("/expenses/new");
  await page.locator("#receipt-photo").setInputFiles(path.resolve("public/icon-512.png"));
  await expect(page.getByText("That doesn't look like a receipt")).toBeVisible();
});
