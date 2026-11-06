"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { comments, db, expenseRevisions, expenses, expenseShares, friendships, groupMembers, users } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { areFriends, canSeeExpense, isGroupMember, UUID_RE } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { buildShares, computeOwed, SplitError, type Participant } from "@/lib/splits";
import { CURRENCIES, formatMoney, parseMoney } from "@/lib/money";
import { fromISODate, nextOccurrence } from "@/lib/dates";
import { CATEGORIES } from "@/lib/constants";
import { removeReceiptImage, saveReceiptImage } from "@/lib/receipt-store";
import type { ActionState } from "@/components/forms";

const uuid = z.string().regex(UUID_RE, "Bad id");

const ExpenseInput = z.object({
  id: uuid.optional(),
  groupId: uuid.nullable(),
  description: z.string().trim().min(1, "Add a description").max(120, "Keep the description under 120 characters"),
  amount: z.string(),
  currency: z.enum(CURRENCIES),
  date: z.string(),
  category: z.enum(CATEGORIES.map(([k]) => k) as [string, ...string[]]),
  notes: z.string().max(1000).optional().default(""),
  recurrence: z.enum(["none", "weekly", "fortnightly", "monthly", "yearly"]),
  splitType: z.enum(["equal", "exact", "percent", "shares"]),
  payers: z.array(z.object({ userId: uuid, amount: z.string() })).min(1, "Pick who paid").max(100),
  participants: z.array(z.object({ userId: uuid, value: z.string().optional() })).min(1, "Pick at least one person").max(100),
});

/** Who may appear on an expense: group members, or (outside a group) you and your friends. */
async function allowedPeople(me: string, groupId: string | null): Promise<Set<string>> {
  if (groupId) {
    const m = await db.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
    return new Set(m.map((x) => x.id));
  }
  const f = await db.select({ id: friendships.friendId }).from(friendships).where(eq(friendships.userId, me));
  return new Set([me, ...f.map((x) => x.id)]);
}

export async function saveExpense(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Something went wrong reading the form. Reload and try again." };
  }
  const parsed = ExpenseInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const amountCents = parseMoney(input.amount);
  if (amountCents === null || amountCents === 0) return { error: "Enter an amount above zero" };
  const date = fromISODate(input.date);
  if (!date) return { error: "Pick a valid date" };

  if (input.groupId && !(await isGroupMember(input.groupId, me.id))) return { error: "You are not in that group" };
  const allowed = await allowedPeople(me.id, input.groupId);
  const everyone = [...input.payers.map((p) => p.userId), ...input.participants.map((p) => p.userId)];
  if (everyone.some((id) => !allowed.has(id))) return { error: input.groupId ? "Everyone on the expense must be in the group" : "You can only split with friends" };
  if (!input.groupId && !everyone.includes(me.id)) return { error: "Outside a group, you have to be part of the expense" };

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

  const data = {
    groupId: input.groupId,
    description: input.description,
    amountCents,
    currency: input.currency,
    date,
    category: input.category,
    notes: input.notes || null,
    splitType: input.splitType,
    recurrence: input.recurrence,
    nextOccursOn: input.recurrence === "none" ? null : nextOccurrence(date, input.recurrence),
  };
  const shareRows = shares.map((s) => ({ ...s, splitInput: splitInput.get(s.userId) ?? null }));
  const people = shares.map((s) => s.userId);
  const what = `"${input.description}" (${formatMoney(amountCents, input.currency)})`;

  const id = await db.transaction(async (tx) => {
    if (input.id) {
      const old = await tx.query.expenses.findFirst({ where: eq(expenses.id, input.id), with: { shares: true } });
      if (!old || old.isPayment || !(await canSeeExpense(old, me.id, tx))) throw new Error("not found");
      await tx.insert(expenseRevisions).values({ expenseId: old.id, editorId: me.id, snapshot: JSON.parse(JSON.stringify(old)) });
      await tx.delete(expenseShares).where(eq(expenseShares.expenseId, old.id));
      await tx.update(expenses).set(data).where(eq(expenses.id, old.id));
      await tx.insert(expenseShares).values(shareRows.map((r) => ({ ...r, expenseId: old.id })));
      await logActivity(tx, { type: "expense_updated", actorId: me.id, userIds: [...people, ...old.shares.map((s) => s.userId)], groupId: input.groupId, expenseId: old.id, summary: `${me.name} updated ${what}` });
      return old.id;
    }
    const [e] = await tx.insert(expenses).values({ ...data, createdById: me.id }).returning({ id: expenses.id });
    await tx.insert(expenseShares).values(shareRows.map((r) => ({ ...r, expenseId: e.id })));
    await logActivity(tx, { type: "expense_added", actorId: me.id, userIds: people, groupId: input.groupId, expenseId: e.id, summary: `${me.name} added ${what}` });
    return e.id;
  });

  // the photo is stored after the expense, so a storage hiccup never loses the expense itself
  let photoProblem = "";
  const photo = form.get("receiptPhoto");
  try {
    if (photo instanceof File && photo.size > 0) await saveReceiptImage(id, Buffer.from(await photo.arrayBuffer()), me.id);
    else if (form.get("removeReceipt") === "1") await removeReceiptImage(id);
  } catch (e) {
    console.error("[receipt photo]", e);
    photoProblem = (e as Error).message || "The photo couldn't be saved";
  }
  redirect(`/expenses/${id}${photoProblem ? `?photo=${encodeURIComponent(photoProblem)}` : ""}`);
}

