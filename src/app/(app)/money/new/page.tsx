import { requireUser } from "@/lib/auth";
import { expenseFormOptions } from "@/lib/form-options";
import { moneyOptions } from "@/lib/money-data";
import { savePersonalExpense } from "@/app/actions/money";
import { MoneyForm } from "@/components/money-form";
import { PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/dates";

export const metadata = { title: "Add to My Money" };

export default async function NewMoneyExpense() {
  const me = await requireUser();
  const [{ groups, friends }, { payments, customCategories }] = await Promise.all([expenseFormOptions(me.id), moneyOptions(me.id)]);
  return (
    <>
      <PageHeader title="Add expense" sub="Scan a receipt or enter it by hand." />
      <div className="max-w-2xl">
        <MoneyForm
          action={savePersonalExpense}
          me={{ id: me.id, name: me.name }}
          groups={groups}
          friends={friends}
          payments={payments}
          customCategories={customCategories}
          initial={{ description: "", amount: "", currency: me.defaultCurrency, date: todayISO(), category: "other", notes: "", paymentId: "", items: [] }}
        />
      </div>
    </>
  );
}
