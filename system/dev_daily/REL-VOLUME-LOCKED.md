# Rel-volume (C11) — locked
_2026-05-24. Rhythm scoring for Connections + list filter — not social obligations (C9)._

**Module:** `js/lib/rel-volume.js` · Settings UI: `rel-volume-settings.js`

---

## What it measures

**Rhythm** = weighted activity with a contact in the lookback window (`windowDays`). Recent events count more (`decayPerDay`).

| Record type | Default weight |
|-------------|----------------|
| Sale | 2.0 |
| Receipt | 1.5 |
| Invoice / Payment | 1.0 |
| Connection relay | 1.0 |
| Offer | 0.75 |
| Need | 0.5 |
| Job / expense | 0.35 / 0.5 |

**Bands** (tunable thresholds):

| Band | Default score |
|------|----------------|
| In rhythm | ≥ 4 |
| Warming | ≥ 2 |
| Quiet | ≥ minInteractions |
| Directory | below min |

---

## Where it appears

| Surface | Use |
|---------|-----|
| **Connections** | Contacts sorted into bands; key **5** = per-contact rhythm explain |
| **Manage → Rhythm tuning** | Simple + advanced dials, presets, live preview |
| **List** | Filter **Rhythm network only** + **Net** badge toggles filter |

---

## Presets

- **Market stall** — short window, sale-heavy  
- **Field jobs** — longer window, job/invoice weights  
- **Quiet network** — higher bar for “in rhythm”

---

## Not in scope

- Money owed / ack state → **Social trail** (`social-ledger.js`)  
- B→C obligation redirect (C10)

---

_End._
