import "server-only";
import { eq } from "drizzle-orm";
import { db, expenses, expenseShares, friendships, groupMembers, type Executor } from "./db";
import { isGroupMember } from "./access";
import { logActivity } from "./activity";
import { buildShares, computeOwed, SplitError, type Participant, type SplitType } from "./splits";
import { formatMoney, parseMoney } from "./money";

/** Who may appear on an expense: group members, or (outside a group) you and your friends. */
export async function allowedPeople(me: string, groupId: string | null): Promise<Set<string>> {
  if (groupId) {
    const m = await db.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
    return new Set(m.map((x) => x.id));
  }
  const f = await db.select({ id: friendships.friendId }).from(friendships).where(eq(friendships.userId, me));
  return new Set([me, ...f.map((x) => x.id)]);
}

export type SplitRequest = {
  groupId: string | null;
  splitType: SplitType;
  payers: { userId: string; amount: string }[];
  participants: { userId: string; value?: string }[];
};
export type ShareInsert = { userId: string; paidCents: number; owedCents: number; splitInput: string | null };

/** Checks who is on the expense and turns the split into share rows. Returns an error message for the person, or the rows. */
export async function resolveShares(me: string, amountCents: number, input: SplitRequest): Promise<{ error: string } | { rows: ShareInsert[] }> {
  if (input.groupId && !(await isGroupMember(input.groupId, me))) return { error: "You are not in that group" };
  const allowed = await allowedPeople(me, input.groupId);
  const everyone = [...input.payers.map((p) => p.userId), ...input.participants.map((p) => p.userId)];
  if (everyone.some((id) => !allowed.has(id))) return { error: input.groupId ? "Everyone on the expense must be in the group" : "You can only split with friends" };
  if (!input.groupId && !everyone.includes(me)) return { error: "Outside a group, you have to be part of the expense" };

  let shares;
  try {
    const participants: Participant[] = input.participants.map((p) => {
      if (input.splitType === "equal") return { userId: p.userId };
      if (input.splitType === "exact") {
        const c = parseMoney(p.value ?? "0");
        if (c === null) throw new SplitError("Check the amounts in the split");
        return { userId: p.userId, value: c };
      }
      const v = Number(p.value ?? "0");
      if (!Number.isFinite(v) || v < 0) throw new SplitError("Check the numbers in the split");
      return { userId: p.userId, value: v };
    });
    const payers = input.payers.map((p) => {
      const c = input.payers.length === 1 ? amountCents : parseMoney(p.amount);
      if (c === null) throw new SplitError("Check the amounts each person paid");
      return { userId: p.userId, paidCents: c };
    });
    shares = buildShares(amountCents, payers, computeOwed(amountCents, input.splitType, participants));
  } catch (e) {
    if (e instanceof SplitError) return { error: e.message };
    throw e;
  }
  const splitInput = new Map(input.participants.map((p) => [p.userId, input.splitType === "percent" || input.splitType === "shares" ? String(Number(p.value ?? 0)) : null]));
  return { rows: shares.map((s) => ({ ...s, splitInput: splitInput.get(s.userId) ?? null })) };
}

export type NewExpense = Omit<typeof expenses.$inferInsert, "id" | "createdById" | "createdAt" | "updatedAt">;

/** Adds a Halves expense with its shares and the activity entry. Returns its id. */
export async function insertHalvesExpense(tx: Executor, me: { id: string; name: string }, data: NewExpense, rows: ShareInsert[]): Promise<string> {
  const [e] = await tx.insert(expenses).values({ ...data, createdById: me.id }).returning({ id: expenses.id });
  await tx.insert(expenseShares).values(rows.map((r) => ({ ...r, expenseId: e.id })));
  await logActivity(tx, {
    type: "expense_added", actorId: me.id, userIds: rows.map((r) => r.userId), groupId: data.groupId ?? null, expenseId: e.id,
    summary: `${me.name} added "${data.description}" (${formatMoney(data.amountCents, data.currency)})`,
  });
  return e.id;
}
