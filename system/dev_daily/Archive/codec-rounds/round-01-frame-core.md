# Round 1 Summary — Frame Core: meta bytes + field flags + text/date blocks

**Date completed:** 2026-05-18  
**Status:** Done — 86/86 tests pass. Two checklist items deferred to Round 8 (EXT_TEMPLATE tests, FLAGS4 passthrough test).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary output:** `js/lib/codec.js` (full rewrite)

---

## What Was Built

A complete binary frame encoder and decoder for the pads-v1 (`#1pa/`) codebook tag, covering all non-financial fields. The encoder takes a record object and produces a `workpads.me/p#1pa/<base64url>` URL. The decoder takes the URL fragment and reconstructs the record object.

### Scope

| In scope | Out of scope (deferred) |
|----------|------------------------|
| meta1 — all bits | Financial block (Round 2) |
| meta2 — all flags | DOMAIN=01/10/11 context bytes (Round 2/3) |
| EXT_TEMPLATE byte parsing (decode path) | EXT_TEMPLATE full roundtrip tests (Round 8) |
| field_flags (2 bytes) | Participants block (Round 4) |
| field_flags3 (1 byte) | TRIG block (Round 9) |
| field_flags4 passthrough byte | FLAGS4 data blocks (Round 8) |
| All 14 FIELDS data blocks | Security wrapper (Round 7) |
| All 7 FIELDS3 data blocks | State Commit / Amendment (Round 5) |
| COMPACT_TIME=1 binary dates/times | Compound block (Round 6) |
| Legacy decode: 1eg/, 1ag/, 1bg/, 1cg/, 1dg/, alg=bitpad-v1 | |

---

## Key Design Decisions Made

### 1. needMeta2 conditional logic
meta2 is only written when it carries useful information. The original design always wrote meta2 when `compactTime=true`. Fixed: meta2 is only emitted when `(compactTime && hasDateOrTime) || hasTrigBlock || domain > 0 || draft || restrictForward`.

**Why this matters:** Profile E (`{ job: 'Visit' }` with no dates) must produce exactly 10B raw. With unconditional meta2, it produced 11B. The spec requires 10B. Saving 1 byte matters after deflate+base64url.

```javascript
var DATE_TIME_MASK   = (1<<2)|(1<<4)|(1<<5)|(1<<6)|(1<<14);
var FLAGS3_DATE_MASK = (1<<3);
var hasDateOrTime    = !!(fieldFlags & DATE_TIME_MASK) || !!(flags3 & FLAGS3_DATE_MASK);
var needMeta2 = (compactTime && hasDateOrTime) || opts.hasTrigBlock || domain > 0 ||
                opts.draft || opts.restrictForward;
```

### 2. Two epoch constants
The legacy `1eg/` codec used `2020-01-01` as its COMPACT_TIME epoch. FRAME-SPEC v1.0 requires `2000-01-01`. Both constants are retained:

```javascript
var DATE_EPOCH_MS        = Date.UTC(2000, 0, 1);  // pads-v1
var LEGACY_DATE_EPOCH_MS = Date.UTC(2020, 0, 1);  // 1eg/ legacy decode only
```

This means a `1eg/` date = day 2,390 ≈ "2026-07-01 from 2020" and a `1pa/` date = day 9,633 for the same calendar date. Never mix them.

### 3. actions field type change
In `1eg/`, `actions` was a structured array — each action had a flags byte, title string, optional notes string. In pads-v1, FRAME-SPEC bit 9 is plain text. The encoder coerces an array to a `\n`-joined string. The decoder returns a plain string. The legacy decoder still returns the structured array.

```javascript
if (f.id === 'actions' && Array.isArray(v)) {
  v = v.map(function(a) { return a.title ? String(a.title) : String(a); }).join('\n');
}
```

### 4. financial block bit 12 — safe stub
Round 1 cannot parse the financial block because its size is unknown without parsing it. The stub: encoder never sets bit 12 (Round 2 will). If the decoder encounters bit 12 set (e.g. reading a partial Round 2 frame), it returns `{ _financialBlockPending: true }` and stops cleanly rather than reading garbage.

### 5. Legacy decoders preserved intact
All legacy decode paths (padsDecodeKaios for `1eg/`, padsDecodeLegacy for older tags, alg=bitpad-v1 hash param format) were preserved in full. They are not called by the new encoder. The decode router directs by tag.

---

## Frame Layout Verified

### Profile E — 10 bytes raw
```
byte 0:    0x00         meta1: SERVICE, no META2, no flags
byte 1:    0x00         field_flags high byte
byte 2:    0x01         field_flags low byte (bit 0 = job)
byte 3:    0x00         job length high byte
byte 4:    0x05         job length low byte (5 = len('Visit'))
bytes 5-9: 'V','i','s','i','t'   job UTF-8
```
Total: 10 bytes. ✓

