# Workpads KaiOS — Development Plan
_Living document. Updated as phases complete and decisions shift._
_Last reviewed: 2026-05-21_

---

## Purpose of This Document

This is the cognitive anchor for ongoing development. It synthesises the system folder docs,
external reliances (BASICS, workpads-standard, codec ecosystem), and the v0.2 roadmap into
a single decision-making reference.

**Every planning session:** start at [`project-process.md`](../project-process.md), then this file, then the phase-specific doc below.

**App coding (2026-05-24+):** Native/v0.4 codec work closed in KaiOS. Screen and linked-functionality work is tracked in [`APP-BUILD-PHASE.md`](APP-BUILD-PHASE.md) (inventory + A1–B8 queue). UI checkboxes remain in [`UI-ROADMAP-STATUS.md`](UI-ROADMAP-STATUS.md).

---

## Phase audit summary (2026-05-21)

Code audit against `app.js` `SCREENS` (22 screens), `package.json` v0.2.0, `npm test` (685 pass). Authoritative detail: [`FEATURES.md`](FEATURES.md) § KaiOS application.

| Phase | Status | Evidence / gap |
|-------|--------|----------------|
| **A** Codec | **COMPLETE** | Encode `#1pa/` pads-v1; legacy decode; `npm test` green |
| **B** Activity locale | **COMPLETE** | `ActivityService` presets; `CountryScreen`; `template_locale` in `encodeUrl` |
| **C** Service layer | **COMPLETE** | `RecordService` CRUD, archive, receive children, VAT map |
| **D** Navigation | **COMPLETE** | LSK/RSK panels, shortcuts, layered `app.js` keys |
| **E** WorkpadsPanel | **COMPLETE** | Browse/record/wizard modes, COGS tiers |
| **F** Archive | **COMPLETE** | `archive.js`, management route |
| **G** Wizard financials | **COMPLETE** | Expense/COGS/payment sub-tabs |
| **H** View financial card | **COMPLETE** | `view.js` + panel summaries |
| **I** Financial screens | **COMPLETE** | `financial.js`, `finance-overview.js`, routed |
| **J** List dashboard | **PARTIAL** | `list.js` summary bar (billed/outstanding); not full 14-window `wp_dash_window` spec |
| **K** Templates | **PARTIAL** | `template-creator`, `TemplateRegistry`, NewEnt; bundled CSV library incomplete |
| **L** Store packaging | **IN PROGRESS** | Manifest v0.2 SVG icons + clipboard; **PNG** store icons + device verify pending |
| **M** Polish | **NOT STARTED** | Quota warning, backlog polish items |

**v0.2 blockers for store:** Phase **L** (PNG icons, packaged zip verify). **J** full dashboard optional for v0.2.

**Registered screens beyond original v0.1 plan (all wired):** `home`, `help`, `country`, `user-switcher`, `chain`, `dispute`, `ledger`, `liabilities`, `newent-wizard`, `template-creator`, `timeline`, `tasks`, `calendar-wp`, `note-share`.

**js/ audit (2026-05-21):** 55 files under `js/`; **53** app scripts + `browser-dev.js` in `index.html`. `template-registry.js` deferred — T-INTEG on `TemplateRegistry.js`. Shrink waves: [`dev_refs/MINIMAL-CODE-AUDIT.md`](../dev_refs/MINIMAL-CODE-AUDIT.md).

**Implementation gaps (not phases):** `changedMask` at share, `_ratifiedFrame` outbound emission, C-TRIG auto-schedule — see `IMPLEMENTATION.md`.

---

## System Docs at a Glance

Each doc owns a specific decision domain. These are not redundant — they answer different
questions. When a decision touches a doc's domain, that doc is the authority.

