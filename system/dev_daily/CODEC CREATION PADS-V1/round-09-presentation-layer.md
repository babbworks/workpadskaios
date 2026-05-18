# Round 9 Summary — Presentation Layer: display_schema + form_schema + TRIG block

**Date completed:** 2026-05-18  
**Status:** Done — 488/488 tests pass (419 from Rounds 1–8, 69 new Round 9).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary outputs:** `js/lib/trig.js` (new), `js/lib/codec.js` (TRIG block, display_schema, form_schema, #1pb/#1pf routing)

---

## What Was Built

### 1. TRIG Block Encoder/Decoder (codec.js)

TRIG block encoding is triggered by `opts.hasTrigBlock=true` in the encode call. The block sits after the participants block, before display_schema.

**Wire format:**
```
[trig_len: uint8][trig_bytes: N bytes]
```
- `trig_len` capped at 20 on encode (encoder writes min(trigBytes.length, 20))
- Decoder: `trig_len > 20` → `record._trig = { trig_violation: true }`; otherwise `record._trig = { bytes: Uint8Array subarray }`
- `meta2 HAS_TRIG_BLOCK` bit (bit 5) set when `opts.hasTrigBlock`

### 2. trig.js — TRIG Bytecode Evaluator (new file)

Exposes `global.WPTrig.evaluate(trigBytes, ctx)` → `{ mode, show, css, theme, js, [layout], [trig_violation] }`.

**Evaluation paths:**

| Input | Result |
|-------|--------|
| null / empty | `{ mode: NATIVE(6), show: true, css: null, theme: null, js: null }` |
| length > 20 | `{ trig_violation: true, mode: BLANK(5), show: false, ... }` |
| 1 byte, high nibble = 0x0 | Pattern token lookup |
| 2+ bytes | Bytecode program (header + instruction stream) |

**Pattern tokens (0x00–0x0B):**

| Token | Condition | Mode |
|-------|-----------|------|
| 0x00 | always | CARD |
| 0x01 | KNOWN_CONTACT | CARD |
| 0x02 | HAS_APP | CARD |
| 0x03 | CODE_VERIFIED | CARD |
| 0x04 | IS_HUMAN | CARD |
| 0x05 | KNOWN ∨ APP | CARD |
| 0x06 | KNOWN ∧ APP | CARD |
| 0x07 | always false | BLANK |
| 0x08 | always | FORM |
| 0x09 | IS_HUMAN | FORM |
| 0x0A | always | LIST |
| 0x0B | KNOWN_CONTACT | LIST |

**Bytecode header byte:** `[VER:2][HAS_CSS:1][HAS_TERNARY:1][PROG_LEN:4]`  
VER ≠ 0 → BLANK/false. PROG_LEN=0xF → extended length (read next byte; progLen = 15 + byte).

**Opcodes:**

| Op | Mnemonic | Behaviour |
|----|----------|-----------|
| 0x0 | PATTERN | inline pattern; returns immediately |
| 0x1 | LOAD_CSS | effects.css = arg |
| 0x2 | SET_LAYOUT | effects.layout = arg |
| 0x3 | SHOW | pop stack → show=!!top; return { mode: arg, show } |
| 0x4 | SHOW_ALWAYS | return { mode: arg, show: true } |
| 0x5 | AND(N) | pop N bools; push all-true |
| 0x6 | OR(N) | pop N bools; push any-true |
| 0x7 | NOT | pop; push negation |
| 0x8 | JZ(N) | pop; if false skip N bytes |
| 0x9 | TERNARY | reads 3 operand bytes: cond_id, mode_true, mode_false |
| 0xA | LOAD_JS | effects.js = arg |
| 0xB | SET_THEME | effects.theme = arg |
| 0xC | BLOOM | 2-byte filter; push ctx.bloomResult |
| 0xD | PUSH_COND | push evalCondition(arg, ctx) |
| 0xE | PUSH_LIT | push !!(arg & 1) |
| 0xF | EXTENDED | skip 1 byte (forward compat) |

ARG = 0xF → read next byte as actual arg value.

**Condition IDs (0–11):** HAS_APP, KNOWN_CONTACT, CODE_VERIFIED, IS_HUMAN, HAS_SAVED_REC, ORG_MATCH, HAS_TEMPLATE, DAYLIGHT_HOURS, RECENT_CONTACT, APP_VERSION_OK, REPLY_PENDING, LOCATION_NEAR.

**Display modes:** CARD(0), LIST(1), FORM(2), MINIMAL(3), TICKER(4), BLANK(5), NATIVE(6).

### 3. display_schema Encoder/Decoder (codec.js)

Parsed when `opts.presentation === true` (`#1pb/`, `#1pf/` tags). Follows TRIG block.

**DISPLAY_CONTROL byte (1 byte, always):**
```
[DISPLAY_TYPE:2][DATA_SOURCE:2][SHOW_PRICE:1][SHOW_CONTACT:1][ACCENT_COLOR:1][DISPLAY_FLAGS2:1]
```

Optional bytes:
- `accent_color` (if ACCENT_COLOR=1): 1 byte
- `display_flags2` (if DISPLAY_FLAGS2=1): `[FONT_SIZE:3][LAYOUT_COLS:2][reserved:3]`

Decoded into `record._displaySchema`.

### 4. form_schema Encoder/Decoder (codec.js)

Written after display_schema when `DISPLAY_TYPE >= 2` (menu/form-only) and `opts.formSchema` present.

**FORM_CONTROL byte:**
```
[SUBMIT_ACTION:2][REPLY_TEMPLATE:2][ALLOW_EDIT:1][REQUIRE_NAME:1][REQUIRE_PHONE:1][FORM_FIELDS_FOLLOW:1]
```

When FORM_FIELDS_FOLLOW=1: `field_count` uint8, then per-field:
- Byte 1: `[FIELD_TYPE:4][REQUIRED:1][reserved:3]`
- Byte 2: `labelIndex` (0x00–0xFE = codebook; 0xFF = custom)
- If `labelIndex=0xFF`: `[uint8 len][UTF-8]` custom_label

Decoded into `record._formSchema`.

### 5. #1pb/ and #1pf/ URL Routing (codec.js)

`encode()` now accepts `opts.presentationTag` to emit `#1pb/` or `#1pf/` instead of `#1pa/`.

`decode()` routes all three `#1pa/`, `#1pb/`, `#1pf/` tags. Presentation tags call `parseFrame(frame, { presentation: true })` which also parses display_schema + form_schema after any trig block.

`_parseFramePresentation` exported as convenience wrapper: `function(b) { return parseFrame(b, { presentation: true }); }`.

---

## Key Design Decisions

### 1. Pattern token guard: `bytes.length === 1` required

**Bug encountered:** bytecode programs with `PROG_LEN=1` have header byte `0x01`, which has `high nibble = 0x0` — same as pattern tokens. The original guard `(bytes[0] & 0xF0) === 0x00` incorrectly fired for multi-byte programs.

**Fix:** `if (bytes.length === 1 && (bytes[0] & 0xF0) === 0x00)` — pattern tokens are by definition single-byte programs.

### 2. TRIG block position: after participants, before display_schema

Consistent with FRAME-SPEC §13 ordering. TRIG block can appear in any record type (not only presentation records), but display_schema/form_schema only appear in presentation records.

### 3. parseFrame opts parameter (not separate function)

`parseFrame(bytes, parseOpts)` handles both presentation and non-presentation paths. The `parseOpts.presentation` flag triggers display_schema + form_schema parsing after the standard block sequence. Avoids code duplication while keeping the decode path deterministic.

### 4. form_schema gated by display_schema's DISPLAY_TYPE

form_schema is only encoded/decoded when `DISPLAY_TYPE >= 2` (menu or form-only). A card or list display has no form. This is enforced in both encoder and decoder.

---

## Test Coverage Added (69 new tests)

- TRIG block codec: trig_len roundtrip, trig_len=0 (empty), trig_len > 20 violation, trig bytes in non-presentation record = 5
- display_schema: DISPLAY_CONTROL roundtrip, SHOW_PRICE, accent_color, display_flags2 = 4 (+ 4 form_schema combined in display_schema suite)
- form_schema: SUBMIT_ACTION, REQUIRE_NAME/PHONE, custom label, field_count roundtrip = 4
- #1pb/ routing (2), #1pf/ routing (2) = 4
- trig.js evaluator:
  - empty bytes → NATIVE (2)
  - length > 20 → violation (2)
  - pattern tokens: 0x00 (2), 0x01 (2), 0x08 (1) = 5
  - SHOW_ALWAYS bytecode (2)
  - PUSH_COND + SHOW (3)
  - NOT + SHOW_ALWAYS (1)
  - AND(2) (3)
  - TERNARY (2)
  - LOAD_CSS (2)
  - SET_THEME (1)
  - PUSH_LIT + SHOW (2)
  - JZ (2)
  Total trig.js: 32

Grand total Round 9: 69 new assertions.

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/trig.js` | New file: TRIG bytecode evaluator, ~200 lines; bug fix: pattern-token guard requires `bytes.length === 1` |
| `js/lib/codec.js` | TRIG block encoder/decoder; display_schema encoder/decoder; form_schema encoder/decoder; `parseFrame(bytes, parseOpts)` signature; encode() `presentationTag` support; `_parseFramePresentation` export; #1pb/#1pf routing |
| `test/codec-pads-v1.test.js` | trig.js loading; 69 Round 9 tests; header updated to Rounds 1–9 |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 9 checklist updated |

---

## Open Items Carried Into Round 10

- DATA_SOURCE=11 + SUBMIT_ACTION=11 enforcement (anonymous pickup path) — app-layer enforcement, deferred
- Share sheet: #1pf/ user confirmation before URL generation — UI layer, deferred
- Round 10: C-TRIG Evaluator + Agreements (ctrig.js, agreements.js, Offer/acceptance wire encoding, bilateral ratification detection)
