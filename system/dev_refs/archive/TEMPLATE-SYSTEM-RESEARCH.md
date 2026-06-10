# Template System Research Report

**Date:** 2026-05-17
**Status:** Research complete — awaiting user decisions
**Scope:** Template definition schema, formula encoding, CDN distribution, field vocabulary, Data Sync Bundle, key exchange security
**Cross-reference:** TEMPLATE-CATALOGUE.md, FRAME-SPEC.md, CODEC-EVOLUTION.md

---

## 1. Template Definition Schema

### Research findings

JSON Schema (IETF standard) is the dominant pattern for form/template definitions. Systems like react-jsonschema-form, JSON Forms (EclipseSource), and Form.io all use a two-layer model: a **data schema** (field types, validation, required markers) plus a **UI schema** (labels, layout, display order). This separation is directly applicable to Workpads.

Key patterns observed:
- Field labels are a presentation concern, separated from field identity. The field's canonical name is stable; the label is template-specific.
- Conditional logic (if/then/else in JSON Schema) handles field visibility rules.
- Tally formulas are not part of standard JSON Schema — they require an extension layer.

### Recommended Workpads template definition schema

```json
{
  "template_id": 42,
  "name": "Electrician Invoice",
  "domain": "electrician",
  "version": 1,
  "base_template": "001",
  "label_map": {
    "job":               "Job description",
    "qty":               "Hours worked",
    "customer_amount":   "Labour charge",
    "worker_amount":     "Materials cost",
    "total":             "Total due"
  },
  "field_order": ["job", "customer", "date", "qty", "customer_amount", "worker_amount", "total"],
  "required_fields": ["job", "customer", "date", "total"],
  "optional_fields": ["qty", "customer_amount", "worker_amount", "details"],
  "hidden_fields": [],
  "formula": {
    "total": "customer_amount + worker_amount + call_out_fee",
    "call_out_fee": "50"
  },
  "display": {
    "accent_color": "#F5A623",
    "header_field": "job",
    "subheader_field": "customer",
    "show_totals_row": true,
    "currency_position": "prefix"
  },
  "constraints": {
    "qty": { "min": 0, "max": 24, "unit": "hours" },
    "customer_amount": { "min": 0 }
  },
  "meta": {
    "author": "system",
    "created": "2026-05-17",
    "content_hash": "<sha256-hex>",
    "codebook": "1pa"
  }
}
```

**Key decisions in this schema:**
- `label_map` maps canonical wire field names to human labels. Wire fields are always stable; labels change per template.
- `formula` is a separate object — human-readable infix strings stored in the template JSON, evaluated by the app at render time.
- `display` carries visual/CSS hints without being prescriptive about pixel layout.
- `meta.content_hash` is the SHA-256 of the canonical serialisation — used as the `#1pt/` template identity and as the encryption key for `#te/` records.
- `version` is a monotonic integer. When a template is updated, a new content hash is produced; old records referencing the old hash continue to decode correctly.

---

## 2. Tally Formula Systems

### Research findings

**RPN (Reverse Polish Notation) bytecode** is how spreadsheets (Excel XLSB, LibreOffice ODS binary) internally encode formulas. User-entered `= hours * rate + parts` is tokenised and stored as a postfix byte sequence. The JVM uses the same stack-based model. Advantages for Workpads:
- No parenthesis parsing — stack machine evaluation is O(n) tokens.
- Compact: a 5-token formula (`hours rate * parts + call_out +`) encodes as ~10 bytes.
- Evaluable offline with a 20-line JS stack machine.
- No external library needed on KaiOS.

**npm `math-expression-evaluator`** handles infix strings directly but adds ~15 KB to the bundle — acceptable for KaiOS 3.0, marginal for 2.5.

**Recommended dual-layer approach:**

| Layer | Format | Used for |
|-------|--------|----------|
| Template JSON (registry) | Human-readable infix string | Authoring, display in template editor |
| Compiled bytecode (optional, in-frame) | RPN token sequence | Inline offline evaluation without template fetch |

The infix string is the source of truth. On template save, the app compiles it to an RPN token sequence. For offline-first, the compiled bytecode can be embedded in the frame's `trig_block` (already designed in FRAME-SPEC §5 — HAS_TRIG_BLOCK flag in meta2). This resolves CODEC-3 (open question in CODEC-EVOLUTION.md): formulas live in **both** the template JSON (human-readable) and the `trig_block` (compact bytecode for offline evaluation).

