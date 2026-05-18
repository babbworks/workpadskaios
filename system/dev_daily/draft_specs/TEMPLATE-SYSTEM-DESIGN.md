# Template System Design

**Status:** design — 2026-05-17
**Depends on:** FRAME-SPEC.md, SECURITY-DESIGN.md, TAG-REFERENCE.md, CODEC-EVOLUTION.md
**Maturity:** notes → **design** → draft-spec → spec → standard-doc

---

## 1. Template Definition Schema

A template definition tells the codec which fields exist, in what order, with what labels, and how totals are calculated. It is the key material for `#1pt/` records and the rendering guide for all non-trivial record display.

```json
{
  "id": "XY3",
  "name": "Site visit invoice",
  "base_template": "001",
  "domain": "electrician",
  "codebook": "c",
  "version": 1,
  "label_map": {
    "job":             "Work description",
    "customer":        "Client",
    "worker":          "Engineer",
    "qty":             "Hours worked",
    "customer_amount": "Labour charge",
    "worker_amount":   "Materials cost",
    "total":           "Total due"
  },
  "fields": {
    "required": ["job", "customer", "date", "financial_block"],
    "optional":  ["location", "details", "ref_number", "context_label"],
    "hidden":    []
  },
  "custom_fields": [
    { "slot": "flags4_bit3", "name": "cert_number", "type": "text_compact" },
    { "slot": "flags4_bit4", "name": "site_ref",    "type": "text_compact" }
  ],
  "block_order": ["job", "customer", "date", "location", "financial_block", "ref_number", "details"],
  "formula": {
    "total": "customer_amount + worker_amount + call_out_fee",
    "call_out_fee": "50"
  },
  "has_line_items": false,
  "display": {
    "accent_color":     "#F5A623",
    "header_field":     "job",
    "subheader_field":  "customer",
    "show_totals_row":  true,
    "currency_position": "prefix"
  },
  "constraints": {
    "qty":             { "min": 0, "max": 24, "unit": "hours" },
    "customer_amount": { "min": 0 }
  },
  "meta": {
    "author":       "system",
    "created":      "2026-05-17",
    "content_hash": "<sha256-hex>",
    "codebook":     "1pa"
  }
}
```

**Key properties:**
- `label_map` — canonical wire field names → human labels. Wire fields are stable; labels are template-specific.
- `formula` — human-readable infix strings; compiled to RPN bytecode for offline evaluation (see §5).
- `block_order` — the scramble permutation for `#1pt/` records; sharing the template = agreeing on field order.
- `has_line_items` — when `true`, the form builder generates a compound frame with the standard line item schema.
- `display` — visual/CSS hints; not prescriptive about pixel layout.
- `meta.content_hash` — SHA-256 of the canonical serialisation; serves as the `#1pt/` identity key and CDN cache key.
- `custom_fields` — template-specific fields using FLAGS4 slots (bits 3–7 available for custom assignment; bits 0–2 are standard cross-template assignments).

---

## 2. Canonical Serialisation for Hashing

The same template must produce the same SHA-256 hash on any device.

**Algorithm:**
1. Remove mutable/local fields: `id`, `name`, `protected`, `meta.content_hash`
2. Sort all JSON object keys alphabetically (recursive — nested objects sorted too)
3. Strip all whitespace (no indentation, no spaces after `:` or `,`)
4. UTF-8 encode
5. SHA-256 the resulting bytes → `content_hash`

**Example:** Two devices that imported the "Site visit invoice" template will derive the same `content_hash` regardless of how their local storage rendered the JSON, as long as field values are identical.

**Name changes are safe:** `name` is excluded from the hash. A user can rename a template without changing its identity or breaking any existing records.

---

## 3. Custom Template ID Namespace

**Decision:** Custom templates always use the `EXT_TEMPLATE` path. `TEMPLATE_ID=1111` in meta1 is reserved to mean "custom — hash follows." The 4-bit TEMPLATE_ID space is not allocated to user-created templates.

**Routing:** `EXT_SIGNAL=100` (Variant type — 3 bytes: CRC-8 namespace + CRC-16 local ID) is the natural EXT_TEMPLATE path for user-created templates. The CRC-8 namespace is derived from the creator's device identity; the CRC-16 local ID from the template name and creation date. Content hash confirms the exact version.

