# Platform Guide — workpadskaios
_KaiOS constraints and confirmed design principles. Read before writing any new screen, modifying navigation, or onboarding a contributor._

---

## Hardware

| Property | Value |
|----------|-------|
| Screen | 240×320px fixed, portrait only, 1x pixel density |
| Input | 5-way D-pad (Up / Down / Left / Right / Center/CSK), SoftLeft (LSK), SoftRight (RSK), Backspace/Back, numeric keys 0–9, `*`, `#` |
| Touch | Not used — D-pad is the primary interface even on KaiOS 3.x touch-capable devices |
| Network | Feature phone — intermittent; app must work entirely offline |
| Storage | localStorage ~5MB per origin; no IndexedDB in use; no external fetch |

---

## Navigation Model (v0.2+)

This is the confirmed navigation architecture for all future development. **Do not deviate.**

```
Key         Action
─────────── ─────────────────────────────────────────────────────────
LSK         Open / close WorkpadsPanel — ALWAYS, every screen
RSK         Open / close PersonalPanel — ALWAYS, every screen
Back        Go back / close panel / cancel — ALL "go back" actions
CSK/Enter   Primary action for the active screen (Open / Edit / Save / Copy)
ArrowUp     Move focus up within active screen or open panel
ArrowDown   Move focus down within active screen or open panel
ArrowLeft   Unused at app level (v0.2+)
ArrowRight  Unused at app level (v0.2+)
1–9 keys    Context-sensitive shortcut map (varies by screen)
* key       Show current shortcut map / open Quick Note (when map not shown)
0 key       Quick Note (always)
```

**Before v0.2:** LSK/RSK were contextual screen actions; panels were on ArrowLeft/ArrowRight. All new code must follow the v0.2 model.

### Screen Implementation Contract

Every screen module must expose an `onKey(key)` handler following this pattern:

```javascript
function onKey(key) {
  // LSK, RSK, Back are handled by App (panel + navigation)
  // Screen only handles: ArrowUp, ArrowDown, Enter, numeric keys, *
  if (key === 'ArrowUp')    { moveFocusUp(); return; }
  if (key === 'ArrowDown')  { moveFocusDown(); return; }
  if (key === 'Enter')      { primaryAction(); return; }
  if (key === 'Backspace')  { goBack(); return; }  // fallback if App doesn't catch it
  // numeric shortcuts
  var shortcuts = getScreenShortcuts();
  if (shortcuts[key]) { shortcuts[key](); return; }
}
```

### WorkpadsPanel Two Modes

The WorkpadsPanel (LSK) transforms based on context:

**Browse mode** — when list screen is active or no record is open:
- Full scrollable record list, tabbed by type: Jobs | Quotes | Invoices
- ArrowUp/Down scrolls; Enter opens the focused record in the main area
- The panel IS the record list — it's the primary navigation surface

**Record mode** — when a record is open in view/wizard/share:
- Panel transforms entirely to a data breakdown for the active record
- v0.2: financial metrics (COGS, expenses, payments, profit/margin, four-tier COGS)
- Future: template-specific metrics (delivery note → item count; inspection → pass/fail tally; timesheet → hours)
- ArrowUp/Down scrolls the breakdown; no record navigation in this mode

### 9-Key Shortcut Map

Each screen defines a numeric shortcut map. Common assignments (final map TBD in Phase D):

| Key | List screen | View screen | Wizard screen |
|-----|------------|-------------|---------------|
| 1 | New record | Edit record | — |
| 2 | Finance overview | Share record | — |
| 3 | Archive list | Archive record | — |
| 4 | — | Financial screen | — |
| 5 | Management | — | — |
| 0 | Quick note | Quick note | Quick note |

`*` key shows the current screen's shortcut card overlay.

---

## JavaScript Rules

All code in workpadskaios must be **ES5-compatible** for KaiOS 2.x forward-compatibility.

| Rule | Why |
|------|-----|
| `var` only — no `const` or `let` | KaiOS 2.x Gecko does not support block scoping |
| No arrow functions `() => {}` | Not supported in KaiOS 2.x |
| No template literals `` `${x}` `` | Not supported in KaiOS 2.x |
| No destructuring `const { a } = obj` | Not supported in KaiOS 2.x |
| No spread `...args` | Not supported in KaiOS 2.x |
| IIFEs for module scoping | `(function(global) { ... })(window)` |
| Globals via `window.ServiceName` | No import/export — script tag load order matters |

---

## No Build Step

The app is a single `index.html` loading `<script>` tags in dependency order. There is no bundler, no transpiler, no npm build step for the app itself.

**Script load order (index.html):**
```
fflate.js → codec.js → StorageAdapter.js → ActivityService.js → 
RecordService.js → PersonalService.js → BlockRegistry.js →
[screens] → [panels] → app.js
```

`app.js` must load last — it boots the app and expects all globals to be defined.

`browser-dev.js` is included in development only and must be excluded from device builds and the packaged `.zip`.

---

## Storage

| Rule | |
|------|-|
| All data in `localStorage` | No IndexedDB, no fetch, no external calls |
| All keys prefix-scoped | Via `StorageAdapter(prefix)` — never write raw keys |
| All StorageAdapter calls return Promises | Even though localStorage is synchronous — consistency for future async migration |
| Storage quota ~5MB | Management screen shows usage; add warning threshold at ~80% in v0.2 |

---

## App Store Packaging (v0.2)

KaiOS Store requires a packaged app as a `.zip` file:

```bash
zip -r workpads-kaios-v0.2.0.zip . \
  --exclude "node_modules/*" \
  --exclude "browser-dev.js" \
  --exclude ".git/*" \
  --exclude "*.zip" \
  --exclude "system/*"
```

`manifest.webmanifest` must include:

```json
{
  "name": "Workpads",
  "version": "0.2.0",
  "icons": [
    { "src": "img/icon-56.png",  "sizes": "56x56",   "type": "image/png" },
    { "src": "img/icon-112.png", "sizes": "112x112",  "type": "image/png" },
    { "src": "img/icon-128.png", "sizes": "128x128",  "type": "image/png" }
  ],
  "b2g_features": {
    "type": "web",
    "permissions": {
      "clipboard-write": { "description": "Copy share URL to clipboard" }
    }
  }
}
```

---

## Testing

```bash
npm install          # installs @workpads/codec (local file dep)
npm test             # Node.js codec round-trip tests (test/flow.test.js)
npm start            # serves app at localhost:3000 for browser testing
```

For D-pad testing on desktop: open `index.html` in Firefox. `browser-dev.js` provides on-screen D-pad buttons and maps keyboard arrow keys. This file must not be present in device builds.
