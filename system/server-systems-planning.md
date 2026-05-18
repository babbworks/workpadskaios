# Server Systems Planning

**Status:** planning — 2026-05-18  
**Scope:** All server-dependent activities across workpads — CDN, IPFS, DID, blind pickup, Marker enforcement, arbitration, template distribution, data sync. Everything that is NOT offline-only, pure P2P, or static interactions with workpads.me.  
**Maintained alongside:** MARKERS-DESIGN.md, ANON-MODE-DESIGN.md, AGREEMENTS-DESIGN.md, ATTACHMENT-DESIGN.md, STANDARD-UPDATES.md SUI-016/017

---

## Overview Map

```
workpads.me / server infrastructure
│
├── A. Template CDN                   serving template JSON, TRIG payloads
├── B. Attachment CDN                 multi-tier image delivery (tiers 1–3)
├── C. Blind Pickup Server            anonymous form submissions + retrieval
├── D. Marker Server (Software WORM)  write-once enforcement for software Markers
├── E. DID Resolver (did:stone:)      Marker UID resolution + W3C registration
├── F. C-TRIG Arbitration             dispute resolution for commitment chains
├── G. Data Sync Bundle               multi-item delivery (template + contact + record)
├── H. IPFS Pinning                   optional censorship-resistant storage
└── I. Third-Party Template Hosting   workpads.me-compatible template pages
```

---

## A. Template CDN

**Status:** designed (TEMPLATE-SYSTEM-DESIGN.md, TEMPLATE-SYSTEM-RESEARCH.md §3)  
**Implemented:** Template registry is live (Round 5 kaios); CDN serving layer not yet built  
**Standard coverage:** template-system.md §Payload Storage; SUI-017 (pending update for three-tier model)

### What it does

Serves template JSON payloads by SHA-256 content hash. Content-addressed = immutable URLs, `Cache-Control: immutable`.

### Three-tier model (as designed)

| Tier | Mechanism | Connectivity required |
|------|-----------|-----------------------|
| Tier 1 (built-in) | Bundled in app at install time | None — always available |
| Tier 2 (CDN) | `workpads.me/t/<sha256-hex>` — Cloudflare primary, Bunny CDN fallback | On first use; cached to IndexedDB after first fetch |
| Tier 3 (peer-to-peer) | Data Sync Bundle embeds template payload inline | None (travels with the record) |

**Cloudflare coverage:** 24 African PoPs including Lagos, Nairobi, Accra, Johannesburg. West African inter-city routing still transits Paris in some cases — known limitation.

### Degraded mode fallback

When template unavailable after 5s CDN timeout:
1. Check IndexedDB by hash → found: render.
2. CDN unavailable: render in "raw mode" (canonical field names, no labels, no formula).
3. Display notice: "Template unavailable. Showing raw record."

### Template not found vs template outdated

Content addressing means old records always reference the old hash, which remains valid forever. Template registry maintains `{template_id → [hash_v1, hash_v2, ...]}` — all versions retained. Callers requesting an old hash get the old template correctly.

### Open items

- [ ] CDN provider selection confirmed? (Cloudflare vs Bunny for primary)
- [ ] Are sector templates (electrician, medical, construction) bundled in app or CDN-only?
- [ ] SUI-017: `template-diffusion.md` needs updating to document three-tier model (currently Tier 3)

---

## B. Attachment CDN

**Status:** designed (ATTACHMENT-DESIGN.md)  
**Implemented:** Not yet (FLAGS3 bit 4 attachment field live; upload/CDN pipeline not built)  
**Standard coverage:** SUI-015 (in-progress)

### What it does

Multi-tier image delivery. The record frame carries a Tier 0 inline thumbnail (ThumbHash, ~28 bytes, zero network calls). Tiers 1–3 are fetched from CDN on demand.

### Tier architecture

| Tier | Resolution | Size target | Use case |
|------|-----------|-------------|----------|
| 0 | Inline thumbnail (~8×8 px blur) | 20–80 bytes in frame | Immediate display, no network |
| 1 | 320×240 px, JPEG Q40–50 | 8–20 KB | Full-screen quality on KaiOS; EDGE-viable (<3s at 56 kbps) |
| 2 | 800×600 px, JPEG Q65 | 60–120 KB | Detail photos, document scans; 3G-viable |
| 3 | Original | Camera original | Archival, legal, print; explicit user request only |

