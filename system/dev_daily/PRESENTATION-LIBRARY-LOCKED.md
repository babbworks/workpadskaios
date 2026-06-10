# Presentation template library (B6 / Phase K) — locked

**Status:** Done (v1 starters)  
**Not** My Templates (`RecordTemplateService` / `wp_rtpl_*`).

## Bundled starters (Schema A, type `note`)

| URI | Name | Domain |
|-----|------|--------|
| `urn:workpads:tpl:starter:stall:v1` | Market stall | trade |
| `urn:workpads:tpl:starter:farm:v1` | Farm day | agriculture |
| `urn:workpads:tpl:starter:rocket:v1` | Rocket job | trade |
| `urn:workpads:tpl:starter:relay:v1` | Relay brief | general |

Installed via `WPPresentationLibrary.ensureBundled()` on app boot and when opening Manage → **Notes** or Note share.

## UI

| Surface | Behavior |
|---------|----------|
| Manage → **Notes** (tab 6) | List starters, Install all, per-row Install/Remove (CSK/SoftRight), Enter = preview |
| Preview | Sample render; CSK → Note share with template pre-selected |
| Note share | Full note template list after `ensureBundled()` |
| `#t/` URL install | Routes to Manage → Notes after ingest |

Default note template (`TemplateRegistry.BUILTIN_URI`) remains always available.

## Code

- `js/lib/presentation-starters.js` — `WPPresentationStarters`
- `js/lib/presentation-library.js` — `WPPresentationLibrary`
- `test/presentation-library.test.js`

## QA

1. Fresh boot → Manage → Notes → 4/4 on device.
2. Note share (0 quick note) → see stall/farm/rocket/relay in template list.
3. Remove rocket → re-install → preview shows blue job card.
