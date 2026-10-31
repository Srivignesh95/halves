import "server-only";
import { eq } from "drizzle-orm";
import { friendships, users, type Executor } from "./db";

export function normaliseEmail(e: string) {
  return e.trim().toLowerCase();
}

/** Find a user by email, or create an invited placeholder they can claim at sign up. */
export async function findOrInvite(x: Executor, email: string, nameHint?: string) {
  const e = normaliseEmail(email);
  const [existing] = await x.select().from(users).where(eq(users.email, e)).limit(1);
  if (existing) return existing;
  const [created] = await x.insert(users).values({ email: e, name: nameHint?.trim() || e.split("@")[0] }).returning();
  return created;
}

/** Friendship is stored in both directions. Idempotent. */
export async function befriend(x: Executor, a: string, b: string) {
  if (a === b) return;
  await x.insert(friendships).values([{ userId: a, friendId: b }, { userId: b, friendId: a }]).onConflictDoNothing();
}

export function displayName(u: { name: string; deletedAt?: Date | null }) {
  return u.deletedAt ? "Deleted user" : u.name;
}
