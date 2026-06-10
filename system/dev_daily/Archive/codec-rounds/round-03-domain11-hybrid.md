# Round 3 Summary — DOMAIN=11 Hybrid Mode + DOMAIN=10 Standard Mode

**Date completed:** 2026-05-18  
**Status:** Done — 184/184 tests pass (142 from Rounds 1+2, 42 new Round 3).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary output:** `js/lib/codec.js` (DOMAIN=10 and DOMAIN=11 transaction_byte + account_pair_byte)

---

## What Was Built

DOMAIN=11 (hybrid) and DOMAIN=10 (standard BitLedger) support. DOMAIN=11 adds a single `account_pair_byte` after the transaction_byte, carrying the BitLedger Account Pair classification alongside the existing I>O transaction state. DOMAIN=10 uses a different transaction_byte layout (AP bits instead of I>O state) and a different fin_control layout (bit6=1 mode indicator, AP in bits 5-2).

### Scope

| In scope | Out of scope (deferred) |
|----------|------------------------|
| DOMAIN=11 account_pair_byte encode + decode | AP codes 1110/1111 (special — no wizard use case) |
| All 14 active AP codes (0000–1101) | Entry Type Matching Table helper (app layer) |
| AP_EXTENSION=1 decoder skip | App-assisted inference table §17.4 (wizard.js) |
| DOMAIN=10 transaction_byte layout | Reconciliation rules §17.6 (UI layer) |
| DOMAIN=10 fin_control (bit6=1, AP in bits 5-2) | |
| Domain dispatch from meta2 bits before tx_byte parse | |

---

## Key Design Decisions Made

### 1. Single decoder dispatches all domains from meta2 bits

The decoder reads meta2 bits 3-2 (`domain`) before parsing any financial context bytes. This means:
- DOMAIN=01: I>O transaction_byte, no account_pair_byte
- DOMAIN=10: AP transaction_byte layout (ACCOUNT_PAIR in bits 7-4, etc.), no account_pair_byte
- DOMAIN=11: I>O transaction_byte (identical to 01) + account_pair_byte

No separate "DOMAIN=01 only" decoder exists — the single decoder handles all cases cleanly. The FRAME-SPEC forward-compat concern ("DOMAIN=01 decoders must skip unknown bytes after transaction_byte") applies to OTHER codecs/implementations that only handle DOMAIN=01. Our codec correctly handles all three domains.

### 2. DOMAIN=10 and DOMAIN=11 share fin_control amount fields but differ in structure

Both DOMAIN=10 and DOMAIN=11 write the same customer_amount, worker_amount, tax_block, and qty_rate_block structure. Only fin_control itself differs:
- DOMAIN=01/11: bit6=0 (mode), PARITY bit, EXPENSE_CAT in bits 3-2, QTY_TYPE in bit5
- DOMAIN=10: bit6=1 (mode), ACCOUNT_PAIR in bits 5-2, no PARITY, no EXPENSE_CAT

The integrity check routes on `domain === 2` vs `else` in the decoder.

### 3. DOMAIN=11 account_pair_byte AP_EXTENSION graceful skip

If AP_EXTENSION=1 (post-MVP), the decoder skips one additional byte:
```javascript
if (apExt && pos < bytes.length) pos++;
```

Tested manually by injecting a modified frame with AP_EXTENSION=1 + dummy 0xFF byte. The decoder skips it and continues to decode customer_amount correctly.

### 4. compactTime defaults to true — tests using raw meta2 assertions must pass `compactTime: false`

When no date fields are present and `domain > 0`, meta2 is still written (because `needMeta2 = domain > 0`). In that case, the COMPACT_TIME bit (bit 6) is set by default because `opts.compactTime !== false = true`. Tests checking specific meta2 hex values for DOMAIN bits only (no COMPACT_TIME) must pass `compactTime: false` to suppress the COMPACT_TIME bit.

This is correct behaviour: a decoder seeing COMPACT_TIME=1 in meta2 with no date/time flags set simply has no binary dates to interpret — the bit is harmless.

---

## Frame Layout Verified

### DOMAIN=11 frame (Hybrid) — header section
```
byte 0: 0x88  meta1: BASE=001/Financial, META2_PRESENT=1
byte 1: 0x0C  meta2: COMPACT_TIME=0, DOMAIN=11 (bits3-2=11 = 0x0C)
byte 2: 0x40  setup_byte: DECIMAL_POS=2, CURRENCY=00, TAX=00, SF=0
byte 3: 0x40  transaction_byte: I>I future (DIR=0, TIME=1, EFF=0, sub=00, QTY=0, RND=00)
byte 4: 0x54  account_pair_byte: AP=0101(5/Op Inc/Liab), DIR=0, STATUS=1, COMPL=0, EXT=0
              = (5<<4)|(0<<3)|(1<<2)|(0<<1)|0 = 0x50|0x04 = 0x54
```

### DOMAIN=10 transaction_byte examples
| AP Code | AP_DIR | AP_STATUS | tx byte |
|---------|--------|-----------|---------|
| 0000 (Op Exp/Asset) | 0 | 0 | 0x00 |
| 0100 (Op Inc/Asset) | 0 | 0 | 0x40 |
| 0101 (Op Inc/Liab)  | 0 | 1 | 0x54 |
| 0001 (Op Exp/Liab)  | 0 | 0 | 0x10 |

### DOMAIN=10 fin_control
```
bit 7: BILLED
bit 6: 1  (mode indicator — must be 1, decoder integrity check)
bits 5-2: ACCOUNT_PAIR (4 bits)
bit 1: CUSTOMER_AMT
bit 0: WORKER_AMT
```
Example: billed=0, AP=0100(4), CUST=1, WORK=0:
`(0<<7) | 0x40 | (4<<2) | (1<<1) | 0 = 0x40 | 0x10 | 0x02 = 0x52`

---

## Test Coverage Added (42 new tests)

- DOMAIN=11 account_pair_byte: exact byte position and value (5 assertions)
- DOMAIN=11 roundtrip: all _ap fields decoded (10 assertions)
- All 14 active AP codes roundtrip (14 assertions — loop)
- AP_EXTENSION=1 skip: modified frame, no crash, amounts still decode (2 assertions)
- DOMAIN=10 encode/decode: meta2, setup, tx layout, roundtrip (9 assertions)
- DOMAIN=10 fin_control: bit6=1 integrity check, AP code in bits 5-2 (2 assertions)

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/codec.js` | DOMAIN=10/11 opts extraction, conditional transaction_byte write, account_pair_byte write (D11), DOMAIN=10 transaction_byte parse, account_pair_byte decode (D11), DOMAIN=10/11 fin_control decode |
| `test/codec-pads-v1.test.js` | 42 Round 3 tests added |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 3 checklist marked |

---

## Open Items Carried Into Round 4

- Participants block (Round 4): meta2 PARTICIPANTS=1, block_header, per-participant encode/decode, Profile D (76B)
- Entry Type Matching Table helper (§17.5) — wizard.js, not codec.js
- App-assisted inference (§17.4) — wizard.js UI layer
- Reconciliation rules §17.6 — UI/app layer
- AP codes 1110/1111 (Correction/Netting, Compound continuation) — no current wizard path