**CODEC-4** (EXT_TEMPLATE domain byte encoding) covers the full design for this path.

---

## 4. Template Distribution Model

**Three-tier model — no startup network calls:**

| Tier | What | How |
|------|------|-----|
| Tier 1 — Bundled | Core system templates (invoice, quote, expense, service, state commit, contact) | Ship inside app binary. Zero network dependency. Update via app releases. |
| Tier 2 — Peer-to-peer | All sector templates (electrician, plumber, market vendor, agricultural, medical, etc.) | Travel with records via Data Sync Bundle. Sender includes template payload when sharing. Receiver installs on record open. |
| Tier 3 — CDN fallback | Any template with unknown hash | Fetch from `workpads.me/t/<sha256-hex>` on demand, only when a record is already being opened. Timeout 5 s. On failure: raw mode display. |

**No polling. No manifest endpoint. No startup calls.**

Template updates for system templates ship with app updates (Tier 1). Sector template updates propagate peer-to-peer through trade networks — a plumber gets the updated plumber template when another plumber sends them a record using it.

**CDN cache policy:** `Cache-Control: immutable` — content-addressed = never changes. Once cached locally (IndexedDB keyed by hash), never refetched.

**Degraded experience (template unavailable):**
```
1. Check IndexedDB by hash → found: render immediately (zero network)
2. Not found: attempt CDN fetch
3. CDN unavailable: render in raw mode
4. Display: "Template unavailable. Showing raw record."
```

---

## 5. Formula Encoding

**Dual-layer approach:**

| Layer | Format | Purpose |
|-------|--------|---------|
| Template JSON | Human-readable infix string (`"total": "customer_amount + worker_amount + call_out_fee"`) | Authoring, template editor display |
| Compiled RPN bytecode in `trig_block` | 4-bit opcode + operand sequence | Offline formula evaluation without template present |

The infix string is the source of truth. On template save, the app compiles to RPN. The compiled bytecode is embedded in the record frame's `trig_block` (HAS_TRIG_BLOCK=1 in meta2).

**Compact formula bytecode (4-bit opcode):**
```
0x1  LOAD_FIELD   — next byte = field index in FLAGS registry
0x2  LOAD_CONST   — next 3 bytes = uint24 constant (BitLedger encoded)
0x3  ADD
0x4  SUB
0x5  MUL
0x6  DIV
0x7  END
```

Example: `total = hours * rate + parts`
```
LOAD_FIELD(qty) LOAD_FIELD(worker_amount) MUL LOAD_FIELD(customer_amount) ADD END
≈ 7 tokens × ~1.5 bytes = ~10–12 bytes
```

A 25-line JS stack evaluator handles this with zero bundle weight additions.

**When no `trig_block` is present:** Default formula assumed — no tally computation, fields displayed as entered.

**CODEC-3 resolution:** Formulas live in both the template JSON (human-readable, authoring source) and the `trig_block` (compiled bytecode, offline verification). Resolved.

---

## 6. `#te/` Template Key Derivation

Two derivation modes, signalled by `HKDF_KEY` flag in the security preamble byte:

| Flag | Mode | Key derivation |
|------|------|----------------|
| `HKDF_KEY=0` | Direct SHA-256 | `key = SHA-256(template_bytes)` — 32 bytes used directly as AES-256 key |
| `HKDF_KEY=1` | HKDF-derived | `key = HKDF(SHA-256(template_bytes), salt, "workpads-template-key")` — domain separation; prevents key reuse across contexts |

**Default for new templates:** `HKDF_KEY=1`. Old records with `HKDF_KEY=0` decode correctly indefinitely.

**Why both:** The content hash is also used as a CDN cache key and a registry lookup ID. HKDF domain separation prevents theoretical cross-context key collision. Direct SHA-256 retained for backward compatibility with any pre-decision records.

**Preamble byte change:** bit 3 = `HKDF_KEY` (was part of KEY_HINT nibble). KEY_HINT is now bits 2–0 (3 bits = 8 possible hints; sufficient for typical contact key ring sizes).

```
Updated preamble byte:
  bit 7: SCRAMBLE
  bit 6: AES
  bit 5: HMAC
  bit 4: SEED_POISON
  bit 3: HKDF_KEY       1=HKDF derivation; 0=direct SHA-256
  bits 2-0: KEY_HINT    lower 3 bits of cipher_key[0]
```

