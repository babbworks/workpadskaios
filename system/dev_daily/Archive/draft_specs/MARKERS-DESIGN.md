# Markers — Electronic Commitment Coins (Stones)

**Status:** draft-spec — 2026-05-17
**Depends on:** AGREEMENTS-DESIGN.md, FRAME-SPEC.md, TAG-REFERENCE.md
**Maturity:** notes → design → **draft-spec** → spec → standard-doc

---

## 1. What Is a Marker (also: Stone)

A Marker — also called a **Stone** — is an electronic coin: a small, low-cost device or software token that holds a ratified workpads commitment. The defining properties:

- **Two-party write**: each of the two committed parties writes once into the Stone when ratification occurs
- **Write-lock**: after both parties have written, the Stone becomes permanently read-only (WORM) or enters appendable-tail mode depending on write mode selected at ratification (see §Write Modes)
- **Universal read**: any compatible reader (NFC phone, BLE device, QR scanner, or the workpads app) can read and verify the Stone at any time

**Synonym note:** "Marker" and "Stone" are interchangeable throughout all documentation. "Stone" is preferred in user-facing contexts.
- **Self-contained**: the Marker holds the complete ratified record — no server lookup required to verify or display the commitment terms
- **Physical analogy**: a sealed physical contract or notarised deed. Once signed and sealed, neither party can alter it. The Marker IS the seal.

Markers are not blockchain tokens. They are not financial instruments by themselves. They are tamper-evident commitment artifacts — the digital equivalent of a signed receipt kept by both parties.

---

## 2. The Commitment Ratification Protocol

```
PHASE 1: OFFER
─────────────
Worker creates an agreement record in the workpads app.
Record = pads-v1 frame with ACK_REQUEST=1, story/clause content, UID set.
Shared as a #1pt URL (template-keyed — terms are legible only with the template).

PHASE 2: REVIEW AND ACCEPTANCE
───────────────────────────────
Client receives the URL, opens in any compatible viewer.
Client reviews terms.
Client taps "Accept" → app creates a State Commit reply record:
  - CHAIN=1, &c=<offer_uid>
  - ACK_REQUEST=1 (confirming the chain)
  - participants block: client IS_SENDER=1
  - story: optional acceptance note

PHASE 3: RATIFICATION DETECTION
────────────────────────────────
Worker's app detects bilateral chain — both parties have a record in the chain.
Agreement status flips to RATIFIED.
App generates the RATIFIED_FRAME (compact encoding of both records + chain metadata).

PHASE 4: MARKER WRITE (optional but recommended for formal commitments)
────────────────────────────────────────────────────────────────────────
Worker holds phone to Marker (NFC) or scans Marker QR to initiate write.
App writes RATIFIED_FRAME to Marker SLOT 0. Marker stores Worker's write.
Client holds their phone to same Marker (or app generates client write token).
App writes Client's acceptance confirmation to Marker SLOT 1.
Marker detects both slots filled → asserts WRITE_LOCK.
Marker is now permanently read-only.

PHASE 5: ONGOING USE
─────────────────────
Either party taps/scans the Marker to view:
  - The agreed terms
  - Both parties' identities
  - Date and timestamp of ratification
  - Current status (active, completed, disputed — derived from chain state)
```

---

## 3. Physical Marker Options

### Option A — NFC Tag (preferred for hardware)

**Target chip:** NTAG213 or NTAG215 (ISO 14443-A)
- NTAG213: 144 bytes user memory — tight but sufficient for a compact pads-v1 frame
- NTAG215: 504 bytes — comfortable for full agreement records
- Cost: $0.10–$0.30 per tag at volume
- KaiOS NFC: available on Jio Phone 2, CAT B35, and others in target markets

**Write-once mechanism:** NTAG chips have OTP (One-Time Programmable) bits in the configuration pages. These can be used to lock individual pages after writing. Protocol:
- Pages 4–N: RATIFIED_FRAME data
- Config bytes: set LOCK bits after Phase 4 Marker write completes
- Locked pages cannot be overwritten — enforced by the chip hardware