### Compact formula bytecode encoding

Proposal: 4-bit opcode, variable operand.

```
Opcodes (4-bit):
  0x1  LOAD_FIELD    — next byte = field index in FLAGS registry
  0x2  LOAD_CONST    — next 3 bytes = uint24 constant (BitLedger encoded)
  0x3  ADD
  0x4  SUB
  0x5  MUL
  0x6  DIV
  0x7  END

Example: total = hours * rate + parts
  LOAD_FIELD(qty=0x04)  LOAD_FIELD(worker_amount=0x0A)  MUL  LOAD_FIELD(customer_amount=0x09)  ADD  END
  = 7 tokens × ~1.5 bytes avg = ~10–12 bytes
```

This easily fits within `trig_block`. A simple stack evaluator in JS is ~25 lines and adds zero bundle weight.

---

## 3. CDN and Template Distribution

### Research findings

**Cloudflare in Africa:** Cloudflare has 24 PoPs across Africa including Lagos (Nigeria), Nairobi/Mombasa (Kenya), Accra (Ghana), Johannesburg, Durban, Cape Town. Real-user latency in Kenya dropped measurably after Nairobi PoP launch. However, routing between West African cities (e.g. Cameroon to Ghana) often transits Paris — a fundamental peering gap that no CDN fully solves at this time.

**Bunny CDN** has African nodes in Nairobi and Cape Town. Cheaper than Cloudflare for egress. Better for static asset delivery where cost matters more than edge compute.

**Offline-first architecture** (standard pattern): local-first storage → background sync when connected. For KaiOS 3.0: Service Worker + Cache API is supported. For KaiOS 2.5: no Service Worker; fall back to localStorage (synchronous, main thread only) or IndexedDB (async, preferred).

**Content-addressed distribution (IPFS model):** Templates are identified by SHA-256 of their bytes. This means any CDN, any server, any peer can serve a template — the receiver validates the hash before installing. No trust in the delivery path required.

### Recommended distribution strategy

**Three-tier model:**

**Tier 1 — Built-in (zero connectivity):** System templates (Groups A–H in TEMPLATE-CATALOGUE.md) bundled in the app at install time. These never need a network fetch.

**Tier 2 — CDN-served (connectivity opportunistic):** Custom and sector templates (Groups I–J) served from `workpads.me/t/<sha256-hex>`. Use Cloudflare as primary CDN — best African PoP coverage. Cache with `Cache-Control: immutable` (content-addressed = never changes). On first fetch, store in IndexedDB keyed by sha256. On subsequent opens, serve from IndexedDB.

**Tier 3 — Peer-to-peer (no connectivity):** The `#t/` URL IS the template. The sender embeds the template payload in the Data Sync Bundle (see §5) when sharing offline. No CDN needed — template travels with the record.

**Template not found — degraded experience fallback:**
1. Check IndexedDB by hash → found: render immediately.
2. Not found: attempt CDN fetch (timeout 5 s on KaiOS).
3. CDN unavailable: render in "raw mode" — show canonical field names, no labels, no formula.
4. Display inline notice: "Template unavailable. Showing raw record."

**Template update while old records exist:**
Content addressing means old records always reference the old hash, which remains valid forever. No migration required. The template registry maintains an index `{template_id → [hash_v1, hash_v2, ...]}` — all versions are kept.

---

## 4. Form Field Vocabulary for Workpads

### Research findings

SurveyJS has 20+ field types including a Signature Pad component (built-in, touch-enabled, outputs base64 PNG on submit). Form.io's Signature component does the same. Neither has explicit KaiOS support, but both are plain JS without DOM framework dependencies.

KaiOS 3.0 runs Gecko 65 (approximate). Capabilities confirmed:
- localStorage: yes (synchronous, main thread only)
- IndexedDB: yes (async, preferred)
- Service Worker: yes (3.0 only; absent on 2.5)
- Canvas API: yes (enables signature capture)
- Geolocation API: yes (navigator.geolocation)
- Camera: yes (via `<input type="file" accept="image/*" capture>` or DeviceStorage API on 2.5)
- WebAssembly: yes (KaiOS 3.0 confirmed)

### Recommended field type vocabulary

Grouped by KaiOS feasibility:

**Tier A — Fully supported, use now:**

