# Components: Halves

All built once in `src/components/ui.tsx`, previewed at `/design`.

Button
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px
  states    default, hover, active, focus-visible (2px ring, accent), disabled, pending
  tokens    bg accent, text on-accent, radius md, font sm/600
  a11y      real <button>, visible focus, pending keeps the label and sets aria-busy
  used on   all

Input / Select / Textarea
  states    default, focus (ring accent), invalid (border danger + message), disabled
  tokens    border border-input, radius sm, bg bg
  a11y      every field has a <label>; errors linked with aria-describedby
  used on   S02, S03, S08, S11, S13, S14, S15

MoneyInput
  parts     currency select + decimal input (inputmode=decimal)
  rule      parsed to integer cents on the server, never floats in the database
  used on   S11, S13

SplitEditor
  modes     equal, exact, percent, shares (tabs, role=tablist)
  shows     per-person value, live total vs amount, remainder in danger colour
  a11y      each row input labelled with the person's name
  used on   S11

BalanceText
  variants  owed (text-owed, "owes you"), owe (text-owe, "you owe"), settled (text-muted)
  rule      colour is never the only signal: the words say the direction
  used on   S04, S07, S10

Avatar
  initials in a circle, colour from a hash of the user id over 6 token tints
  used on   rows everywhere

ExpenseRow / ActivityRow / PersonRow
  layout    date or avatar | title + meta | amount / balance right-aligned
  states    deleted (line-through + "deleted"), payment (icon + "paid")

Card, Flash, Toggle (role=switch), EmptyState