**Form factor options:**
- Sticker (adhesive NFC label) — affixed to a paper contract, receipt, or job sheet
- Card (credit card form factor) — kept by one or both parties
- Coin / disc — physical object passed between parties as the "deal token"
- Pendant / keyfob — wearable, for recurring business relationships

### Option B — QR + Software WORM (for non-NFC devices)

For devices or contexts without NFC:
- Marker UID printed as QR code on a physical card
- RATIFIED_FRAME stored on the workpads server under that UID
- Server enforces write-once: after two writes, the entry is sealed and a timestamp signature applied
- Any camera-capable phone can read the Marker via QR scan

**QR + server combined:** the physical card has the QR code pointing to `workpads.me/m/<marker_uid>`. The server serves the RATIFIED_FRAME as a pads-v1 record. The physical card is the trusted reference; the server is the canonical store.

### Option C — BLE Beacon Marker (post-MVP)

Bluetooth Low Energy Marker that broadcasts the Marker UID. Compatible receivers detect the beacon and fetch the RATIFIED_FRAME from the server or local cache. Useful for location-bound commitments (e.g., a job site entry agreement that triggers when a worker enters the site).

### Option D — Software-only Marker (server-synced)

When neither NFC nor QR printing is available:
- Marker UID is a `did:stone:` DID generated by the workpads app
- Both parties' apps hold a local copy of the RATIFIED_FRAME, signed by both
- Server holds the canonical sealed copy
- Share by sending the Marker URL: `workpads.me/p#1pm/<b64url(marker_uid)>`
- Security: the server's write-once enforcement is the tamper-evidence mechanism

### Option E — Software-only Marker (peer-to-peer, no internet)

For contexts where both parties are in physical proximity but neither has internet access:
- Marker UID is a `did:stone:` DID generated by Party A's app at creation time
- Party A holds the pending Marker (SLOT 0 written locally)
- Party B and Party A exchange write tokens directly via NFC tap, BLE, or QR scan between the two devices — no server involved
- On exchange: Party A sends their slot 0 write token to Party B; Party B sends their slot 1 write token to Party A
- Both apps independently verify both write tokens using each party's device key signature
- Both apps assert WRITE_LOCK locally once both slots are verified
- Tamper-evidence: HMAC of each write token keyed to the writer's device key. Both tokens stored on both devices.
- Optional server sync: either party may sync the sealed Marker to the server at any later time. The server validates both signatures and registers the canonical sealed state. The `prev_stone_hash` mechanism resolves any ordering ambiguity at sync time.
- If neither party ever syncs: the Marker is valid and verifiable between the two devices indefinitely. A third-party reader with the Marker UID but no server connection cannot verify — they receive "Marker not found on server" and must obtain a local copy from one of the parties.

**P2P exchange protocol:**
```
1. Party A: generate Marker UID (did:stone:...), write SLOT 0 locally
2. Party A: encode SLOT 0 write token as QR or NFC payload:
     [marker_uid][slot_index=0][prev_stone_hash=0x00...][write_payload][hmac_8B]
3. Party B: scan/tap → receive Party A's write token → verify HMAC
4. Party B: generate SLOT 1 write token:
     [marker_uid][slot_index=1][prev_stone_hash=SHA256(slot0_payload)[0:8]][write_payload][hmac_8B]
5. Party B: display SLOT 1 token as QR for Party A to scan
6. Party A: receive Party B's token → verify HMAC → assert WRITE_LOCK locally
7. Both devices: Marker is sealed. Sync to server optional.
```

---

## 4. RATIFIED_FRAME Wire Encoding

The RATIFIED_FRAME is a pads-v1 compound record encoding both parties' commitments:

```
BASE_TEMPLATE=101 (State Commit)
COMMIT_TYPE=00 (job close / commitment close)
CHAIN_COMPLETE=1 (all parties have written)

meta2:
  PARTICIPANTS=1 (both parties listed)
  COMPACT_TIME=1 (space-efficient timestamps)

Participants block:
  Participant 1: Party A (offer maker), IS_SENDER=1
  Participant 2: Party B (acceptor), IS_SENDER=0

field_flags:
  story (bit 11): ratified terms text (summary or full)
  date (bit 2): ratification date
  ref_number (bit 13): agreement reference ID

FLAGS3:
  uid (bit 5): Marker UID (the canonical identifier)
  context_label (bit 0): short description of the commitment ("Fence install, 12 Oak St")
  tag (bit 1): "marker,ratified"

Financial block (if commitment involves payment terms):
  setup_byte + transaction_byte: the financial obligation
  customer_amount: the agreed total
  due_date: payment deadline
```

**Two-part write structure within RATIFIED_FRAME:**

The RATIFIED_FRAME includes TWO state commit sub-records linked by chain:
- Sub-record A (SLOT 0): the offer record verbatim
- Sub-record B (SLOT 1): the acceptance record verbatim
- The compound block carries both as lines (LINE_TYPE=11 summary lines)

On hardware NFC Markers with 144B limit (NTAG213): a minimal ratified_frame fits:
```
meta1:        1B
meta2:        1B
setup:        1B (if financial)
transaction:  1B (if financial)
field_flags:  2B
story:        2+60 = 62B  (60-char agreement summary)
date:         2B
fin_control:  1B (if financial)
customer_amt: 3B (if financial)
participants: 1+25+25 = 51B  (two minimal participants, names only)
FLAGS3:       1B
uid:          2+16 = 18B (compact UID)

Total minimal:  ~95B  → fits NTAG213 (144B)
Full record:    ~300B → needs NTAG215 (504B) or NTAG216 (888B)
```

---

## 5. Marker URL Tag

Proposed new URL tag: `#1pm/` — pads Marker record.

```
workpads.me/p#1pm/<base64url-marker_uid>
```

The receiver app:
1. Decodes the Marker UID from the fragment
2. Fetches RATIFIED_FRAME from server OR reads from NFC tag directly
3. Displays the ratified agreement in read-only view
4. Shows WRITE_LOCK status indicator

The `#1pm/` tag signals: "this is a sealed commitment — the shell renders in read-only agreement view, not the standard record view."

---

## 6. Security Model

### Write authenticity
Each party's write to a Marker is signed with their device key (HMAC of the write content + device ID + timestamp). The Marker stores both signatures. Verification = re-compute both HMACs and confirm they match.

### Tamper evidence
- Hardware Markers: NTAG lock bits — physical WORM, cryptographically unnecessary but adds physical tamper evidence
- Software Markers: server stores the RATIFIED_FRAME hash at seal time; any subsequent read verifies against the hash
- Combined: hardware + hash + timestamp signature = three independent tamper-evidence layers

### Replay protection
Each Marker has a unique UID generated at creation time. UIDs are never reused. A replayed write (identical content, different UID) fails because the new UID has no pre-existing slot registration on the server.

### Privacy
RATIFIED_FRAME on a plain NFC Marker is readable by any NFC-capable device. For sensitive agreements:
- Use `#1pt/` (template-keyed) encoding for the RATIFIED_FRAME — terms are visible only with the template key
- Physical Markers can use PIN-protection via NTAG's password features (4-byte password on read access)

---

## 7. Marker Lifecycle States

```
UNWRITTEN   → blank Marker, no slots filled
PARTIAL     → one party has written (SLOT 0 filled, SLOT 1 empty)
RATIFIED    → both slots filled, WRITE_LOCK asserted
DISPUTED    → RATIFIED but a linked Amendment record has DISPUTE_FLAG=1
FULFILLED   → RATIFIED + linked State Commit shows CHAIN_COMPLETE=1
EXPIRED     → RATIFIED but past expiry_date in the frame
```

App displays the current lifecycle state derived from chain state at read time. The Marker itself carries only the frozen RATIFIED state — all state transitions beyond ratification are inferred from the record chain.

