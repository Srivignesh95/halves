// Checks your email settings from .env by logging in to the mail server and sending one test email.
// Usage: node scripts/test-mail.mjs you@example.com
import nodemailer from "nodemailer";

try {
  process.loadEnvFile(".env");
} catch (e) {
  console.warn(`Could not read .env (${e.code ?? e.message}). Run this from the halves folder, on Node 20.12 or newer.`);
}
const to = process.argv[2];
if (!to) { console.error("Usage: node scripts/test-mail.mjs you@example.com"); process.exit(1); }

const need = ["MAIL_FROM", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
const missing = need.filter((k) => !process.env[k]);
console.log(`SMTP_HOST=${process.env.SMTP_HOST ?? "(missing)"}  SMTP_PORT=${process.env.SMTP_PORT ?? "465 (default)"}  SMTP_USER=${process.env.SMTP_USER ?? "(missing)"}  MAIL_FROM=${process.env.MAIL_FROM ?? "(missing)"}  SMTP_PASS=${process.env.SMTP_PASS ? "(set)" : "(missing)"}`);
if (missing.length) { console.error(`FAILED: missing in .env: ${missing.join(", ")}`); process.exit(1); }

const port = Number(process.env.SMTP_PORT || 465);
const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
try {
  await t.verify();
  console.log("Login to the mail server: OK");
  const info = await t.sendMail({ from: process.env.MAIL_FROM, to, subject: "Halves test email", text: "If you can read this, email from Halves works." });
  console.log("Sent:", info.response);
} catch (e) {
  const inner = e.errors?.map((x) => x.message).join("; ");
  console.error("FAILED:", e.message || inner || String(e), e.code ? `(code ${e.code})` : "", e.response ?? "");
  process.exit(1);
}
