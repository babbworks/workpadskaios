# Round 11 Summary — Markers

**Date completed:** 2026-05-18  
**Status:** Done — 562/562 tests pass (534 from Rounds 1–10, 28 new Round 11).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary outputs:** `js/lib/markers.js` (new), `js/lib/codec.js` (`#1pm/` routing)

---

## What Was Built

### 1. Marker UID Generation

`WPMarkers.generateMarkerUid(aInput, bInput, timestampDays)` → `did:stone:<base32_20chars>`

```
did:stone:<base32(sha256(aInput || bInput || timestamp_u16)[0:12])>
```

- `aInput` / `bInput`: string (DID or phone hash proxy) or Uint8Array
- `timestampDays`: uint16 COMPACT_TIME days
- Hash input: concatenation of a bytes + b bytes + 2-byte big-endian timestamp
- Hash slice: first 12 bytes → 96 bits → 20 base32 chars (RFC 4648, uppercase, no padding)
- Total UID length: `did:stone:` (10) + 20 = 30 characters
- Deterministic: same inputs always produce the same UID

### 2. Write Token Wire Format

`WPMarkers.encodeWriteToken(opts)` → Uint8Array

```
[u8 len marker_uid][marker_uid utf8][slot_index 1B][prev_stone_hash 8B]
[write_payload...][timestamp u16][hmac_tag 8B]
```

Key derivation: `write_token_key = sha256(masterSecret || markerUid_utf8_bytes)`

HMAC: `hmacSha256(write_token_key, content)[0:8]` where `content` = all bytes before the 8-byte HMAC tag.

- `prev_stone_hash`: all-zero 8 bytes for SLOT 0 (first write); `sha256(slot0_token)[0:8]` for SLOT 1
- `write_payload`: party's ratification bytes (typically the RATIFIED_FRAME)
- `timestamp`: uint16 COMPACT_TIME days

`WPMarkers.decodeWriteToken(tokenBytes, masterSecret)` → `{ markerUid, slotIndex, prevStoneHash, writePayload, timestamp, verified }`

Wrong key → `verified: false` (HMAC mismatch detected without exception).

### 3. RATIFIED_FRAME Builder

`WPMarkers.buildRatifiedFrame(opts)` → Uint8Array (raw frame, before deflate)

Uses `WPCodec._buildFrame` with:
- `baseTemplate: 5` (BASE_TEMPLATE=101 = State Commit)
- `commitType: 2` (COMMIT_TYPE=10 = terms agreed)
- `chainComplete: true`
- `compactTime: true`
- `participants` array (Party A IS_SENDER=1, Party B IS_SENDER=0)

Fields encoded: `story` (bit 11), `uid` (FLAGS3 bit 5, text), `tag` (FLAGS3 bit 1, compact), `job` (bit 0), `date` (bit 2), `ref_number` (bit 13).

**Size budget:** minimal RATIFIED_FRAME with story (25B) + uid (1+30B) + tag (1+15B) + 2 participants + State Commit header bytes = ~95B. Fits NTAG213 (144B). Full records with long names → NTAG215 (504B).

Decoded record stores State Commit data in `_stateCommit` (not `_meta`):
- `record._stateCommit.commitType` = 2
- `record._stateCommit.chainComplete` = true

### 4. decodePadsV1Marker

`WPMarkers.decodePadsV1Marker(tokenBytes, masterSecret)` → `{ markerUid, slot, writePayload, timestamp, verified }`

Thin wrapper over `decodeWriteToken` that renames `slotIndex` to `slot` for the external API contract.

### 5. #1pm/ URL Routing (codec.js)

Added to `decode()` before the main routing block:

```javascript
if (hash.slice(0, 4) === '1pm/') return { _markerUid: fromUtf8(fromBase64Url(hash.slice(4))) };
```

