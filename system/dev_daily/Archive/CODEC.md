# Workpads Codec Reference
_Describes the WPCodec wire format used in workpadskaios._
_Codec file: `js/lib/codec.js` — `window.WPCodec = { encode, decode, validate }`_

---

## Overview

WPCodec encodes a workpad record to a compact shareable URL. The URL fragment contains
a binary frame (compressed with fflate deflateSync, then base64url-encoded).

**Share URL format:**
```
https://workpads.me/p#1eg/<base64url-payload>
```

**Current scheme tag:** `1eg/` (codebook-c-kaios, template 0x02, 24-bit flags)

**Legacy decode support:** `1ag/`, `1bg/`, `1cg/`, `1dg/` (template 0x01, 16-bit flags)
These are decode-only. The encoder only emits `1eg/`.

---

## Frame Structure

```
[byte 0]     Template version byte: 0x02
[byte 1]     Flags high  (bits 23–16)
[byte 2]     Flags mid   (bits 15–8)
[byte 3]     Flags low   (bits 7–0)
[variable]   Field blobs — one per set flag, in bit order low→high
```

Each field blob is: `[length_hi][length_lo][data bytes...]` (2-byte big-endian length prefix).

Special encodings:
- **date**: u16 (days since 2020-01-01) — no length prefix
- **amount**: u32 big-endian (minor-currency units, e.g. pence/cents)
- **actions**: sequence — u16 count, then per-action `[flags][title blob][notes blob?]`
- **expenses/payments**: sequences within the FIN block

---

## Flag Bit Map

### Bits 0–11: PADS scalar fields

| Bit | Field | Encoding |
|---|---|---|
| 0 | job | length-prefixed UTF-8 |
| 1 | customer | length-prefixed UTF-8 |
| 2 | date | u16 (days since 2020-01-01) |
| 3 | location | length-prefixed UTF-8 |
| 4 | meeting_time | length-prefixed UTF-8 |
| 5 | start_time | length-prefixed UTF-8 |
| 6 | end_time | length-prefixed UTF-8 |
| 7 | customer_phone | length-prefixed UTF-8 |
| 8 | worker | length-prefixed UTF-8 |
| 9 | actions | sequence (see below) |
| 10 | details | length-prefixed UTF-8 |
| 11 | story | length-prefixed UTF-8 |

### Bit 12: FIN block (financial data)

When bit 12 is set, a financial sub-frame follows PADS fields:

```
[fin_flags u8]      presence flags for financial sub-fields
[record_type]       enum u8: quote=1, invoice=2, expense=3, payment=4
[currency]          enum u8 or custom string (255 = custom, followed by length-prefixed UTF-8)
[vat]               enum u8 index into VAT_RATES: [0, 5, 7.5, 10, 12.5, 15, 20, 23, 25]
[amount]            u32 big-endian (minor-currency units)
[expenses seq]      u16 count, then per-expense: [flags][amount u32][job][date][billing][actionIdx]
[payments seq]      u16 count, then per-payment: [flags][amount u32][job][date]
```

**Currency enum values (0-indexed):**
`GBP=0, USD=1, EUR=2, CAD=3, AUD=4, NZD=5, ZAR=6`
Index 255 = custom string follows (any other currency as length-prefixed UTF-8).

### Bits 13–15: Reserved

Not used. Must be 0 when encoding.

### Bits 16–23: Extended fields

| Bit | Field | Encoding |
|---|---|---|
| 16 | subtype | length-prefixed UTF-8 |
| 17 | locale | length-prefixed UTF-8 (e.g. 'gb-v1') |
| 18 | chainRef | 3 raw bytes (base64url when displayed) |
| 19 | participants | sequence: u16 count, then per-participant [name blob][role blob] |
| 20 | geo | length-prefixed UTF-8 |
| 21 | serviceRef | length-prefixed UTF-8 |
| 22 | expiry | u16 (days since 2020-01-01) |
| 23 | verification | u8 |

---

## Actions Sequence Format (bit 9)

```
[count u16]
per action:
  [action_flags u8]   bit 0 = notes present
  [title blob]        length-prefixed UTF-8
  [notes blob]        length-prefixed UTF-8 (only if bit 0 set in action_flags)
```

---

## Compression + Encoding Pipeline

```
1. Build binary frame (Uint8Array)
2. fflate.deflateSync(frame, { level: 9 })
3. base64url encode (URL-safe alphabet, no padding)
4. Prepend scheme tag: '1eg/'
5. Full URL: 'https://workpads.me/p#' + tag + payload
```

base64url uses `+` → `-`, `/` → `_`, strips `=` padding.

---

## Validation (WPCodec.validate)

Checks:
- `job` field is present and non-empty string
- All string field values are strings
- Actions array items have a `title` string

---

## Status (v0.2)

All v0.1 gaps are closed. The codec is at feature-complete for v0.2:

| Item | Status |
|---|---|
| `encodeUrl()` passes financial fields (amount, currency, VAT, record_type) | Fixed — DEV-WP-FIN-001 closed |
| `storeReceived()` persists inline sub-records as child `wp_record_` entries | Fixed |
| VAT UI value mapped to codec enum before encode | Fixed — DEV-WP-VAT-001 closed |
| Share URL emits `1eg/` scheme tag | Fixed — DEV-WP-URL-001 closed |

**Remaining gap (standard, not kaios):** `workpads-standard/codec.md` documents codebook-b (`1bg/`). The `1eg/` format is not yet specified there. Until it is, `workpads-codec` npm package cannot validate `1eg/` frames against the standard.

---

## Sync Obligations

The codec must remain in sync across three repositories:

| Repo | File | Role |
|---|---|---|
| `workpadskaios` | `js/lib/codec.js` | KaiOS packaged app (this file) |
| `workpadsdotme` | `js/lib/codec.js` | Web receiver at workpads.me |
| `workpads-codec` | `src/bitpad.js` | npm package for tooling |

Field order and flag bit assignments are normative. Any change must be coordinated.
See also: `system/CODEC-SYNC.md` for the full sync checklist.

The normative spec is: `workpads-standard/codec.md` in the monorepo.

---

## Date Encoding

Dates are stored as u16 (days since 2020-01-01). Supports range 2020–2199 (65535 days).
`date_to_u16(isoString)` converts ISO date string to u16.
`u16_to_date(n)` converts back to ISO date string.

2020-01-01 = 0, 2020-01-02 = 1, etc.

---

## Legacy Format Notes

Formats `1ag/`, `1bg/`, `1cg/`, `1dg/` used template 0x01 with 16-bit flags.
They are decode-only for backwards compatibility.
No new records should be encoded in these formats.
