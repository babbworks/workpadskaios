# Early Development Log
_Shared log for features currently in active early development._
_Format: `YYYY-MM-DD — [feature] description`_

---

## 2026-05-15 — [newent] Trimmed speculative code from NewEntTemplate.js

Removed from NewEntTemplate.js and moved intent here:
- `WARMUP_QUESTIONS` — 7 warmup question objects, never referenced anywhere
- `addAssumption()` — assumption tracking helper, no screen calls it
- `addDecision()` — decision logging helper, no screen calls it
- `getEntGroupStatus()` — returns filled/total counts per ENT_GROUP, no UI surface

These are documented fully in `newent-development.md` for when the coaching and tracking features are built.

## 2026-05-15 — [country] Wired CountryScreen with returnTo + tab structure

- CountryScreen now accepts `returnTo` parameter in `onShow(returnTo)`
- After selection routes back to calling screen (management or list)
- Added "Settings" tab as structural placeholder for per-country and general settings
- Removed inline COUNTRIES dropdown from management.js Settings tab
- Management Settings now shows current country name + "Change" button → CountryScreen

## 2026-05-15 — [utils] Centralised esc() to js/lib/utils.js

Created `js/lib/utils.js` loaded as first script. Removed duplicate `esc()` definitions
from all module IIFEs. ~45 lines eliminated across 12 files.

## 2026-05-15 — [dpad] D-pad extraction assessed — not advisable as standalone module

See `dpad-nav.md` for full analysis and open questions.

## 2026-05-15 — [codec-docs] Codec documentation corrected to reflect live state

Four system docs were stale — all described kaios as emitting legacy alg=bitpad-v1:
- `CODEC.md`: renamed "Known Gaps (v0.1)" → "Status (v0.2)", corrected currency enum to 0-indexed (GBP=0), corrected deflateRaw → deflateSync.
- `CODEC-SYNC.md`: updated "Three Copies" table (kaios now codebook-c-kaios 1eg/), fixed interoperability note, corrected "Codebook-c Target" → "SHIPPED in v0.2", fixed stale "Only in dotme currently; kaios gets this in v0.2" line.
- `DEVIATIONS.md`: DEV-WP-URL-001, DEV-WP-FIN-001, DEV-WP-VAT-001, DEV-WP-SUB-001 all marked fixed (2026-05-15). DEV-WP-ARC-001 added and closed same session.
- `DEVELOPMENT-PLAN.md`: "What Has Been Done" stale note corrected; phases D–H audited and marked COMPLETE; Phase I and Phase J specced; Phase J 13-window time selector table added.

## 2026-05-15 — [archive] Phase F (archive screen) built and wired

Created `js/screens/archive.js` (148 lines): D-pad browse of archived records, Enter=restore, RSK=permanent delete (confirm), Backspace=back to management. Wired in `app.js` (SCREENS, SCREEN_HANDLERS, showArchive, App.showArchive). `index.html` updated with screen HTML and script tag. management.js routes "Archived N records [View]" row to App.showArchive(). DEV-WP-ARC-001 closed.

## 2026-05-15 — [es5] Object.assign replaced with window.merge() across all files

`window.merge()` added to `js/lib/utils.js` (ES5-safe, own-property-only copy). Replaced all 13 usages of `Object.assign` across: RecordService.js (×4), ActivityService.js (×2), BlockRegistry.js (×1), wizard.js (×1), list.js (×1), NewEntTemplate.js (×5). ES5 mandate now met for this pattern.

## 2026-05-15 — [mgmt] management.js renderRecords() Promise chain flattened

Replaced 3-level nested `.then()` calls in `renderRecords()` with `Promise.all([RecordService.list(), RecordService.listArchived(), BlockRegistry.count()])`. Removes callback pyramid, makes concurrency explicit.

## 2026-05-15 — [ledger] LedgerScreen wired for returnTo/parentId; wizard financial entry rerouted

LedgerScreen (`ledger.js`) now accepts `returnTo`, `parentId`, and `wizardRecord` in opts. After save: routes to `App.showWizard(wizardRecord, { startScreen: 4 })` when `returnTo === 'wizard'`, else `App.showList()`. Backspace follows the same routing. `alert()` calls replaced with inline `errorMsg` rendered above the amount field.

Wizard (`wizard.js`) financial tab refactored: removed local `expenses[]` / `payments[]` arrays and all `window.prompt()` financial entry functions (`promptAddExpense`, `promptAddCogs`, `promptAddPayment`, `promptChargeType`, `promptActionIdx`, `editExpense`, `editPayment`). Replaced with `cachedChildren[]` populated from `RecordService.listChildren()`. Add buttons now route to `App.showLedger({ type, parentId, wizardRecord, returnTo: 'wizard' })`. Delete in `finEnter()` uses `confirm()` + `RecordService.archive()` + `reloadChildren()`. `saveAndExit()` simplified — child records are already in DB via LedgerScreen, no local for-loops needed.

`app.js` `showWizard(record, opts)` updated to pass opts through to `WizardScreen.onShow(record, opts)`. `onShow(record, opts)` now accepts `opts.startScreen` to land on financial tab (screen 4) when returning from LedgerScreen.
