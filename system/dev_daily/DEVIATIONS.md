# Deviations Registry — workpadskaios
_Formal record of deviations from workpads-standard. Updated as deviations are registered, fixed, or superseded._

Format: status = `open` | `fixed` | `accepted` | `superseded`

---

### DEV-WP-URL-001 — Scheme Tag Format Mismatch

**Description:** workpadskaios emits the legacy URL format `https://workpads.me/p#alg=bitpad-v1&v=1&d=<payload>`. The workpads-standard and workpadsdotme expect the canonical scheme tag format `1dg/<payload>` (or `1eg/` after codebook-c).

**Status:** fixed (2026-05-17 — supersedes 2026-05-15 partial fix)

**Fix:** `js/lib/codec.js` fully rewritten to pads-v1. `encode()` now emits `#1pa/` (FRAME-SPEC v1.0, meta bytes + field flags). Legacy decoders retained for `1eg/`, `1ag/`, `1bg/`, `1cg/`, `1dg/`, and `alg=bitpad-v1`. `share.js` and `management.js` display strings updated to reference `1pa/` codec.

**References:** `CODEC-SYNC.md`, `workpads-standard/codec.md §Scheme Tags`

---

### DEV-WP-VAT-001 — VAT Value Encoding Mismatch

**Description:** The PADS wizard stores `vat: 'standard'` (a UI label) directly on the record. The codec `VAT_RATES` enum expects numeric strings: `['0', '5', '7.5', '10', '12.5', '15', '20', '23', '25']`. The value `'standard'` has no enum index, so it falls through to the UTF-8 custom string path (vatIdx = 255) — not compact, and unrecognised by receivers.

**Status:** fixed (2026-05-15)

**Fix:** `wizard.js` pre-save logic maps UI labels to numeric strings before calling `RecordService.save()`: `'standard'` → `locale.tax_rate` (e.g. `'20'`), `'none'`/`'zero'` → `'0'`. The `'reduced'` label is not present in the current VAT UI options so no mapping needed. If a reduced-rate option is added in a future phase, the mapping must be extended.

**References:** `workpads-standard/codec.md §VAT_RATES`

---

### DEV-WP-FIN-001 — Financial Fields Absent from Wire Format

**Description:** workpadskaios v0.1 does not encode the financial block fields (`amount`, `currency`, `vat`, `record_type`) in the share URL. These fields exist in the record data model and are populated by the wizard, but `RecordService.encodeUrl()` does not include them in the wire payload.

**Status:** fixed (2026-05-15)

**Fix:** `js/lib/codec.js` codebook-c-kaios encoder (`padsEncodeKaios`) implements the full financial block (bit 12): record_type enum, currency enum, VAT enum, amount as uint32, inline expense and payment items. `RecordService.encodeUrl()` passes `record_type`, `currency`, `vat`, `amount`, `expenses`, `payments`, `chainRef`, and `templateLocale` to `WPCodec.encode()`.

**References:** `CODEC-SYNC.md §Codebook-c`, `workpads-standard/financial-block.md`

---

### DEV-WP-ARC-001 — No Archive Screen

**Description:** workpadskaios v0.1 can archive a record (via options menu in view.js), but there is no screen to list archived records, restore them, or permanently delete them. Archived records are inaccessible to the user after archiving.

**Status:** fixed (2026-05-15)

**Fix:** `js/screens/archive.js` created. Up/Down to focus, Enter=restore, RSK=permanent delete (confirm dialog), Backspace=back to management. Registered in `app.js` SCREENS + SCREEN_HANDLERS + `showArchive()` + `App.showArchive`. Routed from management Records tab via "Archived N records [View]" row. `index.html` updated with screen HTML and script tag.

**References:** `workpadsdotme/js/screens/archive.js` (reference implementation)

---

### DEV-WP-MFT-001 — Manifest Missing Icons and Permissions

**Description:** `manifest.webmanifest` has `"icons": []` (empty array) and `"b2g_features": { "type": "web", "permissions": {} }` (no permissions declared). The KaiOS Store requires icon assets at defined sizes and requires `clipboard-write` permission for apps that use the clipboard API.

**Status:** open

**Impact:** KaiOS Store submission will be rejected. Share screen clipboard copy may silently fail on some KaiOS devices without the permission declaration.

**Planned fix:** v0.2 Phase L — generate icon assets (56×56, 112×112, 128×128 PNG); add to manifest `icons` array with correct `sizes` and `type` fields; add `"clipboard-write": { "description": "Copy share URL to clipboard" }` to `b2g_features.permissions`.

**References:** KaiOS Store submission guidelines

---

### DEV-WP-SUB-001 — Sub-Record Type Field Case Mismatch

**Description:** `view.js` filters sub-records using `rec.recordType === 'expense'` (camelCase). However, records decoded from a received URL have `record_type` (snake_case) — the wire field name. Sub-records arriving via URL are silently excluded from financial display.

**Status:** fixed (2026-05-15)

**Fix:** `FinancialModel.splitChildren()` uses `c.record_type || c.recordType` (checks both forms). `view.js` display code also uses `rec.record_type || rec.recordType` where the field is read. Child records stored via `storeReceived()` use `record_type` (snake_case) consistently. Both read paths accept either form.

**References:** `workpadsdotme/system/DEEPSCAN.md §Known Weaknesses`