### CDN URL format

```
Primary (workpads CDN):  https://workpads.me/a/<sha256hash>
IPFS (optional):         ipfs://bafybei<CID>
Bare hash (offline ref): sha256:<hex_hash>
```

Content-addressed — hash is identity. `?q=2` or `?q=3` for higher quality tiers from the same hash endpoint. Server stores all tiers keyed by original content hash; Tier 1 served by default.

### Attachment field format

```
"t0:<thumbhash>:<content_url>?t=123"
```

`t=123` declares which tiers are available (bitfield: 1=T1, 2=T2, 3=T3). Upload can be deferred — frame is shareable with Tier 0 before upload completes.

### Upload pipeline (app-side)

```
1. Camera → raw JPEG
2. Generate ThumbHash (embedded in frame immediately)
3. Resize to T1 + T2 buffers
4. Compute SHA-256 of original
5. POST /upload [hash, tier1, tier2, tier3] when connected
6. Server stores, CDN distributes
```

### Privacy constraints

- EXIF stripped before upload (GPS, device model, timestamp removed)
- Plain `#1pa` records: attachment URL is visible in fragment (anyone with URL can fetch image)
- For sensitive attachments: use `#1ps/` (encrypted record) or tokenised CDN URL (time-limited signed URL, not raw hash)
- Face blurring: post-MVP feature (detect + blur faces on upload)

### Open items (OQ-AT1 through OQ-AT5)

- [ ] OQ-AT1: ThumbHash (~3KB JS library) vs quantized micro-thumbnail (no library) — KaiOS memory constraint evaluation needed
- [ ] OQ-AT3: CDN tier routing — same hash `?q=` parameter (simpler) vs separate content-addressed tiers with own hashes (cleaner content-addressing)?
- [ ] OQ-AT4: Pre-upload mutability — does `?t=0` → `?t=0123` update require mutable frame field? Conflicts with immutable frame design. Resolution: the `?t=` param is advisory only; decoder fetches T1 and gets 404 if not yet uploaded, retries later.
- [ ] OQ-AT5: Compact Marker with image — 40B ThumbHash leaves 104B for agreement frame on NTAG213

---

## C. Blind Pickup Server

**Status:** designed (ANON-MODE-DESIGN.md §4)  
**Implemented:** Not yet  
**Standard coverage:** SUI-014 (in-progress)

### What it does

Allows anonymous form senders to receive form submissions without the server being able to link the retrieval to the sender's identity.

### Protocol summary

```
Sender (on device, never leaves)          Server
─────────────────────────────             ─────────────────────────────
master_secret (device-held)
form_uid = random 16 bytes  ──────────→   (not stored until submission arrives)
pickup_code = HMAC(master_secret, form_uid)
pickup_slot_key = SHA256(form_uid || pickup_code)

Receiver submits form  ────────────────→  Server stores at
                                          hash(pickup_slot_key + seq)
                                          Payload: AES-256-GCM(submission, submission_key)
                                          submission_key = HMAC(pickup_code, "submission-key")
                                          Server holds ciphertext it cannot decrypt

Sender fetches:
  GET /pickup
  Auth: HMAC(pickup_slot_key, timestamp)  ──→  Server returns ciphertext
  Sender decrypts locally
```