| Field type | Wire encoding | Notes |
|------------|--------------|-------|
| `text` | `[u16 len][UTF-8]` | General text input |
| `number` | BitLedger N=A×2^S+r | Amounts, quantities |
| `date` | uint16 days since 2000 | COMPACT_TIME mode |
| `time` | uint16 minutes since midnight | COMPACT_TIME mode |
| `boolean` | flag-only (no data block) | Yes/no, checkbox |
| `select` | 1-byte enum index | Fixed-choice list |
| `multi-select` | bitfield byte | Multiple choices |
| `phone` | `[u16 len][UTF-8]` | Maps to customer_phone |
| `actions_list` | actions array (bit 9) | Checklist / task list |

**Tier B — Supported with constraints:**

| Field type | Wire encoding | Constraints |
|------------|--------------|-------------|
| `signature` | `[u16 len][base64-PNG]` | Canvas API required; large payload (~5–20 KB); attach as `details` or separate attachment field |
| `gps_location` | `[lat_int16][lon_int16]` | ±0.001 degree precision (±111 m); Geolocation API required; user permission prompt |
| `photo_attachment` | URL ref or base64 chunk | Camera capture via file input; store URL not inline bytes; flag OQ-17 (form builder) |
| `rating_scale` | 1-byte value + 1-byte max | Render as D-pad navigable stars on KaiOS |
| `free_text_long` | `[u16 len][UTF-8]` max 2000 B | Maps to `story` field (bit 11) |

**Tier C — Post-MVP / nice-to-have:**

| Field type | Notes |
|------------|-------|
| `conditional_branch` | if/then/else on field value; render via template visibility rules |
| `repeating_section` | Line items in compound records (already handled by compound frame); form-builder UI deferred |
| `barcode_scan` | Barcode Detection API — KaiOS 3.0 only; not confirmed |
| `audio_note` | MediaRecorder API — KaiOS 3.0 possible; large payload; post-MVP |
| `nfc_tap` | Web NFC — not available on KaiOS |

**Mapping note:** GPS location needs a decision on wire encoding. Two options: (a) compact `[int16 lat][int16 lon]` = 4 bytes, ±0.001 deg precision; (b) UTF-8 decimal string in `location` field (existing, no new wire bytes needed). Option (b) is simpler for MVP.

---

## 5. Data Sync Bundle — Design Recommendation

### Research findings

**Closest precedents found:**
- NFC NDEF multi-record payloads: a single NFC tap can carry multiple NDEF records in sequence (URL, text, custom binary). The receiver processes them in order. Partial failure handling is per-record.
- PWA install flows: progressive install prompts after a user action — install SW first, then open content. Partial failure (SW failed to install) degrades to online-only mode.
- QR code chaining: no standard exists for "QR sequence must complete before opening content." Ad-hoc implementations use a step counter in each QR and retry logic.
- IPFS content addressing: CIDs chain — a file references its dependencies by hash. The node fetches each dependency in order before the final content is available.

No single precedent covers the full "install template + list + contact, then open record" sequence. The closest architectural match is **IPFS dependency resolution**: each link in the chain is content-addressed; the final content is blocked until dependencies are resolved.

### Recommended Data Sync Bundle design

The bundle is a sequence of URL fragments, each self-contained and content-addressed. Delivered as a single shareable URL or as sequential links in a messaging thread.

**Bundle format:**
```
workpads.me/sync#1pa/<bundle-payload>
```

Where `bundle-payload` is a deflate-compressed sequence:
```
[bundle_header]       1 byte — bundle type + item count
[item_1]              type byte + length + payload
  type 0x01 = template payload (raw template JSON bytes)
  type 0x02 = list payload (contact list or price list)
  type 0x03 = contact data
  type 0x04 = record (the final record frame)
[item_2] ...
[item_n]
```

Each item is installed on the receiver's device before the next is processed. The final item (type 0x04, the record) is opened for display.

**Partial failure handling:**
- If item_1 (template) fails to install: mark as failed, skip to record, render in raw mode.
- If item_2 (list) fails: record opens without list; list can be fetched later via `#t/` URL.
- If item_3 (contact) fails: record opens; contact entry is auto-created from the participants block in the record.
- Template failure degrades gracefully. List/contact failure is invisible to the user beyond missing autofill.

**URL length constraint:** Base64url of deflated bundle. Template JSON for a sector template is typically 400–800 bytes deflated. A full bundle (template + contact + record) sits in the 1–2 KB range deflated, ~1.4–2.8 KB base64url. Modern URL length limits (8 KB in most browsers, including KaiOS 3.0 Gecko) accommodate this comfortably.