| Doc | Owns | Read when |
|---|---|---|
| `project-process.md` | Cross-repo process, authority, State of Total Project | **Every session (first)** |
| `FEATURES.md` | Feature register — what is shipped vs latent | Current app capability |
| `ROADMAP.md` | Versioned feature list, phase names and contents | Sprint planning; phase sequencing |
| `PRODUCTION-READINESS.md` *(root)* | Historical dotme gap analysis (partially stale) | Context only; prefer `FEATURES.md` |
| `dev_refs/PLATFORM.md` | ES5 rule, KaiOS constraints, nav model, storage limits | Any new screen, any nav change |
| `dev_refs/FRAME-SPEC.md` | pads-v1 wire format reference | Codec / share implementation |
| `CODEC-SYNC.md` | KaiOS codec sync pointer + kaios-only paths | Before/after any codec.js change |
| `DEVIATIONS.md` | Standard divergences with status | Reviewing debt; planning fixes |
| `IMPLEMENTATION.md` *(root)* | Standard ↔ app implementation map | Spec compliance review |
| `BACKLOG.md` | Unscheduled work with design intent recorded | Deciding what enters a phase |
| `OPEN-QUESTIONS.md` | OQ registry | Resolving design questions |
| `CODING-LOG.md` | Session code changelog | Continuity between coding sessions |
| `APP-BUILD-PHASE.md` | App build phase — screens inventory + A1–B8 queue | **App coding sessions (2026-05-24+)** |
| `dev_refs/archive/ECOSYSTEM.md` | Archived ecosystem notes | Historical only |

---

## External Reliances

These sit outside this repo but constrain decisions made inside it.

### 1. workpads-standard (normative)
**Path:** `../workpads-standard/`

The standard defines what is correct. Workpads KaiOS is an implementation of the standard,
not the other way around. Key standard docs and what they govern:

| Standard Doc | Governs |
|---|---|
| `codec.md` | Wire format, scheme tags, field order, compression pipeline |
| `record-schema.md` | The 11 PADS scalar fields, actions array, record invariants |
| `record-service.md` | RecordService interface — method names, signatures, return types |
| `pads-model.md` | PADS section definitions (Process/Actions/Details/Story) |
| `build-strategy.md` | Two-build target (KaiOS 2.x / 3.x), ES5 mandate, shared core |
| `basics-conformance.md` | BASICS tier claim — offline-first, local storage, event schema |
| `chain-protocol.md` | v0.3 chain_ref ACK mechanism |
| `participants-block.md` | v0.3 participants block wire format |

**When the standard and this app diverge:** register in `DEVIATIONS.md` immediately.
Do not leave divergences undocumented — silent divergence from dotme is the biggest risk.

**When kaios design advances past the standard:** add a SUI entry to `../workpads-standard/STANDARD-UPDATES.md`. This is how we track what the standard owes us — not via memory. The SUI register is the to-do list for keeping the standard current. Any kaios draft_specs/ file reaching `draft-spec` status needs a corresponding SUI entry.

### 2. BASICS Conformance
**Current claim:** BASICS Core tier (v1, settled 2026-04-27)
**Path:** `../workpads-standard/basics-conformance.md`

BASICS Core is already claimed and documented. The rules (SC-001 through SW-041) cover:
offline-first operation, local create/edit, event schema, integration endpoint (URL schema),
degraded mode definition, storage failure surfacing, secure defaults, no known CVEs.

**What this means for development:** Any new feature that adds an external call, changes
storage behaviour, or changes the URL schema must be reviewed against the BASICS rules.
The compatibility policy (`compatibility-policy.md`) is deferred to post-v0.1 — nothing
blocks current development.

### 3. Codec Ecosystem (Four-Repo Sync)
**This is the highest-risk reliance.** There is no automated sync check between kaios inline
and the npm package.

| Copy | Location | Role |
|---|---|---|
| **Normative spec** | `workpads-standard/codec.md` | Source of truth for wire format |
| **npm package** | `workpads-codec/src/codec.js` | Canonical JS for CLI and `flow.test.js` |
| **KaiOS app** | `workpadskaios/js/lib/codec.js` | Runtime UMD bundle (superset + legacy decode) |
| **CLI** | `workpads-cli` via `@workpads/codec` | Integration harness |

**Protocol:** `workpads-standard/codec-sync.md` + kaios `CODEC-SYNC.md` + `project-process.md` §8.  
**Scheme tag (current):** `#1pa/` pads-v1. DEV-WP-URL-001 **fixed** (2026-05-17). Legacy decode retained.

---

## What Has Been Done (Since Last Baseline)

*Session 2026-05-21 — hygiene + phase audit.*

- Cross-repo process: `project-process.md`, agent entrypoints (`CLAUDE.md`, `AGENTS.md`), doc reconciliation for pads-v1
- `npm test`: 685 pass (`flow.test.js` + `codec-pads-v1.test.js`)
- Phase audit: A–I complete; J/K partial; L in progress (see table above)
- `management.js` codec label: `pads-v1 (1pa/)` (confirmed)

*Session 2026-05-15 — codebase cleanup and planning.*

