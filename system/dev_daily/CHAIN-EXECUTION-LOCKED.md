# Chain, conservation & execution — locked (Round A3)
_2026-05-24. Sources: [`ROUND-A3-CHAIN-EXECUTION.md`](ROUND-A3-CHAIN-EXECUTION.md), Doc 4/6/8, [`CODEC-V2-SCOPE-LOCKED.md`](CODEC-V2-SCOPE-LOCKED.md), [`PRODUCT-SURFACE-LOCKED.md`](PRODUCT-SURFACE-LOCKED.md)._

**Status:** Locked — explanations for unsure items are in the A3 questionnaire § Explained.

---

## Two different “chain” concepts (CE-02)

| Concept | Where it lives | What it means |
|---|---|---|
| **`chain_mode`** | Path C **byte 1** (3 bits) on **invoice/quote** headers | Lifecycle of *this* commercial record: initiating quote, live invoice, closing, disputing, etc. — **fast list/glyph read** |
| **`relationship`** | **`chainRef` block** on any chained record | What *this* record *does* to the prior record: amends, pays, acknowledges, disputes, … — **semantic link** |

They are **not alternatives**. v0.3 uses **both**: `chain_mode` in header; `relationship` (+ optional subtype) on wire in `chainRef`.

---

## Relationship enum (CE-01, CE-02, CE-03)

### v0.3 minimum set (Doc 8 §3.1)

| Code | Relationship | v0.3 |
|---|---|---|
| 0 | `creates` | Yes — root |
| 1 | `amends` | Yes |
| 2 | `acknowledges` | Yes — partial masks (CE-07) |
| 3 | `pays` | Yes |
| 4 | `disputes` | Yes |
| 5 | `reverses` | Yes |
| 6 | `responds` | Yes — + 4-bit subtype when needed |
| 7 | `confirms` | Yes — state commit / ratification |

Domain subtypes (`accepts_quote`, `delivers`, …) via **responds** + subtype nibble (Doc 8 §3.2).

### Wire encoding (CE-02 lock)

- **`relationship`:** 4-bit core + 4-bit optional subtype in `chainRef` extension (Doc 8 proposal) — **uint8** on wire in `1pv/` chain block  
- **`chain_mode`:** separate 3-bit field in invoice/quote byte 1 (Path C) — **not** a substitute for relationship

### Unknown relationship (CE-03 lock)

**Decode as `responds` / informational** — store record, flag UI “unknown link type,” do **not** reject whole frame.

---

## `chain_mode` on invoice/quote (CE-04–06)

All **six** modes in v0.3 (CE-05: do not defer). Fits Path C **3-bit** field:

| Value (3-bit) | Mode | Meaning |
|---|---|---|
| 0 | INITIATING | Starts negotiation / quote chain |
| 1 | LIVE | Active obligation |
| 2 | INFORMATIONAL | Update only — **no new obligation** (CE-06) |
| 3 | CLOSING | Settlement / completion in progress |
| 4 | DISPUTING | Contested |
| 5 | WITNESSING | Third-party observation |
| 6–7 | reserved | Future |

### CE-06 — INFORMATIONAL explained

Use when a chained record **informs** the counterparty but does **not** ask for payment or full action-list confirmation — e.g. Connection relay note, status ping, “sale noted.” Pairs with NOC-10 informational chain and NOC-11 light ack.

**Updates `CODEC-V2-SCOPE-LOCKED.md`:** PC-09 subset replaced by full 3-bit table above.

---

## Action list (CE-07–10)

| ID | Lock |
|---|---|
| CE-07 | **16-bit** `confirmed_mask` + **16-bit** `declined_mask` per ack record (Doc 6 §8.2 — 16 actions enough for v0.3; uint8 action count still allows up to 255 listed) |
| CE-08 | **Dedicated receive screen** — full-screen D-pad list of actions to accept/decline per action (not modal, not zone-only) — see A3 § CE-08 explained |
| CE-09 | Emit action list on share when record has pending actions: **invoice, quote** (when actions attached), **payment**, **need**, **offer**; **connection** uses light ack only |
| CE-10 | Wire: `relationship: acknowledges` + **empty masks** + optional **`FLAGS3` bit: informational_ack** (name TBD in FRAME-SPEC) for Connection light ack |

---

## Conservation UX (CE-11–14)

| ID | Lock |
|---|---|
| CE-11 | **Both** — list badge on flow records with open leg + **chain screen** shows pending conservation state |
| CE-12 | **List filter + panel entry** for open obligations — **not** home strip in v0.3 (per PRODUCT-SURFACE) |
| CE-13 | **Encoder balance check** for flow records in v0.3 — warn/block on encode when conservation declared and legs don’t balance |
| CE-14 | **Scaled integers (Doc 4 §5)** in v0.3 scope — implement with `1pv/` financial blocks; may trail Path C port slightly but not deferred to v0.4 |

---

## Kaios screens & wire gaps (CE-15–17)

| ID | Lock |
|---|---|
| CE-15 | **Extend** `chain.js` / `dispute.js` / amendment flow for v0.3; **glyph chain spine** timeline UI deferred to Phase 6 (see A3 § CE-15 explained) |
| CE-16 | **`_ratifiedFrame` on outbound share** — yes, v0.3 |
| CE-17 | **`changedMask` at share time** — yes, v0.3 (Doc 8 §4.3 gap) |

---

## Phase 0 confirmation order (CE-18)

Confirm by section number before codec port:

1. **Doc 8 §3** — relationship taxonomy  
2. **Doc 6 §4–6, §8.2** — action list + partial ack masks  
3. **Doc 4 §4.2, §5, §6** — obligations, scalars, encoder balance  

---

## Track A gate

With A2 + this file: **G2 satisfied** (co-planning). Coding still requires **SUI-021–024** drafted (done) and standard/FRAME-SPEC text before npm port.

---

## SUI additions (chain-specific)

| SUI | Topic | Status |
|---|---|---|
| SUI-025 | `chain-protocol.md` + `codec.md` | `relationship` enum on `chainRef` in `1pv/` | done |
| SUI-026 | `codec.md` | `changedMask` + `_ratifiedFrame` share behaviour | done |
| SUI-027 | Doc 6 ack record | 16-bit confirmed/declined masks | done |

---

_End._
