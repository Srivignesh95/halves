import "server-only";
import { and, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db, moneyReportPrefs, personalExpenses, users } from "./db";
import { sendMail } from "./mail";
import { appBase } from "./notify";
import { buildMoneyReport } from "./money-notify";
import { previousMonth } from "./money-report";

/** Days of the month on which last month's report may still go out (covers a missed daily run). */
const SEND_DAYS = 3;

/**
 * Emails last month's spending report to everyone who uses My Money and hasn't turned it off.
 * Each person is claimed (lastSentMonth) before sending, so overlapping runs never send twice.
 */
export async function sendMonthlyReports(host: string | null, now = new Date()) {
  if (now.getUTCDate() > SEND_DAYS) return { sent: 0, failed: 0 };
  const month = previousMonth(now);
  const base = appBase(host);

  const people = await db
    .selectDistinct({ id: users.id, name: users.name, email: users.email })
    .from(personalExpenses)
    .innerJoin(users, eq(users.id, personalExpenses.userId))
    .leftJoin(moneyReportPrefs, eq(moneyReportPrefs.userId, users.id))
    .where(and(
      isNotNull(users.passwordHash),
      isNull(users.deletedAt),
      or(isNull(moneyReportPrefs.userId), eq(moneyReportPrefs.enabled, true)),
      or(isNull(moneyReportPrefs.lastSentMonth), ne(moneyReportPrefs.lastSentMonth, month)),
    ))
    .limit(1000);

  let sent = 0, failed = 0;
  for (const u of people) {
    const claimed = await db
      .insert(moneyReportPrefs)
      .values({ userId: u.id, lastSentMonth: month })
      .onConflictDoUpdate({
        target: moneyReportPrefs.userId,
        set: { lastSentMonth: month },
        setWhere: sql`${moneyReportPrefs.enabled} = true and (${moneyReportPrefs.lastSentMonth} is null or ${moneyReportPrefs.lastSentMonth} <> ${month})`,
      })
      .returning({ id: moneyReportPrefs.userId });
    if (!claimed.length) continue;
    try {
      await sendMail(await buildMoneyReport(u, month, base));
      sent++;
    } catch (e) {
      failed++;
      console.error("[money report] email failed for", u.email, e);
    }
  }
  return { sent, failed };
}
