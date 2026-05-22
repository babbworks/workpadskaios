# UI Roadmap, Wireframes & IO Philosophy

**Status:** Living document — unified R1–R8 + IO/Sale decisions  
**Audience:** Product + engineering  
**Cross-ref:** [`UI-ROADMAP-STATUS.md`](UI-ROADMAP-STATUS.md) (**master checklist**), [`UI-INTEGRATION-MAP.md`](../dev_refs/UI-INTEGRATION-MAP.md), [`FEATURES.md`](FEATURES.md)

---

## Part A — Unified UI rounds (R1–R8 + IO/Sale)

Original eight rounds, now **expanded** with Outcome create, **In/Out alternate frame**, and **Sale (market tally)** — not a separate parallel roadmap.

| Round | Theme | Core (original) | **Added scope (IO/Sale)** |
|-------|--------|-----------------|---------------------------|
| **R1** | Navigation & trust | Back, crumbs, empty states | Tag/filter for records where **share link not copied**; list affordance |
| **R2** | Work surface | Panel + list one filter brain | **Sale catalogue** — list of items/services seller offers; entry to tally mode |
| **R3** | Record lifecycle | Quote→Invoice→Close | **Outcome-only create** (no extra “what is needed” step); **save draft vs share**; **Sale tally screen** (major) |
| **R4** | Finance clarity | Four money beats, currency | Sale **cash-only calculator** + **optional buyer** mode; session totals; repeat-last-qty |
| **R5** | D-pad completeness | All overlays traversable | Sale loop: same qty / new qty / back to catalogue; **screen lock** (market, not office) |
| **R6** | Visual calm | Density, muted QC | **Foreground Sale** on home/list shortcuts — primary surface despite complex records elsewhere |
| **R7** | Merge & delete | FilterSheet, −LOC | **Progressive form** engine (indicator-driven fields); In/Out frame toggle behind flag |
| **R8** | Onboarding | W tour checklist | Stall-seller path: catalogue → tally → repeat sale |

**Deferred focused round:** Social **obligations** (equivalence, B→C redirect) — not folded into R1–R8 yet.

**Rejected:** Activity “kinds” as money | materials | social — wrong divisions; revisit only when a better taxonomy exists.

### A.1 Dependency order

```
R1 (trust/tags) ──► R2 (catalogue + filters) ──► R3 (Outcome create + Sale screen)
                              │
                              ├──► R4 (money modes)
                              ├──► R5 (D-pad + lock)
                              └──► R6 (prominence)
R7 (FilterSheet + progressive + In/Out frame) — parallel after R2 stable
R8 — after R3 Sale path exists
```

---

## Part B — Frames vs codec

### B.1 Two UI frames, one codec

| Layer | Role |
|-------|------|
| **Codec / storage** | **PADS-shaped** — `RecordService`, `WPCodec`, DOMAIN, account pairs, I>O bytes |
| **PADS UI frame** | Today’s wizard/view: P/A/D/S/F sections |
| **In/Out UI frame** | **Alternate presentation** (term may change); same fields **slot into** codec logic |
| **Words / Numbers** | Semi-abstract **capture lenses** usable inside either UI frame |

In/Out is **not** a second ledger — it is how users see ins/outs/Outcome while the wire stays pads-compatible.

### B.2 IO formula (unchanged conceptually)

```
Outcome (the need stated)
  ≈ Σ Activity Inputs (labour on task + general execution)
  + flows (materials, money, obligations)
```

- **Activity Inputs** — universal UX label for untied ins.
- **Balance** — soft guidance; qualitative Outcomes OK.

### B.3 Create tiers (corrected Round 2)

| Tier | User sees | Notes |
|------|-----------|-------|
| **0** | Outcome text only — **this is the answer to “the need”**; no follow-up “what is needed?” | Foundation of exchange |
| **0b** | Pick worker/contact → **Save draft** or **Share** (sharing = saving) | If link not copied → **tag** + filter (R1) |
| **1+** | Time/limits, Activity Inputs, flows | Progressive / PADS or In/Out frame |

