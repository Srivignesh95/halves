import "server-only";
import { monthData } from "./money-data";
import { monthLabel } from "./money-report";
import { moneyReportEmail } from "./money-mail";

/** The monthly report email for one person and month (YYYY-MM). */
export async function buildMoneyReport(user: { id: string; name: string; email: string }, month: string, base: string) {
  const { report, catName, payName } = await monthData(user.id, month);
  return {
    to: user.email,
    ...moneyReportEmail({
      name: user.name,
      monthLabel: monthLabel(month),
      report,
      catName,
      payName,
      link: `${base}/money?month=${month}`,
      settingsLink: `${base}/money/settings`,
    }),
  };
}
