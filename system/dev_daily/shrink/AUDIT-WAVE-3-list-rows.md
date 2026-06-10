# Audit Wave 3 — List row HTML (analysis)

**Date:** 2026-05-21  
**Verdict:** `listRow` HTML helper deferred (net LOC ≈ flat). **Done:** main-list hot-path efficiency in `list.js` — single-pass `filterMainRecords`, reuse one `RecordService.list()` for summary bar, skip summary re-fetch when `summaryCache` warm.

## Files

| File | LOC | `.list-item` / row builders |
|------|-----|-----------------------------|
| `list.js` | ~1750 | ~20 — main PADS list, contacts, pickers |
| `WorkpadsPanel.js` | ~2170 | browse/record child rows, contact panel |
| `archive.js` | ~145 | reuses `.list-item` |
| `ledger.js` | ~11 | ledger pick lists |

## Pattern (repeated)

Each builds HTML like:

```html
<div class="list-item[ focused]" data-*="…">
  <div class="list-item-title">…</div>
  <div class="list-item-sub">…</div>
</div>
```

Variants: `type-picker-row`, `act-item` (management/templates) — same family.

## Shrink options (ranked)

1. **One `rowHtml(opts)` in `utils.js`** — only if all call sites share ≥80% shape; estimate saves 40–80 LOC net after helper.
2. **Do not split `list.js` / `WorkpadsPanel.js`** — file split increases shell count without byte win on device.
3. **Hot path first** — `list.js` `render()` main list only (scroll perf).

## Related UI debt

- `type-picker-row` vs `list-item` — could share CSS class only (no JS merge required).
- Contact browser in `list.js` duplicates filter chip pattern from `WorkpadsPanel` activity pills.

## Recommendation

Next coding session: prototype `utils.listRow(title, sub, opts)` and migrate **list.js main list only**; measure LOC before touching `WorkpadsPanel.js`.
