import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
  // server-only throws outside a React server bundle; its empty.js is what servers get
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js") } },
});
