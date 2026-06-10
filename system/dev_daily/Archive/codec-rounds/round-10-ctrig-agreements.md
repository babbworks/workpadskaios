# Round 10 Summary — C-TRIG Evaluator + Agreements

**Date completed:** 2026-05-18  
**Status:** Done — 534/534 tests pass (488 from Rounds 1–9, 46 new Round 10).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary outputs:** `js/lib/ctrig.js` (new), `js/lib/agreements.js` (new)

---

## What Was Built

### 1. C-TRIG Bytecode Evaluator (ctrig.js)

`global.WPCtrig.evaluate(program, context)` → `{ status, value?, reason? }`

**Result status values:**
- `'resolved'` — program ran to completion; `value: bool` = final stack AND
- `'halted'` — recoverable stop (timelock, version mismatch, async condition); `reason: string`
- `'error'` — structural problem (malformed program, overflow); `reason: string`

**Inputs:**
- `program`: Uint8Array, max 32 bytes
- `context.record`: decoded pads-v1 record (participants, date, due_date, location, etc.)
- `context.chain`: pre-resolved ChainState (ack_count, financial, records, milestone_states, ratified, disputed, etc.)
- `context.timestamp`: uint16 COMPACT_TIME value
- `context.app`: optional app layer for pre-fill hooks (RELEASE_AMT, TRIGGER_OBL, etc.)
- `context.serverResults`: optional Map for async condition results

**Safety checks:**
- Program > 32 bytes → `error('program_too_long')` (checked before execution)
- Stack > 8 items → `error('stack_overflow')` (checked at start of each iteration)
- Stack underflow on pop → returns 0 (numeric ops) or false (boolean ops) — safe default

**Instruction set:**

| Op | Mnemonic | Behaviour |
|----|----------|-----------|
| 0x0 | COMPARE_AMT | pop b, pop a; cmpTable[imm](a,b); imm=0xF=pct threshold |
| 0x1 | PUSH_COND | push condition[imm]; imm=0xF=escape (read CAT:4 ID:4 byte) |
| 0x2 | RELEASE_AMT | app.prefillRecord('payment_request'); push true |
| 0x3 | TRIGGER_OBL | app.prefillRecord('obligation'); push true |
| 0x4 | ASSERT_STATE | app.prefillRecord('state_commit'); push true |
| 0x5 | REQUIRE_ACK | push chain.ack_count > 0 |
| 0x6 | TIME_LOCK | milestoneDate(imm); if ts < date: halt; else push true |
| 0x7 | MARKER_WRITE | app.prefillRecord('marker_write'); push true |
| 0x8 | AND | pop b, pop a, push a && b |
| 0x9 | OR | pop b, pop a, push a \|\| b |
| 0xA | NOT | pop a, push !a |
| 0xB | IF_THEN | pop cond; if !cond: skip next byte |
| 0xC | BRANCH (3B) | pop cond; pc_after+offset where offset=cond?true_off:false_off |
| 0xD | COMPLETE | return resolved(true) |
| 0xE | DISPUTE | return resolved(false) |
| 0xF | VERSION (3B) | check min_version + feature_flags; halt if unsupported |

COMPARE_AMT imm table: 0x0=≥, 0x1=>, 0x2===, 0x3=<, 0x4=≤, 0x5=≠, 0x6–0xE=error('invalid_operator'), 0xF=percentage (next byte = uint8, units=0.5%; 200=100%).

**BRANCH offset semantics:** 3-byte instruction. Offset counts forward from `pc+3` (byte after BRANCH). Offset 0 = next instruction. Target `>= program.length` or `>= 32` → error('branch_out_of_bounds').

**VERSION semantics:** 3 bytes: `[0xF_][min_version][feature_flags]`. `EVALUATOR_VERSION=1`, `SUPPORTED_FEATURES=0x07` (bits 0–2). min_version > 1 → halt('version_unsupported'). Unknown feature bits → halt('unsupported_features').

