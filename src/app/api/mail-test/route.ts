import { timingSafeEqual } from "node:crypto";
import { sendMail } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * Admin check for email settings on the live server.
 * GET /api/mail-test?to=you@example.com&key=CRON_SECRET
 * Sends one test email and returns what happened. Never returns the password.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET ?? "";
  const key = url.searchParams.get("key") ?? "";
  if (!secret || key.length !== secret.length || !timingSafeEqual(Buffer.from(key), Buffer.from(secret))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const to = url.searchParams.get("to") ?? "";
  const settings = {
    MAIL_FROM: process.env.MAIL_FROM ?? "(missing)",
    SMTP_HOST: process.env.SMTP_HOST ?? "(missing)",
    SMTP_PORT: process.env.SMTP_PORT ?? "(missing, using 465)",
    SMTP_USER: process.env.SMTP_USER ?? "(missing)",
    SMTP_PASS: process.env.SMTP_PASS ? `(set, ${process.env.SMTP_PASS.length} characters)` : "(missing)",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "(set)" : "(not set)",
    APP_URL: process.env.APP_URL ?? "(missing)",
  };
  if (!/^[^@\s]+@[^@\s]+$/.test(to)) return Response.json({ ok: false, error: "add ?to=your@email", settings });
  const transport = process.env.RESEND_API_KEY && process.env.MAIL_FROM ? "resend"
    : process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM ? "smtp" : "none";
  if (transport === "none") return Response.json({ ok: false, error: "No email transport configured on this deployment. Add the settings and redeploy.", settings });
  try {
    await sendMail({ to, subject: "Halves test email", text: "If you can read this, email from the live Halves site works.", html: "<p>If you can read this, email from the live Halves site works.</p>" });
    return Response.json({ ok: true, transport, sentTo: to, settings, next: "Check the inbox and the Spam folder." });
  } catch (e) {
    const err = e as { message?: string; code?: string; response?: string; errors?: { message: string }[] };
    return Response.json({ ok: false, transport, error: err.message || err.errors?.map((x) => x.message).join("; ") || String(e), code: err.code, serverResponse: err.response, settings }, { status: 500 });
  }
}
