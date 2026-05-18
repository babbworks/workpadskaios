# Markers Write Modes — Research Report

**Status:** research — 2026-05-17
**Context:** Extends MARKERS-DESIGN.md (fully WORM design) with research into write-mode spectrum
**Purpose:** Inform design decisions on limited-write, amendment-compatible, and personal-token modes

---

## 1. NFC Tag Capability Matrix

The current design targets NTAG213/215/216. Understanding what these and related chips actually support is the starting point for any expanded write-mode design.

### 1.1 NTAG 213 / 215 / 216 (NXP, ISO 14443-A Type 2)

| Capability | NTAG213 | NTAG215 | NTAG216 |
|---|---|---|---|
| User memory | 144 B | 504 B | 888 B |
| Page size | 4 B | 4 B | 4 B |
| Static lock bits (pages 0–15) | Yes | Yes | Yes |
| Dynamic lock bits (page 16+) | Yes (2-page granularity) | Yes (16-page granularity) | Yes (16-page granularity) |
| Per-page lock (true single-page) | No | No | No |
| OTP (One-Time Programmable) bytes | 4 B (page 3) | 4 B (page 3) | 4 B (page 3) |
| Password-protected write (PWD/PACK) | Yes (4-byte password) | Yes | Yes |
| Password-protected read | Yes (AUTH0 config) | Yes | Yes |
| Counter | No native counter | No native counter | No native counter |
| Append-only mode (hardware enforced) | No | No | No |
| Authenticated write (asymmetric) | No | No | No |

