"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { befriend, findOrInvite, normaliseEmail } from "@/lib/users";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/components/forms";

export async function addFriend(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const email = normaliseEmail(String(form.get("email") ?? ""));
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" };
  if (email === me.email) return { error: "That's you" };
  const friendId = await db.transaction(async (tx) => {
    const u = await findOrInvite(tx, email, name);
    await befriend(tx, me.id, u.id);
    await logActivity(tx, { type: "friend_added", actorId: me.id, userIds: [u.id], summary: `${me.name} and ${u.name} are now friends` });
    return u.id;
  });
  redirect(`/friends/${friendId}`);
}
