# Round 6 Summary — Compound Block

**Date completed:** 2026-05-18  
**Status:** Done — 323/323 tests pass (281 from Rounds 1–5, 42 new Round 6).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary output:** `js/lib/codec.js` (compound block encoder + decoder in buildFrame/parseFrame)

---

## What Was Built

Full compound block encode/decode. Gated by `sf_byte COMPOUND_VALUE=1`. Activated by `opts.compoundValue=true` + `opts.compoundLines=[...]`. `compound_header` (2B) followed by per-line entries. Each line: optional `compound_line_flags`, `line_name` (compact), `line_amount` (uint24), optional `line_qty` + `line_rate` (uint24 each).

### Block Layout

```
[compound_header byte1]   bits7-3: LINE_COUNT (1-31); bit0: LINE_FLAGS_PRESENT
[compound_header byte2]   bit7: HAS_TOTAL_SUMMARY; bit6: HAS_SUBTOTALS

Per line (LINE_COUNT times):
  [compound_line_flags]   1B — only when LINE_FLAGS_PRESENT=1
    bits7-6: LINE_TYPE    00=standard, 01=deduction, 10=employer-add, 11=summary
    bits5-4: TAX_MODE     00=n/a, 01=standard rate, 10=reduced, 11=zero/exempt
    bit3: QTY_LINE        1=qty+rate fields follow line_amount
  [line_name]             [uint8 len][UTF-8] — compact, always present
  [line_amount]           uint24 — SF and DECIMAL_POS apply
  [line_qty]              uint24 — only when QTY_LINE=1 and LINE_TYPE≠11
  [line_rate]             uint24 — only when QTY_LINE=1 and LINE_TYPE≠11
```

---

## Key Design Decisions Made

### 1. sfPresent auto-forced when compoundValue=true

`sf_byte` must be written to carry the COMPOUND_VALUE bit. When `opts.compoundValue=true`, the encoder auto-sets `sfPresent=true`. The caller does not need to also pass `sfPresent: true`.

### 2. baseTemplate auto-set to 2 (Compound financial)

When `compoundValue=true` and `hasFinancial=true` and `baseTemplate<2`, the encoder sets `baseTemplate=2` (BASE_TEMPLATE=010). Same pattern as financial auto-set to 001.

### 3. LINE_FLAGS_PRESENT computed from line content

`LINE_FLAGS_PRESENT=1` only when at least one line has a non-default `lineType`, `taxMode`, or `qty`/`rate`. When all lines have lineType=0, taxMode=0, no qty/rate → `LINE_FLAGS_PRESENT=0` and no `compound_line_flags` bytes are written. Decoder defaults: lineType=0, taxMode=0, qtyLine=false.

### 4. LINE_TYPE=11 (summary) suppresses qty/rate unconditionally

Even when `QTY_LINE=1` is set in `compound_line_flags`, a summary line (LINE_TYPE=11) has no `line_qty` or `line_rate` fields. The encoder checks `cType !== 3` before writing qty/rate; the decoder checks `dType !== 3` before reading them.

### 5. Compound block position: after qty_rate_block in fin data

The compound block follows the entire standard financial block (fin_control + customer_amount + worker_amount + tax_block + qty_rate_block) within the bit 12 data handler. The `_compound` object on the decoded record contains `{ lines, hasTotalSummary, hasSubtotals }`.

---

## Test Coverage Added (42 new tests)

- Compound sf_byte COMPOUND_VALUE=1 + auto baseTemplate=2 + setup SF_PRESENT (3 assertions)
- compound_header LINE_COUNT=3 + LINE_FLAGS_PRESENT=1 (2 assertions)
- compound_header SUMMARY_FLAGS HAS_TOTAL_SUMMARY + HAS_SUBTOTALS (2 assertions)
- compound_line_flags LINE_TYPE + TAX_MODE for line0 (2 assertions)
- QTY_LINE compound_header LINE_COUNT + clf QTY_LINE bit (2 assertions)
- 3-line invoice roundtrip: job, customer, _compound, lines.length, line0 name/amount/lineType/taxMode, line1/line2 names, customer_amount (11 assertions)
- Payroll roundtrip (4 line types): job, worker, lines.length, hasTotalSummary, hasSubtotals, all 4 lineTypes, line0 amount, line3 name (10 assertions)
- QTY_LINE roundtrip: lines.length, line0.qty, line0.rate, line1.qty absent (4 assertions)
- LINE_TYPE=11 summary: no qty, no rate, lineType=3 (3 assertions)
- 5-line compound: lines.length, last name (2 assertions)

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/codec.js` | compoundVal auto-forces sfPresent; compoundLines parsed; compound block encoder in fin bit12 handler; compound block decoder in parseFrame fin bit12 reader |
| `test/codec-pads-v1.test.js` | 42 Round 6 tests added; header updated to Rounds 1–6 |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 6 checklist all marked [x] |

---

## Open Items Carried Into Round 7

- Amendment financial amendment (fin_control + amounts re-encoded for changed fin block) — deferred from Round 5
- Amendment `line_index` byte for compound line pointer — deferred from Round 5
- Round 7: Security Wrapper (AES-CTR, field scramble, HMAC, `#1ps/` + `#1ph/` URLs)