async function loadVisible(id: string, me: string) {
  if (!UUID_RE.test(id)) return null;
  const e = await db.query.expenses.findFirst({ where: eq(expenses.id, id), with: { shares: true } });
  return e && (await canSeeExpense(e, me)) ? e : null;
}

export async function deleteExpense(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const e = await loadVisible(String(form.get("id")), me.id);
  if (!e) return { error: "Expense not found" };
  await db.transaction(async (tx) => {
    await tx.update(expenses).set({ deletedAt: new Date() }).where(eq(expenses.id, e.id));
    await logActivity(tx, { type: "expense_deleted", actorId: me.id, userIds: e.shares.map((s) => s.userId), groupId: e.groupId, expenseId: e.id, summary: `${me.name} deleted "${e.description}"` });
  });
  revalidatePath(`/expenses/${e.id}`);
  return { ok: "Deleted. You can restore it from this page." };
}

export async function restoreExpense(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const e = await loadVisible(String(form.get("id")), me.id);
  if (!e) return { error: "Expense not found" };
  if (e.groupId && !(await isGroupMember(e.groupId, me.id))) return { error: "You are no longer in that group" };
  await db.transaction(async (tx) => {
    await tx.update(expenses).set({ deletedAt: null }).where(eq(expenses.id, e.id));
    await logActivity(tx, { type: "expense_restored", actorId: me.id, userIds: e.shares.map((s) => s.userId), groupId: e.groupId, expenseId: e.id, summary: `${me.name} restored "${e.description}"` });
  });
  revalidatePath(`/expenses/${e.id}`);
  return { ok: "Restored" };
}

export async function addComment(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const e = await loadVisible(String(form.get("id")), me.id);
  if (!e) return { error: "Expense not found" };
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write something first" };
  if (body.length > 1000) return { error: "Keep comments under 1000 characters" };
  await db.transaction(async (tx) => {
    await tx.insert(comments).values({ expenseId: e.id, userId: me.id, body });
    await logActivity(tx, { type: "comment_added", actorId: me.id, userIds: e.shares.map((s) => s.userId), groupId: e.groupId, expenseId: e.id, summary: `${me.name} commented on "${e.description}"` });
  });
  revalidatePath(`/expenses/${e.id}`);
  return undefined;
}

const Settle = z.object({
  fromId: uuid,
  toId: uuid,
  amount: z.string(),
  currency: z.enum(CURRENCIES),
  date: z.string(),
  groupId: z.union([uuid, z.literal("")]),
  notes: z.string().max(500).optional().default(""),
});

export async function settleUp(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const parsed = Settle.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { fromId, toId, currency, notes } = parsed.data;
  const groupId = parsed.data.groupId || null;
  const amountCents = parseMoney(parsed.data.amount);
  if (!amountCents) return { error: "Enter an amount above zero" };
  const date = fromISODate(parsed.data.date);
  if (!date) return { error: "Pick a valid date" };
  if (fromId === toId) return { error: "Pick two different people" };

  if (groupId) {
    if (!(await isGroupMember(groupId, me.id))) return { error: "You are not in that group" };
    if (!(await isGroupMember(groupId, fromId)) || !(await isGroupMember(groupId, toId))) return { error: "Both people must be in the group" };
  } else {
    if (fromId !== me.id && toId !== me.id) return { error: "Outside a group, one side of the payment has to be you" };
    const other = fromId === me.id ? toId : fromId;
    if (!(await areFriends(me.id, other))) return { error: "You can only record payments with friends" };
  }
  const nameOf = async (uid: string) => (await db.select({ name: users.name }).from(users).where(eq(users.id, uid)))[0]?.name ?? "Someone";
  const [from, to] = [{ name: await nameOf(fromId) }, { name: await nameOf(toId) }];

  await db.transaction(async (tx) => {
    const [e] = await tx
      .insert(expenses)
      .values({ groupId, description: "Payment", amountCents, currency, date, category: "general", splitType: "exact", isPayment: true, notes: notes || null, createdById: me.id })
      .returning({ id: expenses.id });
    await tx.insert(expenseShares).values([
      { expenseId: e.id, userId: fromId, paidCents: amountCents, owedCents: 0 },
      { expenseId: e.id, userId: toId, paidCents: 0, owedCents: amountCents },
    ]);
    await logActivity(tx, { type: "payment_added", actorId: me.id, userIds: [fromId, toId], groupId, expenseId: e.id, summary: `${from.name} paid ${to.name} ${formatMoney(amountCents, currency)}` });
  });
  redirect(groupId ? `/groups/${groupId}` : `/friends/${fromId === me.id ? toId : fromId}`);
}
