import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { moneyReportEmail } from "@/lib/money-mail";
import { buildReport } from "@/lib/money-report";

const report = buildReport(
  [
    { amountCents: 12000, myShareCents: 7200, currency: "CAD", category: "groceries", items: [{ amountCents: 9000, category: "groceries" }, { amountCents: 3000, category: "shopping" }], paymentMethodId: "visa", isEmi: false, splitOnHalves: true },
    { amountCents: 4500, myShareCents: 4500, currency: "CAD", category: "dining", paymentMethodId: "amex", isEmi: false, splitOnHalves: false },
    { amountCents: 250000, myShareCents: 250000, currency: "INR", category: "emi", paymentMethodId: "visa", isEmi: true, splitOnHalves: false },
  ],
  [{ owedCents: 80000, paidCents: 0, currency: "CAD", category: "rent" }],
  new Set(["visa", "amex"]),
);
const names: Record<string, string> = { visa: "Visa ••4242", amex: "Amex <Cobalt>" };
const mail = moneyReportEmail({
  name: "Ana",
  monthLabel: "November 2026",
  report,
  catName: (k) => k[0].toUpperCase() + k.slice(1),
  payName: (id) => names[id] ?? "Not recorded",
  link: "https://halves.example/money?month=2026-11",
  settingsLink: "https://halves.example/money/settings",
});

describe("moneyReportEmail", () => {
  it("puts every currency total in the subject, never mixed", () => {
    expect(mail.subject).toBe("Your November 2026 spending: $917.00 + ₹2,500.00");
  });
  it("names the most used card per currency", () => {
    expect(mail.text).toContain("Most used card: Visa ••4242, $120.00 over 1 payment");
    expect(mail.text).toContain("Most used card: Visa ••4242, ₹2,500.00 over 1 payment");
  });
  it("lists EMIs and the Halves share", () => {
    expect(mail.text).toContain("EMIs: ₹2,500.00 (1 payment)");
    expect(mail.text).toContain("Your share of expenses split on Halves: $872.00");
  });
  it("escapes names in the HTML", () => {
    expect(mail.html).toContain("Amex &lt;Cobalt&gt;");
    expect(mail.html).not.toContain("<Cobalt>");
  });
  it("says so when nothing was recorded", () => {
    const empty = moneyReportEmail({ name: "Ana", monthLabel: "May 2026", report: [], catName: String, payName: String, link: "l", settingsLink: "s" });
    expect(empty.text).toContain("Nothing was recorded this month.");
  });
  if (process.env.MAIL_PREVIEW) writeFileSync(process.env.MAIL_PREVIEW, mail.html);
});
