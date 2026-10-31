## Parity: 93.2 / 100

features 93.2  (32 counted, must-haves 16 of 16 done)

## By area, weakest first
- insights                       0.0  (1 features)
- mobile                         0.0  (1 features)
- money                         50.0  (1 features)
- groups                        85.7  (3 features)
- expenses                      97.1  (15 features)
- auth                         100.0  (3 features)
- friends                      100.0  (1 features)
- balances                     100.0  (4 features)
- settle                       100.0  (1 features)
- activity                     100.0  (1 features)
- data                         100.0  (1 features)

## Missing, in build order
- [should] money: Multiple currencies (balances kept per currency), partial  (12 currencies; balances kept apart per currency; no conversion)
- [could] expenses: Receipt photos, no
- [could] groups: Default split per group, no  (Pro on the original)
- [could] insights: Charts by category and month, no  (Pro on the original)
- [could] mobile: Offline entry, no

## Left out on purpose (not scored)
- Receipt scanning and itemization (OCR): needs a paid OCR provider; revisit after launch
- Currency conversion at live rates: needs your own exchange-rate API key and terms
- Card and bank transaction import: US banking aggregator contract
- Venmo / PayPal / Paytm hand-off: partner deals owned by the original
- Native mobile apps: web first; Expo later per architecture.md
