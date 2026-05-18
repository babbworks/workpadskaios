# Round 8 Summary — Template System + EXT_TEMPLATE + FLAGS4 Data Blocks

**Date completed:** 2026-05-18  
**Status:** Done — 419/419 tests pass (358 from Rounds 1–7, 61 new Round 8).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary outputs:** `js/lib/codec.js` (FLAGS4 encoder+decoder, #t/#te routing), `js/lib/template-registry.js` (new), `js/lib/formula.js` (new)

---

## What Was Built

### 1. FLAGS4 Data Blocks (codec.js)

Full encode/decode for `field_flags4` (template extension byte, gated by `FLAGS4_PRESENT` = flags3 bit 7).

**Contact template (BASE_TEMPLATE=011):**

| Bit | Field | Encoding |
|-----|-------|----------|
| 0 | `website` | [u16 len][UTF-8] |
| 1 | `social_handle` | [u8 len][UTF-8] compact |
| 2 | `business_hours` | [u16 len][UTF-8] |
| 3 | `category` | 1-byte enum |
| 4 | `alt_phone` | [u16 len][UTF-8] |
| 5 | `meeting_location` | [u16 len][UTF-8] |
| 7 | FLAGS5_PRESENT | meta-flag — skip 1 FLAGS5 byte on decode |

**Financial template (BASE_TEMPLATE=001 or 010):**

| Bit | Field | Encoding |
|-----|-------|----------|
| 0 | `service_ref` | [u8 len][UTF-8] compact |
| 1 | `expiry_date` | uint16 days since 2000-01-01 |
| 2 | `gps_binary` | [int16 lat×100][int16 lon×100] = 4 bytes |

GPS encoding: `lat_scaled = round(lat × 100)` stored as int16 (signed); range covers ±90° (max ±9000) and ±180° (max ±18000). Precision: ±0.01°.

FLAGS5_PRESENT (flags4 bit 7): if set on decode, decoder skips 1 FLAGS5 byte (forward-compat extension path). Encoder always writes flags4 bit 7 = 0.

### 2. EXT_TEMPLATE Tests (all signals confirmed)

Encoder/decoder for all four EXT_SIGNAL variants was already present from Round 1. Tests added confirming correct roundtrip:
- EXT_SIGNAL=001: 1 byte, domain-type index 0x00–0xFF
- EXT_SIGNAL=010: uint16 BE (2 bytes)
- EXT_SIGNAL=011: 24-bit BE (3 bytes)
- EXT_SIGNAL=100: `{ ns: CRC-8, id: CRC-16 }` (3 bytes); decoder returns `_extTemplateId.ns` + `_extTemplateId.id`; stable across re-encodes from same inputs

### 3. Template Registry (template-registry.js)

New file exposing `global.WPTemplateRegistry`:

| Function | Description |
|----------|-------------|
| `storeTemplate(id, schema)` | Store versioned schema in localStorage under `wp_template_<id>` |
| `getTemplate(id, version?)` | Retrieve schema; no version → latest by numeric `version` field |
| `listTemplates()` | Scan localStorage keys by prefix; return all stored IDs |
| `canonicalSerialise(schema)` | JSON with sorted keys, no whitespace, `id`/`name`/`meta.content_hash` removed |
| `fingerprintSchema(schema)` | SHA-256 of canonical serialisation → 32-byte Uint8Array |

Canonical serialisation algorithm:
1. Remove `id`, `name`, `protected`, `meta.content_hash` from a shallow copy
2. Recursively sort all JSON object keys alphabetically
3. `JSON.stringify` without spacing
4. SHA-256 via `global.WPCrypto.sha256`

Versioning: `storeTemplate` merges versions in one localStorage entry keyed by `version` number. `getTemplate(id)` returns latest; `getTemplate(id, 2)` returns version 2 specifically.

### 4. Formula RPN Evaluator (formula.js)

New file exposing `global.WPFormula.evaluate(bytecode, record, fieldNames)`.

**Opcode table:**

| Hex | Opcode | Operands |
|-----|--------|----------|
| 0x01 | LOAD_FIELD | next byte = index into `fieldNames` array |
| 0x02 | LOAD_CONST | next 3 bytes = uint24 constant value |
| 0x03 | ADD | pop b, pop a, push a+b |
| 0x04 | SUB | pop b, pop a, push a−b |
| 0x05 | MUL | pop b, pop a, push a×b |
| 0x06 | DIV | pop b, pop a, push a÷b (0 if b=0) |
| 0x07 | END | stop execution |

Stack-based. `evaluate` returns top-of-stack or 0 if stack empty. LOAD_FIELD parses record field as float (0 if missing or NaN).

### 5. #t/ and #te/ URL Routing (codec.js decode())

`decode()` now intercepts template install URLs before pads-v1 parsing:

```javascript
if (hash.slice(0, 2) === 't/')  return { _installTemplate: hash.slice(2),  encrypted: false };
if (hash.slice(0, 3) === 'te/') return { _installTemplate: hash.slice(3), encrypted: true  };
```

Caller checks `result._installTemplate` to route to `WPTemplateRegistry.storeTemplate`. The `encrypted: true` path signals that template content should be decrypted via HKDF_KEY=1 derivation (app-layer concern; template key derivation deferred).

---

## Key Design Decisions Made

### 1. FLAGS4 data block position: after FIELDS3, before participants

FLAGS4 data blocks follow all FIELDS3 data blocks in the frame, consistent with the general rule that data blocks follow their flag byte in ascending bit order. The flags4 byte itself follows flags3 in the header, before any data.

### 2. GPS ×100 precision (FRAME-SPEC §14 authoritative over TEMPLATE-SYSTEM-DESIGN §8)

FRAME-SPEC §14 specifies `lat × 100` (int16 range ±9000 covers ±90°). The TEMPLATE-SYSTEM-DESIGN design notes say `×1000` but that spec is status: "notes → design" not authoritative. FRAME-SPEC §14 is the wire format authority: ×100 used. CODEC-WORKPLAN confirms ×100.

### 3. int16 GPS encoding via conditional add/subtract

No dedicated int16 type in JS. Encoder: if value < 0 add 65536 before wu16(). Decoder: if readU16() > 32767, subtract 65536.

### 4. template-registry.js uses global.WPCrypto.sha256 (injected, not bundled)

Consistent with security.js approach: crypto primitives injected via `global.WPCrypto`. Node.js tests use the existing Round 7 shim.

### 5. #t/#te decode() returns marker object (not direct installTemplate call)

`decode()` returns `{ _installTemplate: id, encrypted: bool }` instead of calling `WPTemplateRegistry.storeTemplate()` directly. Reason: decouples codec from registry; caller decides whether/how to install. Equivalent to the TAG-REFERENCE pseudocode `return installTemplate(id, opts)` — the returned object IS the install instruction.

---

## Test Coverage Added (61 new tests)

- EXT_TEMPLATE roundtrips: sig1 (3), sig2 (2), sig3 (2), sig4/stable (4) = 11
- FLAGS4 Contact: FLAGS3_PRESENT + FLAGS4_PRESENT bits (2), flags4 byte written (2), website (2), social_handle (1), category (1), multi-field (6), FLAGS5_PRESENT forward compat (2) = 16
- FLAGS4 Financial: service_ref (1), expiry_date (1), gps positive (2), gps negative lon (2), combined (1) = 7
- Template registry: storeTemplate+getTemplate (3), listTemplates (2), canonical omits fields (4), canonical key order (1), fingerprint deterministic (1), different schemas → different FPs (1), versioning (3) = 15
- Formula evaluator: LOAD_FIELD (1), LOAD_CONST (1), ADD/SUB/MUL/DIV (4), compound (1), END early (1) = 8
- #t/ routing (2), #te/ routing (2) = 4

Total: 61 new assertions.

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/codec.js` | FIELDS4_CONTACT + FIELDS4_FINANCIAL arrays; readI16 helper; FLAGS4 encoder (flag compute + byte write + data blocks); FLAGS4 decoder (flags4d read + FLAGS5 skip + data blocks); #t/#te routing in decode() |
| `js/lib/template-registry.js` | New file: template store, canonical serialisation, SHA-256 fingerprint, 75 lines |
| `js/lib/formula.js` | New file: RPN bytecode evaluator, 60 lines |
| `test/codec-pads-v1.test.js` | localStorage shim + registry/formula loading; 61 Round 8 tests; header updated to Rounds 1–8 |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 8 checklist updated |

---

## Open Items Carried Into Round 9

- Bundled templates (app startup) — deferred (app layer, not codec)
- Template key derivation for `#te/` (HKDF_KEY=1 path) — app layer
- Data Sync Bundle (`#t/` + contact + list in one URL) — deferred
- Round 9: Presentation Layer — display_schema, form_schema, TRIG block, `#1pb/` + `#1pf/` tags, trig.js
