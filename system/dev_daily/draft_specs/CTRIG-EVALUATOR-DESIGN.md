# C-TRIG Evaluator Architecture Design

**Status:** draft-spec — 2026-05-17
**Addresses:** OQ-40 (all sub-questions resolved)
**Depends on:** AGREEMENTS-DESIGN.md §3, C-TRIG-EXTENDED-CONDITIONS.md
**Maturity:** notes → design → **draft-spec** → spec → standard-doc

---

## 1. Overview

The C-TRIG evaluator is a stack machine that executes obligation bytecode against a resolved chain state. It is stateless between runs — the chain record state is the source of truth, not evaluator memory. On any halt (async condition, unknown opcode, malformed program), the evaluator re-runs from byte 0 when re-triggered.

**Design constraints:**
- KaiOS compatible — pure JS, no dependencies beyond the existing codec
- Max program: 32 bytes — bounded execution, no infinite loops possible
- Max stack depth: 8 values — sufficient for any valid 32-byte program
- Stateless — no persistence between runs; chain state is always re-read fresh

---

## 2. Evaluator Inputs

```
Evaluator.run(program, context) → Result

program:   Uint8Array        — C-TRIG bytecode (max 32 bytes)

context:
  record         PadsRecord   — the decoded pads-v1 frame being evaluated
  chain          ChainState   — pre-resolved chain context (see §2.1)
  timestamp      uint16       — current COMPACT_TIME value
  parties        Party[]      — resolved participant identities
  serverResults  Map          — cached server evaluation results (for async conditions)
```

### 2.1 ChainState (pre-resolved by app before calling evaluator)

The app resolves chain state once before each evaluation run. This is the boundary between app logic and evaluator logic — the evaluator never fetches records itself.

```javascript
ChainState {
  records: [{
    uid:          string        — record identifier
    template:     uint4         — BASE_TEMPLATE value
    commit_type:  uint2|null    — COMMIT_TYPE if State Commit
    sender_uid:   string        — IS_SENDER participant identity
    ack_present:  boolean       — ACK_REQUEST was set AND a reply exists in chain
    financial: {
      total:      Amount|null   — customer_amount (BitLedger encoded)
      paid:       Amount|null   — confirmed paid amount from I<I records in chain
      deposit:    Amount|null   — deposit_paid if present
    }|null
    timestamp:    uint16        — COMPACT_TIME of record creation
    depth:        uint8         — chain depth (0 = root)
  }]

  // Pre-computed aggregates (app layer, not evaluator):
  party_count:      uint8       — distinct IS_SENDER parties in chain
  ack_count:        uint8       — parties who have sent an ACK
  milestone_states: boolean[]   — which milestone indexes are marked complete
  ratified:         boolean     — bilateral ratification detected
  disputed:         boolean     — DISPUTE_LINK amendment present in chain
}
```

---

## 3. Stack Machine

```
Stack:
  values: (boolean | uint24)[]   — max 8 entries
  
  push(v)   — add to top
  pop()     — remove from top; returns UNKNOWN if empty
  peek()    — read top without removing

Result type:
  { status: 'resolved', value: boolean }
  { status: 'halted',   reason: string, condition_id: string }
  { status: 'error',    reason: string }
```

**Stack value types:**
- Boolean: condition results (`true` / `false`)
- uint24: numeric values for arithmetic conditions (OQ-40d — see §6)
- UNKNOWN: unresolvable — propagates like `null` through AND/OR (pessimistic: UNKNOWN AND true = UNKNOWN)

---

## 4. Instruction Execution

