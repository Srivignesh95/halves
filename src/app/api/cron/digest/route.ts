import { timingSafeEqual } from "node:crypto";
import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { appBase, buildDigest } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** Weekly: emails everyone with open balances a summary. Each person at most once every 6 days. */
export async function GET(req: Request) {
  if (!authorised(req)) return new Response("Unauthorized", { status: 401 });
  const base = appBase(new URL(req.url).host);
  const cutoff = new Date(Date.now() - 6 * 24 * 3600_000);
  const due = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(isNotNull(users.passwordHash), isNull(users.deletedAt), eq(users.emailDigest, true), or(isNull(users.lastDigestAt), lt(users.lastDigestAt, cutoff))))
    .limit(1000);
  let sent = 0, settled = 0, failed = 0;
  for (const u of due) {
    // claim first, so an overlapping run can't email the same person twice
    const claimed = await db
      .update(users)
      .set({ lastDigestAt: new Date() })
      .where(and(eq(users.id, u.id), or(isNull(users.lastDigestAt), lt(users.lastDigestAt, cutoff))))
      .returning({ id: users.id });
    if (!claimed.length) continue;
    const mail = await buildDigest(u, base);
    if (!mail) { settled++; continue; }
    try {
      await sendMail(mail);
      sent++;
    } catch (e) {
      failed++;
      console.error("[digest] email failed for", u.email, e);
    }
  }
  return Response.json({ checked: due.length, sent, settled, failed });
}
