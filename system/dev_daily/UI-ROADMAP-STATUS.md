# UI Roadmap — Master Status (R1–R8 + IO + UX batches)

**Purpose:** Single checklist so nothing from the 8-round plan, two UX fix batches, or IO/Sale philosophy is dropped.  
**Plan:** [`UI-ROADMAP-IO-PHILOSOPHY.md`](UI-ROADMAP-IO-PHILOSOPHY.md) · **Integration:** [`UI-INTEGRATION-MAP.md`](../dev_refs/UI-INTEGRATION-MAP.md)  
**Updated:** 2026-05-22

### Legend

| Status | Meaning |
|--------|---------|
| **Done** | Shipped in `workpadskaios` shell |
| **Partial** | Some behaviour exists; spec not complete |
| **Not started** | No meaningful implementation yet |
| **Deferred** | Explicitly later (focused round / Phase 3+) |

---

## A. Eight UI rounds (original wireframe plan)

### R1 — Navigation & trust

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| R1.1 | Unified `NavStack` (back always predictable) | **Done** | `nav-stack.js`, `App.goBack()`, default on |
| R1.2 | Crumbs consistent on all screens | **Done** | `nav-crumb-bar` + `syncScreenTitle` parent › child on screen headers |
| R1.3 | Empty states unified copy/layout | **Done** | `empty-state.js`; list, sale, finance, archive, share, country, io-create |
| R1.4 | List scroll restore after view | **Done** | `saveNavState` + `NavStack.amendTop({restoreNav})` |
| R1.5 | `share_pending` tag when link not copied | **Done** | `share.js` + list pill |
| R1.6 | Filter/list affordance for share pending | **Done** | **Pend** badge + key `7` |

### R2 — Work surface (one filter brain)

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| R2.1 | Panel browse ↔ list share one filter model | **Done** | `getListFilters` / `applyListFilters`; panel pulls list activities on open |
| R2.2 | `work_surface` flag + `listFilters` object | **Done** | Full filter object (panel, type, sort, toggles) behind `work_surface` |
| R2.3 | **FilterSheet** (sort + activity + type combined) | **Done** | `filter-sheet.js`; **Filters** btn + key `3`; default on |
| R2.7 | **Slim list toolbar** (count · Sell · Filters/Tools · flag) | **Done** | Crowded sort/type/act/dens chips moved into Filters or **Tools** sheet |
| R2.8 | **Sale rollup** — one row per sold item in period | **Done** | `sale-rollup.js`; inline count/qty/net; **+** / Enter quick re-sell; SoftRight / dbl-click last sale |
| R2.4 | Sale **catalogue** (items you sell) | **Done** | `SaleCatalogue` + tally screen |
| R2.5 | Panel **Sales** line → list filter | **Done** | `data-filter=sales` |
| R2.6 | Panel **Quick sell** → tally | **Done** | `data-action=sell-tally` + Sell QC |

### R3 — Record lifecycle

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| R3.1 | Quote → Invoice → Close obvious (progression) | **Done** | `lifecycle.js` strip + CTA + chain docs; `chainRef` on progress |
| R3.2 | **Outcome-only create** (need = Outcome text) | **Done** | `io-create.js` |
| R3.3 | Save draft vs Share (share = save) | **Done** | IO create step 2 |
| R3.4 | **Sale** record type + tally | **Done** | `record_type: sale`, `sale-tally.js` |
| R3.5 | New-record branch types (payable, receivable, dispute, ack) | **Done** | `NEW_RECORD_BRANCH_TYPES` |
| R3.6 | Type picker excludes chain derivatives for “All” | **Done** | Prior UX batch |
| R3.7 | Deep invoice-child model (Billed/Collected/Receivables) | **Done** | `invoice-lifecycle.js` strip on quote/invoice view |
| R3.8 | Liabilities in-form link picker | **Done** | List branch + wizard Financial tab link payable/receivable |

