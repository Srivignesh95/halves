"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { avatars, db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/components/forms";

const MAX_BYTES = 300 * 1024;

/** Only real JPEG, PNG or WebP images, recognised by their first bytes, not by what the browser claims. */
function sniff(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function uploadAvatar(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first" };
  if (file.size > MAX_BYTES) return { error: "That photo is too large. Try another one." };
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniff(data);
  if (!mime) return { error: "Use a JPEG, PNG or WebP photo" };
  await db
    .insert(avatars)
    .values({ userId: me.id, data, mime, updatedAt: new Date() })
    .onConflictDoUpdate({ target: avatars.userId, set: { data, mime, updatedAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: "Photo updated" };
}

export async function removeAvatar(): Promise<ActionState> {
  const me = await requireUser();
  await db.delete(avatars).where(eq(avatars.userId, me.id));
  revalidatePath("/", "layout");
  return { ok: "Photo removed" };
}