---

## 8. Integration with TRIG

A Marker can carry a TRIG program in its RATIFIED_FRAME. This governs display at read time:

```
Example TRIG on a Marker:
  If reader is the Worker (ROLE=01): show full financial detail + terms
  If reader is the Client (ROLE=00): show terms + amounts, hide worker_amount
  If reader is neither (ROLE=11): show summary only — "This Marker holds a ratified agreement"
```

TRIG on Markers enables privacy-aware display of sensitive terms without multiple versions of the record.

---

## 9. Wire Encoding Summary

### Marker UID format

```
did:stone:<base32(SHA256(A_did + B_did + timestamp)[0:12])>

When Party B has no DID:
  did:stone:<base32(SHA256(A_did + SHA256(B_phone_E164) + timestamp)[0:12])>

Example: did:stone:NBSWY3DPEB3W64TMMQ
```

### Write token wire format (all Marker types)

```
[marker_uid]         variable — did:stone: string as UTF-8, length-prefixed [u8 len]
[slot_index]         1 byte   — which party slot (0, 1, 2...)
[prev_stone_hash]    8 bytes  — SHA256(current Stone contents)[0:8]; all-zero for first write
[write_payload]      variable — the party's ratification bytes (see RATIFIED_FRAME below)
[timestamp]          2 bytes  — COMPACT_TIME uint16 days
[hmac_tag]           8 bytes  — HMAC-SHA256(device_master_key, above fields)[0:8]
```

### RATIFIED_FRAME wire encoding

```
BASE_TEMPLATE = 101 (State Commit)
EXT_TEMPLATE = 0
META2_PRESENT = 1

meta2:
  COMPACT_TIME = 1
  PARTICIPANTS = 1

setup_byte:         present if financial terms included
transaction_byte:   present if financial terms included
COMMIT_TYPE = 10    (terms agreed)

field_flags:
  bit 0: job       — commitment title
  bit 2: date      — ratification date (COMPACT_TIME)
  bit 11: story    — agreed terms summary (max 60 chars for NTAG213 budget)
  bit 13: ref_number — agreement reference ID

FLAGS3:
  bit 5: uid       — Marker UID (the did:stone: DID)
  bit 0: context_label — short description ("Fence install, 12 Oak St")
  bit 1: tag       — "marker,ratified"

Financial block (if commitment involves payment terms):
  fin_control + customer_amount + due_date

Participants block:
  Participant 0: Party A (offer maker), IS_SENDER=1
  Participant 1: Party B (acceptor), IS_SENDER=0
  (up to 7 parties for multi-party Stones)

Ratification bitmap (FLAGS4 of the compound reply):
  bits 0–6: per-party ratification (1=written, 0=pending)
  bit 7: FULLY_RATIFIED

Sub-record structure (compound frame):
  LINE_TYPE=11: Party A's original offer record bytes (verbatim)
  LINE_TYPE=11: Party B's acceptance record bytes (verbatim)
```

### Size budget (NTAG213 = 144 bytes)

```
meta1:          1B
meta2:          1B
setup:          1B  (if financial)
transaction:    1B  (if financial)
field_flags:    2B
story:          2+60 = 62B  (60-char terms summary)
date:           2B
fin_control:    1B  (if financial)
customer_amt:   3B  (if financial)
participants:   1+25+25 = 51B  (two minimal participants)
FLAGS3:         1B
uid:            1+18 = 19B  (did:stone: compact)

Total minimal (no financial): ~79B  ✓ fits NTAG213 (144B)
Total with financial:         ~94B  ✓ fits NTAG213 (144B)
Full record (long names):    ~300B  → needs NTAG215 (504B)
```

### URL format

```
workpads.me/p#1pm/<b64url(marker_uid)>
```

Receiver app:
1. Decodes Marker UID from fragment
2. Fetches RATIFIED_FRAME from server OR reads from NFC tag directly
3. Renders in read-only agreement view
4. Shows WRITE_LOCK status indicator and lifecycle state

