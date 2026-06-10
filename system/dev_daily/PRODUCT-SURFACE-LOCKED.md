# Product surface — locked (Round A1)
_2026-05-24. Consolidates [`ROUND-A1-NOC-REVIEW.md`](ROUND-A1-NOC-REVIEW.md) + [`ROUND-A1-IO-GLYPH-RECONCILIATION.md`](ROUND-A1-IO-GLYPH-RECONCILIATION.md). Path C: [`CODEC-V2-SCOPE-LOCKED.md`](CODEC-V2-SCOPE-LOCKED.md)._

**Status:** **Locked** — `#1pv/`, NOC-09–11 confirmed. G-01: see § G-01 explained (default = no UX change until flag on).

---

## Authority stack (G-17)

1. This file (product surface)  
2. Doc 4 / Doc 6 (conservation, action list, faces)  
3. `IO-DECISIONS-LOCKED.md` (capture labels — amended where noted)  
4. Glyph / card research docs (display)

---

## Need / Offer / Connection (hybrid)

| Topic | Lock |
|---|---|
| Model | **Hybrid A+B:** wire types on **`#1pv/`** only; Outcome-first create default |
| Default create | `io-create` → minimal **`need`** (`job` = outcome text) |
| Power user | Type picker + `io-record` wizards; keep labour/source fields (NOC-08) |
| Offer fields v0.3 | `job` required; contact optional; no inventory link yet (see NOC review § walkthrough) |
| Connection vs referral | **Separate** record machinery |
| Connection vs Connections UI | Screen = rel-volume contacts/scores; records = drill via list filter |
| Viewer → Offer | **Allowed** (supersedes IO-DECISIONS 2026-05-21 “cannot make Offer”) |
| Pure connection gatekeeper | **Scaffold** ack/type — not full v0.3 |
| Conservation | NOC types **flow-exempt** until invoice/payment-class record attaches |
| Action list | **need** + **offer** full confirmation path; **connection** light ack |
| Glyph | **Distinct registry glyphs** per NOC type (NOC-16) |
| I/O bilateral | **View + share preview** for need/offer; create stays text/wizard |
| Card colours | Apply NOC card rules **before** Phase 6 full component port |
| Wire freeze on `#1pa/` | No new NOC fields on old tag (NOC-21) |

---

## G-01 explained (edit vs view — the question you were unsure about)

**Not one UI replacing the other — two moments:**

| Moment | What you see | v0.3 default |
|---|---|---|
| **Editing** (wizard, D-pad forms) | **PADS bands** (today’s P/A/D/S sections), or **In/Out frame** if user enabled it in Settings | **Unchanged** — same as now |
| **Viewing / sharing** (read-only view, share preview) | **Glyph card** — four zones + I/O bilateral layout | **Off** until `ui.card_frame` flag enabled (Phase 6 components) |

So G-01 does **not** force a new edit experience. It only allows the glyph/conservation **card** on read-only surfaces when you turn the flag on. Until then, view can stay PADS-style too.

**Locked rule:** edit = PADS (or In/Out opt-in); view/share = card layout optional behind `ui.card_frame`.

---

## IO vs glyph display

| Topic | Lock |
|---|---|
| Flow record edit | PADS wizard (In/Out frame optional via Settings) — **G-01** |
| Flow record view/share | Four-zone card + I/O bilateral when `ui.card_frame` (default off v0.3) |
| In/Out vs glyph I/O | Same conservation semantics; In/Out = simpler capture |
| List row | Text + optional glyph strip (`ui.list_glyphs`) |
| Pending conservation | Same half-I/O marker on list, card, share (no C6 balance numbers) |
| Panel COGS / Job Inputs | Unchanged |
| Labels | `IOLabels` + synonyms |
| Share preview | Face 1 only |
| Action on receive | Dedicated screen |
| Chain spine | `ui.chain_spine` flag, default on when chain exists |
| Sale catalogue | Numbers first; optional market glyph |
| Glyph before Path C | OK from local JSON; no wire-only glyphs |

---

## Path C (Round A2 — locked)

See [`CODEC-V2-SCOPE-LOCKED.md`](CODEC-V2-SCOPE-LOCKED.md) — tag **`#1pv/`**, dual-decode `#1pa/`, NOC on same tag.

---

## Supersedes IO-DECISIONS

| Was | Now |
|---|---|
| Connection viewer cannot make Offer | **May create Offer** from connection context |
| C7 “full” without review | **Hybrid wire + Outcome-first UX** per this file |

---

## Chain / execution (Round A3 — locked)

See [`CHAIN-EXECUTION-LOCKED.md`](CHAIN-EXECUTION-LOCKED.md) — dedicated action receive screen (CE-08), pending conservation on list + chain (CE-11), full `chain_mode` + `relationship` on `1pv/`.

## Still open → Phase 0 / A4

- Doc 3–13 section confirmations (CE-18 order)  
- Rel-volume boost from NOC frequency (NOC-23 defer)  
- Round A4 compression strategy (optional parallel)

---

_End._
