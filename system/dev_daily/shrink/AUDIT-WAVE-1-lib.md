# Audit Wave 1 — `js/lib/` scorecards

**Date:** 2026-05-21  
**Shell scripts:** 51 (P3/P4: `trig.js`, `ctrig.js` re-shelled; still off: roles, formula, agreements)

## Actions taken

| File | LOC | Verdict | Action |
|------|-----|---------|--------|
| `roles.js` | 67 | defer from shell | **Removed** from `index.html` |
| `formula.js` | 64 | defer from shell | **Removed** from `index.html` |

## Scorecards — still in shell

### `codec.js` (~1646 LOC)
- **Shell:** loaded
- **Callers:** all encode/decode via `RecordService`, `share.js`, `app.js` receive
- **Verdict:** keep (core)
- **Shrink later:** port drift vs npm; kaios-only paths documented in `IMPLEMENTATION.md`

### `fflate.js` / `crypto.js` / `security.js`
- **Verdict:** keep — single DEFLATE/AES path for `#1pa/` / `#1ps/`

### `anon.js` (86 LOC)
- **Callers:** `share.js` (`validateAnonMode` when data source = anon)
- **Verdict:** keep

### `markers.js` (186 LOC)
- **Callers:** `view.js` (`buildRatifiedFrame` on state commit)
- **Verdict:** keep — P2 outbound share still pending

### `agreements.js` (81 LOC)
- **Callers:** none on device (`view.js` uses `rec._chainHasDispute` only)
- **Verdict:** **deferred off shell** — see [`AGREEMENTS-RESHELL.md`](AGREEMENTS-RESHELL.md)

### `trig.js` (200 LOC)
- **Callers:** `RecordService.applyTrigPresentation`, `app.js` receive, `view.js` banner
- **Verdict:** **in shell** (P4)

### `ctrig.js` (343 LOC)
- **Callers:** `RecordService.runCtrigSchedule` after persist
- **Verdict:** **in shell** (P3)

### `qr.js` (917 LOC)
- **Callers:** `share.js` only (`MiniQR.generate`)
- **Verdict:** keep — share QR is user-facing; replace only with smaller generator if net win

### `utils.js`, `countries.js`, `CurrencyUtil.js`, `demo.js`, `browser-dev.js`
- **demo.js:** first-run seed — exclude from device pack
- **browser-dev.js:** dev only — exclude from device pack

## On disk, not in shell

| File | Notes |
|------|--------|
| `template-registry.js` | T-INTEG → `TemplateRegistry.js` |
| `roles.js`, `formula.js` | Tests only until wizard uses `WPRoles` / template formulas |
| `agreements.js` | Tests only until agreements UI ships |

## Next wave

**Wave 2:** `RecordService` encode path audit (see `AUDIT-WAVE-2-services.md`).  
**Wave 3:** list row HTML — `list.js` vs `WorkpadsPanel.js`.
