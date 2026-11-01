import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db, users } from "./db";
import { inviteEmail, sendMail } from "./mail";

const ONE_DAY = 24 * 3600_000;

type Invitee = { id: string; email: string; passwordHash: string | null; deletedAt: Date | null };

/**
 * Emails an invite to every person in the list who has not signed up yet.
 * Each address gets at most one invite a day, however many people add them.
 * Returns how many invites were queued. Emails go out after the response is sent.
 */
export async function sendInvites(inviterName: string, invitees: Invitee[], groupName?: string): Promise<number> {
  const h = await headers();
  const base = (process.env.APP_URL || `https://${h.get("host")}`).replace(/\/$/, "");
  const cutoff = new Date(Date.now() - ONE_DAY);
  let queued = 0;
  for (const u of invitees) {
    if (u.passwordHash || u.deletedAt) continue; // already uses the app
    // claim the slot first, so two people adding the same email at once send one invite
    const claimed = await db
      .update(users)
      .set({ invitedAt: new Date() })
      .where(and(eq(users.id, u.id), isNull(users.passwordHash), or(isNull(users.invitedAt), lt(users.invitedAt, cutoff))))
      .returning({ id: users.id });
    if (claimed.length === 0) continue;
    const link = `${base}/signup?email=${encodeURIComponent(u.email)}`;
    const mail = { to: u.email, ...inviteEmail(inviterName, link, groupName) };
    after(async () => {
      try {
        await sendMail(mail);
      } catch (e) {
        console.error("[invite] email failed", e);
      }
    });
    queued++;
  }
  return queued;
}
