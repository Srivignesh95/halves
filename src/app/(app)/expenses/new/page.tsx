import { requireUser } from "@/lib/auth";
import { expenseFormOptions } from "@/lib/form-options";
import { saveExpense } from "@/app/actions/expenses";
import { ExpenseForm } from "@/components/expense-form";
import { PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/dates";

export const metadata = { title: "Add an expense" };

export default async function NewExpense({ searchParams }: { searchParams: Promise<{ group?: string; friend?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const { groups, friends } = await expenseFormOptions(me.id);
  const group = groups.find((g) => g.id === sp.group) ?? null;
  const friend = friends.find((f) => f.id === sp.friend);
  const people = group ? group.members.map((m) => m.id) : friend ? [me.id, friend.id] : [me.id];
  return (
    <>
      <PageHeader title="Add an expense" sub={group ? `In ${group.name}` : friend ? `With ${friend.name}` : undefined} />
      <div className="max-w-2xl">
        <ExpenseForm
          action={saveExpense}
          me={{ id: me.id, name: me.name }}
          groups={groups}
          friends={friends}
          initial={{
            groupId: group?.id ?? null,
            description: "",
            amount: "",
            currency: group?.currency ?? me.defaultCurrency,
            date: todayISO(),
            category: "general",
            notes: "",
            recurrence: "none",
            splitType: "equal",
            payers: [{ userId: me.id, amount: "" }],
            participants: people.map((id) => ({ userId: id, value: "" })),
          }}
        />
      </div>
    </>
  );
}
