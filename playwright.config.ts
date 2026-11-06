import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", viewport: { width: 1440, height: 900 } },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
        // test-only: emails go to .outbox, receipt scans go to the stand-in API in e2e/receipt.spec.ts
        env: { MAIL_OUTBOX_DIR: ".outbox", ANTHROPIC_BASE_URL: "http://127.0.0.1:4010", ANTHROPIC_API_KEY: "test-key" },
      },
});
