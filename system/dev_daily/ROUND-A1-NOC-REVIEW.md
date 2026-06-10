# Round A1 — Need / Offer / Connection review (before implementation)
_Status: **locked** — NOC-09–11 confirmed; hybrid summary below._  
_Existing code is **baseline to evaluate**, not proof of final design._

---

## Why this review exists

| Source | Says |
|---|---|
| `IO-DECISIONS-LOCKED.md` (2026-05-21) | C7 **full** — Need, Offer, Connection as `record_type` with create + view |
| `UI-ROADMAP-STATUS.md` | C7–C8 **Done** — type picker + `io-record.js` |
| Round 0 lock | **Review approach + questions before** expanding wire, wizard, or glyph mapping |
| `io-create.js` (R3) | **Outcome-only** path — “the need stated” without extra “what is needed?” step |
| Doc 4 / Doc 6 | Bilateral conservation, action lists, three faces — may imply different shapes than three standalone types |

**Tension to resolve:** Three record types + Outcome create + Connections **screen** (rel-volume) + Connection **relay** semantics may be overlapping surfaces.

---

## Current implementation snapshot

| Surface | Behaviour |
|---|---|
| `io-create` | Outcome text → optional contact → draft/share; `record_type` from caller context (not always `need`) |
| `io-record` | Separate 3-step wizards for `need` / `offer` / `connection` |
| `list.js` | Type picker entries; filter treats NOC as first-class types |
| `connections.js` | Rel-volume grouped **network** screen — not the same as `connection` record type |
| Wire | Uses existing pads fields (`job`, `input_source`, `labour_*`, `relay_*`) — **not** Path C type-at-byte-0 yet |

---

## Approach options (pick or hybrid per question)

### Model A — Three wire record types (IO-DECISIONS literal)

- `need`, `offer`, `connection` in codec type enum / Path C shortcut table
- Distinct create flows and views
- **Pros:** Clear list filters, explicit relay vs resource binding  
- **Cons:** Proliferates types; may fight Outcome-only philosophy; Path C type nibble space (15 types)

### Model B — Outcome + role flags on `work_record` (or generic)

- Single create path (`io-create`); role = need | offer | relay via flags or DOMAIN bits
- List lenses filter by role, not by `record_type`
- **Pros:** Aligns R3; fewer codec types  
- **Cons:** Harder share semantics; Connection vs Contact blur

### Model C — UI types, wire-normalised later

- Keep KaiOS `record_type` strings in storage; map to canonical type on share encode
- **Pros:** Ship flexibility  
- **Cons:** DEVIATIONS risk; two truths until lock

### Model D — Connection is not a record

- Connection = **relationship** + rel-volume UI only; relay = note or message with chain ref
- Offers/needs remain records
- **Pros:** Matches “Connections screen not A–Z”  
- **Cons:** IO-DECISIONS “pure connection standalone” rejected unless amended

---

## Questionnaire

### 1. Ontology

| ID     | Question                                                                                                    | **Answer**      |
| ------ | ----------------------------------------------------------------------------------------------------------- | --------------- |
| NOC-01 | Which model (A/B/C/D) or hybrid is target for v0.3?                                                         | hybrid          |
| NOC-02 | Is **Outcome-only create** the default entry for “I need work done”, with `need` type only for power users? | yes             |
| NOC-03 | Should **Offer** ever be created from the Connections screen, or only from list/create menu?                | from few places |
| NOC-04 | Is **Connection** (relay) the same as a **referral** record, or strictly separate machinery?                | separate        |

### 2. Semantics (IO-DECISIONS fidelity)

