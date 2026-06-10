# Agreements — re-shell checklist

**Status:** `agreements.js` deferred off device shell (audit 2026-05-21).  
**Source:** `js/lib/agreements.js` · **Tests:** `codec-pads-v1.test.js` (readFileSync — always run).

## Re-enable in `index.html`

Insert after `markers.js` (or after deferred protocol block: `trig.js` → `ctrig.js` → `agreements.js`):

```html
<script src="js/lib/agreements.js"></script>
```

## Wire call sites (agreements UI v1)

| Priority | File | API | Purpose |
|----------|------|-----|---------|
| 1 | `chain.js` | `WPAgreements.isRatified(chain)` | Ratified badge / amend rules on chain view |
| 2 | `view.js` | `isRatified` + chain summary | Options labels, lock amend when appropriate |
| 3 | `dispute.js` / `share.js` | `buildDisputeAmendmentOpts(parentUid, opts)` | Encode dispute amendments per spec |
| 4 | `view.js` / codec path | `encodeRatificationBitmap` / `decodeRatificationBitmap` | Acceptance state commits |

## Do not

- Copy `isRatified` logic into screens — single source stays `agreements.js`.
- Confuse with **presentation** `TemplateRegistry` or **My Templates** `RecordTemplateService`.

## Docs to update when done

- `JS-RUNTIME-MAP.md` — move from deferred table to loaded lib
- `FEATURES.md` — Chain and agreements → Active
- `MINIMAL-CODE-AUDIT.md` — remove from defer list

## Related shell (same release train)

- `markers.js` — already loaded (`buildRatifiedFrame` on commit)
- [`CTRIG-RESHELL.md`](CTRIG-RESHELL.md) — P3 (optional same release)
