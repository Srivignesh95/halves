"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, groupMembers, groups, users, type Executor } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertGroupMember, UUID_RE } from "@/lib/access";
import { befriend, findOrInvite, normaliseEmail } from "@/lib/users";
import { logActivity } from "@/lib/activity";
import { sendInvites } from "@/lib/invites";
import { removeReceiptsForGroup } from "@/lib/receipt-store";
import { groupEdges } from "@/lib/data";
import { CURRENCIES } from "@/lib/money";
import type { ActionState } from "@/components/forms";

const emailList = (raw: string) => [...new Set(raw.split(/[\s,;]+/).map(normaliseEmail).filter(Boolean))];
const memberIds = async (x: Executor, groupId: string) => (await x.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId))).map((r) => r.id);
const gid = (form: FormData) => {
  const v = String(form.get("groupId") ?? "");
  return UUID_RE.test(v) ? v : "00000000-0000-0000-0000-000000000000";
};

const NewGroup = z.object({
  name: z.string().trim().min(1, "Give the group a name").max(80),
  type: z.enum(["home", "trip", "couple", "other"]),
  defaultCurrency: z.enum(CURRENCIES),
  emails: z.string().max(2000).default(""),
});

export async function createGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const parsed = NewGroup.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const emails = emailList(parsed.data.emails).filter((e) => e !== me.email);
  const bad = emails.find((e) => !z.string().email().safeParse(e).success);
  if (bad) return { error: `"${bad}" is not a valid email` };
  if (emails.length > 50) return { error: "Add at most 50 people at once" };

  const invitees: Awaited<ReturnType<typeof findOrInvite>>[] = [];
  const groupId = await db.transaction(async (tx) => {
    const [g] = await tx.insert(groups).values({ name: parsed.data.name, type: parsed.data.type, defaultCurrency: parsed.data.defaultCurrency, createdById: me.id }).returning();
    await tx.insert(groupMembers).values({ groupId: g.id, userId: me.id });
    const ids: string[] = [];
    for (const e of emails) {
      const u = await findOrInvite(tx, e);
      await tx.insert(groupMembers).values({ groupId: g.id, userId: u.id }).onConflictDoNothing();
      await befriend(tx, me.id, u.id);
      ids.push(u.id);
      invitees.push(u);
    }
    await logActivity(tx, { type: "group_created", actorId: me.id, userIds: ids, groupId: g.id, summary: `${me.name} created the group "${g.name}"` });
    return g.id;
  });
  await sendInvites(me.name, invitees, parsed.data.name);
  redirect(`/groups/${groupId}`);
}

export async function updateGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const groupId = gid(form);
  await assertGroupMember(groupId, me.id);
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 80) return { error: "Give the group a name (up to 80 characters)" };
  const simplifyDebts = form.get("simplifyDebts") === "on";
  await db.update(groups).set({ name, simplifyDebts }).where(eq(groups.id, groupId));
  await logActivity(db, { type: "group_updated", actorId: me.id, userIds: await memberIds(db, groupId), groupId, summary: `${me.name} updated the settings for "${name}"` });
  revalidatePath(`/groups/${groupId}`);
  return { ok: "Group saved" };
}

export async function addMember(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const groupId = gid(form);
  await assertGroupMember(groupId, me.id);
  const email = normaliseEmail(String(form.get("email") ?? ""));
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" };
  let added: Awaited<ReturnType<typeof findOrInvite>> | null = null;
  const result = await db.transaction(async (tx): Promise<ActionState> => {
    const u = await findOrInvite(tx, email, String(form.get("name") ?? ""));
    const inserted = await tx.insert(groupMembers).values({ groupId, userId: u.id }).onConflictDoNothing().returning();
    if (inserted.length === 0) return { error: `${u.name} is already in this group` };
    await befriend(tx, me.id, u.id);
    await logActivity(tx, { type: "member_added", actorId: me.id, userIds: await memberIds(tx, groupId), groupId, summary: `${me.name} added ${u.name} to the group` });
    added = u;
    return { ok: `${u.name} added` };
  });
  if (added) {
    const [g] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId));
    if (await sendInvites(me.name, [added], g?.name)) return { ok: `${(added as { email: string }).email} added and invited by email` };
  }
  revalidatePath(`/groups/${groupId}`);
  return result;
}

export async function removeMember(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const groupId = gid(form);
  const userId = String(form.get("userId") ?? "");
  await assertGroupMember(groupId, me.id);
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId));
  const edges = await groupEdges(groupId, g.simplifyDebts);
  if (edges.some((e) => e.from === userId || e.to === userId)) return { error: "They still have a balance in this group. Settle up first." };
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (!u) return { error: "Not a member" };
  const everyone = await memberIds(db, groupId);
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  await logActivity(db, { type: "member_removed", actorId: me.id, userIds: everyone, groupId, summary: userId === me.id ? `${me.name} left the group` : `${me.name} removed ${u.name} from the group` });
  if (userId === me.id) redirect("/dashboard");
  revalidatePath(`/groups/${groupId}`);
  return { ok: "Removed" };
}

export async function deleteGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const groupId = gid(form);
  await assertGroupMember(groupId, me.id);
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId));
  if ((await groupEdges(groupId, g.simplifyDebts)).length > 0) return { error: "Settle every balance in the group before deleting it" };
  await removeReceiptsForGroup(groupId);
  await db.delete(groups).where(eq(groups.id, groupId));
  redirect("/dashboard");
}
