import "server-only";
import { asc, inArray } from "drizzle-orm";
import { db, groups } from "./db";
import { groupsOf, myFriends } from "./data";

/** Groups (with members) and friends the expense form can offer. */
export async function expenseFormOptions(userId: string) {
  const [gs, friends] = await Promise.all([
    db.query.groups.findMany({
      where: inArray(groups.id, groupsOf(userId)),
      orderBy: asc(groups.name),
      columns: { id: true, name: true, defaultCurrency: true },
      with: { members: { columns: {}, with: { user: { columns: { id: true, name: true } } } } },
    }),
    myFriends(userId),
  ]);
  return {
    groups: gs.map((g) => ({
      id: g.id,
      name: g.name,
      currency: g.defaultCurrency,
      members: g.members.map((m) => m.user).sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : a.name.localeCompare(b.name))),
    })),
    friends,
  };
}
