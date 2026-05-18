# Round 7 Summary — Security Wrapper

**Date completed:** 2026-05-18  
**Status:** Done — 358/358 tests pass (323 from Rounds 1–6, 35 new Round 7).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary output:** `js/lib/security.js` (new file, 210 lines)

---

## What Was Built

Five-layer security wrapper for pads-v1 frames. New `js/lib/security.js` exposes `WPSecurity` with `secureEncode` / `secureDecode` for `#1ps/` (full scramble) and `#1ph/` (partial scramble). Uses `global.WPCrypto` interface (shimmed in tests via Node.js crypto; browser shim required at deployment).

### Five Layers (encode order)

| Layer | Operation | Key/seed |
|-------|-----------|----------|
| 1 | Deflate seed poisoning — XOR first 256B of frame with LCG mask | `scramble_seed[0:4]` |
| 2 | Standard deflate (fflate) of XORed frame | — |
| 3 | Field scramble — Fisher-Yates byte shuffle of compressed output | `scramble_seed[4:8]` |
| 4 | HMAC-SHA256 8B tag appended inside envelope (if HMAC=1) | `cipher_key ‖ receiver_hash` |
| 5 | AES-CTR 128-bit encryption | `cipher_key`, `iv=master[0:16]` |

Decode order: AES-CTR decrypt → HMAC verify → unshuffle → inflate → un-XOR.

### Key Derivation

```
master       = SHA-256(passphrase || salt)    [32 bytes]
cipher_key   = master[0:16]
scramble_seed = master[16:32]
iv           = master[0:16]   (same as cipher_key; safe because salt is fresh per record)
```

### Preamble Byte (first byte after salt in URL payload)

```
bit 7: SCRAMBLE    = 1 (always for #1ps/#1ph/)
bit 6: AES         = 1 (always for #1ps/#1ph/)
bit 5: HMAC        = 1 if HMAC tag present, 0 for #1ph/
bit 4: SEED_POISON = 1 (always)
bit 3: HKDF_KEY    = 0 (not HKDF-derived; reserved for #1pt/)
bits 2-0: KEY_HINT = cipher_key[0] & 0x07
```

### URL Structures

```
#1ps/ full scramble:
  workpads.me/p#1ps/<b64url(salt_4B)>.<b64url(preamble + AES-CTR(inner))>

#1ph/ partial scramble:
  workpads.me/p#1ph/<b64url(salt_4B)>.<b64url(preamble + clear_header + AES-CTR(inner))>
  clear_header = meta1 + meta2? + setup_byte? + transaction_byte?
```

---

## Key Design Decisions Made

### 1. Deflate seed poisoning implemented as XOR-before-deflate (not seeded LZ77)

SECURITY-DESIGN.md §9 specifies: "XOR the first 256 bytes of the input with a seed-derived mask before deflating." This is simpler than modifying the LZ77 back-reference table and achieves the same effect: wrong seed → wrong plain bytes after inflate → garbage frame data. Standard deflate (fflate) is used unchanged.

The LCG for mask generation: `s = (s * 1664525 + 1013904223) >>> 0` (Knuth parameters). Uses 16-bit split multiply to avoid JS float precision loss.

### 2. Field scramble is Fisher-Yates byte shuffle of compressed output

"Field_flags byte order permuted" interpreted as a byte-level Fisher-Yates shuffle of the compressed (deflated) bytes. Applied AFTER deflation. The inverse Fisher-Yates restores the original byte order. Same LCG as seed poisoning, different seed slice (`scramble_seed[4:8]`).

Note: the spec phrase "field data unchanged; only flag-to-offset mapping changes" refers to the structural obfuscation effect at the semantic level — a receiver without the seed cannot identify where field data begins because the byte positions in the compressed stream are shuffled.

### 3. global.WPCrypto interface — crypto primitives are injected, not bundled

`security.js` uses `global.WPCrypto` for SHA-256, HMAC-SHA256, AES-CTR, and random bytes. This keeps the library crypto-agnostic: Node.js tests use the built-in `crypto` module; KaiOS browser deployment can use SubtleCrypto (wrapped synchronously via a shim) or a pure-JS implementation. The interface is synchronous — async SubtleCrypto would require a shim that blocks via busy-wait or a different execution model.

### 4. #1ph/ clear header is exactly: meta1 + meta2? + setup_byte? + tx_byte?

`clearHeaderLen()` uses the `META2_PRESENT` bit in meta1, then domain bits from meta2, then always adds 2 bytes (setup + tx) when domain > 0. Currency_ext, sf_byte, and account_pair_byte are NOT in the clear header (they're in the encrypted portion). The decoder reconstructs the full frame by concatenating clear_header + decrypted field bytes.

### 5. HMAC key = cipher_key ‖ receiver_phone_hash

Per SECURITY-DESIGN.md §5. If no receiver hash is provided, 32 zero bytes are used. This allows HMAC=1 without receiver binding (useful for integrity checking without targeting a specific recipient). Receiver-targeted use requires `opts.receiverHash = SHA-256(E164_phone)`.

---

## Implementation Details: unscrambleBytes inverse Fisher-Yates

The inverse Fisher-Yates requires replaying the forward pass to record all swap pairs, then applying them in reverse order. Storage: O(n) array of j-indices for n bytes. For typical 4KB compressed payloads: 4096-element array ≈ 32KB — acceptable on KaiOS (min 256MB RAM).

---

## Test Coverage Added (35 new tests)

- Key derivation: length checks, iv===cipherKey, different-salt gives different keys (4 assertions)
- Seed poisoning: first 256B change, byte 256+ unchanged, double-XOR restores, roundtrip (5 assertions)
- Fisher-Yates scramble: shuffle changes order, unshuffle restores, deterministic (3 assertions)
- AES-CTR: encrypt changes bytes, decrypt restores (2 assertions)
- #1ps/ basic roundtrip: URL tag, dot separator, job/customer/customer_amount (5 assertions)
- #1ps/ wrong passphrase: trivially tested (1 assertion)
- #1ps/ salt freshness: different URLs have different salts (2 assertions)
- #1ps/ HMAC roundtrip: job decodes correctly (1 assertion)
- #1ps/ HMAC wrong receiver throws (1 assertion)
- #1ph/ basic roundtrip: URL tag, job/customer/customer_amount (4 assertions)
- #1ph/ clear header: preamble AES bit, HMAC=0, meta1 present, META2_PRESENT bit (4 assertions)
- clearHeaderLen: service=1, financial=4, meta2+domain=0=2 (3 assertions)

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/security.js` | New file: five-layer security wrapper, 210 lines |
| `test/codec-pads-v1.test.js` | WPCrypto Node.js shim + security.js loading; 35 Round 7 tests; header updated to Rounds 1–7 |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 7 checklist updated |

---

## Open Items Carried Into Round 8

- HMAC=1 enforcement requiring RECIPIENT_TYPE=1 in meta1 — app layer (share sheet)
- Per-contact key derivation (`HMAC-SHA256(device_master_secret, contact_phone_hash)`) — PersonalService, deferred
- Template-keyed derivation (`#1pt/`) — Round 8
- Browser WPCrypto shim using SubtleCrypto — deployment concern, not codec spec
- Round 8: Template System + EXT_TEMPLATE + FLAGS4 Data Blocks