| ID     | Question                                                                                                    | IO lock text                   | **Answer**                 |
| ------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------- |
| NOC-05 | Connection: viewer **cannot** make Offer — enforce in UI only or also in share validation?                  | IO-DECISIONS                   | sure viewer can make offer |
| NOC-06 | “Pure connection” standalone gatekeeper — ack + type (e.g. sale confirmed): required for v0.3 or scaffold?  | IO-DECISIONS                   | scaffold                   |
| NOC-07 | Offer = resource binding — which fields are normative on wire (`job` only vs inventory link)?               | IO-DECISIONS                   | see § NOC-07 walkthrough — `job` required; inventory defer |
| NOC-08 | Need = Sourced/Unsourced Inputs + labour headcount/role — keep wizard fields or collapse to Outcome + tags? | IO-DECISIONS + io-record today | keep wizard fields         |

### 3. Conservation and chains

| ID     | Question                                                                                                        | **Answer** |
| ------ | --------------------------------------------------------------------------------------------------------------- | ---------- |
| NOC-09 | Do need/offer/connection participate in **bilateral conservation** checks, or are they observation/flow-exempt? | observation / flow-exempt until flow attached *(proposed)* |
| NOC-10 | Can a **Connection** record open a chain (referral → sale confirmed), or only annotate?                         | informational chain ok; full gatekeeper scaffold *(proposed)* |
| NOC-11 | Action list on receive — which NOC types trigger Doc 6 confirmation UI?                                         | need + offer yes; connection light ack *(proposed)* |

### 4. UI integration

| ID     | Question                                                                                      | **Answer**                                       |
| ------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| NOC-12 | Rename/hide list type picker entries until model locked?                                      | no                                               |
| NOC-13 | Should existing `io-record` wizards be **frozen**, **refactored**, or **removed** after lock? | nothing is desployed we don't need to over do it |
| NOC-14 | Connections screen (rel-volume) — show Needs/Offers from network, or only contacts/scores?    | contacts/scores; drill to filtered list *(see § explained)* |
| NOC-15 | C12 progressive io-create parity — still **end-deferred** (IO-DECISIONS)?                     | ok                                               |

### 5. Glyph and cards

| ID     | Question                                                                                         | **Answer**                                |
| ------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| NOC-16 | Distinct glyph registry entries per NOC type, or one “exchange intent” glyph + flags?            | neesd to be done well, good unique glyphs |
| NOC-17 | I/O bilateral layout for need (empty OUT) vs offer (empty IN) — required at create or view only? | **view + share preview**; create stays Outcome/wizard text |
| NOC-18 | Card colour / zone rules in Card & Screen Types doc — apply to NOC before Phase 6?               | sure                                      |

### 6. Wire and Path C

| ID     | Question                                                                                           | **Answer**                           |
| ------ | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| NOC-19 | If Model A: add need/offer/connection to Path C **mandatory group table** and shortcut nibble map? | yes needed added let's work this out |
| NOC-20 | If Model B: which existing type absorbs them (work_record, note, generic)?                         | n/a — hybrid keeps explicit types on new tag |
| NOC-21 | Block any **new** NOC fields on `#1pa/` until A2 scheme tag decided?                               | ok                                   |

### 7. Social ledger (adjacent)

| ID     | Question                                                                                | **Answer**       |
| ------ | --------------------------------------------------------------------------------------- | ---------------- |
| NOC-22 | `social-ledger.js` scaffold — does it subsume Connection obligations, or stay separate? | separate i think |
| NOC-23 | Rel-volume (C11) — score **Connections** only, or also weight Need/Offer frequency?     | contacts first; optional NOC boost later |

---

## Hybrid model — locked summary (from NOC-01)

**Target for v0.3:** hybrid of **A (wire types)** + **B (Outcome-first UX)**.

