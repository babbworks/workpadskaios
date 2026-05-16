# Workpads KaiOS — Development Plan
_Living document. Updated as phases complete and decisions shift._
_Last reviewed: 2026-05-15_

---

## Purpose of This Document

This is the cognitive anchor for ongoing development. It synthesises the system folder docs,
external reliances (BASICS, workpads-standard, codec ecosystem), and the v0.2 roadmap into
a single decision-making reference. Every planning session should start here, then go deeper
into the specific doc flagged for the current phase.

---

## System Docs at a Glance

Each doc owns a specific decision domain. These are not redundant — they answer different
questions. When a decision touches a doc's domain, that doc is the authority.

| Doc | Owns | Read when |
|---|---|---|
| `DEEPSCAN.md` | Current state of the app — what exists, what gaps | Starting any build session |
| `ROADMAP.md` | Versioned feature list, phase names and contents | Sprint planning; phase sequencing |
| `PRODUCTION-READINESS.md` *(root)* | File-level build tasks for v0.2, dotme reference map | Implementing a specific phase |
| `PLATFORM.md` | ES5 rule, KaiOS constraints, nav model, storage limits | Any new screen, any nav change |
| `CODEC-SYNC.md` | Sync protocol, checklist, three-repo obligation | Before/after any codec.js change |
| `CODEC.md` *(this session)* | Wire format reference for kaios codec.js | Implementing financial encoding |
| `DEVIATIONS.md` | Open bugs and standard divergences with status | Reviewing debt; planning fixes |
| `ECOSYSTEM.md` | Cross-repo dependency map and maturity tiers | Cross-repo decisions; sync planning |
| `VISION.md` | Product philosophy, global ambition, BASICS+SIMBA alignment | Orienting a session; resolving scope disputes |
| `BACKLOG.md` | Unscheduled work with design intent recorded | Deciding what enters a phase |
| `early-dev/dev-log.md` | Timestamped log of early-stage decisions | Session continuity; understanding why something was changed |
| `early-dev/newent-development.md` | Full NewEnt feature vision — coaching, assumptions, Schema B/P | NewEnt development sessions |
| `early-dev/dpad-nav.md` | D-pad extraction analysis, open questions | If revisiting dpad architecture |

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

### 3. Codec Ecosystem (Three-Repo Sync)
**This is the highest-risk reliance.** There is no automated sync check. Silent divergence
between the three codec copies has already happened (kaios vs dotme scheme tag mismatch).

| Copy | Location | Role |
|---|---|---|
| **Normative spec** | `workpads-standard/codec.md` | Source of truth for wire format |
| **KaiOS app** | `workpadskaios/js/lib/codec.js` | This repo |
| **dotme web app** | `workpadsdotme/js/lib/codec.js` | Full reference implementation |
| **dotme receiver** | `workpadsdotme/p/index.html` | Decode-only inline copy |
| **npm package** | `workpads-codec/src/bitpad.js` | Tooling / test harness |

**Protocol:** See `CODEC-SYNC.md` for the 6-step sync checklist. Run it for any codec change.
**Current known divergence:** DEV-WP-URL-001 (scheme tag: kaios still has legacy format in
some paths). Tracked in `DEVIATIONS.md`.

---

## What Has Been Done (Since Last Baseline)

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
- **codec.js confirmed**: `encode()` already emits `1eg/` (codebook-c-kaios, template `0x02`,
  24-bit flags). Financial block fully implemented. Legacy decode paths handle `1ag/`, `1bg/`,
  `1cg/`, `1dg/`, `alg=bitpad-v1`. Kaios can decode dotme `1dg/` URLs; dotme cannot decode
  kaios `1eg/` (intentional — extended flag space requires new decoder).
- **DEVIATIONS.md updated**: DEV-WP-URL-001, DEV-WP-FIN-001, DEV-WP-VAT-001, DEV-WP-SUB-001
  all marked fixed. DEV-WP-ARC-001 also closed the same session. Only DEV-WP-MFT-001 remains open.

*Session continued 2026-05-15 — phases D–H audited, Phase F built.*

- **Phases D/E/G/H confirmed complete** via code audit — all already implemented
- **Phase F built**: `js/screens/archive.js` (restore/delete archived records), registered in
  `app.js`, routed from management Records tab. DEV-WP-ARC-001 closed.
- **Stale codec label fixed** in management.js Records tab (now shows `1eg/ + fflate`)
- **CountryScreen Settings** locale display added (Phase B task 4) — shows currency + tax rate
- **Wizard SHORTCUT_MAP** corrected — removed non-existent 'F' key entry
- Only open deviation: DEV-WP-MFT-001 (manifest icons + permissions — Phase L)

---

## Phase Plan

Phases are ordered by dependency. A phase must not start until its entry criteria are met.
Phase letters match ROADMAP.md and PRODUCTION-READINESS.md for cross-reference.

---

