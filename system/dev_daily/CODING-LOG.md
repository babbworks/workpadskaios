# Coding Log — workpadskaios
_Updated after every coding session. Start here to resume work._

---

## How to use this log

Each session appends an entry below. Every entry records:
- What was changed and in which files
- What was confirmed working
- Exact next task to pick up

Agents resuming work must read [`project-process.md`](../project-process.md) + [`DEVELOPMENT-PLAN.md`](DEVELOPMENT-PLAN.md) phase audit before touching any code.

---

## 2026-05-21 — UI roadmap + IO philosophy saved; phase flags scaffold

**Docs:** `system/dev_daily/UI-ROADMAP-IO-PHILOSOPHY.md`, `system/dev_refs/UI-INTEGRATION-MAP.md` (screen graph, cherry-pick matrix, IO-first create wireframe).

**Code:** `js/lib/ui-phase.js` + `index.html` load; `UIPhase.onBoot()` in `app.js`. All flags default **off** — legacy UI unchanged.

**Shipped R3 (initial):** `sale-tally.js`, `io-create.js`, `sale-catalogue.js`; list **Sell** + key `8`; home **Sell**; type picker Outcome/Sale; `share_pending` tag; sales filter includes `sale`.

**Next:** R5 screen lock; catalogue edit via long-press; panel Sales filter → tally.

---

## 2026-05-21 — Minimal audit Waves 0–4 complete (lib defer done)

**Off shell:** `roles.js`, `formula.js`, `agreements.js`, `trig.js`, `ctrig.js` — **49** `<script>` tags. Reshell: `shrink/*-RESHELL.md`. Shell protocol after `codec.js`: `anon.js`, `markers.js` only.

**Waves 2–4:** scorecards in `dev_daily/shrink/`. Lib defer pass finished.

**Next audit stage:** Wire track (P1 `changedMask` → P2 `_ratifiedFrame`) OR T-INTEG step 3 — see `MINIMAL-CODE-AUDIT.md` § Post Wave 0–4.

## 2026-05-21 — Tighten pass 1–4 (P1, summary, panel, T-INTEG)

1. **P1 `changedMask`** — `RecordService.encodeUrl`: `_originalSnap` diff → sparse amendment payload; `baseTemplate` 6; `parentUid` / `disputeLink` for amend + dispute.
2. **Summary bar** — `childrenByParentId()`; sync one-pass totals (no N× `listChildren`).
3. **`WorkpadsPanel` browse** — single-pass partition + child map (no N× `listChildren` in `loadBrowseAgg`).
4. **T-INTEG** — `T-INTEG-KEYS.md`; steps 3–4 marked done in `MINIMAL-CODE-AUDIT.md`.

**Also:** `list.js` filter/summary optimizations (prior entry).

**Next:** P3 C-TRIG hook or P4 TRIG receive (re-shell libs per `*-RESHELL.md`).

## 2026-05-21 — P2 ratified frame on share (`&r=`)

**`codec.js`:** `parseHashExtras`, `appendRatifiedSuffix`, decode → `_ratifiedFrameRecord`. **`RecordService.encodeUrl`:** `rec._ratifiedFrame` → `ratifiedFrameBytes`; `chain` + `chainRef` when set. **`security.js`:** `#1ps/` strip/append `&r=`.

## 2026-05-21 — P3 C-TRIG + P4 TRIG (re-shell + wire)

**Shell:** `trig.js`, `ctrig.js` back in `index.html` (51 scripts).

**P3:** `runCtrigSchedule` after create/save/update/storeReceived; `ctrigProgram` hex on record; `buildChainState` + `App.prefillRecord`. Demo: `c2_inv` program `180B400D`.

**P4:** `applyTrigPresentation` on `decodeUrl`; `#1pb/`/`#1pf/` receive; `view.js` trig banner; form TRIG mode → wizard.

---

## 2026-05-21 — Type picker ("1") aligned with My Templates

**Done:**
- Master tabs: **Record** | **My Templates** (was Template)
- My Templates filters: **All · Standard · Personal · Imported** (was Custom · Received)
- Press **1**: Enter/click start **wizard** from template; creator only when not from new-record flow
- Awaiting-import row in **Imported** filter; unified `typeItems` + keyboard focus
- Hint line under filters on new-record path