- `js/lib/utils.js` created; `esc()` centralised from 12 files
- `app.js` D-pad handler reorganised into 6 named layers with master control documentation
- `CountryScreen` wired with returnTo + Select/Settings tab structure
- `management.js` Settings: inline COUNTRIES dropdown replaced with CountryScreen navigation
- `NewEntTemplate.js`: speculative code trimmed (~80 lines), `registerTemplate()` fixed to
  pass merged entry+payload to TemplateRegistry.ingest(), version bumped 2→3
- `system/early-dev/` folder created with newent-development.md, dev-log.md, dpad-nav.md
- `system/BACKLOG.md` and `system/CODEC.md` created
- `system/DEEPSCAN.md` updated to 2026-05-14

*Phase A audit 2026-05-15 — codec and service layer confirmed.*

- **RecordService.js confirmed**: 263 lines, fully implemented. `create()` stamps chainRef,
  `encodeUrl()` passes all financial fields, `decodeUrl()` + `normaliseDecoded()` strip underscore
  keys, `storeReceived()` persists inline sub-records as child `wp_record_` entries.
  `restoreRecord()`, `removeRecord()`, `getArchived()`, `listArchived()` all present.
- **codec.js (2026-05-15 baseline):** pads-v1 migration in progress; **superseded 2026-05-17+** by `#1pa/` emit (see Phase A audit 2026-05-21).

*Session continued 2026-05-15 — phases D–H audited, Phase F built.*

- **Phases D/E/G/H confirmed complete** via code audit — all already implemented
- **Phase F built**: `js/screens/archive.js` (restore/delete archived records), registered in
  `app.js`, routed from management Records tab. DEV-WP-ARC-001 closed.
- **CountryScreen Settings** locale display added (Phase B task 4) — shows currency + tax rate
- **Wizard SHORTCUT_MAP** corrected — removed non-existent 'F' key entry

---

## Phase Plan

Phases are ordered by dependency. A phase must not start until its entry criteria are met.
Phase letters match ROADMAP.md and PRODUCTION-READINESS.md for cross-reference.

---

### Phase A — Codec Alignment
**Status: COMPLETE (2026-05-21 audit)**
**Governing docs:** `CODEC-SYNC.md`, `dev_refs/FRAME-SPEC.md`, `workpads-standard/codec.md`
**Deviations closed:** DEV-WP-URL-001, DEV-WP-FIN-001

- `encode()` emits **pads-v1 `#1pa/`**; legacy schemes decode-only (`1eg/`, `1dg/`, `alg=bitpad-v1`, …)
- Financial block, participants, domain IO, presentation/security tags in inline codec
- **`npm test`:** 685 pass (2026-05-21)
- Optional: manual kaios ↔ CLI share round-trip per `project-process.md` §8

---

### Phase B — Activity Locale
**Status: COMPLETE (2026-05-21 audit)**
**Governing docs:** `PLATFORM.md`, `workpads-standard/record-schema.md`

- `ActivityService`: 10 locale presets; `getLocale()` drives currency/tax on create
- `RecordService.create()` stamps currency from locale
- `encodeUrl()` passes `templateLocale`
- `CountryScreen` + management Settings show locale/currency/tax

---

### Phase C — Service Layer Verification & Gaps
**Status: COMPLETE (2026-05-15) — all gaps confirmed closed by audit**
**Governing docs:** `workpads-standard/record-service.md`, `DEVIATIONS.md`
**Deviations closed:** DEV-WP-FIN-001, DEV-WP-VAT-001, DEV-WP-SUB-001

Audit confirmed RecordService.js (263 lines) is fully implemented:
- `create()` stamps `chainRef` via `genChainRef()` and `currency` from `ActivityService.getLocale()`
- `encodeUrl()` passes `record_type`, `currency`, `vat`, `amount`, `templateLocale`, `chainRef`,
  `expenses`, `payments` to `WPCodec.encode()` — all financial fields included
- `decodeUrl()` returns `normaliseDecoded(WPCodec.decode(url))` — underscore keys promoted
- `storeReceived()` persists inline expense/payment sub-records as `wp_record_` child entries
  with `parentId`, `record_type`, `importedFromShare: true`
- `normaliseDecoded()` moves `_chainRef`, `_expenses`, `_payments`, `_participants` to clean keys
- `FinancialModel.splitChildren()` + `view.js` use `record_type || recordType` — both forms
- `restoreRecord()`, `removeRecord()`, `getArchived()`, `listArchived()` all present

VAT mapping in `wizard.js` pre-save: `'standard'` → `locale.tax_rate`, `'none'`/`'zero'` → `'0'`.

