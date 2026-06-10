# Audit Wave 4 — Cross-cutting smells

**Date:** 2026-05-21  
**Shell scripts:** 49 (after `agreements.js`, `trig.js`, `ctrig.js` off shell)

## Duplicate `toB64` / compress

| File | Pattern | Notes |
|------|---------|-------|
| `codec.js` | `toB64` + `deflateSync` | Canonical pads-v1 path |
| `security.js` | local `toB64` + `deflateSync` | `#1ps/` / `#1ph/` wrapper |
| `TemplateRegistry.js` | local `toB64` + `deflateSync` | Presentation template blobs |
| `RecordService.js` | inline `btoa` url-safe | URL helper only |

**Verdict:** defer centralise — each path has different framing; merge only if we extract a **single** `js/lib/b64.js` (~15 LOC) and net-delete ≥30 LOC. Not this session.

## Pack / dev-only scripts

| File | In shell | Device pack |
|------|----------|-------------|
| `demo.js` | yes | exclude (`pack.js` / zip exclude) |
| `browser-dev.js` | yes | exclude |

**Verdict:** keep in shell for dev; document in pack script (already noted Wave 1).

## WP+ surfaces (not dead)

`timeline.js`, `tasks.js`, `calendar-wp.js`, `home.js` — wired from `app.js` + `home.js` shortcuts. **Do not** remove from shell.

## Zero-caller protocol libs

**Done:** `trig.js`, `ctrig.js` deferred — [`TRIG-RESHELL.md`](TRIG-RESHELL.md), [`CTRIG-RESHELL.md`](CTRIG-RESHELL.md).

## Deferred off shell (cumulative)

| File | Re-shell doc |
|------|----------------|
| `template-registry.js` | T-INTEG → `TemplateRegistry.js` |
| `roles.js`, `formula.js` | Wave 1 |
| `agreements.js` | [`AGREEMENTS-RESHELL.md`](AGREEMENTS-RESHELL.md) |
| `trig.js`, `ctrig.js` | TRIG / CTRIG reshell |

## Next stage (post Wave 0–4)

See `MINIMAL-CODE-AUDIT.md` § Post Wave 0–4 — **Wire** (P1/P2), **UI shrink** (Wave 3), or **T-INTEG**; not more lib defer.

## Next coding (ranked)

1. **P1** — `changedMask` in `share.js` / `wizard.js` (capability)
2. **P2** — `_ratifiedFrame` on outbound share
3. **Wave 3** — `utils.listRow` on `list.js` main list only
