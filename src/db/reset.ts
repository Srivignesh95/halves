// Wipes every table. Dev and test only. Run: npm run db:reset (then it reseeds)
import postgres from "postgres";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql`truncate users, sessions, password_resets, reminders, avatars, receipt_scans, friendships, groups, group_members, expenses, expense_shares, comments, expense_revisions, activities cascade`;
  await sql.end();
  console.log("Database wiped");
}

main();
