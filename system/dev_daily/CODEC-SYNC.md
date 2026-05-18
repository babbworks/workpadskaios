# Codec Sync — workpadskaios
_Protocol for keeping bitpad codec in sync across all copies._

---

## The Three Copies

All three must stay in sync. They diverge silently — there is no automated check.

| File | Role | Lines | State |
|------|------|-------|-------|
| `workpadskaios/js/lib/codec.js` | Full codec (encode + decode + validate). ES5. Exposes `window.WPCodec`. | ~700 | **Current** — codebook-c-kaios (`1eg/`), template `0x02`, 24-bit flags, full FIN block, extended fields bits 16–23 |
| `workpadsdotme/js/lib/codec.js` | Full codec (encode + decode + validate). ES5. Extended with financial + chainRef. | 952 | Codebook-c (`1dg/`), template `0x01`, 16-bit flags, chainRef at bit 13. Does **not** decode `1eg/`. |
| `workpadsdotme/p/index.html` | Decode-only inline. Standalone receiver page. No external deps. | inline | Decodes `1ag/` → `1dg/`. Cannot decode `1eg/`. |

**Canonical source:** `workpads-standard/codec.md` — all changes start there.

**Important:** kaios and dotme now use divergent codebooks. Kaios emits `1eg/` (template `0x02`, 24-bit flags), dotme emits `1dg/` (template `0x01`, 16-bit flags). Kaios can decode `1dg/` (via legacy decoder), but dotme **cannot** decode `1eg/`. This divergence is intentional: the 8 extended fields (bits 16–23) required a new template byte and wider flag word. Interoperability note: kaios→kaios sharing works; kaios→dotme sharing is not yet supported (dotme receiver needs a `1eg/` decoder).

---

## What Must Stay in Sync

| Element | Criticality | Notes |
|---------|-------------|-------|
| `SCALAR_FIELDS` array — field IDs and bit positions | **Critical** | A bit position change breaks all encoded records |
| Actions blob format — `[count][title_len][title_utf8][notes_len][notes_utf8]...` | **Critical** | |
| Flags word byte order — big-endian: `(frame[1] << 8) \| frame[2]` | **Critical** | Little-endian silently produces wrong values |
| Scheme tag detection regex — `/^[0-9][a-z][a-z]\//` | High | Identifies canonical vs legacy URLs |
| Template byte value — `0x01` (svc-basic) / `0x02` (svc-extended / codebook-c) | High | |
| `VAT_RATES`, `CURRENCIES`, `RECORD_TYPES`, `BILLING_TYPES` enum arrays | High | Index values are encoded; array order must not change |
| Financial block structure (bit 12 gate, `fin_flags` byte, item encoding) | High | Implemented in both kaios (codebook-c-kaios, v0.2) and dotme |

---

## Current Codec Versions

| Repo | Scheme emitted | Scheme decoded | Template | Flags |
|------|---------------|---------------|---------|-------|
| `workpadskaios` | `1eg/` | `1ag/` `1bg/` `1cg/` `1dg/` `1eg/` + legacy | `0x02` | 24-bit |
| `workpadsdotme` | `1dg/` | `1ag/` `1bg/` `1cg/` `1dg/` + legacy | `0x01` | 16-bit |
| `workpads-standard` | `1bg/` documented | all | `0x01` | 16-bit |

**DEV-WP-URL-001: CLOSED.** Kaios now emits `1eg/` correctly. The standard's `codec.md` documents codebook-b (`1bg/`), which pre-dates both implementations. The standard needs updating to document codebook-c-kaios (`1eg/`) — this is a documentation gap in `workpads-standard`, not a kaios deviation.

---

## Sync Checklist

Run this checklist after any codec change:

```
1. Update workpads-standard/codec.md  (normative source first)
2. Apply change to all three files listed above
3. If field set changed (new field added or removed):
     - Bump scheme tag char: a→b→c→d→e→... in all three files
     - Update SCALAR_FIELDS bit assignments
4. If frame format changed (e.g. flags word width):
     - Update workpads-codec/src/bitpad.js (npm package)
     - Update workpadskaios/js/lib/codec.js
     - Update workpads-standard/record-schema.md presence flags table
5. Run: npm test  (in workpadskaios — codec round-trip tests)
6. Manual verify: encode a record in kaios, decode in dotme receiver
```

---

## Codebook-c-kaios (`1eg/`) — SHIPPED in v0.2

The codebook-c-kaios format is live in `workpadskaios/js/lib/codec.js`.

**Frame:**
```
Byte 0:     0x02  (template = svc-extended / codebook-c-kaios)
Bytes 1–3:  24-bit presence flags (big-endian)
            (frame[1] << 16) | (frame[2] << 8) | frame[3]
Remaining:  field blobs in bit-ascending order
```

**Bit layout:**
```
Bits 0–11:  PADS scalar fields (identical to dotme codebook-c)
Bit  12:    FIN block — full financial sub-frame (amount u32, expenses, payments)
Bits 13–15: Reserved
Bits 16–23: Extended fields:
  16  record_subtype   [uint16][UTF-8] e.g. 'delivery-note'
  17  template_locale  [uint16][UTF-8] e.g. 'ng-v1'
  18  chain_ref        3-byte raw (in-frame; not as &c= suffix)
  19  participants     [uint8 count][name blob][role blob]... per participant
  20  geo              [uint16][UTF-8] geohash or lat/lon
  21  service_ref      [uint16][UTF-8] SIMBA service ID
  22  expiry           uint16 days since 2020-01-01
  23  verification     uint8
```

**Outstanding standard work:** `workpads-standard/codec.md` currently documents codebook-b (`1bg/`). It needs a new section for codebook-c-kaios (`1eg/`). This is tracked as a documentation gap — not a kaios deviation.

---

## Adding a New Field (Procedure)

1. Check the current bit table — confirm available bit(s)
2. Update `workpads-standard/codec.md` first
3. Update all three codec copies and the npm package
4. Bump scheme tag in all three if field set changes
5. Update `workpads-standard/record-schema.md`
6. Run `npm test` in workpadskaios
7. Manual encode/decode verification across kaios ↔ dotme
