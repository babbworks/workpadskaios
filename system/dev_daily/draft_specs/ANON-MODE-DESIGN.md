# Anonymous Mode Design (DATA_SOURCE=11)

**Status:** design — 2026-05-17
**Depends on:** FRAME-SPEC.md §11.1, §11.2, §12; OQ-24
**Maturity:** notes → **design** → draft-spec → spec → standard-doc

---

## 1. Purpose and Use Cases

Anonymous mode allows a workpads record to be shared publicly with zero sender identity in the payload. No name, no phone, no routing address, no reply path visible to the receiver. The shell displays placeholder text only.

**Use cases:**

| Scenario | Why anonymity matters |
|----------|----------------------|
| Community service menu shared in a public WhatsApp group | Sender doesn't want strangers having their phone number |
| Anonymous feedback form (customer satisfaction) | Receiver cannot pre-filter or discriminate based on sender identity |
| Blind tender/quote submission | Parties submit prices without knowing each other's identity until the close |
| Whistleblower reporting form | Identity protection is mandatory |
| Market price board | Vendor wants price visibility but not personal contact on a public channel |
| Sensitive professional services (counselling, legal aid, health) | Client confidentiality — the request itself must not expose the requestor |

---

## 2. Wire Mechanism

Anonymous mode is signalled by `DATA_SOURCE=11` in the display_schema DISPLAY_CONTROL byte (§11.1 of FRAME-SPEC).

```
DISPLAY_CONTROL bits 5-4: DATA_SOURCE = 11
```

**Required constraints when DATA_SOURCE=11:**
- `RECIPIENT_TYPE=0` in meta1 (any receiver — cannot name a specific recipient)
- `IS_SENDER=1` MUST NOT appear in any participant in the participants block (no sender identity)
- `SUBMIT_ACTION=11` REQUIRED if a form schema is present (blind pickup — no routing address in payload)
- The participants block, if present, contains only non-sender participants (e.g., the service being offered, no originating party)

