# Bugs: Halves

Found and fixed during the build, 2026-10-26.

| ID | sev | title | steps | expected | actual | fixed in |
| --- | --- | --- | --- | --- | --- | --- |
| B01 | S3 | Group and friend expense list stretched to sidebar height | open a group with few expenses | list sized to its rows | empty bordered area under the list | `items-start` on the grid |
| B02 | S4 | e2e flaky: clicks raced client-side navigation | run suite | stable | intermittent wrong page | tests wait for URL before the next click |
| B03 | S4 | e2e data not repeatable | run suite twice | same result | second run failed (data already settled) | `e2e/global-setup.ts` reseeds each run |

Open S1: 0. Open S2: 0.

## To check

- Recurring copies when the template expense is edited after copies exist (copies are independent by design; confirm with users).
- Removing a member who appears on old expenses shows "Former member" in the group sidebar only if they have a share; check wording.
