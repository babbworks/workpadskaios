# UI Integration Map — Current Shell vs Phase 2

**Purpose:** Manual rollback and cherry-pick guide. Not one-click revert — a map of *what connects to what* so you can direct which legacy surfaces stay live while Phase 2 lands.

**Related:** [`UI-ROADMAP-IO-PHILOSOPHY.md`](../dev_daily/UI-ROADMAP-IO-PHILOSOPHY.md), [`JS-RUNTIME-MAP.md`](JS-RUNTIME-MAP.md), [`FRAME-SPEC.md`](FRAME-SPEC.md) §17 (Account Pairs), BitLedger Universal Domain in `repos/bitpads-standard/`.

**As of:** 2026-05-21

---

## 1. Screen graph (today)

```
                    ┌─────────────┐
                    │  Onboarding │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌────────────┐            ┌────────────┐
       │  WP+ HOME  │◄──key 2───│ LIST       │◄── default classic
       └─────┬──────┘            └─────┬──────┘
             │                         │
             │ LSK panel               ├──► VIEW ──► WIZARD (edit)
             │ (browse)                │       ├──► FINANCIAL
             └─────────────────────────┤       ├──► SHARE / CHAIN
                                       │       └──► DISPUTE / ARCHIVE
                                       ├──► MANAGEMENT (tabs)
                                       ├──► FINANCE-OVERVIEW
                                       ├──► HELP (W tour)
                                       ├──► SALE-TALLY (R3, planned)
                                       └──► panels: Workpads (L), Personal (R)

Sale path (R3–R6): LIST/HOME ──► Sale catalogue ──► Sale tally (repeat qty loop)
```

### Data flows that must stay coherent

| From | To | State carried |
|------|-----|----------------|
| LIST | VIEW | `ListScreen.saveNavState` → `restoreNav` |
| Workpads panel | LIST | `setFilter`, `setActivityFilter`, `browseActivities` |
| VIEW | WIZARD | `entryRecord`, clone/amend |
| Panel QC | LEDGER / LIABILITIES | `activityId` (single chip), `linkedRecord` |
| TYPE picker (new) | WIZARD / branch / link picker | `NEW_RECORD_BRANCH_TYPES` |

---

## 2. Layer model (for cherry-pick)

| Layer | Files | Replaceable independently? |
|-------|-------|---------------------------|
| **A — Shell** | `index.html`, `css/app.css` | Yes (visual only) |
| **B — Router** | `app.js` (`SCREENS`, `show*`, softkeys) | Partial — add phase gates here |
| **C — List work surface** | `list.js` | High value; largest file |
| **D — Panel browse** | `workpads-panel-browse.js`, `workpads-panel-shared.js` | Pairs with C |
| **E — Record read** | `view.js` | Progression / collapse |
| **F — Money aggregate** | `finance-overview.js`, panel `loadBrowseAgg` | Shares math intent |
| **G — Codec / ledger truth** | `RecordService`, `FinancialModel`, `codec.js` | Do not fork — IO binds here |

**Rule:** Phase 2 UI should call the same G-layer; only B–F swap presentation.

---

## 3. Feature flags (`js/lib/ui-phase.js`)

Flags are **opt-in per capability**, stored in `localStorage` prefix `wp_ui_phase_`.

| Flag key | Default | Legacy when `false` | Phase 2 when `true` |
|----------|---------|---------------------|---------------------|
| `nav_stack` | false | Ad hoc `restoreNav`, crumbs | Unified `NavStack` |
| `work_surface` | false | Split `activityFilter` / `browseActivities` | `listFilters` object |
| `filter_sheet` | false | Separate sort/act/type pickers | Single FilterSheet |
| `io_create` | false | Type picker → wizard | Outcome-only create + draft/share (R3) |
| `sale_tally` | false | — | Sale calculator + catalogue (R3–R6) |
| `in_out_frame` | false | PADS section UI | In/Out alternate frame, same codec (R7) |
| `sale_screen_lock` | false | — | Market screen lock (R5) |
| `relations_home` | false | Record list | Needs/offers (focused round later) |

**Manual integration:** Enable one flag in devtools console, e.g. `UIPhase.enable('work_surface')`, test, merge behaviours back into legacy if needed.

---

## 4. Cherry-pick matrix

| Legacy piece worth keeping | Phase 2 must preserve | Notes |
|--------------------------|----------------------|-------|
| Options overlay order + `[n]` keys | Yes | Already shipped |
| List scroll restore | Nav stack supersedes | |
| Group + Grp toolbar | Filter sheet may absorb | |
| Panel summary lines | Short “money four” + More | |
| `PROGRESSION_MAP` | IO “Outcome” path | |
| Account pair in codec | IO archetype labels in UI | DOMAIN=10/11 |
| Activity naming | “Activity” not “Business unit” | Product invariant |

---

## 5. New surfaces (planned, not in DOM yet)

| Surface | Replaces / augments | Depends on flag |
|---------|---------------------|-----------------|
| `IOCreateScreen` (concept) | Type picker for jobs | `io_create` |
| `SaleTallyScreen` (concept) | — | `sale_tally` |
| `SaleCatalogue` (list mode) | type filter only | `work_surface` + `sale_tally` |
| `InOutFrame` (view/wizard) | PADS sections | `in_out_frame` |
| `FilterSheet` (concept) | sort/act/type pickers | `filter_sheet` |
| `NavStack` (lib) | scattered back handlers | `nav_stack` |

Legacy routes remain registered in `app.js` until each flag is default-on.

---

## 6. Rollback procedure (manual)

1. Set flag to `false` in `localStorage` or `UIPhase.disable('…')`.
2. Reload app — boot reads flags in `ui-phase.js` `onBoot()`.
3. If a phase module was extracted (e.g. `list-filters.js`), leave file in tree but stop importing from `list.js`.
4. Document divergence in `UI-ROADMAP-IO-PHILOSOPHY.md` changelog section.

No git revert required if boundaries were respected.

---

## 7. ASCII — Outcome-only create (R3, `io_create`)

```
List key 1 ──► Outcome create
┌────────────────────────────┐
│ Outcome (the need stated)  │  ← job field; no "what is needed?" step
│ [........................] │
├────────────────────────────┤
│ Worker / contact           │
├────────────────────────────┤
│ Save draft    │   Share     │  ← sharing = saving
└────────────────────────────┘
  Share but link not copied → tag `share_pending` → list filter (R1)

Later: PADS wizard OR In/Out frame (R7) for complexity
```

## 8. ASCII — Sale tally (R3–R6, `sale_tally`)

```
HOME / LIST ──► [Sell] ──► CATALOGUE (items you sell)
                              │
                    pick "Bananas"
                              ▼
┌─ Sale: Bananas ─────────────┐
│ Qty [3]  Price 50  Total 150│  cash-only OR +buyer (mode toggle)
├─────────────────────────────┤
│ [Another @3] [New qty] [Back]│  Another = repeat last qty
└─────────────────────────────┘
         Back ──► CATALOGUE

R5: optional screen lock for stall / market
```

## 9. UI frames vs codec

```
┌─────────────┐     ┌─────────────┐
│  PADS UI    │     │ In/Out UI   │  alternate presentations (R7)
│  P/A/D/S/F  │     │ In | Out    │
└──────┬──────┘     └──────┬──────┘
       └────────┬──────────┘
                ▼
         RecordService / WPCodec  (PADS-shaped wire)
```
