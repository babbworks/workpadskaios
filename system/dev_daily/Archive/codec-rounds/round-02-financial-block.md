# Round 2 Summary — Financial Block: amounts, tax, scaling, I>O states

**Date completed:** 2026-05-18  
**Status:** Done — 142/142 tests pass (86 Round 1 + 56 Round 2).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary output:** `js/lib/codec.js` (financial context + financial block encode/decode)

---

## What Was Built

Full financial encoding and decoding for DOMAIN=01 (simple I>O mode). The encoder writes the financial context bytes (setup_byte, currency_ext, sf_byte, transaction_byte) into the frame header after meta2, and the financial block (fin_control, customer_amount, worker_amount, tax_block, qty_rate_block) at bit 12 in the data section. Profiles B, C, and D (minus participants) are fully encodable.

### Scope

| In scope | Out of scope (deferred) |
|----------|------------------------|
| setup_byte all fields | DOMAIN=10 (standard BitLedger) — Round 3 |
| currency_ext byte (CURRENCY=11) | DOMAIN=11 hybrid — Round 3 |
| sf_byte all fields | COMPOUND_VALUE flag — Round 6 |
| transaction_byte DOMAIN=01 all 8 I>O states | QTY_TIME encoding (hours+minutes 2-byte) — Round 8 |
| fin_control DOMAIN=01 full encode/decode | fin_control DOMAIN=10 — Round 3 |
| PARITY calculation + decode integrity checks | 0xFF currency_ext guard — deferred |
| customer_amount uint24 (simple total) | Non-zero SPLIT_POINT exhaustive tests — deferred |
| Packed QTY_COMPACT qty+rate (SP=0) decode | ROUNDING=01 encoder guard — Round 8 |
| worker_amount uint24 | Profile D participants — Round 4 |
| tax_block (TAX_CODE=01/10) | |
| qty_rate_block (QTY_SPLIT=1, QTY_COMPACT=0) | |
| BASE_TEMPLATE auto-set to 001 (Financial) | |
| EXPENSE_CAT=00 + O-direction → BILLED forced | |
| amountToU24 / u24ToAmount helpers (SF_MULTIPLIERS) | |

---

## Key Design Decisions Made

### 1. hasCustAmt detection for QTY_COMPACT mode

When `qtyCompact=true` and `qtySplit=true`, the caller provides `opts.qty` + `opts.rate` but NOT `opts.customerAmount`. The encoder must still write the CUSTOMER_AMT=1 flag and the packed uint24.

**Fix:** `hasCustAmt` extended to detect this case:
```javascript
var hasCustAmt = (opts.customerAmount != null && opts.customerAmount !== '') ||
                 (qtyCompact && qtySplit && opts.qty != null);
```

Without this fix, Profile C produced fin_control=0x30 (CUST=0) and no customer_amount byte, giving 33B instead of 36B.

### 2. Packed QTY_COMPACT decoder — qty is raw count, rate uses DECIMAL_POS

In the packed uint24: `rate = uint24 >> SP`, `qty = uint24 & mask`. The rate is in the same scale as monetary amounts (DECIMAL_POS applies). The qty is a raw integer count (no DECIMAL_POS scaling). So:
```javascript
record.qty  = String(qtyU);                          // raw count e.g. "3"
record.rate = u24ToAmount(rateU, finDp, finSf);      // monetary e.g. "52.50"
record.customer_amount = ((rateU * qtyU * sfMul) / Math.pow(10, dp)).toFixed(dp);
```

This correctly produces qty="3", rate="52.50", customer_amount="157.50" for 3 × £52.50.

### 3. EXPENSE_CAT=00 forces BILLED=1 on O-direction records

Business rule implemented in encoder only (decoder just reads the wire value):
```javascript
if (hasFinancial && expenseCat === 0 && ioDirection === 1) billed = true;
```

For income-side records (direction=0), BILLED remains whatever the caller set — an invoice can have BILLED=0 in the sense that it's a job charge that may or may not be confirmed billed.

### 4. Financial context vars declared before the `if (domain > 0)` block

In `parseFrame`, variables `finDp`, `finTax`, `finSf`, `finQtyC`, `finQtyS`, `finSp` are declared with defaults before the `if (domain > 0)` block. This ensures they're in scope in the FIELDS data blocks loop (where the financial block decoder reads them at bit 12). JS `var` is function-scoped, so this is the correct pattern.

### 5. Profile C actual byte count is 36B not 37B

FRAME-SPEC §4 Profile C shows "Total raw = 37B" but the listed components sum to 36B:
`1+1+1+1+1+2+13+10+2+1+3 = 36B`

The spec arithmetic error is the same class as the Profile A error (off by 1). The implementation produces 36B. FRAME-SPEC will need a SUI update for Profile C (parallel to the Profile A fix in v1.0.1).

CODEC-WORKPLAN Profile C entry updated to 36B with note.

---

## Frame Layout Verified

