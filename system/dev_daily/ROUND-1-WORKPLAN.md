# Round 1 Work Plan — Codec Core

**Status:** not started  
**Goal:** Replace `1eg/` codec with pads-v1 (`1pa`) encoder/decoder. Foundational pipeline only — no financial block, no participants, no security.  
**Spec:** `dev_refs/FRAME-SPEC.md` v1.0 §1, §2 (header + flags + text blocks), §4 (Profiles A + E)  
**Output:** `workpadskaios/js/lib/codec.js` — new ES5 pads-v1 encode/decode

---

## What We Are Building

A binary frame encoder and decoder that:

1. Takes a record object → produces a `#1pa/` URL
2. Takes a `#1pa/` URL → reconstructs the record object

No financial data in this round. Text fields, dates, and times only.

---

## Pipeline

### Encode
```
record object
  → assemble binary frame (meta bytes + flag bytes + data blocks)
  → deflateRaw (fflate, already in app)
  → base64url encode (no padding)
  → prepend codebook tag → "workpads.me/p#1pa/" + fragment
```

### Decode
```
URL fragment after "#1pa/"
  → base64url decode
  → inflateRaw
  → parse binary frame → record object
```

---

## Byte-by-Byte Build Order

Build and test each block before moving to the next. Each block is self-contained.

### Block 1 — meta1 (1 byte, always present)

```
bit 7: META2_PRESENT    1 = meta2 byte follows
bit 6: EXT_TEMPLATE     1 = ext_template bytes follow; 0 = BASE_TEMPLATE in bits 5-3
bits 5-3: BASE_TEMPLATE (when EXT=0):
  000 = Service
  001 = Financial
  010 = Compound financial
  011 = Contact/entity
  100 = Document/media
  101 = State Commit
  110 = Amendment
  111 = Generic
bits 5-3: EXT_SIGNAL (when EXT=1):
  001 = +1 byte
  010 = +2 bytes
  011 = +3 bytes
  100 = variant (3 bytes: CRC-8 + CRC-16)
bit 2: ACK_REQUEST
bit 1: CHAIN
bit 0: RECIPIENT_TYPE
```

Done when: `encodeMeta1(opts)` and `decodeMeta1(byte)` roundtrip correctly for all BASE_TEMPLATE values.

---

### Block 2 — ext_template (1–3 bytes, if EXT_TEMPLATE=1)

```
EXT_SIGNAL=001: 1 byte — domain type index
EXT_SIGNAL=010: 2 bytes — uint16 BE
EXT_SIGNAL=011: 3 bytes — 24-bit BE
EXT_SIGNAL=100: 3 bytes — byte1: CRC-8(creator_id); bytes2-3: CRC-16(id+name+date)
```

Done when: all four EXT_SIGNAL paths encode and decode correctly.

---

### Block 3 — meta2 (1 byte, if META2_PRESENT=1)

```
bit 7: SELF_DESCRIBING  0 = template-dependent (default); 1 = self-describing (1-byte label prefix per block)
bit 6: COMPACT_TIME     0 = date/time as text; 1 = date as uint16 days, time as uint16 minutes
bit 5: HAS_TRIG_BLOCK   1 = TRIG block present
bit 4: PARTICIPANTS     1 = participants block present
bits 3-2: DOMAIN        00 = none  01 = simple I>O  10 = BitLedger  11 = hybrid
bit 1: DRAFT
bit 0: RESTRICT_FORWARD
```

Done when: `encodeMeta2(opts)` and `decodeMeta2(byte)` roundtrip all 8 flags.

---

### Block 4 — field_flags (2 bytes, always present)

```
bit 0:  job             [uint16 len][UTF-8]
bit 1:  customer        [uint16 len][UTF-8]
bit 2:  date            uint16 days* or [uint16][UTF-8 ISO]
bit 3:  location        [uint16 len][UTF-8]
bit 4:  meeting_time    uint16 minutes* or [uint16][UTF-8]
bit 5:  start_time      uint16 minutes* or [uint16][UTF-8]
bit 6:  end_time        uint16 minutes* or [uint16][UTF-8]
bit 7:  customer_phone  [uint16 len][UTF-8]
bit 8:  worker          [uint16 len][UTF-8]
bit 9:  actions         [uint16 len][UTF-8]
bit 10: details         [uint16 len][UTF-8]
bit 11: story           [uint16 len][UTF-8]
bit 12: financial_block (triggers fin_control — Round 2)
bit 13: ref_number      [uint8 len][UTF-8] max 255B
bit 14: due_date        uint16 days* or [uint16][UTF-8]
bit 15: FLAGS3_PRESENT  → field_flags3 follows
```
`*` when COMPACT_TIME=1

Done when: flag bytes encode/decode correctly and data blocks write in ascending bit order.

---

### Block 5 — field_flags3 (1 byte, if FLAGS3_PRESENT=1)

```
bit 0: context_label    [uint8 len][UTF-8] max 255B
bit 1: tag              [uint8 len][UTF-8]
bit 2: qty_unit         [uint8 len][UTF-8]
bit 3: date_end         uint16 days* or [uint16][UTF-8]
bit 4: attachment       [uint16 len][UTF-8]
bit 5: uid              [uint16 len][UTF-8]
bit 6: url              [uint16 len][UTF-8]
bit 7: FLAGS4_PRESENT   → field_flags4 follows
```

