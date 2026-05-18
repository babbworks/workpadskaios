# Round 5 Summary — State Commit + Amendment + Chain

**Date completed:** 2026-05-18  
**Status:** Done — 281/281 tests pass (235 from Rounds 1–4, 46 new Round 5).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary output:** `js/lib/codec.js` (buildAmendmentFrame, parseAmendmentFrame, State Commit encode/decode, chain URL)

---

## What Was Built

### State Commit (BASE_TEMPLATE=101)

Full encode/decode for state-commit records. `buildFrame` dispatches on `baseTemplate === 5` → `isStateCommit=true`. setup_byte always written (currency/decimal context). `state_commit_byte` occupies the transaction_byte slot. sc_fin_summary Level A (4B) written at bit 12 when `scTotalAmount` or `scLineCount` non-zero. field_flags and data blocks (text fields, date) present as normal.

| `state_commit_byte` layout | Bits | Values |
|----------------------------|------|--------|
| COMMIT_TYPE | 7-6 | 00=job close, 01=payment confirmed, 10=terms agreed, 11=reserved |
| PERIOD_TYPE | 5-4 | 00=none, 01=week, 10=month, 11=custom |
| CHAIN_COMPLETE | 3 | 1=chain closed |
| DISPUTE_FLAG | 2 | 1=under dispute |
| reserved | 1-0 | must be 0 |

### Amendment (BASE_TEMPLATE=110)

`buildAmendmentFrame()` and `parseAmendmentFrame()`. Derives `changedMask` from non-null record fields (mirrors field_flags bit layout). Derives `changedMask3` from FIELDS3. CHANGED_MASK_3_PRESENT (bit 15) set when `changedMask3 ≠ 0`. When CHANGED_MASK_3_PRESENT=0 and `parentUid` or `disputeLink` opts present, bit 14 set + amendment_flags byte written. Changed FIELDS and FIELDS3 written in ascending bit order. Financial amendment deferred to Round 6+.

| amendment_header | Byte | Bits | Meaning |
|-----------------|------|------|---------|
| changedMask high | 1 | 15: CM3_PRESENT, 14: amendment_flags signal | mirrors field_flags byte 1 |
| changedMask low  | 2 | 7-0 | mirrors field_flags byte 2 |

### Chain URL suffix

`encode()`: when `opts.chain && opts.chainRef`, appends `&c=<chainRef>` to the URL. Accepts `chainRef` as a `Uint8Array` (base64url-encoded) or a pre-encoded string (passed through). `decode()`: detects `&c=` in the `1pa/` hash segment, strips it before decompression, and attaches `_chainRef` (string) to the returned record. `opts.chain` in `buildFrame` also sets bit 1 of meta1 (CHAIN flag in frame header).

---

## Key Design Decisions Made

### 1. State Commit has field_flags (CODEC-WORKPLAN note was wrong)

CODEC-WORKPLAN Round 5 originally said "State Commit records do NOT carry field_flags." FRAME-SPEC §15 Block Presence Summary shows field_flags=✓ for State Commit. §15 is authoritative. State Commit records carry field_flags and standard data blocks (job, date, etc.) alongside the state_commit_byte. Implementation follows §15.

### 2. state_commit_byte replaces transaction_byte slot

For State Commit: setup_byte present → state_commit_byte immediately follows (no transaction_byte). This allows financial context (currency, decimal) while expressing settlement state rather than directional flow. The sc_fin_summary at bit 12 is a summary block, not a full financial block (no fin_control byte).

### 3. Amendment changedMask computed from record content, not opts

The encoder derives changedMask by scanning `record` for non-null/non-empty fields — the same scan used for field_flags in normal records. This means the caller constructs an Amendment record exactly as they would a normal record (only with the fields that changed), and the codec derives the masks automatically. No separate `changedFields` opts needed.

### 4. Amendment amendment_flags condition: CM3 takes priority over bit 14

If CHANGED_MASK_3_PRESENT=1 (bit 15), bit 14 is part of the changedMask and NOT the amendment_flags signal. amendment_flags are only present when CM3=0 AND bit 14 is explicitly set. The encoder sets bit 14 only when `hasCM3=false` and `(parentUid || disputeLink)` opts are present.

### 5. Chain chainRef is URL-layer, not frame-layer (for pads-v1)

The 3-byte chainRef is appended to the URL as `&c=<base64url>` and stripped before frame parse. It is NOT embedded in the binary frame (unlike the legacy 1eg/ codec which wrote it inline at bit 18). The CHAIN bit in meta1 signals the record belongs to a chain; the actual reference is in the URL parameter.

---

## Spec Discrepancies

### CODEC-WORKPLAN §15 note contradicts FRAME-SPEC §15
CODEC-WORKPLAN Round 5 said State Commit has no field_flags. FRAME-SPEC §15 shows field_flags=✓. Resolution: follow §15. CODEC-WORKPLAN note corrected in-place.

---

## Test Coverage Added (46 new tests)

- State Commit meta1 BASE_TEMPLATE=101 (2 assertions)
- State Commit setup_byte present, state_commit_byte in tx slot, decimalPos correct (3 assertions)
- State Commit state_commit_byte all 4 fields (commitType/periodType/chainComplete/disputeFlag) (4 assertions)
- State Commit field_flags bit 12 set when sc_fin_summary present (1 assertion)
- State Commit full encode/decode roundtrip: job, date, _stateCommit, all 4 fields + sc_total_amount + sc_line_count (9 assertions)
- Amendment meta1 BASE_TEMPLATE=110 + no meta2 (2 assertions)
- Amendment changedMask bit0 set for job, bit15 clear when no FIELDS3 (2 assertions)
- Amendment single text field roundtrip: job + _amendment + changedMask (3 assertions)
- Amendment multiple fields roundtrip: job + customer + location (3 assertions)
- Amendment FIELDS3 triggers CM3_PRESENT (1 assertion)
- Amendment FIELDS3 roundtrip: context_label + changedMask3 non-zero (2 assertions)
- Amendment parentUid roundtrip: present + length 8 + [0] + [7] (4 assertions)
- Amendment disputeLink roundtrip (1 assertion)
- Chain CHAIN bit in meta1 (1 assertion)
- Chain encode appends &c= suffix (1 assertion)
- Chain decode strips &c=, returns record + _chainRef + meta.chain (3 assertions)
- Chain decode without &c= leaves _chainRef absent (1 assertion)
- Chain string chainRef passthrough: encode + decode (2 assertions)

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/codec.js` | `buildAmendmentFrame()`, State Commit in `buildFrame`, `parseAmendmentFrame()`, State Commit in `parseFrame`, chain suffix in `encode()`, chain strip in `decode()` |
| `test/codec-pads-v1.test.js` | 46 Round 5 tests added; header updated to Rounds 1–5 |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 5 checklist updated; SC field_flags note corrected |

---

## Open Items Carried Into Round 6

- State Commit guest confirmation signature (8B mandatory + 9B optional) — deferred to security layer
- State Commit sc_fin_summary Level B (fingerprint SHA-256[0:6]) — deferred
- Amendment financial amendment (fin_control + amounts re-encoded) — Round 6+
- Amendment `line_index` byte (compound line pointer) — Round 6+
- RecordService chainRef generation (24-bit ANCHOR + PARTICIPANT_SLOT + SEQUENCE) — app layer, deferred
- Round 6: Compound Block (multi-line invoices + payroll)