### Profile B — 36 bytes raw
```
byte 0:    0x88         meta1: META2_PRESENT=1, BASE=001/Financial
byte 1:    0x44         meta2: COMPACT_TIME=1, DOMAIN=01 (bits3-2=01 → 0x04)
byte 2:    0x40         setup_byte: DECIMAL_POS=010/2, CURRENCY=00, TAX=00, SF=0
byte 3:    0x00         transaction_byte: I<I settled, sub=00, no QTY, exact
bytes 4-5: 0x10 0x07   field_flags: bits 0,1,2,12 = job+customer+date+financial
bytes 6-20: "Boiler repair" (13 chars) with 2B length prefix
bytes 21-29: "J.Smith" (7 chars) with 2B length prefix
bytes 30-31: uint16 date (days since 2000-01-01)
byte 32:   0x12         fin_control: BILLED=0, QTY_TYPE=0, PARITY=1, EC=00, CUST=1, WORK=0
bytes 33-35: uint24 = 12550 (£125.50 at D=2)
```
Total: 36 bytes ✓

### Profile C — 36 bytes raw
```
byte 0:    0x88         meta1 (same as B)
byte 1:    0x44         meta2 (same as B)
byte 2:    0x41         setup_byte: DECIMAL_POS=2, CURRENCY=00, TAX=00, SF_PRESENT=1
byte 3:    0x08         sf_byte: SF=000/×1, COMPOUND=0, QTY_COMPACT=1, SPLIT_POINT=0
byte 4:    0x44         transaction_byte: I>I future (TIME=1), QTY_SPLIT=1
bytes 5-6: 0x10 0x07   field_flags
bytes 7-19: "Roof repair" (11 chars) with 2B length prefix
bytes 20-29: "T Wilson" (8 chars) with 2B length prefix
bytes 30-31: uint16 date
byte 32:   0x22         fin_control: QTY_TYPE=1/time, PARITY=0, EC=00, CUST=1, WORK=0
bytes 33-35: uint24 = 0x148203 (rate=5250 in upper 16 bits, qty=3 in lower 8)
             Unpacked: rate=5250 → £52.50, qty=3, total=£157.50
```
Total: 36 bytes ✓

---

## Bugs Found and Fixed

### Bug 1: hasCustAmt false for QTY_COMPACT mode
**Symptom:** Profile C produced 33B instead of 36B; fin_control=0x30 (CUST=0) instead of 0x22 (CUST=1).  
**Cause:** `hasCustAmt` only checked `opts.customerAmount`, which is not set in QTY_COMPACT mode (qty+rate provided separately).  
**Fix:** Extended hasCustAmt to also be true when `qtyCompact && qtySplit && opts.qty != null`.

---

## Test Coverage Added (56 new tests)

- Profile B exact byte layout (9 assertions including all header bytes + fin_control + amount)
- Profile B decode roundtrip (8 assertions including _fin fields)
- Profile C exact byte layout (7 assertions including packed customer_amount = 0x148203)
- Profile C decode roundtrip (6 assertions including unpacked qty, rate, customer_amount)
- I>O transaction byte values: 6 common records from spec §3 table
- EXPENSE_CAT=00 + O-direction forces BILLED (1 assertion)
- fin_control parity integrity: encode + decode (4 assertions)
- tax_block encode/decode: TAX_CODE=01, taxRate=200 (3 assertions)
- qty_rate_block: QTY_COMPACT=0, QTY_SPLIT=1, separate qty+rate (3 assertions)
- BASE_TEMPLATE auto-set to 001 when domain>0 (1 assertion)
- currency_ext: CURRENCY=11, setup=0x58, currency_ext byte present, tx byte in right position (3 assertions)
- amountToU24: 4 cases including SF=×10 (4 assertions)

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/codec.js` | Financial opts extraction, financial context write, financial block write, financial context decode, financial block decode, QTY_COMPACT decoder |
| `test/codec-pads-v1.test.js` | 56 Round 2 tests added |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 2 checklist marked; Profile B/C meta2 hex corrected (0x42→0x44); Profile C byte count corrected to 36B |

---

## Spec Discrepancies Found

### Profile C byte count: 37B → 36B
FRAME-SPEC §4 Profile C lists `Total = 37B` but the arithmetic `1+1+1+1+1+2+13+10+2+1+3 = 36B`. Same class of error as the Profile A 32B→33B issue corrected in v1.0.1. To be corrected in next SUI update.

---

## Open Items Carried Into Round 3

- DOMAIN=10 (standard BitLedger Account Pair): transaction_byte layout differs; fin_control bit 6=1
- DOMAIN=11 hybrid: adds account_pair_byte after transaction_byte
- 0xFF currency_ext guard (encoder rejection)
- ROUNDING=01 encoder guard
- Non-zero SPLIT_POINT exhaustive tests (SP=1 through SP=7)
- QTY_TIME encoding (hours + minutes_index × 5) — Round 8
- Profile C FRAME-SPEC arithmetic error — note for SUI update
- Profile D (76B with participants) — Round 4