**Unchanged:** List **filter-by-type** overlay (not press-1) still uses Custom/Received for record-type filters.

---

## 2026-05-21 — My Templates: Personal / Imported / awaiting import

**Done:**
- Management tab **My Templates**; sub-tabs Personal | Imported; pending-list + Import (CSK)
- `RecordTemplateService`: `receivedAt`, `importedAt`, `receiveExternal`, `importTemplate`, list* helpers
- List picker: Personal / Imported filters; awaiting-import row → pending list
- Pinned `rtpl_*` ids launch wizard with `buildRecord`
- `template-creator`: `adoptOnSave` for review-then-import path

**Wire next:** URL/decode path → `receiveExternal()` when external record templates arrive.

---

## 2026-05-21 — Naming: record preset vs presentation template

**Done:**
- `JS-RUNTIME-MAP.md` § Two template systems; `FEATURES.md` split
- UI: Management tab **Presets**; list **Saved presets**; preset creator copy
- File headers: `TemplateRegistry.js`, `RecordTemplateService.js`, `template-creator.js`, `management.js`, `NoteCodec.js`

---

## 2026-05-21 — Wave 0: `template-registry.js` off shell (T-INTEG)

**Done:**
- Removed `js/lib/template-registry.js` from `index.html` (−1 script, −85 LOC cold start)
- `MINIMAL-CODE-AUDIT.md` — defer table, T-INTEG plan, folder policy (stay in `dev_refs/`)
- `JS-RUNTIME-MAP.md`, `FEATURES.md`, `IMPLEMENTATION.md` updated

**Next:** T-INTEG step 3–4 — template-creator fingerprint on save; `#te/` decrypt path when spec-ready.

---

## 2026-05-21 — T-INTEG: TemplateRegistry canonical + `#t/` receive

**Done:**
- `TemplateRegistry.js` — `canonicalSerialise`, `fingerprintSchema`, `installFromUrlHash`
- `app.js` — route `#t/` / `#te/` before PADS receive; success → Management templates tab
- `management.js` — `onShow({ tab })` for deep-link tab

**Not run:** full `npm test` (ask before large test rounds).

**Next:** Use `fingerprintSchema` in `template-creator` save; align EXT_TEMPLATE payload installs.

---

## 2026-05-21 — Protocol libs wired into app shell

**Done:**
- `index.html` — eight scripts after `codec.js`: `roles`, `formula`, `anon`, `trig`, `ctrig`, `agreements`, `markers`, `template-registry`
- `share.js` — `WPAnon.validateAnonMode` when data source = anon (3)
- `JS-RUNTIME-MAP.md`, `FEATURES.md`, `IMPLEMENTATION.md` — runtime gap docs updated
- `npm test` — 685 pass / 0 fail

**On device now:** `WPMarkers.buildRatifiedFrame` on state commit; `WPAnon` for anon share. Off shell: `WPTrig`, `WPCtrig`, `WPAgreements`, `WPRoles`, `WPFormula`, `WPTemplateRegistry` (tests via readFileSync).

**Next:** `changedMask` at share; outbound `_ratifiedFrame` on share; C-TRIG hook on `RecordService.put()`; full TRIG receive UX.

---

## 2026-05-21 — js/ audit + FEATURES alignment (docs)

**Done:**
- `dev_refs/JS-RUNTIME-MAP.md` — all 55 `js/` files; index.html load list; `node_modules` explained
- `FEATURES.md` — contact multi-role → Active; activity/home/contacts/template statuses corrected
- `project-process.md`, `system/README.md`, `README.md`, `DEVELOPMENT-PLAN.md` cross-links

**Finding (resolved same day):** seven protocol libs were not in `index.html` — now wired (see entry above).

---

## 2026-05-21 — Hygiene + phase audit (docs only)

**Done:**
- Phase audit table in `DEVELOPMENT-PLAN.md` (A–I complete; J/K partial; L in progress; M not started)
- `ROADMAP.md` rewritten for v0.2 phase status
- `FEATURES.md`: new § KaiOS application (v0.2.0); codec/agreement rows set to Active/Partial
- `project-process.md` §7 snapshot updated

**Confirmed:** `npm test` 685 pass; 22 screens in `app.js`; encode `#1pa/`.

