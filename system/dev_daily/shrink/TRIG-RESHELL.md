# TRIG — re-shell checklist (P4)

**Status:** **Done** — `trig.js` in shell; `applyTrigPresentation` + receive routing (2026-05-21).  
**Source:** `js/lib/trig.js` · **Tests:** `codec-pads-v1.test.js` (readFileSync).

## Re-enable in `index.html`

Insert after `anon.js`, before `ctrig.js` (if both ship) or before `markers.js`:

```html
<script src="js/lib/trig.js"></script>
```

Load order when multiple deferred libs return: `trig.js` → `ctrig.js` → `agreements.js` → `markers.js` (markers already in shell).

## Wire call sites (P4)

| Priority | File | API | Purpose |
|----------|------|-----|---------|
| 1 | Receive path (`app.js` / future screen) | `WPTrig.evaluate(trigBytes, ctx)` | `#1pb/` / `#1pf/` presentation routing |
| 2 | View / share display | evaluate `display_schema` TRIG block | Card vs form vs blank per fragment |
| 3 | `share.js` | already passes `trigCode` into codec encode | Outbound only — receive UX still needed |

## Do not

- Send TRIG bytecode to server — evaluation stays local (`trig.js` design).
- Confuse **display TRIG** (`WPTrig`) with **obligation C-TRIG** (`WPCtrig`) — separate evaluators.

## Docs to update when done

- `JS-RUNTIME-MAP.md` — shell lib table
- `FEATURES.md` — TRIG receive → Active
- `MINIMAL-CODE-AUDIT.md` — P4 row closed or narrowed

## Related re-shell

- [`CTRIG-RESHELL.md`](CTRIG-RESHELL.md) — P3 obligations (can ship later)
