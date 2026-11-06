"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { db, receiptScans } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readReceipt, ReceiptError, type ScannedReceipt } from "@/lib/receipt";

const PER_DAY = Number(process.env.RECEIPT_SCANS_PER_DAY || 20);
const MAX_BYTES = 3 * 1024 * 1024;

function sniff(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export type ScanResult = { ok: true; receipt: ScannedReceipt; left: number } | { ok: false; error: string };

export async function scanReceipt(form: FormData): Promise<ScanResult> {
  const me = await requireUser();
  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a receipt photo first" };
  if (file.size > MAX_BYTES) return { ok: false, error: "That photo is too large" };
  const data = Buffer.from(await file.arrayBuffer());
  const type = sniff(data);
  if (!type) return { ok: false, error: "Use a JPEG, PNG or WebP photo" };

  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const [{ n }] = await db.select({ n: count() }).from(receiptScans).where(and(eq(receiptScans.userId, me.id), gt(receiptScans.createdAt, dayAgo)));
  if (n >= PER_DAY) return { ok: false, error: `You've scanned ${PER_DAY} receipts in the last 24 hours. Try again tomorrow, or enter this one by hand.` };

  try {
    const receipt = await readReceipt(data, type);
    await db.insert(receiptScans).values({ userId: me.id, ok: true });
    return { ok: true, receipt, left: PER_DAY - n - 1 };
  } catch (e) {
    await db.insert(receiptScans).values({ userId: me.id, ok: false });
    if (e instanceof ReceiptError) return { ok: false, error: e.message };
    console.error("[receipt] failed", e);
    return { ok: false, error: "Couldn't read the receipt right now. Try again." };
  }
}