URL: `workpads.me/p#1pm/<base64url(marker_uid_string)>` — the fragment carries the UTF-8 UID string base64url-encoded. `decode()` returns `{ _markerUid: string }`. The app then performs the RATIFIED_FRAME lookup (NFC read, server fetch, or local cache).

### 6. P2P Option E Protocol (no network)

The write token structure fully supports offline P2P exchange:
1. Party A encodes SLOT 0 token (prevStoneHash = zeros)
2. Both devices exchange tokens via NFC/QR/BLE — no server involved
3. Party B encodes SLOT 1 token (prevStoneHash = sha256(slot0_token)[0:8])
4. Each party verifies the other's token HMAC using the other's device key
5. Both apps independently assert WRITE_LOCK — no sync required

Server sync is deferred and optional: `prev_stone_hash` provides a cryptographic ordering mechanism for any later sync.

---

## Design Decisions

### 1. _stateCommit not _meta

The codec decoder stores State Commit data in `record._stateCommit`, not in `record._meta`. Tests were initially written to check `_meta.commitType` and `_meta.chainComplete` — both corrected to `_stateCommit.commitType` and `_stateCommit.chainComplete`.

### 2. base32 with no padding

The spec example shows a 18-character UID suffix (`NBSWY3DPEB3W64TMMQ`), which is illustrative only. Actual implementation: 12 bytes → 20 base32 characters (no padding). The spec formula `sha256(...)[0:12]` = 12 bytes → 96 bits / 5 bits per char = 19.2 → 20 chars (last char encodes 4 bits, 1 bit padding absorbed). Total UID = 30 chars (`did:stone:` + 20).

### 3. markers.js depends on WPCrypto and WPCodec being loaded first

`generateMarkerUid` calls `global.WPCrypto.sha256`. `buildRatifiedFrame` calls `global.WPCodec._buildFrame`. Both are injected globals consistent with the pattern established in security.js and template-registry.js.

### 4. decodePadsV1Marker takes token bytes, not a URL fragment

The workplan name "decodePadsV1Marker(fragment)" is misleading. The function operates on raw write token bytes, not URL fragments. The `#1pm/` URL routing is handled in `codec.decode()` and returns only the UID string. Write token parsing is separate — the app routes based on what it receives (URL → UID lookup; raw bytes → token decode + verify).

---

## Test Coverage Added (28 new tests)

- Marker UID deterministic (2), starts with did:stone: (1), length=30 (1) = 4
- Different inputs → different UID (1)
- Write token roundtrip: markerUid (1), slotIndex=0 (1), timestamp (1), payload[0] (1), verified (1) = 5
- Wrong key → verified=false (1)
- decodePadsV1Marker: markerUid (1), slot=1 (1), verified (1) = 3
- P2P Option E: slot0 verified (1), slot1 verified (1), slotIndex=1 (1), prevHash chain (1) = 4
- RATIFIED_FRAME: is Uint8Array (1), ≤144B (1), commitType=2 (1), chainComplete (1), story (1), uid (1) = 6
- #1pm/ routing: _markerUid (1)
- Offline matrix: 4 cases (4)

Total: 28 new assertions.

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/markers.js` | New file: Marker UID, write tokens, RATIFIED_FRAME, decodePadsV1Marker, ~140 lines |
| `js/lib/codec.js` | `#1pm/` routing in decode() — 1 line added |
| `test/codec-pads-v1.test.js` | markers.js loading; 28 Round 11 tests |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 11 checklist updated |

---

## Open Items

- IPFS storage option for software Markers — post-MVP
- P2P Marker discovery UX (how Party B knows which UID to expect) — UX design needed
- Apprenticeship credential export (W3C VC / Open Badges) — Stage 2
- Multi-party Stones (3+ slots) — NTAG216 hardware target; codec already supports up to 7 participants
- Server-side write-once enforcement for software Markers — server layer, out of codec scope
- WORM bit setting for NFC hardware Markers — platform/NFC layer
- Round 12: standard sync obligations (SUI-009 markers-spec.md; earlier SUI items from Rounds 1–10)
