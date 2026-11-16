import "server-only";
import type { Mail } from "./mail";
import type { CurrencyReport } from "./money-report";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (c: number, cur: string) => {
  try { return new Intl.NumberFormat("en-CA", { style: "currency", currency: cur, currencyDisplay: "narrowSymbol" }).format(c / 100); } catch { return `${(c / 100).toFixed(2)} ${cur}`; }
};
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "");
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export type ReportMailInput = {
  name: string;
  monthLabel: string;
  report: CurrencyReport[];
  catName: (k: string) => string;
  payName: (id: string) => string;
  link: string;
  settingsLink: string;
};

/** The end-of-month spending email. One section per currency; amounts are never mixed. */
export function moneyReportEmail(r: ReportMailInput): Omit<Mail, "to"> {
  const headline = r.report.map((c) => money(c.totalCents, c.currency)).join(" + ") || money(0, "CAD");
  const text: string[] = [`Hi ${r.name},`, "", `Here's what you spent in ${r.monthLabel}: ${headline}.`];
  const html: string[] = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#16141f">`,
    `<p style="font-size:18px;font-weight:700;margin:0 0 16px">Halves · My Money</p>`,
    `<p>Hi ${esc(r.name)}, here's your spending for <strong>${esc(r.monthLabel)}</strong>.</p>`,
  ];
  if (r.report.length === 0) {
    text.push("", "Nothing was recorded this month.");
    html.push(`<p style="color:#5c5a6e">Nothing was recorded this month.</p>`);
  }
  const row = (a: string, b: string, c = "") =>
    `<tr><td style="padding:5px 0">${esc(a)}</td><td style="padding:5px 0;text-align:right;color:#5c5a6e;font-size:13px">${esc(c)}</td><td style="padding:5px 0 5px 12px;text-align:right;font-weight:700;white-space:nowrap">${esc(b)}</td></tr>`;
  const head = (t: string) => `<p style="font-size:12px;color:#5c5a6e;margin:22px 0 4px;text-transform:uppercase;letter-spacing:.06em">${esc(t)}</p>`;
  const table = (rows: string) => `<table style="width:100%;font-size:15px;border-collapse:collapse">${rows}</table>`;

  for (const c of r.report) {
    const m = (v: number) => money(v, c.currency);
    text.push("", `== ${c.currency}: ${m(c.totalCents)} ==`);
    html.push(`<div style="border-top:1px solid #e4e3ec;margin-top:20px;padding-top:12px">`);
    html.push(`<p style="font-size:13px;color:#5c5a6e;margin:0">Spent in ${c.currency}</p><p style="font-size:30px;font-weight:800;margin:0">${esc(m(c.totalCents))}</p>`);
    if (c.topCard) {
      const card = r.payName(c.topCard.id);
      const detail = `${m(c.topCard.cents)} over ${plural(c.topCard.count, "payment")}`;
      text.push(`Most used card: ${card}, ${detail}`);
      html.push(`<p style="margin:12px 0 0;padding:10px 12px;background:#f1eefc;border-radius:10px"><strong>Most used card:</strong> ${esc(card)}<br><span style="color:#5c5a6e;font-size:13px">${esc(detail)}</span></p>`);
    }
    text.push("", "By category:", ...c.byCategory.map(([k, v]) => `  ${r.catName(k)}: ${m(v)} (${pct(v, c.totalCents)})`));
    html.push(head("By category"), table(c.byCategory.map(([k, v]) => row(r.catName(k), m(v), pct(v, c.totalCents))).join("")));
    if (c.byPayment.length) {
      text.push("", "By payment method (full amounts charged):", ...c.byPayment.map((p) => `  ${r.payName(p.id)}: ${m(p.cents)} (${p.count}x)`));
      html.push(head("By payment method (full amounts charged)"), table(c.byPayment.map((p) => row(r.payName(p.id), m(p.cents), `${p.count}×`)).join("")));
    }
    const extras: string[] = [];
    if (c.emiCount) extras.push(`EMIs: ${m(c.emiCents)} (${plural(c.emiCount, "payment")})`);
    if (c.halvesShareCents) extras.push(`Your share of expenses split on Halves: ${m(c.halvesShareCents)}`);
    if (extras.length) {
      text.push("", ...extras);
      html.push(`<p style="font-size:14px;color:#5c5a6e;margin:14px 0 0">${extras.map(esc).join("<br>")}</p>`);
    }
    html.push(`</div>`);
  }
  text.push("", `See the details: ${r.link}`, `Turn this email off: ${r.settingsLink}`);
  html.push(
    `<p style="margin:28px 0"><a href="${esc(r.link)}" style="background:#5032c8;color:#ffffff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">Open My Money</a></p>`,
    `<p style="font-size:12px;color:#5c5a6e">Spending counts only your share of split expenses. You get this at the start of each month. <a href="${esc(r.settingsLink)}" style="color:#5c5a6e">Turn it off</a>.</p>`,
    `</div>`,
  );
  return { subject: `Your ${r.monthLabel} spending: ${headline}`, text: text.join("\n"), html: html.join("\n") };
}
