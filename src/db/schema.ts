// Halves data model. See replica/architecture.md.
// Money is integer cents + ISO 4217 currency. Never floats.
import { relations, sql } from "drizzle-orm";
import {
  customType,
  boolean, char, check, date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

export const groupType = pgEnum("group_type", ["home", "trip", "couple", "other"]);
export const splitType = pgEnum("split_type", ["equal", "exact", "percent", "shares"]);
export const recurrence = pgEnum("recurrence", ["none", "weekly", "fortnightly", "monthly", "yearly"]);
export const activityType = pgEnum("activity_type", [
  "expense_added", "expense_updated", "expense_deleted", "expense_restored", "payment_added", "comment_added",
  "group_created", "group_updated", "member_added", "member_removed", "friend_added",
]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // null = invited placeholder that has not signed up yet
  passwordHash: text("password_hash"),
  // last time an invite email went to this (not yet signed up) person; limits invites to one a day
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  // weekly "here's where you stand" email; people can turn it off on their account page
  emailDigest: boolean("email_digest").notNull().default(true),
  lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),
  defaultCurrency: char("default_currency", { length: 3 }).notNull().default("CAD"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable("sessions", {
  id: id(),
  // sha256 of the cookie token, so a database leak does not leak sessions
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

// One row per "forgot password" request. Only the sha256 of the emailed token is stored.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

// Profile photos: small square images (resized in the browser before upload), one per user.
export const avatars = pgTable("avatars", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  mime: text("mime").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// The photo attached to an expense. On Vercel it lives in a private Blob store (blobUrl);
// without a Blob token (local dev and tests) the bytes are kept in `data` instead.
export const expenseReceipts = pgTable("expense_receipts", {
  expenseId: uuid("expense_id").primaryKey().references(() => expenses.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url"),
  data: bytea("data"),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// Sign-ups waiting for their email code. The account is only created (or an invite claimed) once the code checks out.
export const pendingSignups = pgTable("pending_signups", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  sends: integer("sends").notNull().default(1),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
});

// Failed log-ins, to slow down password guessing.
export const loginFailures = pgTable("login_failures", {
  id: id(),
  email: text("email").notNull(),
  ip: text("ip"),
  createdAt: createdAt(),
}, (t) => [index("login_failures_email_idx").on(t.email, t.createdAt), index("login_failures_ip_idx").on(t.ip, t.createdAt)]);

// Receipt scans, kept only to limit how many a person can do per day (the photo itself is not stored).
export const receiptScans = pgTable("receipt_scans", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ok: boolean("ok").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index("receipt_scans_user_idx").on(t.userId, t.createdAt)]);

// "Send reminder": one row per reminder, used to allow one a day per pair of people.
export const reminders = pgTable("reminders", {
  id: id(),
  fromId: uuid("from_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toId: uuid("to_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [index("reminders_pair_idx").on(t.fromId, t.toId, t.createdAt)]);

export const passwordResets = pgTable("password_resets", {
  id: id(),
  // null when the email matched no account: the row still counts toward rate limits
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  tokenHash: text("token_hash").unique(),
  ip: text("ip"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index("password_resets_user_idx").on(t.userId),
  index("password_resets_email_created_idx").on(t.email, t.createdAt),
  index("password_resets_ip_created_idx").on(t.ip, t.createdAt),
]);

export const friendships = pgTable("friendships", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  friendId: uuid("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.userId, t.friendId] }), index("friendships_friend_idx").on(t.friendId), check("friendships_not_self", sql`${t.userId} <> ${t.friendId}`)]);

export const groups = pgTable("groups", {
  id: id(),
  name: text("name").notNull(),
  type: groupType("type").notNull().default("other"),
  simplifyDebts: boolean("simplify_debts").notNull().default(true),
  defaultCurrency: char("default_currency", { length: 3 }).notNull().default("CAD"),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("groups_created_by_idx").on(t.createdById)]);

export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)]);

export const expenses = pgTable("expenses", {
  id: id(),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  // a calendar date, not an instant: no time-zone drift
  date: date("date", { mode: "date" }).notNull(),
  category: text("category").notNull().default("general"),
  splitType: splitType("split_type").notNull().default("equal"),
  isPayment: boolean("is_payment").notNull().default(false),
  notes: text("notes"),
  recurrence: recurrence("recurrence").notNull().default("none"),
  nextOccursOn: date("next_occurs_on", { mode: "date" }),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("expenses_group_date_idx").on(t.groupId, t.date),
  index("expenses_created_by_idx").on(t.createdById),
  index("expenses_recurring_idx").on(t.recurrence, t.nextOccursOn),
  check("expenses_amount_positive", sql`${t.amountCents} > 0`),
]);

export const expenseShares = pgTable("expense_shares", {
  id: id(),
  expenseId: uuid("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  paidCents: integer("paid_cents").notNull().default(0),
  owedCents: integer("owed_cents").notNull().default(0),
  // the raw input for percent / shares splits, so editing shows what was typed
  splitInput: numeric("split_input", { precision: 10, scale: 4 }),
}, (t) => [
  unique("expense_shares_expense_user").on(t.expenseId, t.userId),
  index("expense_shares_user_idx").on(t.userId),
  check("expense_shares_non_negative", sql`${t.paidCents} >= 0 and ${t.owedCents} >= 0`),
]);

export const comments = pgTable("comments", {
  id: id(),
  expenseId: uuid("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
}, (t) => [index("comments_expense_idx").on(t.expenseId, t.createdAt)]);

export const expenseRevisions = pgTable("expense_revisions", {
  id: id(),
  expenseId: uuid("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  editorId: uuid("editor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: createdAt(),
}, (t) => [index("expense_revisions_expense_idx").on(t.expenseId, t.createdAt)]);

export const activities = pgTable("activities", {
  id: id(),
  type: activityType("type").notNull(),
  actorId: uuid("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "cascade" }),
  // everyone who should see this in their feed
  userIds: uuid("user_ids").array().notNull(),
  summary: text("summary").notNull(),
  createdAt: createdAt(),
}, (t) => [index("activities_user_ids_idx").using("gin", t.userIds), index("activities_created_idx").on(t.createdAt)]);

// relations, for db.query.* with nested `with`
export const usersRelations = relations(users, ({ many }) => ({ memberships: many(groupMembers), shares: many(expenseShares) }));
export const sessionsRelations = relations(sessions, ({ one }) => ({ user: one(users, { fields: [sessions.userId], references: [users.id] }) }));
export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user: one(users, { fields: [friendships.userId], references: [users.id], relationName: "friendOf" }),
  friend: one(users, { fields: [friendships.friendId], references: [users.id], relationName: "friend" }),
}));
export const groupsRelations = relations(groups, ({ many }) => ({ members: many(groupMembers), expenses: many(expenses) }));
export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));
export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, { fields: [expenses.groupId], references: [groups.id] }),
  createdBy: one(users, { fields: [expenses.createdById], references: [users.id] }),
  shares: many(expenseShares),
  comments: many(comments),
  revisions: many(expenseRevisions),
  receipt: one(expenseReceipts, { fields: [expenses.id], references: [expenseReceipts.expenseId] }),
}));
export const expenseSharesRelations = relations(expenseShares, ({ one }) => ({
  expense: one(expenses, { fields: [expenseShares.expenseId], references: [expenses.id] }),
  user: one(users, { fields: [expenseShares.userId], references: [users.id] }),
}));
export const commentsRelations = relations(comments, ({ one }) => ({
  expense: one(expenses, { fields: [comments.expenseId], references: [expenses.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));
export const expenseRevisionsRelations = relations(expenseRevisions, ({ one }) => ({
  expense: one(expenses, { fields: [expenseRevisions.expenseId], references: [expenses.id] }),
  editor: one(users, { fields: [expenseRevisions.editorId], references: [users.id] }),
}));
export const activitiesRelations = relations(activities, ({ one }) => ({
  actor: one(users, { fields: [activities.actorId], references: [users.id] }),
  group: one(groups, { fields: [activities.groupId], references: [groups.id] }),
}));

export type User = typeof users.$inferSelect;
export const expenseReceiptsRelations = relations(expenseReceipts, ({ one }) => ({
  expense: one(expenses, { fields: [expenseReceipts.expenseId], references: [expenses.id] }),
}));

// ───────────────────────── My Money (personal spending) ─────────────────────────
// Personal records only their owner sees. A personal expense can point at the Halves expense it was split as.

export const paymentKind = pgEnum("payment_kind", ["credit_card", "debit_card", "cash", "upi", "bank_transfer", "other"]);

// Cards, cash, UPI... One row per way the person pays. Created when they save one or type a new one on an expense.
export const paymentMethods = pgTable("payment_methods", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: paymentKind("kind").notNull(),
  label: text("label").notNull(),
  last4: char("last4", { length: 4 }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("payment_methods_user_idx").on(t.userId)]);

// Categories a person adds on top of the standard ones.
export const moneyCategories = pgTable("money_categories", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: createdAt(),
}, (t) => [unique("money_categories_user_name").on(t.userId, t.name)]);

// EMIs and other fixed instalments. The daily job turns each due one into a personal expense.
export const emis = pgTable("emis", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lender: text("lender"),
  amountCents: integer("amount_cents").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  frequency: recurrence("frequency").notNull(),
  // first payment date; also the anchor day for monthly EMIs
  startsOn: date("starts_on", { mode: "date" }).notNull(),
  nextDueOn: date("next_due_on", { mode: "date" }),
  // null = not tracked; counts down with each payment and stops the EMI at 0
  paymentsLeft: integer("payments_left"),
  paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, { onDelete: "set null" }),
  category: text("category").notNull().default("emi"),
  stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("emis_user_idx").on(t.userId),
  index("emis_due_idx").on(t.nextDueOn),
  check("emis_amount_positive", sql`${t.amountCents} > 0`),
  check("emis_frequency", sql`${t.frequency} in ('monthly', 'fortnightly')`),
]);

export const personalExpenses = pgTable("personal_expenses", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  // the full amount you paid; when split on Halves, only your share counts as spending
  amountCents: integer("amount_cents").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  date: date("date", { mode: "date" }).notNull(),
  // a standard key (see lib/money-categories) or "c:<money_categories.id>"
  category: text("category").notNull().default("other"),
  paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, { onDelete: "set null" }),
  notes: text("notes"),
  halvesExpenseId: uuid("halves_expense_id").references(() => expenses.id, { onDelete: "set null" }),
  emiId: uuid("emi_id").references(() => emis.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("personal_expenses_user_date_idx").on(t.userId, t.date),
  index("personal_expenses_halves_idx").on(t.halvesExpenseId),
  check("personal_expenses_amount_positive", sql`${t.amountCents} > 0`),
]);

// Lines read from a receipt, each with its own category. Their sum may differ from the total (tax, tip):
// the report spreads the total over the item categories in proportion.
export const personalExpenseItems = pgTable("personal_expense_items", {
  id: id(),
  expenseId: uuid("expense_id").notNull().references(() => personalExpenses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category").notNull(),
  position: integer("position").notNull().default(0),
}, (t) => [index("personal_expense_items_expense_idx").on(t.expenseId), check("personal_expense_items_non_negative", sql`${t.amountCents} >= 0`)]);

// Monthly report: on/off, and the last month sent (YYYY-MM) so a re-run never sends twice.
export const moneyReportPrefs = pgTable("money_report_prefs", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  lastSentMonth: char("last_sent_month", { length: 7 }),
  updatedAt: updatedAt(),
});

export const personalExpensesRelations = relations(personalExpenses, ({ one, many }) => ({
  user: one(users, { fields: [personalExpenses.userId], references: [users.id] }),
  paymentMethod: one(paymentMethods, { fields: [personalExpenses.paymentMethodId], references: [paymentMethods.id] }),
  halvesExpense: one(expenses, { fields: [personalExpenses.halvesExpenseId], references: [expenses.id] }),
  emi: one(emis, { fields: [personalExpenses.emiId], references: [emis.id] }),
  items: many(personalExpenseItems),
}));
export const personalExpenseItemsRelations = relations(personalExpenseItems, ({ one }) => ({
  expense: one(personalExpenses, { fields: [personalExpenseItems.expenseId], references: [personalExpenses.id] }),
}));
export const emisRelations = relations(emis, ({ one }) => ({
  paymentMethod: one(paymentMethods, { fields: [emis.paymentMethodId], references: [paymentMethods.id] }),
}));