---

### Phase D — Navigation Model
**Status: COMPLETE (2026-05-15)**

Audit confirmed:
- No screen file overrides SoftLeft/SoftRight — all LSK/RSK handling is in app.js Layer 2
- All screen-level keydown listeners are scoped to specific input elements only
- Wizard SHORTCUT_MAP corrected (removed non-existent 'F' key, corrected ←/→ description)
- `country`, `note-share`, `ledger`, `newent-wizard` have no numeric shortcuts to advertise;
  their SHORTCUT_MAP entries are intentionally absent (map `*` returns early if empty array)
- Back/Backspace confirmed on all screens via onKey handlers

---

### Phase E — WorkpadsPanel Upgrade
**Status: COMPLETE (confirmed 2026-05-15)**

Audit confirmed WorkpadsPanel already has:
- Browse mode: financial aggregation via `loadBrowseAgg()` + `FinancialModel.summarize()`
- Record mode: Out/COGS/In summary with COGS resolution, outstanding, margins
- Wizard mode: warnings about unlinked COGS and missing payments
- Four-tier COGS tally fully wired — no further work needed

---

### Phase F — Archive Screen
**Status: COMPLETE (2026-05-15)**
**Deviation closed:** DEV-WP-ARC-001

- `js/screens/archive.js` created: D-pad Up/Down focus, Enter=restore, RSK=permanent delete
  (confirm dialog), Backspace=back to management. Loads via `RecordService.listArchived()`.
- Registered in `app.js`: SCREENS, SCREEN_HANDLERS, `showArchive()`, `App.showArchive`
- Management Records tab: "Archived N records [View]" row routes to archive screen
- Stale codec label in management Records tab also corrected (1eg/ + fflate)
- DEMO-001 (demo data onboarding) is now unblocked — see `BACKLOG.md`

---

### Phase G — Financial Sub-Records in Wizard
**Status: COMPLETE (confirmed 2026-05-15)**

Audit confirmed wizard already has financial step (screen 4) with:
- Three sub-tabs: Amount (screen 0), Expenses (screen 1), Payments (screen 2)
- ArrowLeft/Right switches sub-tabs; ArrowUp/Down navigates items within tabs
- Enter on focused item: edit or add via window.prompt() dialogs
- `hasFinancialStep()` gates financial step to non-PADS record types
- On `saveAndExit()`: expenses[] and payments[] passed to RecordService as child records
- Loads existing sub-records on edit via `RecordService.listChildren()`

---

### Phase H — View + Panel Financial Display
**Status: COMPLETE (confirmed 2026-05-15)**

Audit confirmed view.js `loadFinancialCard()` already renders:
- Amount, Tax, Total rows; expense items (Out); COGS items with resolution status
- Payment items (In); Outstanding balance; COGS split breakdown
- Gross margin, net margin; By Category and By Action breakdowns
- Section hidden when no financial data present

---

### Phase I — Financial Screens
**Status: COMPLETE (2026-05-21 audit)**
**Entry criteria:** Phase H ✓
**Governing docs:** `ROADMAP.md §Phase I`

Implemented and routed (`view.js` option/shortcut `4`, `WorkpadsPanel`, `list.js`):

**`js/screens/financial.js`** — per-record financial detail (standalone; deeper than view.js card):
- Full COGS resolution breakdown: linked / action-allocated / unlinked lines
- Per-action billing view: what was quoted, what was spent, variance
- Expense ledger: each item with billing type badge and linked action
- Payment ledger: dates, amounts, running outstanding
- Margin waterfall: price → tax → total → COGS → gross margin → net margin
- D-pad nav through ledger items; Enter opens item edit (delegates to LedgerScreen)
- Route: from view.js financial card section (new shortcut or CSK on fin card)

**`js/screens/finance-overview.js`** — cross-record aggregation (portfolio view):
- Aggregates across all active records (or filtered by type/date window — see Phase J)
- Totals: revenue billed, COGS, payments received, outstanding
- Gross margin %, net margin % across the set
- Per-type breakdown (quote / invoice / expense / payment totals)
- Route: from WorkpadsPanel financial button or list.js dashboard link

---

### Phase J — List Dashboard
**Status: PARTIAL (2026-05-21 audit)**
**Entry criteria:** Phase H ✓
**Governing docs:** `ROADMAP.md §Phase J`

**Done:** `list.js` `list-summary-bar` — billed + outstanding by currency; tap opens `finance-overview`.

