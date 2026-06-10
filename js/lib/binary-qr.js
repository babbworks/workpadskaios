// binary-qr.js — CT-1 binary packet + bq1/ URL bridge (lab + receive)
// Exposes: window.WPBinaryQr

(function(global) {
  'use strict';

  var MAGIC = [0x57, 0x50, 0x51, 0x31]; // WPQ1
  var VERSION = 1;
  var TAG = { '1pa/': 0, '1pv/': 1, '1pb/': 2, '1pf/': 3, '1dt/': 4 };
  var TAG_REV = ['1pa/', '1pv/', '1pb/', '1pf/', '1dt/'];
  var BQ1_PREFIX = 'bq1/';

  function utf8Encode(s) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(s);
    }
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return new Uint8Array(out);
  }

  function toB64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = (typeof btoa !== 'undefined') ? btoa(bin) : '';
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromB64url(str) {
    var padded = str.replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4) padded += '=';
    var bin = atob(padded);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function packFromHash(hashBody) {
    hashBody = hashBody || '';
    var prefix = hashBody.slice(0, 4);
    var tagId = TAG[prefix];
    if (tagId == null) return null;
    var payload = utf8Encode(hashBody.slice(4));
    var out = new Uint8Array(4 + 1 + 1 + 2 + payload.length);
    var p = 0;
    out[p++] = MAGIC[0];
    out[p++] = MAGIC[1];
    out[p++] = MAGIC[2];
    out[p++] = MAGIC[3];
    out[p++] = VERSION;
    out[p++] = tagId;
    out[p++] = payload.length & 0xff;
    out[p++] = (payload.length >> 8) & 0xff;
    out.set(payload, p);
    return out;
  }

  function unpackToHash(bytes) {
    if (!bytes || bytes.length < 8) return null;
    if (bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1] ||
        bytes[2] !== MAGIC[2] || bytes[3] !== MAGIC[3]) {
      return null;
    }
    if (bytes[4] !== VERSION) return null;
    var tagId = bytes[5];
    var len = bytes[6] | (bytes[7] << 8);
    if (bytes.length < 8 + len) return null;
    var prefix = TAG_REV[tagId];
    if (!prefix) return null;
    var body = '';
    var i;
    for (i = 0; i < len; i++) body += String.fromCharCode(bytes[8 + i]);
    return prefix + body;
  }

  function encodeBq1Hash(hashBody) {
    var packet = packFromHash(hashBody);
    if (!packet) return null;
    return BQ1_PREFIX + toB64url(packet);
  }

  function decodeBq1Hash(hash) {
    if (!hash || hash.indexOf(BQ1_PREFIX) !== 0) return null;
    var b64 = hash.slice(BQ1_PREFIX.length);
    return unpackToHash(fromB64url(b64));
  }

  function isBq1Hash(hash) {
    return !!(hash && hash.indexOf(BQ1_PREFIX) === 0);
  }

  function isBinaryPacket(bytes) {
    return bytes && bytes.length >= 4 &&
      bytes[0] === MAGIC[0] && bytes[1] === MAGIC[1] &&
      bytes[2] === MAGIC[2] && bytes[3] === MAGIC[3];
  }

  global.WPBinaryQr = {
    MAGIC: MAGIC,
    BQ1_PREFIX: BQ1_PREFIX,
    packFromHash: packFromHash,
    unpackToHash: unpackToHash,
    encodeBq1Hash: encodeBq1Hash,
    decodeBq1Hash: decodeBq1Hash,
    isBq1Hash: isBq1Hash,
    isBinaryPacket: isBinaryPacket,
  };

}(typeof window !== 'undefined' ? window : global));
