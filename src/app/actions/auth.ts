"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { and, count, eq, gt, or } from "drizzle-orm";
import { headers } from "next/headers";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { avatars, db, friendships, groupMembers, loginFailures, pendingSignups, sessions, users } from "@/lib/db";
import { sendMail, signupCodeEmail } from "@/lib/mail";
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

const CODE_MINUTES = 15;
const MAX_CODE_TRIES = 5;
const MAX_SENDS_PER_HOUR = 5;
const RESEND_AFTER_MS = 60_000;
const codeHash = (id: string, code: string) => createHash("sha256").update(`${id}:${code}`).digest("hex");
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
}

/** Step 1 of sign-up: check the details, then email a 6-digit code. Nothing is created until the code is entered. */
export async function signup(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = normaliseEmail(parsed.data.email);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing?.passwordHash || existing?.deletedAt) return { error: "That email already has an account. Log in instead." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [prev] = await db.select().from(pendingSignups).where(eq(pendingSignups.email, email)).limit(1);
  const freshHour = !prev || prev.createdAt < new Date(Date.now() - 3600_000);
  if (prev && !freshHour && prev.sends >= MAX_SENDS_PER_HOUR) return { error: "Too many codes sent to this email. Try again in an hour." };
  if (prev && Date.now() - prev.lastSentAt.getTime() < RESEND_AFTER_MS) {
    // a code was just sent: keep that code (no new email), but use the latest name and password
    await db.update(pendingSignups).set({ name: parsed.data.name, passwordHash }).where(eq(pendingSignups.id, prev.id));
    redirect(`/signup/verify?email=${encodeURIComponent(email)}`);
  }

  const id = prev?.id ?? randomUUID();
  const code = newCode();
  const row = {
    name: parsed.data.name,
    passwordHash,
    codeHash: codeHash(id, code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
    attempts: 0,
    sends: freshHour ? 1 : (prev?.sends ?? 0) + 1,
    lastSentAt: new Date(),
    ...(freshHour ? { createdAt: new Date() } : {}),
  };
  await db.insert(pendingSignups).values({ id, email, ...row }).onConflictDoUpdate({ target: pendingSignups.email, set: row });
  try {
    await sendMail({ to: email, ...signupCodeEmail(parsed.data.name, code, CODE_MINUTES) });
  } catch (e) {
    console.error("[signup] code email failed", e);
    return { error: "We couldn't send the code email. Try again in a few minutes." };
  }
  redirect(`/signup/verify?email=${encodeURIComponent(email)}`);
}

/** Step 2 of sign-up: the code from the email creates the account (or claims the invite waiting for this email). */
export async function verifySignup(_: ActionState, form: FormData): Promise<ActionState> {
  const email = normaliseEmail(String(form.get("email") ?? ""));
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Enter the 6-digit code from the email" };
  const [p] = await db.select().from(pendingSignups).where(eq(pendingSignups.email, email)).limit(1);
  if (!p || p.expiresAt < new Date()) return { error: "This code has expired. Go back and sign up again to get a new one." };
  if (p.attempts >= MAX_CODE_TRIES) return { error: "Too many wrong codes. Go back and sign up again to get a new one." };
  const given = Buffer.from(codeHash(p.id, code));
  const want = Buffer.from(p.codeHash);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    await db.update(pendingSignups).set({ attempts: p.attempts + 1 }).where(eq(pendingSignups.id, p.id));
    const left = MAX_CODE_TRIES - p.attempts - 1;
    return { error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Go back and sign up again to get a new one." };
  }

  const userId = await db.transaction(async (tx) => {
    // the pending row is used up exactly once, even if the form is sent twice
    const claimed = await tx.delete(pendingSignups).where(eq(pendingSignups.id, p.id)).returning({ id: pendingSignups.id });
    if (!claimed.length) return null;
    const [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing?.passwordHash || existing?.deletedAt) return null;
    if (existing) {
      // someone invited this email, and the code proves it's really theirs: claim it with its history
      await tx.update(users).set({ name: p.name, passwordHash: p.passwordHash }).where(eq(users.id, existing.id));
      return existing.id;
    }
    return (await tx.insert(users).values({ email, name: p.name, passwordHash: p.passwordHash }).returning({ id: users.id }))[0].id;
  });
  if (!userId) return { error: "That email already has an account. Log in instead." };
  await startSession(userId);
  redirect("/dashboard");
}

let DUMMY_HASH: string | undefined;
const LOCK_MINUTES = 15;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const email = normaliseEmail(String(form.get("email") ?? "")).slice(0, 320);
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);

  // slow down guessing: a few wrong passwords locks that email (and a busy IP) for a while
  const [{ n: byEmail }] = await db.select({ n: count() }).from(loginFailures).where(and(eq(loginFailures.email, email), gt(loginFailures.createdAt, since)));
  const [{ n: byIp }] = ip ? await db.select({ n: count() }).from(loginFailures).where(and(eq(loginFailures.ip, ip), gt(loginFailures.createdAt, since))) : [{ n: 0 }];
  if (byEmail >= MAX_FAILS_PER_EMAIL || byIp >= MAX_FAILS_PER_IP) {
    return { error: `Too many wrong attempts. Try again in ${LOCK_MINUTES} minutes, or reset your password.` };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // compare even when the user is missing so timing does not reveal which emails exist
  const ok = await bcrypt.compare(password, user?.passwordHash ?? (DUMMY_HASH ??= await bcrypt.hash("not-a-password", 12)));
  if (!user || !user.passwordHash || user.deletedAt || !ok) {
    await db.insert(loginFailures).values({ email, ip });
    return { error: "Email or password is wrong" };
  }
  await db.delete(loginFailures).where(eq(loginFailures.email, email));
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
