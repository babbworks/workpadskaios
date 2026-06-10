# Phase 0 — Research spec confirmation tracker
_Living checklist. Confirm by **section number** (e.g. `Doc 4 §6.1: accept`). Updates Document Index status when rows complete._

**Priority order (CE-18):** Doc 8 → Doc 6 → Doc 4 → then remaining load-bearing sections.

**Corpus:** [`research/Main Glyph & Group Ref Docs/`](../../../../research/Main%20Glyph%20&%20Group%20Ref%20Docs/)

---

## P0 — Required before `1pv/` standard write

| Doc | Section | Topic | Status | Notes |
|---|---|---|---|---|
| 8 | §3 | Relationship taxonomy | ☑ | Confirmed via `CHAIN-EXECUTION-LOCKED.md` |
| 8 | §4.3 | changedMask / amendments | ☑ | CE-17 |
| 8 | §7 | Gap recovery | ☑ | Accept for v0.3 |
| 6 | §4 | Action list presentation | ☑ | CE-08 dedicated screen |
| 6 | §6 | Ack return records | ☑ | |
| 6 | §8.2 | 16-bit confirmation masks | ☑ | CE-07 16-bit |
| 4 | §4.2 | Obligation-bearing / pending | ☑ | CE-11 |
| 4 | §5 | Scaled integers | ☑ | CE-14 v0.3 |
| 4 | §6 | Encoder balance check | ☑ | CE-13 v0.3 |
| 3 | §8.3–8.4 | Flag byte + CRC-16 | ☑ | SUI-023 — layout in addendum §2 |
| 3 | §2.2 | chainRef wire shape | ☑ | + relationship byte |

---

## P1 — Before relational compression port (v0.4)

| Doc | Section | Topic | Status | Notes |
|---|---|---|---|---|
| 7 | §4–6 | Relational mode + dictionary | ☑ | v0.4 wire; delta §10.2 deferred — `P1-CONFIRMATIONS-LOCKED.md` |
| 11 | §4–6 | Symbol table sync | ☑ | Inline TABLE_ENTRY_ADD first; `1ds/` deferred |
| 12 | §3–8 | Micro-ledgers / BitPads leg | ☑ | Model accept; BitPads §8 deferred |
| 13 | §2.2 | Domain profiles | ☑ | `service_work.v1` first; `produce.v1` deferred |

---

## P2 — Governance & transmission (parallel)

| Doc | Section | Topic | Status | Notes |
|---|---|---|---|---|
| 5 | §4–5 | SMS / QR / NFC / template QR | ☑ | `P2-CONFIRMATIONS-LOCKED.md`; binary QR → closing tasks |
| 5 | §8.1–8.4 | Open transmission questions | ☑ | 8.1 binary QR deferred to CT-1; template QR in scope now |
| 9 | §4.2 | Conformance CI + vectors | ☑ | `spec-tests/` per repo; steward **workpads.org** |
| 10 | §3–4 | Identity stages | ☑ | Stage 1 ship; sync-on-page-visit direction |
| 2 | §6 | Vision open frontiers | ☑ | Programmable records near-term — `PROGRAMMABLE-RECORDS-NOTE.md` |
| 1 | — | Master Synthesis (reference only) | ☑ source |

---

## P0/P1/P2 doc light pass (2026-05-24)

| Doc | Status |
|-----|--------|
| 3, 4, 6, 8, A | ☑ per `P2-CONFIRMATIONS-LOCKED.md` |
| 2, 5, 9, 10, 11, 12, 13, 7 | ☑ P1/P2 locks |

**Phase 0 confirmation: complete** for implementation planning.

---

## How to confirm

Reply in chat or annotate this file:

```
Doc 8 §3: accept
Doc 4 §5: accept base-2 scalars
Doc 5 §8.1: defer binary QR to Phase 3
```

Agent actions on confirm:
1. Update `Workpads — Document Index.md` status column  
2. Move **Open** items to `OPEN-QUESTIONS.md` if amended  
3. Unblock SUI standard paragraphs for that section  

---

## Exit criteria (Phase 0 for v0.3 codec)

All **P0** rows ☐ → ☑ (accept / amend / reject per section).

---

_End._
