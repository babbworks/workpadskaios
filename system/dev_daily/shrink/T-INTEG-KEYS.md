# T-INTEG — storage keys (two template systems)

**Do not merge these prefixes.** They are different products on device.

| System | Service / module | Prefix | Purpose |
|--------|------------------|--------|---------|
| **My Templates** | `RecordTemplateService.js` | `wp_rtpl_*` | Record presets (wizard prefill, Personal / Imported) |
| **Presentation templates** | `TemplateRegistry.js` | `wp_tpl_manifest`, `wp_tpl_payload_*` | HTML/CSS note share, `#t/` install |

## App code rule

- Record flows (`list.js`, `management.js`, `template-creator.js`) → **only** `RecordTemplateService`.
- Note share (`note-share.js`, `NoteCodec.js`) → **only** `TemplateRegistry`.
- `js/lib/template-registry.js` (`WPTemplateRegistry`, `wp_template_*`) — **off shell**, tests only; do not reintroduce.

## T-INTEG checklist

| Step | Status |
|------|--------|
| 1 Canonical serialise / fingerprint on `TemplateRegistry` | Done |
| 2 `#t/` install in `app.js` | Done |
| 3 My Templates UI on `RecordTemplateService` only | Done (no `WPTemplateRegistry` in screens) |
| 4 Key policy documented | This file |
| 5 Thin `template-registry.js` to test re-export | Optional |