### Profile A — 33 bytes raw (with meta2, COMPACT_TIME=1)
```
byte 0:    0x80         meta1: META2_PRESENT=1, SERVICE
byte 1:    0x40         meta2: COMPACT_TIME=1
byte 2:    0x00         field_flags high byte
byte 3:    0x05         field_flags low byte (bits 0+2: job + date)
byte 4:    0x00         job length high byte
byte 5:    0x19         job length low byte (25 chars)
bytes 6-30: 25-char job string
byte 31:   0x??         date days high byte
byte 32:   0x??         date days low byte (uint16 days since 2000-01-01)
```
Total: 33 bytes. ✓

Note: FRAME-SPEC §4 Profile A shows `Total (COMPACT_TIME=1) = 32B` — this is wrong by 1 byte. The spec's calculation omits the meta2 byte (required to signal COMPACT_TIME). The ROUND-1-WORKPLAN correctly showed 33B, and 33B is what the implementation produces. The spec will be corrected in the SUI-001 update.

---

## Bugs Found and Fixed

### Bug 1: meta2 written unconditionally when compactTime=true
**Symptom:** Profile E produced 11B instead of 10B.  
**Cause:** `var needMeta2 = compactTime` — always true.  
**Fix:** `var needMeta2 = (compactTime && hasDateOrTime) || ...` — conditional on date/time fields actually being present.

### Bug 2: Test string wrong length
**Symptom:** Profile A test reported 34B instead of 33B.  
**Cause:** Test job string `'Boiler service annual 2026'` is 26 chars, not 25.  
**Fix:** Changed to `'Boiler service annual 202'` (25 chars exactly).

---

## Test Coverage

86 tests across:
- Profile E exact byte layout (8 assertions including per-byte checks)
- Profile A exact byte layout (12 assertions including per-byte checks and date encoding)
- All 8 BASE_TEMPLATE values (8 assertions)
- meta1 flags: ackRequest, chain, recipientType (6 assertions)
- meta2 flags: compactTime, hasTrigBlock, draft, restrictForward (7 assertions)
- COMPACT_TIME date arithmetic: 3 date pairs (6 assertions)
- COMPACT_TIME time arithmetic: 4 time pairs (8 assertions)
- All 14 FIELDS roundtrip with values (14 assertions)
- FLAGS3 7-field roundtrip (8 assertions including FLAGS3_PRESENT flag check)
- Financial bit 12 stub (1 assertion)
- URL tag check: contains `1pa/`, does not contain `1eg/` (2 assertions)
- Full encode → decode via URL (4 assertions)
- meta2 omission when no date/time fields (2 assertions)

### Two items NOT yet tested (tracked in CODEC-WORKPLAN)
- EXT_TEMPLATE full roundtrip (all 4 EXT_SIGNAL paths): code path exists in decoder; tests deferred to Round 8 when EXT_TEMPLATE is actively used
- FLAGS4 passthrough: bit 7 of flags3 consumed on decode; no encode path yet; Round 8

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/codec.js` | Full rewrite. New buildFrame + parseFrame. Legacy decoders preserved. |
| `js/screens/share.js` | Display string: `bitpad-c (1eg/) codec` → `pads-v1 (1pa/) codec` |
| `js/screens/management.js` | Two display strings updated from `1eg/` to `1pa/` |
| `system/dev_daily/DEVIATIONS.md` | DEV-WP-URL-001 updated with pads-v1 fix description |
| `test/codec-pads-v1.test.js` | New. 86 tests. Run: `node test/codec-pads-v1.test.js` |

Legacy test `test/codec-c.test.js` was NOT updated — it still tests `1eg/` tag expectations and will fail against the new encoder. It should either be deleted or updated in Round 2 when legacy compatibility is fully verified. Do not delete it yet — the legacy decode paths it exercises are still valid reads.

---

## Open Items Carried Into Round 2

- EXT_TEMPLATE roundtrip tests (all 4 EXT_SIGNAL paths) — code exists, tests needed
- FLAGS4 passthrough encode/decode test — Round 8
- COMPACT_TIME=0 explicit test for date and time text encoding — should be added to test file
- Profile A spec discrepancy (32B vs 33B) — note for SUI-001 standard update
- SUI-001 (workpads-standard/codec.md update to pads-v1) — pending Round 1 stabilisation sign-off

---

## Spec Sections Referenced

| Section | What was used |
|---------|---------------|
| §1 Encoding Envelope | URL scheme, codebook tag `1pa`, byte order |
| §2 meta1 | All bit definitions |
| §2 ext_template | All 4 EXT_SIGNAL paths (decode only in R1) |
| §2 meta2 | All bit definitions; PARTICIPANTS bit noted |
| §2 field_flags | All 16 bits (15 data + FLAGS3_PRESENT) |
| §2 field_flags3 | All 8 bits (7 data + FLAGS4_PRESENT) |
| §2 data blocks | text/compact/date/time encoding rules |
| §4 Profile E | 10B raw verification target |
| §4 Profile A | 33B raw verification target (33B not 32B — spec has arithmetic error) |
