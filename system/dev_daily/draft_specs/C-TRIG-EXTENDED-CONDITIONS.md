# C-TRIG Extended Condition Registry — Research Report

**Status:** research notes — 2026-05-17  
**Addresses:** OQ-40 (OPEN-QUESTIONS.md)  
**Depends on:** AGREEMENTS-DESIGN.md §3.4, TRIG-DESIGN.md  
**Maturity:** notes → design → draft-spec → spec → standard-doc

---

## Summary

This document addresses OQ-40: the design of the escape byte for the C-TRIG `PUSH_COND(0x1F)` extended condition registry. It covers the condition taxonomies found in smart contract and Ricardian contract literature, P2P enforcement primitives, field-worker use case requirements, escape byte layout options, and legal enforceability considerations for African markets.

---

## 1. Smart Contract Condition Taxonomies

### 1.1 Ethereum Solidity / EVM-based Contracts

Solidity conditionals in deployed contracts cluster into five observable categories:

**Time-based**: `block.timestamp >= releaseTime`, `block.number >= blockDeadline`. The EVM exposes a monotonic block clock. Real-world patterns include: vesting schedules, timelock governance (e.g. OpenZeppelin TimelockController), payment release after cooling-off periods, option expiry. Dominant in DeFi escrow and token vesting contracts.

**State/event-based**: `hasPaid[address] == true`, `milestoneComplete[index] == true`. These are boolean flags set by prior transactions. Dominant in multi-stage payment contracts (e.g. Gnosis Safe multisig execution, escrow contracts). State checks require that some prior transaction wrote the state — the condition is a read of a previously-set flag.

**Identity/role-based**: `msg.sender == owner`, `hasRole(WORKER_ROLE, msg.sender)`, `isKYCVerified[msg.sender]`. OpenZeppelin's AccessControl pattern separates role granting from role checking. Equivalent: C-TRIG's IS_ORG, ROLE_TYPE, HAS_PHONE.

**Amount/threshold-based**: `msg.value >= minimumDeposit`, `totalPaid >= invoiceAmount`. These are numeric comparisons against a threshold. In bilateral payment contracts, the condition "has enough been paid" is the most commonly checked condition after time.

**Signature/cryptographic-proof-based**: `ecrecover(hash, v, r, s) == expectedSigner`. This is the authorisation pattern — a condition is satisfied when a valid cryptographic signature from an expected party is provided. Directly analogous to ACK_RECEIVED in C-TRIG.

### 1.2 Ricardian Contracts (Ian Grigg, 1996–2004)

Grigg's Ricardian contract model defines a contract as a document that is simultaneously human-readable prose, machine-parseable data, and cryptographically signed. Key principles relevant to C-TRIG:

**Conditions are mostly declarative, not programmatic.** A Ricardian contract states terms; it does not execute them. "Payment due within 30 days of invoice" is a condition expressed as text and tagged with machine-readable dates and amounts. The contract is evidence and specification; enforcement is external to the document.

**The "hash of the contract" is the binding link.** In Grigg's model, the condition `CONTRACT_SIGNED` is satisfied when a signature over the SHA-1/SHA-256 hash of the document exists from an expected party. This maps directly to C-TRIG's need for `SIGNATURE_PRESENT` as a condition — "has a valid signature been provided over this record's canonical hash?"

**Human vs machine conditions.** Grigg distinguishes between:
- *Objective conditions*: checkable by a machine from data (date reached, payment amount received)
- *Subjective conditions*: require human judgement (work quality acceptable, goods as described)

This distinction is critical for C-TRIG. Objective conditions can be checked client-locally by the evaluator. Subjective conditions must be encoded as `ACK_RECEIVED` patterns — the human's judgement is externalised as a signed acknowledgment. C-TRIG should never try to evaluate subjective conditions directly.

