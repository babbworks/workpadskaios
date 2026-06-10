# Round A4 — Compression & profiles (questionnaire)
_Status: **signed off** — locked in [`COMPRESSION-ROADMAP-LOCKED.md`](COMPRESSION-ROADMAP-LOCKED.md)._  
_Deliverable: [`COMPRESSION-ROADMAP-LOCKED.md`](COMPRESSION-ROADMAP-LOCKED.md)_

---

## 1. Relational mode

| ID | Question | **Answer** |
|---|---|---|
| CR-01 | Ship relational mode in v0.3 at all? | **No** — v0.4 (after `1pv/` + chain stable) |
| CR-02 | Relational flag + uint24 chain refs together? | **Yes** — single v0.4 package |

---

## 2. Domain profiles

| ID | Question | **Answer** |
|---|---|---|
| CR-03 | First profile shipped? | **`service_work.v1` only** in v0.4 |
| CR-04 | `produce.v1` same wave? | **Defer** — after service_work telemetry |
| CR-05 | Profile mandatory groups overlay Doc 13 only? | **Yes** (PC-14 / C-Q04) |

---

## 3. Symbol tables

| ID | Question | **Answer** |
|---|---|---|
| CR-06 | Symbol sync first transport? | **Inline TABLE_ENTRY_ADD in record stream** — dedicated `1ds/` messages defer |
| CR-07 | BlockRegistry → symbol table migration? | **Phase 4:** export contacts/labels to local symbol store; encode tokens on relational encode |
| CR-08 | GlobalSynonymsService vs wire symbols? | **UI synonyms stay local**; wire symbols are counterparty-scoped tables (Doc 11) |

---

## 4. Advanced compression

| ID | Question | **Answer** |
|---|---|---|
| CR-09 | Delta records (Doc 7 §10.2)? | **Defer** v0.4+ |
| CR-10 | Vector/geometric compression? | **Defer** — research only |
| CR-11 | Target: 50% byte reduction on 10th exchange (Doc A metric)? | **Yes** — measure in v0.4 beta, not v0.3 gate |

---

## 5. v0.3 vs v0.4 summary (pre-filled)

| Capability | v0.3 (`1pv/`) | v0.4 |
|---|---|---|
| Path C header | ✓ | — |
| Flag byte + CRC | ✓ | — |
| NOC types | ✓ | — |
| relationship + chain_mode | ✓ | — |
| Action list + 16-bit masks | ✓ | — |
| Relational mode | — | ✓ |
| Symbol table sync | — | ✓ |
| `service_work.v1` profile | — | ✓ |
| Delta records | — | maybe |

---

## Completion

- [x] Draft answers
- [x] Stakeholder sign-off (2026-05-24)

---

_End._
