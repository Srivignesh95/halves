import { addFriend } from "@/app/actions/friends";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Add a friend" };

export default function NewFriend() {
  return (
    <>
      <PageHeader title="Add a friend" sub="Split things one-on-one, outside any group." />
      <ActionForm action={addFriend} className="max-w-md space-y-4">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" maxLength={60} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="field" />
        </div>
        <SubmitButton>Add friend</SubmitButton>
      </ActionForm>
    </>
  );
}