### Server API surface

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pickup/submit` | POST | Receive anonymous form submission |
| `/pickup/fetch` | GET | Sender retrieves submissions (HMAC auth) |

### Server requirements

1. Encrypted submission storage — AES-256-GCM ciphertext only; server cannot decrypt
2. Rate limiting on pickup slots (prevent enumeration)
3. Auto-deletion: configurable TTL, default 90 days
4. No logging of `form_uid` on submit — server logs only `pickup_slot_key` + timestamp
5. IP non-logging policy for high-risk contexts
6. Optional: onion service / privacy-preserving proxy for whistleblower use cases
7. Replay protection: TOTP-style timestamp HMAC on pickup — replays >5 minutes rejected

### Threat model

| Threat | Protected? |
|--------|-----------|
| Receiver identifies sender from URL | Yes — fragment never sent to server |
| Server logs reveal sender identity | Yes — no sender identity in payload |
| Submission-to-sender correlation | Yes — blind pickup |
| IP address correlation | **No** — sender IP visible on pickup fetch; VPN/Tor required for strong anonymity |
| Timing correlation | **No** — sophisticated adversary can correlate pickup timing |

### Open items (OQ-24)

- [ ] OQ-24a: `sender_alias` encoding location — display_schema display-layer field, max 40B; not in wire field_flags
- [ ] OQ-24b: Anonymous record UID — content-derived hash (stable, same service = same UID) vs random per record (unlinkable but unstable). Decision: likely content-hash for service menus, random for one-shot forms
- [ ] OQ-24c: Pickup code rotation — rotatable `form_uid` for forward secrecy vs UX friction
- [ ] OQ-24d: Anonymous Markers — community land agreements where neither slot carries named identity

---

## D. Marker Server (Software WORM Enforcement)

**Status:** draft-spec (MARKERS-DESIGN.md §3 Option B + D)  
**Implemented:** Not yet  
**Standard coverage:** SUI-009 (ready-to-write)

### What it does

For software Markers (Options B and D in MARKERS-DESIGN.md): enforces write-once semantics server-side. After two party writes for a Marker UID, the entry is sealed and a timestamp signature applied. All further write requests rejected.

### Marker URL format

```
workpads.me/p#1pm/<b64url(marker_uid)>
```

### Server API surface

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /markers/<uid>/write` | Write party slot; body = write token | Accept slot 0 or 1; reject if already sealed |
| `GET /markers/<uid>` | Fetch RATIFIED_FRAME | Returns sealed content or partial state |
| `POST /markers/<uid>/sync` | Offline sync | Accept deferred write with `prev_stone_hash` ordering |

### Write-once enforcement

```
On write request:
  1. Check marker_uid exists — if not, create blank entry
  2. Verify hmac_tag against slot's device key
  3. Check slot_index not already written
  4. Write payload to slot
  5. If all threshold slots filled → apply timestamp signature → SEALED
  6. Reject all future writes to sealed UID
```

### Offline write ordering (prev_stone_hash)

```
Each write token includes:
  prev_stone_hash = SHA256(current_Stone_contents)[0:8]  — 8 bytes
```

Sequential writes: server orders deterministically by prev_stone_hash chain.  
Simultaneous offline writes (same prev_stone_hash): server flags CONFLICT, notifies both parties.

### Hardware vs software Marker distinction

| Marker type | WORM mechanism | Server role |
|-------------|---------------|-------------|
| NFC hardware (NTAG213/215) | Hardware lock bits (permanent) | Optional sync — read-only replication |
| Software server-synced (Option B/D) | Server-enforced write-once | **Required** — canonical WORM enforcer |
| Software P2P (Option E) | HMAC chain on both devices | Optional — deferred sync for third-party verification |

### Open items

- [ ] IPFS option: RATIFIED_FRAME pinned to IPFS as censorship-resistant alternative. Post-MVP (see §H below)
- [ ] Leader-send flow: Party B has no DID; confirmation link at `workpads.me/p#1pm/<uid>` triggers onboarding
- [ ] P2P discovery: how does Party B know which Marker UID to expect when exchanging write tokens via QR? (UX design needed — combined QR with UID + slot 0 token)

---

## E. DID Resolver — did:stone:

**Status:** decided (MARKERS-DESIGN.md §10 Stone DID Identity)  
**Implemented:** UID generation in app (derivation formula decided); resolver not built  
**Standard coverage:** markers-spec.md (SUI-009, ready-to-write)

### What it does

`did:stone:` is a W3C DID method for Marker UIDs. A resolver maps a `did:stone:` DID to a DID Document containing the Marker's current RATIFIED_FRAME and party keys.

### DID format

```
did:stone:<base32(pubkey_hash[0:12])>

Example: did:stone:NBSWY3DPEB3W64TMMQ
```

- Base32 encoding: case-insensitive, QR-efficient, no ambiguous characters
- Key derivation: `keypair = derive(device_master_secret, context_label_hash)` — same device always produces same Stone UID for same context; recoverable from device master secret
- Key derivation for agreement parties: `did:stone:<base32(SHA256(A_did + B_did + timestamp)[0:12])>`
- Phone-hash proxy when Party B has no DID: `did:stone:<base32(SHA256(A_did + SHA256(B_phone_E164) + timestamp)[0:12])>`

### Registration status