```
pc = 0
while pc < program.length AND pc < 32:
  byte     = program[pc]
  opcode   = byte >> 4        — high nibble
  imm      = byte & 0xF       — low nibble
  
  switch opcode:
    0x0  COMPARE_AMT → b=pop(); a=pop(); push(compare(a, b, operator=imm)); see §4.1
    0x1  PUSH_COND   → resolve condition (see §5); push result; if imm=0xF: pc++ (consume escape byte)
    0x2  RELEASE_AMT → app.prefillRecord('payment_request', {milestone: imm}); push true
    0x3  TRIGGER_OBL → app.prefillRecord('obligation', {clause: imm}); push true
    0x4  ASSERT_STATE→ app.prefillRecord('state_commit', {state: imm}); push true
    0x5  REQUIRE_ACK → push (chain.ack_count > 0)
    0x6  TIME_LOCK   → date = milestoneDate(imm, context); if context.timestamp >= date: push true; else HALT('timelock')
    0x7  MARKER_WRITE→ app.prefillRecord('marker_write', {party: imm}); push true
    0x8  AND         → b=pop(); a=pop(); push(a AND b)
    0x9  OR          → b=pop(); a=pop(); push(a OR b)
    0xA  NOT         → a=pop(); push(NOT a)
    0xB  IF_THEN     → cond=pop(); if !cond: pc++ (skip next instruction)
    0xC  BRANCH      → cond=pop(); offset=(cond ? program[pc+1] : program[pc+2]); pc+=2+offset; continue
    0xD  COMPLETE    → app.prefillRecord('completion'); return resolved(true)
    0xE  DISPUTE     → app.prefillRecord('dispute', {clause: imm}); return resolved(false)
    0xF  VERSION     → if program[pc+1] > EVALUATOR_VERSION: return halt('version_unsupported')
                       // program[pc+2] = feature_flags; unsupported bits → halt('unsupported_features')
                       pc+=2
  
  pc++

// End of program: result = stack top (or AND of all remaining values)
result = stack.values.reduce((acc, v) => acc AND v, true)
```

### 4.1 COMPARE_AMT — Opcode 0x0

Pops two uint24 values from the stack, compares them, pushes boolean result.

| imm | Operator | Expression |
|-----|----------|-----------|
| 0x0 | `>=` | a >= b |
| 0x1 | `>` | a > b |
| 0x2 | `==` | a == b |
| 0x3 | `<` | a < b |
| 0x4 | `<=` | a <= b |
| 0x5 | `!=` | a != b |
| 0x6–0xE | reserved | `error('invalid_operator')` |
| 0xF | percentage threshold | next byte = threshold (uint8, units = 0.5%; 100 = 50%, 200 = 100%); push (a >= b × threshold / 200) |

**Stack underflow:** if fewer than two numeric values are available, push UNKNOWN.

**Common amount comparisons go through CAT 0x1 named conditions** (FULL_PAYMENT_CONFIRMED, PARTIAL_PAYMENT, DEPOSIT_CONFIRMED) — these require no PUSH_AMT instruction. COMPARE_AMT with explicit operands uses PUSH_FIELD / PUSH_CONST instructions, available post-MVP via the VERSION escape extension path.

### 4.2 TIME_LOCK Date Resolution

`milestoneDate(imm, context)`:
- imm 0–14: `context.chain.milestone_states[imm].date` (uint16 COMPACT_TIME days)
- imm 0xF: `context.record.fields.due_date` — uses record's due_date field

If the referenced date is null (milestone not found, no due_date): evaluator treats as `DATE_NOT_SET` → `halt('timelock_date_missing')`.

### 4.3 BRANCH Offset Semantics

BRANCH is a 3-byte instruction: `[0xC_][true_offset][false_offset]`.

Offsets are **relative forward byte counts** from the first byte after the BRANCH instruction (i.e. from `pc + 3`). Offset 0 = execute the immediately following instruction (no skip). Offset 1 = skip one byte. Negative offsets are not supported — all offsets are uint8.

```
pc_after_branch = pc + 3                    // first byte after the 3-byte BRANCH
target_pc = pc_after_branch + offset        // forward jump
if target_pc >= program.length OR target_pc >= 32:
  return error('branch_out_of_bounds')
pc = target_pc - 1                          // -1 because pc++ follows
```

### 4.4 VERSION Opcode Semantics

3-byte instruction: `[0xF_][min_version][feature_flags]`.

- imm (low nibble of byte 1): reserved, must be 0x0
- byte 2: `min_version` (uint8) — minimum evaluator version required to run this program
- byte 3: `feature_flags` (uint8 bitmask) — capability bits this program requires

```
EVALUATOR_VERSION = 1   // current version

if min_version > EVALUATOR_VERSION:
  return halt('version_unsupported')    // newer evaluator needed

unsupported = feature_flags & ~SUPPORTED_FEATURES
if unsupported !== 0:
  return halt('unsupported_features')   // unknown capability required
```

**SUPPORTED_FEATURES bitmask (v1):**
```
bit 0: NUMERIC_STACK    — uint24 values on stack (always 1 in v1)
bit 1: COMPARE_AMT      — 0x0 opcode (always 1 in v1)
bit 2: EXTENDED_COND    — CAT escape byte (always 1 in v1)
bits 3–7: reserved      — future capabilities
```

