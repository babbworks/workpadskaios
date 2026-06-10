# C-TRIG — re-shell checklist (P3)

**Status:** **Done** — `ctrig.js` in shell; `RecordService.runCtrigSchedule` wired (2026-05-21).  
**Source:** `js/lib/ctrig.js` · **Tests:** `codec-pads-v1.test.js` (readFileSync).

## Re-enable in `index.html`

Insert after `anon.js`, before `markers.js`:

```html
<script src="js/lib/ctrig.js"></script>
```

## Wire call sites (P3)

| Priority | File | API | Purpose |
|----------|------|-----|---------|
| 1 | `RecordService.js` | `WPCtrig.evaluate(program, context)` on `put()` | Auto-fire obligations after record save |
| 2 | `app.js` | `App.prefillRecord` (already exists) | Route triggered wizard from evaluator result |
| 3 | `wizard.js` | consume prefill payload | Obligation-driven form open |

## Context object (evaluator)

Pass record snapshot, contact UIDs, dates — see `CTRIG-EVALUATOR-DESIGN.md`. Do not duplicate evaluator logic in screens.

## Docs to update when done

- `JS-RUNTIME-MAP.md` — shell lib table
- `FEATURES.md` — C-TRIG → Active
- `MINIMAL-CODE-AUDIT.md` — P3 row closed or narrowed

## Related re-shell (same release train optional)

- [`TRIG-RESHELL.md`](TRIG-RESHELL.md) — P4 display/receive (independent)
- [`AGREEMENTS-RESHELL.md`](AGREEMENTS-RESHELL.md) — dispute/ratification UI