**What the frame OMITS in anon mode:**
- Sender name (`worker` field, bit 8)
- Sender phone (`customer_phone`, bit 7 — this field name is legacy; it's the contact phone)
- Any `IS_SENDER=1` participant
- The `url` field (FLAGS3 bit 6) — if it would reveal sender identity
- Any UID that could be correlated to sender identity

**What the frame MAY still contain:**
- Service description (`job`, bit 0) — what is being offered
- Location (`location`, bit 3) — service area, non-identifying
- Prices and financial context (financial block present)
- Display schema (TRIG programs, display type, form schema)
- An anonymous-stable content UID (a hash of the service description, not a device UID)

---

## 3. Shell Display Behaviour

When the shell decodes a frame with DATA_SOURCE=11:

```
Sender name:    "Anonymous"  (or template-defined placeholder e.g. "Service Provider")
Sender avatar:  Generic icon (no initials, no photo)
Contact button: Hidden
Reply button:   Shown only if form schema present AND SUBMIT_ACTION=11
Chain button:   Hidden (no chain reply path to anonymous sender)
```

**Template override for placeholder text:**
The display_schema can carry a `sender_alias` in its display fields — a non-identifying descriptor the sender chooses to show: "Local electrician", "Community health service", "Market Trader". This is NOT a name — it does not identify the person. Templates declare `anon_alias_field: true` to enable this.

**Warning banner (when shell detects DATA_SOURCE=11):**
```
"This record was shared anonymously. The sender cannot be identified or contacted
 through this link."
```
Banner is always shown, cannot be suppressed by template. This protects receivers from confusing anonymous records with named ones.

---

## 4. Blind Pickup — SUBMIT_ACTION=11

When a form is present with `SUBMIT_ACTION=11`, submissions go to a server-side blind pickup slot. The sender retrieves them without the server being able to link the retrieval to the sender's identity.

### 4.1 Pickup Code Derivation

```
master_secret    = device-held secret (never leaves device, never sent to server)
form_uid         = a random identifier embedded in the form record
pickup_code      = HMAC-SHA256(master_secret, form_uid)   [computed locally]
pickup_slot_key  = SHA256(form_uid || pickup_code)         [sent to server as the slot address]
```

The server stores submissions keyed by `pickup_slot_key`. It never sees `master_secret` or `pickup_code`. The sender fetches submissions by presenting `pickup_slot_key` — which the server cannot link to any identity.

**Flow:**

```
Sender (app)                          Server
─────────────────                     ─────────────────
1. Create form record
2. Generate form_uid (random)
3. Derive pickup_code locally
4. Compute pickup_slot_key
5. Embed form_uid in frame ──────────→ Server stores nothing yet
6. Share the #1pa or #1pb URL

Receiver fills form ─────────────────→ Server stores submission at
                                        hash(pickup_slot_key + seq)
                                        Server does NOT know sender

7. Sender fetches: GET /pickup
   Authorization: HMAC(pickup_slot_key, timestamp) ──→ Server returns submissions
   Server sees a valid HMAC but cannot
   identify which device holds
   master_secret
```

### 4.2 Submission Storage on Server

Submissions are stored encrypted. The server cannot read them:

```
submission_key  = HMAC-SHA256(pickup_code, "submission-key")
stored_payload  = AES-256-GCM(submission_content, submission_key)
server stores:  (pickup_slot_key, encrypted_payload, timestamp)
```

The server holds ciphertext it cannot decrypt. Only the sender (holding master_secret → pickup_code → submission_key) can decrypt.

**Retention policy:** submissions auto-deleted after 90 days (configurable in form_schema). Server stores a deletion timestamp alongside each submission.

### 4.3 Replay and Enumeration Protection

- Pickup requests require a TOTP-style timestamp HMAC — replays older than 5 minutes rejected
- Server rate-limits pickup attempts per slot — prevents brute-force enumeration
- `form_uid` is 16 random bytes — 128-bit entropy prevents guessing

---

## 5. Sender Anonymity Threat Model

### What anonymous mode protects against:

| Threat | Protection |
|--------|-----------|
| Receiver identifies sender from URL | Fragment never sent to server; URL reveals nothing |
| Server logs reveal sender identity | No sender identity in payload; server sees only timing + IP |
| CDN / proxy logs | Fragment stripped by browser before any network request |
| Submission-to-sender correlation | Blind pickup — server cannot link retrieval to identity |
| UID correlation across records | Anonymous records use service-hash UIDs, not device UIDs |

### What anonymous mode does NOT protect against:

| Threat | Note |
|--------|------|
| IP address correlation | Sender's IP is visible to server on pickup fetch. Use VPN/Tor for strong anonymity. |
| Timing correlation | Pickup fetch timing relative to submission timing may be correlated by a powerful adversary |
| Content fingerprinting | Unique service descriptions may identify the sender even without explicit identity fields |
| Shared device context | If the same device is used for anonymous and named records, a compromised device breaks anonymity |

**Guidance for high-risk use cases** (whistleblower, political context):
1. Use cellular data, not WiFi (WiFi MAC is potentially linkable)
2. Fetch pickups from a different network than the submission was created on
3. Use the anon alias instead of recognisable service descriptions
4. Consider a rotating form_uid (regenerate form after each pickup window)

---

## 6. Anonymous Mode and the Chain Protocol

**Anonymous records cannot participate in named chains.** A chain link (`&c=<parent_uid>`) in the URL suffix is visible metadata. If the anonymous record's UID appears in a named chain, the chain topology links the anonymous record to the named sender.

**Rules:**
- A record with DATA_SOURCE=11 MUST NOT set `CHAIN=1` in meta1
- The `&c=` URL parameter MUST NOT appear in anonymous record URLs
- Amendment records (BASE_TEMPLATE=110) with a parent chain pointing to a DATA_SOURCE=11 record inherit the anonymity constraint — they also cannot be named-sender records

**Anonymous record chains** (anonymous-to-anonymous) ARE allowed: both records have DATA_SOURCE=11, no names in either. Used for multi-step anonymous forms (wizard-style submission across multiple records).

---

## 7. TRIG Interaction

TRIG programs in anonymous records MUST NOT use conditions that reveal sender identity. Safe conditions:

| Condition | Safe for anon? |
|-----------|---------------|
| `HAS_PHONE` | ✗ — tests receiver phone; exposes receiver |
| `IS_ORG` | ✓ — tests form structure |
| `ROLE_TYPE` | ✓ — tests viewer role (customer/worker/supplier) |
| `HAS_FINANCIAL_BLOCK` | ✓ — tests record structure |
| `DATE_REACHED` | ✓ — time-based |

TRIG programs in anonymous records may use display modes to gate content based on VIEWER role — this is the intended use. Example: "Show price to role=Customer; hide price to role=Worker" — works without revealing sender identity.

---

## 8. DATA_SOURCE=11 and `#1pb/` Interaction

The combination `#1pb/ + DATA_SOURCE=11` is the primary delivery mechanism for anonymous public records:
- `#1pb/` — public billboard URL (safe for public channels, WhatsApp broadcast, QR code)
- `DATA_SOURCE=11` — no sender identity in payload

This combination is the "anonymous service menu" pattern. A market trader posts their price board in a public WhatsApp group with no personal details. Any receiver can view prices and submit a form. The trader retrieves form submissions via blind pickup.

The `#1pa/` + `DATA_SOURCE=11` combination is valid but unusual (plain record, no display schema, anonymous — used for data-only anonymous submissions).

The `#1ps/` (full scramble) + `DATA_SOURCE=11` combination creates an anonymous but encrypted record — the content is private to key-holders, and the sender is anonymous. Use case: anonymous quote submission in a sealed tender.

---

## 9. Server Requirements

To support DATA_SOURCE=11, the server must implement:

1. **Blind pickup endpoint:** `POST /pickup/submit` (receive anonymous submission), `GET /pickup/fetch` (sender retrieves with HMAC auth)
2. **Encrypted submission storage:** server stores AES-256-GCM ciphertext only
3. **Rate limiting on pickup slots:** prevent enumeration
4. **Auto-deletion:** configurable TTL per submission (default 90 days)
5. **No logging of form_uid on submit:** form_uid appears in the encrypted payload; server logs only the pickup_slot_key and timestamp
6. **IP non-logging policy:** for high-risk use cases, pickup endpoint should be accessible via onion service or a privacy-preserving proxy

---

## 10. Open Design Questions

- **OQ-24a** — `sender_alias` encoding: where in the frame? Best option: a short text in display_schema (display-layer field, not a data field), max 40B. Not in wire field_flags. Template-dependent rendering.
- **OQ-24b** — Anonymous record UID: should it be a hash of the service description (content-derived, stable, not device-linked) or a random UUID per record (unlinkable but not stable for same-content records)?
- **OQ-24c** — Pickup code rotation: should `form_uid` be rotatable after each pickup window? Would require re-encoding and re-sharing the URL. Tradeoff: stronger forward secrecy vs UX friction.
- **OQ-24d** — Anonymous mode and Markers: can an anonymous record be ratified in a Marker? Markers require two-party writes, which implies identity. Partial resolution: anonymous Markers may exist where both parties are anonymous (community land agreement, cooperative pricing pact) — Marker holds terms but neither slot carries a named identity.
- **OQ-24e** — `#1pm/` (Marker tag) + anonymous: is a Marker URL itself anonymous? The Marker URL reveals the Marker UID (linkable to the ratification event). For anonymous Markers, hashed Marker UIDs should be used in the URL.
