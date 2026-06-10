# Wiring Patterns — workpadskaios
_Coding cheat sheet. Read alongside PLATFORM.md before writing any new screen._

---

## 1. App.show* — Screen Routing

All screen transitions go through `App`. Never call `ScreenName.onShow()` directly from another screen.

```javascript
App.showList()                        // no args
App.showView(record)                  // full record object
App.showWizard(record, opts)          // record=null for new; opts={} optional
App.showShare(record)
App.showLedger(opts)                  // opts: { type, parentId, wizardRecord, returnTo }
App.showArchive()
App.showManagement()
App.showCountry(returnTo)             // returnTo: 'management' | null
App.showNoteShare(capture)
App.showNewEntWizard(existingSlug)    // existingSlug=null for new
```

`App.showFinancial(record)` and `App.showFinanceOverview()` must be added when those screens are built, following the same pattern in `app.js`.

---

## 2. Screen Implementation Contract

Every screen is an IIFE exposing a global. Minimum shape:

```javascript
(function(global) {
  'use strict';

  function onShow(arg) {
    // 1. Store arg as module-level var
    // 2. Call WorkpadsPanel.setContext(...)
    // 3. Render
  }

  function onKey(key) {
    // App handles: LSK, RSK, Back (panel open/close, navigation)
    // Screen handles: ArrowUp, ArrowDown, Enter, Backspace, numeric shortcuts
    if (key === 'ArrowUp')   { /* move focus up */    return; }
    if (key === 'ArrowDown') { /* move focus down */  return; }
    if (key === 'Enter')     { /* primary action */   return; }
    if (key === 'Backspace') { goBack();              return; }
  }

  global.MyScreen = { onShow: onShow, onKey: onKey };
})(window);
```

**`onKey` must not handle LSK, RSK** — `app.js` traps those before delegating to the screen.

---

## 3. WorkpadsPanel.setContext — Required in every onShow

Call at the top of every `onShow()`. The panel re-renders immediately if open.

```javascript
// List screen — browse mode, highlight focused record
WorkpadsPanel.setContext({ screen: 'list', record: items[focusIdx] || null });

// View screen — record mode (financial breakdown of this record)
WorkpadsPanel.setContext({ screen: 'view', record: rec });

// Wizard screen — record mode; wizardScreen = current tab index
WorkpadsPanel.setContext({ screen: 'wizard', wizardScreen: currentScreen, record: currentRecord });

// Share screen
WorkpadsPanel.setContext({ screen: 'share', record: rec, url: currentUrl });

// Ledger screen — sub-record entry; record = parent job record
WorkpadsPanel.setContext({ screen: 'ledger', record: parentRecord || null });

// Management screen — no record context
WorkpadsPanel.setContext({ screen: 'management', tab: currentTab });

// Archive screen — no record context
WorkpadsPanel.setContext({ screen: 'archive' });

// Financial screen (new) — record mode; same as view
WorkpadsPanel.setContext({ screen: 'financial', record: rec });

// Finance overview screen (new) — no single record; browse-like
WorkpadsPanel.setContext({ screen: 'finance-overview' });
```

**Context shape:** `{ screen, record?, wizardScreen?, url?, tab?, formData?, planSectionIdx? }`

The panel ignores unknown fields. Only `screen` is required.

---

## 4. Panel Behaviour by Context

**Browse mode** — triggered when `screen === 'list'` or no record context:
- Scrollable record list, tabbed by type
- ArrowUp/Down scrolls; Enter opens focused record via `App.showView(rec)`
- Panel IS the primary list — list screen and panel list are the same data

**Record mode** — triggered when a `record` is present and `screen !== 'list'`:
- Header: job title + date · customer
- Financial summary: Billed / Received / Outstanding / Tax (async, via `RecordService.listChildren` + `FinancialModel.summarize`)
- Sub-record rows: up to 6 child items with type badge (EXP / COGS / PMT / INC)
- Quick-create row: `+ Exp`, `+ COGS`, `+ Pmt` buttons → `App.showLedger({ type, parentId })`
- Clicking a child row: `App.showView(childRecord)`

**Child record mode** — triggered when `record.parentId` is set:
- Shows child identity (badge + title + amount)
- Parent crumb: `↑ [parent job title]` → clicking opens parent via `App.showView(parent)`
- Date, billing type, notes for this sub-record

---

## 5. Parent / Child (Sub-Record) Relationships

Sub-records (expenses, COGS items, payments) are stored as normal records with `parentId` set.

```javascript
// Creating a sub-record
RecordService.create({
  job:         'Fuel — 45L',
  record_type: 'expense',        // 'expense' | 'payment' | 'cogs'
  expense_billing: 'customer',   // 'customer' | 'cogs' | 'running'
  amount:      '62.50',
  parentId:    parentRecord.id,
  date:        '2026-05-19',
});

// Loading children
RecordService.listChildren(parentId).then(function(children) { ... });

// Checking if a record is a child
if (rec.parentId) { /* sub-record */ }
```