**Language:** Impersonal system copy; **Outcome** synonym via `GlobalSynonymsService` + system-form settings.

---

## Part C — Sale (market tally) — product spec

**Priority:** Major surface; bring to fore in **R3/R6** despite full PADS capability.

### C.1 Two modes (both required)

| Mode | Use |
|------|-----|
| **Cash-only calculator** | Qty/price/total; no buyer; fastest stall flow |
| **Full sale** | Optional buyer + extra fields when needed |

### C.2 Calculator UX (mode 1 core)

```
┌─ Sale: Bananas ─────────────┐
│  Qty:  [ 3 ]   (repeat OK)  │  ← CSK / Enter = another sale @ same qty
│  Price: 50                  │  ← or enter new qty
│  Total: 150                  │
├─────────────────────────────┤
│  [Another] [New qty] [Back]  │
└─────────────────────────────┘
         Back → catalogue of items/services (R2)
```

- Stay in **record mode** across repeated transactions (“another banana”).
- **Repeat last number** or enter new qty before next sale.
- Back exits to **seller’s catalogue** (quick tally item list).

### C.3 Environment

- Built for **dynamic outdoor market**, not desk office.
- **Screen lock** — evaluate in R5 (KaiOS-friendly kiosk/stall lock).

### C.4 Codec

- `record_type: sale` (or agreed type key); maps through existing pads-v1 fields like other types.

---

## Part D — Phase flags (`ui-phase.js`)

Flags gate **round deliverables**; legacy default off.

| Flag | Round | Delivers |
|------|-------|----------|
| `nav_stack` | R1 | Unified back |
| `work_surface` | R2 | Panel/list + sale catalogue filter |
| `io_create` | R3 | Outcome-only create + draft/share choice |
| `sale_tally` | R3–R6 | Sale screen + calculator loop |
| `in_out_frame` | R7 | In/Out UI alternate to PADS sections |
| `filter_sheet` | R7 | Combined pickers |
| `sale_screen_lock` | R5 | Stall lock (optional) |

Remove standalone “T1–T8 tracks” — work flows through **R1–R8** above.

---

## Part E — Decision log

### E.1 Round 1 (retained)

PADS = codec truth; Activity Inputs label; social ledger vision; needs/offers on quotes; rel-volume filters; progressive forms; impersonal language.

### E.2 Round 2 (2026-05-21)

| Topic | Decision |
|-------|----------|
| **PADS vs In/Out** | **Alternate UI frames**; codec remains PADS-based; In/Out fields map into codec |
| **Outcome create** | No “what is needed?” — Outcome text **is** the need statement |
| **Save / share** | Sharing = saving; prompt **draft vs share**; uncopied link → **tag** + UI filter |
| **Sale** | Both calculator + optional buyer; repeat qty; catalogue back; **foreground** product surface |
| **Screen lock** | Desirable for market usage (R5) |
| **Activity kinds** | **Not** money/materials/social — rejected |
| **Obligations** | Separate focused round later |
| **Planning** | All IO/Sale work **inside R1–R8**, not a side roadmap |

### E.3 Corrections from Round 1 doc

- ~~Words/Numbers replace PADS~~ → PADS and **In/Out** are UI frames; Words/Numbers are lenses.
- ~~Tier 1 “What is needed?”~~ → removed; Outcome only at foundation.

---

## Part F — Wireframe refs

Detailed ASCII (current vs proposed) for R1–R8 + Sale catalogue + Outcome create: see [`UI-INTEGRATION-MAP.md`](../dev_refs/UI-INTEGRATION-MAP.md) §7–9.

---

## Changelog

| Date | Note |
|------|------|
| 2026-05-21 | Round 2: In/Out alternate frame; Sale spec; unified R1–R8; Outcome=need |
| 2026-05-21 | Round 1 decisions |
| 2026-05-21 | Initial save |