### Offline write connectivity matrix

| Marker type | Party A online? | Party B online? | Supported? | Notes |
|-------------|-----------------|-----------------|------------|-------|
| Hardware (NFC) | No | No | ✓ | WORM bits set on-chip; deferred server sync |
| Software (server) | No | No | ✓ | Writes queued; prev_stone_hash sync on reconnect |
| Software (P2P) | No | No | ✓ | Direct device exchange; no server ever required |
| Software (server) | Yes | Yes | ✓ | Real-time server seal; cleanest path |

---

## 9b. Marker Hardware Production Path

**Phase 1 (software Marker):** No hardware required. Marker UID is a UUID, RATIFIED_FRAME lives on server + both parties' apps. Write-once enforced by server. Share via URL or QR.

**Phase 2 (NFC sticker Marker):** Off-the-shelf NTAG215 stickers purchased in bulk (~$0.20 each). Pre-printed with workpads branding and UID QR code. App writes via NFC. Sold/distributed through workpads distribution channels.

**Phase 3 (custom Marker coin):** Custom injection-moulded plastic or metal coin with embedded NFC chip. Unique to workpads — branded "Marker." Collectable, distinctive, tactile. Acts as both a functional commitment device and a brand artefact.

**Phase 4 (Marker ecosystem):** Markers for specific sectors — Marker sizes and forms calibrated to use case (construction site markers, market vendor markers, employment markers). Readers in public spaces (market stalls, government offices) display Marker content on screen when tapped.

---

## 10. Decisions — 2026-05-17

### Stone DID Identity

Stone UIDs are structured as `did:stone:` DIDs from day one.

```
Stone UID format:  did:stone:<base32(pubkey_hash[0:12])>
Example:           did:stone:NBSWY3DPEB3W64TMMQ
```

- DID method: `did:stone:` — verified available in W3C DID Method Registry (not registered by any other party)
- Encoding: base32 (case-insensitive, QR-efficient, no ambiguous characters)
- Key derivation: `keypair = derive(device_master_secret, context_label_hash)` — same device always produces same Stone UID for same context; recoverable from device master secret
- Registration: `did:stone:` method spec to be filed with W3C when stage 3 (resolver infrastructure) begins; unregistered use is valid for stages 1 and 2

**Multiple Stones per user (hats):** Each context a person operates in (trade identity, market vendor, personal, apprenticeship) gets a separate Stone with a separate keypair. App presents a Stone collection view. Physical NFC Stones issued per context; software Stones available for all contexts immediately.

**Apprenticeship use case:** Stone ratified between master craftsperson and apprentice. Both parties write — master's identity (with contact info) baked into the Stone as trust anchor. Collection of fulfilled apprenticeship Stones = portable, offline-verifiable trade credential. Maps to W3C Verifiable Credentials and Open Badges at stage 2.

**Software Stones first:** Initial deployment is software-only (on-device, CDN, IPFS options). NFC hardware Stones are phase 2.

### Write Mode Default

Shell prompts at ratification time: "Seal permanently or allow progress updates?" Default suggestion based on agreement type:
- One-off job → suggests WORM (full seal)
- Service contract / milestone agreement → suggests appendable tail (sealed core + progress stamps)

User can override either way. Write mode stored in Stone metadata.

### Stone UID Assignment (OQ-M1)

Option C — deterministic derivation from agreement parties:

```
Party B has Stone DID:
  did:stone:<base32(SHA256(A_did + B_did + timestamp)[0:12])>

Party B has no Stone DID (leader-send flow):
  did:stone:<base32(SHA256(A_did + SHA256(B_phone_E164) + timestamp)[0:12])>
```

Phone-hash as proxy UID when Party B has no existing DID. Stone UID computable by either party independently. If Party B later creates a proper Stone DID, the phone-hash Stone remains valid.