---

## 7. `#te/` Security UX

**Rule:** One-time disclosure per template at first share, then silent.

When a sender shares a `#te/` record using a template for the first time with any contact, the app shows a single plain-language notice:

> "Anyone with this template can read records you send using it. Only share with trusted contacts."

After that: silent. No repeated warnings. The notice is keyed to `(template_hash, contact_id)` — shown once per template per contact relationship.

---

## 8. GPS Location Encoding

Both encoding modes supported simultaneously. Signalled by FLAGS4 bit 2:

| Encoding | Where | Size | Precision | Use |
|----------|-------|------|-----------|-----|
| UTF-8 string | `location` field (field_flags bit 3) | ~20 bytes | Human-readable | Default MVP path; zero codec change needed |
| Compact binary | FLAGS4 bit 2 — `gps_binary` | 4 bytes | ±0.001° (≈111 m) | When precision or compactness matters |

**Binary encoding:**
```
[int16 lat_scaled][int16 lon_scaled]   — 4 bytes total
lat_scaled = latitude  × 1000 (rounded to nearest integer)
lon_scaled = longitude × 1000 (rounded to nearest integer)
Range: ±32.767°  ... sufficient for ±90° latitude if extended to int32 in future
```

Wait — int16 × 1000 gives range ±32.767. Insufficient for polar latitudes. **Correction:** scale by 100, not 1000:
```
lat_scaled = latitude  × 100  →  range ±327.67°, covers ±90° ✓
lon_scaled = longitude × 100  →  range ±327.67°, covers ±180° ✓
Precision: ±0.01° ≈ ±1.1 km
```

For ±0.001° precision (±111 m): use int32 (4 bytes each = 8 bytes total). **Decision: use int16 × 100 for MVP (4 bytes, ±1.1 km precision). int32 precision upgrade post-MVP if needed by sector use cases.**

A record CAN carry both: `location` for human display, `gps_binary` for machine/mapping use.

**FLAGS4 bit 2 assignment:** `gps_binary` — standard cross-template. When set: 4-byte block `[int16 lat_×100][int16 lon_×100]` follows in data blocks.

---

## 9. Signature Field

**Status: reserved, not built.**

The signature field type is reserved in the form builder vocabulary. A codec slot will be allocated in a future FRAME-SPEC pass (likely FLAGS4 or a dedicated block type). The implementation — Canvas API capture, storage model, sync strategy — is post-MVP.

**Preferred post-MVP storage model:** content-addressed attachment reference (8-byte hash in frame; full PNG stored separately). Inline base64 in frame is explicitly ruled out due to record size impact.

---

## 10. Sector Template Distribution

**Lean app. Peer-to-peer first.**

Core system templates bundled in app (Tier 1). All sector templates distributed peer-to-peer via Data Sync Bundle (Tier 2). CDN as fallback for orphaned hashes only (Tier 3).

**Network effect:** Sector templates propagate through actual trade networks. Electricians get the electrician template from other electricians. Market vendors from other vendors. Templates spread exactly where they're needed, carried by the people who use them. No curated app store or distribution channel needed.

**First-time user path:** New user installs app, receives a record from an established contact. The Data Sync Bundle carries the sender's template. The new user's app installs the template on record open — no CDN call, no connectivity required beyond receiving the original message.

---

## 11. Form Builder Scope

### In scope for MVP:

| Feature | Notes |
|---------|-------|
| Label editor | Rename any standard field for any template |
| Formula editor | Infix formula entry; compiled to RPN on save |
| Field visibility | Mark fields required / optional / hidden |
| Display options | Accent colour, header field, totals row |
| "Line items" toggle | Declares compound frame; standard fixed line item schema (description, qty, unit price, line total) |
| Custom field slots | Add up to 5 custom fields via FLAGS4 bits 3–7; choose type from field vocabulary |
| Template creation | From line-separated or comma-separated strings as primary authoring interface |

### Invoice wizard (app-generated, not form-builder):

The invoice wizard generates compound frames with multiple line items directly. This is distinct from the form builder — it is a first-party flow for the most common use case, not a user-designed template.

### Post-MVP (reserved, not built):