- Method `did:stone:` verified available in W3C DID Method Registry (not registered by any other party as of 2026-05-17)
- **Stage 1 (current):** unregistered use in software Markers — valid and functional; no W3C registration required
- **Stage 2 (post-MVP):** resolver infrastructure + W3C registration filing
- **Stage 3 (long-term):** apprenticeship credential export — map fulfilled Stone collection to W3C Verifiable Credentials / Open Badges

### Resolver architecture (stage 2)

```
Lookup: did:stone:NBSWY3DPEB3W64TMMQ

1. DID Document stored at workpads.me/dids/<did>
2. Document contains:
   - @context: W3C DID Core
   - id: did:stone:...
   - verificationMethod: [party A key, party B key]
   - service: [{type: "MarkerEndpoint", serviceEndpoint: "workpads.me/markers/<uid>"}]
```

### Open items

- [ ] Stage 2 timeline: when does resolver infrastructure need to be live? (Post-MVP milestone)
- [ ] W3C DID Method Registry submission — requires spec doc; markers-spec.md (SUI-009) is the input
- [ ] Credential export design (stage 3) — separate design session needed

---

## F. C-TRIG Arbitration Server

**Status:** draft-spec (AGREEMENTS-DESIGN.md §3.3)  
**Implemented:** Not yet  
**Standard coverage:** SUI-010 agreements-spec.md + SUI-011 ctrig-evaluator-spec.md (both ready-to-write)

### What it does

When two parties disagree on C-TRIG evaluation (commitment condition resolution), either party may escalate to server arbitration. Normal operation is always client-local — server arbitration is the fallback, not the default.

### Three arbitration levels

| Code | Level | What server receives | Privacy |
|------|-------|---------------------|---------|
| 00 | Lightweight | C-TRIG bytecode + chain state summary (hashes + timestamps) | High — minimal data |
| 01 | Standard | Full record frames from all chain participants | Medium — server sees all fields |
| 10 | Privacy-preserving | Both parties independently sign chain summary; server evaluates against signed hashes only | High — server sees only signatures |
| 11 | Reserved | — | — |

### Server arbitration protocol

```
1. Party raises dispute → Amendment with DISPUTE_FLAG=1 + ARBITRATION_LEVEL bits
2. Party sends dispute request to /arbitration endpoint:
     Level 00: { ctrig_bytecode, chain_hashes[], timestamps[] }
     Level 01: { full record frames }
     Level 10: { signed_summary_A, signed_summary_B }
3. Server evaluates C-TRIG against received state
4. Server returns signed evaluation result
5. Both parties must accept result or escalate to off-protocol dispute resolution
```

### Async condition resolution (halt-and-re-trigger)

When C-TRIG encounters an unresolvable condition (e.g. `SERVER_EVALUATION_RECEIVED`, payment gateway confirmation):
1. Evaluator halts entire program
2. App registers server listener for expected confirmation event
3. On confirmation arrival: full C-TRIG program re-evaluates from byte 0
4. Agreement shows "awaiting confirmation" during halt
5. Evaluator is stateless — chain record state is source of truth, not evaluator memory

### Open items

- [ ] OQ-40: Extended condition registry (PUSH_COND escape byte `0x1F`) — deferred; needs dedicated research session on smart contract conditions, Ricardian contracts, P2P enforcement
- [ ] Payment gateway integration: when `PAYMENT_CONFIRMED` condition requires external payment network confirmation, what API does the server poll?
- [ ] Server arbitration binding: are server evaluation results legally binding in target markets? (Out of protocol scope, but affects how the "binding arbitration" language is presented in UI)

---

## G. Data Sync Bundle

**Status:** designed (TEMPLATE-SYSTEM-RESEARCH.md §5); delivery model resolved  
**Implemented:** Not yet  
**Standard coverage:** SUI-016 (Tier 3 pending)

### What it does

Packages multiple items (template, contact, record) into a single shareable URL or sequential bundle. Receiver installs dependencies before displaying the record. Enables offline-first template delivery without CDN.

### Bundle format

```
workpads.me/sync#1pa/<bundle-payload>

bundle-payload = deflate-compressed sequence:
  [bundle_header]     1B — bundle type + item count
  [item_1]            type byte + length + payload
    type 0x01 = template JSON
    type 0x02 = list (contact/price list)
    type 0x03 = contact data
    type 0x04 = record (pads-v1 frame — always the final item)
  [item_2] ...
```

**Resolved delivery model:** Record-first with background dependency fetch. No bundle URL required in the common case. Bundle is for offline / P2P contexts where CDN is unavailable.

