# Agreements and Commitment Records — Draft Spec

**Status:** draft-spec — 2026-05-17
**Depends on:** FRAME-SPEC.md, TRIG-DESIGN.md, MARKERS-DESIGN.md, CTRIG-EVALUATOR-DESIGN.md
**Maturity:** notes → design → **draft-spec** → spec → standard-doc

---

## 1. Purpose

A commitment is any record where two or more parties have agreed to terms — and that agreement itself is the artifact. Agreements in workpads range from a worker's invoice accepted by a client (lightweight, single-sentence) to a multi-clause service contract with milestone-gated payments, conditional clauses, and a physical Marker token holding the ratified state.

The design goal: commitments use the same wire format, share mechanism, and chain protocol as all other workpads records. No separate "contract platform." An agreement IS a financial or service record with a ratification layer attached.

---

## 2. Existing Architecture Mapping

What workpads already has that maps to commitment:

| Existing element | Commitment role |
|-----------------|-----------------|
| `ACK_REQUEST` in meta1 | "I am asking you to confirm this" — one-bit request |
| `BASE_TEMPLATE=101` State Commit | A point-in-time signed-off snapshot |
| `BASE_TEMPLATE=110` Amendment | Revision trail — the mechanism for updating agreed terms |
| `CHAIN=1` + `&c=` suffix | Sequential record chain — a commitment thread |
| `story` field (bit 11) | Free-text terms — single paragraph prose |
| `due_date` (bit 14) | Time-binding on payment |
| I>O subtype `I>I` sub 01 = Retainer | Recurring/agreed obligation |
| `compound_block` | Line-item structure — maps to clause-level structure |

The commitment protocol formalises how these pieces combine and adds what's missing.

---

## 3. Three Tiers of Agreement Complexity

### Tier 1 — Light Agreement (v1.0 scope)

**Use case:** "I accept this quote." / "Payment terms agreed." / "Job scope confirmed."

**Wire mechanism:**
1. Party A creates a record (typically Financial, `I>I` subtype 01 = Invoice or Quote) with `story` field containing the agreed terms text, `ACK_REQUEST=1` in meta1.
2. Party B replies with a chained State Commit record (`BASE_TEMPLATE=101`, `COMMIT_TYPE=00` job close), also with `ACK_REQUEST=1`. The chain link `&c=<party_A_uid>` ties them.
3. Both records existing in the chain = bilateral ratification. Neither party can unilaterally alter either record without issuing an Amendment (which itself requires a new chain reply).

**Ratification state detection:** a record is bilaterally ratified when the chain contains at least two records from different `IS_SENDER` parties both with `COMMIT_TYPE` present (or equivalent state signal). The app surfaces this as "Agreement confirmed ✓".

**Limitation:** no conditional logic, no clause-level acceptance, no Marker integration. Suitable for informal trade commitments.

---

### Tier 2 — Structured Agreement (post-MVP)

**Use case:** Multi-clause service contract, milestone-gated payment, terms with numbered items.

**Record type:** `BASE_TEMPLATE=111` Generic with DOMAIN bits set to a new `agreement` context. EXT_TEMPLATE domain extension byte signals subtype (0x01=service contract, 0x02=employment, 0x03=supply, 0x04=joint venture, 0x05=NDA, etc.).

**Split-record acceptance model:** Records are immutable once created. Party A creates the agreement record with clauses. Party B creates a chain-reply State Commit carrying an `acceptance_mask`. Acceptance state is read from the chain — never written back into Party A's clauses.

#### Clause Block Wire Format