**Condition categories from the Ricardian literature:**
- Temporal: before/after specific dates, within time windows
- Payment: amount received, payment source verified, currency type
- Authority: issuer signature present, counter-party signature, guarantor signature
- Compliance: regulatory check passed, KYC status, licence valid
- Conditional precedent: prior obligation met (cascading conditions)

### 1.3 OpenLaw / Accord Project

OpenLaw (now part of the OpenLaw/ACTUS ecosystem) and the Accord Project (Cicero engine) formalise contract templates with executable logic. Their condition taxonomies add:

**Obligation conditions** (Accord Project's Ergo language):
- `PaymentObligation`: amount due, currency, party, deadline
- `NotificationObligation`: notice sent, receipt confirmed  
- `DeliveryObligation`: item transferred, receipt confirmed
- `InformationObligation`: disclosure provided, acknowledged

**Event conditions** (mapping from Accord to C-TRIG concepts):
- `NOTICE_SENT`: a formal notification has been dispatched
- `RECEIPT_CONFIRMED`: counter-party has confirmed receipt of goods/services
- `BREACH_DECLARED`: one party has formally flagged non-performance
- `WAIVER_GIVEN`: one party has waived a right (modifies obligation)
- `FORCE_MAJEURE`: external circumstance suspends obligations

These categories map well to field-worker contexts. "Receipt confirmed" = worker confirmed delivery. "Notice sent" = client received invoice notification. "Breach declared" = party raised a dispute (C-TRIG already has DISPUTE opcode — but a `BREACH_DECLARED` condition lets other conditions branch on whether a breach is active).

---

## 2. Ricardian Contract Model and C-TRIG

The key insight from Grigg for C-TRIG: **conditions are witnesses, not oracles.** A condition check in C-TRIG is not a live query of an external system — it is a check of whether a witnessed event has been recorded in the local chain state. This aligns with C-TRIG's evaluation model (client-local, synchronous, no network).

This means every C-TRIG condition maps to one of:
1. **Local state read**: has the local device recorded evidence of event X? (ACK_RECEIVED, PAYMENT_CONFIRMED)
2. **Clock query**: has time T been reached? (DATE_REACHED)
3. **Identity check**: does this record's participant meet property P? (IS_ORG, ROLE_TYPE)
4. **Chain state check**: does the agreement chain contain record type X? (MILESTONE_MET)

The Ricardian "hash of the contract" concept suggests one important extended condition: `RATIFICATION_COMPLETE` — have both parties signed/acknowledged the agreement record? This is currently detectable from chain state but deserves an explicit condition code.

---

## 3. P2P Enforcement Primitives

### 3.1 Lightning Network HTLCs (Hash Time-Locked Contracts)

HTLCs use exactly two condition types:
1. **Hash preimage reveal**: `sha256(preimage) == hashlock`. Funds released if counterparty reveals the preimage (proves they received payment on another channel).
2. **Timelock expiry**: `CLTV_expiry < current_block`. Funds returned if the timelock expires without preimage.

The HTLC model is instructive because it achieves bilateral enforcement with only two primitives: a hash witness condition and a time condition. For C-TRIG, the analogues are:
- **PREIMAGE_REVEALED**: a hash preimage has been provided (can be used to prove delivery of a secret — e.g. door code for property access, PIN for equipment handover)
- **TIMELOCK_EXPIRED**: the agreement's time window has passed without the trigger condition firing

### 3.2 Bitcoin Script Primitives

Bitcoin Script (a stack machine like C-TRIG) uses these condition check opcodes:
- `OP_CHECKSIG` / `OP_CHECKMULTISIG`: signature verification
- `OP_CHECKLOCKTIMEVERIFY` (CLTV): absolute timelock
- `OP_CHECKSEQUENCEVERIFY` (CSV): relative timelock (time since input was confirmed)
- `OP_HASH160` / `OP_EQUAL`: hash preimage check

For C-TRIG, Bitcoin Script confirms: time locks and signature checks are the two indispensable P2P enforcement primitives. Everything else is application-layer.

### 3.3 Multi-sig Threshold Conditions

A common P2P pattern is M-of-N: condition satisfied when M out of N parties have signed. For bilateral (2-party) agreements this is trivially either "both signed" (2-of-2) or "either signed" (1-of-2). For multi-party agreements (C-TRIG participants block supports up to 7 parties), a `QUORUM_MET` condition is valuable — "at least N of the K participants have acknowledged/signed."

---

## 4. Field-Worker Use Case Condition Requirements

Workpads field-worker scenarios require the following condition categories (derived from the use cases named in the brief):

### 4.1 Invoice Payment Confirmation
- `PAYMENT_CONFIRMED` (already in direct registry)
- `AMOUNT_THRESHOLD_MET`: total paid ≥ agreed invoice amount (requires comparison, not just event presence)
- `OVERPAYMENT_DETECTED`: total paid > agreed amount (triggers dispute or credit)
- `PARTIAL_PAYMENT_MADE`: at least one payment exists, but total < invoice amount

### 4.2 Job Completion Acknowledgment
- `ACK_RECEIVED` (already in direct registry)
- `COUNTER_ACK_PENDING`: own acknowledgment sent, waiting for counterparty
- `DISPUTE_ACTIVE`: a dispute has been raised on this agreement chain
- `SATISFACTION_CONFIRMED`: explicit quality-of-work acknowledgment (vs mere receipt)

### 4.3 Deposit + Balance Milestone Release
- `DEPOSIT_PAID`: first payment in a milestone chain confirmed
- `BALANCE_DUE`: all milestones complete, final balance not yet paid
- `MILESTONE_MET` (already in direct registry)
- `ALL_MILESTONES_MET`: all milestones in the milestone table complete

### 4.4 Service Contract with Clauses
- `CLAUSE_ACCEPTED`: specific clause has been accepted by counterparty
- `AMENDMENT_PENDING`: an Amendment record exists with no counterparty reply
- `CONTRACT_ACTIVE`: agreement in ACTIVE state
- `CONTRACT_EXPIRED`: agreement DATE has passed

### 4.5 Whistleblower Forms / Privacy
- `IDENTITY_MASKED`: record was submitted via anonymous mode (ANON-MODE-DESIGN.md)
- `ENCRYPTION_ACTIVE`: record payload is encrypted (`1ps`/`1pt` tag context)
- `WITNESS_PRESENT`: a third-party participant (UID) is present in the participants block

### 4.6 Cross-Cutting Concerns
- `ARBITRATION_INVOKED`: dispute has been escalated to server arbitration (§3.3 of AGREEMENTS-DESIGN.md)
- `SERVER_CONFIRMED`: server has returned a signed evaluation result
- `OFFLINE_MODE`: device has no current server connectivity (triggers offline-compatible evaluation path)
- `MARKER_WRITTEN`: Marker hardware/software token has been written for this agreement
- `CHAIN_INTEGRITY_OK`: all records in the agreement chain pass hash verification

---

## 5. Escape Byte Design Options

The escape byte activates when `PUSH_COND` byte 1 = `0x1F`. Byte 2 is the "free design space." Three principal layout options:

### Option A: Category + ID (16 namespaces × 16 conditions)

```
Byte 2:  [CAT:4][ID:4]

CAT 0x0  = Time conditions          (16 slots)
CAT 0x1  = Payment conditions       (16 slots)
CAT 0x2  = Identity/role conditions (16 slots)
CAT 0x3  = Chain/state conditions   (16 slots)
CAT 0x4  = Document/ACK conditions  (16 slots)
CAT 0x5  = Location conditions      (16 slots)
CAT 0x6  = Arbitration conditions   (16 slots)
CAT 0x7  = Cryptographic conditions (16 slots)
CAT 0x8  = Milestone conditions     (16 slots)
CAT 0x9  = Clause conditions        (16 slots)
CAT 0xA  = Participant conditions   (16 slots)
CAT 0xB  = Network/server conditions(16 slots)
CAT 0xC  = Reserved                 (16 slots)
CAT 0xD  = Reserved                 (16 slots)
CAT 0xE  = Reserved                 (16 slots)
CAT 0xF  = Escape to 3-byte form    (byte 3 follows)
```

**Pros**: Large, organised vocabulary. 12 active categories × 16 slots = 192 extended conditions. Grouping by category makes the registry readable and extensible within categories. CAT=0xF provides a further escape to 3-byte programs for future expansion.

**Cons**: 3-byte instruction (1F + byte2 + byte3 if modifier needed). No room in byte 2 for modifiers — NEGATE, ASYNC, CACHED would need to be encoded as separate instructions (NOT opcode for NEGATE; ASYNC and CACHED as evaluator hints in byte 3).

### Option B: Modifier Flags + Extended ID (4 modifiers × 16 conditions = 64 variants)

```
Byte 2:  [MOD:4][ID:4]

MOD bit 3 (0x8) = NEGATE       condition result is inverted
MOD bit 2 (0x4) = ASYNC        condition may require async resolution
MOD bit 1 (0x2) = STRICT       fail-closed: UNKNOWN result treated as false
MOD bit 0 (0x1) = CACHED       use cached result from prior evaluation in this session

ID 0x0–0xE: 15 extended conditions (IDs 15–29 from a flat extended registry)
ID 0xF:     further escape (byte 3 follows for IDs 30+)
```

**Pros**: Compact. Only 15 base extended conditions, but each gets 16 flag variants. Modifier flags are genuinely useful: NEGATE avoids a NOT instruction, ASYNC handles conditions that need deferred evaluation (server confirmation), CACHED avoids redundant re-evaluation.

**Cons**: Only 15 extended condition IDs — severely limits vocabulary growth. ASYNC and CACHED modifiers bleed into the evaluator model (the evaluator must support async resolution, which is a significant complexity increase vs. the synchronous evaluation guarantee).

**Assessment of async concern**: The base TRIG evaluation model is strictly synchronous (see TRIG-DESIGN.md §4: "Every condition in TRIG is a local query answered synchronously"). C-TRIG is a different evaluator — it runs obligation logic, not display logic — and server-arbitrated conditions are already part of the C-TRIG model (AGREEMENTS-DESIGN.md §3.3). ASYNC modifier is architecturally sound for C-TRIG but not for display TRIG.

### Option C: Hybrid (Category × ID, with modifier encoded via modifier-prefix instruction)

```
Byte 2:  [CAT:4][ID:4]   — same as Option A

Modifiers handled by preceding instruction:
  0x8_ AND  (existing)
  0xA_ NOT  (existing — use before PUSH_COND for NEGATE)
  New instruction 0x5F MOD_FLAGS <flags-byte> — sets evaluation hints for the
    next PUSH_COND only
```

This treats modifiers as program-level concerns rather than condition-level concerns. NEGATE = precede with NOT. ASYNC = use MOD_FLAGS with ASYNC bit. CACHED = evaluator automatically caches within session (no explicit flag needed — always cache).

**Pros**: Clean separation. Byte 2 is entirely a condition namespace (192 slots). Modifiers are composable instructions. Compatible with the existing NOT/AND/OR instruction set.

**Cons**: Slightly longer programs when modifiers are needed. MOD_FLAGS is a new instruction consuming 3 bytes (opcode + flags byte + next instruction).

---

## 6. Recommended Escape Byte Layout

**Recommendation: Option A (Category + ID) with NEGATE handled via NOT instruction.**

Rationale:
1. The vocabulary growth case dominates. Field-worker agreements need a rich condition set. 15 extended slots (Option B) runs out quickly. 192 slots (Option A) gives room for a well-organised, growing registry.
2. NEGATE is already handled by the NOT opcode (0xA_). Encoding it in the modifier nibble would be redundant.
3. ASYNC conditions matter for C-TRIG but should be handled via the evaluator's general async resolution model, not per-condition flags. When a C-TRIG program encounters a condition that requires server confirmation, the evaluator pauses and presents the user with "Agreement evaluation pending server response" — this is evaluator behaviour, not a per-condition bit.
4. CAT=0xF as an escape to a 3-byte form is future-proof.

### Proposed Extended Condition Registry (Option A Layout)

**CAT 0x0 — Time conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `DEADLINE_REACHED` | Agreement deadline date passed | Local clock |
| 1 | `WITHIN_WINDOW` | Current time is within the agreed service window | Local clock |
| 2 | `TIMELOCK_EXPIRED` | Timelock date has passed without trigger condition firing | Local clock |
| 3 | `GRACE_PERIOD_ACTIVE` | Agreement overdue but within declared grace period | Local clock + agreement data |
| 4 | `RECURRING_DUE` | Recurring obligation date has arrived (retainer, subscription) | Local clock |
| 5–F | Reserved | — | — |

**CAT 0x1 — Payment conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `DEPOSIT_CONFIRMED` | First payment in milestone chain present in chain | Chain state |
| 1 | `AMOUNT_THRESHOLD_MET` | Total payments ≥ agreed invoice amount | Chain state + arithmetic |
| 2 | `PARTIAL_PAYMENT_MADE` | At least one payment present, total < invoice amount | Chain state |
| 3 | `OVERPAYMENT_DETECTED` | Total payments > agreed amount | Chain state |
| 4 | `BALANCE_RELEASED` | Final balance payment confirmed | Chain state |
| 5 | `REFUND_ISSUED` | A credit/refund record exists in chain | Chain state |
| 6–F | Reserved | — | — |

**CAT 0x2 — Identity/role conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `VERIFIED_WORKER` | Participant has ROLE_TYPE = worker and is verified | Participants block |
| 1 | `VERIFIED_CLIENT` | Participant has ROLE_TYPE = client and is verified | Participants block |
| 2 | `THIRD_PARTY_PRESENT` | Participants block contains a third-party UID | Participants block |
| 3 | `GUARANTOR_PRESENT` | Participants block contains a guarantor role | Participants block |
| 4 | `ARBITRATOR_ASSIGNED` | A server/arbitrator UID has been assigned | Chain state |
| 5–F | Reserved | — | — |

**CAT 0x3 — Chain/state conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `RATIFICATION_COMPLETE` | Both parties have acknowledged/signed (bilateral ratification) | Chain state |
| 1 | `AMENDMENT_PENDING` | An Amendment record exists without counterparty reply | Chain state |
| 2 | `DISPUTE_ACTIVE` | DISPUTE instruction has been evaluated; chain is disputed | Chain state |
| 3 | `CONTRACT_EXPIRED` | Agreement DATE has passed | Clock + agreement data |
| 4 | `CONTRACT_CANCELLED` | Mutual cancellation Amendment present | Chain state |
| 5 | `CHAIN_INTEGRITY_OK` | All records in agreement chain pass hash verification | Chain hashes |
| 6–F | Reserved | — | — |

**CAT 0x4 — Document/acknowledgment conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `SATISFACTION_CONFIRMED` | Explicit quality/satisfaction acknowledgment in chain | Chain state |
| 1 | `RECEIPT_CONFIRMED` | Goods/service delivery confirmed by recipient | Chain state |
| 2 | `NOTICE_DELIVERED` | Formal notification confirmed received | Chain state |
| 3 | `CLAUSE_ACCEPTED` | Specific clause has acceptance bit set in reply record | Acceptance mask |
| 4 | `ALL_CLAUSES_ACCEPTED` | All clauses accepted (full acceptance mask set) | Acceptance mask |
| 5 | `WAIVER_GIVEN` | One party has formally waived a right in this agreement | Chain state |
| 6 | `PREIMAGE_REVEALED` | Hash preimage provided (HTLC-style delivery proof) | Chain state |
| 7–F | Reserved | — | — |

**CAT 0x5 — Location conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `LOCATION_CONFIRMED` | Cached device position within geo block of agreement | Cached GPS + agreement geo |
| 1 | `SAME_JURISDICTION` | Both parties' registered jurisdictions match | Participants block |
| 2 | `SERVICE_AREA_MATCH` | Device location within declared service area | Cached GPS |
| 3–F | Reserved | — | — |

**CAT 0x6 — Arbitration conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `ARBITRATION_INVOKED` | Dispute has been escalated to server arbitration | Chain state |
| 1 | `SERVER_EVALUATION_RECEIVED` | Server has returned a signed evaluation result | Chain state |
| 2 | `EVALUATION_ACCEPTED` | Both parties have accepted the server evaluation | Chain state |
| 3 | `OFFLINE_EVALUATION` | Server unavailable; client-local evaluation only | Network state |
| 4–F | Reserved | — | — |

**CAT 0x7 — Cryptographic conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `SIGNATURE_PRESENT` | Valid signature over record hash from expected party | Signature block |
| 1 | `MULTISIG_THRESHOLD_MET` | M-of-N parties have signed (threshold in agreement data) | Signature count |
| 2 | `HASH_COMMITMENT_MET` | Hash commitment (Ricardian hash-of-contract) verified | Hash check |
| 3 | `ENCRYPTION_ACTIVE` | Record payload is encrypted (1ps/1pt tag context) | Tag check |
| 4–F | Reserved | — | — |

**CAT 0x8 — Milestone conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `ALL_MILESTONES_MET` | All milestones in milestone table complete | Milestone table |
| 1 | `NEXT_MILESTONE_DUE` | Next sequential milestone deadline reached | Clock + milestone table |
| 2 | `MILESTONE_OVERDUE` | A milestone deadline has passed without completion | Clock + milestone table |
| 3 | `FIRST_MILESTONE_MET` | First milestone in table complete (deposit confirmed) | Milestone table |
| 4–F | Reserved | — | — |

**CAT 0x9 — Participant/witness conditions**

| ID | Code | Condition | Evaluation |
|----|------|-----------|------------|
| 0 | `QUORUM_MET` | Minimum N participants have acknowledged (multi-party) | Participants + ACK count |
| 1 | `WITNESS_PRESENT` | At least one witness participant in participants block | Participants block |
| 2 | `IDENTITY_MASKED` | Record submitted via anonymous mode | Anon flag |
| 3 | `MARKER_WRITTEN` | Marker token has been written for this agreement | Marker state |
| 4–F | Reserved | — | — |

**CAT 0xA–0xE — Reserved** (future categories, subject to user decision)

**CAT 0xF — 3-byte escape** (byte 3 = full 8-bit extended condition ID, 256 further slots)

---

## 7. Legal Enforceability Considerations — African Markets

### 7.1 Electronic Transaction Frameworks

**Nigeria** — Cybercrimes Act 2015 and the Electronics Transaction Bill (passed Senate 2022; not yet commenced as of research date). Key principles: electronic signatures are legally valid; electronic records are admissible as evidence; a "reliable" electronic record is one that can be verified for authenticity and integrity. Implication: C-TRIG's `CHAIN_INTEGRITY_OK` and `SIGNATURE_PRESENT` conditions directly map to the integrity/authenticity requirements. An agreement chain with verified hashes and at least one signed record meets Nigerian evidentiary standards.

**Kenya** — Kenya Information and Communications Act (KICA) and the Computer Misuse and Cybercrimes Act 2018. Electronic contracts are valid when offer, acceptance, and consideration can be evidenced. A bilateral chain record (Party A creates record, Party B creates chain-reply) constitutes offer and acceptance. The timestamp of the chain records constitutes date-of-agreement. Implication: `RATIFICATION_COMPLETE` condition (CAT 0x3, ID 0) directly captures the moment a Kenyan-enforceable agreement exists.

**Ghana** — Electronic Transactions Act 2008 (Act 772). One of Africa's strongest e-transaction frameworks. Explicitly recognises electronic signatures, electronic contracts, and electronic records as legally equivalent to paper equivalents. Does not require a specific signature algorithm (accepts any reliable method). Implication: C-TRIG's chain protocol (record UID, timestamp, chain link) satisfies Act 772 requirements. `SIGNATURE_PRESENT` is not strictly required for Ghanaian validity, but strongly recommended.

**South Africa** — Electronic Communications and Transactions Act 2002 (ECTA). Mature framework. Distinguishes between "data messages" (any digital communication) and "advanced electronic signatures" (biometric-grade). For ordinary commercial agreements, a data message with reliable authentication suffices. Implication: a chain record with party UID and timestamp is a valid "data message." `RATIFICATION_COMPLETE` establishes bilateral consent. No biometric requirement for informal trade agreements.

### 7.2 Conditions with Legal Significance

The following extended conditions have direct evidentiary/legal relevance in African jurisdictions:

| Condition | Legal significance |
|-----------|-------------------|
| `RATIFICATION_COMPLETE` | Establishes bilateral consent — required to prove agreement existed |
| `SIGNATURE_PRESENT` | Satisfies electronic signature requirements (optional in most jurisdictions but strengthens enforceability) |
| `CHAIN_INTEGRITY_OK` | Hash-verified chain = tamper-evident record = admissible as documentary evidence |
| `NOTICE_DELIVERED` | Satisfies notice requirements in contracts with notice clauses |
| `RECEIPT_CONFIRMED` | Evidences delivery — resolves "goods never arrived" disputes |
| `DISPUTE_ACTIVE` | Timestamps the moment of formal dispute — starts limitation clock |
| `DEADLINE_REACHED` | Records time-bound obligation deadlines — relevant for breach claims |
| `ARBITRATION_INVOKED` | Triggers server-arbitration layer — creates a formal dispute record |
| `SATISFACTION_CONFIRMED` | "Acceptance of work" — most common condition in informal job contracts |

### 7.3 What Is Not Sufficient for Legal Enforceability

C-TRIG alone is insufficient for legal enforceability if:
- The agreement text (`story` field or clause text) is absent or ambiguous
- Party identities cannot be independently verified (phone number alone is weak identity)
- The agreement was created and accepted from the same device (raises forgery risk)
- No independent witness or timestamp authority is available

Recommendations:
1. For agreements above a threshold amount (suggest: above 50 USD equivalent), require `THIRD_PARTY_PRESENT` or `WITNESS_PRESENT` conditions.
2. For service contracts, require `SIGNATURE_PRESENT` (even a simple hash-signed commitment from Party B's device).
3. Consider integrating a timestamping service (RFC 3161 timestamp token) as an optional chain element for high-value agreements. C-TRIG `HASH_COMMITMENT_MET` (CAT 0x7, ID 2) accommodates this.

---

## 8. Open Questions Requiring User Decisions

**OQ-40a** — **RESOLVED — Option A: Category + ID.** High nibble = category (0x0–0xE active/reserved, 0xF = further escape); low nibble = condition ID within category. Categories confirmed: 0x0 Time/date, 0x1 Payment, 0x2 Identity/role, 0x3 Chain/state, 0x4 Document/ACK, 0x5 Location, 0x6 Server/async, 0x7 Cryptographic, 0x8–0xE Reserved, 0xF Further escape.

**OQ-40b** — **RESOLVED — Reserve CAT 0xF now.** No conditions assigned yet. 3-byte escape form for future extended namespace. Decoder encountering 0xF treats condition as UNKNOWN and halts.

**OQ-40c** — ASYNC condition resolution model for C-TRIG: when a condition requires server confirmation (e.g. `SERVER_EVALUATION_RECEIVED`), how does the evaluator signal "evaluation paused — waiting for server response"? Options:
- Return `PENDING` as a third truth value (tri-state evaluation)
- Halt evaluation and re-trigger when server reply arrives
- Server-dependent conditions are always evaluated last (evaluation ordering)

**RESOLVED — Option B:** Halt and re-trigger. See AGREEMENTS-DESIGN.md §3.5.

**OQ-40d** — **RESOLVED — Option B:** Numeric stack. Evaluator calls `BitLedger.decode()` for amount conditions directly. Amount comparisons first-class in C-TRIG. See CTRIG-EVALUATOR-DESIGN.md §6 and §7 for full evaluator pseudocode.

**OQ-40e** — Legal threshold: should C-TRIG enforce minimum conditions for "legally significant" agreements? E.g. if an agreement record lacks `RATIFICATION_COMPLETE` evaluation, the app warns "this agreement may not be legally enforceable." Or is this left entirely to template design?

**RESOLVED — Option C:** No warnings or gates. Legal sufficiency left to parties. Revisit post-MVP.

**OQ-40f** — Multi-party quorum: `QUORUM_MET` condition requires knowing the quorum threshold N. Where is N stored — in the agreement clause block, in a C-TRIG instruction operand, or in the extended condition byte itself? Suggest: N stored in the milestone table or a new quorum_block; the condition merely checks whether the stored threshold is satisfied.

**RESOLVED — Option C:** Low nibble for common quorums (0x1–0xE); 0xF escape to clause block for complex quorums.

---

## 9. Summary Table — Direct Registry vs Extended Registry

For reference, the complete condition picture across both registries:

| Registry | Condition | Code |
|----------|-----------|------|
| Direct (0x00) | HAS_PHONE | Inherited from display TRIG |
| Direct (0x01) | IS_ORG | Inherited from display TRIG |
| Direct (0x02) | ROLE_TYPE | Inherited from display TRIG |
| Direct (0x03–0x0B) | [display TRIG conditions] | Per TRIG-DESIGN.md condition table |
| Direct (0x0C) | DATE_REACHED | Commitment-specific |
| Direct (0x0D) | ACK_RECEIVED | Commitment-specific |
| Direct (0x0E) | PAYMENT_CONFIRMED | Commitment-specific |
| Direct (0x0F) | MILESTONE_MET (single) | Commitment-specific |
| Extended (0x1F 0x00–0x0F) | Time conditions | CAT 0x0, IDs 0–4 defined |
| Extended (0x1F 0x10–0x1F) | Payment conditions | CAT 0x1, IDs 0–5 defined |
| Extended (0x1F 0x20–0x2F) | Identity conditions | CAT 0x2, IDs 0–4 defined |
| Extended (0x1F 0x30–0x3F) | Chain/state conditions | CAT 0x3, IDs 0–5 defined |
| Extended (0x1F 0x40–0x4F) | Document/ACK conditions | CAT 0x4, IDs 0–6 defined |
| Extended (0x1F 0x50–0x5F) | Location conditions | CAT 0x5, IDs 0–2 defined |
| Extended (0x1F 0x60–0x6F) | Arbitration conditions | CAT 0x6, IDs 0–3 defined |
| Extended (0x1F 0x70–0x7F) | Cryptographic conditions | CAT 0x7, IDs 0–3 defined |
| Extended (0x1F 0x80–0x8F) | Milestone conditions | CAT 0x8, IDs 0–3 defined |
| Extended (0x1F 0x90–0x9F) | Participant/witness conditions | CAT 0x9, IDs 0–3 defined |
| Extended (0x1F 0xA0–0xEF) | Reserved (5 categories) | — |
| Extended (0x1F 0xF0–0xFF) | 3-byte escape | Byte 3 = 256 further IDs |

**Total defined conditions (direct + extended):** 15 direct + 37 extended = 52 named conditions  
**Total capacity (direct + extended + 3-byte escape):** 15 + 192 + 256 = 463 condition slots

---

*Research notes for OQ-40. Next step: user review of Section 8 open questions, then promote to design status and integrate into AGREEMENTS-DESIGN.md §3.4.*