**Pre-fill behaviour (RELEASE_AMT, TRIGGER_OBL, ASSERT_STATE, MARKER_WRITE):**
These instructions do not execute an action directly — they call `app.prefillRecord()` which builds a pre-populated record for the user to review and send. Execution continues; the push of `true` signals the condition was triggered (not that the action was completed). The action completes when the user approves the pre-filled record.

---

## 5. Condition Resolution

```javascript
function resolveCondition(imm, escByte, context) {
  if (imm !== 0xF) {
    // Direct condition: imm = condition ID 0x0–0xE
    return resolveDirectCondition(imm, context)
  }
  
  // Extended condition: escByte is byte 2
  const category = escByte >> 4
  const id       = escByte & 0xF
  return resolveExtendedCondition(category, id, context)
}
```

### 5.1 Direct Conditions (0x00–0x0E)

| ID | Condition | Evaluation |
|----|-----------|-----------|
| 0x00 | HAS_PHONE | record.participants.some(p => p.has_phone) |
| 0x01 | IS_ORG | record.participants.some(p => p.is_org) |
| 0x02 | ROLE_TYPE_CUSTOMER | record.participants.some(p => p.role_type === 0) |
| 0x03 | ROLE_TYPE_WORKER | record.participants.some(p => p.role_type === 1) |
| 0x04 | HAS_FINANCIAL_BLOCK | record.has_financial_block |
| 0x05 | DATE_REACHED | context.timestamp >= record.date |
| 0x06 | HAS_LOCATION | record.fields.location !== null |
| 0x07 | IS_CHAIN | record.meta1.chain === 1 |
| 0x08 | ACK_RECEIVED | context.chain.ack_count > 0 |
| 0x09 | PAYMENT_CONFIRMED | context.chain.records.some(r => r.template===0x1 && r.commit_type===0x1) |
| 0x0A | MILESTONE_MET | context.chain.milestone_states[imm] — uses imm as milestone index when in milestone context |
| 0x0B | RATIFICATION_COMPLETE | context.chain.ratified |
| 0x0C | HAS_COMPOUND | record.setup_byte?.compound_value === 1 |
| 0x0D | DISPUTED | context.chain.disputed |
| 0x0E | HAS_TRIG | record.meta2?.has_trig_block === 1 |

### 5.2 Extended Conditions by Category

