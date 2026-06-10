# Junction decisions — locked (Round 0)
_Locked 2026-05-24 from stakeholder direction. Companion to [`JUNCTION-WORKPLAN.md`](JUNCTION-WORKPLAN.md)._

---

## Charter

| Topic | Decision |
|---|---|
| **Primary track** | **Track A** — architecture alignment and full roadmap (Doc A phases 0–6), not codec+chain only |
| **Track S (store ship)** | **Parallel** — Phase L and pre-ship bugs may continue unless a locked Track A decision blocks them |
| **Research corpus location** | [`research/Main Glyph & Group Ref Docs/`](../../../../research/Main%20Glyph%20&%20Group%20Ref%20Docs/) — authoritative map: `Workpads — Document Index.md` |
| **Research confirmation** | **Section-by-section** on Documents 3–13 (no bulk “approve all” unless explicitly stated later) |
| **Insight backflow** | Unchanged — `project-process.md` §6; research does not become wire truth without SUI |

---

## IO vs glyph authority

| Topic | Decision |
|---|---|
| **Conflict resolution** | **Neither document set wins by default.** Reconcile through explicit questions in [`ROUND-A1-IO-GLYPH-RECONCILIATION.md`](ROUND-A1-IO-GLYPH-RECONCILIATION.md); lock answers in `PRODUCT-SURFACE-LOCKED.md` when Round A1 completes |
| **Wire vs display** | Glyph/card docs are **presentation-only** (zero wire bytes). IO/product docs govern capture flows and labels. Protocol docs (4, 6, 8) govern obligations, action lists, conservation |
| **Supersedes** | This round **reopens** display and product-surface questions that `IO-DECISIONS-LOCKED.md` treated as settled for implementation pace — **not** financial framing (COGS, Job Inputs, defer C6 balance hint) unless A1 says otherwise |

---

## Path C header

| Topic | Decision |
|---|---|
| **Adoption** | **Yes** — all six proposals (C1–C6) per Path C Full Adoption spec |
| **Integration timing** | **Not immediate.** Filter through Round A2 questions; confirm **when** (scheme tag, port order, shortcut scope) before codec work |
| **Deliverable** | `CODEC-V2-SCOPE-LOCKED.md` + SUI rows after A2 |

---

## Need / Offer / Connection

| Topic | Decision |
|---|---|
| **Before further implementation** | **Mandatory review** — approach and question set in [`ROUND-A1-NOC-REVIEW.md`](ROUND-A1-NOC-REVIEW.md) **before** expanding C7 behaviour, wire fields, or glyph mapping |
| **IO-DECISIONS-LOCKED C7** | Treated as **provisional** until A1 NOC section locks. Existing `io-record.js` / list type picker are **baseline to evaluate**, not final architecture |
| **Outcome-only create (`io-create`)** | Remains the R3 “need stated” path; NOC review must define how it relates to `need` / `offer` / `connection` record types |

---

## Roadmap scope (Track A)

Full [`Workpads — Architectural Roadmap.md`](../../../../research/Main%20Glyph%20&%20Group%20Ref%20Docs/Workpads%20—%20Architectural%20Roadmap.md) phases — execution map in [`ARCHITECTURE-ALIGNMENT-ROADMAP.md`](ARCHITECTURE-ALIGNMENT-ROADMAP.md).

| Phase | Theme | Coding gate |
|---|---|---|
| 0 | Spec confirmation (Docs 3–13 by §) | No Track A codec until Phase 0 load-bearing § confirmed |
| 1 | Codec integrity + Path C | After A2 locked + SUI |
| 2 | Execution + conservation + action list | After A3 locked |
| 3 | Transmission (SMS/QR/NFC) | After Phase 2 exit criteria |
| 4 | Relational compression | After A4 locked (implementation may defer) |
| 5 | Identity + governance | After Phase 4 strategy set |
| 6 | Display / glyph / cards | After A5 locked; may parallel mock UI from Phase 1 |

---

## Gates (unchanged from junction plan)

Track A codec/app work requires: this file (G1) + A2 + A3 locked + SUI + OQ registry update + `project-process.md` §7 refresh.

---

## Still open (not Round 0)

| ID | Question |
|---|---|
| J0-1 | Any Track S item that would encode `need`/`offer`/`connection` on wire before NOC + Path C locks? |
| J0-2 | Bulk confirm vs §-by-§ — default remains §-by-§ |

---

## Next actions

1. Run **Round A1** — complete `ROUND-A1-IO-GLYPH-RECONCILIATION.md` + `ROUND-A1-NOC-REVIEW.md` questionnaires with answers → `PRODUCT-SURFACE-LOCKED.md`
2. Run **Round A2** — Path C integration timing → `CODEC-V2-SCOPE-LOCKED.md`
3. Begin **Phase 0** confirmations — start Doc 3 §8, Doc 4 §4–6, Doc 6 (load-bearing for A1/A3)

---

_End. Amend only by explicit stakeholder lock + date._
