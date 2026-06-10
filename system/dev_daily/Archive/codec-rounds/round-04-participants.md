# Round 4 Summary — Participants Block + Role Codebook

**Date completed:** 2026-05-18  
**Status:** Done — 235/235 tests pass (184 from Rounds 1–3, 51 new Round 4).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary output:** `js/lib/codec.js` (participants block encode/decode), `js/lib/roles.js` (new)

---

## What Was Built

Full participants block encode/decode. meta2 PARTICIPANTS bit (bit 4) gates the block. Each participant carries: part_flags, name (always), trading_name?, phone?, email?, role_code or role_text (ROLE_TYPE=11 only), alt_id?. Profile D (76B) verified end-to-end.

### Scope

| In scope | Out of scope (deferred) |
|----------|------------------------|
| block_header count encoding/decoding | IS_SENDER uniqueness enforcement (app layer) |
| All part_flags bits encode/decode | Full §2/§3 role code tables in roles.js (31 compressed roles written; 240+224 stubs) |
| ROLE_TYPE 00/01/10 quick-select | IS_SENDER multi-participant validation |
| ROLE_TYPE=11 + role_code (ROLE_SLOT 0–30) | Extended codebook §2 full table |
| ROLE_TYPE=11 + HAS_ROLE_TEXT=1 free-text | |
| ROLE_SLOT=31 extended → roleCode2 byte | |
| trading_name field (ROLE_TYPE≠11) | |
| phone, email fields | |
| alt_id block (all 4 types) | |
| IS_ORG flag | |
| meta2 PARTICIPANTS bit gating | |
| roles.js: compressed common-role codebook (31 roles) | |

---

## Key Design Decisions Made

### 1. role_code byte layout: (ROLE_SLOT << 3) | ROLE_SIGNALS

Following ROLE-CODEBOOK v1.1, the role_code byte encodes ROLE_SLOT in bits 7-3 and ROLE_SIGNALS (CERT/AUTH/LEAD) in bits 2-0. This is the wire format for ROLE_TYPE=11 + HAS_ROLE_TEXT=0.

ROLE_SLOT=31 is the extended escape: the decoder reads one additional byte (roleCode2) after the role_code byte. This maps onto FRAME-SPEC's "0xFF escape" but is more precisely ROLE_SLOT=31 with any ROLE_SIGNALS value (byte values 0xF8–0xFF all trigger the escape).

The codec encoder uses `opts.participants[i].roleSlot` and `opts.participants[i].roleSignals` directly. The roles.js `roleCodeByte()` helper combines them.

### 2. bit 1 of part_flags is context-dependent

The same bit (bit 1) means HAS_ROLE_TEXT when ROLE_TYPE=11, and HAS_TRADING_NAME when ROLE_TYPE≠11. The encoder and decoder both branch on `pRoleType === 3` to determine which path to take. This is faithful to the FRAME-SPEC definition.

### 3. FRAME-SPEC Profile D P2 part_flags is 0xA0, not 0x90

FRAME-SPEC §4 shows P2 part_flags = 0x90 for "IS_SENDER=1, ROLE=001/Worker". The correct value is 0xA0:
- IS_SENDER bit7=1 → 0x80
- ROLE_TYPE=Worker=01 in bits6-5 → bit6=0, bit5=1 → 0x20
- 0x80 | 0x20 = 0xA0

0x90 would be IS_SENDER=1 + ROLE_TYPE=00/Customer + HAS_ALT_ID=1, which is wrong. This is the same class of arithmetic error as Profile A/C. FRAME-SPEC needs a v1.0.2 correction.

### 4. IS_SENDER enforcement is app-layer only

The encoder writes IS_SENDER from `p.isSender` without validation (multiple senders, no sender). The spec says "exactly one participant should have IS_SENDER=1" but enforcing this is the wizard/UI responsibility. The codec faithfully encodes whatever it receives.

### 5. roles.js is a lookup helper, not a codec dependency