```
[clause_header]    2 bytes
  bits 7-3: CLAUSE_COUNT      number of clauses (0–31)
  bit 2: HAS_MILESTONES       1=milestone table follows clause list
  bit 1: HAS_CONDITIONS       1=each clause carries a condition code byte
  bit 0: CLAUSE_FLAGS_PRESENT 1=each clause has a clause_flags byte

Per clause (repeated CLAUSE_COUNT times):

[clause_flags]     1 byte — if CLAUSE_FLAGS_PRESENT=1
  bits 7-6: CLAUSE_TYPE
    00 = standard term (both parties bound)
    01 = conditional (if <condition> then <obligation>)
    10 = milestone (triggers a subsequent payment or obligation)
    11 = recital / preamble (informational — not binding)
  bits 5-4: OBLIGATION_SIDE
    00 = both parties
    01 = Party A only (the agreement proposer)
    10 = Party B only (the agreement acceptor)
    11 = third party / authority
  bit 3: PARTY_A_DISPUTES  1=Party A has raised a dispute on this clause (in reply record)
  bit 2: PARTY_B_DISPUTES  1=Party B has raised a dispute on this clause (in reply record)
  bits 1-0: reserved

[condition_code]   1 byte — if HAS_CONDITIONS=1 AND CLAUSE_TYPE=01
  bits 7-4: CONDITION_ID  4-bit code; uses shared condition registry (see §3.1)
  bit 3: NEGATE           1=condition is inverted (if NOT <condition>)
  bits 2-0: reserved

[clause_text]      [u8 len][UTF-8]  max 255B — compact text encoding
```

#### Milestone Table (when HAS_MILESTONES=1)

```
[milestone_count]  1 byte

Per milestone:
[milestone_flags]  1 byte
  bits 7-6: TRIGGER_TYPE
    00 = date reached (date_milestone u16 follows)
    01 = explicit acknowledgment (ACK_REQUEST on a linked chain record)
    10 = condition satisfied (condition_code byte follows)
    11 = manual release (both parties must signal)
  bits 5-4: RELEASE_TYPE
    00 = payment release (amount_milestone uint24 follows; SF/DECIMAL_POS apply)
    01 = obligation trigger (clause_ref in bit 2-0)
    10 = state change (record status update)
    11 = Marker write event (Marker UID in milestone)
  bit 3: SEQUENTIAL        1=requires all prior milestones complete first
  bits 2-0: CLAUSE_REF     which clause index this milestone belongs to (7=global)

[date_milestone]   u16 days — if TRIGGER_TYPE=00
[amount_milestone] uint24   — if RELEASE_TYPE=00
[condition_code]   1 byte   — if TRIGGER_TYPE=10
```

#### Acceptance Reply

Party B's State Commit reply carries acceptance state in the `tag` field (MVP) or a dedicated `acceptance_block` (post-MVP):

**MVP**: `tag = "accept,mask:0b11111"` — bit-per-clause accept mask as binary string. Simple, no new wire constructs.

**Post-MVP acceptance_block**: 1–4 bytes of acceptance bitmap (supports up to 31 clauses). Each bit: 1=accepted, 0=disputed/pending. Carried in FLAGS4 of the reply record.

#### Shared Condition Registry Extensions

New conditions added to support clause conditionals (extend the TRIG 12-condition registry):

| Code | Condition | Meaning |
|------|-----------|---------|
| 0x0C | `DATE_REACHED` | Current date ≥ the date in the linked milestone |
| 0x0D | `ACK_RECEIVED` | A chain reply with the expected ACK has been received |
| 0x0E | `PAYMENT_CONFIRMED` | A settled payment record (I<I) exists in the chain |
| 0x0F | `MILESTONE_MET` | A specific milestone index is marked complete |

---

### Tier 3 — Commitment Protocol (long-term)

**Use case:** Complex agreements with branching logic, automated release conditions, Markers integration.

**Architecture decision: separate condition registries, separate instruction sets, separate evaluators.**

TRIG programs DISPLAY (who sees what, which CSS loads). C-TRIG programs OBLIGATION (when a condition is met, what is triggered). **Separate condition registries** — commitment conditions will grow beyond display TRIG's 16-slot namespace. A display-only shell ignores C-TRIG blocks (unknown extension). A commitment-aware shell runs both.

**Evaluation model:** Both client-local (Option A) and server-arbitrated (Option B) evaluation supported.
- Normal case: both parties evaluate C-TRIG locally against their chain state. No server required.
- When milestone/condition met: app pre-fills a new sub-record (State Commit, payment request, progress update) and presents it to the user for review before sending. User always has a review step — no auto-send.
- When parties disagree: dispute escalated to server arbitration at one of three levels (see §3.3).

