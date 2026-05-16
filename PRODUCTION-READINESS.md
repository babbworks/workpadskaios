# Workpads KaiOS — Production Readiness Brief
_Generated 2026-05-11. Written to inform a Claude Code planning session._

---

## Purpose

This document gives a planning agent everything it needs to bring `workpadskaios` to a shippable, app-store-ready state. It covers:

1. What the companion web app (`workpadsdotme`) now does — the feature and logic reference
2. Where the two apps diverge (intentionally and accidentally)
3. What `workpadskaios` is currently missing vs the dotme reference
4. KaiOS app store requirements
5. Recommended build order

Read `workpadsdotme/system/DEEPSCAN.md` for the full dotme architecture deep-scan (generated same day). This document references it and adds the kaios-specific context.

---

## 1. What workpadsdotme Can Do (Feature Reference)

The web app is the canonical reference implementation. All logic it has proven was developed against the same BASICS-standard and bitpad-v1 codec as kaios.

### Screens
| Screen | File | Lines | Notes |
|--------|------|-------|-------|
| list | `js/screens/list.js` | 243 | Dashboard with revenue/expenses/received/margin summary block |
| wizard | `js/screens/wizard.js` | 1691 | Full PADS + expense + COGS + payment sub-record entry |
| view | `js/screens/view.js` | 1661 | Read-only detail — financial card, inline action buttons |
| share | `js/screens/share.js` | 578 | Encode URL; share-as type; view options; includes toggles |
| management | `js/screens/management.js` | 505 | Profile, currency, payment methods, storage stats |
| archive | `js/screens/archive.js` | 221 | Archived record list with restore/delete |
| financial | `js/screens/financial.js` | 559 | Per-record financial: Basic/Advanced; expense categories; COGS split |
| finance-overview | `js/screens/finance-overview.js` | 646 | Cross-record date-filtered overview; Advanced per-job table |

### Panels
| Panel | File | Lines | Notes |
|-------|------|-------|-------|
| WorkpadsPanel | `js/panels/WorkpadsPanel.js` | 1248 | Full financial tally; four-tier COGS; profit/margin metrics |
| PersonalPanel | `js/panels/PersonalPanel.js` | 824 | Quick notes with tags and linked records |

### Services (dotme versions — superset of kaios versions)
| File | Key additions over kaios |
|------|--------------------------|
| `RecordService.js` (244 lines) | `chainRef` generation on create; `restoreRecord`; `removeRecord` (hard-delete); `getArchived`; `encodeUrl` accepts `finOpts` (expense/payment line items); `decodeUrl` persists inline sub-records as child `wp_record_` entries |

### Financial Model
The dotme app implements a four-tier COGS resolution that is the correct model for all platforms:

```
COGS priority order (WorkpadsPanel.js):
  1. linkedExpenseId — match to a customer-billed expense by direct link
  2. actionIdx       — sum all customer-billed expenses on the same action
  3. action_quoted   — manually recorded quoted amount for that action
  4. free-floating   — full COGS amount hits P&L directly
```

Self-funded COGS (overrun ≤ billed for same action) is absorbed and does not reduce profit. Only overruns appear in P&L.

```
Derived metrics:
  Revenue      = record.amount
  COGS         = sum of resolved COGS overruns only
  Expenses     = sum of customer-billed expense amounts
  Received     = sum of payment amounts
  Gross Profit = Revenue - COGS
  Margin %     = Gross Profit / Revenue × 100
```

### Record Data Model (dotme, canonical)
**Main record:**
```
id, record_type, job, customer, date, location,
start_time, end_time, meeting_time, customer_phone,
worker, participants[], actions[{title,notes}],
amount, currency, vat, charge_type, parts_flag,
worker_cost, details, story, chainRef,
draft, createdAt, updatedAt
```
**Expense sub-record:**
```
id, parentId, recordType:'expense',
job, amount, currency, date,
expense_billing: 'customer'|'cogs',
charge_type, actionIdx, action_quoted,
linkedExpenseId, createdAt, updatedAt
```
**Payment sub-record:**
```
id, parentId, recordType:'payment',
job, amount, currency, date,
createdAt, updatedAt
```

### Known dotme Bugs (do not replicate in kaios)
1. **camelCase vs snake_case in sub-record filter** — `view.js` filters `rec.recordType` (camelCase) but decoded wire records have `record_type` (snake_case). Sub-records from received workpads silently disappear from financial view. Fix: normalise on decode.
2. **VAT encoding mismatch** — wizard stores `vat: 'standard'`; codec `VAT_RATES` expects numeric strings like `'20'`. Fix: map UI values to codec enum values before encoding.
3. **Stale codec labels in share.js/management.js** — UI shows `1cg`/`1ag` but encoder produces `1dg/`. Fix: read `SCHEME_TAG` from codec at render time.
4. **Hardcoded £ in multi-record views** — `finance-overview.js` and `list.js` use literal `£`. Fix: use `wp_currency` setting or per-record currency.
5. **No History API** — back button exits the app; no hash-based navigation state.

