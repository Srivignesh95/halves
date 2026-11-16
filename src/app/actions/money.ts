"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, emis, expenses, moneyCategories, moneyReportPrefs, paymentMethods, personalExpenseItems, personalExpenses, type Executor } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canSeeExpense, UUID_RE } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { insertHalvesExpense, resolveShares } from "@/lib/halves-split";
import { CURRENCIES, parseMoney } from "@/lib/money";
import { fromISODate, todayISO } from "@/lib/dates";
import { customKey, isCustomKey, PAYMENT_KINDS, STANDARD_KEYS, toHalvesCategory, type PaymentKind } from "@/lib/money-categories";
import { runDueEmis } from "@/lib/money-emi";
import { buildMoneyReport } from "@/lib/money-notify";
import { monthRange, previousMonth } from "@/lib/money-report";
import { appBase } from "@/lib/notify";
import { sendMail } from "@/lib/mail";
import type { ActionState } from "@/components/forms";

const uuid = z.string().regex(UUID_RE, "Bad id");
const KINDS = PAYMENT_KINDS.map(([k]) => k) as [PaymentKind, ...PaymentKind[]];

const NewPayment = z.object({
  kind: z.enum(KINDS),
  label: z.string().trim().min(1, "Name the payment method, e.g. Visa or Cash").max(40, "Keep the payment method name short"),
  last4: z.string().trim().regex(/^(\d{4})?$/, "Last 4 digits should be 4 numbers").optional().default(""),
});
const PaymentChoice = z.union([z.object({ id: uuid }), z.object({ create: NewPayment })], { errorMap: () => ({ message: "Pick how you paid" }) });

/** A category key the person may use: a standard one or one of their own. */
async function checkCategory(userId: string, key: string): Promise<boolean> {
  if (STANDARD_KEYS.includes(key)) return true;
  if (!isCustomKey(key)) return false;
  const r = await db.select({ id: moneyCategories.id }).from(moneyCategories).where(and(eq(moneyCategories.id, key.slice(2)), eq(moneyCategories.userId, userId))).limit(1);
  return r.length > 0;
}

/** Finds the chosen payment method, or makes the new one (reusing an identical existing one). */
async function resolvePayment(x: Executor, userId: string, choice: z.infer<typeof PaymentChoice>): Promise<string | null> {
  if ("id" in choice) {
    const r = await x.select({ id: paymentMethods.id }).from(paymentMethods).where(and(eq(paymentMethods.id, choice.id), eq(paymentMethods.userId, userId))).limit(1);
    return r[0]?.id ?? null;
  }
  const { kind, label, last4 } = choice.create;
  const mine = await x.select().from(paymentMethods).where(eq(paymentMethods.userId, userId));
  const same = mine.find((m) => m.kind === kind && m.label.toLowerCase() === label.toLowerCase() && (m.last4 ?? "") === last4);
  if (same) {
    if (same.archivedAt) await x.update(paymentMethods).set({ archivedAt: null }).where(eq(paymentMethods.id, same.id));
    return same.id;
  }
  const [m] = await x.insert(paymentMethods).values({ userId, kind, label, last4: last4 || null }).returning({ id: paymentMethods.id });
  return m.id;
}

const ExpenseInput = z.object({
  id: uuid.optional(),
  description: z.string().trim().min(1, "Add a description").max(120, "Keep the description under 120 characters"),
  amount: z.string(),
  currency: z.enum(CURRENCIES),
  date: z.string(),
  category: z.string().max(40),
  notes: z.string().max(1000).optional().default(""),
  payment: PaymentChoice,
  items: z.array(z.object({ name: z.string().trim().max(80), amount: z.string(), category: z.string().max(40) })).max(150).default([]),
  split: z.object({
    groupId: uuid.nullable(),
    splitType: z.enum(["equal", "exact", "percent", "shares"]),
    participants: z.array(z.object({ userId: uuid, value: z.string().optional() })).min(2, "Pick who you're splitting with").max(100),
  }).nullable().default(null),
});

