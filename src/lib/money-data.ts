import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, notInArray } from "drizzle-orm";
import { db, expenses, expenseShares, moneyCategories, paymentMethods, personalExpenses, users } from "./db";
import { customKey, fromHalvesCategory, isCard, moneyCategoryLabel, paymentLabel } from "./money-categories";
import { buildReport, monthRange, type HalvesShare, type ReportExpense } from "./money-report";

export type PaymentOption = { id: string; kind: string; label: string; last4: string | null; name: string };

/** Saved payment methods (newest first) and the person's own categories. */
export async function moneyOptions(userId: string) {
  const [methods, cats] = await Promise.all([
    db.select().from(paymentMethods).where(and(eq(paymentMethods.userId, userId), isNull(paymentMethods.archivedAt))).orderBy(desc(paymentMethods.createdAt)),
    db.select({ id: moneyCategories.id, name: moneyCategories.name }).from(moneyCategories).where(eq(moneyCategories.userId, userId)).orderBy(asc(moneyCategories.name)),
  ]);
  return {
    payments: methods.map((m): PaymentOption => ({ id: m.id, kind: m.kind, label: m.label, last4: m.last4, name: paymentLabel(m) })),
    customCategories: cats.map((c) => ({ key: customKey(c.id), name: c.name })),
  };
}

export async function customCategoryNames(userId: string): Promise<Map<string, string>> {
  const cats = await db.select({ id: moneyCategories.id, name: moneyCategories.name }).from(moneyCategories).where(eq(moneyCategories.userId, userId));
  return new Map(cats.map((c) => [customKey(c.id), c.name]));
}

export type MonthEntry = {
  kind: "personal" | "halves";
  id: string;
  href: string;
  description: string;
  date: Date;
  currency: string;
  /** what counts as your spending */
  myCents: number;
  /** full amount (personal entries) */
  amountCents: number;
  category: string;
  payment: string | null;
  split: boolean;
  emi: boolean;
};

/** Everything that counts as your spending in one month, plus the report built from it. */
export async function monthData(userId: string, month: string) {
  const range = monthRange(month);
  if (!range) throw new Error("bad month");
  const inMonth = (col: typeof personalExpenses.date | typeof expenses.date) => and(gte(col, range.from), lt(col, range.to));

  const personal = await db.query.personalExpenses.findMany({
    where: and(eq(personalExpenses.userId, userId), inMonth(personalExpenses.date)),
    orderBy: [desc(personalExpenses.date), desc(personalExpenses.createdAt)],
    with: {
      items: { columns: { amountCents: true, category: true } },
      paymentMethod: true,
      halvesExpense: { columns: { id: true, deletedAt: true }, with: { shares: { columns: { userId: true, owedCents: true } } } },
    },
  });

  // Halves expenses you have a share in that you didn't enter through My Money (a friend added them, or you used Halves directly)
  const linked = db.select({ id: personalExpenses.halvesExpenseId }).from(personalExpenses).where(and(eq(personalExpenses.userId, userId), isNotNull(personalExpenses.halvesExpenseId)));
  const halvesRows = await db
    .select({
      id: expenses.id, description: expenses.description, date: expenses.date, currency: expenses.currency, category: expenses.category,
      owedCents: expenseShares.owedCents, paidCents: expenseShares.paidCents, by: users.name,
    })
    .from(expenseShares)
    .innerJoin(expenses, eq(expenses.id, expenseShares.expenseId))
    .innerJoin(users, eq(users.id, expenses.createdById))
    .where(and(
      eq(expenseShares.userId, userId),
      isNull(expenses.deletedAt),
      eq(expenses.isPayment, false),
      inMonth(expenses.date),
      notInArray(expenses.id, linked),
    ))
    .orderBy(desc(expenses.date));

  const entries: MonthEntry[] = [];
  const reportExpenses: ReportExpense[] = [];
  for (const p of personal) {
    const live = p.halvesExpense && !p.halvesExpense.deletedAt ? p.halvesExpense : null;
    const mine = live ? live.shares.find((s) => s.userId === userId)?.owedCents ?? 0 : p.amountCents;
    reportExpenses.push({
      amountCents: p.amountCents, myShareCents: mine, currency: p.currency, category: p.category, items: p.items,
      paymentMethodId: p.paymentMethodId, isEmi: !!p.emiId, splitOnHalves: !!live,
    });
    entries.push({
      kind: "personal", id: p.id, href: `/money/${p.id}`, description: p.description, date: p.date, currency: p.currency,
      myCents: mine, amountCents: p.amountCents, category: p.category, payment: p.paymentMethod ? paymentLabel(p.paymentMethod) : null, split: !!live, emi: !!p.emiId,
    });
  }
  const halves: HalvesShare[] = [];
  for (const h of halvesRows) {
    if (h.owedCents <= 0) continue;
    const category = fromHalvesCategory(h.category);
    halves.push({ owedCents: h.owedCents, paidCents: h.paidCents, currency: h.currency, category });
    entries.push({
      kind: "halves", id: h.id, href: `/expenses/${h.id}`, description: h.description, date: h.date, currency: h.currency,
      myCents: h.owedCents, amountCents: h.owedCents, category, payment: null, split: true, emi: false,
    });
  }
  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  // every payment method mentioned, including archived ones, so old months still show names
  const pmIds = [...new Set(personal.map((p) => p.paymentMethodId).filter((x): x is string => !!x))];
  const pms = pmIds.length ? await db.select().from(paymentMethods).where(inArray(paymentMethods.id, pmIds)) : [];
  const payNames = new Map(pms.map((m) => [m.id, paymentLabel(m)]));
  const cardIds = new Set(pms.filter((m) => isCard(m.kind)).map((m) => m.id));

  const report = buildReport(reportExpenses, halves, cardIds);
  const custom = await customCategoryNames(userId);
  return {
    entries,
    report,
    payName: (id: string) => (id ? payNames.get(id) ?? "Removed payment method" : "Not recorded"),
    catName: (key: string) => moneyCategoryLabel(key, custom),
  };
}

/** Has this person used My Money at all? Only they get the monthly email. */
export async function usesMyMoney(userId: string): Promise<boolean> {
  const r = await db.select({ id: personalExpenses.id }).from(personalExpenses).where(eq(personalExpenses.userId, userId)).limit(1);
  return r.length > 0;
}
