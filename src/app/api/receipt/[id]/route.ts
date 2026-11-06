import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db, expenses } from "@/lib/db";
import { canSeeExpense, UUID_RE } from "@/lib/access";
import { openReceiptImage } from "@/lib/receipt-store";

export const dynamic = "force-dynamic";

/** The receipt photo for an expense. Only people who can see the expense can see its photo. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response(null, { status: 404 });
  const e = await db.query.expenses.findFirst({ where: eq(expenses.id, id), columns: { groupId: true }, with: { shares: { columns: { userId: true } } } });
  if (!e || !(await canSeeExpense(e, me.id))) return new Response(null, { status: 404 });
  const img = await openReceiptImage(id);
  if (!img) return new Response(null, { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(img.body as BodyInit, {
    headers: {
      "Content-Type": img.mime,
      "Content-Length": String(img.size),
      "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "private, max-age=60",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
