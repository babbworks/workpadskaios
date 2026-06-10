# Programmable records — near-term note (Doc 2 §6.3)
_2026-05-24. Stakeholder: **near-term candidate**, not far-future only._

---

## What it means

A **programmable record** carries **conditional logic** on the wire or in an attached block, evaluated **on the receiver’s device** — without a server being the authority.

Examples:

| Plain record | Programmable variant |
|--------------|----------------------|
| “Pay £240 when you can” | “**Pay £240 when** delivery step 2 is **confirmed**” |
| Quote valid until date | “Quote **expires** if not accepted by date X” |
| Invoice with action list | “If **decline** on line 3, **void** line 3 amount only” |
| Standing order | “**Repeat** monthly until counterparty sends **stop**” |

The record stays **sovereign**: meaning travels with the bytes; the channel does not run the logic.

---

## How it relates to what we already have

| Building block | Today | Programmable step |
|----------------|-------|-------------------|
| **Action list** (Doc 6) | Human confirms/disconfirms; 16-bit masks | Conditions reference **action indices** |
| **Chain** (Doc 8) | `chainRef`, `relationship`, amend/dispute | Conditions reference **parent record state** |
| **C-TRIG / TRIG** | Presentation + routing bytecode | **Same execution substrate** — conditions are a constrained TRIG namespace |
| **Ack / obligation** | Open leg until payment/ack | “Close when event E” = obligation rule |

Near-term programmable records are likely **not a new record type** but:

1. A **rule block** (optional group / TRIG extension) on an existing type, and  
2. A **small on-device evaluator** (deterministic, no network, bounded steps).

---

## Constraints (non-negotiable)

- **No server execution** — phone decodes and evaluates locally  
- **Bounded** — max rules, max depth, no arbitrary loops (same spirit as `formula.js` / TRIG caps)  
- **Optional** — unsigned/plain records still valid; rules are an extension  
- **Versioned** — rule grammar version in header so old apps ignore unknown rules safely  

---

## Locked slice (v0.4) — see [`PROGRAMMABLE-RECORDS-LOCKED.md`](PROGRAMMABLE-RECORDS-LOCKED.md)

1. **Declarative only** — no user-authored script  
2. **Six primitives on wire:** `when_confirmed`, `when_declined`, `when_paid`, `when_date_before`, `when_date_reached`, `when_ack_received`  
3. **UI:** `_programmablePlain` hints from `WPProgrammableRules.describeAll()`  
4. **Lab:** vectors in `test/programmable-rules.test.js` (expand to `spec-tests/` next)  

Defer: Turing-complete scripting, cross-record oracle, server time authority.

---

## Why near-term fits your direction

- Supports **NFC / in-person ack** (rule: “complete when both masks set”)  
- Supports **short written codes** (rule outcome visible in 10–30 char **outcome** strings later)  
- Aligns with **sync-on-page-visit** (rule **templates** ship in profile packs, not app updates)  

---

_End._
