import "server-only";
import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { db, expenses, expenseShares, friendships, groupMembers, groups, users } from "./db";
import { balancesFor, groupDebts, pairwiseDebts, totals, type Edge, type ExpenseLike } from "./balances";

const shareCols = { columns: { userId: true, paidCents: true, owedCents: true } } as const;

/** Subquery: ids of expenses where `userId` has a share. */
export const expensesWithShareFor = (userId: string) =>
  inArray(expenses.id, db.select({ id: expenseShares.expenseId }).from(expenseShares).where(eq(expenseShares.userId, userId)));

/** Subquery: ids of groups `userId` belongs to. */
export const groupsOf = (userId: string) => db.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId));

async function expenseLikes(where: SQL | undefined): Promise<(ExpenseLike & { groupId: string | null })[]> {
  return db.query.expenses.findMany({ where: and(isNull(expenses.deletedAt), where), columns: { currency: true, groupId: true }, with: { shares: shareCols } });
}

/** Debts inside one group (simplified if the group says so). */
export async function groupEdges(groupId: string, simplify: boolean): Promise<Edge[]> {
  return groupDebts(await expenseLikes(eq(expenses.groupId, groupId)), simplify);
}

async function groupsWithExpenses(groupIds: string[]) {
  if (groupIds.length === 0) return [];
  const gs = await db.select({ id: groups.id, name: groups.name, simplifyDebts: groups.simplifyDebts }).from(groups).where(inArray(groups.id, groupIds));
  const all = await expenseLikes(inArray(expenses.groupId, groupIds));
  return gs.map((g) => ({ ...g, expenses: all.filter((e) => e.groupId === g.id) }));
}

/** Every debt edge that involves `userId`, across all their groups and non-group expenses. */
export async function edgesForUser(userId: string): Promise<Edge[]> {
  const gids = (await groupsOf(userId)).map((r) => r.id);
  const edges: Edge[] = [];
  for (const g of await groupsWithExpenses(gids)) edges.push(...groupDebts(g.expenses, g.simplifyDebts));
  edges.push(...pairwiseDebts(await expenseLikes(and(isNull(expenses.groupId), expensesWithShareFor(userId)))));
  return edges.filter((e) => e.from === userId || e.to === userId);
}

export async function dashboard(userId: string) {
  const perPerson = balancesFor(userId, await edgesForUser(userId));
  const ids = [...perPerson.keys()];
  const people = ids.length ? await db.select({ id: users.id, name: users.name, email: users.email, deletedAt: users.deletedAt }).from(users).where(inArray(users.id, ids)) : [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const rows = [...perPerson.entries()].map(([id, m]) => ({ user: byId.get(id)!, amounts: [...m.entries()] }));
  rows.sort((a, b) => a.user.name.localeCompare(b.user.name));
  return { rows, ...totals(perPerson) };
}

/** Balance with one person, plus the per-group breakdown. Positive = they owe me. */
export async function friendBreakdown(me: string, friendId: string) {
  const mine = new Set((await groupsOf(me)).map((r) => r.id));
  const shared = (await groupsOf(friendId)).map((r) => r.id).filter((id) => mine.has(id));
  const parts: { groupId: string | null; name: string; amounts: [string, number][] }[] = [];
  for (const g of await groupsWithExpenses(shared)) {
    const m = balancesFor(me, groupDebts(g.expenses, g.simplifyDebts)).get(friendId);
    if (m) parts.push({ groupId: g.id, name: g.name, amounts: [...m.entries()] });
  }
  const loose = await expenseLikes(and(isNull(expenses.groupId), expensesWithShareFor(me), expensesWithShareFor(friendId)));
  const lm = balancesFor(me, pairwiseDebts(loose)).get(friendId);
  if (lm) parts.push({ groupId: null, name: "Non-group expenses", amounts: [...lm.entries()] });

  const total = new Map<string, number>();
  for (const p of parts) for (const [c, v] of p.amounts) total.set(c, (total.get(c) ?? 0) + v);
  for (const [c, v] of total) if (v === 0) total.delete(c);
  return { parts, total: [...total.entries()] };
}

export async function myFriends(userId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.friendId))
    .where(and(eq(friendships.userId, userId), isNull(users.deletedAt)))
    .orderBy(asc(users.name));
}

export async function sidebar(userId: string) {
  const [gs, friends] = await Promise.all([
    db.select({ id: groups.id, name: groups.name }).from(groups).where(inArray(groups.id, groupsOf(userId))).orderBy(asc(groups.name)),
    myFriends(userId),
  ]);
  return { groups: gs, friends };
}

/** `with` clause for anything rendered by <ExpenseList>. */
export const expenseListWith = {
  shares: { columns: { userId: true, paidCents: true, owedCents: true }, with: { user: { columns: { id: true, name: true } } } },
  group: { columns: { id: true, name: true } },
  receipt: { columns: { expenseId: true } },
} as const;
