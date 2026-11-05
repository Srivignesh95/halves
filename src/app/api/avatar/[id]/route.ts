import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { avatars, db, users } from "@/lib/db";
import { UUID_RE } from "@/lib/access";

export const dynamic = "force-dynamic";

const PALETTE = [
  ["#ece8fb", "#5032c8", "#2a2440", "#b9abff"],
  ["#e3f3ea", "#1d7044", "#1c2e26", "#7fe0ab"],
  ["#fbe6e7", "#b4232c", "#3a2023", "#ffadb1"],
  ["#ecebf1", "#16141f", "#2a2838", "#e6e3f2"],
  ["#e8f0fb", "#24518f", "#1f2838", "#9cc2ff"],
  ["#fbf0e3", "#8a4b0f", "#3a2c1d", "#ffcf99"],
];

function initialsSvg(id: string, name: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg, bgDark, fgDark] = PALETTE[h % PALETTE.length];
  const initials = (name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?").replace(/[<>&"']/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>.b{fill:${bg}}.t{fill:${fg}}@media (prefers-color-scheme:dark){.b{fill:${bgDark}}.t{fill:${fgDark}}}</style><circle class="b" cx="32" cy="32" r="32"/><text class="t" x="32" y="32" dy=".35em" text-anchor="middle" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="24" font-weight="700">${initials}</text></svg>`;
}

/** A person's profile photo, or their initials as an SVG when they haven't uploaded one. Logged-in users only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response(null, { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  const cache = versioned ? "private, max-age=31536000, immutable" : "private, max-age=300";
  const security = { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff" };

  const [photo] = await db.select({ data: avatars.data, mime: avatars.mime }).from(avatars).where(eq(avatars.userId, id)).limit(1);
  if (photo) return new Response(new Uint8Array(photo.data), { headers: { "Content-Type": photo.mime, "Cache-Control": cache, ...security } });

  const [u] = await db.select({ name: users.name, deletedAt: users.deletedAt }).from(users).where(eq(users.id, id)).limit(1);
  if (!u) return new Response(null, { status: 404 });
  return new Response(initialsSvg(id, u.deletedAt ? "?" : u.name), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=300", ...security } });
}
