// markers.js — Marker (Stone) protocol: UID generation, write tokens, RATIFIED_FRAME
// Spec: MARKERS-DESIGN.md §3, §9; TAG-REFERENCE.md #1pm/
// Depends on: global.WPCrypto (sha256, hmacSha256), global.WPCodec (_buildFrame)
// Exposes: global.WPMarkers

'use strict';

(function(global) {

  // ── base32 encoding (RFC 4648, uppercase, no padding) ─────────────────────────

  var BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32Encode(bytes) {
    var result  = '';
    var buffer  = 0;
    var bitsLeft = 0;
    for (var i = 0; i < bytes.length; i++) {
      buffer   = (buffer << 8) | (bytes[i] & 0xFF);
      bitsLeft += 8;
      while (bitsLeft >= 5) {
        bitsLeft -= 5;
        result += BASE32_CHARS[(buffer >> bitsLeft) & 0x1F];
      }
    }
    if (bitsLeft > 0) {
      result += BASE32_CHARS[(buffer << (5 - bitsLeft)) & 0x1F];
    }
    return result;
  }

  // ── UTF-8 helpers ──────────────────────────────────────────────────────────────

  function toUtf8(str)   { return new TextEncoder().encode(str); }
  function fromUtf8(buf) { return new TextDecoder().decode(buf); }

  // ── Marker UID generation ──────────────────────────────────────────────────────
  // did:stone:<base32(sha256(aInput || bInput || timestamp_u16)[0:12])>
  // aInput, bInput: string (DID or phone hash) or Uint8Array
  // timestampDays: uint16 COMPACT_TIME days

  function generateMarkerUid(aInput, bInput, timestampDays) {
    var aBytes  = typeof aInput === 'string' ? toUtf8(aInput) : aInput;
    var bBytes  = typeof bInput === 'string' ? toUtf8(bInput) : bInput;
    var tsBytes = new Uint8Array([((timestampDays || 0) >> 8) & 0xFF, (timestampDays || 0) & 0xFF]);
    var concat  = new Uint8Array(aBytes.length + bBytes.length + 2);
    concat.set(aBytes, 0);
    concat.set(bBytes, aBytes.length);
    concat.set(tsBytes, aBytes.length + bBytes.length);
    var hash = global.WPCrypto.sha256(concat);
    return 'did:stone:' + base32Encode(hash.subarray(0, 12));
  }

  // ── write_token_key derivation ─────────────────────────────────────────────────
  // key = sha256(masterSecret || markerUid_bytes)

  function deriveWriteTokenKey(masterSecret, markerUid) {
    var uidBytes = typeof markerUid === 'string' ? toUtf8(markerUid) : markerUid;
    var concat   = new Uint8Array(masterSecret.length + uidBytes.length);
    concat.set(masterSecret, 0);
    concat.set(uidBytes, masterSecret.length);
    return global.WPCrypto.sha256(concat);
  }

  // ── Write token encoder ────────────────────────────────────────────────────────
  // Wire format:
  //   [u8 len marker_uid][marker_uid utf8][slot_index 1B][prev_stone_hash 8B]
  //   [write_payload...][timestamp u16][hmac_tag 8B]
  // HMAC covers all bytes before the 8-byte tag.

  function encodeWriteToken(opts) {
    var uidBytes  = toUtf8(opts.markerUid);
    var prevHash  = opts.prevStoneHash  || new Uint8Array(8);
    var payload   = opts.writePayload   || new Uint8Array(0);
    var ts        = opts.timestamp      || 0;
    var master    = opts.masterSecret;

    var contentLen = 1 + uidBytes.length + 1 + 8 + payload.length + 2;
    var content    = new Uint8Array(contentLen);
    var pos        = 0;
    content[pos++] = uidBytes.length & 0xFF;
    content.set(uidBytes, pos); pos += uidBytes.length;
    content[pos++] = opts.slotIndex & 0xFF;
    content.set(prevHash.subarray(0, 8), pos); pos += 8;
    content.set(payload, pos); pos += payload.length;
    content[pos++] = (ts >> 8) & 0xFF;
    content[pos++] = ts & 0xFF;

    var key     = deriveWriteTokenKey(master, opts.markerUid);
    var hmacTag = global.WPCrypto.hmacSha256(key, content).subarray(0, 8);

    var token = new Uint8Array(contentLen + 8);
    token.set(content, 0);
    token.set(hmacTag, contentLen);
    return token;
  }

  // ── Write token decoder ────────────────────────────────────────────────────────
  // Returns { markerUid, slotIndex, prevStoneHash, writePayload, timestamp, verified }

  function decodeWriteToken(tokenBytes, masterSecret) {
    var empty = { markerUid: '', slotIndex: 0, prevStoneHash: null, writePayload: null, timestamp: 0, verified: false };
    if (!tokenBytes || tokenBytes.length < 13) return empty;

    var pos       = 0;
    var uidLen    = tokenBytes[pos++];
    if (pos + uidLen > tokenBytes.length) return empty;
    var markerUid = fromUtf8(tokenBytes.subarray(pos, pos + uidLen)); pos += uidLen;
    if (pos + 1 + 8 + 2 + 8 > tokenBytes.length) return empty;
    var slotIndex      = tokenBytes[pos++];
    var prevStoneHash  = tokenBytes.subarray(pos, pos + 8); pos += 8;
    var payloadEnd     = tokenBytes.length - 10;  // 2B timestamp + 8B hmac
    var writePayload   = tokenBytes.subarray(pos, payloadEnd); pos = payloadEnd;
    var timestamp      = (tokenBytes[pos] << 8) | tokenBytes[pos + 1]; pos += 2;
    var storedHmac     = tokenBytes.subarray(pos, pos + 8);

    var content  = tokenBytes.subarray(0, tokenBytes.length - 8);
    var key      = deriveWriteTokenKey(masterSecret, markerUid);
    var expected = global.WPCrypto.hmacSha256(key, content).subarray(0, 8);
    var verified = storedHmac.length === 8 &&
                   expected.every(function(b, i) { return b === storedHmac[i]; });

    return { markerUid: markerUid, slotIndex: slotIndex, prevStoneHash: prevStoneHash,
             writePayload: writePayload, timestamp: timestamp, verified: verified };
  }

  // ── RATIFIED_FRAME builder ─────────────────────────────────────────────────────
  // Returns raw pads-v1 frame bytes (Uint8Array) for a State Commit ratification record.
  // opts: { story, markerUid, job, date, refNumber, contextLabel, tag, participants, financialOpts }

  function buildRatifiedFrame(opts) {
    var codec = global.WPCodec;
    if (!codec || !codec._buildFrame) return new Uint8Array(0);

    var record = {
      story:         opts.story        || '',
      uid:           opts.markerUid    || '',
      job:           opts.job          || '',
      date:          opts.date         || '',
      ref_number:    opts.refNumber    || '',
      context_label: opts.contextLabel || '',
      tag:           opts.tag          || 'marker,ratified'
    };

    var frameOpts = {
      baseTemplate:  5,       // BASE_TEMPLATE=101 = State Commit
      commitType:    2,       // COMMIT_TYPE=10 (terms agreed)
      chainComplete: true,
      compactTime:   true,
      participants:  opts.participants || []
    };

    if (opts.financialOpts) {
      for (var k in opts.financialOpts) {
        if (Object.prototype.hasOwnProperty.call(opts.financialOpts, k)) {
          frameOpts[k] = opts.financialOpts[k];
        }
      }
    }

    return codec._buildFrame(record, frameOpts);
  }

  // ── decodePadsV1Marker ─────────────────────────────────────────────────────────
  // Decodes a write token (Uint8Array) and verifies its HMAC.
  // Returns { markerUid, slot, writePayload, timestamp, verified }

  function decodePadsV1Marker(tokenBytes, masterSecret) {
    var r = decodeWriteToken(tokenBytes, masterSecret);
    return { markerUid: r.markerUid, slot: r.slotIndex, writePayload: r.writePayload,
             timestamp: r.timestamp, verified: r.verified };
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  global.WPMarkers = {
    generateMarkerUid:   generateMarkerUid,
    encodeWriteToken:    encodeWriteToken,
    decodeWriteToken:    decodeWriteToken,
    buildRatifiedFrame:  buildRatifiedFrame,
    decodePadsV1Marker:  decodePadsV1Marker,
    deriveWriteTokenKey: deriveWriteTokenKey,
    base32Encode:        base32Encode
  };

}(typeof window !== 'undefined' ? window : global));
