# IO decisions — locked (2026-05-21)

Product choices from stakeholder reply. Implementation tracks `UI-ROADMAP-STATUS.md` §H.

## Financial framing

| Topic | Decision |
|-------|----------|
| **COGS** | **Keep** for left panel, finance overview, view summaries — not removed |
| **Activity framing** | Prefer **Job Inputs** or **Work Inputs** (Settings toggles label); mentality for assessing jobs |
| **Balance UI (C6)** | **Defer** — no soft balance hint in this pass |

## Inputs & records

| Topic | Decision |
|-------|----------|
| **Inputs** | Treat as **needs** or **Sourced / Unsourced Inputs**; labour individuated per headcount + role when listed |
| **C7 scope** | **Full** — Need, Offer, Connection as `record_type` values with create + view |
| **Connection** | Bridge / relay only; viewer **cannot** make Offer; can point toward someone |
| **Pure connection** | Standalone gatekeeper record; same machinery as referrals; ack + type (e.g. sale confirmed) |
| **Offer** | Resource binding — distinct from Connection relay |

## Social & relations

| Topic | Decision |
|-------|----------|
| **Social ledger (C9–C10)** | Scaffold `social-ledger.js`; integrate almost invisibly; more product questioning later |
| **Rel-volume (C11)** | Own tuning engine (`rel-volume.js`) with generous dials; **Connections** screen uses scored bands |
| **Contacts UI (C13/C16)** | **Connections** screen — not plain A–Z; panel Contacts opens Connections |
| **C12 progressive** | **End** — “dance with data”; wizard tiers sufficient for now |

## Engineering priorities (same message)

| Item | Status |
|------|--------|
| R7.1 FilterSheet | Done (default on) |
| R7.6 Legacy pickers | Redirect to FilterSheet when flag on |
| R7.2 Finance aggregate | `finance-aggregate.js` shared module |
| R3.7 Invoice-child strip | `invoice-lifecycle.js` on quote/invoice view |
| R3.8 Liabilities link | List branch + wizard Financial tab link rows |

## Deferred explicitly

- Balance hint UI (C6)
- Full social ledger obligations UI
- C12 io-create progressive parity
- `relations_home` lens flag implementation