export async function savePersonalExpense(_: ActionState, form: FormData): Promise<ActionState> {
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
  if (!(await checkCategory(me.id, input.category))) return { error: "Pick a category" };

  const items: { name: string; amountCents: number; category: string; position: number }[] = [];
  for (const [i, it] of input.items.entries()) {
    const c = parseMoney(it.amount);
    if (c === null) return { error: `Check the price of "${it.name || "an item"}"` };
    if (!(await checkCategory(me.id, it.category))) return { error: `Pick a category for "${it.name || "an item"}"` };
    items.push({ name: it.name || "Item", amountCents: c, category: it.category, position: i });
  }

  const old = input.id
    ? await db.query.personalExpenses.findFirst({ where: and(eq(personalExpenses.id, input.id), eq(personalExpenses.userId, me.id)) })
    : null;
  if (input.id && !old) return { error: "Expense not found" };

  // Splitting happens when the expense is first added; after that, change the split on Halves.
  let shareRows = null;
  if (!old && input.split) {
    const resolved = await resolveShares(me.id, amountCents, {
      groupId: input.split.groupId,
      splitType: input.split.splitType,
      payers: [{ userId: me.id, amount: input.amount }],
      participants: input.split.participants,
    });
    if ("error" in resolved) return { error: resolved.error };
    shareRows = resolved.rows;
  }

  const id = await db.transaction(async (tx) => {
    const paymentMethodId = await resolvePayment(tx, me.id, input.payment);
    if (!paymentMethodId) throw new Error("payment method not found");
    const fields = {
      description: input.description,
      // a linked Halves expense keeps its amount; change it there
      amountCents: old?.halvesExpenseId ? old.amountCents : amountCents,
      currency: old?.halvesExpenseId ? old.currency : input.currency,
      date,
      category: input.category,
      paymentMethodId,
      notes: input.notes || null,
    };
    let expenseId: string;
    if (old) {
      await tx.update(personalExpenses).set(fields).where(eq(personalExpenses.id, old.id));
      await tx.delete(personalExpenseItems).where(eq(personalExpenseItems.expenseId, old.id));
      expenseId = old.id;
    } else {
      let halvesExpenseId: string | null = null;
      if (shareRows) {
        const halvesCategory = STANDARD_KEYS.includes(input.category) ? toHalvesCategory(input.category) : "general";
        halvesExpenseId = await insertHalvesExpense(tx, me, {
          groupId: input.split!.groupId,
          description: input.description,
          amountCents,
          currency: input.currency,
          date,
          category: halvesCategory,
          splitType: input.split!.splitType,
          notes: input.notes || null,
        }, shareRows);
      }
      const [row] = await tx.insert(personalExpenses).values({ ...fields, userId: me.id, halvesExpenseId }).returning({ id: personalExpenses.id });
      expenseId = row.id;
    }
    if (items.length) await tx.insert(personalExpenseItems).values(items.map((it) => ({ ...it, expenseId })));
    return expenseId;
  });
  redirect(`/money/${id}`);
}

export async function deletePersonalExpense(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Expense not found" };
  const e = await db.query.personalExpenses.findFirst({ where: and(eq(personalExpenses.id, id), eq(personalExpenses.userId, me.id)) });
  if (!e) return { error: "Expense not found" };
  const alsoHalves = form.get("alsoHalves") === "on";
  await db.transaction(async (tx) => {
    if (alsoHalves && e.halvesExpenseId) {
      const h = await tx.query.expenses.findFirst({ where: eq(expenses.id, e.halvesExpenseId), with: { shares: true } });
      if (h && !h.deletedAt && (await canSeeExpense(h, me.id, tx))) {
        await tx.update(expenses).set({ deletedAt: new Date() }).where(eq(expenses.id, h.id));
        await logActivity(tx, { type: "expense_deleted", actorId: me.id, userIds: h.shares.map((s) => s.userId), groupId: h.groupId, expenseId: h.id, summary: `${me.name} deleted "${h.description}"` });
      }
    }
    await tx.delete(personalExpenses).where(eq(personalExpenses.id, e.id));
  });
  redirect("/money");
}

// ── EMIs ──

const EmiInput = z.object({
  name: z.string().trim().min(1, "Name the EMI, e.g. Car loan").max(60),
  lender: z.string().trim().max(60).optional().default(""),
  amount: z.string(),
  currency: z.enum(CURRENCIES),
  frequency: z.enum(["monthly", "fortnightly"]),
  nextDue: z.string(),
  paymentsLeft: z.string().trim().regex(/^\d{0,4}$/, "Payments left should be a whole number").optional().default(""),
  paymentMethodId: z.union([uuid, z.literal("")]).optional().default(""),
});

