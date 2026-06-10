# Round A1 — IO vs glyph reconciliation (questionnaire)
_Status: **locked** — see [`PRODUCT-SURFACE-LOCKED.md`](PRODUCT-SURFACE-LOCKED.md) § G-01 explained._  
_Principle (Round 0): **neither IO nor glyph docs win by default.**_

---

## Read order

| Source | Path |
|---|---|
| IO locked (provisional where noted) | `IO-DECISIONS-LOCKED.md` |
| IO philosophy | `UI-ROADMAP-IO-PHILOSOPHY.md` |
| Conservation / bilateral | `research/.../Workpads — Conservation and the Bilateral Exchange.md` |
| Action list / three faces | `research/.../Workpads — Action List.md` |
| Glyph aspirations | `research/.../Workpads — Glyph System · Commentary and Aspirations.md` |
| Glyph layer spec | `research/.../Workpads — Glyph Layer and Visual Encoding.md` |
| Card zones | `research/.../Workpads — Card & Screen Types Colour.md` |

---

## A. Frames and bands

| ID | Question | IO position | Glyph position | **Answer** |
|---|---|---|---|---|
| G-01 | Primary work surface for **flow** records (invoice, payment): PADS wizard bands or four-zone card? | PADS default; In/Out frame behind flag (R7) | Four zones + I/O bilateral (Commentary §4, Card doc) | **Edit:** PADS wizard; **view/share** uses four-zone + I/O when `ui.card_frame` flag on |
| G-02 | Is In/Out frame the **same** as glyph I/O layout, or a simplified D-pad subset? | In/Out = alternate presentation, same codec | I/O layout = conservation diagram | **Same semantics**, simplified D-pad capture in In/Out; full bilateral diagram on view/share |
| G-03 | Per-record-type layout rules, or user toggle (Settings)? | Not specified | Glyph Q-015 — per type vs toggle | **Per record type** defaults; Settings override for In/Out vs PADS only |
| G-04 | List row: text summary only, glyph strip (L0), or both? | UI-ROADMAP mostly text | Glyph strip mandatory aspiration (Commentary P1) | **Both** — text primary; glyph strip behind `ui.list_glyphs` flag for v0.3 |

---

## B. Outcome, needs, and conservation language

| ID | Question | IO position | Glyph / protocol position | **Answer** |
|---|---|---|---|---|
| G-05 | “Outcome” (io-create) vs `record_type: need` — one concept or two? | Tier 0 Outcome **is** the need stated; separate NOC types in C7 | Doc 4 bilateral legs; need = input side of exchange | **Two linked:** Outcome create → minimal `need` record; explicit `need` wizard = same type, more fields |
| G-06 | Should **pending conservation** use the same visual on list, card Zone 3, and share preview? | Deferred balance hint (C6) | Half-filled I/O / pending marker (Commentary P0) | **Yes — same glyph/marker** everywhere when flow record pending (P0); no soft balance numbers (C6 still deferred) |
| G-07 | COGS / Job Inputs labels on **left panel** — coexist with glyph zones without crowding? | Keep COGS | Zones are decode-only; labels are capture | **Yes** — panel/finance labels unchanged; glyphs on record card/list not panel COGS |
| G-08 | Activity Inputs vs “Sourced/Unsourced Inputs” — single label system via `IOLabels` + synonyms? | IO-DECISIONS | Symbol table may rename later (Doc 11) | **Yes** — `IOLabels` + synonyms now; symbol table may alias later |

---

## C. Three faces and share

| ID | Question | Doc 6 | Glyph Commentary | **Answer** |
|---|---|---|---|---|
| G-09 | Customer-facing share: Face 1 only, or full card with hidden zones? | Three faces defined | Customer = obligation-forward | **Face 1 card** for v0.3 share preview; zones 2–3 collapsed/hidden |
| G-10 | Does Face 2/3 ever appear on KaiOS share **preview**, or only after open? | Presentation spec | L2 zone dive | **After open** — preview is Face 1 only |
| G-11 | Action list on receive: full screen, modal, or zone expansion? | Doc 6 §4 | Zone 2/3 interaction | **Dedicated receive screen** (KaiOS D-pad); zone expansion Phase 6+ |

---

## D. Chain and obligations in the display layer

| ID | Question | Protocol | Glyph | **Answer** |
|---|---|---|---|---|
| G-12 | Chain spine in list margin — required for v0.3 or feature-flag? | Doc 8 | Commentary §4.8 | **Feature flag** `ui.chain_spine` — on by default when chain present |
| G-13 | Map every `chain_mode` / relationship enum to a registry glyph before Phase 6 ship? | Doc 8 §6.3 | Open registry items | **Core set** before registry v1 ship; extended modes may use fallback glyph until A3 enum lock |
| G-14 | Open obligations — home strip, list filter, panel entry, or Connections screen? | Doc 4 §4.2 | Not glyph-specific | **List filter + panel entry**; Connections stays network/scores not obligation inbox |

---

## E. Sale vs office

| ID | Question | IO | Glyph | **Answer** |
|---|---|---|---|---|
| G-15 | Sale tally foreground (R3/R6) — glyph strip on catalogue rows? | Sale priority | Card types doc — market variants | **Optional** market glyph on catalogue row; sale screen stays number-first |
| G-16 | Screen lock / D-pad density — do glyphs replace text or supplement? | R5/R6 | Density in Glyph Lab | **Supplement** — never replace qty/title text on sale/tally |

---

## F. Authority rule (meta)

| ID | Question | **Answer** |
|---|---|---|
| G-17 | When IO-DECISIONS and Glyph Commentary conflict after this round, which doc class wins until next lock? | **`PRODUCT-SURFACE-LOCKED.md` > Doc 4/6 (wire/obligations) > IO-DECISIONS (capture labels) > Glyph docs (display)** |
| G-18 | May glyph registry v1 ship before Path C codec port? | **Yes** — mock/decode from local record JSON; **no** wire-only glyph paths until Path C tag ships |

---

## Web research (optional for A1)

- KaiOS 2.x/3.x list row height and font metrics (glyph strip feasibility)
- Unicode Geometric Shapes coverage on target devices

Synthesis → `dev_daily/research-notes/A1-kaios-display.md` when run.

---

## Completion checklist

- [x] All G-01–G-18 answered (draft — confirm to finalize)
- [x] NOC section completed in [`ROUND-A1-NOC-REVIEW.md`](ROUND-A1-NOC-REVIEW.md) (partial + proposed 09–11)
- [ ] `PRODUCT-SURFACE-LOCKED.md` written
- [ ] `IO-DECISIONS-LOCKED.md` amended where A1 supersedes (NOC-05)
- [ ] P0 glyph items propagated to Glyph Lab Reference

---

_End._