---

## 6. Protected Template Key Exchange

### Research findings

**Signal Protocol (X3DH + Double Ratchet):** Key exchange via Diffie-Hellman — neither party transmits the key; both compute the same shared secret independently. The key is never in the URL, never on the server, never in the message body.

**The `#te/` model (template = key):** Radically different from Signal. The encryption key IS the template content hash, transmitted in the URL fragment. The URL fragment is never sent to the server (browser spec: fragment is client-side only). This is the same model used by Hardbin (encrypted pastebin) and ipfsecret — both store the decryption key in the URL fragment.

**Security analysis of the `#te/` model:**

| Property | Assessment |
|----------|-----------|
| Server never sees the key | True — fragment not transmitted in HTTP requests |
| Key is high-entropy | Depends on template size. A 500-byte template has ~3500 bits of content but NOT random — structured JSON. Effective entropy is much lower. Risk: template could be guessed if domain is known. |
| Forward secrecy | None. If the template URL is compromised later, all records encrypted with that template are decryptable. |
| Key revocation | Not possible. Content-addressed = immutable. Once shared, the key cannot be revoked. |
| Key distribution | The `#te/` URL IS the key distribution. Whoever has the URL can decrypt. Same as a shared password link. |
| Comparison to Signal | Signal: high-entropy ephemeral keys, forward secrecy, double ratchet. `#te/` model: low-entropy structured key, no forward secrecy, no ratchet. Much weaker cryptographically. |

**Recommendation:** The `#te/` model is suitable for **business confidentiality** (protecting trade terms between partners) but not for **sensitive personal data** (medical records, financial details that would cause harm if exposed). The threat model it addresses is: a third party who intercepts the URL but does not have the template cannot read the record. It does NOT address: a party who receives the template URL (intended or not) — they can decrypt everything.

**Practical implication for Workpads:** Mark `#te/` as "partner-confidential, not high-security." For records with high-sensitivity data, add a separate PIN/passphrase layer on top of the template hash key.

**Encrypted template URL (`#te/`) vs unencrypted (`#t/`):**
- `#t/` — template is public; record data is readable by anyone with the URL.
- `#te/` — template is the key; record data is readable only by someone who also has the template. Provides plausible deniability for the server operator.

---

## Key Decisions That Need User Input

1. **Formula storage location:** Should compiled RPN bytecode be embedded in the record frame (in `trig_block`) for offline evaluation, or should formulas always require the template to be present? Embedding bytecode in the frame adds ~10–15 bytes per record but enables formula evaluation when template is unavailable. **Trade-off:** bytes vs offline robustness. **RESOLVED:** Option C — formula in both template registry (authoring) and compiled RPN bytecode in frame TRIG block (verification). Default formula assumed when no TRIG block present (Option A for simple records).

2. **GPS location wire encoding:** Option A — compact `[int16 lat][int16 lon]` = 4 bytes (±111 m precision), requires new FLAGS bit. Option B — store as UTF-8 string in existing `location` field (no new wire bytes, human-readable, but ~20 bytes). For MVP, which matters more: compactness or simplicity?

3. **Signature field handling:** Signature data as inline base64 in the frame makes records very large (5–20 KB). Preferred approach: (a) store signature as a separate file, include only a content-addressed reference in the record; (b) include inline but compress; (c) defer signature support to post-MVP. Which?

4. **`#te/` security positioning:** Should the app show a warning to users when sharing `#te/` records that the template URL is the only protection? Or is the current model (silent, like a shareable link) the right UX for the target market?

5. **Data Sync Bundle delivery mechanism:** Should bundles be delivered as a single long URL (fits in one QR / one SMS link), or as a sequence of separate URLs (each item is its own link, requires receiver to open each in order)? Single URL is simpler for the receiver; multi-URL enables progressive delivery over slow connections. **RESOLVED:** Option C — record-first with background dependency fetch. No bundle URL needed.

6. **Sector template distribution:** Should sector templates (Group I — electrician, medical, etc.) be: (a) bundled in the app at install time, adding to app size; (b) fetched on first use from CDN; (c) distributed exclusively via Data Sync Bundles from trade partners? This affects both app size and offline-first capability for first-time users.

7. **Template editor scope for MVP:** Should the MVP include an open form-builder (user creates templates from scratch) or only a label-editor (user customises labels and formulas on a system template)? Full form-builder is significantly more development work. **RESOLVED:** Templates creatable from line-separated or comma-separated strings as primary authoring interface. JSON is canonical storage format only.