**CAT 0x0 — Time/date**
| ID | Condition |
|----|-----------|
| 0x0 | DATE_REACHED (milestone date from milestone table) |
| 0x1 | TIMELOCK_EXPIRED (time_lock instruction's target date passed) |
| 0x2 | WITHIN_WINDOW (current time between date_start and date_end) |
| 0x3 | DUE_DATE_PASSED (record.due_date < context.timestamp) |
| 0x4–0xF | Reserved |

**CAT 0x1 — Payment**
| ID | Condition |
|----|-----------|
| 0x0 | DEPOSIT_CONFIRMED (deposit_paid field present in a chain record) |
| 0x1 | AMOUNT_THRESHOLD_MET (see §6 — OQ-40d) |
| 0x2 | FULL_PAYMENT_CONFIRMED (paid >= total in chain) |
| 0x3 | PARTIAL_PAYMENT (0 < paid < total) |
| 0x4–0xF | Reserved |

**CAT 0x2 — Identity/role**
| ID | Condition |
|----|-----------|
| 0x0 | ROLE_VERIFIED (role_code present AND cert signal set) |
| 0x1 | CERT_HELD (ROLE_SIGNALS bit 2 = CERT set for any participant) |
| 0x2 | QUORUM_MET (party writes >= threshold; threshold from low nibble or clause block) |
| 0x3 | LEAD_PARTY_CONFIRMED (ROLE_SIGNALS bit 0 = LEAD participant has written) |
| 0x4–0xF | Reserved |

**CAT 0x3 — Chain/state**
| ID | Condition |
|----|-----------|
| 0x0 | ALL_MILESTONES_MET (all milestone_states true) |
| 0x1 | CHAIN_COMPLETE (meta1 CHAIN_COMPLETE=1 in any chain record) |
| 0x2 | AMENDMENT_PRESENT (BASE_TEMPLATE=110 record in chain) |
| 0x3 | CHAIN_DEPTH_REACHED (chain.records.length >= threshold) |
| 0x4–0xF | Reserved |

**CAT 0x4 — Document/ACK**
| ID | Condition |
|----|-----------|
| 0x0 | RECEIPT_CONFIRMED (State Commit COMMIT_TYPE=01 in chain) |
| 0x1 | SATISFACTION_CONFIRMED (State Commit with story containing acceptance signal) |
| 0x2 | SIGNATURE_PRESENT (cryptographic signature field in chain record) |
| 0x3 | TERMS_AGREED (State Commit COMMIT_TYPE=10 in chain) |
| 0x4–0xF | Reserved |

**CAT 0x5 — Location**
| ID | Condition |
|----|-----------|
| 0x0 | LOCATION_VERIFIED (location field present AND matches expected) |
| 0x1 | WITHIN_ZONE (location within declared service area) |
| 0x2–0xF | Reserved |

**CAT 0x6 — Server/async**
| ID | Condition |
|----|-----------|
| 0x0 | SERVER_EVALUATION_RECEIVED (serverResults has entry for this condition) |
| 0x1 | PAYMENT_GATEWAY_CONFIRMED (payment gateway callback received) |
| 0x2 | THIRD_PARTY_VERIFIED (external identity verification complete) |
| 0x3–0xF | Reserved |

**CAT 0x7 — Cryptographic**
| ID | Condition |
|----|-----------|
| 0x0 | PREIMAGE_REVEALED (hash preimage delivered — HTLC-style) |
| 0x1 | HASH_COMMITMENT_MET (SHA-256 of record bytes matches stored commitment) |
| 0x2 | WRITE_SIG_VALID (Stone write signature verifies against party public key) |
| 0x3–0xF | Reserved |

**CAT 0x8–0xE — Reserved** (treat as UNKNOWN, halt)

**CAT 0xF — Further escape** (3-byte form — byte 3 = full 8-bit extended condition ID)

---

## 6. OQ-40d — Arithmetic Scope Decision

**The question:** Does the evaluator do arithmetic on financial block amounts — or does the app pre-compute amount comparisons to boolean flags before calling the evaluator?

### Option A — App pre-computes (boolean-only evaluator)

```javascript
// App layer resolves before calling evaluator:
chain_state.amount_threshold_met = (chain_state.total_paid >= record.customer_amount)

// Evaluator CAT 0x1 ID 0x1 AMOUNT_THRESHOLD_MET:
return context.chain.amount_threshold_met   // just reads a boolean
```

**Evaluator complexity:** ~120 lines of JS total. No amount parsing needed inside evaluator.
**Limitation:** The threshold is always "paid >= invoice total." Custom thresholds (e.g. "paid >= 50% of total") require the app to pre-compute each specific comparison — adding app-layer complexity for each new condition type.

### Option B — Evaluator reads amounts directly

```javascript
// Evaluator CAT 0x1 ID 0x1 AMOUNT_THRESHOLD_MET:
const paid  = BitLedger.decode(context.chain.total_paid)   // reuse existing codec function
const total = BitLedger.decode(context.record.customer_amount)
return paid >= total
```

**Evaluator complexity:** +30 lines (one call to BitLedger.decode, already implemented in codec). Stack gains a numeric type alongside boolean.
**Benefit:** Any amount comparison is first-class in C-TRIG. Custom thresholds (50% deposit, partial payment gates) work without app changes. Future `COMPARE_AMT` instruction becomes possible.

### Concrete implementation cost comparison

| | Option A | Option B |
|--|---------|---------|
| Evaluator lines of JS | ~120 | ~150 |
| Stack value types | boolean only | boolean + uint24 |
| New codec dependency | none | BitLedger.decode (already exists) |
| Custom threshold support | app-layer per-condition | first-class in evaluator |
| Future COMPARE_AMT instruction | not possible | natural extension |

**Recommendation:** Option B. The cost is 30 lines and one function call reuse. The benefit is that the payment/amount domain — the most important domain for trade agreements — is first-class in the evaluator rather than a pre-computation workaround. The formula-forward record design (formulas are the primary statement of how charges work) makes numeric stack values a natural fit.

---

## 7. Complete Evaluator Pseudocode

```javascript
function evaluate(program, context) {
  if (program.length > 32) return error('program_too_long')
  
  const stack = []
  let pc = 0

  while (pc < program.length) {
    const byte   = program[pc]
    const opcode = byte >> 4
    const imm    = byte & 0xF

    switch (opcode) {

      case 0x0: { // COMPARE_AMT
        const b = stack.pop(); const a = stack.pop()
        if (imm === 0xF) {
          pc++
          const pct = program[pc] // uint8, units = 0.5%; 200 = 100%
          stack.push(a >= Math.round(b * pct / 200))
        } else {
          const cmpTable = [(a,b)=>a>=b,(a,b)=>a>b,(a,b)=>a===b,(a,b)=>a<b,(a,b)=>a<=b,(a,b)=>a!==b]
          stack.push(imm < cmpTable.length ? cmpTable[imm](a, b) : false)
        }
        break
      }

      case 0x1: { // PUSH_COND
        let cond
        if (imm === 0xF) {
          pc++
          if (pc >= program.length) return error('unexpected_end')
          cond = resolveExtended(program[pc], context)
        } else {
          cond = resolveDirect(imm, context)
        }
        if (cond === 'HALT') return halt(cond.reason, context)
        stack.push(cond)
        break
      }

      case 0x2: app.prefillRecord('payment_request', { milestone: imm }); stack.push(true); break
      case 0x3: app.prefillRecord('obligation',      { clause:    imm }); stack.push(true); break
      case 0x4: app.prefillRecord('state_commit',    { state:     imm }); stack.push(true); break
      case 0x5: stack.push(context.chain.ack_count > 0); break
      case 0x6: {
        const locked = !resolveDirect(0x05, context) // DATE_REACHED
        if (locked) return halt('timelock', context)
        stack.push(true); break
      }
      case 0x7: app.prefillRecord('marker_write', { party: imm }); stack.push(true); break

      case 0x8: { const b = stack.pop(); const a = stack.pop(); stack.push(a && b); break }
      case 0x9: { const b = stack.pop(); const a = stack.pop(); stack.push(a || b); break }
      case 0xA: { const a = stack.pop(); stack.push(!a); break }

      case 0xB: { // IF_THEN
        const cond = stack.pop()
        if (!cond) pc++ // skip next instruction
        break
      }

      case 0xC: { // BRANCH (3-byte)
        const cond       = stack.pop()
        const true_ref   = program[pc + 1]
        const false_ref  = program[pc + 2]
        pc += (cond ? true_ref : false_ref) + 2
        continue // skip pc++ below
      }

      case 0xD: app.prefillRecord('completion'); return resolved(true)
      case 0xE: app.prefillRecord('dispute', { clause: imm }); return resolved(false)

      case 0xF: { // VERSION escape (3-byte)
        pc += 2; break
      }
    }

    pc++
  }

  // End of program: AND all remaining stack values
  const result = stack.reduce((acc, v) => acc && v, true)
  return resolved(result)
}
```

---

## 8. Error and Edge Cases

| Condition | Evaluator response |
|-----------|-------------------|
| Program > 32 bytes | `error('program_too_long')` — agreement marked malformed |
| Stack underflow (pop from empty stack) | Push UNKNOWN; continue |
| Stack overflow (> 8 values) | `error('stack_overflow')` — agreement marked malformed |
| Unknown opcode | `error('unknown_opcode')` — agreement marked malformed |
| Async condition (CAT 0x6) not in serverResults | `halt('awaiting_server')` — re-evaluate on server response |
| CAT 0x8–0xE (reserved) | `halt('unknown_condition')` — agreement shows "contains unrecognised conditions" |
| CAT 0xF without third byte | `error('escape_truncated')` |
| BRANCH target out of bounds | `error('branch_out_of_bounds')` |

---

## 9. OQ-40d — Decision Required

**Choose the evaluator's arithmetic scope:**

**Option A:** Boolean-only. Amount comparisons pre-computed by app layer. ~120 lines. Custom thresholds require app-layer additions.

**Option B:** Numeric stack. Evaluator calls `BitLedger.decode()` for amount conditions. ~150 lines. Amount comparisons first-class. Future `COMPARE_AMT` instruction natural. Aligns with formula-forward record design.

**RESOLVED — Option B.** Numeric stack. Evaluator calls `BitLedger.decode()` for amount conditions. ~150 lines JS. Amount comparisons first-class. Future `COMPARE_AMT` instruction natural extension. Aligns with formula-forward record design.