**Key finding:** Lock bits on NTAG213/215/216 are permanent and irreversible (bit-wise OR'd on each WRITE command — you can only set bits to 1, never back to 0). This is true WORM at the hardware level, but the granularity is coarse (2 or 16 pages at a time), not per-byte. A partial lock is achievable: lock pages 4–20 (core agreement) while leaving pages 21–36 unlocked for progress updates. This is the hardware basis for "limited write mode."

### 1.2 NTAG 5 Link (NXP, ISO 15693 / NFC-V)

The NTAG 5 is a step up for more complex applications:

| Capability | NTAG 5 Link |
|---|---|
| User memory | Up to 2 kB |
| Password protection | Two separate area passwords (read and write, independently configurable) |
| Granular area protection | Yes — define restricted areas by 16-bit address ranges |
| Separate read/write passwords per area | Yes (NFC_PWD5 for Area 1 read, NFC_PWD6 for Area 1 write) |
| Authenticated write | Partial — password-gated, not asymmetric-key |
| Counter | Yes (monotonic, tamper-evident) |

**Key finding:** NTAG 5 Link can protect Area 0 (core agreement, write-locked after ratification) with a different password from Area 1 (progress/amendments, write-accessible to authenticated parties). This is the strongest hardware candidate for amendment-compatible mode.

### 1.3 NTAG I²C Plus (NXP)

Designed for connected-tag use cases (tag + microcontroller bridge), but relevant because:
- 64-byte SRAM buffer enables pass-through mode (NFC interface ↔ I²C bus)
- SRAM can be mirrored into user memory at configurable offset
- Enables a tag that "receives" a write from the NFC side and forwards it to a connected microcontroller for authenticated processing before committing to EEPROM

This is the hardware basis for a truly authenticated write mode — the microcontroller acts as the gatekeeper, only persisting writes that carry valid party signatures.

### 1.4 MIFARE Classic / DESFire (NXP)

MIFARE Classic (1K/4K) uses sector-based access with 3-key authentication (Key A, Key B, Access Bits). Each sector can have different read/write/increment/decrement permissions. MIFARE DESFire supports AES/3DES authentication per file within an application. Both support:
- Authenticated write (key-gated)
- Value files with increment-only semantics (hardware append-only for counters)
- File-level access conditions (some files sealed, others writable)

**Key finding:** DESFire EV3 is the most capable chip for complex write-mode designs, but it is more expensive (~$0.50–$1.00 vs $0.10–$0.30 for NTAG), requires a reader capable of MIFARE authentication, and is overkill for KaiOS field deployment at scale.

### 1.5 ST25 Series (STMicroelectronics, ISO 15693)

ST25TA and ST25TV series support:
- Separate read and write password protection per area
- Lock block commands (individual block locking, irreversible)
- Proprietary PRESENT_PASSWORD command for authenticated write access

The ST25TV02K specifically supports a monotonic counter that increments on each write — useful for write-count limiting and tamper detection.

**Summary recommendation:** For Workpads Markers, the hardware progression is:
- **MVP / Phase 1:** NTAG215 with OTP page lock for final-write mode (existing design)
- **Phase 2 (limited write):** NTAG215 with partial dynamic lock — lock core pages after ratification, leave tail pages for progress stamps
- **Phase 3 (amendment-compatible):** NTAG 5 Link with dual-area password protection
- **Phase 4 (authenticated write):** MIFARE DESFire EV3 or NTAG I²C Plus for full key-gated write control

---

## 2. Write-Mode Precedents: Digital Document Systems

### 2.1 PDF Sequential Signatures (ISO 32000)

PDF supports multiple sequential digital signatures via incremental saves. Each signature covers the document state at the time of signing; a validator can reconstruct each signing state and verify all signatures independently. The mechanism:
1. Party A signs → document saved with A's signature covering bytes 0–N
2. Party B appends their signature → incremental update covers bytes N–M; A's signature still valid over bytes 0–N
3. Any further incremental additions (amendments, annotations) are possible; each prior signature validates its own byte range

This is the canonical software precedent for "sealed core + appendable progress." The core is immutable once signed; incremental layers add state without invalidating the original. Adobe Sign and DocuSign implement sequential envelope workflows on top of this model, though DocuSign does not allow post-completion amendments to a signed envelope — a new envelope must be created for amendments.

**Application to Markers:** The PDF model maps directly to the NTAG partial-lock approach: locked pages = signed byte ranges (immutable), unlocked pages = incremental save area (appendable).

### 2.2 DocuSign / Adobe Sign Sequential Envelopes

DocuSign supports routing order: Signer 1 → Signer 2 → Signer N, each notified only after the previous completes. However, once an envelope is completed (all signed), no amendments can be added to it — a new linked envelope is the prescribed method. This is the "amendment-compatible" model in software: the original sealed agreement persists, and amendments are separate linked artifacts.

**Application to Markers:** A completed Marker is the equivalent of a completed DocuSign envelope. Amendments are new records in the chain, linked to the Marker UID, not written to the physical token itself.

---

## 3. Smart Contract State Channel Model

### How State Channels Work

In Ethereum state channels (and Bitcoin's Lightning Network), two parties:
1. Open a channel with an on-chain locking transaction (initial state committed to blockchain)
2. Exchange an unlimited number of signed state-update messages off-chain (intermediate states never touch the chain)
3. Close the channel by submitting the final agreed state on-chain

Only two on-chain transactions occur (open + close), regardless of how many intermediate updates are made. Each intermediate state is signed by both parties and carries a sequence number; a higher sequence number always supersedes a lower one if disputed.

### Mapping to Physical Markers

The state channel model maps well to the "limited write mode" Marker:

| State Channel Concept | Marker Equivalent |
|---|---|
| Channel open transaction | Marker ratification (SLOT 0 + SLOT 1 written, core locked) |
| Off-chain signed state updates | App-side chain records (milestones, partial completions) |
| Sequence number | Chain sequence counter in pads record chain |
| Channel close / final settlement | Final State Commit written to Marker's appendable tail pages — or a separate "Closure Marker" token |
| Dispute resolution (submitting highest sequence state) | Presenting most recent chain record to resolve a disputed Marker state |

**Key insight:** The physical Marker does not need to hold all intermediate states. It holds the opening state (ratified agreement) and optionally the closing state (completion stamp). Everything in between lives in the app's record chain. This matches the state channel model's efficiency: the chain is the off-chain state ledger; the Marker is the on-chain anchor.

**Critical difference from blockchain:** State channels require both parties to be online to dispute a unilateral close. Physical Markers do not have this problem — the Marker is a tamper-evident artifact that either party holds. Dispute resolution does not depend on liveness; it depends on possession of the Marker and the app chain history.

---

## 4. Verifiable Credentials and Personal Tokens

### 4.1 W3C Verifiable Credentials Model

A Verifiable Credential (VC) consists of:
- **Issuer:** the party making the claim (e.g., a client who confirms a job was completed)
- **Subject:** the party the claim is about (e.g., the worker)
- **Claim:** the assertion (e.g., "completed fence installation at 12 Oak St, paid in full")
- **Proof:** a cryptographic signature binding issuer, subject, and claim

VCs are portable: the subject (worker) holds them in a digital wallet and presents them to any verifier without the issuer needing to be online. A DID (Decentralised Identifier) is a resolvable identifier that anchors the issuer and subject identities without a central registry.

### 4.2 Open Badges as a Precedent

Open Badges 3.0 (1EdTech standard) extends VCs for achievement and skill claims. Each badge is a VC with embedded metadata: issuer, recipient, achievement description, evidence links, and a cryptographic proof. Badges are portable, verifiable without the issuer, and accumulate in a wallet to form a skill/reputation portfolio.

**Key alignment with Marker "personal token" concept:** A ratified and fulfilled Marker is functionally equivalent to an Open Badge — it is a verifiable claim by a client that a worker delivered on an agreement. If the RATIFIED_FRAME is extended with a completion flag and the client's final sign-off, it becomes a self-contained VC that a worker can carry as reputation evidence.

### 4.3 Gig Worker Reputation in African Context

Platforms targeting African informal labour markets have explored portable reputation:
- **Lynk (Kenya):** builds worker reputation from job completion history; workers accumulate a "trust score" that clients can query. The reputation is platform-locked — it cannot be exported.
- **Workerly / similar USSD-based platforms:** use mobile number as identity anchor; job history is server-side and non-portable.
- **M-Pesa transaction history:** de facto reputation signal — a worker with a long M-Pesa transaction history (regular payments received) is considered more trustworthy than one without.

**The gap Markers can fill:** None of the above produces a portable, offline-verifiable, worker-held credential. A Marker that transitions from "active agreement" to "completed agreement" (with client's completion signature written to it) is a physical credential the worker holds and can present to future clients — even without internet connectivity.

### 4.4 Personal Token Evolution Path

The Marker-as-personal-token evolution is a three-stage model:

**Stage 1 (transaction record):** Marker = sealed agreement between two parties. Verifiable, but contextual — it proves this agreement happened.

**Stage 2 (reputation artifact):** Completed Markers accumulate in the worker's app wallet. The worker's app aggregates all fulfilled Markers into a reputation summary: "12 completed agreements, total value X, 0 disputes." This summary is shareable as a QR or URL — a lightweight VC derived from the chain.

**Stage 3 (portable identity token):** Worker's DID anchors all Markers they've participated in. A new client can query the worker's DID and retrieve a verifiable list of completed agreements. Markers become the evidence layer for a self-sovereign work identity — portable across platforms, offline-verifiable for the agreements themselves, online-queryable for the aggregate.

---

## 5. Physical Form Factor Recommendations for African Field Contexts

### 5.1 Environmental Constraints

African field contexts impose constraints that eliminate several otherwise viable form factors:
- **Heat:** Sub-Saharan outdoor temperatures regularly reach 40–50°C in field conditions. PVC card stock degrades above 60°C. NTAG chips on standard PVC stickers handle 85°C short-term; industrial epoxy-encapsulated tags handle up to 230°C.
- **Humidity / rain:** Wet season in West and East Africa brings high humidity and rain. IP67-rated encapsulation is the minimum acceptable for any outdoor token.
- **Dust:** Harmattan dust (West Africa), laterite soil (East Africa) — abrasive. Unencapsulated sticker antennas can be scratched and delaminated.
- **No reliable internet:** Verification must work offline. QR-only tokens that point to a server URL fail when connectivity is absent. The physical token must carry the full record or be verifiable against a locally cached copy.
- **KaiOS device NFC range:** KaiOS NFC implementations typically read at 2–5 cm. Wristbands require the device to be held close. Cards require intentional tap. Stickers affixed to paper documents are the most natural interaction.

### 5.2 Recommended Form Factors by Use Case

| Use Case | Recommended Form Factor | Reasoning |
|---|---|---|
| Construction / trade job | IP67 epoxy NFC disc (25mm) affixed to paper job sheet | Survives site conditions; paper provides human-readable context |
| Market vendor agreement | Laminated NFC card (credit card size) | Both parties keep a card; low cost; readable at any kiosk |
| Agricultural contract | NFC label in PET laminate pouch | Pouch protects against mud and moisture; reusable holder |
| Employment / recurring relationship | NFC keyfob or silicone wristband | Wearable for daily tap-in; survives sweat and outdoor wear |
| Land / property agreement | NFC coin embedded in resin block | Durable, permanent, symbolic weight appropriate to gravity of agreement |
| Software-only (no hardware) | QR + server-side WORM | Fallback when NFC not available; works on any camera phone |

### 5.3 What Has Failed in Africa

RFID deployments in African agricultural contexts have struggled when:
- Tags required powered readers (UHF RFID): reader infrastructure cost is prohibitive at village level
- Tags were not encapsulated: delamination from humidity and heat was common within 6 months
- Verification required internet: rural connectivity gaps made online-only verification unusable
- The token was unfamiliar / distrusted: adoption required the form factor to map to a culturally understood artifact (receipt, seal, coin)

NFC has succeeded where it maps to existing practice: transit cards (Côte d'Ivoire SOTRA, Kenya Matatu contactless pilots), loyalty stickers at urban market stalls, and RFID livestock ear tags (ISO 11784/11785) across Southern Africa. The common factors: low-cost passive tag, no reader infrastructure beyond the phone, culturally legible form factor.

---

## 6. Amendment-Compatible Token Architecture

Four architectural options exist for supporting amendments to a sealed Marker:

### Option A: Partial-Lock Physical Token (Append-in-place)

Lock the core agreement pages (ratification state) using NTAG dynamic lock bits. Leave a tail section of pages unlocked. Progress stamps — milestone hashes, completion events — are appended to the unlocked tail. When the tail fills, a "Closure Stamp" is written and the remaining pages are locked.

- **Pros:** Single physical token holds the full history; fully offline; simple tap-and-read shows full state
- **Cons:** Limited tail capacity (NTAG215 has ~360 B of appendable tail if core uses 144 B); no authentication on who writes the tail (anyone with NFC write access can append)
- **Mitigation:** App enforces authenticated write — the app validates party identity and HMAC before issuing the NFC write command. Hardware does not enforce it; software does.

### Option B: Linked Amendment Chain (Software-side, Token is anchor)

The physical Marker is sealed WORM (existing design). All amendments are new records in the pads chain, each carrying a `&c=<marker_uid>` chain link back to the original Marker. The Marker itself is untouched; the chain is the amendment ledger.

- **Pros:** No hardware change needed; Marker is permanently tamper-evident; chain can be arbitrarily long
- **Cons:** Amendment history requires internet or local app cache to retrieve; offline Marker inspection shows only the original ratified state, not current status

### Option C: Latest-State Hash Update (Rolling hash)

The Marker holds a "current state hash" field in an unlocked page. When a milestone is reached and both parties acknowledge it, the app updates this single hash field with the hash of the latest chain state. The Marker always reflects the current state hash; the full history lives in the chain.

- **Pros:** Offline inspection shows whether the Marker is current; compact (4 bytes per update)
- **Cons:** Requires trusted write — either party could forge a state update; requires authentication on the write

### Option D: Separate Amendment Token

When an amendment is agreed, a new Marker is issued — the "Amendment Marker." It carries a chain link to the original Marker and specifies the amendment. Both the original Marker and the Amendment Marker must be presented together for full state verification.

- **Pros:** Both Markers are independently tamper-evident WORM; modular
- **Cons:** Requires two physical tokens; token proliferation for long agreements; neither token alone is sufficient for verification

### Recommendation

For Workpads, the pragmatic answer is a **layered architecture**:

1. **Physical token:** NTAG215 with partial lock (Option A) — core agreement locked, tail pages available for completion stamp
2. **Chain record:** All progress and amendments are pads chain records linked to the Marker UID (Option B) — full history in the app
3. **Offline summary:** Tail pages hold a compact "latest status" (FULFILLED / DISPUTED / ACTIVE) — one byte written on each state transition — so offline tap shows current status without full chain access

This combines the offline usability of Option A, the unlimited history of Option B, and avoids the complexity of Options C and D.

---

## 7. African Context — NFC/Physical Token Precedents

### Successes

- **Kenya Matatu NFC ticketing (Nairobi):** Passive NFC cards work on KaiOS-class devices; tap-to-ride adopted quickly by commuters familiar with cash payment
- **RFID livestock ear tags (Southern Africa):** ISO 11784 LF RFID tags on cattle — proven in heat, dust, and mud; 5+ year lifespan; routine in Zimbabwe, Botswana, South Africa
- **South Africa contactless POS:** 30,000+ terminals deployed in 2023; NFC payments (Visa/Mastercard contactless) accepted at urban markets
- **Agricultural supply chain (Rwanda, Ethiopia):** Coffee cooperative traceability using QR + server-side record — succeeds because verification happens at export point (connected), not at farm level (offline)

### Failures and Lessons

- **UHF RFID at farm level:** High reader cost ($200–$500), no phone integration, failed to gain traction
- **Server-only QR tokens:** Break at the critical moment of field verification when connectivity is absent
- **Complex smart cards (DESFire) for informal markets:** Authentication setup complexity, key management costs, and reader requirements made them non-viable without institutional infrastructure
- **Unlaminated NFC stickers in wet markets:** Delamination within months in Accra and Lagos wet market pilots

**Lesson for Markers:** The form factor must be passive NFC (no battery), IP67-minimum encapsulation for outdoor use, readable by a standard NFC phone, and must carry sufficient data onboard to be usable offline. The QR fallback (Option B in the current design) is the right backup for non-NFC contexts, but server dependency must be explicitly handled with a local cache strategy.

---

## 8. Key Design Decisions Required

The following questions need your input to proceed with a revised MARKERS-DESIGN.md that covers the write-mode spectrum:

**Q1 — Write mode default:** Should the default Marker mode be Final (fully WORM, existing design) or Limited (WORM core + appendable tail)? Or should the write mode be configurable per agreement type?

**Q2 — Progress stamp authority:** In limited write mode, who is authorised to append a progress stamp to the tail pages — either party unilaterally, or must it be a two-party co-signed event? This determines whether the app needs a two-party acknowledgement protocol for milestone writes.

**Q3 — Amendment chain vs. amendment-in-token:** Should amendments always live in the pads chain (no physical token modification), or should the physical token hold at minimum a "latest status" byte? The offline use case is the deciding factor — if workers regularly show Markers to new clients without a phone/internet, the token needs to carry current status.

**Q4 — Personal token timeline:** Is the personal-token / reputation-artifact model (Stage 2 / Stage 3 above) in scope for the current design phase, or is it a future-milestone concept that should be noted but not designed now?

**Q5 — NFC chip upgrade path:** The current design specifies NTAG213/215. If limited write mode or amendment-compatible mode is a target, should the Phase 2 hardware be upgraded to NTAG 5 Link (dual-area password, counter) rather than NTAG215? This affects the Phase 2 hardware BOM cost and reader software complexity.

**Q6 — Three-party agreements (OQ-M3 from existing design):** Is tripartite Marker support (worker + client + guarantor) a requirement for any of the write modes, or is it deferred? Three-party support changes the ratification protocol significantly.

**Q7 — Offline amendment collision (OQ-M6 from existing design):** If both parties can write progress stamps offline with deferred server sync, what is the conflict resolution rule when both write different states for the same milestone? Last-write-wins? Higher-authority party wins? Explicit dispute flag?

**Q8 — Form factor priority:** For Phase 2 hardware Markers, which form factor is the primary target: (a) laminated NFC card, (b) epoxy NFC disc/coin, (c) NFC sticker on paper? This affects production path and unit cost.

---

## Sources Consulted

- [NXP NTAG213/215/216 Datasheet](https://www.nxp.com/docs/en/data-sheet/NTAG213_215_216.pdf)
- [NXP AN12366 NTAG 5 Memory Configuration and Security](https://www.nxp.com/docs/en/application-note/AN12366.pdf)
- [NXP NTAG I²C Plus Application Note AN11579](https://www.nxp.com/docs/en/application-note/AN11579.pdf)
- [NXP NT3H2111/2211 NTAG I²C Plus Datasheet](https://www.nxp.com/docs/en/data-sheet/NT3H2111_2211.pdf)
- [Ethereum State Channels — ethereum.org](https://ethereum.org/developers/docs/scaling/state-channels/)
- [State Channels — EthHub](https://unlock-protocol.github.io/ethhub/ethereum-roadmap/layer-2-scaling/state-channels/)
- [W3C Verifiable Credentials — dock.io Guide](https://www.dock.io/post/verifiable-credentials)
- [Open Badges 3.0 Overview — certifier.io](https://certifier.io/blog/open-badges-3-0)
- [NFC Tag Waterproofing and Durability Guide](https://www.dcnfc.com/blog/Are-NFC-Tags-Waterproof-A-Comprehensive-Guide-to-Water-Resistance-and-Durability_b12812)
- [Industrial IP68 NFC Tags — Shop NFC](https://shopnfc.com/en/industrial-nfc-tags/180-industrial-ip68-nfc-tags-ntag2136-on-metal-34mm.html)
- [Multiple PDF Digital Signatures — Apryse](https://apryse.com/blog/multiple-digital-signature-on-one-document)
- [PDF Studio: Multiple Digital Signatures](https://kbpdfstudio.qoppa.com/multiple-digittal-signatures-on-a-pdf-document/)
- [DocuSign Amendments Post-Signing — Community](https://community.docusign.com/esignature-111/amendments-post-signing-4239)
- [DocuSign Sequential Signing Order](https://www.docusign.com/en-gb/blog/quick-tip-setting-signing-order)
- [Africa Mobile Payments Market — MarketDataForecast](https://www.marketdataforecast.com/market-reports/africa-mobile-payments-market)
- [RFID in Agriculture — RFID4U](https://rfid4ustore.com/rfid-blog/rfid-in-agriculture/)
- [NTAG 5 Link Product Page — NXP](https://www.nxp.com/products/rfid-nfc/nfc-hf/connected-nfc-tags/ntag-ic-plus-2k-nfc-forum-type-2-tag-with-ic-interface:NTAG_I2C)
- [NFC Tag Technical Specifications — Shop NFC](https://shopnfc.com/en/content/6-nfc-tags-specs)
