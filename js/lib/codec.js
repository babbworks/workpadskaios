// WPCodec — workpadskaios codec, codebook-c-kaios
// 1eg/ = codebook-c-kaios: template 0x02, 24-bit flags — CURRENT encode target
// Legacy decode: 1ag/, 1bg/, 1cg/, 1dg/ (template 0x01, 16-bit flags) + alg=bitpad-v1
//
// Wire format (1eg/):
//   [0x02][flagsHigh][flagsMid][flagsLow]
//   bits 0–11:  PADS scalar fields (identical layout to dotme codebook-c/d)
//   bit 12:     FIN block (financial data — optional)
//   bits 13–15: reserved, skipped
//   bits 16–23: extended fields (record_subtype, template_locale, chain_ref,
//               participants, geo, service_ref, expiry, verification)
//
// Depends on: fflate UMD (window.fflate must be present before this file).
// Exposes: window.WPCodec = { encode, decode, validate }

(function(global) {
  'use strict';

  var URL_PREFIX = 'workpads.me/p#';

  // ── base64url ─────────────────────────────────────────────────────────────────

  function toBase64Url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function fromBase64Url(str) {
    var padded = str + '=='.slice(0, (4 - str.length % 4) % 4);
    var bin = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ── UTF-8 helpers ─────────────────────────────────────────────────────────────

  function toUtf8(str)   { return new TextEncoder().encode(str); }
  function fromUtf8(buf) { return new TextDecoder().decode(buf); }

  // ── Date encoding ─────────────────────────────────────────────────────────────
  // uint16 days since 2020-01-01. Range 2020 → ~2199. 2 bytes vs 10 bytes for ISO.

  var DATE_EPOCH_MS = Date.UTC(2020, 0, 1);
  var MS_PER_DAY    = 86400000;

  function dateToU16(iso) {
    try {
      var ms   = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
      var days = Math.round((ms - DATE_EPOCH_MS) / MS_PER_DAY);
      return Math.max(0, Math.min(65535, days));
    } catch (e) { return 0; }
  }

  function u16ToDate(days) {
    var ms  = DATE_EPOCH_MS + days * MS_PER_DAY;
    var d   = new Date(ms);
    var y   = d.getUTCFullYear();
    var mo  = ('0' + (d.getUTCMonth() + 1)).slice(-2);
    var dy  = ('0' + d.getUTCDate()).slice(-2);
    return y + '-' + mo + '-' + dy;
  }

  // ── Amount encoding ───────────────────────────────────────────────────────────
  // uint32 minor-currency units (cents/pence). Max ~42,949,672.95 units.

  function amountToU32(s) {
    var n = parseFloat(s);
    if (!s || isNaN(n)) return 0;
    return (n * 100 + 0.5) | 0;
  }

  function u32ToAmount(u) {
    if (!u) return '0';
    var cents = u % 100;
    var units = (u - cents) / 100;
    if (!cents) return String(units);
    return units + '.' + (cents < 10 ? '0' : '') + cents;
  }

  // ── Frame constants ───────────────────────────────────────────────────────────

  var TEMPLATE_KAIOS   = 0x02;
  var TEMPLATE_LEGACY  = 0x01;
  var ACTIONS_BIT      = 9;
  var FIN_BIT          = 12;
  var SUBTYPE_BIT      = 16;
  var LOCALE_BIT       = 17;
  var CHAIN_BIT        = 18;
  var PARTS_BIT        = 19;
  var GEO_BIT          = 20;
  var SERVICE_BIT      = 21;
  var EXPIRY_BIT       = 22;
  var VERIFY_BIT       = 23;
  var MAX_ACTIONS      = 20;

  // ── PADS scalar fields (bits 0–11, excluding date at bit 2) ──────────────────

  var SCALAR_FIELDS = [
    { id: 'job',            bit: 0  },
    { id: 'customer',       bit: 1  },
    // bit 2 = date (uint16, handled separately)
    { id: 'location',       bit: 3  },
    { id: 'meeting_time',   bit: 4  },
    { id: 'start_time',     bit: 5  },
    { id: 'end_time',       bit: 6  },
    { id: 'customer_phone', bit: 7  },
    { id: 'worker',         bit: 8  },
    // bit 9  = ACTIONS_BIT
    { id: 'details',        bit: 10 },
    { id: 'story',          bit: 11 },
    // bit 12 = FIN_BIT; bits 13-15 reserved; bits 16-23 extended
  ];

  // ── Financial block enums ─────────────────────────────────────────────────────

  var RECORD_TYPES  = ['quote', 'invoice', 'expense', 'payment'];
  var CURRENCIES    = ['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'NZD', 'ZAR'];
  var VAT_RATES     = ['0', '5', '7.5', '10', '12.5', '15', '20', '23', '25'];
  var BILLING_TYPES = ['billable', 'non-billable', 'absorbed', 'cogs'];

  // ── Binary write/read helpers ─────────────────────────────────────────────────

  function writeU16(buf, offset, val) {
    buf[offset]     = (val >>> 8) & 0xff;
    buf[offset + 1] = val         & 0xff;
  }

  function readU16(buf, offset) {
    return ((buf[offset] & 0xff) << 8) | (buf[offset + 1] & 0xff);
  }

  function writeU24(buf, offset, val) {
    buf[offset]     = (val >>> 16) & 0xff;
    buf[offset + 1] = (val >>> 8)  & 0xff;
    buf[offset + 2] = val          & 0xff;
  }

  function readU24(buf, offset) {
    return ((buf[offset] & 0xff) << 16) |
           ((buf[offset + 1] & 0xff) << 8) |
            (buf[offset + 2] & 0xff);
  }

  function writeU32(buf, offset, val) {
    buf[offset]     = (val >>> 24) & 0xff;
    buf[offset + 1] = (val >>> 16) & 0xff;
    buf[offset + 2] = (val >>> 8)  & 0xff;
    buf[offset + 3] = val          & 0xff;
  }

  function readU32(buf, offset) {
    return ((buf[offset] & 0xff) * 0x1000000) +
           ((buf[offset + 1] & 0xff) << 16) +
           ((buf[offset + 2] & 0xff) << 8) +
            (buf[offset + 3] & 0xff);
  }

  function enumIdx(arr, val) {
    var i = arr.indexOf(val);
    return i === -1 ? 255 : i;
  }

  // ── kaios codebook-c encoder ──────────────────────────────────────────────────
  // template 0x02, 24-bit flags, scheme tag 1eg/
  // opts: { expenses, payments, chainRef, recordSubtype, templateLocale,
  //         participants, geo, serviceRef, expiry, verification }

  function padsEncodeKaios(record, opts) {
    opts = opts || {};
    var expenses     = opts.expenses      || [];
    var payments     = opts.payments      || [];
    var chainRef     = opts.chainRef      || null;
    var subtype      = opts.recordSubtype ? String(opts.recordSubtype)  : null;
    var locale       = opts.templateLocale ? String(opts.templateLocale) : null;
    var geo          = opts.geo           ? String(opts.geo)            : null;
    var serviceRef   = opts.serviceRef    ? String(opts.serviceRef)     : null;
    var expiry       = (opts.expiry != null)       ? opts.expiry       : null;
    var verify       = (opts.verification != null)  ? opts.verification : null;
    var participants = opts.participants  || [];

    var flags = 0;
    var scalarBytes = {};
    var fi, sf, val, b;

    // Date (bit 2) — uint16
    var dateU16 = null;
    if (record.date && record.date !== '') {
      dateU16 = dateToU16(record.date);
      flags |= (1 << 2);
    }

    // Scalar fields (all except date at bit 2)
    for (fi = 0; fi < SCALAR_FIELDS.length; fi++) {
      sf = SCALAR_FIELDS[fi];
      val = record[sf.id];
      if (val != null && val !== '') {
        b = toUtf8(String(val));
        scalarBytes[sf.id] = b;
        flags |= (1 << sf.bit);
      }
    }

    // Actions (bit 9)
    var actionItems = Array.isArray(record.actions) ? record.actions.slice(0, MAX_ACTIONS) : [];
    if (actionItems.length) flags |= (1 << ACTIONS_BIT);
    var actData = [];
    for (var ai = 0; ai < actionItems.length; ai++) {
      var at = toUtf8(actionItems[ai].title || '');
      var aN = (actionItems[ai].notes || '').trim();
      actData.push({ title: at, notes: aN ? toUtf8(aN) : null });
    }

    // FIN block (bit 12)
    var withFin = !!(
      (record.record_type && record.record_type !== 'job') ||
      record.currency || record.vat ||
      (record.amount != null && record.amount !== '') ||
      expenses.length || payments.length
    );
    if (withFin) flags |= (1 << FIN_BIT);

    var finFlagsByte = 0;
    var rtIdx = -1, curIdx = -1, vatIdx = -1;
    var curCustom = null, vatCustom = null, amtU32 = 0;
    var expItems = [], payItems = [];

    if (withFin) {
      if (record.record_type && record.record_type !== 'job') {
        rtIdx = RECORD_TYPES.indexOf(record.record_type);
        if (rtIdx !== -1) finFlagsByte |= 0x01;
      }
      if (record.currency) {
        finFlagsByte |= 0x02;
        curIdx = enumIdx(CURRENCIES, record.currency);
        if (curIdx === 255) curCustom = toUtf8(String(record.currency));
      }
      if (record.vat != null && record.vat !== '') {
        finFlagsByte |= 0x04;
        vatIdx = enumIdx(VAT_RATES, String(record.vat));
        if (vatIdx === 255) vatCustom = toUtf8(String(record.vat));
      }
      if (record.amount != null && record.amount !== '') {
        finFlagsByte |= 0x08;
        amtU32 = amountToU32(String(record.amount));
      }
      for (var ei = 0; ei < expenses.length; ei++) {
        var e = expenses[ei];
        var eflags = 0;
        var ejob = null, edate = null, ebilling = -1, eaidx = -1;
        if (e.job)  { eflags |= 0x01; ejob  = toUtf8(String(e.job)); }
        if (e.date) { eflags |= 0x02; edate = toUtf8(String(e.date)); }
        var bval = e.expense_billing;
        if (bval) { ebilling = BILLING_TYPES.indexOf(bval); if (ebilling !== -1) eflags |= 0x04; }
        if (e.actionIdx != null && e.actionIdx >= 0 && e.actionIdx <= 19) { eflags |= 0x08; eaidx = e.actionIdx; }
        if (e.is_viewer) eflags |= 0x10;
        expItems.push({ flags: eflags, amt: amountToU32(e.amount || '0'), job: ejob, date: edate, billing: ebilling, aidx: eaidx });
      }
      if (expItems.length) finFlagsByte |= 0x10;
      for (var pi = 0; pi < payments.length; pi++) {
        var p = payments[pi];
        var pflags = 0;
        var pjob = null, pdate = null;
        if (p.job)  { pflags |= 0x01; pjob  = toUtf8(String(p.job)); }
        if (p.date) { pflags |= 0x02; pdate = toUtf8(String(p.date)); }
        payItems.push({ flags: pflags, amt: amountToU32(p.amount || '0'), job: pjob, date: pdate });
      }
      if (payItems.length) finFlagsByte |= 0x20;
    }

    // Extended fields (bits 16–23)
    var subtypeBytes = null, localeBytes = null, chainBuf = null;
    var geoBytes = null, serviceBytes = null;
    var expiryU16 = 0, verifyByte = 0;
    var partItems = [];

    if (subtype)  { subtypeBytes  = toUtf8(subtype);  flags |= (1 << SUBTYPE_BIT); }
    if (locale)   { localeBytes   = toUtf8(locale);   flags |= (1 << LOCALE_BIT); }
    if (chainRef) {
      try {
        var cb = fromBase64Url(chainRef);
        if (cb.length >= 3) { chainBuf = cb.subarray(0, 3); flags |= (1 << CHAIN_BIT); }
      } catch (e) {}
    }
    if (participants.length) {
      flags |= (1 << PARTS_BIT);
      for (var pti = 0; pti < participants.length; pti++) {
        partItems.push({ name: toUtf8(participants[pti].name || ''), role: toUtf8(participants[pti].role || '') });
      }
    }
    if (geo)        { geoBytes      = toUtf8(geo);       flags |= (1 << GEO_BIT); }
    if (serviceRef) { serviceBytes  = toUtf8(serviceRef); flags |= (1 << SERVICE_BIT); }
    if (expiry != null) { expiryU16 = expiry;   flags |= (1 << EXPIRY_BIT); }
    if (verify != null) { verifyByte = verify;  flags |= (1 << VERIFY_BIT); }

    // ── size pass ────────────────────────────────────────────────────────────────

    var size = 4; // template (1) + flags (3)
    var si, ssf;

    for (si = 0; si < SCALAR_FIELDS.length; si++) {
      ssf = SCALAR_FIELDS[si];
      if (ssf.bit <= 1 && scalarBytes[ssf.id]) size += 2 + scalarBytes[ssf.id].length;
    }
    if (dateU16 !== null) size += 2;
    for (si = 0; si < SCALAR_FIELDS.length; si++) {
      ssf = SCALAR_FIELDS[si];
      if (ssf.bit >= 3 && ssf.bit < ACTIONS_BIT && scalarBytes[ssf.id]) size += 2 + scalarBytes[ssf.id].length;
    }
    if (actData.length) {
      size += 1;
      for (var ak = 0; ak < actData.length; ak++) {
        size += 1 + 2 + actData[ak].title.length;
        if (actData[ak].notes) size += 2 + actData[ak].notes.length;
      }
    }
    for (si = 0; si < SCALAR_FIELDS.length; si++) {
      ssf = SCALAR_FIELDS[si];
      if (ssf.bit > ACTIONS_BIT && ssf.bit < FIN_BIT && scalarBytes[ssf.id]) size += 2 + scalarBytes[ssf.id].length;
    }
    if (withFin) {
      size += 1;
      if (finFlagsByte & 0x01) size += 1;
      if (finFlagsByte & 0x02) { size += 1; if (curIdx === 255) size += 2 + curCustom.length; }
      if (finFlagsByte & 0x04) { size += 1; if (vatIdx === 255) size += 2 + vatCustom.length; }
      if (finFlagsByte & 0x08) size += 4;
      if (finFlagsByte & 0x10) {
        size += 1;
        for (var es = 0; es < expItems.length; es++) {
          size += 1 + 4;
          if (expItems[es].flags & 0x01) size += 2 + expItems[es].job.length;
          if (expItems[es].flags & 0x02) size += 2 + expItems[es].date.length;
          if (expItems[es].flags & 0x04) size += 1;
          if (expItems[es].flags & 0x08) size += 1;
        }
      }
      if (finFlagsByte & 0x20) {
        size += 1;
        for (var ps = 0; ps < payItems.length; ps++) {
          size += 1 + 4;
          if (payItems[ps].flags & 0x01) size += 2 + payItems[ps].job.length;
          if (payItems[ps].flags & 0x02) size += 2 + payItems[ps].date.length;
        }
      }
    }
    if (subtypeBytes)     size += 2 + subtypeBytes.length;
    if (localeBytes)      size += 2 + localeBytes.length;
    if (chainBuf)         size += 3;
    if (partItems.length) {
      size += 1;
      for (var pts = 0; pts < partItems.length; pts++) size += 2 + partItems[pts].name.length + 2 + partItems[pts].role.length;
    }
    if (geoBytes)         size += 2 + geoBytes.length;
    if (serviceBytes)     size += 2 + serviceBytes.length;
    if (flags & (1 << EXPIRY_BIT)) size += 2;
    if (flags & (1 << VERIFY_BIT)) size += 1;

    // ── write pass ───────────────────────────────────────────────────────────────

    var buf = new Uint8Array(size);
    var pos = 0;

    buf[pos++] = TEMPLATE_KAIOS;
    writeU24(buf, pos, flags); pos += 3;

    function writeField(bytes) {
      writeU16(buf, pos, bytes.length); pos += 2;
      buf.set(bytes, pos); pos += bytes.length;
    }

    for (si = 0; si < SCALAR_FIELDS.length; si++) {
      ssf = SCALAR_FIELDS[si];
      if (ssf.bit <= 1 && scalarBytes[ssf.id]) writeField(scalarBytes[ssf.id]);
    }
    if (dateU16 !== null) { writeU16(buf, pos, dateU16); pos += 2; }
    for (si = 0; si < SCALAR_FIELDS.length; si++) {
      ssf = SCALAR_FIELDS[si];
      if (ssf.bit >= 3 && ssf.bit < ACTIONS_BIT && scalarBytes[ssf.id]) writeField(scalarBytes[ssf.id]);
    }
    if (actData.length) {
      buf[pos++] = actData.length;
      for (var aw = 0; aw < actData.length; aw++) {
        buf[pos++] = actData[aw].notes ? 0x01 : 0x00;
        writeField(actData[aw].title);
        if (actData[aw].notes) writeField(actData[aw].notes);
      }
    }
    for (si = 0; si < SCALAR_FIELDS.length; si++) {
      ssf = SCALAR_FIELDS[si];
      if (ssf.bit > ACTIONS_BIT && ssf.bit < FIN_BIT && scalarBytes[ssf.id]) writeField(scalarBytes[ssf.id]);
    }
    if (withFin) {
      buf[pos++] = finFlagsByte;
      if (finFlagsByte & 0x01) buf[pos++] = rtIdx;
      if (finFlagsByte & 0x02) { buf[pos++] = curIdx; if (curIdx === 255) writeField(curCustom); }
      if (finFlagsByte & 0x04) { buf[pos++] = vatIdx; if (vatIdx === 255) writeField(vatCustom); }
      if (finFlagsByte & 0x08) { writeU32(buf, pos, amtU32); pos += 4; }
      if (finFlagsByte & 0x10) {
        buf[pos++] = expItems.length;
        for (var ew = 0; ew < expItems.length; ew++) {
          var ed = expItems[ew];
          buf[pos++] = ed.flags;
          writeU32(buf, pos, ed.amt); pos += 4;
          if (ed.flags & 0x01) writeField(ed.job);
          if (ed.flags & 0x02) writeField(ed.date);
          if (ed.flags & 0x04) buf[pos++] = ed.billing;
          if (ed.flags & 0x08) buf[pos++] = ed.aidx;
        }
      }
      if (finFlagsByte & 0x20) {
        buf[pos++] = payItems.length;
        for (var pw = 0; pw < payItems.length; pw++) {
          var pd = payItems[pw];
          buf[pos++] = pd.flags;
          writeU32(buf, pos, pd.amt); pos += 4;
          if (pd.flags & 0x01) writeField(pd.job);
          if (pd.flags & 0x02) writeField(pd.date);
        }
      }
    }
    if (subtypeBytes)     writeField(subtypeBytes);
    if (localeBytes)      writeField(localeBytes);
    if (chainBuf)         { buf.set(chainBuf, pos); pos += 3; }
    if (partItems.length) {
      buf[pos++] = partItems.length;
      for (var ptw = 0; ptw < partItems.length; ptw++) {
        writeField(partItems[ptw].name);
        writeField(partItems[ptw].role);
      }
    }
    if (geoBytes)          writeField(geoBytes);
    if (serviceBytes)      writeField(serviceBytes);
    if (flags & (1 << EXPIRY_BIT)) { writeU16(buf, pos, expiryU16); pos += 2; }
    if (flags & (1 << VERIFY_BIT)) buf[pos++] = verifyByte;

    return buf;
  }

  // ── kaios codebook-c decoder (template 0x02, 24-bit flags) ───────────────────

  function padsDecodeKaios(bytes) {
    if (bytes.length < 4) throw new Error('WPCodec: frame too short');
    var pos = 0;
    var templateId = bytes[pos++];
    if (templateId !== TEMPLATE_KAIOS) throw new Error('WPCodec: expected 0x02, got 0x' + templateId.toString(16));
    var flags = readU24(bytes, pos); pos += 3;
    var record = {};
    var di, df;

    function readField() {
      var len = readU16(bytes, pos); pos += 2;
      var text = fromUtf8(bytes.subarray(pos, pos + len)); pos += len;
      return text;
    }

    for (di = 0; di < SCALAR_FIELDS.length; di++) {
      df = SCALAR_FIELDS[di];
      if (df.bit > 1) break;
      if (flags & (1 << df.bit)) record[df.id] = readField();
    }
    if (flags & (1 << 2)) { record.date = u16ToDate(readU16(bytes, pos)); pos += 2; }
    for (di = 0; di < SCALAR_FIELDS.length; di++) {
      df = SCALAR_FIELDS[di];
      if (df.bit < 3 || df.bit >= ACTIONS_BIT) continue;
      if (flags & (1 << df.bit)) record[df.id] = readField();
    }
    if (flags & (1 << ACTIONS_BIT)) {
      var ac = bytes[pos++];
      var actions = [];
      for (var ak = 0; ak < ac; ak++) {
        var afl = bytes[pos++];
        var ttl = readField();
        var nts = (afl & 0x01) ? readField() : '';
        actions.push({ title: ttl, notes: nts });
      }
      record.actions = actions;
    }
    for (di = 0; di < SCALAR_FIELDS.length; di++) {
      df = SCALAR_FIELDS[di];
      if (df.bit > ACTIONS_BIT && df.bit < FIN_BIT && (flags & (1 << df.bit))) record[df.id] = readField();
    }
    if (flags & (1 << FIN_BIT)) {
      var finFlags = bytes[pos++];
      record.record_type = 'job';
      if (finFlags & 0x01) { var ri = bytes[pos++]; record.record_type = RECORD_TYPES[ri] || 'job'; }
      if (finFlags & 0x02) { var ci = bytes[pos++]; record.currency = ci === 255 ? readField() : (CURRENCIES[ci] || ''); }
      if (finFlags & 0x04) { var vi = bytes[pos++]; record.vat = vi === 255 ? readField() : (VAT_RATES[vi] || ''); }
      if (finFlags & 0x08) { record.amount = u32ToAmount(readU32(bytes, pos)); pos += 4; }
      if (finFlags & 0x10) {
        var ec = bytes[pos++];
        var exps = [];
        for (var ei = 0; ei < ec; ei++) {
          var efl = bytes[pos++];
          var exp = { amount: u32ToAmount(readU32(bytes, pos)) }; pos += 4;
          if (efl & 0x01) exp.job             = readField();
          if (efl & 0x02) exp.date            = readField();
          if (efl & 0x04) exp.expense_billing = BILLING_TYPES[bytes[pos++]] || 'billable';
          if (efl & 0x08) exp.actionIdx       = bytes[pos++];
          if (efl & 0x10) exp.is_viewer        = true;
          exps.push(exp);
        }
        record._expenses = exps;
      }
      if (finFlags & 0x20) {
        var pc = bytes[pos++];
        var pays = [];
        for (var pdi = 0; pdi < pc; pdi++) {
          var pfl = bytes[pos++];
          var pay = { amount: u32ToAmount(readU32(bytes, pos)) }; pos += 4;
          if (pfl & 0x01) pay.job  = readField();
          if (pfl & 0x02) pay.date = readField();
          pays.push(pay);
        }
        record._payments = pays;
      }
    }
    // bits 13–15 reserved — skip
    if (flags & (1 << SUBTYPE_BIT)) record.record_subtype  = readField();
    if (flags & (1 << LOCALE_BIT))  record.template_locale = readField();
    if (flags & (1 << CHAIN_BIT))   { record._chainRef = toBase64Url(bytes.subarray(pos, pos + 3)); pos += 3; }
    if (flags & (1 << PARTS_BIT)) {
      var ptc = bytes[pos++];
      var parts = [];
      for (var pti = 0; pti < ptc; pti++) parts.push({ name: readField(), role: readField() });
      record._participants = parts;
    }
    if (flags & (1 << GEO_BIT))     record.geo          = readField();
    if (flags & (1 << SERVICE_BIT)) record.service_ref   = readField();
    if (flags & (1 << EXPIRY_BIT))  { record.expiry       = readU16(bytes, pos); pos += 2; }
    if (flags & (1 << VERIFY_BIT))  record.verification  = bytes[pos++];

    return record;
  }

  // ── legacy decoder (template 0x01, 16-bit flags) ─────────────────────────────
  // Handles 1ag/, 1bg/ (UTF-8 date + amounts) and 1cg/, 1dg/ (binary date + amounts).
  // Also handles alg=bitpad-v1 (old kaios v0.1 — same as 1ag/1bg frame).

  function padsDecodeLegacy(bytes, useBinary) {
    if (bytes.length < 3) throw new Error('WPCodec: frame too short');
    var pos = 0;
    var templateId = bytes[pos++];
    if (templateId !== TEMPLATE_LEGACY) throw new Error('WPCodec: expected 0x01, got 0x' + templateId.toString(16));
    var flags = readU16(bytes, pos); pos += 2;
    var record = {};

    function readField() {
      var len = readU16(bytes, pos); pos += 2;
      var text = fromUtf8(bytes.subarray(pos, pos + len)); pos += len;
      return text;
    }

    if (flags & 0x01) record.job      = readField();
    if (flags & 0x02) record.customer = readField();
    if (flags & (1 << 2)) {
      if (useBinary) { record.date = u16ToDate(readU16(bytes, pos)); pos += 2; }
      else           { record.date = readField(); }
    }

    var legBits38 = [
      { id: 'location',       bit: 3 }, { id: 'meeting_time',   bit: 4 },
      { id: 'start_time',     bit: 5 }, { id: 'end_time',       bit: 6 },
      { id: 'customer_phone', bit: 7 }, { id: 'worker',         bit: 8 }
    ];
    for (var li = 0; li < legBits38.length; li++) {
      if (flags & (1 << legBits38[li].bit)) record[legBits38[li].id] = readField();
    }

    if (flags & (1 << ACTIONS_BIT)) {
      var ac = bytes[pos++];
      var actions = [];
      for (var ak = 0; ak < ac; ak++) {
        if (useBinary) {
          var afl = bytes[pos++];
          var ttl = readField();
          var nts = (afl & 0x01) ? readField() : '';
          actions.push({ title: ttl, notes: nts });
        } else {
          actions.push({ title: readField(), notes: readField() });
        }
      }
      record.actions = actions;
    }
    if (flags & (1 << 10)) record.details = readField();
    if (flags & (1 << 11)) record.story   = readField();
    if (flags & (1 << FIN_BIT)) {
      var finFlags = bytes[pos++];
      record.record_type = 'job';
      if (finFlags & 0x01) { var ri = bytes[pos++]; record.record_type = RECORD_TYPES[ri] || 'job'; }
      if (finFlags & 0x02) { var ci = bytes[pos++]; record.currency = ci === 255 ? readField() : (CURRENCIES[ci] || ''); }
      if (finFlags & 0x04) { var vi = bytes[pos++]; record.vat = vi === 255 ? readField() : (VAT_RATES[vi] || ''); }
      if (finFlags & 0x08) {
        if (useBinary) { record.amount = u32ToAmount(readU32(bytes, pos)); pos += 4; }
        else           { record.amount = readField(); }
      }
      if (finFlags & 0x10) {
        var ec = bytes[pos++];
        var exps = [];
        for (var ei = 0; ei < ec; ei++) {
          var efl = bytes[pos++];
          var exp = {};
          if (useBinary) { exp.amount = u32ToAmount(readU32(bytes, pos)); pos += 4; }
          else           { exp.amount = readField(); }
          if (efl & 0x01) exp.job             = readField();
          if (efl & 0x02) exp.date            = readField();
          if (efl & 0x04) exp.expense_billing = BILLING_TYPES[bytes[pos++]] || 'billable';
          if (efl & 0x08) exp.actionIdx       = bytes[pos++];
          if (efl & 0x10) exp.is_viewer        = true;
          exps.push(exp);
        }
        record._expenses = exps;
      }
      if (finFlags & 0x20) {
        var pc = bytes[pos++];
        var pays = [];
        for (var pdi = 0; pdi < pc; pdi++) {
          var pfl = bytes[pos++];
          var pay = {};
          if (useBinary) { pay.amount = u32ToAmount(readU32(bytes, pos)); pos += 4; }
          else           { pay.amount = readField(); }
          if (pfl & 0x01) pay.job  = readField();
          if (pfl & 0x02) pay.date = readField();
          pays.push(pay);
        }
        record._payments = pays;
      }
    }
    if (useBinary && (flags & (1 << 13))) {
      record._chainRef = toBase64Url(bytes.subarray(pos, pos + 3));
      pos += 3;
    }
    return record;
  }

  // ── public encode ─────────────────────────────────────────────────────────────

  function encode(record, opts) {
    var frame      = padsEncodeKaios(record, opts);
    var compressed = global.fflate.deflateSync(frame, { level: 9 });
    return URL_PREFIX + '1eg/' + toBase64Url(compressed);
  }

  // ── public decode ─────────────────────────────────────────────────────────────

  function decode(url) {
    var hash = url.indexOf('#') !== -1 ? url.slice(url.indexOf('#') + 1) : url;

    if (/^[0-9][a-z][a-z]\//.test(hash)) {
      var tag     = hash.slice(0, 3);
      var payload = hash.slice(4);
      var frame   = global.fflate.inflateSync(fromBase64Url(payload));

      if (tag === '1eg') return padsDecodeKaios(frame);
      var binary = (tag === '1cg' || tag === '1dg');
      return padsDecodeLegacy(frame, binary);
    }

    // Legacy alg=bitpad-v1 format (kaios v0.1)
    var params = {};
    var segs = hash.split('&');
    for (var i = 0; i < segs.length; i++) {
      var eq = segs[i].indexOf('=');
      if (eq !== -1) params[segs[i].slice(0, eq)] = segs[i].slice(eq + 1);
    }
    if (params.d && params.alg === 'bitpad-v1') {
      var frame2 = global.fflate.inflateSync(fromBase64Url(params.d));
      return padsDecodeLegacy(frame2, false);
    }

    throw new Error('WPCodec.decode: unrecognised URL format');
  }

  // ── validate ──────────────────────────────────────────────────────────────────

  function validate(record) {
    var errors = [];
    if (!record || typeof record !== 'object') return { valid: false, errors: ['record must be an object'] };
    if (!record.job || String(record.job).trim() === '') errors.push('job is required');
    var limits = {
      job: 120, customer: 120, date: 10, location: 160,
      meeting_time: 40, start_time: 40, end_time: 40,
      customer_phone: 40, worker: 80, details: 500, story: 2000
    };
    var fields = ['job', 'customer', 'date', 'location', 'meeting_time', 'start_time',
                  'end_time', 'customer_phone', 'worker', 'details', 'story'];
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (record[field] != null) {
        var len = toUtf8(String(record[field])).length;
        if (len > limits[field]) errors.push(field + ' exceeds ' + limits[field] + ' bytes');
      }
    }
    if (record.actions != null) {
      if (!Array.isArray(record.actions)) errors.push('actions must be an array');
      else if (record.actions.length > MAX_ACTIONS) errors.push('actions exceeds ' + MAX_ACTIONS + ' items');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  global.WPCodec = { encode: encode, decode: decode, validate: validate };

}(window));