### Partial failure handling

| Item fails | Behaviour |
|------------|-----------|
| Template install fails | Skip; render in raw mode |
| List fails | Record opens without autofill; list fetchable later via `#t/` URL |
| Contact install fails | Record opens; contact auto-created from participants block |

### Size budget

Typical bundle (template + contact + record): 1–2 KB deflated → 1.4–2.8 KB base64url. Well within 8 KB URL limit on KaiOS 3.0 Gecko and modern browsers.

### Open items

- [ ] SUI-016: write data-sync-bundle.md standard doc (Tier 3, non-blocking)
- [ ] Sequenced dependency hydration: define strict ordering — template first, then list, then contact, then record

---

## H. IPFS Pinning

**Status:** mentioned/speculated (MARKERS-DESIGN.md §12, ATTACHMENT-DESIGN.md §4)  
**Implemented:** Not yet  
**Standard coverage:** None yet (post-MVP)

### What it does

Content-addressed storage on IPFS provides a censorship-resistant, server-independent alternative for long-lived content. Two current design mentions:

**1. Marker RATIFIED_FRAMEs:**
> "IPFS storage option for software Markers — RATIFIED_FRAME pinned to IPFS as a content-addressed alternative to the workpads CDN. Provides censorship resistance for long-lived commitments. Post-MVP."

**2. Attachment images:**
> `ipfs://bafybei<CID>` is a valid content URL format in the attachment field. IPFS CID of the full-res image. Gateways: `https://ipfs.io/ipfs/<CID>` or local IPFS node.

### Architecture sketch

```
workpads server pins content to IPFS on upload (or on request)
Content URL becomes: ipfs://<CID>
    → Decoded by receiver via gateway: https://ipfs.io/ipfs/<CID>
    → Or via local node if installed

For Markers: RATIFIED_FRAME pinned at ratification time
    → Frame hash = IPFS CID (SHA-256 = valid CIDv1 with codec raw)
    → Any IPFS gateway can serve the frame indefinitely
    → Server can fail; Marker is still resolvable
```

### Why IPFS for Markers specifically

Markers represent long-lived commitments — employment terms, trade credentials, land agreements. If workpads.me goes offline, these commitments should still be verifiable. IPFS pinning (by workpads server, by the parties themselves, or by a pinning service like web3.storage/Pinata) provides multi-party redundancy.

### Open items

- [ ] IPFS as opt-in vs default for Markers? (Default = server only; opt-in = parties request IPFS pin at ratification)
- [ ] CID version: CIDv1 with `raw` codec or `dag-pb`? Raw is simpler for binary frames.
- [ ] Pinning service integration: workpads server self-pins vs delegates to web3.storage/Pinata
- [ ] Attachment IPFS: Tier 1 needs a separate CID from Tier 3 (different content = different hash). Server stores both; IPFS URL always refers to the specific tier's content.

---

## I. Third-Party Template Hosting

**Status:** designed (template-system.md §Carry Mechanism)  
**Implemented:** Template detect+ingest in app (Phase 2 planned); CDN serving TBD  
**Standard coverage:** template-system.md §Carry Mechanism (Phase 2)

### What it does

Any static HTML page can embed a template payload in a `<script>` tag. When a workpads user visits the page in the in-app browser, the app detects and ingests the template — no workpads server required.

### Embedding format

```html
<script type="application/workpads-template" data-platform="all">
eJyNj0EK...   ← fflate-deflated, base64url-encoded template JSON
</script>
```

### Detection + consent flow

1. App scans for `<script type="application/workpads-template">` tags
2. Decodes and reads header (uri, name, version) — no full parse
3. Skips if already at current version, or user has refused this URI before
4. Presents consent prompt: template name, origin domain, trust level
5. On accept: stores manifest + payload
6. On refuse: records URI in refusals store — not surfaced again from same origin

### Interaction with `#1pt/` (template-keyed records)

When a third party hosts a workpads template and shares `#1pt/` records encrypted with that template hash:
- Receiver visits the third-party page → ingests template
- Receiver opens `#1pt/` URL → template hash matches; decrypts successfully
- This is the "blind to content" hosting model: the third-party server hosts the template but cannot read the records (the record content is AES-encrypted with the template hash as key)

### Blind-to-content hosting security model

The third-party server serves template JSON. The template hash is the `#1pt/` decryption key. The third-party server **does** have the template, therefore technically **can** decrypt records encoded with that template key.