**C-TRIG shares the TRIG header byte position.** The MODE bit (header byte bit 5) distinguishes them:
```
TRIG header byte bit 5: MODE
  0 = display TRIG (rendering rules)
  1 = commitment C-TRIG (obligation rules)
```

Both programs can co-exist in one frame: the TRIG block (meta2 bit 5) carries one trig_len + trig_bytes sequence. If the header byte MODE=0, it's a display program. MODE=1, it's a commitment program. Future: trig_len + trig_bytes could be repeated (multiple programs chained), each with its own header byte.

#### C-TRIG Instruction Set

```
High nibble = opcode, low nibble = inline immediate (same encoding as TRIG)

0x1_ PUSH_COND    push condition result onto stack
                  low nibble 0x0–0xE: direct condition ID (15 conditions from C-TRIG registry)
                  low nibble 0xF: escape → second byte encodes extended condition (see §3.4)
0x2_ RELEASE_AMT  release a milestone payment (milestone index in low nibble)
0x3_ TRIGGER_OBL  trigger an obligation / activate a clause (clause index in low nibble)
0x4_ ASSERT_STATE signal a state transition (state code in low nibble; see §3.2)
0x5_ REQUIRE_ACK  require explicit acknowledgment before proceeding
0x6_ TIME_LOCK    lock evaluation until DATE_REACHED condition resolves
0x7_ MARKER_WRITE signal a Marker write event (party index in low nibble: 0=A, 1=B)
0x8_ AND          logical AND on top two stack values
0x9_ OR           logical OR
0xA_ NOT          logical NOT
0xB_ IF_THEN      pop condition; if true execute next instruction, else skip one
0xC_ BRANCH       3-byte: opcode + true_clause_ref + false_clause_ref
0xD_ COMPLETE     mark agreement as fulfilled
0xE_ DISPUTE      mark a clause or whole agreement as disputed (clause ref in low nibble; 0xF=global)
0xF_ VERSION      3-byte version/extension escape (same as TRIG VER opcode)
```

