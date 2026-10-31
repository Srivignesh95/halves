import "server-only";
import { activities, type Executor } from "./db";

type ActivityType = (typeof activities.$inferInsert)["type"];

export async function logActivity(
  x: Executor,
  a: { type: ActivityType; actorId: string; userIds: string[]; summary: string; groupId?: string | null; expenseId?: string | null },
) {
  await x.insert(activities).values({
    type: a.type,
    actorId: a.actorId,
    userIds: [...new Set([a.actorId, ...a.userIds])],
    summary: a.summary,
    groupId: a.groupId ?? null,
    expenseId: a.expenseId ?? null,
  });
}
