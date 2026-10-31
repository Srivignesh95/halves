import "server-only";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, friendships, groupMembers, type Executor } from "./db";

/** One place that answers "can this user see / change this record". Unknown and forbidden look the same: 404. */

export async function isGroupMember(groupId: string, userId: string, x: Executor = db) {
  const r = await x.select({ g: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))).limit(1);
  return r.length > 0;
}

export async function assertGroupMember(groupId: string, userId: string) {
  if (!(await isGroupMember(groupId, userId))) notFound();
}

export async function canSeeExpense(expense: { groupId: string | null; shares: { userId: string }[] }, userId: string, x: Executor = db) {
  if (expense.shares.some((s) => s.userId === userId)) return true;
  return expense.groupId ? isGroupMember(expense.groupId, userId, x) : false;
}

export async function areFriends(a: string, b: string) {
  const r = await db.select({ u: friendships.userId }).from(friendships).where(and(eq(friendships.userId, a), eq(friendships.friendId, b))).limit(1);
  return r.length > 0;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(id: string) {
  if (!UUID_RE.test(id)) notFound();
}
