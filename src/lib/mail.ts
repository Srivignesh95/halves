import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type Mail = { to: string; subject: string; text: string; html: string };

/**
 * Sends one email. Picks the first transport that is configured:
 *   1. RESEND_API_KEY + MAIL_FROM          (Resend HTTP API)
 *   2. SMTP_HOST, SMTP_USER, SMTP_PASS + MAIL_FROM   (any SMTP server, e.g. Hostinger mail)
 *   3. none: in development the email is printed to the server console
 *      (and saved to MAIL_OUTBOX_DIR if set, for tests). In production it is not sent and a warning is logged.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const from = process.env.MAIL_FROM;

  if (process.env.RESEND_API_KEY && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) throw new Error(`Resend refused the email: ${res.status} ${await res.text()}`);
    console.log(`[mail] sent "${mail.subject}" to ${mail.to} via Resend`);
    return;
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && from) {
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    console.log(`[mail] sent "${mail.subject}" to ${mail.to} via SMTP: ${info.response}`);
    return;
  }

  if (process.env.MAIL_OUTBOX_DIR) {
    const dir = path.resolve(process.env.MAIL_OUTBOX_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${Date.now()}-${mail.to}.json`), JSON.stringify(mail, null, 2));
  }
  if (process.env.NODE_ENV === "production" && !process.env.MAIL_OUTBOX_DIR) {
    // never log the body in production: it holds a live reset link
    console.warn(`[mail] no email transport configured; "${mail.subject}" to ${mail.to} was not sent`);
    return;
  }
  console.log(`\n[mail] to: ${mail.to}\n[mail] subject: ${mail.subject}\n${mail.text}\n`);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function resetEmail(name: string, link: string, minutes: number): Omit<Mail, "to"> {
  return {
    subject: "Reset your Halves password",
    text: `Hi ${name},

Someone asked to reset the password for your Halves account. If it was you, open this link to choose a new one:

${link}

The link works once and expires in ${minutes} minutes. If you didn't ask for this, ignore this email and your password stays the same.

Halves`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#16141f">
  <p style="font-size:18px;font-weight:700;margin:0 0 16px">Halves</p>
  <p>Hi ${esc(name)},</p>
  <p>Someone asked to reset the password for your Halves account. If it was you, choose a new one here:</p>
  <p style="margin:24px 0"><a href="${esc(link)}" style="background:#5032c8;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Choose a new password</a></p>
  <p style="font-size:14px;color:#5c5a6e">The link works once and expires in ${minutes} minutes. If you didn't ask for this, ignore this email and your password stays the same.</p>
  <p style="font-size:12px;color:#5c5a6e;word-break:break-all">If the button doesn't work, paste this into your browser:<br>${esc(link)}</p>
</div>`,
  };
}

export function inviteEmail(inviterName: string, signupLink: string, groupName?: string): Omit<Mail, "to"> {
  const what = groupName ? `added you to the group "${groupName}" on Halves` : "added you as a friend on Halves";
  return {
    subject: groupName ? `${inviterName} added you to ${groupName} on Halves` : `${inviterName} added you on Halves`,
    text: `Hi,

${inviterName} ${what}, an app for splitting shared costs and keeping track of who owes what.

Create your free account with this email address to see what you share:

${signupLink}

Anything already added for you will be waiting when you sign up. If you don't know ${inviterName}, you can ignore this email.

Halves`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#16141f">
  <p style="font-size:18px;font-weight:700;margin:0 0 16px">Halves</p>
  <p><strong>${esc(inviterName)}</strong> ${esc(what)}, an app for splitting shared costs and keeping track of who owes what.</p>
  <p>Create your free account with this email address to see what you share. Anything already added for you will be waiting.</p>
  <p style="margin:24px 0"><a href="${esc(signupLink)}" style="background:#5032c8;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Join Halves</a></p>
  <p style="font-size:14px;color:#5c5a6e">If you don't know ${esc(inviterName)}, you can ignore this email.</p>
</div>`,
  };
}
