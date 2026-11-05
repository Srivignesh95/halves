import "server-only";
import { dashboard } from "./data";
import { digestEmail } from "./mail";
import { displayName } from "./users";

export function appBase(host?: string | null) {
  return (process.env.APP_URL || (host ? `https://${host}` : "http://localhost:3000")).replace(/\/$/, "");
}

/** The balance-summary email for one person, or null when they're all settled up. */
export async function buildDigest(user: { id: string; name: string; email: string }, base: string) {
  const { rows } = await dashboard(user.id);
  if (rows.length === 0) return null;
  const lines = rows.map((r) => ({ name: displayName(r.user), amounts: r.amounts }));
  return { to: user.email, ...digestEmail(user.name, lines, `${base}/dashboard`, `${base}/account`) };
}
