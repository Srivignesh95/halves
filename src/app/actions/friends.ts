"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { befriend, findOrInvite, normaliseEmail } from "@/lib/users";
import { logActivity } from "@/lib/activity";
import { sendInvites } from "@/lib/invites";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db";
import { assertUuid, areFriends } from "@/lib/access";
import type { ActionState } from "@/components/forms";

export async function addFriend(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const email = normaliseEmail(String(form.get("email") ?? ""));
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" };
  if (email === me.email) return { error: "That's you" };
  const friend = await db.transaction(async (tx) => {
    const u = await findOrInvite(tx, email, name);
    await befriend(tx, me.id, u.id);
    await logActivity(tx, { type: "friend_added", actorId: me.id, userIds: [u.id], summary: `${me.name} and ${u.name} are now friends` });
    return u;
  });
  const invited = await sendInvites(me.name, [friend]);
  redirect(`/friends/${friend.id}${invited ? "?invited=1" : ""}`);
}

/** "Resend invite" on a friend who hasn't signed up. One email a day per address. */
export async function resendInvite(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const friendId = String(form.get("friendId") ?? "");
  assertUuid(friendId);
  if (!(await areFriends(me.id, friendId))) return { error: "Not found" };
  const [u] = await db.select().from(users).where(eq(users.id, friendId)).limit(1);
  if (!u) return { error: "Not found" };
  if (u.passwordHash) return { ok: `${u.name} already uses Halves.` };
  const sent = await sendInvites(me.name, [u]);
  return sent ? { ok: `Invite sent to ${u.email}` } : { error: "An invite already went to this email in the last 24 hours. Try again tomorrow." };
}
