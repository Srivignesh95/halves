export const CATEGORIES = [
  ["general", "General"],
  ["food", "Food and drink"],
  ["groceries", "Groceries"],
  ["rent", "Rent"],
  ["utilities", "Utilities"],
  ["transport", "Transport"],
  ["travel", "Travel"],
  ["entertainment", "Entertainment"],
  ["household", "Household"],
  ["gifts", "Gifts"],
  ["other", "Other"],
] as const;

export const GROUP_TYPES = [
  ["home", "Home"],
  ["trip", "Trip"],
  ["couple", "Couple"],
  ["other", "Other"],
] as const;

export const RECURRENCES = [
  ["none", "Does not repeat"],
  ["weekly", "Every week"],
  ["fortnightly", "Every 2 weeks"],
  ["monthly", "Every month"],
  ["yearly", "Every year"],
] as const;

export const categoryLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? "General";
