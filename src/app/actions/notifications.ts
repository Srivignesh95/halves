"use server";

import { headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db, reminders, users } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { areFriends, assertUuid } from "@/lib/access";
import { friendBreakdown } from "@/lib/data";
import { reminderEmail, sendMail } from "@/lib/mail";
import { appBase, buildDigest } from "@/lib/notify";
import { displayName } from "@/lib/users";
import type { ActionState } from "@/components/forms";

/** Email a friend who owes you a reminder of how much. One per friend per day. */
export async function sendReminder(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const friendId = String(form.get("friendId") ?? "");
  assertUuid(friendId);
  if (!(await areFriends(me.id, friendId))) return { error: "Not found" };
  const [friend] = await db.select().from(users).where(eq(users.id, friendId)).limit(1);
  if (!friend || friend.deletedAt) return { error: "Not found" };

  const { total } = await friendBreakdown(me.id, friendId);
  const owed = total.filter(([, v]) => v > 0);
  if (owed.length === 0) return { error: `${displayName(friend)} doesn't owe you anything right now.` };

  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const recent = await db.select({ id: reminders.id }).from(reminders).where(and(eq(reminders.fromId, me.id), eq(reminders.toId, friendId), gt(reminders.createdAt, dayAgo))).limit(1);
  if (recent.length) return { error: "You already sent a reminder today. You can send another tomorrow." };

  const note = String(form.get("note") ?? "").trim().slice(0, 300) || undefined;
  const base = appBase((await headers()).get("host"));
  const link = friend.passwordHash ? `${base}/friends/${me.id}` : `${base}/signup?email=${encodeURIComponent(friend.email)}`;
  try {
    await sendMail({ to: friend.email, ...reminderEmail(me.name, owed, link, note) });
  } catch (e) {
    console.error("[reminder] email failed", e);
    return { error: "The email couldn't be sent. Try again in a few minutes." };
  }
  await db.insert(reminders).values({ fromId: me.id, toId: friendId });
  return { ok: `Reminder sent to ${displayName(friend)}.` };
}

/** "Email me my balances" on the account page. */
export async function emailMyBalances(): Promise<ActionState> {
  const me = await requireUser();
  const mail = await buildDigest(me, appBase((await headers()).get("host")));
  if (!mail) return { ok: "You're all settled up, so there's nothing to send." };
  try {
    await sendMail(mail);
  } catch (e) {
    console.error("[digest] email failed", e);
    return { error: "The email couldn't be sent. Try again in a few minutes." };
  }
  return { ok: `Sent your balances to ${me.email}.` };
}