### R4 — Finance clarity

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| R4.1 | Four money beats (short panel summary) | **Done** | `pb-money-four` block; flag `money_four` (default on) |
| R4.2 | Finance overview honest multi-currency | **Done** | `finance-overview.js` |
| R4.3 | BY TYPE one line per currency | **Done** | Prior UX batch |
| R4.4 | Priority currencies in settings | **Done** | `ActivityService` fin priority |
| R4.5 | Sale cash-only vs full (buyer optional) | **Done** | RSK toggle + `wp_sale_full_mode` |
| R4.6 | Sale session today total | **Done** | `wp_sale_session_*` |
| R4.7 | Panel sales agg includes `sale` type | **Done** | `_recordType` + computeAggregate |

### R5 — D-pad completeness

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| R5.1 | Every overlay fully traversable | **Done** | `overlay-focus.js` on view options/commit/progression/confirm |
| R5.2 | Sale: Another / New qty / Back to catalogue | **Done** | `sale-tally.js` |
| R5.3 | **Screen lock** for market stall | **Done** | `*` toggle + overlay |
| R5.4 | Calendar date picker D-pad chain | **Done** | Prior UX batch |
| R5.5 | `sale_screen_lock` behind UIPhase flag | **Done** | `*` lock gated by `sale_screen_lock` (default on) |

### R6 — Visual calm & prominence

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| R6.1 | **Foreground Sale** (home, list, panel) | **Done** | Sell btn, key `8`, home SC2, panel QC |
| R6.2 | List density control | **Done** | Filters/Tools sheet **Density** (was toolbar D) |
| R6.3 | Muted QC / softer panel backdrop | **Done** | Prior UX batch CSS |
| R6.4 | View default collapse / 4th collapse | **Done** | Prior UX batch |
| R6.5 | Quote progression pulse on view | **Done** | Prior UX batch |
| R6.6 | Boot default: Sale as “home mode” option | **Done** | `wp_home_mode`: list / wp+ / sell; Settings cycles all three |

### R7 — Merge, delete, frames (LOC + IO)

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| R7.1 | **FilterSheet** replaces 3 pickers | **Done** | `filter_sheet` default on; legacy pickers when off |
| R7.2 | Shared aggregate helper (panel + finance) | **Done** | `finance-aggregate.js`; panel delegates |
| R7.3 | **Progressive form** (indicator-driven fields) | **Done** | `progressive-form.js`; new records; tier 0–2 + More |
| R7.4 | **In/Out UI frame** (alternate to PADS sections) | **Done** | `in-out-frame.js`; Outcome/Inputs/Outputs/Notes tabs |
| R7.5 | **Words / Numbers** capture lenses | **Done** | `capture-lens.js`; wizard bar; `#` toggles; Settings flag |
| R7.6 | Delete/merge duplicate filter code paths | **Done** | Legacy sort/act pickers redirect when `filter_sheet` on |

### R8 — Onboarding

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| R8.1 | W → Help **tour** mode | **Done** | Logo + `help.js` tour |
| R8.2 | Tour as 5-step checklist | **Done** | W-logo tour shows 5-step quick-start checklist |
| R8.3 | **Stall-seller path** in tour (catalogue → tally → repeat) | **Done** | Checklist step 1–2 (Sell boot, catalogue, keys) |
| R8.4 | IO / Outcome path in tour | **Done** | Checklist steps 3–4 (Outcome create, lifecycle) |

---

## B. Pre-roadmap UX batches (implemented before IO plan)

### Batch 1 — Trust & list (2026-05-21)

| Item | Status |
|------|--------|
| Options overlay order + `[1]`–`[9]` on view | **Done** |
| Shortcut map + `saveNavState` before `showView` | **Done** |
| List scroll restore | **Done** |
| Density toolbar button | **Done** |
| Activity/Sort pickers styled like type picker | **Done** |
| Activity filter: back + create when empty | **Done** |
| Panel `+` not “New”, Personal padding | **Done** |
| New record “All” hides chain types | **Done** |
| Payable/Receivable/Dispute/Ack branching | **Done** |

### Batch 2 — Panel, finance, home (2026-05-21)