**Next coding (pick one):**
1. **Phase L** — PNG icons, device smoke test, store checklist
2. **Phase J** — `wp_dash_window` + extended list time windows
3. **IMPLEMENTATION** — `changedMask` at share, `_ratifiedFrame` on outbound share

---

## Build Plan Reference

Stages agreed 2026-05-19:

| Stage | Work | Files |
|-------|------|-------|
| 1 | Wizard F tab: edit sub-records, currency field, financial frameOpts in encodeUrl | `wizard.js`, `RecordService.js` |
| 2 | Share screen: tag selection, `#1ps/` passphrase prompt | `share.js`, `app.js` |
| 3 | Financial detail screen (per-record) | new `js/screens/financial.js`, `index.html`, `app.js` |
| 4 | Finance overview + list dashboard summary bar | new `js/screens/finance-overview.js`, `list.js`, `app.js` |
| 5 | Participants display in view screen | `view.js` |
| 6 | Receive-side: passphrase decode overlay, tag routing | `app.js`, `index.html` |
| 7 | Manifest, icons, packaging | `manifest.webmanifest`, `img/`, `package.json` |

---

## Session: 2026-05-19

### Status: Stage 1 — IN PROGRESS

#### Completed this session
- system/ folder tidy: archived completed codec design docs, condensed OPEN-QUESTIONS (1,564 → 80 lines)
- Created `system/dev_refs/WIRING-PATTERNS.md` — screen wiring cheat sheet
- Created this log file

#### Stage 1 — COMPLETE ✓

Files changed:
- `js/screens/wizard.js`
- `js/screens/ledger.js`
- `js/RecordService.js`

What was done:
1. **wizard.js `renderFinAmount()`** — added currency selector (home default + 8 common overrides)
2. **wizard.js `readInputs()`** — captures `f-fin-currency`, resolves to locale default when blank
3. **wizard.js `finEnter()`** — pressing Enter on existing expense/payment now opens ledger for editing (was: delete prompt)
4. **wizard.js panel add-buttons** — `returnFinTab` passed so ledger returns to correct sub-tab
5. **wizard.js `onShow()`** — accepts `opts.finTab` to restore F sub-tab on return from ledger
6. **ledger.js** — full `editRecord` mode added: pre-populates all fields from existing record; `save()` calls `RecordService.save()` instead of `create()`; Back and Save both carry `returnFinTab` back to wizard
7. **RecordService.js `encodeUrl()`** — now builds proper `frameOpts` for pads-v1 codec: `domain`, `ioDirection`, `ioTime`, `ioEffect` from `record_type`; `taxCode` from `vat`; `decimalPos`; `currency`/`currencyCode` slots; `draft` flag; `participants`; `customerAmount`
8. **RecordService.js** — stale comment updated from "codebook-c, 1eg/" to "pads-v1, #1pa/"

Syntax-checked: all three files parse clean.

---

## Session: 2026-05-19 (continued)

### Status: Stage 2 — COMPLETE ✓

#### Stage 2 — COMPLETE ✓

Files changed:
- `js/lib/crypto.js` ← NEW
- `js/lib/security.js` — already existed; now wired into index.html
- `js/RecordService.js`
- `js/screens/share.js`
- `css/app.css`
- `index.html`

What was done:
1. **crypto.js** — pure ES5 WPCrypto implementation (SHA-256, HMAC-SHA-256, AES-128-CTR, randomBytes). All primitives tested against Node.js crypto — match confirmed.
2. **index.html** — added `crypto.js` and `security.js` script tags before `codec.js`. Load order: fflate → crypto → security → codec.
3. **RecordService.encodeUrl(rec, opts)** — extended with `opts.tag` ('1pa'/'1pb'/'1ps') and `opts.passphrase`.
4. **share.js** — full rewrite: D-pad tag picker (Plain / Public / Protected), passphrase overlay for #1ps/, encode on tag selection, copy-to-clipboard on CSK.
5. **app.css** — share tag picker + passphrase overlay CSS added.
6. **index.html softkeys** — RSK renamed "Select" for share screen.

#### Next session starts at
**Stage 3 — Financial detail screen (`js/screens/financial.js`)** — COMPLETE ✓

