import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// every run starts from the same seeded data and an empty test outbox
export default function globalSetup() {
  execSync("npm run db:reset", { stdio: "inherit" });
  rmSync(".outbox", { recursive: true, force: true });
}
