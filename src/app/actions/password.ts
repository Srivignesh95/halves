"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, passwordResets, sessions, users } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { normaliseEmail } from "@/lib/users";
import { resetEmail, sendMail } from "@/lib/mail";
import type { ActionState } from "@/components/forms";

const TOKEN_MINUTES = 30;
const PER_EMAIL_PER_HOUR = 3;
const PER_IP_PER_HOUR = 10;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** The same message whatever happens, so the form can't be used to find out who has an account. */
const SENT: ActionState = { ok: "If that email has a Halves account, a reset link is on its way. Check your inbox (and spam) in a minute." };

export async function requestPasswordReset(_: ActionState, form: FormData): Promise<ActionState> {
  const email = normaliseEmail(String(form.get("email") ?? ""));
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
  const hourAgo = new Date(Date.now() - 3600_000);

  const [{ n: byEmail }] = await db.select({ n: count() }).from(passwordResets).where(and(eq(passwordResets.email, email), gt(passwordResets.createdAt, hourAgo)));
  const [{ n: byIp }] = ip
    ? await db.select({ n: count() }).from(passwordResets).where(and(eq(passwordResets.ip, ip), gt(passwordResets.createdAt, hourAgo)))
    : [{ n: 0 }];
  if (byIp >= PER_IP_PER_HOUR) return { error: "Too many reset requests. Try again in an hour." };
  if (byEmail >= PER_EMAIL_PER_HOUR) return SENT; // quietly stop: don't let the form flood someone's inbox

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const expiresAt = new Date(Date.now() + TOKEN_MINUTES * 60_000);

  if (!user || user.deletedAt) {
    // record the attempt so rate limits still apply, but send nothing
    await db.insert(passwordResets).values({ email, ip, expiresAt });
    return SENT;
  }

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({ userId: user.id, email, ip, tokenHash: hash(token), expiresAt });

  const base = (process.env.APP_URL || `https://${h.get("host")}`).replace(/\/$/, "");
  const link = `${base}/reset-password?token=${token}`;
  const mail = { to: user.email, ...resetEmail(user.name, link, TOKEN_MINUTES) };
  // send after the response, so the reply takes the same time whether or not the account exists
  after(async () => {
    try {
      await sendMail(mail);
    } catch (e) {
      console.error("[password reset] email failed", e);
    }
  });
  return SENT;
}

/** Look up a token without using it. Returns the user it belongs to, or null. */
export async function checkResetToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [row] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId, expiresAt: passwordResets.expiresAt, usedAt: passwordResets.usedAt })
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, hash(token)))
    .limit(1);
  if (!row || !row.userId || row.usedAt || row.expiresAt < new Date()) return null;
  const [user] = await db.select({ id: users.id, email: users.email, deletedAt: users.deletedAt }).from(users).where(eq(users.id, row.userId)).limit(1);
  return user && !user.deletedAt ? { resetId: row.id, user } : null;
}

const NewPassword = z
  .object({
    token: z.string(),
    password: z.string().min(8, "Use at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match", path: ["confirm"] });

export async function resetPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = NewPassword.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const found = await checkResetToken(parsed.data.token);
  if (!found) return { error: "This link has expired or was already used. Ask for a new one." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const claimed = await db.transaction(async (tx) => {
    // claim the token first so two submits can't both use it
    const used = await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.id, found.resetId), isNull(passwordResets.usedAt)))
      .returning({ id: passwordResets.id });
    if (used.length !== 1) return false;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, found.user.id));
    // any other open links for this account stop working, and every device is signed out
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, found.user.id), isNull(passwordResets.usedAt)));
    await tx.delete(sessions).where(eq(sessions.userId, found.user.id));
    return true;
  });
  if (!claimed) return { error: "This link has expired or was already used. Ask for a new one." };

  await startSession(found.user.id);
  redirect("/dashboard?reset=1");
}
