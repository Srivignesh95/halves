import { execSync } from "node:child_process";

// every run starts from the same seeded data
export default function globalSetup() {
  execSync("npm run db:reset", { stdio: "inherit" });
}