Files changed:
- `js/screens/financial.js` ← NEW
- `js/app.js` — added `financial` to SCREENS map, `showFinancial()`, `App.showFinancial`
- `js/screens/ledger.js` — added `financialRecord` state, `returnTo: 'financial'` routing in back + save
- `js/screens/view.js` — added key `'4'` → `App.showFinancial(currentRecord)`
- `index.html` — screen HTML + script tag added
- `css/app.css` — `.fin-section`, `.fin-row`, `.fin-nav-row`, `.fin-badge` styles

Sections rendered: Summary (amount/tax/total/outstanding), Outgoings (navigable), COGS with within/overrun/unlinked badges (navigable), Payments with running balance (navigable), Margin waterfall, COGS detail.

D-pad navigates between expense/payment rows; Enter opens item in ledger; Back returns to view.

#### Next session starts at
**Stage 4 — Finance overview + list summary bar** — COMPLETE ✓

Files changed:
- `js/screens/finance-overview.js` ← NEW
- `js/screens/list.js` — `renderSummaryBar()`, `loadSummaryBar()`, key `'9'`, `summaryCache`
- `js/app.js` — SCREENS + SCREEN_HANDLERS + `showFinanceOverview()` + shortcut maps
- `index.html` — screen HTML + script tag
- `css/app.css` — `.list-summary-bar` + `.ov-*` styles

Summary bar: appears in unfiltered list view, shows billed total + outstanding (async loaded), "Finance →" tap routes to overview.

Finance overview screen: aggregates all records via `FinancialModel.summarize()` + parallel children load. D-left/right cycles time window (All / Month / Week). Shows Summary, Payments, and By-type breakdowns with colour-coded margin rows.

Key routing: list `'9'` → overview; summary bar tap → overview; Back → list.

#### Next session starts at
**Stage 5 — Participants display in view screen** — COMPLETE ✓

Files changed:
- `js/screens/view.js` — `roleLabel()` helper, participants section in `render()`, Participants entry in sections dropdown
- `css/app.css` — `.part-row`, `.part-name`, `.part-phone`, `.part-note`, `.part-signal`

Each participant renders as a `.view-field` card: role label (+ CERT/AUTH/LEAD signal badge), name bold, phone in accent colour, note muted. Section only appears when `rec.participants.length > 0`. "Participants" added to section jump dropdown.

Test with demo record 5 (Office network cabling — has 2 participants: Site manager + Subcontractor).

#### Next session starts at
**Stage 6 — Receive-side: passphrase decode overlay + tag routing**

---

## Session: 2026-05-19 (continued)

### Status: Stage 6 — COMPLETE ✓

Files changed:
- `index.html` — `overlay-receive-pp` div added (z-index:210, above all overlays)
- `js/app.js` — overlay state vars, `openReceivePp()`, `closeReceivePp()`, `confirmReceivePp()`, `checkIncomingUrl()` rewritten, button click wiring

What was done:
1. **overlay-receive-pp** — full-screen div: title, hint, password `<input id="receive-pp-input">`, error line `<div id="receive-pp-error">`, Cancel + Open buttons
2. **app.js state** — `receivePpEl`, `receivePpInput`, `receivePpError`, `receivePpOpen=false`, `receivePpHash=''`
3. **isAnyOverlayOpen()** — includes `receivePpOpen`
4. **handleOverlayKeys()** — receivePpOpen branch (highest priority): single chars append to input, Backspace removes last, Enter=confirm, SoftLeft/SoftRight cancel
5. **openReceivePp(hash)** — stores hash, clears input/error, shows overlay, focuses input
6. **closeReceivePp()** — hides overlay, clears state, restores list screen
7. **confirmReceivePp()** — reads `receive-pp-input` value, calls `WPSecurity.secureDecode(hash, passphrase)`, on success stores record and shows view; on fail shows inline error
8. **checkIncomingUrl()** — detects pads-v1 hash shape (`/^[0-9][a-z][a-z]\//` or `alg=`); `#1ps/` and `#1ph/` → `openReceivePp(hash)`; plain tags → `RecordService.decodeUrl()` → `storeReceived()` → `showView()`
9. **Button wiring** — `rpp-cancel-btn` → `closeReceivePp()`, `rpp-open-btn` → `confirmReceivePp()`

#### Next session starts at
**Stage 7 — Manifest, icons, packaging**

---

