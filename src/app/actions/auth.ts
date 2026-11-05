"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { avatars, db, friendships, groupMembers, sessions, users } from "@/lib/db";
import { endSession, requireUser, startSession } from "@/lib/auth";
import { normaliseEmail } from "@/lib/users";
import { edgesForUser } from "@/lib/data";
import { CURRENCIES } from "@/lib/money";
import type { ActionState } from "@/components/forms";

const SignUp = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60, "Keep your name under 60 characters"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function signup(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = normaliseEmail(parsed.data.email);
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing?.passwordHash || existing?.deletedAt) return { error: "That email already has an account. Log in instead." };
  let userId: string;
  if (existing) {
    // someone invited this email: claim the placeholder and keep its history
    await db.update(users).set({ name: parsed.data.name, passwordHash }).where(eq(users.id, existing.id));
    userId = existing.id;
  } else {
    userId = (await db.insert(users).values({ email, name: parsed.data.name, passwordHash }).returning({ id: users.id }))[0].id;
  }
  await startSession(userId);
  redirect("/dashboard");
}

let DUMMY_HASH: string | undefined;

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const email = normaliseEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // compare even when the user is missing so timing does not reveal which emails exist
  const ok = await bcrypt.compare(password, user?.passwordHash ?? (DUMMY_HASH ??= await bcrypt.hash("not-a-password", 12)));
  if (!user || !user.passwordHash || user.deletedAt || !ok) return { error: "Email or password is wrong" };
  await startSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/");
}

const Account = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60),
  defaultCurrency: z.enum(CURRENCIES),
});

export async function updateAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = Account.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.update(users).set({ ...parsed.data, emailDigest: form.get("emailDigest") === "on" }).where(eq(users.id, user.id));
  return { ok: "Saved" };
}

export async function deleteAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (String(form.get("confirm")) !== "DELETE") return { error: "Type DELETE to confirm" };
  if ((await edgesForUser(user.id)).length > 0) return { error: "Settle up every balance before deleting your account" };
  // anonymise rather than hard delete so other people's expense history stays correct
  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.delete(avatars).where(eq(avatars.userId, user.id));
    await tx.delete(friendships).where(or(eq(friendships.userId, user.id), eq(friendships.friendId, user.id)));
    await tx.delete(groupMembers).where(eq(groupMembers.userId, user.id));
    await tx.update(users).set({ name: "Deleted user", email: `deleted-${user.id}@invalid`, passwordHash: null, deletedAt: new Date() }).where(eq(users.id, user.id));
  });
  await endSession();
  redirect("/");
}