This is documented as "partner-confidential, not high-security" — it protects against uninvolved third parties, not against the template host itself. See TEMPLATE-SYSTEM-RESEARCH.md §6.

For records requiring protection from the template host: use `#1ps/` (passphrase AES) instead of `#1pt/`.

### Open items

- [ ] Phase 2 implementation: in-app browser scanner activation
- [ ] Trust level assignment: how does the app determine `trust: 'community'` vs `trust: 'official'` for third-party pages? Domain allowlist? Manual review?
- [ ] Gallery index: `<link rel="workpads-gallery">` pointing to a template catalogue on the third-party site (Phase 3 planned)

---

## Summary: Server Components by Build Phase

| Component | Phase | Blocking what | Design status |
|-----------|-------|---------------|---------------|
| Template CDN (`/t/<sha256>`) | MVP | Sector template distribution | Designed; build ready |
| Attachment CDN (`/a/<sha256>`) | MVP | Photo attachments in records | Designed; OQ-AT1/AT3 open |
| Blind Pickup Server (`/pickup/*`) | MVP | Anonymous mode forms | Designed; OQ-24 open |
| Marker Server (`/markers/<uid>`) | Post-MVP | Software Markers (Options B/D) | Draft-spec |
| C-TRIG Arbitration | Post-MVP | Dispute resolution in agreements | Draft-spec |
| DID Resolver (`did:stone:`) | Post-MVP (stage 2) | W3C compatibility; credential export | Stage 1 in progress |
| Data Sync Bundle | Post-MVP | Offline template delivery | Designed |
| IPFS Pinning | Post-MVP | Censorship-resistant Markers + attachments | Speculative |
| Third-party template hosting | Phase 2–3 | Template ecosystem growth | Designed (Phase 1 detection not yet active) |

---

## Cross-Cutting Server Design Principles

### Fragment-only identity (no server sees keys)

All workpads share URLs use the URI fragment (`#...`) for record payloads, template hashes, and Marker UIDs. Fragments are never sent in HTTP requests — they are browser-client-only. The server receives only the path and query string.

This means:
- The workpads server cannot read records hosted on its own domain
- CDN logs contain only request paths, not record content
- Template hash keys are not in server logs

### Content-addressed immutability

Templates, attachments, and RATIFIED_FRAMEs are all content-addressed by SHA-256. Once stored, their URLs never change. This enables aggressive caching, P2P delivery (any node holding the content can serve it), and IPFS compatibility (SHA-256 = valid CIDv1 raw).

### Offline-first, server-assisted

Server components exist to enhance, not require. Each feature degrades gracefully:
- Template CDN → raw mode rendering
- Attachment CDN → Tier 0 inline thumbnail only
- Marker server → P2P write exchange (Option E)
- C-TRIG arbitration → local evaluation only (dispute noted, not resolved)

### Server never sees decrypted content

For `#1ps/` and `#1pt/` records, the server stores only encrypted bytes. For blind pickup, the server stores AES-256-GCM ciphertext it cannot decrypt. For C-TRIG Level 10 arbitration, the server evaluates only against signed hashes.

---

## Outstanding Design Questions (Server-Specific)

| ID | Question | Blocking |
|----|----------|---------|
| OQ-AT1 | ThumbHash library vs no-library for Tier 0 thumbnail | Attachment CDN build |
| OQ-AT3 | CDN tier routing: `?q=` parameter vs separate hashes per tier | Attachment CDN build |
| OQ-24b | Anonymous record UID: content-derived vs random | Blind pickup server build |
| OQ-24c | Pickup code rotation for forward secrecy | Blind pickup hardening |
| OQ-M-IPFS | IPFS pinning: opt-in vs default for Markers | Post-MVP; not blocking |
| OQ-40 | Extended C-TRIG condition registry (PUSH_COND escape) | Arbitration completeness |
| OQ-DID-2 | W3C DID registration timeline for `did:stone:` | Stage 2 resolver |

---

*Kaios source files: MARKERS-DESIGN.md, ANON-MODE-DESIGN.md, AGREEMENTS-DESIGN.md §3.3, ATTACHMENT-DESIGN.md, TEMPLATE-SYSTEM-RESEARCH.md §3/5/6, TEMPLATE-SYSTEM-DESIGN.md, CTRIG-EVALUATOR-DESIGN.md*
