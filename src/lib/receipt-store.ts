import "server-only";
import { del, get, put } from "@vercel/blob";
import { eq, inArray } from "drizzle-orm";
import { db, expenseReceipts, expenses } from "./db";

export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export function sniffImage(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Save (or replace) the photo for an expense. */
export async function saveReceiptImage(expenseId: string, data: Buffer, userId: string) {
  const mime = sniffImage(data);
  if (!mime) throw new Error("Use a JPEG, PNG or WebP photo");
  if (data.length > MAX_RECEIPT_BYTES) throw new Error("That photo is too large");
  if (!useBlob() && process.env.VERCEL) throw new Error("Receipt photos aren't set up yet (connect a Vercel Blob store).");

  const [old] = await db.select().from(expenseReceipts).where(eq(expenseReceipts.expenseId, expenseId)).limit(1);
  let blobUrl: string | null = null;
  if (useBlob()) {
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const res = await put(`receipts/${expenseId}.${ext}`, data, { access: "private", contentType: mime, addRandomSuffix: true });
    blobUrl = res.url;
  }
  const row = { blobUrl, data: blobUrl ? null : data, mime, size: data.length, uploadedBy: userId, createdAt: new Date() };
  await db.insert(expenseReceipts).values({ expenseId, ...row }).onConflictDoUpdate({ target: expenseReceipts.expenseId, set: row });
  if (old?.blobUrl) await del(old.blobUrl).catch((e) => console.error("[receipt] couldn't delete old blob", e));
}

export async function removeReceiptImage(expenseId: string) {
  const [old] = await db.delete(expenseReceipts).where(eq(expenseReceipts.expenseId, expenseId)).returning();
  if (old?.blobUrl) await del(old.blobUrl).catch((e) => console.error("[receipt] couldn't delete blob", e));
}

/** Before a group (and its expenses) is deleted: remove their photos from Blob storage. */
export async function removeReceiptsForGroup(groupId: string) {
  const rows = await db
    .select({ url: expenseReceipts.blobUrl })
    .from(expenseReceipts)
    .where(inArray(expenseReceipts.expenseId, db.select({ id: expenses.id }).from(expenses).where(eq(expenses.groupId, groupId))));
  const urls = rows.map((r) => r.url).filter((u): u is string => !!u);
  if (urls.length) await del(urls).catch((e) => console.error("[receipt] couldn't delete group blobs", e));
}

/** The photo's bytes as a stream, wherever it's stored. */
export async function openReceiptImage(expenseId: string): Promise<{ body: ReadableStream<Uint8Array> | Uint8Array; mime: string; size: number } | null> {
  const [r] = await db.select().from(expenseReceipts).where(eq(expenseReceipts.expenseId, expenseId)).limit(1);
  if (!r) return null;
  if (r.blobUrl) {
    const res = await get(r.blobUrl, { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    return { body: res.stream, mime: r.mime, size: r.size };
  }
  return r.data ? { body: new Uint8Array(r.data), mime: r.mime, size: r.size } : null;
}