| Layer | Rule |
|---|---|
| **Default create** | `io-create` = Outcome-only (“need stated”) → persists as **`need`** with `job` = outcome text; no labour wizard unless user opens full flow |
| **Power / explicit** | List type picker + `io-record` wizards for `need` / `offer` / `connection` with full fields (NOC-08) |
| **Wire (new tag only)** | `need`, `offer`, `connection` get Path C `record_type` byte + mandatory-group rows (NOC-19) — **not** on `#1pa/` until A2 locks tag |
| **Connection vs referral** | **Separate machinery** (NOC-04); relay semantics; referral may chain-link but is not the same record shape |
| **Connection vs Connections screen** | Screen = rel-volume **network** (contacts + scores); `connection` **record** = bridge/relay artifact — see § NOC-14 explained |
| **IO supersession** | NOC-05: viewer **may** create Offer from connection context — supersedes IO-DECISIONS “cannot make Offer” |
| **Deploy posture** | NOC-13: nothing deployed at scale — refactor lightly; don’t over-invest in interim wizards |

---

## NOC-07 — Offer fields walkthrough (v0.3 normative minimum)

**Purpose:** Offer = resource you can provide (binding intent), distinct from Connection relay.

| Field / group | v0.3 | Notes |
|---|---|---|
| `job` (or outcome text) | **Required** | What is offered — plain language |
| Counterparty / `contact_ref` | Optional | Who it is offered to, if known |
| Tags / DOMAIN bits | Optional | Category hints (material, labour, slot time) — no SKU yet |
| `inventory_link` / catalogue line ref | **Defer** | Tie to Sale catalogue / Phase 4 profiles |
| Financial block | **Absent** on standalone offer | Money flows attach via invoice/payment chains later |
| Chain ref | Optional | If offer responds to a received `need` |

**Encode rule:** Same pads groups as a slim `work_record`-class record until Path C table assigns mandatory G0+G? per type (finalize in A2 with NOC-19).

---

## NOC-14 — Connections screen vs Need/Offer records (explained)

| Concept | What it is |
|---|---|
| **Connections screen** (`connections.js`) | D-pad UI over **contacts** scored by **rel-volume** (buy/sell frequency bands). “Who is in my network and how active?” — **not** a list of `connection` record types. |
| **`connection` record** | A **relay** artifact: title, point-toward name, relay note — gatekeeper / bridge, may ack later (NOC-06 scaffold). |
| **`need` / `offer` records** | Exchange **intent** records you create or receive. |

**Locked UX (NOC-14):** Connections screen shows **contacts + scores first**. Optional v0.3 enhancement: from a focused contact, **jump to list filter** showing that contact’s related `need`/`offer`/`connection` records — do **not** duplicate a full NOC list inside Connections until rel-volume is stable.

---

## NOC-09–11 — proposed (confirm or edit)

| ID | Proposed answer | Rationale |
|---|---|---|
| NOC-09 | **Observation-class / flow-exempt** until a bilateral flow record (invoice, payment, etc.) attaches | Need/offer state intent; conservation runs on flow legs (Doc 4) |
| NOC-10 | **Can open informational chain** (referral → ack scaffold); full ratification per NOC-06 defer | Matches “separate from referral” + scaffold gatekeeper |
| NOC-11 | **`need` and `offer`** trigger Doc 6 confirmation when `action_required` / share implies response; **`connection`** usually informational — light ack only until gatekeeper matures | |

---

## Recommended review sequence

1. Answer **NOC-01** (model) — gates most others  
2. Answer **NOC-02–04** (ontology + UX entry)  
3. Cross-check **G-05, G-06** in [`ROUND-A1-IO-GLYPH-RECONCILIATION.md`](ROUND-A1-IO-GLYPH-RECONCILIATION.md)  
4. Only then: wire table (NOC-19–21) in Round A2  
5. Lock in `PRODUCT-SURFACE-LOCKED.md` § Need/Offer/Connection

---

## Implementation freeze (until lock)

| Allowed                                   | Blocked without lock                 |
| ----------------------------------------- | ------------------------------------ |
| Bugfixes in `io-record.js` / list filter  | New wire fields for NOC              |
| Doc/comments explaining provisional state | Path C type table entries for NOC    |
| A1 questionnaire answers                  | “Full” C7 expansion per old IO lock  |
| Track S unrelated ship items              | Glyph registry entries for NOC types |

---

_End._
