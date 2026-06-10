// crypto.js — WPCrypto: SHA-256, HMAC-SHA-256, AES-128-CTR, randomBytes
// Pure ES5, no dependencies. Exposes: global.WPCrypto
// Required by security.js for #1ps/#1ph tag encoding.

(function(global) {
  'use strict';

  // ── SHA-256 ───────────────────────────────────────────────────────────────────

  var K256 = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];

  function rotr32(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(data) {
    var msg = (data instanceof Uint8Array) ? data : new Uint8Array(data);
    var len = msg.length;
    var bitLen = len * 8;
    var padLen = (len % 64 < 56) ? (56 - len % 64) : (120 - len % 64);
    var padded = new Uint8Array(len + padLen + 8);
    padded.set(msg);
    padded[len] = 0x80;
    padded[padded.length - 4] = (bitLen >>> 24) & 0xff;
    padded[padded.length - 3] = (bitLen >>> 16) & 0xff;
    padded[padded.length - 2] = (bitLen >>> 8)  & 0xff;
    padded[padded.length - 1] =  bitLen         & 0xff;

    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
             0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var W = new Array(64);

    for (var blk = 0; blk < padded.length; blk += 64) {
      var i;
      for (i = 0; i < 16; i++) {
        W[i] = ((padded[blk+i*4]   << 24) | (padded[blk+i*4+1] << 16) |
                (padded[blk+i*4+2] <<  8) |  padded[blk+i*4+3]) >>> 0;
      }
      for (i = 16; i < 64; i++) {
        var s0 = rotr32(W[i-15], 7) ^ rotr32(W[i-15], 18) ^ (W[i-15] >>> 3);
        var s1 = rotr32(W[i-2], 17) ^ rotr32(W[i-2],  19) ^ (W[i-2]  >>> 10);
        W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
      }
      var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for (i = 0; i < 64; i++) {
        var S1  = rotr32(e,6)  ^ rotr32(e,11) ^ rotr32(e,25);
        var ch  = (e & f) ^ (~e & g);
        var t1  = (h + S1 + (ch>>>0) + K256[i] + W[i]) >>> 0;
        var S0  = rotr32(a,2)  ^ rotr32(a,13) ^ rotr32(a,22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2  = (S0 + (maj>>>0)) >>> 0;
        h=g; g=f; f=e; e=(d+t1)>>>0;
        d=c; c=b; b=a; a=(t1+t2)>>>0;
      }
      H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
      H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
    }

    var out = new Uint8Array(32);
    for (var j = 0; j < 8; j++) {
      out[j*4]   = (H[j]>>>24)&0xff; out[j*4+1] = (H[j]>>>16)&0xff;
      out[j*4+2] = (H[j]>>> 8)&0xff; out[j*4+3] =  H[j]      &0xff;
    }
    return out;
  }

  // ── HMAC-SHA-256 ─────────────────────────────────────────────────────────────

  function hmacSha256(key, data) {
    var k = key.length > 64 ? sha256(key) : key;
    var kp = new Uint8Array(64);
    kp.set(k);
    var oPad = new Uint8Array(64), iPad = new Uint8Array(64);
    for (var i = 0; i < 64; i++) { oPad[i] = kp[i] ^ 0x5c; iPad[i] = kp[i] ^ 0x36; }
    var inner = new Uint8Array(64 + data.length);
    inner.set(iPad); inner.set(data, 64);
    var outer = new Uint8Array(96);
    outer.set(oPad); outer.set(sha256(inner), 64);
    return sha256(outer);
  }

  // ── AES-128 ───────────────────────────────────────────────────────────────────

  // AES S-box (FIPS 197 §5.1.1) — fixed table, avoids GF(2^8) runtime generation
  var SBOX = new Uint8Array([
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
  ]);

  var RCON = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

  function xtime(b) { return ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff; }

  function aesKeySchedule(key) {
    var w = new Uint32Array(44);
    for (var i = 0; i < 4; i++) {
      w[i] = ((key[i*4]<<24)|(key[i*4+1]<<16)|(key[i*4+2]<<8)|key[i*4+3]) >>> 0;
    }
    for (var j = 4; j < 44; j++) {
      var temp = w[j-1];
      if (j % 4 === 0) {
        // RotWord then SubWord then XOR RCON
        temp = ((SBOX[(temp>>>16)&0xff]<<24) | (SBOX[(temp>>>8) &0xff]<<16) |
                (SBOX[ temp      &0xff]<<8)  |  SBOX[(temp>>>24)&0xff]) >>> 0;
        temp = (temp ^ (RCON[(j>>>2)-1] << 24)) >>> 0;
      }
      w[j] = (w[j-4] ^ temp) >>> 0;
    }
    return w;
  }

  function aesEncryptBlock(blk, w) {
    // blk: 16-byte Uint8Array (modified in place), w: key schedule
    var s = new Uint8Array(blk), i, c, r, tmp, a0, a1, a2, a3, wrd;

    function addRoundKey(round) {
      for (c = 0; c < 4; c++) {
        wrd = w[round*4+c];
        s[c*4]   ^= (wrd>>>24)&0xff; s[c*4+1] ^= (wrd>>>16)&0xff;
        s[c*4+2] ^= (wrd>>> 8)&0xff; s[c*4+3] ^=  wrd      &0xff;
      }
    }

    addRoundKey(0);

    for (r = 1; r <= 10; r++) {
      // SubBytes
      for (i = 0; i < 16; i++) s[i] = SBOX[s[i]];

      // ShiftRows (row n shifted left by n bytes; state is column-major)
      tmp=s[1];  s[1]=s[5];  s[5]=s[9];  s[9]=s[13]; s[13]=tmp;
      tmp=s[2];  s[2]=s[10]; s[10]=tmp;  tmp=s[6];  s[6]=s[14]; s[14]=tmp;
      tmp=s[15]; s[15]=s[11];s[11]=s[7]; s[7]=s[3]; s[3]=tmp;

      // MixColumns (skip on final round)
      if (r < 10) {
        for (c = 0; c < 4; c++) {
          a0=s[c*4]; a1=s[c*4+1]; a2=s[c*4+2]; a3=s[c*4+3];
          s[c*4]   = xtime(a0) ^ xtime(a1)^a1 ^ a2        ^ a3;
          s[c*4+1] = a0        ^ xtime(a1)    ^ xtime(a2)^a2 ^ a3;
          s[c*4+2] = a0        ^ a1           ^ xtime(a2) ^ xtime(a3)^a3;
          s[c*4+3] = xtime(a0)^a0 ^ a1        ^ a2        ^ xtime(a3);
        }
      }

      addRoundKey(r);
    }

    for (i = 0; i < 16; i++) blk[i] = s[i];
  }

  // AES-128-CTR (encrypt == decrypt — same keystream XOR)
  function aesCtr(key, iv, data) {
    var w   = aesKeySchedule(key);
    var out = new Uint8Array(data.length);
    var ctr = new Uint8Array(16);
    var blk = new Uint8Array(16);
    var i, j, offset = 0;
    ctr.set(iv);
    while (offset < data.length) {
      blk.set(ctr);
      aesEncryptBlock(blk, w);
      var chunk = Math.min(16, data.length - offset);
      for (j = 0; j < chunk; j++) out[offset + j] = data[offset + j] ^ blk[j];
      offset += 16;
      // Increment counter big-endian (last 4 bytes sufficient for <4GB)
      for (i = 15; i >= 12; i--) {
        ctr[i] = (ctr[i] + 1) & 0xff;
        if (ctr[i] !== 0) break;
      }
    }
    return out;
  }

  // ── randomBytes ──────────────────────────────────────────────────────────────

  function randomBytes(n) {
    var buf = new Uint8Array(n);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(buf);
    } else {
      for (var i = 0; i < n; i++) buf[i] = (Math.random() * 256) | 0;
    }
    return buf;
  }

  // ── Exports ───────────────────────────────────────────────────────────────────

  global.WPCrypto = {
    sha256:        sha256,
    hmacSha256:    hmacSha256,
    aesCtrEncrypt: aesCtr,
    aesCtrDecrypt: aesCtr,
    randomBytes:   randomBytes,
  };

}(window));