**Direct condition IDs (0x00–0x0E):**

| ID | Constant | Source |
|----|----------|--------|
| 0x00 | COND_HAS_PHONE | participants[].has_phone |
| 0x01 | COND_IS_ORG | participants[].is_org |
| 0x02 | COND_ROLE_TYPE_CUSTOMER | participants[].role_type===0 |
| 0x03 | COND_ROLE_TYPE_WORKER | participants[].role_type===1 |
| 0x04 | COND_HAS_FINANCIAL_BLOCK | record.has_financial_block |
| 0x05 | COND_DATE_REACHED | timestamp >= record.date |
| 0x06 | COND_HAS_LOCATION | record.location != null |
| 0x07 | COND_IS_CHAIN | record.meta1.chain |
| 0x08 | COND_ACK_RECEIVED | chain.ack_count > 0 |
| 0x09 | COND_PAYMENT_CONFIRMED | chain.records has template=5, commit_type=1 |
| 0x0A | COND_MILESTONE_MET | chain.milestone_states[0] |
| 0x0B | COND_RATIFICATION_COMPLETE | chain.ratified |
| 0x0C | COND_HAS_COMPOUND | record.setup_byte.compound_value===1 |
| 0x0D | COND_DISPUTED | chain.disputed |
| 0x0E | COND_HAS_TRIG | record.meta2.has_trig_block |

**Extended conditions (escape byte format `[CAT:4][ID:4]`):**
- CAT 0x0: date/time (DATE_REACHED, TIMELOCK_EXPIRED, WITHIN_WINDOW, DUE_DATE_PASSED)
- CAT 0x1: payment (DEPOSIT_CONFIRMED, AMOUNT_THRESHOLD_MET, FULL_PAYMENT_CONFIRMED, PARTIAL_PAYMENT)
- CAT 0x2: identity (ROLE_VERIFIED, CERT_HELD, QUORUM_MET, LEAD_PARTY_CONFIRMED)
- CAT 0x3: chain/state (ALL_MILESTONES_MET, CHAIN_COMPLETE, AMENDMENT_PRESENT, CHAIN_DEPTH_REACHED)
- CAT 0x4: ACK/doc (RECEIPT_CONFIRMED, SATISFACTION_CONFIRMED, SIGNATURE_PRESENT, TERMS_AGREED)
- CAT 0x6: server/async (SERVER_EVALUATION_RECEIVED)
- CAT 0x8–0xE: reserved → halt('unknown_condition')

End of program: `stack.reduce((acc, v) => acc && !!v, true)` — AND of all remaining stack values.

### 2. Agreements Helpers (agreements.js)

Exposes `global.WPAgreements`:

| Function | Description |
|----------|-------------|
| `isRatified(chain)` | Returns true when ≥1 counterparty has a CHAIN+commit_type reply |
| `encodeRatificationBitmap(partyMask, fullyRatified)` | 1-byte bitmap: bits 0–6 = party slots, bit 7 = FULLY_RATIFIED |
| `decodeRatificationBitmap(byte)` | Returns `{ partyMask, fullyRatified }` |
| `buildDisputeAmendmentOpts(parentUid, opts)` | Returns opts for WPCodec.encode() to build a Dispute Amendment |

**isRatified algorithm:**
1. Find offer: `ack_request=true` AND `chain=false`
2. Find replies: `chain=true` AND `commit_type != null`
3. Count unique `sender_uid` in replies where `sender_uid !== offer.sender_uid`
4. `uniqueCount >= (threshold - 1)` where `threshold = offer.threshold_n ?? 2`

**DISPUTE_LINK Amendment:** `buildDisputeAmendmentOpts(parentUid, {story})` returns opts with `baseTemplate=6`, `chain=true`, `disputeLink=true`, `parentUid=Uint8Array(8)`. The codec already encodes and decodes this correctly — `_amendment.disputeLink` and `_amendment.parentUid` are preserved in the decoded record.