**Not done:** Full time-window matrix below (`wp_dash_window` persistence, 14 windows). `finance-overview.js` has **All / Month / Week** only.

Add a revenue/received/margin summary block to the top of `list.js`.

**Time window selector:** The summary block must support user-selectable time windows.
Implement as a D-pad navigable dropdown (KaiOS `<select>`) or a horizontal scrollable
button row. The full set of windows to support:

| Window | Description |
|--------|-------------|
| Today | Records updated today |
| Yesterday | Records updated yesterday |
| This Week | Mon → today |
| End of Week | Mon → Fri of current week (business week view) |
| Last Week | Previous Mon–Fri |
| This Month | 1st of current month → today |
| End of Month | 1st → last day of current month (projection view) |
| Last Month | Full previous calendar month |
| Up to Date | All time, up to today |
| 3 Months | Rolling 90-day window |
| 6 Months | Rolling 180-day window |
| 18 Months | Rolling 540-day window |
| Year to Date | 1 Jan of current year → today |

Default window on first open: **This Month**.
Persist selected window in localStorage (`wp_dash_window`).

**Summary block fields:** revenue billed, payments received, outstanding, gross margin %.
Pull from `FinancialModel.summarize()` across filtered records.

---

### Phase K — Template System
**Status: PARTIAL (2026-05-21 audit)**
**Entry criteria:** Phase D ✓
**Governing docs:** `ROADMAP.md §Phase K`, `TEMPLATE-CREATOR-DESIGN.md`

**Done:** `TemplateRegistry`, `template-creator.js`, management Templates tab, `NewEntTemplate` + `newent-wizard.js`, list/management routes.

**Not done:** Bundled ~20-type library ship set; primary on-device CSV paste authoring path per roadmap.

---

### Phase L — App Store Packaging
**Status: IN PROGRESS (2026-05-21 audit)**
**Entry criteria:** Phases A–I complete; J/K partial acceptable for store candidate
**Governing docs:** `PLATFORM.md`, `DEVIATIONS.md §DEV-WP-MFT-001`

**Done:** `manifest.webmanifest` v0.2.0; SVG icons; clipboard permissions; `npm run pack` script exists.

**Remaining:** PNG icons (56/112/128) if store requires; on-device share/clipboard verify; simulator/device smoke test.

---

### Phase M — Polish
**Status: NOT STARTED**
**Entry criteria:** Phase L
**Governing docs:** `BACKLOG.md` (QUOTA-001, DEMO-001)

Tasks: storage quota warning (~80% of 5MB), demo onboarding UX (DEMO-001), close remaining polish backlog.

---

## Decision Protocol

When a decision in a session touches multiple repos or standards:

1. **Standard first**: check `workpads-standard/` for the normative answer
2. **Deviation or gap?**: log in `DEVIATIONS.md` if implementation can't match standard now
3. **Codec change?**: `workpads-standard/codec-sync.md` + kaios `CODEC-SYNC.md` + `project-process.md` §8
4. **BASICS impact?**: check `workpads-standard/basics-conformance.md` rules if adding external
   calls, changing storage behaviour, or changing the URL schema
5. **Log the decision**: one entry in `early-dev/dev-log.md` with date + what changed + why

---

## Quick-Reference: Open Deviations

| ID | Description | Status |
|---|---|---|
| DEV-WP-URL-001 | Scheme tag — legacy vs pads-v1 `#1pa/` | **fixed 2026-05-17** |
| DEV-WP-VAT-001 | VAT UI label not mapped to codec enum | **fixed 2026-05-15** |
| DEV-WP-FIN-001 | Financial fields absent from wire format | **fixed 2026-05-15** |
| DEV-WP-SUB-001 | Sub-record type field case mismatch | **fixed 2026-05-15** |
| DEV-WP-ARC-001 | No archive screen UI | **fixed 2026-05-15** |
| DEV-WP-MFT-001 | Store PNG icons (SVG + clipboard done) | **accepted** — PNG in Phase L |

---

## Version Targets

| Version | Theme | Key deliverable |
|---|---|---|
| **v0.2.0** | Production ready | Phases A–M complete; app store submission |
| **v0.3.0** | Chain protocol + participants | Bits 18–20; linked record lifecycle; multi-worker |
| **v0.4.0** | SIMBA services layer | Bits 21–23; service_ref; expiry; verification |
| **v1.0.0** | Global readiness | KaiOS 2.5; 100+ templates; regional packs; PDF/CSV export |