---

## Open Questions That Block Implementation

**OQ-T1 — Template canonical serialisation:** What is the exact byte sequence hashed to produce `content_hash`? JSON serialisation is not canonical (key ordering varies). Options: JSON Canonical Form (RFC 8785), CBOR encoding, or a custom sorted-key serialiser. Must be decided before any template is published — changing this invalidates all existing template hashes.

**OQ-T2 — Template ID namespace:** The 4-bit TEMPLATE_ID in meta1 gives 16 slots. System templates fill most of these. How does a user-created custom template get a TEMPLATE_ID, given that IDs must be stable across devices? Options: (a) custom templates always use EXT_TEMPLATE path; (b) a registration endpoint assigns IDs and returns them; (c) template_id is dropped for custom templates and the content hash alone is used for routing. This interacts with CODEC-3 (CODEC-EVOLUTION.md).

**OQ-T3 — Template update notification:** When a new version of a system template is published (hash changes), how do devices learn about it? Options: (a) app update (slow); (b) a manifest endpoint polled on startup; (c) template_id → hash mapping served from CDN. No mechanism currently designed.

**OQ-T4 — Form builder field vocabulary for repeating sections:** Compound records (Group B in TEMPLATE-CATALOGUE.md) use the compound frame with line flags. Can the form builder produce compound records, or is compound encoding hand-crafted by the app? This determines whether a user can build an "itemised invoice" template in the form builder.

**OQ-T5 — `#te/` key derivation:** Is the encryption key directly the SHA-256 of the template bytes (32 bytes = AES-256 key), or is it a KDF-derived key (HKDF applied to the hash)? Direct use is simpler; HKDF is more cryptographically sound and allows domain separation.

---

## Summary of Recommendations

| Area | Recommendation |
|------|---------------|
| Template schema | Two-layer: data schema (field types, required) + presentation layer (label_map, formula, display). See §1 JSON structure. |
| Formula encoding | Human-readable infix in template JSON + optional compiled RPN bytecode in `trig_block`. ~10–15 bytes. 25-line JS stack evaluator. |
| CDN strategy | Cloudflare as primary (best African PoP coverage); Bunny CDN as cost-effective fallback. Content-addressed = immutable cache. Tier 1/2/3 model for offline graceful degradation. |
| Field vocabulary | 9 Tier-A fields fully supported now; 5 Tier-B with constraints; 5 Tier-C post-MVP. GPS as UTF-8 string for MVP simplicity. |
| Data Sync Bundle | Single compressed URL sequence: template → list → contact → record. Each item is content-addressed. Partial failure degrades gracefully without blocking record display. |
| Key exchange (`#te/`) | Suitable for business confidentiality, not high-security. Fragment-in-URL is never server-transmitted. Add PIN layer for sensitive records. Mark clearly in UX. |

---

*Sources consulted in this research:*
- [JSON Forms](https://jsonforms.io/) — EclipseSource two-layer schema model
- [SurveyJS Form Library](https://surveyjs.io/form-library) — field type vocabulary, signature pad
- [Form.io Advanced Components](https://help.form.io/userguide/forms/form-building/form-components/advanced-components) — field types including signature
- [KaiOS Data Storage](https://kaios.dev/2024/01/data-storage-on-kaios/) — localStorage / IndexedDB constraints
- [KaiOS Service Worker](https://developer.kaiostech.com/docs/sfp-3.0/migration-from-2.5/next-new-apis/others/ServiceWorker/other-ServiceWorker/) — 3.0 only
- [Cloudflare Africa](https://blog.cloudflare.com/lagos/) — PoP coverage including Lagos
- [Africa CDN Planet](https://www.cdnplanet.com/cdns-by-continent/africa-cdn/) — comparative CDN coverage
- [Reverse Polish Notation](https://en.wikipedia.org/wiki/Reverse_Polish_notation) — stack-based bytecode evaluation
- [IPFS Privacy and Encryption](https://docs.ipfs.tech/concepts/privacy-and-encryption/) — content-addressed key model
- [Signal Protocol](https://en.wikipedia.org/wiki/Signal_Protocol) — X3DH + Double Ratchet key exchange
- [Offline-First Mobile for Low Connectivity](https://niotechone.com/blog/designing-offline-first-mobile-apps-for-low-connectivity-markets/) — architecture patterns
