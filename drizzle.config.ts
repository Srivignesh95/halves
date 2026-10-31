import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env");
} catch {
  /* env comes from the host in production */
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