### Phase A — Codec Alignment
**Status: COMPLETE (2026-05-15)**
**Governing docs:** `CODEC-SYNC.md`, `CODEC.md`, `workpads-standard/codec.md`
**Deviations closed:** DEV-WP-URL-001, DEV-WP-FIN-001

Audit confirmed codec is already in the correct state:
- `encode()` emits `1eg/` (template `0x02`, 24-bit flags, codebook-c-kaios)
- Full financial block implemented in `padsEncodeKaios()` — matches dotme's `padsEncodeC()`
  in structure (uint32 amounts, same fin_flags byte, expense/payment items)
- Legacy decode paths cover all historic formats
- Codec ecosystem note: kaios `1eg/` is a kaios-specific extension; dotme encodes to `1dg/`
  and kaios can decode `1dg/` but dotme cannot decode `1eg/` — intentional by design

Outstanding: `npm test` not yet run (no test harness in this repo). CODEC-SYNC.md 6-step
checklist should be completed when a cross-device share test is performed manually.

---

### Phase B — Activity Locale (can run parallel with A)
**Entry criteria:** None
**Governing docs:** `PLATFORM.md`, `workpads-standard/record-schema.md`

ActivityService already has 10 locale presets. Phase B wires locale into the record creation
flow and connects it to the codec's `template_locale` field (bit 17).

Tasks:
1. Confirm ActivityService.getLocale() returns full locale object (currency, tax_label, tax_rate)
2. Ensure create() in RecordService passes locale to record object
3. Wire `template_locale` into encodeUrl() opts (part of Phase A codec work)
4. CountryScreen Settings tab: add locale display (currently placeholder "v0.3")
   — bring forward the currency/tax display since locale is already in ActivityService

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
**Entry criteria:** Phase H ✓**
**Governing docs:** `ROADMAP.md §Phase I`, `workpadsdotme/js/screens/` (reference)

Two new screens:

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
- Route: from WorkpadsPanel financial button or list.js dashboard

---

### Phase J — List Dashboard
**Entry criteria:** Phase H ✓**
**Governing docs:** `ROADMAP.md §Phase J`

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
**Entry criteria:** Phase D (nav model stable), TemplateRegistry already implemented
**Governing docs:** `ROADMAP.md §Phase K`, `early-dev/newent-development.md`

TemplateRegistry is already built (Schema A/B/P). Phase K adds the bundled template library
and the CSV authoring path. Also: wire NewEnt to TemplateRegistry.render() (Schema B).

---

### Phase L — App Store Packaging
**Entry criteria:** Phases A–J complete (all features shipped)
**Governing docs:** `PLATFORM.md §Packaging`, `DEVIATIONS.md §DEV-WP-MFT-001`
**Deviation fixed:** DEV-WP-MFT-001

Tasks: icons (56/112/128px PNG), manifest update, version 0.2.0, package npm script.

---

### Phase M — Polish
**Entry criteria:** Phase L
**Governing docs:** `DEVIATIONS.md`, `BACKLOG.md`

Final cleanup: stale codec labels (DEV-WP-URL-001 cosmetic), storage quota warning, formal
close of all remaining DEV-WP-* deviations.

---

## Decision Protocol

When a decision in a session touches multiple repos or standards:

1. **Standard first**: check `workpads-standard/` for the normative answer
2. **Deviation or gap?**: log in `DEVIATIONS.md` if implementation can't match standard now
3. **Codec change?**: run `CODEC-SYNC.md` checklist — all three copies, all five files
4. **BASICS impact?**: check `workpads-standard/basics-conformance.md` rules if adding external
   calls, changing storage behaviour, or changing the URL schema
5. **Log the decision**: one entry in `early-dev/dev-log.md` with date + what changed + why

---

## Quick-Reference: Open Deviations

| ID | Description | Status |
|---|---|---|
| DEV-WP-URL-001 | Scheme tag mismatch — kaios legacy vs canonical 1eg/ | **fixed 2026-05-15** |
| DEV-WP-VAT-001 | VAT UI label not mapped to codec enum | **fixed 2026-05-15** |
| DEV-WP-FIN-001 | Financial fields absent from wire format | **fixed 2026-05-15** |
| DEV-WP-SUB-001 | Sub-record type field case mismatch | **fixed 2026-05-15** |
| DEV-WP-ARC-001 | No archive screen UI | **fixed 2026-05-15** |
| DEV-WP-MFT-001 | Manifest missing icons + clipboard permission | open — Phase L |

---

## Version Targets

| Version | Theme | Key deliverable |
|---|---|---|
| **v0.2.0** | Production ready | Phases A–M complete; app store submission |
| **v0.3.0** | Chain protocol + participants | Bits 18–20; linked record lifecycle; multi-worker |
| **v0.4.0** | SIMBA services layer | Bits 21–23; service_ref; expiry; verification |
| **v1.0.0** | Global readiness | KaiOS 2.5; 100+ templates; regional packs; PDF/CSV export |