export async function addEmi(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const parsed = EmiInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const i = parsed.data;
  const amountCents = parseMoney(i.amount);
  if (!amountCents) return { error: "Enter an amount above zero" };
  const due = fromISODate(i.nextDue);
  if (!due) return { error: "Pick the next payment date" };
  const left = i.paymentsLeft === "" ? null : Number(i.paymentsLeft);
  if (left === 0) return { error: "Payments left should be at least 1, or leave it empty" };
  let paymentMethodId: string | null = null;
  if (i.paymentMethodId) {
    paymentMethodId = await resolvePayment(db, me.id, { id: i.paymentMethodId });
    if (!paymentMethodId) return { error: "Pick a payment method" };
  }
  await db.insert(emis).values({
    userId: me.id, name: i.name, lender: i.lender || null, amountCents, currency: i.currency, frequency: i.frequency,
    startsOn: due, nextDueOn: due, paymentsLeft: left, paymentMethodId,
  });
  // a payment due today (or earlier) is added straight away
  if (i.nextDue <= todayISO()) await runDueEmis(me.id);
  revalidatePath("/money/emis");
  return { ok: "EMI added" };
}

async function myEmi(userId: string, form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!UUID_RE.test(id)) return null;
  return (await db.select().from(emis).where(and(eq(emis.id, id), eq(emis.userId, userId))).limit(1))[0] ?? null;
}

export async function stopEmi(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const e = await myEmi(me.id, form);
  if (!e) return { error: "EMI not found" };
  await db.update(emis).set({ stoppedAt: new Date(), nextDueOn: null }).where(eq(emis.id, e.id));
  revalidatePath("/money/emis");
  return { ok: `Stopped "${e.name}". Payments already added stay in your history.` };
}

export async function deleteEmi(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const e = await myEmi(me.id, form);
  if (!e) return { error: "EMI not found" };
  await db.delete(emis).where(eq(emis.id, e.id));
  revalidatePath("/money/emis");
  return { ok: `Removed "${e.name}". Payments already added stay in your history.` };
}

// ── Payment methods and categories ──

export async function addPaymentMethod(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const parsed = NewPayment.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await resolvePayment(db, me.id, { create: parsed.data });
  revalidatePath("/money/settings");
  return { ok: "Saved" };
}

export async function removePaymentMethod(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Not found" };
  // archived, not deleted, so past expenses keep the card's name
  await db.update(paymentMethods).set({ archivedAt: new Date() }).where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, me.id), isNull(paymentMethods.archivedAt)));
  revalidatePath("/money/settings");
  return { ok: "Removed. Past expenses still show it." };
}

export async function addCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Name the category" };
  if (name.length > 30) return { error: "Keep the name under 30 characters" };
  const [made] = await db.insert(moneyCategories).values({ userId: me.id, name }).onConflictDoNothing().returning({ id: moneyCategories.id });
  if (!made) return { error: `You already have "${name}"` };
  revalidatePath("/money/settings");
  return { ok: `Added "${name}"` };
}

export async function deleteCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Not found" };
  const key = customKey(id);
  await db.transaction(async (tx) => {
    const gone = await tx.delete(moneyCategories).where(and(eq(moneyCategories.id, id), eq(moneyCategories.userId, me.id))).returning({ id: moneyCategories.id });
    if (!gone.length) return;
    // anything filed under it moves to Other
    const mine = tx.select({ id: personalExpenses.id }).from(personalExpenses).where(eq(personalExpenses.userId, me.id));
    await tx.update(personalExpenses).set({ category: "other" }).where(and(eq(personalExpenses.userId, me.id), eq(personalExpenses.category, key)));
    await tx.update(personalExpenseItems).set({ category: "other" }).where(and(inArray(personalExpenseItems.expenseId, mine), eq(personalExpenseItems.category, key)));
    await tx.update(emis).set({ category: "other" }).where(and(eq(emis.userId, me.id), eq(emis.category, key)));
  });
  revalidatePath("/money/settings");
  return { ok: "Removed. Its expenses moved to Other." };
}

// ── Monthly report ──

export async function setMoneyReport(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const enabled = form.get("enabled") === "on";
  await db.insert(moneyReportPrefs).values({ userId: me.id, enabled }).onConflictDoUpdate({ target: moneyReportPrefs.userId, set: { enabled } });
  revalidatePath("/money/settings");
  return { ok: enabled ? "You'll get the report at the start of each month" : "Monthly report turned off" };
}

export async function emailMoneyReport(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const month = String(form.get("month") ?? "") || previousMonth(new Date());
  if (!monthRange(month)) return { error: "Pick a month" };
  const mail = await buildMoneyReport(me, month, appBase((await headers()).get("host")));
  try {
    await sendMail(mail);
  } catch (e) {
    console.error("[money report] send failed", e);
    return { error: "The email couldn't be sent right now. Try again later." };
  }
  return { ok: `Sent to ${me.email}` };
}
