# D-Pad Navigation Extraction — Analysis & Questions
_Should the key handler in app.js be extracted to a separate dpad.js?_

---

## The Proposal

Extract the `keydown`/`keyup` event handlers (~176 lines, app.js:262–438) to a dedicated
`js/dpad.js` (or `js/lib/dpad.js`) file for separation of concerns.

---

## Analysis: Why It's Not Straightforward

The key handler in app.js is not a standalone D-pad abstraction — it's the app's central
event dispatcher that happens to use D-pad inputs. It deeply interleaves:

- **Overlay state** (`quickNoteOpen`, `shortcutOpen`)
- **Panel objects** (`WorkpadsPanel.isOpen()`, `PersonalPanel.toggle()`)
- **Screen handlers** (delegates to `ListScreen.onKey()`, `WizardScreen.onKey()`, etc.)
- **Router state** (`currentScreen`)
- **Local functions** (`openQuickNote()`, `saveQuickNote()`, `showShortcutMap()`)
- **Helper functions** (`isFocusInInput()`, `isAnyOverlayOpen()`, `anyPanelOpen()`)
- **CSK hold timer** (`cskHoldTimer`)

Extracting this to dpad.js would require exposing all of the above through `window.App`,
creating a circular dependency if dpad.js loads before app.js, or loading dpad.js after
app.js (fragile — app.js already boots the app on load).

---

## The Circular Dependency Problem

Current load order: ... → app.js → browser-dev.js

If dpad.js is added:
- Option A: `dpad.js` before `app.js` — can't reference App internals that don't exist yet
- Option B: `dpad.js` after `app.js` — app.js still registers its own keydown listener on
  load; dpad.js would need to remove it and add its own, making it a monkey-patch
- Option C: app.js calls `DPad.init(refs)` during boot — requires passing every internal
  reference as a parameter object, which is just indirection with extra steps

None of these are clean for ES5/no-build.

---

## Better Alternative: Internal Reorganisation

Instead of extraction, reorganise app.js's key handler into named sub-functions:

```javascript
// Before: one 176-line keydown handler
document.addEventListener('keydown', function(e) { ... });

// After: three named handlers called from one entry point
function handlePanelKey(key, e) { ... }    // ~80 lines: panel navigation
function handleGlobalKey(key, e) { ... }   // ~30 lines: quickNote, shortcutMap, CSK hold
function handleScreenKey(key) { ... }      // ~20 lines: route to screen.onKey()

document.addEventListener('keydown', function(e) {
  var key = e.key;
  if (quickNoteOpen)    { handleQuickNoteKey(key, e); return; }
  if (shortcutOpen)     { closeShortcutMap(); e.preventDefault(); return; }
  if (anyPanelOpen())   { handlePanelKey(key, e); return; }
  if (!isFocusInInput()) handleGlobalKey(key, e);
  handleScreenKey(key);
});
```

This gives the organisational benefit without the dependency risk. app.js stays self-contained,
the handler becomes readable, and each sub-function can be independently tested.

**Estimated savings:** ~20 lines of indirection removed, much better readability.

---

## Questions Before Proceeding

1. **Do you want dpad.js as a strict separation** (different file, different team ownership)?
   Or is internal reorganisation sufficient for your purposes?

2. **Is there a future where dpad.js is shared** across multiple Workpads app variants
   (workpadsdotme, workpadskaios, a future React Native version)? If so, extraction
   makes more sense even with the complexity.

3. **Are there KaiOS-specific key names** that differ from standard browser keys?
   (e.g., SoftLeft/SoftRight are non-standard). If dpad.js is shared, it would need
   platform-specific key name normalization.

4. **Should shortcuts (1–9 keys) stay in app.js** or move with the handler?
   Currently `SHORTCUT_MAPS` is in app.js. If dpad.js owns key routing, it probably
   needs access to SHORTCUT_MAPS too.

---

## Recommendation

**Do not extract to dpad.js now.** Instead, do the internal reorganisation (named
sub-functions within app.js). This can be done safely in one session and gives all the
readability benefit with zero dependency risk.

Revisit dpad.js extraction if/when:
- The codebase has a proper module system (even a simple IIFE-based DI container)
- OR there's a genuine cross-platform sharing need

Flag this as `DEFERRED — internal reorganisation preferred` and close this question.