**View screen behaviour with a sub-record:**
- `currentParent` is loaded via `RecordService.get(rec.parentId)`
- Backspace on a child view navigates to `App.showView(currentParent)` not `App.showList()`
- Panel shows child mode automatically (detects `rec.parentId`)

**Financial summary — always computed from children:**
```javascript
RecordService.listChildren(rec.id).then(function(children) {
  var summary = FinancialModel.summarize(rec, children);
  // summary.price, summary.paidTotal, summary.outstanding, summary.tax,
  // summary.grossMargin, summary.netMargin, summary.cogs, summary.expenses,
  // summary.payments, summary.billedExp, summary.expenseByCategory, ...
});
```

---

## 6. Two Top Bar Patterns

### Tab-bar (`wizard-progress` / `wizard-tab`)

Used when a screen has 2–5 named modes of equal weight that the user switches between.

**Examples:** Wizard (P/A/D/S/F), Management (Records/Personal/Activities/Settings), Ledger (Exp/COGS/Inc)

```html
<div class="wizard-progress" id="my-tabs">
  <span class="wizard-tab active" data-screen="0">A</span>
  <span class="wizard-tab" data-screen="1">B</span>
</div>
```

```javascript
// Switch tab
function setTab(idx) {
  var tabs = document.querySelectorAll('#my-tabs .wizard-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', i === idx);
  currentTab = idx;
  render();
}
// D-pad: ArrowLeft / ArrowRight switch tabs (screen handles these keys)
if (key === 'ArrowLeft')  { setTab(Math.max(0, currentTab - 1)); return; }
if (key === 'ArrowRight') { setTab(Math.min(tabs.length - 1, currentTab + 1)); return; }
```

### Toolbar (`view-toolbar`)

Used when a screen shows a long scrollable body and needs navigation aids: section jump, collapse toggle, search.

**Examples:** View screen, NewEnt wizard

```html
<div class="view-toolbar">
  <select id="my-sec-sel" class="view-tb-sel"></select>
  <div id="my-toggle-btn" class="view-tb-toggle"></div>
  <input id="my-search" class="view-tb-search" type="text" placeholder="Search…">
</div>
```

- **Section selector** (`view-tb-sel`): `<option>` per section; `change` event scrolls to section
- **Toggle** (`view-tb-toggle`): cycles `collapseState` 0→1→2→0; adds `.collapsed` or `.collapsed-2` class
- **Search** (`view-tb-search`): live filter; receives focus when user types alphanumeric with no other overlay open

**The toolbar does not participate in D-pad navigation.** It is mouse/numeric-key accessible only. D-pad always navigates the content below it.

---

## 7. Softkey Bar

The three softkey labels must be set whenever screen state changes.

```javascript
// Canonical helper (copy from existing screens)
function setSoftkeys(lsk, csk, rsk) {
  var l = document.getElementById('MY-lsk');  // each screen has its own softkey elements
  var c = document.getElementById('MY-csk');
  var r = document.getElementById('MY-rsk');
  if (l) l.textContent = lsk || '';
  if (c) c.textContent = csk || '';
  if (r) r.textContent = rsk || '';
}
```

**Permanent labels (app.js enforces, screens must not override):**
- LSK label = `'Info'` when panel closed, `'Close'` when panel open
- RSK label = `'Me'` when panel closed, `'Close'` when panel open

**Screen controls only CSK.** Common CSK values: `'Open'`, `'Edit'`, `'Save'`, `'Copy'`, `'Next'`, `'New'`.

---

## 8. Received Records

Records decoded from incoming URLs are stored with `importedFromLink: true` and `receivedAt` timestamp. They behave identically to created records in all screens. Sub-records within a received frame are split out by `RecordService.storeReceived()` and stored as children with `parentId` set before the view is opened.

```javascript
// In app.js — incoming URL handling
RecordService.storeReceived(decoded).then(function(stored) {
  App.showView(stored);  // stored = the parent record; children already saved
});
```

---

## 9. Adding a New Screen — Checklist

1. Add `<div id="my-screen" class="screen">` with header, content, softkeys to `index.html`
2. Create `js/screens/my-screen.js` following the IIFE contract (§2 above)
3. Add `<script src="js/screens/my-screen.js">` to `index.html` before `app.js`
4. Add entry to `SCREENS` object in `app.js`
5. Add `App.showMyScreen(arg)` function in `app.js`
6. Call `WorkpadsPanel.setContext(...)` in `onShow()` (§3 above)
7. Update shortcut map table in PLATFORM.md if numeric shortcuts change