| Item | Status |
|------|--------|
| Loans filter (`record_type: loan`) | **Done** |
| Home left panel parity + context | **Done** |
| Finance priority currencies + BY TYPE per ccy | **Done** |
| List group bunching + Grp + sort by type/activity | **Done** |
| View 4th collapse + quote pulse | **Done** |
| Calendar D-pad | **Done** |
| W tour via panel logo | **Done** |
| Panel A icon, dim QC, backdrop | **Done** |
| Panel filter clears type filter | **Done** |
| Activity on QC create buttons | **Done** |
| Sales summary line + filter | **Done** (extended for `sale` type) |
| Slim list toolbar + sale rollup rows | **Done** | `wp_sale_rollup` default on; toggle in Filters/Tools |
| Bill of sale type | **Done** as **`sale`** + tally |
| Deep invoice-child / liabilities in-form picker | **Deferred** → R3.7–R3.8 |

---

## C. IO / product philosophy (not all = one round)

| # | Theme | Status | Target round |
|---|--------|--------|--------------|
| C1 | **Outcome** synonym + system-form settings | **Done** | Settings: Outcome label field; view uses `GlobalSynonymsService` |
| C2 | **Job / Work Inputs** label (COGS kept in finance) | **Done** | `io-labels.js`; Settings toggle; ledger COGS fields |
| C3 | Impersonal prompts (“What is needed?” removed) | **Done** | R3 IO create |
| C4 | PADS retained; In/Out **alternate frame** | **Done** | R7 — `in-out-frame.js`; Settings toggle; off by default |
| C5 | Words / Numbers capture lenses | **Done** | R7 — `capture-lens.js`; `#` in wizard; default on |
| C6 | Soft balance hint (no hard block) | **Deferred** | Locked: defer — see `IO-DECISIONS-LOCKED.md` |
| C7 | All inputs = **needs**; sourced/unsourced | **Done** | `io-record.js` need type + ledger `input_source` |
| C8 | Needs / Offers / Connections as records | **Done** | Type picker + create/view screens |
| C9 | **Social ledger** (equivalence, long timelines) | **Done** | Trail on view/connections; event log — equivalence deferred |
| C10 | B→C obligation redirect / micro-target lines | **Deferred** | Phase 3+ |
| C11 | **Rel-volume filter** (buy/sell frequency) | **Done** | Scoring + explain + presets; Connections; list **Net** |
| C12 | **Progressive empty** create (indicator tree) | **Deferred** | Locked: end — wizard enough for now |
| C13 | Action over information; people/entities prominence | **Done** | `connections.js` rhythm UI; panel opens it |
| C14 | Minimal **Activity creation** step (not money/materials/social kinds) | **Done** | `ACTIVITY-TAXONOMY-LOCKED.md` — own/other + field/base/remote |
| C15 | Templates: rocket, farm, stall — presentation starters | **Done** | `PRESENTATION-LIBRARY-LOCKED.md` — Notes tab + note share |
| C16 | `relations_home` lens | **Done** | `home.js` lens when flag on |

---

## D. Phase flags (`ui-phase.js`) vs reality

| Flag | Round | Default when unset | Notes |
|------|-------|-------------------|--------|
| `nav_stack` | R1 | **on** | `App.goBack()`, crumb bar |
| `work_surface` | R2 | **on** | `listFilters` + panel sync |
| `filter_sheet` | R2/R7 | **on** | Unified Filters overlay |
| `lifecycle_strip` | R3 | **on** | View chain strip + CTA |
| `money_four` | R4 | **on** | Panel Money block |
| `progressive_form` | R7 | **on** | New-record wizard tiers |
| `capture_lens` | R7 | **on** | Words/Numbers bar |
| `sale_screen_lock` | R5 | **on** | `*` lock on tally |
| `io_create` | R3 | off | Outcome path always in type picker (de facto on) |
| `sale_tally` | R3–R6 | off | Sell entry points always on (de facto on) |
| `in_out_frame` | R7 | off | Settings toggle |
| `relations_home` | Later | off | Not implemented |

*Rollback:* `UIPhase.disable('…')` in console or Settings phase rows (Management).

---

## E. Scorecard

