// WPCodec — browser-compatible workpads codec (bitpad-v1 + fflate)
// Adapted from @workpads/codec for browser/KaiOS (no require/module.exports).
// Depends on: fflate UMD loaded before this file (window.fflate must be present).
// Exposes: window.WPCodec = { encode, decode, validate }

(function(global) {
  'use strict';

  var URL_PREFIX = 'workpads.me/p#';

  // ── base64url ───────────────────────────────────────────────────────────────

  function toBase64Url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function fromBase64Url(str) {
    var padded = str + '=='.slice(0, (4 - (str.length % 4)) % 4);
    var bin = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ── UTF-8 helpers ───────────────────────────────────────────────────────────

  function toUtf8(str) {
    return new TextEncoder().encode(str);
  }

  function fromUtf8(bytes) {
    return new TextDecoder().decode(bytes);
  }

  // ── bitpad-v1 binary frame ──────────────────────────────────────────────────

  var TEMPLATE_SVC_BASIC_V2 = 0x01;
  var ACTIONS_BIT = 9;
  var MAX_ACTIONS = 20;

  var SCALAR_FIELDS = [
    { id: 'job',            bit: 0  },
    { id: 'customer',       bit: 1  },
    { id: 'date',           bit: 2  },
    { id: 'location',       bit: 3  },
    { id: 'meeting_time',   bit: 4  },
    { id: 'start_time',     bit: 5  },
    { id: 'end_time',       bit: 6  },
    { id: 'customer_phone', bit: 7  },
    { id: 'worker',         bit: 8  },
    { id: 'details',        bit: 10 },
    { id: 'story',          bit: 11 },
  ];

  function writeU16(buf, offset, value) {
    buf[offset]     = (value >>> 8) & 0xff;
    buf[offset + 1] = value & 0xff;
  }

  function readU16(buf, offset) {
    return ((buf[offset] & 0xff) << 8) | (buf[offset + 1] & 0xff);
  }

  function bitpadEncode(record) {
    var flags = 0;
    var scalarBytes = {};

    for (var i = 0; i < SCALAR_FIELDS.length; i++) {
      var f = SCALAR_FIELDS[i];
      var val = record[f.id];
      if (val !== null && val !== undefined) {
        var bytes = toUtf8(String(val));
        scalarBytes[f.id] = bytes;
        flags |= (1 << f.bit);
      }
    }

    var actionItems = [];
    if (Array.isArray(record.actions)) {
      flags |= (1 << ACTIONS_BIT);
      actionItems = record.actions.slice(0, MAX_ACTIONS);
    }

    var actionBytes = actionItems.map(function(a) {
      return {
        title: toUtf8(a && a.title ? String(a.title) : ''),
        notes: toUtf8(a && a.notes ? String(a.notes) : ''),
      };
    });

    var size = 3;
    for (var j = 0; j < SCALAR_FIELDS.length; j++) {
      if (scalarBytes[SCALAR_FIELDS[j].id]) {
        size += 2 + scalarBytes[SCALAR_FIELDS[j].id].length;
      }
    }
    if (flags & (1 << ACTIONS_BIT)) {
      size += 1;
      for (var k = 0; k < actionBytes.length; k++) {
        size += 2 + actionBytes[k].title.length + 2 + actionBytes[k].notes.length;
      }
    }

    var buf = new Uint8Array(size);
    var pos = 0;
    buf[pos++] = TEMPLATE_SVC_BASIC_V2;
    writeU16(buf, pos, flags); pos += 2;

    for (var m = 0; m < SCALAR_FIELDS.length; m++) {
      var sf = SCALAR_FIELDS[m];
      if (sf.bit < ACTIONS_BIT && scalarBytes[sf.id]) {
        var sb = scalarBytes[sf.id];
        writeU16(buf, pos, sb.length); pos += 2;
        buf.set(sb, pos); pos += sb.length;
      }
    }

    if (flags & (1 << ACTIONS_BIT)) {
      buf[pos++] = actionItems.length;
      for (var n = 0; n < actionBytes.length; n++) {
        var ab = actionBytes[n];
        writeU16(buf, pos, ab.title.length); pos += 2;
        buf.set(ab.title, pos); pos += ab.title.length;
        writeU16(buf, pos, ab.notes.length); pos += 2;
        buf.set(ab.notes, pos); pos += ab.notes.length;
      }
    }

    for (var p = 0; p < SCALAR_FIELDS.length; p++) {
      var sf2 = SCALAR_FIELDS[p];
      if (sf2.bit > ACTIONS_BIT && scalarBytes[sf2.id]) {
        var sb2 = scalarBytes[sf2.id];
        writeU16(buf, pos, sb2.length); pos += 2;
        buf.set(sb2, pos); pos += sb2.length;
      }
    }

    return buf;
  }

  function bitpadDecode(bytes) {
    if (bytes.length < 3) throw new Error('WPCodec: frame too short');
    var pos = 0;
    var templateId = bytes[pos++];
    if (templateId !== TEMPLATE_SVC_BASIC_V2) {
      throw new Error('WPCodec: unknown template 0x' + templateId.toString(16));
    }
    var flags = readU16(bytes, pos); pos += 2;
    var record = {};

    function readScalar() {
      var len = readU16(bytes, pos); pos += 2;
      var text = fromUtf8(bytes.subarray(pos, pos + len)); pos += len;
      return text;
    }

    for (var i = 0; i < SCALAR_FIELDS.length; i++) {
      var f = SCALAR_FIELDS[i];
      if (f.bit < ACTIONS_BIT && (flags & (1 << f.bit))) {
        record[f.id] = readScalar();
      }
    }

    if (flags & (1 << ACTIONS_BIT)) {
      var count = bytes[pos++];
      var actions = [];
      for (var k = 0; k < count; k++) {
        var titleLen = readU16(bytes, pos); pos += 2;
        var title = fromUtf8(bytes.subarray(pos, pos + titleLen)); pos += titleLen;
        var notesLen = readU16(bytes, pos); pos += 2;
        var notes = fromUtf8(bytes.subarray(pos, pos + notesLen)); pos += notesLen;
        actions.push({ title: title, notes: notes });
      }
      record.actions = actions;
    }

    for (var j = 0; j < SCALAR_FIELDS.length; j++) {
      var sf = SCALAR_FIELDS[j];
      if (sf.bit > ACTIONS_BIT && (flags & (1 << sf.bit))) {
        record[sf.id] = readScalar();
      }
    }

    return record;
  }

  // ── public API ──────────────────────────────────────────────────────────────

  function encode(record) {
    var frame = bitpadEncode(record);
    var compressed = global.fflate.deflateSync(frame, { level: 9 });
    var d = toBase64Url(compressed);
    return URL_PREFIX + 'v=1&alg=bitpad-v1&d=' + d;
  }

  function decode(url) {
    var hash = url.indexOf('#') !== -1 ? url.slice(url.indexOf('#') + 1) : url;
    var params = {};
    hash.split('&').forEach(function(part) {
      var eq = part.indexOf('=');
      if (eq !== -1) params[part.slice(0, eq)] = part.slice(eq + 1);
    });
    if (!params.d) throw new Error('WPCodec.decode: missing d param');
    var compressed = fromBase64Url(params.d);
    var frame = global.fflate.inflateSync(compressed);
    return bitpadDecode(frame);
  }

  function validate(record) {
    var errors = [];
    if (!record || typeof record !== 'object') {
      return { valid: false, errors: ['record must be an object'] };
    }
    if (!record.job || String(record.job).trim() === '') {
      errors.push('job is required');
    }
    var limits = {
      job: 120, customer: 120, date: 10, location: 160,
      meeting_time: 40, start_time: 40, end_time: 40,
      customer_phone: 40, worker: 80, details: 500, story: 2000,
    };
    Object.keys(limits).forEach(function(field) {
      if (record[field] != null) {
        var len = toUtf8(String(record[field])).length;
        if (len > limits[field]) {
          errors.push(field + ' exceeds ' + limits[field] + ' bytes');
        }
      }
    });
    if (record.actions != null) {
      if (!Array.isArray(record.actions)) {
        errors.push('actions must be an array');
      } else if (record.actions.length > 20) {
        errors.push('actions exceeds 20 items');
      }
    }
    return { valid: errors.length === 0, errors: errors };
  }

  global.WPCodec = { encode: encode, decode: decode, validate: validate };

}(window));
