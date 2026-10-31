// Realistic fake data, no real people. Every account's password: password123
// Run: npm run db:seed
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { buildShares, computeOwed } from "../lib/splits";

const { users, friendships, groups, groupMembers, expenses, expenseShares } = schema;
const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  if ((await db.select().from(groups).where(eq(groups.name, "Maple St house"))).length) return console.log("Already seeded");
  const hash = await bcrypt.hash("password123", 12);
  const mk = async (name: string, email: string) =>
    (await db.insert(users).values({ name, email, passwordHash: hash }).onConflictDoUpdate({ target: users.email, set: { name } }).returning())[0];
  const ana = await mk("Ana Ruiz", "ana@example.com");
  const ben = await mk("Ben Okafor", "ben@example.com");
  const chloe = await mk("Chloe Martin", "chloe@example.com");
  const dev = await mk("Dev Patel", "dev@example.com");
  const everyone = [ana, ben, chloe, dev];
  for (const a of everyone) for (const b of everyone) if (a.id !== b.id) await db.insert(friendships).values({ userId: a.id, friendId: b.id }).onConflictDoNothing();

  const [house] = await db.insert(groups).values({ name: "Maple St house", type: "home", createdById: ana.id }).returning();
  await db.insert(groupMembers).values([ana, ben, chloe].map((u) => ({ groupId: house.id, userId: u.id })));
  const [trip] = await db.insert(groups).values({ name: "Rockies road trip", type: "trip", createdById: ben.id }).returning();
  await db.insert(groupMembers).values(everyone.map((u) => ({ groupId: trip.id, userId: u.id })));

  const add = async (groupId: string | null, description: string, cents: number, payer: string, people: string[], date: string, category = "general") => {
    const shares = buildShares(cents, [{ userId: payer, paidCents: cents }], computeOwed(cents, "equal", people.map((userId) => ({ userId }))));
    const [e] = await db
      .insert(expenses)
      .values({ groupId, description, amountCents: cents, currency: "CAD", date: new Date(`${date}T00:00:00Z`), category, createdById: payer })
      .returning();
    await db.insert(expenseShares).values(shares.map((s) => ({ ...s, expenseId: e.id })));
  };
  const h = [ana.id, ben.id, chloe.id];
  await add(house.id, "October rent", 240000, ana.id, h, "2026-10-01", "rent");
  await add(house.id, "Hydro bill", 13450, ben.id, h, "2026-10-08", "utilities");
  await add(house.id, "Groceries", 8723, chloe.id, h, "2026-10-12", "groceries");
  await add(house.id, "Internet", 7999, ana.id, h, "2026-10-15", "utilities");
  const t = everyone.map((u) => u.id);
  await add(trip.id, "Cabin, 2 nights", 64000, ben.id, t, "2026-09-12", "travel");
  await add(trip.id, "Gas", 9120, dev.id, t, "2026-09-12", "transport");
  await add(trip.id, "Dinner in Canmore", 18740, chloe.id, t, "2026-09-13", "food");
  await add(null, "Concert tickets", 15000, dev.id, [dev.id, ana.id], "2026-10-20", "entertainment");
  console.log("Seeded. Log in as ana@example.com / password123");
}

main().finally(() => client.end());