**Leader-send flow:** Party A fills agreement + Party B's phone. App generates provisional Stone UID. Party B receives confirmation link at `workpads.me/p#1pm/<uid>` — no app required, just tap confirm. Resolver page offers optional DID creation after confirmation (Stone ratification = natural onboarding moment).

### Write Sequencing (OQ-M2)

Either party writes in any order. No enforced sequencing. Server accepts writes into any slot independently; seals when threshold is met. **The non-vending party having equal write agency is a core design innovation** — clients, apprentices, and community members can initiate and write first.

### Multi-party Stones (OQ-M3)

Three or more ratification slots confirmed in scope. Up to 7 slots (matching participants block max). NTAG216 (888B) recommended hardware target for 3+ party Stones.

**Overflow beyond 7 parties:** Chained participants addendum records (minimal Service records, no financial block, chain-linked to main agreement). Zero codec change needed.

**Threshold sealing (Option C — template-defined):**
```
THRESHOLD_TYPE:   00=unanimous  01=quorum(N-of-M)  10=first-write-seals  11=custom
THRESHOLD_N:      uint8 — minimum writes to seal
THRESHOLD_M:      uint8 — total expected parties
```
Template specifies default; Party A can override at creation. Shell shows: "2 of 3 required parties have confirmed."

### Offline Write Collision (OQ-M6)

Option C (simplified) — cryptographic ordering via `prev_stone_hash`:

```
Each write includes:
  stone_uid         which Stone
  slot_index        which party slot (0, 1, 2...)
  prev_stone_hash   SHA256(current Stone contents)[0:8]  — 8 bytes
  write_payload     party's ratification bytes
  timestamp         COMPACT_TIME
```

No collision (sequential writes): server orders deterministically from prev_stone_hash chain. True collision (same prev_stone_hash from two simultaneous offline writes): server flags conflicted, notifies both parties. Common case requires zero human review.

### Stone Transfer (OQ-M4)

Option C — transfer via chain record only. Stone itself never changes after ratification. Transfer recorded as Amendment or State Commit referencing original Stone UID via `parent_uid`. Original Stone remains immutable; chain carries transfer history. New Stone optionally created if transferred agreement needs fresh ratification.

---

## 11. Resolved Design Questions

All OQ-M1 through OQ-M6 resolved. Summary:

| Question | Resolution |
|----------|-----------|
| OQ-M1: UID assignment | Option C — deterministic derivation from party DIDs + timestamp; phone-hash proxy when Party B has no DID |
| OQ-M2: Write sequencing | Either party writes first — non-vending party write agency is a core design innovation |
| OQ-M3: Multi-party Markers | Up to 7 slots; overflow via chained participant addendum; threshold sealing template-defined (Party A can override) |
| OQ-M4: Transfer | Chain record only — Stone immutable after ratification; Amendment/State Commit references original Stone UID |
| OQ-M5: `#1pm/` tag | Registered in TAG-REFERENCE.md dispatch table and decoder routing |
| OQ-M6: Offline write collision | prev_stone_hash ordering; sequential: deterministic; simultaneous: server flags conflict, notifies parties |
| OQ-A7: Offline Marker writes | Hardware: fully offline (NFC chip WORM). Software server-synced: offline queue + deferred sync. Software P2P: direct device exchange, no server ever required (Option E, §3) |

## 12. Remaining Open Questions (post-draft-spec)

- **P2P Marker discovery** — when two parties exchange write tokens via QR, how does Party B's app know which Marker UID to expect if they haven't previously communicated? Options: Party A displays a QR containing the Marker UID + slot 0 token combined; or a short verbal/SMS UID confirmation step. UX design needed.
- **IPFS storage option for software Markers** — RATIFIED_FRAME pinned to IPFS as a content-addressed alternative to the workpads CDN. Provides censorship resistance for long-lived commitments. Post-MVP.
- **Apprenticeship credential export** — mapping fulfilled Stone collection to W3C Verifiable Credentials and Open Badges. Stage 2 (reputation wallet). Design separate.
