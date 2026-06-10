// security.js — five-layer security wrapper for pads-v1
// Spec: FRAME-SPEC.md §12, SECURITY-DESIGN.md
//
// Requires:
//   global.fflate    = { deflateSync, inflateSync }
//   global.WPCrypto  = { sha256(Uint8Array): Uint8Array,
//                        hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array,
//                        aesCtrEncrypt(key, iv, data: Uint8Array): Uint8Array,
//                        aesCtrDecrypt(key, iv, data: Uint8Array): Uint8Array,
//                        randomBytes(n): Uint8Array }
//   global.WPCodec   = { _buildFrame, _parseFrame } (loaded before this file)
//
// Exposes: global.WPSecurity

'use strict';

(function(global) {

  var URL_PREFIX = 'workpads.me/p#';

  // ── base64url (self-contained copy) ───────────────────────────────────────────

  function toB64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function fromB64(str) {
    var padded = str + '=='.slice(0, (4 - str.length % 4) % 4);
    var bin    = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    var out    = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ── UTF-8 passphrase encoding ─────────────────────────────────────────────────

  function passphraseBytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var b = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) b[i] = str.charCodeAt(i) & 0xFF;
    return b;
  }

  // ── byte concat ───────────────────────────────────────────────────────────────

  function concat(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a, 0); out.set(b, a.length);
    return out;
  }

  // ── LCG PRNG (Knuth: multiplier=1664525, increment=1013904223, mod=2^32) ──────

  function lcgStep(s) {
    // 32-bit LCG: avoids float precision issues using 16-bit split multiply
    var lo = (s & 0xFFFF) * 1664525;
    var hi = (s >>> 16)   * 1664525;
    return ((lo + (hi << 16)) + 1013904223) >>> 0;
  }

  function seedToU32(seed4) {
    return ((seed4[0] << 24) | (seed4[1] << 16) | (seed4[2] << 8) | seed4[3]) >>> 0;
  }

  // ── Key derivation ────────────────────────────────────────────────────────────
  // master = SHA-256(passphrase || salt)  [32B]
  // cipher_key = master[0:16], scramble_seed = master[16:32], iv = master[0:16]

  function deriveKeys(passphrase, salt) {
    var pw  = passphraseBytes(passphrase);
    var inp = concat(pw, salt);
    var master = global.WPCrypto.sha256(inp);
    return {
      cipherKey:    master.subarray(0, 16),
      scrambleSeed: master.subarray(16, 32),
      iv:           master.subarray(0, 16)
    };
  }

  // ── Deflate seed poisoning: XOR first 256 bytes with LCG mask ────────────────
  // Encoder: XOR → deflate;   Decoder: inflate → XOR (same operation, symmetric)

  function applyXorMask(bytes, seed4) {
    var s      = lcgStep(seedToU32(seed4));
    var result = new Uint8Array(bytes);
    var len    = Math.min(256, result.length);
    for (var i = 0; i < len; i++) {
      s = lcgStep(s);
      result[i] ^= (s >>> 24) & 0xFF;
    }
    return result;
  }

  // ── Field scramble: Fisher-Yates byte shuffle ─────────────────────────────────

  function scrambleBytes(bytes, seed4) {
    var s   = seedToU32(seed4);
    var arr = new Uint8Array(bytes);
    var n   = arr.length;
    for (var i = n - 1; i > 0; i--) {
      s = lcgStep(s);
      var j = s % (i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function unscrambleBytes(bytes, seed4) {
    var s   = seedToU32(seed4);
    var n   = bytes.length;
    // Record swap pairs from the forward shuffle
    var swapJ = [];
    for (var i = n - 1; i > 0; i--) {
      s = lcgStep(s);
      swapJ.push(s % (i + 1));
    }
    var arr = new Uint8Array(bytes);
    // Replay swaps in reverse: forward had i=n-1,n-2,...,1; reverse applies i=1,...,n-1
    for (var k = swapJ.length - 1; k >= 0; k--) {
      var iIdx = n - 1 - k;
      var jIdx = swapJ[k];
      var tmp = arr[iIdx]; arr[iIdx] = arr[jIdx]; arr[jIdx] = tmp;
    }
    return arr;
  }

  // ── HMAC-SHA256 8B tag ────────────────────────────────────────────────────────
  // key = cipher_key || receiver_phone_hash (16 + 32 = 48 bytes)

  function computeHmac(cipherKey, receiverHash, data) {
    var key = concat(cipherKey, receiverHash || new Uint8Array(32));
    return global.WPCrypto.hmacSha256(key, data).subarray(0, 8);
  }

  // ── Preamble byte construction ────────────────────────────────────────────────

  function makePreamble(cipherKey, opts) {
    var b = 0;
    if (opts.scramble)    b |= 0x80;
    if (opts.aes)         b |= 0x40;
    if (opts.hmac)        b |= 0x20;
    if (opts.seedPoison)  b |= 0x10;
    if (opts.hkdfKey)     b |= 0x08;
    b |= (cipherKey[0] & 0x07);  // KEY_HINT: lower 3 bits of cipher_key[0]
    return b;
  }

  // ── Clear header length for #1ph/ ────────────────────────────────────────────
  // Returns byte count of: meta1 [1B] + meta2 [0-1B] + setup_byte [0-1B] + tx_byte [0-1B]

  function clearHeaderLen(frame) {
    var pos  = 0;
    var meta1 = frame[pos++];
    if (!(meta1 & 0x80)) return pos;  // no meta2
    var meta2  = frame[pos++];
    var domain = (meta2 >> 2) & 0x03;
    if (domain === 0) return pos;     // no financial context
    pos++;  // setup_byte
    pos++;  // transaction_byte or state_commit_byte
    return pos;
  }

  // ── Full scramble encode (→ #1ps/ URL) ───────────────────────────────────────

  function encryptFull(frame, passphrase, opts) {
    opts = opts || {};
    var salt = opts.salt || global.WPCrypto.randomBytes(4);
    var keys = deriveKeys(passphrase, salt);
    var sp   = keys.scrambleSeed;

    // Layer 1: XOR seed poisoning + deflate
    var xored      = applyXorMask(frame, sp.subarray(0, 4));
    var compressed = global.fflate.deflateSync(xored, { level: 9 });

    // Layer 2: field scramble
    var scrambled = scrambleBytes(compressed, sp.subarray(4, 8));

    // Layer 4: optional HMAC (appended before AES)
    var inner   = scrambled;
    var hasHmac = !!(opts.hmac);
    if (hasHmac) {
      var tag = computeHmac(keys.cipherKey, opts.receiverHash, scrambled);
      inner   = concat(scrambled, tag);
    }

    // Layer 3: AES-CTR encrypt
    var encrypted = global.WPCrypto.aesCtrEncrypt(keys.cipherKey, keys.iv, inner);

    // Preamble byte
    var preamble = makePreamble(keys.cipherKey, {
      scramble: true, aes: true, hmac: hasHmac, seedPoison: true
    });

    var payload = concat(new Uint8Array([preamble]), encrypted);
    return URL_PREFIX + '1ps/' + toB64(salt) + '.' + toB64(payload);
  }

  // ── Full scramble decode (#1ps/ URL) ─────────────────────────────────────────

  function decryptFull(url, passphrase, opts) {
    opts = opts || {};
    var hash = url.indexOf('#') !== -1 ? url.slice(url.indexOf('#') + 1) : url;
    if (hash.slice(0, 4) !== '1ps/') throw new Error('WPSecurity: not a #1ps/ URL');
    hash = hash.slice(4);

    var dot  = hash.indexOf('.');
    if (dot === -1) throw new Error('WPSecurity: malformed #1ps/ URL (no . separator)');
    var salt    = fromB64(hash.slice(0, dot));
    var payload = fromB64(hash.slice(dot + 1));

    var keys    = deriveKeys(passphrase, salt);
    var preamble = payload[0];

    // KEY_HINT check
    if ((keys.cipherKey[0] & 0x07) !== (preamble & 0x07)) {
      throw new Error('WPSecurity: KEY_HINT mismatch — wrong passphrase');
    }

    var hasHmac   = !!(preamble & 0x20);
    var encrypted = payload.subarray(1);
    var sp        = keys.scrambleSeed;

    // AES-CTR decrypt
    var inner = global.WPCrypto.aesCtrDecrypt(keys.cipherKey, keys.iv, encrypted);

    // HMAC verify
    if (hasHmac) {
      var tag      = inner.subarray(inner.length - 8);
      var data     = inner.subarray(0, inner.length - 8);
      var expected = computeHmac(keys.cipherKey, opts.receiverHash, data);
      for (var i = 0; i < 8; i++) {
        if (tag[i] !== expected[i]) throw new Error('WPSecurity: HMAC mismatch');
      }
      inner = data;
    }

    // Un-scramble
    var unscrambled = unscrambleBytes(inner, sp.subarray(4, 8));

    // Inflate
    var inflated = global.fflate.inflateSync(unscrambled);

    // Un-XOR seed poisoning
    return applyXorMask(inflated, sp.subarray(0, 4));
  }

  // ── Partial scramble encode (→ #1ph/ URL) ────────────────────────────────────

  function encryptPartial(frame, passphrase, opts) {
    opts = opts || {};
    var salt    = opts.salt || global.WPCrypto.randomBytes(4);
    var keys    = deriveKeys(passphrase, salt);
    var sp      = keys.scrambleSeed;
    var hLen    = clearHeaderLen(frame);
    var hdr     = frame.subarray(0, hLen);
    var rest    = frame.subarray(hLen);

    // Seed XOR + deflate + scramble + AES on the field data only
    var xored      = applyXorMask(rest, sp.subarray(0, 4));
    var compressed = global.fflate.deflateSync(xored, { level: 9 });
    var scrambled  = scrambleBytes(compressed, sp.subarray(4, 8));
    var encrypted  = global.WPCrypto.aesCtrEncrypt(keys.cipherKey, keys.iv, scrambled);

    // Preamble: HMAC=0 for partial (#1ph/ never carries HMAC)
    var preamble = makePreamble(keys.cipherKey, {
      scramble: true, aes: true, hmac: false, seedPoison: true
    });

    // Payload: preamble + clear_header + encrypted_rest
    var payload = concat(new Uint8Array([preamble]), concat(hdr, encrypted));
    return URL_PREFIX + '1ph/' + toB64(salt) + '.' + toB64(payload);
  }

  // ── Partial scramble decode (#1ph/ URL) ───────────────────────────────────────

  function decryptPartial(url, passphrase) {
    var hash = url.indexOf('#') !== -1 ? url.slice(url.indexOf('#') + 1) : url;
    if (hash.slice(0, 4) !== '1ph/') throw new Error('WPSecurity: not a #1ph/ URL');
    hash = hash.slice(4);

    var dot  = hash.indexOf('.');
    if (dot === -1) throw new Error('WPSecurity: malformed #1ph/ URL');
    var salt    = fromB64(hash.slice(0, dot));
    var payload = fromB64(hash.slice(dot + 1));

    var keys    = deriveKeys(passphrase, salt);
    var preamble = payload[0];

    if ((keys.cipherKey[0] & 0x07) !== (preamble & 0x07)) {
      throw new Error('WPSecurity: KEY_HINT mismatch — wrong passphrase');
    }

    var sp = keys.scrambleSeed;

    // Payload after preamble: [clear_header][encrypted_rest]
    // We don't know clear_header length without parsing, so re-derive from frame header
    // We know the first byte is meta1; use it to determine header length
    var afterPreamble = payload.subarray(1);
    var meta1         = afterPreamble[0];
    var meta2Present  = !!(meta1 & 0x80);
    var hasMeta2      = meta2Present && afterPreamble.length > 1;
    var domain        = hasMeta2 ? ((afterPreamble[1] >> 2) & 0x03) : 0;
    var hLen          = 1 + (meta2Present ? 1 : 0) + (domain > 0 ? 2 : 0);
    var hdr           = afterPreamble.subarray(0, hLen);
    var encryptedRest = afterPreamble.subarray(hLen);

    // Decrypt + un-scramble + inflate + un-XOR
    var decrypted   = global.WPCrypto.aesCtrDecrypt(keys.cipherKey, keys.iv, encryptedRest);
    var unscrambled = unscrambleBytes(decrypted, sp.subarray(4, 8));
    var inflated    = global.fflate.inflateSync(unscrambled);
    var fieldBytes  = applyXorMask(inflated, sp.subarray(0, 4));

    return concat(hdr, fieldBytes);
  }

  // ── High-level helpers for codec.js integration ───────────────────────────────

  function secureEncode(record, encOpts, secOpts) {
    encOpts = encOpts || {};
    var frame = global.WPCodec._buildFrame(record, encOpts);
    var url;
    if (secOpts.mode === 'partial') url = encryptPartial(frame, secOpts.passphrase, secOpts);
    else url = encryptFull(frame, secOpts.passphrase, secOpts);
    if (global.WPCodec && global.WPCodec.appendRatifiedSuffix) {
      return global.WPCodec.appendRatifiedSuffix(url, encOpts.ratifiedFrameBytes);
    }
    return url;
  }

  function secureDecode(url, passphrase, opts) {
    var hash = url.indexOf('#') !== -1 ? url.slice(url.indexOf('#') + 1) : url;
    var ratifiedB64 = null;
    if (global.WPCodec && global.WPCodec.parseHashExtras) {
      var hx = global.WPCodec.parseHashExtras(hash);
      hash = hx.body;
      ratifiedB64 = hx.ratifiedB64;
      if (ratifiedB64) {
        var hashPos = url.indexOf('#');
        url = (hashPos !== -1 ? url.slice(0, hashPos + 1) : '') + hash;
      }
    }
    var tag  = hash.slice(0, 4);
    var frame;
    if      (tag === '1ps/') frame = decryptFull(url, passphrase, opts || {});
    else if (tag === '1ph/') frame = decryptPartial(url, passphrase);
    else throw new Error('WPSecurity: unsupported tag ' + tag);
    var result = global.WPCodec._parseFrame(frame);
    if (ratifiedB64 && global.WPCodec._attachRatifiedFrameRecord) {
      global.WPCodec._attachRatifiedFrameRecord(result, ratifiedB64);
    }
    return result;
  }

  global.WPSecurity = {
    secureEncode:     secureEncode,
    secureDecode:     secureDecode,
    // low-level exports for testing
    _deriveKeys:      deriveKeys,
    _applyXorMask:    applyXorMask,
    _scrambleBytes:   scrambleBytes,
    _unscrambleBytes: unscrambleBytes,
    _encryptFull:     encryptFull,
    _decryptFull:     decryptFull,
    _encryptPartial:  encryptPartial,
    _decryptPartial:  decryptPartial,
    _clearHeaderLen:  clearHeaderLen
  };

}(typeof window !== 'undefined' ? window : global));
