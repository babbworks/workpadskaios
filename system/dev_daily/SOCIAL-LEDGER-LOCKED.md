# Social ledger (C9) — locked
_2026-05-24. Local referral/relay trail — no wire bytes; C10 obligation redirect still deferred._

**Module:** `js/lib/social-ledger.js` (`localStorage` key `wp_social_ledger`, max 500 entries).

---

## Event kinds

| Kind | When logged |
|------|-------------|
| `relay_created` | IO connection created |
| `relay_received` | Connection decoded from share URL |
| `relay_confirmed` | View → Confirm relay |
| `relay_noted_local` | Gatekeeper → Relay noted (local) |
| `light_ack_sent` | Gatekeeper → Light ack created |
| `sale_confirmed` | Sale tally / `markSaleConfirmed` |

Pending = `ackRequired && !confirmed` (badge on Connections + trail rows).

---

## UI surfaces

| Surface | Behaviour |
|---------|-----------|
| **View** | Social trail section on need/offer/connection + contact |
| **Connections** | Last event / pending ack badge; key **8** = full trail for contact |

---

## Deferred (C10)

- B→C obligation redirect
- Dedicated social obligations screen
- Equivalence engine across long timelines

---

_End._