Done when: FLAGS3 fields encode/decode in correct bit order.

---

### Block 6 — field_flags4 (1 byte, if FLAGS4_PRESENT=1)

Template-defined bits. For Round 1, encode/decode the byte but treat all bits as present/absent flags only — actual data blocks for FLAGS4 are Round 8 (template system).

Done when: FLAGS4 byte passes through encode/decode without corruption.

---

### Block 7 — Data blocks (text fields)

Two encoding rules depending on field:

**Standard text** (field_flags bits 0–3, 7–11; FLAGS3 bits 4–6):
```
[uint16 BE length][UTF-8 bytes]
```

**Compact text** (field_flags bits 13; FLAGS3 bits 0–2):
```
[uint8 length][UTF-8 bytes]   max 255 bytes
```

**Date** (field_flags bits 2, 14; FLAGS3 bit 3):
```
COMPACT_TIME=1: uint16 BE — days since 2000-01-01
COMPACT_TIME=0: [uint16 BE length][UTF-8 ISO date string]
```

**Time** (field_flags bits 4, 5, 6):
```
COMPACT_TIME=1: uint16 BE — minutes since midnight
COMPACT_TIME=0: [uint16 BE length][UTF-8 time string]
```

Data blocks are written in **ascending bit order** of their flag bit. Decoder reads them in the same order.

Done when: all text fields + dates roundtrip with correct byte layout.

---

## Verification Targets (from FRAME-SPEC §4)

### Profile E — Absolute minimum
```
meta1:      1B  (0x00 — SERVICE, no META2)
field_flags: 2B  (bit 0 only: job)
job block:  2+5 = 7B  "Visit"
Total:      10B raw
```
Must encode to exactly 10 bytes before deflate.

### Profile A — Service note, COMPACT_TIME
```
meta1:         1B  (BASE=000, META2=1)
meta2:         1B  (COMPACT_TIME=1)
field_flags:   2B  (bits 0+2: job + date)
job block:     2+25 = 27B  (25-char job description)
date block:    2B  (uint16 days)
Total:         33B raw
```
Must encode to 33 bytes before deflate.

---

## COMPACT_TIME Date Arithmetic

```javascript
// Epoch: 2000-01-01
var EPOCH_MS = Date.UTC(2000, 0, 1);

function dateToDays(isoString) {
  return Math.floor((new Date(isoString).getTime() - EPOCH_MS) / 86400000);
}

function daysToDate(days) {
  return new Date(EPOCH_MS + days * 86400000).toISOString().slice(0, 10);
}

function timeToMinutes(hhmm) {  // "09:30"
  var parts = hhmm.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function minutesToTime(mins) {
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
```

---

## SELF_DESCRIBING mode (when meta2 bit 7 = 1)

Each data block is prefixed with a 1-byte canonical field-name index:
```
0x00–0x0E = field_flags bits 0–14 in order
0x10–0x16 = field_flags3 bits 0–6 in order
0x80–0xFE = custom / template-defined
```
Round 1: implement SELF_DESCRIBING=0 (template-dependent) only. SELF_DESCRIBING=1 is a decode path to handle gracefully but not generate.

---

## Files to Touch

| File | Action |
|------|--------|
| `js/lib/codec.js` | Rewrite for pads-v1. Keep ES5. Delete 1eg/ encoder/decoder entirely. |
| `js/screens/share.js` | Update tag reference from `1eg/` to `1pa/` |
| `js/screens/view.js` | Update URL parse to expect `#1pa/` |
| `workpads-standard/codec.md` | Update to pads-v1 after codec.js works (SUI-001) |
| `dev_daily/DEVIATIONS.md` | Close DEV-WP-URL-001 once share.js updated |

Do **not** touch: financial screens, wizard financial step, participants, security — all later rounds.

---

## Done Criteria

- [ ] Profile E roundtrips: encode → 10B raw → deflate → base64url → decode → original record
- [ ] Profile A roundtrips: encode → 33B raw → deflate → base64url → decode → original record
- [ ] All 8 BASE_TEMPLATE values encode/decode in meta1
- [ ] COMPACT_TIME=1 dates encode as uint16 days from 2000-01-01
- [ ] COMPACT_TIME=1 times encode as uint16 minutes from midnight
- [ ] FLAGS3 fields encode/decode in bit order
- [ ] field_flags bit 12 (financial_block) is flagged but block itself is skipped (Round 2)
- [ ] `#1pa/` URL tag emitted correctly (not `1eg/`)
- [ ] workpads-cli roundtrip passes Profiles A and E
- [ ] share.js and view.js updated to `1pa/` tag

---

## Resume Instructions

If this session is interrupted, pick up at whichever Block number above is not yet checked off. The blocks are independent — complete them in order 1 → 7. Do not start Round 2 (financial block) until all 7 blocks are done and both profile roundtrips pass.

Current codec.js is at: `workpadskaios/js/lib/codec.js` — read it before starting to understand what exists and what to preserve (fflate import, base64url helpers, any utility functions still needed).