| Feature | Notes |
|---------|-------|
| Signature capture field | Canvas API; storage model TBD |
| Custom line item schema | User-defined fields inside repeating sections |
| Conditional branch fields | if/then/else on field values |
| Audio note field | MediaRecorder API; KaiOS 3.0 only |

---

## 12. Field Type Vocabulary (11 types, MVP)

| Type | Wire | Notes |
|------|------|-------|
| `text` | `[u16][UTF-8]` | Names, descriptions, long strings |
| `text_compact` | `[u8][UTF-8]` | Short codes, refs (max 255 B) |
| `date` | `uint16` days since 2000-01-01 | COMPACT_TIME epoch |
| `time` | `uint16` minutes since midnight | |
| `amount` | `uint24` | Uses record DECIMAL_POS |
| `integer` | `uint24`, DECIMAL_POS=0 | Counts, whole numbers |
| `boolean` | flag bit only, no data block | Presence/absence |
| `select` | `uint8` enum | Single choice; options inline in template |
| `multi_select` | `uint8` bitmask (≤8 opts) or `uint16` bitmask (≤16 opts) | Multiple choice |
| `phone` | `[u16][UTF-8]` | Semantic alias of text |
| `url` | `[u16][UTF-8]` | Semantic alias of text |

**`multi_select` list source:**
- `00` = in-list: options embedded in template definition, travel in URL payload
- `01` = in-app: options stored locally by `list_ref_id` (uint8); bitmask only in URL

**`HARD_BLOCK` flag (per field in form schema):** When set, field data is collected locally but stripped from any generated URL or shared record. Never transmitted. Enforced by the encoder.

---

## 13. Template Versioning and Historical Decode

Templates are stored and looked up by content hash, not by human-readable `id` or `name`.

**Local index:** `{ template_id → [hash_v1, hash_v2, hash_v3] }` — all versions retained.

**Decode flow for `#1pt/` record:** App reads template_id routing hint from URL → looks up all known hashes for that ID → tries each hash as decryption key → commitment check (HMAC or hash probe) confirms the correct version.

**Version update:** Old hash retained indefinitely for historical decode. New template version has a new hash; must be re-shared with counterparties to enable new records. Old records never break.

**List content independence:** Templates reference list content by hash, not by embedding option strings. List typos can be fixed (new list hash, re-share list only) without touching the template hash.

---

## 14. Open Questions

- **CODEC-4** — EXT_TEMPLATE domain byte: exact encoding for custom templates using the Variant type path. This covers the full `TEMPLATE_ID=1111 → EXT_SIGNAL=100` decode path.
- **gps_binary int32 upgrade** — if ±1.1 km precision proves insufficient for construction/survey sector templates, int32 encoding (8 bytes) will be needed. Post-MVP evaluation after first sector deployments.
- **`#te/` warning copy** — exact wording of the one-time disclosure notice (§7). UX copy pass needed before implementation.
- **Signature field slot** — which FLAGS4 bit or block type carries the signature reference. Assigned at post-MVP design time.

---

## 15. Decisions — 2026-05-17

| Decision | Chosen | Notes |
|----------|--------|-------|
| Custom template ID namespace | EXT_TEMPLATE path; TEMPLATE_ID=1111 reserved | CODEC-4 covers full encoding |
| System template updates | App releases (Tier 1) | No startup network calls |
| Sector template distribution | Peer-to-peer via Data Sync Bundle (Tier 2); CDN fallback only | Lean app; network effect through trade networks |
| `#te/` key derivation | Both modes; HKDF_KEY flag in preamble byte bit 3 | HKDF_KEY=1 default for new templates |
| `#te/` security UX | One-time disclosure per template per contact, then silent | Plain language notice |
| GPS encoding | Both UTF-8 string (location field) + compact binary (FLAGS4 bit 2) | int16 × 100, ±1.1 km precision; int32 upgrade post-MVP |
| Signature field | Reserved; post-MVP | Content-addressed attachment reference preferred |
| Form builder line items toggle | Yes — declares compound frame; fixed standard schema | Compound frame already in FRAME-SPEC |
| Custom line item schema | Post-MVP | Slot reserved |
| Invoice wizard compound frame | In MVP — app-generated, not form-builder | Multiple line items fully supported |
| Formula storage | Dual-layer: infix in template JSON + RPN bytecode in trig_block | Resolves CODEC-3 |