**Max program length:** 32 bytes (larger than TRIG's 20 to accommodate milestone chains). Programs exceeding 32 bytes are spec violations; evaluator marks agreement as malformed.

#### Example C-TRIG Programs

```
"50% deposit upfront, balance on completion" — 4 bytes
  0x1E  PUSH_COND(PAYMENT_CONFIRMED)  — check initial payment settled
  0x21  RELEASE_AMT(milestone 1)       — release milestone 1 (deposit confirmation)
  0x1D  PUSH_COND(ACK_RECEIVED)        — check job-complete acknowledgment
  0x22  RELEASE_AMT(milestone 2)       — release milestone 2 (balance payment)

"Conditional: if parties in same city, use local rate clause" — 3 bytes
  0x12  PUSH_COND(HAS_LOCATION)
  0xB0  IF_THEN
  0x31  TRIGGER_OBL(clause 1)          — activate local rate clause

"Write Marker when both parties accept" — 4 bytes
  0x1D  PUSH_COND(ACK_RECEIVED)        — Party B acknowledged
  0x1E  PUSH_COND(PAYMENT_CONFIRMED)   — at least one payment exists
  0x80  AND
  0x70  MARKER_WRITE(party 0)          — signal Party A Marker write event
```

#### Agreement State Machine

```
PROPOSED  → REVIEWED  → ACCEPTED  → ACTIVE  → COMPLETED
                                   ↘ DISPUTED → (resolved) → COMPLETED
                                                           ↘ CANCELLED
```

State transitions are signalled by C-TRIG ASSERT_STATE(code) instructions or by the chain record type:

| Code | State | Trigger |
|------|-------|---------|
| 0 | PROPOSED | Original record created with agreement clause block |
| 1 | REVIEWED | Party B has opened the record (app-layer signal) |
| 2 | ACCEPTED | Party B's chain reply with acceptance_mask received |
| 3 | ACTIVE | First milestone condition met |
| 4 | COMPLETED | COMPLETE instruction evaluated, or all milestones met |
| 5 | DISPUTED | DISPUTE instruction evaluated, or Amendment with DISPUTE_FLAG=1 |
| 6 | CANCELLED | Both parties signal cancellation (mutual Amendment) |

#### §3.3 — Server Arbitration Protocol (three levels)

When parties disagree on C-TRIG evaluation, either party may escalate to server arbitration. The `ARBITRATION_LEVEL` field (2 bits) in the dispute Amendment record specifies the level:

| Code | Level | What server receives | Privacy |
|------|-------|---------------------|---------|
| 00 | Lightweight | C-TRIG bytecode + chain state summary (hashes + timestamps) | High — minimal data |
| 01 | Standard | Full record frames from all chain participants | Medium — server sees all fields |
| 10 | Privacy-preserving | Hash-verified summaries: both parties independently sign a chain summary; server evaluates against agreed summary, never sees raw record content | High — server sees only signed hashes |
| 11 | Reserved | — | — |

Server returns a signed evaluation result. Both parties must accept the result or escalate to off-protocol dispute resolution. Server evaluation is binding only when invoked — normal operation is always client-local.

#### §3.4 — PUSH_COND Escape Byte (Extended Condition Registry)

When `0x1F` (PUSH_COND with low nibble = escape), a second byte follows. The second byte is a **free design space** — not bound by the `[opcode][operand]` convention of byte 1. Both nibbles of byte 2 may be assigned to entirely different purposes (condition categories, modifier flags, or novel operand structures).

**Design flagged for dedicated research session (OQ-40).** The extended condition registry design should be informed by: smart contract condition taxonomies, Ricardian contract legal requirements, P2P evaluation models, and the eventual complexity of server-mediated and peer-to-peer enforced agreements. See OQ-40 in OPEN-QUESTIONS.md.

**Interim rule:** Evaluators encountering `0x1F` with an unrecognised byte 2 must treat the condition result as `UNKNOWN` (neither true nor false) and halt evaluation — surfacing "agreement contains unrecognised conditions" to the user.

#### §3.5 — Async Condition Resolution

When a C-TRIG condition cannot be resolved locally (e.g. SERVER_EVALUATION_RECEIVED, payment gateway confirmation), the evaluator uses **halt-and-re-trigger** (Option B):

1. Evaluator encounters unresolvable condition → halts entire program
2. App registers a server listener for the expected confirmation event
3. When confirmation arrives, the full C-TRIG program re-evaluates from byte 0
4. Agreement state machine shows "awaiting confirmation" during halt period
5. No partial evaluation state is preserved — re-evaluation is always complete

This keeps the evaluator stateless between runs. The chain record state (not evaluator memory) is the source of truth for what has been confirmed.

#### §3.6 — Quorum Condition Threshold Encoding

QUORUM_MET condition (from extended registry) uses Option C threshold storage:

```
Low nibble 0x1–0xE:  direct threshold (1–14 parties required)  — common quorums
Low nibble 0xF:      escape → threshold defined in clause block or milestone table  — complex/weighted quorums
```

Common quorums (2-of-3, 3-of-5) fit in the low nibble with zero extra bytes. Weighted or conditional quorums reference the clause block via escape — consistent with the PUSH_COND extended registry escape pattern.

---

## 4. Markers Integration

**See MARKERS-DESIGN.md for full Marker hardware/software specification.**

Markers are electronic coins — small devices or software tokens that accept a one-time write from each party when a commitment is ratified, then become read-only. They are the physical/digital embodiment of a Tier 1 or Tier 2 agreement.

**Marker ↔ Agreement protocol:**

```
1. Party A creates agreement record, generates #1pa or #1pt URL
2. Party B reviews, creates chain-reply acceptance record
3. App detects bilateral ratification state in chain
4. App assembles RATIFIED_FRAME = compact encoding of both records:
     [record_A_bytes][record_B_bytes][chain_link]
5. App initiates Marker write:
     - Marker SLOT 0: Party A writes RATIFIED_FRAME (write once)
     - Marker SLOT 1: Party B writes their commitment confirmation bytes
     - Marker sets WRITE_LOCK after both slots filled
6. Marker is now read-only — any NFC/BLE reader can verify
7. Marker URL: #1pm/<marker_uid> — new tag for Marker-resident records
```

**RATIFIED_FRAME encoding:** a pads-v1 compound record with `BASE_TEMPLATE=101` (State Commit), `COMMIT_TYPE=00` (job close), with the agreement terms in `story` and compound lines carrying clause summaries. Both party UIDs in participants block. Chain link to the original offer record.

**Write-once enforcement:**
- Hardware: WORM memory region on NFC tag (e.g. NTAG213 with OTP bytes)
- Software: server-side WORM — a Marker UID is registered; once two writes are recorded for that UID, all further write requests are rejected and the canonical content is sealed with a timestamp signature.

---

## 5. Bilateral Ratification Flow (Tier 1)

```
Party A (Worker)                    Party B (Client)
─────────────────                   ─────────────────
1. Create Quote record              2. Receive URL, view record
   ACK_REQUEST=1                    3. Tap "Accept"
   story = "Terms..."                  → App creates State Commit
   template = #1pf URL                  CHAIN=1, &c=<A_uid>
                                        ACK_REQUEST=1
                                     → Sends reply URL to A

4. App detects chain reply
   Checks COMMIT_TYPE present
   Sets agreement state = RATIFIED
   (Optional: writes Marker)
```

**App-layer signals:**
- Unratified: amber "Awaiting acceptance" badge
- Ratified: green "Agreement confirmed" badge + timestamp
- Disputed: red "Dispute raised" badge (triggered by Amendment with DISPUTE_FLAG=1)

---

## 6. Template Controls for Agreements

Agreement records should have dedicated template variants:
- `Agreement — Simple` (light: story field, no clauses, Tier 1 only)
- `Agreement — Service Contract` (structured: clause block, milestone dates)
- `Agreement — Employment` (payroll context: compound block with pay terms)

Templates declare:
```json
{
  "agreement_tier": 1,
  "requires_ack": true,
  "marker_eligible": true,
  "clause_display": "numbered",
  "acceptance_mode": "full_record"
}
```

---

## 7. Relationship to Existing Record Types

Agreement records do NOT replace financial or service records. They sit alongside:

| Scenario | Record type | Agreement layer |
|----------|------------|-----------------|
| Job quote | Financial `I>I` sub 01 (Quote) | Light agreement on the same record |
| Service contract | Service record with story | Tier 2 agreement block attached |
| Employment terms | Compound financial (payroll) | Tier 2 agreement with pay terms as clauses |
| One-off commitment | State Commit | Tier 1 ratification on the commit |

A record that IS the agreement (the terms are the record's main content) uses `BASE_TEMPLATE=111` Generic with a commitment domain signal. A record that CARRIES an agreement (the financial transaction + the terms) uses the financial template with agreement block added.

---

## 8. Resolved Design Decisions — 2026-05-17

| Decision | Chosen | Notes |
|----------|--------|-------|
| OQ-A1: Agreement record type | EXT_TEMPLATE — Option A | BASE_TEMPLATE=111 stays Generic; Agreement uses EXT_TEMPLATE domain extension byte (0x01–0x05 subtypes) |
| OQ-A2: Acceptance granularity | Tier-dependent — Option C | Tier 1: whole-record only. Tier 2+: per-clause bitmask when clause block present in offer record |
| OQ-A3: Dispute protocol | C-TRIG + Amendment — Option C, with Amendment-only fallback | C-TRIG DISPUTE instruction when C-TRIG present; Amendment with DISPUTE_FLAG=1 alone when no C-TRIG block |
| OQ-A4: Commitment bytecode scope | Separate C-TRIG evaluator | Separate instruction set, shared condition registry. See CTRIG-EVALUATOR-DESIGN.md |
| OQ-A5: Marker URL tag | `#1pm/` registered | See TAG-REFERENCE.md |
| OQ-A6: Multi-party ratification bitmap | 1 byte — Option A | Bits 0–6 = party slots; bit 7 = FULLY_RATIFIED. Covers up to 7 parties. |
| OQ-A7: Offline Marker writes | C + B combined | Hardware Markers: fully offline (NFC chip WORM). Software Markers: offline write queued, deferred sync via prev_stone_hash |

---

## 9. Wire Encoding Summary — Tier 1 Ratification

### Offer record (Party A)

```
meta1:
  BASE_TEMPLATE = 001 (Financial) or 000 (Service) — agreement IS the record
  ACK_REQUEST = 1
  CHAIN = 0 (first in chain)
  RECIPIENT_TYPE = 1 (named recipient)

field_flags:
  bit 0: job       — agreement title
  bit 11: story    — terms text (full prose)
  bit 14: due_date — if time-bound commitment

Optional EXT_TEMPLATE path (for standalone Agreement records):
  EXT_TEMPLATE = 1
  EXT_SIGNAL = 100 (Variant type, 3 bytes)
  Domain extension byte: 0x01=service contract, 0x02=employment,
    0x03=supply, 0x04=joint venture, 0x05=NDA
```

### Acceptance reply (Party B)

```
meta1:
  BASE_TEMPLATE = 101 (State Commit)
  ACK_REQUEST = 1
  CHAIN = 1
  RECIPIENT_TYPE = 1

URL suffix: &c=<party_A_record_uid>

State Commit fields:
  COMMIT_TYPE = 10 (terms agreed)
  story field: optional acceptance note

Ratification bitmap (when Tier 2 clause block present in offer):
  Carried in tag field (MVP): "accept,mask:0b11111111"
  Post-MVP: 1-byte bitmask in FLAGS4
    bits 0–6: per-clause acceptance (1=accepted, 0=disputed)
    bit 7: FULLY_RATIFIED (1=threshold met)
```

### Bilateral ratification detection algorithm

```javascript
function isRatified(chain) {
  const offer   = chain.find(r => r.ack_request && !r.chain)
  const replies = chain.filter(r => r.chain && r.commit_type !== undefined)
  if (!offer || replies.length === 0) return false

  const partySenders = new Set(replies.map(r => r.sender_uid))
  // At least one reply from a different party than the offer sender
  const hasCounterpartyReply = [...partySenders].some(uid => uid !== offer.sender_uid)

  // Threshold check (multi-party)
  const threshold = offer.threshold_n ?? 2
  const uniqueAcceptors = new Set(
    replies.filter(r => r.sender_uid !== offer.sender_uid).map(r => r.sender_uid)
  )
  return hasCounterpartyReply && uniqueAcceptors.size >= threshold - 1
}
```

### Dispute wire encoding

```
When C-TRIG present (Option C):
  C-TRIG evaluator emits DISPUTE(clause_ref) instruction
  → agreement state = DISPUTED
  → app prompts Party B for grounds text
  → Amendment sent:
      BASE_TEMPLATE = 110 (Amendment)
      amendment_flags bit 6: DISPUTE_LINK = 1
      amendment_flags bit 7: HAS_PARENT_UID = 1
      parent_uid: 8-byte SHA-256 truncated of original offer record
      story: dispute grounds text

When no C-TRIG (Option A fallback):
  Amendment with DISPUTE_FLAG=1 alone is sufficient
  → agreement state = DISPUTED on Amendment receipt
  → same wire format as above
```

---

## 10. Remaining Open Questions (post-draft-spec)

- **Structured dispute resolution fields** — when Tier 2 dispute is raised against a specific clause, does the Amendment carry a structured `disputed_clause_refs` block, or is the clause reference embedded in the story text? Post-MVP.
- **Agreement EXT_TEMPLATE domain byte registry** — subtypes 0x01–0x05 defined; 0x06–0xFF available. Full registry to be maintained in TEMPLATE-CATALOGUE.md.
- **`acceptance_block` in FLAGS4** — post-MVP formal per-clause bitmask block replacing the MVP `tag` field approach.
- **C-TRIG program scope in Tier 2** — which C-TRIG instructions are mandatory vs optional for a Tier 2-compliant evaluator?