## Session: 2026-05-19 (continued)

### Status: Stage 7 — COMPLETE ✓

Files changed:
- `manifest.webmanifest` — icons, clipboard permissions, version 0.2.0, developer, launch_path
- `img/icon-56.svg` ← NEW
- `img/icon-112.svg` ← NEW
- `package.json` — version 0.2.0, `"pack": "node scripts/pack.js"` script
- `scripts/pack.js` ← NEW
- `.gitignore` ← NEW

What was done:
1. **Icons** — SVG icons at 56×56 and 112×112: dark (#1a1a1a) rounded rect bg, accent (#00d4aa) title bar, muted lines for content rows
2. **manifest.webmanifest** — `icons[]` with both SVGs; `b2g_features.permissions`: `clipboard-read` + `clipboard-write`; `version: "0.2.0"`; `developer`; `launch_path`
3. **package.json** — bumped to 0.2.0, added `pack` script
4. **scripts/pack.js** — Node.js script; zips `index.html`, `homescreen.html`, `manifest.webmanifest`, `css/`, `js/`, `img/` → `workpads-{VERSION}.zip`; prints size. Confirmed: `workpads-0.2.0.zip` 167.3 KB
5. **.gitignore** — `node_modules/` + `*.zip`

#### All 7 stages complete ✓

| Stage | Status |
|-------|--------|
| 1 | ✓ Wizard F tab: edit sub-records, currency, frameOpts |
| 2 | ✓ Share screen: tag picker, #1ps/ passphrase overlay |
| 3 | ✓ Financial detail screen |
| 4 | ✓ Finance overview + list summary bar |
| 5 | ✓ Participants in view screen |
| 6 | ✓ Receive-side passphrase decode + tag routing |
| 7 | ✓ Manifest, icons, packaging |

---

## Session: 2026-05-19 (continued)

### Status: WP+ UI Pass — COMPLETE ✓

Files changed:
- `js/screens/home.js` ← NEW
- `js/screens/timeline.js` ← NEW
- `js/screens/tasks.js` ← NEW
- `js/screens/calendar-wp.js` ← NEW
- `index.html` — 4 new screen divs, 4 script tags
- `js/app.js` — SCREENS + SCREEN_HANDLERS extended; showHome/Timeline/Tasks/CalendarWP/launchCamera; getHomeMode/setHomeMode; boot logic reads wp_home_mode
- `js/screens/list.js` — workFilter/padsFilter/dateRange/showTypePicker opts in onShow()
- `js/screens/management.js` — WP+ home toggle in settings tab
- `css/app.css` — home, timeline, tasks, calendar-wp styles appended

What was done:
1. **home.js** — WP+ home: WORK/PADS full-width toggles; 4 sub-buttons each with SVG icons (sunrise/=>/<=/ + | ↓/↗/🔒/ +); shortcut row 1 (Timeline/Tasks/Calendar); shortcut row 2 (Log/Camera/Help); separator; D-pad zone navigation
2. **timeline.js** — Day view; time slots 06:00–22:00 at adjustable increment (15/30/60m); plots log entries per slot; prev/next day nav via left/right (in slot zone) or header arrows; increment via inc-bar; Enter → new log with date+time preset
3. **tasks.js** — Lists records with due_date; sorted overdue-first; filter by person/customer; tap to open record; D-pad up to filter input
4. **calendar-wp.js** — 3 compact rows: `[ < ] Today/This Week/This Month [ > ]`; left/right shifts scope offset; Enter on label → showList({ dateRange }); '0' resets current scope
5. **list.js onShow(opts)** — workFilter (today/future/past date filters), padsFilter (received/sent/locked), dateRange ({ start, end }), showTypePicker flag
6. **app.js launchCamera** — MozActivity pick (KaiOS) with `<input capture=camera>` fallback; opens new log with pendingAttachment
7. **management.js settings** — "Home Screen" toggle row: WP+ ↔ Classic List, persisted via localStorage wp_home_mode
8. **Boot logic** — if wp_home_mode === 'wp+' → showHome(), else → showList()

#### Next tasks:
- Log sidebar: sort options (Newest/Oldest/Activity/Type) for recent logs of selected activities
- Records list: Activity filter (A button inline in filter bar)
- Saved Templates: section in list view per activity

---