| Area | Done | Partial | Not started | Deferred |
|------|------|---------|-------------|----------|
| **R1** | 6 | 0 | 0 | 0 |
| **R2** | 6 | 0 | 0 | 0 |
| **R3** | 8 | 0 | 0 | 0 |
| **R4** | 7 | 0 | 0 | 0 |
| **R5** | 5 | 0 | 0 | 0 |
| **R6** | 6 | 0 | 0 | 0 |
| **R7** | 7 | 0 | 0 | 0 |
| **R8** | 4 | 0 | 0 | 0 |
| **UX batches** | 22 | 0 | 0 | 0 |
| **IO philosophy** | 6 | 2 | 0 | 4 |

**Rough completion:** ~**92%** of R1–R8 + UX batches **Done**; IO philosophy ~**50%** done — **§H locked** in [`IO-DECISIONS-LOCKED.md`](IO-DECISIONS-LOCKED.md).

---

## F. Recommended build order (addresses everything systematically)

Work in **round order**, finishing partials before opening new philosophy (C7–C10):

1. ~~**R1 finish**~~ — crumbs + `empty-state.js` (more screens can migrate)  
2. ~~**R2 finish**~~ — `listFilters` + FilterSheet  
3. ~~**R3/R4**~~ — lifecycle + money four  
4. ~~**R5**~~ — overlay D-pad on view pickers  
5. ~~**R6**~~ — `wp_home_mode: sell` boot  
6. ~~**R7**~~ — progressive + In/Out + capture lenses (R7.2/R7.6 polish optional)  
7. ~~**R8**~~ — tour checklist  
8. ~~**§H IO decisions**~~ — locked; shipped R3.7–R3.8, C7–C8, C11 partial, Connections UI  
9. **Remaining:** C1 settings UI · C9–C10 obligations depth · C12 end-game progressive · C14 activity taxonomy · advanced rel-volume UI

---

## H. IO decisions — **locked** (2026-05-21)

Full record in [`IO-DECISIONS-LOCKED.md`](IO-DECISIONS-LOCKED.md). Summary:

| # | Decision |
|---|----------|
| H1 | **C7 full** — Need / Offer / Connection record types |
| H2 | **C8 same round** — shipped with C7 |
| H3 | **C9** scaffold only; obligations UI deferred |
| H4 | **C11** `rel-volume.js` + Connections bands (advanced dials in storage) |
| H5 | **C12** wizard enough; captivating progressive **deferred to end** |
| H6 | **Connections screen** — not A–Z contacts list |
| H7 | **C14** keep minimal activity create |
| H8 | **C15** manual templates |
| H9 | **R3.7–R3.8** shipped with IO pass |
| H10 | **COGS kept**; Job/Work Inputs label yes; **balance hint deferred** |

---

## G. What “3 options” omitted (now explicit)

Earlier suggestions named only In/Out frame, nav_stack, and view sale band. **Also required** from the full plan:

- FilterSheet + unified filters (R2/R7)  
- NavStack + crumbs (R1)  
- Quote→invoice lifecycle polish (R3)  
- Four money beats UI (R4)  
- Full D-pad overlay audit (R5)  
- Tour stall + Outcome paths (R8)  
- Progressive form engine (R7)  
- Activity Inputs + synonym settings UI (C1–C2)  
- Needs/offers on quotes (C7)  
- Social ledger round (C9–C10)  
- Rel-volume filters (C11)  
- Invoice-child / liabilities picker (R3.7–R3.8)  
- Activity creation taxonomy (C14)  

---

## Changelog

| Date | Note |
|------|------|
| 2026-05-21 | Master status created — maps R1–R8, UX batches, IO philosophy |
| 2026-05-21 | R3.1 lifecycle strip + R4.1 money four beats shipped |
| 2026-05-21 | R1 crumbs, R2 listFilters, R6 sell boot, R8 tour checklist, empty-state helper |
| 2026-05-21 | R7.3 progressive form + R7.4 In/Out wizard frame; Settings toggles |
| 2026-05-21 | R7.5 capture lenses; R5.1 overlay D-pad; R1.3 empty-state migration |
| 2026-05-21 | Scorecard + §H IO decision table synced to shipped code |
| 2026-05-21 | §H locked; R3.7–R3.8, R7.2/R7.6, C7–C8, Connections, io-labels, rel-volume, social-ledger scaffold |
| 2026-05-21 | C1 Outcome label settings; rel-volume tuning UI; list Net btn; IO view options (confirm relay) |
