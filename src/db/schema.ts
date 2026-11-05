// Halves data model. See replica/architecture.md.
// Money is integer cents + ISO 4217 currency. Never floats.
import { relations, sql } from "drizzle-orm";
import {
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