`codec.js` does not import `roles.js`. The codec only encodes/decodes ROLE_SLOT and ROLE_SIGNALS as raw integers. `roles.js` provides the human-readable name lookup for the UI layer. The 31-entry compressed codebook covers >85% of extended-path usage.

---

## Frame Layout Verified

### Profile D (76B raw)

```
[0]    0x88  meta1: BASE=001/Financial, META2_PRESENT=1
[1]    0x54  meta2: COMPACT_TIME=1, PARTICIPANTS=1, DOMAIN=01 (0x40|0x10|0x04)
[2]    0x40  setup_byte: DECIMAL_POS=2, CURRENCY=home, TAX=none, SF=0
[3]    0x00  transaction_byte: I<I settled payment
[4-5]  0x10 0x07  field_flags: bits 0,1,2,12 (job+customer+date+financial)
[6-21]  "Annual service" (14 chars, 2B len prefix = 16B)
[22-32] "M. Wilson" (9 chars, 2B len prefix = 11B)
[33-34] uint16 date
[35]   0x12  fin_control: PARITY=1, CUST=1
[36-38] uint24 = 8500 (£85.00 at D=2)
[39]   0x40  participants block_header: count=2 (0b01000000)
[40]   0x08  P1 part_flags: ROLE=00/Customer, HAS_PHONE=1
[41-51] "M. Wilson" name (2+9=11B)
[52-64] "07700900000" phone (2+11=13B)
[65]   0xA0  P2 part_flags: IS_SENDER=1, ROLE=01/Worker (0x80|0x20)
[66-75] "D Garcia" name (2+8=10B)

Total: 76B ✓
```

---

## Spec Discrepancies Found

### Profile D P2 part_flags: 0x90 → 0xA0
FRAME-SPEC §4 shows P2 part_flags=0x90 but arithmetic gives 0xA0. Worker=01 in bits6-5 contributes 0x20, not 0x10. IS_SENDER=1 contributes 0x80. Sum = 0xA0. Same class of error as Profile A/C byte counts. To be corrected in FRAME-SPEC v1.0.2.

---

## Test Coverage Added (51 new tests)

- Profile D exact byte layout: total=76B, meta1/meta2/setup/tx/ff bytes, block_header=0x40, P1/P2 part_flags (9 assertions)
- Profile D decode roundtrip: job, customer_amount, _participants[0/1] all fields, meta.hasParticipants (11 assertions)
- meta2 PARTICIPANTS bit: set when parts present, absent without parts (2 assertions)
- ROLE_TYPE 00/01/10 quick-select roundtrip (3 assertions)
- ROLE_TYPE=11 role_code byte: roleSlot=0, roleSignals=4/CERT roundtrip (4 assertions)
- ROLE_TYPE=11 role_text: name + value + no roleSlot (3 assertions)
- ROLE_TYPE=11 ROLE_SLOT=31 extended: slot=31, roleCode2=0x15, name (3 assertions)
- trading_name roundtrip: name + value (2 assertions)
- phone + email roundtrip (2 assertions)
- alt_id all 4 types: type + value each (8 assertions)
- IS_ORG flag roundtrip (2 assertions)
- Multiple participants (count=4): decoded length + block_header count bits (2 assertions)

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/codec.js` | hasParticipants var, needMeta2 condition, meta2 PARTICIPANTS bit, participants block encoder + decoder |
| `js/lib/roles.js` | New file: compressed common-role codebook (31 entries), roleCodeByte/decodeRoleCodeByte helpers |
| `test/codec-pads-v1.test.js` | 51 Round 4 tests added; header updated to Rounds 1–4 |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 4 checklist marked; Profile D verification item marked with spec error note |

---

## Open Items Carried Into Round 5

- FRAME-SPEC v1.0.2: correct Profile D P2 part_flags 0x90 → 0xA0
- roles.js full §2/§3 codebook (240 named + 224 specialist roles) — app/UI concern
- IS_SENDER uniqueness enforcement — wizard.js / app layer
- Round 5: State Commit (BASE_TEMPLATE=101), Amendment (BASE_TEMPLATE=110), Chain URL suffix