---

## Design Decisions

### 1. Return type: status-based (`{ status, value, reason }`) not flag-based

The CODEC-WORKPLAN described `{ resolved, halted, error }` as booleans but the CTRIG-EVALUATOR-DESIGN.md spec defines a proper discriminated union. Status-based is cleaner: exactly one status is active, value/reason are present only when meaningful.

### 2. COMPLETE=0xD, DISPUTE=0xE (not PUSH_LIT)

In trig.js (display TRIG), opcode 0xD=PUSH_COND and 0xE=PUSH_LIT. In ctrig.js (obligation C-TRIG), these are repurposed: 0xD=COMPLETE and 0xE=DISPUTE. The instruction sets are separate evaluators — no PUSH_LIT in C-TRIG MVP.

**Consequence for tests:** boolean values can't be pushed directly in C-TRIG. Test programs use PUSH_COND with controlled context, REQUIRE_ACK, or COMPARE_AMT with stack underflow zeros.

### 3. Stack underflow returns safe defaults

Pop from empty stack returns `0` for numeric ops (COMPARE_AMT) and `false` for boolean ops (AND, OR, NOT, IF_THEN, BRANCH). This matches the spec's UNKNOWN propagation intent without adding a third stack value type for MVP.

### 4. agreements.js decoupled from codec internals

`isRatified(chain)` takes a plain array of chain record summaries — not raw pads-v1 bytes. The app layer resolves chain records before calling. `buildDisputeAmendmentOpts` generates opts for the existing codec Amendment encoder — no new wire format constructs needed.

---

## Test Coverage Added (46 new tests)

**ctrig.js (37 tests):**
- Empty program → resolved(true) (2)
- Program > 32 bytes → error (2)
- Stack overflow → error (2)
- PUSH_COND direct: ACK_RECEIVED T/F (2), DATE_REACHED T/F (2) = 4
- PUSH_COND extended: FULL_PAYMENT_CONFIRMED T/F (2)
- COMPARE_AMT: ==, !=, >= with underflow (3)
- COMPARE_AMT percentage threshold (2)
- COMPARE_AMT invalid operator (1)
- AND: T&T, F&F (2)
- OR: F|T (1)
- NOT: T→F, F→T (2)
- TIME_LOCK: reached, locked, missing date (3)
- BRANCH: true path, false path, OOB (3)
- VERSION: ok, too high, unsupported features (3)
- COMPLETE + DISPUTE (2)
- IF_THEN: true, false (2)

**agreements.js (9 tests):**
- isRatified bilateral (1), same sender (1), no offer (1) = 3
- encodeRatificationBitmap: FULLY_RATIFIED bit, partyMask bits = 2
- decodeRatificationBitmap: partyMask, fullyRatified = 2
- DISPUTE_LINK Amendment roundtrip: disputeLink, parentUid[0], parentUid[7] = 3

Total: 46 new assertions.

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/ctrig.js` | New file: C-TRIG obligation evaluator, ~200 lines |
| `js/lib/agreements.js` | New file: isRatified, ratification bitmap, dispute amendment builder, ~70 lines |
| `test/codec-pads-v1.test.js` | ctrig.js + agreements.js loading; 46 Round 10 tests |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 10 checklist updated |

---

## Open Items Carried Into Round 11

- Offer record EXT_TEMPLATE path: codec already supports encoding; no dedicated test added (existing EXT_TEMPLATE tests from Round 8 cover the wire format)
- Acceptance State Commit wire format: COMMIT_TYPE=10 uses existing codec; ratification bitmap is in agreements.js helpers (not in wire format itself for MVP — carried in `tag` field per AGREEMENTS-DESIGN §9)
- Round 11: Markers — RATIFIED_FRAME builder, Marker UID generation (did:stone:), write token encode/verify, P2P Option E, `#1pm/` tag