---

## 2. Current State of workpadskaios (v0.1.0)

### Screens
| Screen | File | Lines | Status |
|--------|------|-------|--------|
| list | `js/screens/list.js` | 92 | Minimal — no financial summary block |
| wizard | `js/screens/wizard.js` | 225 | PADS only — no expense/COGS/payment entry |
| view | `js/screens/view.js` | 161 | Fields display only — no financial card |
| share | `js/screens/share.js` | 111 | URL display + copy |
| management | `js/screens/management.js` | 159 | 3 tabs: records / personal / settings |
| archive | — | — | **MISSING** |
| financial | — | — | **MISSING** |
| finance-overview | — | — | **MISSING** |

### Panels
| Panel | File | Lines | Status |
|-------|------|-------|--------|
| WorkpadsPanel | `js/panels/WorkpadsPanel.js` | 159 | Basic record list only — no financial tally |
| PersonalPanel | `js/panels/PersonalPanel.js` | 78 | Basic notes list |

### Services
| File | Lines | Gap vs dotme |
|------|-------|-------------|
| RecordService.js | 130 | No chainRef; no restoreRecord/removeRecord; no expense/payment sub-records in encodeUrl; decodeUrl does not persist inline sub-records |
| StorageAdapter.js | 94 | Same |
| ActivityService.js | 101 | Same |
| PersonalService.js | 113 | Same |
| BlockRegistry.js | 49 | Same |

### App manifest
```json
{
  "name": "Workpads",
  "icons": [],          ← EMPTY — app store will reject
  "b2g_features": {
    "type": "web",
    "permissions": {}   ← clipboard permission missing
  }
}
```

---

## 3. Feature Gap: What Needs to Be Built for kaios

### Priority 1 — Core financial model (service layer)
These are data-integrity changes that must land before any financial UI:

- **RecordService**: add `chainRef` generation on record create
- **RecordService**: add `restoreRecord(id)` and `removeRecord(id)` (hard-delete)
- **RecordService**: add `getArchived(id)`
- **RecordService**: expand `encodeUrl(rec, finOpts)` to include `amount`, `currency`, `vat`, `record_type` wire fields + optional expense/payment line items
- **RecordService**: expand `decodeUrl` to persist inline expense/payment sub-records as child `wp_record_` entries with correct `recordType` (snake_case `record_type`)

### Priority 2 — Screen additions
All three missing screens adapted for D-pad navigation (no click events):

- **archive.js** — ArrowUp/Down focus; Enter=restore; RSK=delete (confirm dialog); LSK=back
- **financial.js** — per-record financial; Basic/Advanced mode toggle via RSK; ArrowUp/Down scroll
- **finance-overview.js** — cross-record date filter; ArrowLeft/Right change preset; RSK=Advanced toggle

### Priority 3 — Existing screen upgrades
Adapt dotme's richer implementations back to D-pad:

- **wizard.js**: add expense, COGS, and payment sub-record entry steps (adapting dotme's mouse forms to D-pad flows); fix VAT value mapping to codec enum before encode
- **view.js**: add financial card (expenses, COGS, payments, outstanding); fix `recordType` vs `record_type` sub-record filter
- **WorkpadsPanel.js**: add four-tier COGS financial tally (port dotme's calculation logic — no DOM changes needed)
- **list.js**: add financial summary block (revenue/received/margin for current month)

### Priority 4 — App store requirements
- **Icons**: generate 56px, 112px, 128px PNG icons; add to `manifest.webmanifest` `icons` array
- **Permissions**: add `"clipboard-write"` (or `"clipboard"`) to `b2g_features.permissions` for Share screen copy-to-clipboard
- **Version**: set `"version": "0.2.0"` in manifest and `package.json`
- **App name**: confirm `"name"` and `"short_name"` for store listing
- **Packaged app**: KaiOS Store requires a `.zip` of the app directory. Add a `package` npm script: `zip -r workpads-kaios-v0.2.0.zip . --exclude "node_modules/*" --exclude "*.zip" --exclude ".git/*"`
- **`browser-dev.js`**: must be excluded from the packaged zip (dev-only)

### Priority 5 — Polish and reliability
- Fix stale codec labels in share.js (show actual `SCHEME_TAG` value)
- Add storage quota warning (management.js already shows usage — add a threshold alert)
- Confirm `sw.js` / offline strategy (kaios has no service worker currently — assess if needed for packaged app)

---

## 4. KaiOS-Specific Implementation Notes

### Platform constraints
- Screen: 240×320px fixed, portrait only
- Input: 5-way D-pad (Up/Down/Left/Right/Center), SoftLeft, SoftRight, Backspace/Back, numeric keys, `*`
- No touch events used (even on KaiOS 3.x touch-capable devices — D-pad is the primary interface)
- JavaScript: ES5-compatible (all `var`, IIFEs, no arrow functions, no template literals, no `const`/`let`) for KaiOS 2.x forward-compatibility
- No `fetch` — use `XMLHttpRequest` if any network calls needed
- `localStorage` available; IndexedDB available but not used currently

### Navigation model
All screens use the same pattern: `ArrowUp`/`Down` moves focus, `Enter`/CSK confirms, `SoftLeft` goes back, `SoftRight` is the contextual action. New screens must follow this pattern exactly.

For financial sub-record entry in wizard.js, the pattern should be:
- Add a new PADS step (step 4: Financials — E/C/P sub-tabs) or use an overlay/nested screen approach
- Each sub-record type (expense, COGS, payment) gets its own mini-form within the overlay
- RSK=Save sub-record, LSK=Cancel, ArrowLeft/Right switch sub-tabs

### Codec sync requirement (CRITICAL)
`workpadskaios/js/lib/codec.js` must stay in sync with:
- `workpadsdotme/js/lib/codec.js`
- `workpads-standard/codec.md` (normative spec)
- `workpads-codec/src/bitpad.js` (npm package)
See `workpadsdotme/system/SYNC.md` for the full sync checklist.

The kaios codec currently does NOT include the financial block fields (`amount`, `currency`, `vat`, `record_type`). These must be added before implementing financial screens.

---

## 5. Recommended Build Order

```
Phase A — Service layer sync (no UI)
  A1. Sync codec.js from dotme (adds financial wire fields)
  A2. Expand RecordService.js (chainRef, restore, removeRecord, finOpts encode/decode)
  A3. Run npm test — confirm codec round-trip still passes

Phase B — Archive screen (self-contained, no financial dependency)
  B1. Add archive.js screen
  B2. Add "Archive" route to app.js
  B3. Add archive list access from management.js (Records tab)

Phase C — Financial sub-records in wizard
  C1. Add expense/COGS/payment entry step to wizard.js
  C2. Fix VAT value → codec enum mapping before encode

Phase D — View + panel financial upgrade
  D1. Upgrade view.js with financial card (uses sub-records from Phase A2)
  D2. Upgrade WorkpadsPanel.js with four-tier COGS tally

Phase E — Financial screens
  E1. financial.js — per-record screen
  E2. finance-overview.js — cross-record screen
  E3. Link both from view.js (Options menu) and management.js

Phase F — List dashboard
  F1. Add revenue/received/margin summary block to list.js

Phase G — App store packaging
  G1. Generate icons (56, 112, 128px PNG)
  G2. Update manifest.webmanifest (icons, version, clipboard permission)
  G3. Bump version to 0.2.0 in package.json
  G4. Add `package` npm script for .zip creation
  G5. Confirm browser-dev.js exclusion from zip
  G6. Test packaged app in KaiOS simulator or device

Phase H — Polish
  H1. Fix codec label display in share.js
  H2. Storage quota warning in management.js
  H3. Stale codec label fixes
```

---

## 6. Files the Planning Agent Should Read

To produce implementation-level tasks, read these files in this order:

1. `workpadsdotme/system/DEEPSCAN.md` — full dotme design reference (architecture, financial logic, bug list)
2. `workpadsdotme/system/SYNC.md` — codec sync checklist
3. `workpadskaios/js/RecordService.js` — current kaios service (to diff against dotme version)
4. `workpadsdotme/js/services/RecordService.js` — dotme target (the richer version)
5. `workpadskaios/js/lib/codec.js` — current kaios codec
6. `workpadsdotme/js/lib/codec.js` — dotme codec (check if field set differs)
7. `workpadskaios/js/screens/wizard.js` — current kaios wizard (to plan expense step addition)
8. `workpadsdotme/js/screens/wizard.js` — dotme wizard (the reference to port from)
9. `workpadskaios/js/panels/WorkpadsPanel.js` — current kaios panel (simple)
10. `workpadsdotme/js/panels/WorkpadsPanel.js` — dotme panel (financial tally target)
11. `workpadskaios/manifest.webmanifest` — current manifest (icons/permissions gaps)
