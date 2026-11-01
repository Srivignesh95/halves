"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { befriend, findOrInvite, normaliseEmail } from "@/lib/users";
import { logActivity } from "@/lib/activity";
import { sendInvites } from "@/lib/invites";
import { and, count, eq, or } from "drizzle-orm";
import { expenseShares, friendships, groupMembers, users } from "@/lib/db";
import { friendBreakdown } from "@/lib/data";
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

/**
 * Remove a friend. Only when you're settled up with them, so no balance silently disappears.
 * If they were an invite that never signed up and nobody else knows them, the placeholder account goes too.
 */
export async function removeFriend(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const friendId = String(form.get("friendId") ?? "");
  assertUuid(friendId);
  if (!(await areFriends(me.id, friendId))) return { error: "Not found" };
  const { total } = await friendBreakdown(me.id, friendId);
  if (total.length > 0) return { error: "Settle up first. You can only remove a friend when the balance between you is zero." };

  const [u] = await db.select().from(users).where(eq(users.id, friendId)).limit(1);
  await db.transaction(async (tx) => {
    await tx.delete(friendships).where(or(and(eq(friendships.userId, me.id), eq(friendships.friendId, friendId)), and(eq(friendships.userId, friendId), eq(friendships.friendId, me.id))));
    if (u && !u.passwordHash) {
      // an invite that never signed up: delete it if nothing else refers to it (wrong email, typo)
      const [{ n: otherFriends }] = await tx.select({ n: count() }).from(friendships).where(or(eq(friendships.userId, friendId), eq(friendships.friendId, friendId)));
      const [{ n: groupsIn }] = await tx.select({ n: count() }).from(groupMembers).where(eq(groupMembers.userId, friendId));
      const [{ n: sharesIn }] = await tx.select({ n: count() }).from(expenseShares).where(eq(expenseShares.userId, friendId));
      if (otherFriends === 0 && groupsIn === 0 && sharesIn === 0) await tx.delete(users).where(eq(users.id, friendId));
    }
  });
  redirect("/dashboard?removed=1");
}
