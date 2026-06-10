// RecordService — create, store, list, archive, and share workpad records
// Exposes: window.RecordService (singleton)

(function(global) {
  'use strict';

  // Per-user namespaced storage — migrate legacy flat records on first use
  var _actId = localStorage.getItem('wp_activity_active') || '';
  var _recPfx = _actId ? ('wp_rec_' + _actId + '_') : 'wp_record_';
  var _arcPfx = _actId ? ('wp_arc_' + _actId + '_') : 'wp_archive_';

  if (_actId) {
    // One-time migration from legacy prefixes to per-user namespace
    var _allKeys = [];
    for (var _ki = 0; _ki < localStorage.length; _ki++) _allKeys.push(localStorage.key(_ki));
    var _hasNew = false;
    for (var _ni = 0; _ni < _allKeys.length; _ni++) {
      if (_allKeys[_ni] && _allKeys[_ni].indexOf(_recPfx) === 0) { _hasNew = true; break; }
    }
    if (!_hasNew) {
      _allKeys.forEach(function(k) {
        if (!k) return;
        if (k.indexOf('wp_record_') === 0) {
          localStorage.setItem(_recPfx + k.slice('wp_record_'.length), localStorage.getItem(k));
          localStorage.removeItem(k);
        } else if (k.indexOf('wp_archive_') === 0) {
          localStorage.setItem(_arcPfx + k.slice('wp_archive_'.length), localStorage.getItem(k));
          localStorage.removeItem(k);
        }
      });
    }
  }

  var store   = new StorageAdapter(_recPfx);
  var archive = new StorageAdapter(_arcPfx);

  var _listCache = null;

  function invalidateListCache() {
    _listCache = null;
  }

  function enrichTrig(rec) {
    if (!rec) return rec;
    if (rec.trigDisplay) return rec;
    if (rec.trigViolation || trigBytesFromRecord(rec)) {
      return applyTrigPresentation(merge({}, rec));
    }
    return rec;
  }

  function enrichTrigList(records) {
    var out = [];
    for (var i = 0; i < records.length; i++) out.push(enrichTrig(records[i]));
    return out;
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  // Generate a 3-byte (24-bit) chain reference, base64url-encoded.
  // Used to link related records (quote → invoice → payment).
  function genChainRef() {
    var t  = Date.now();
    var r  = Math.floor(Math.random() * 0xffffff);
    var b0 = (t ^ r)          & 0xff;
    var b1 = ((t >>> 8) ^ r)  & 0xff;
    var b2 = ((t >>> 16) ^ (r >>> 8)) & 0xff;
    var bin = String.fromCharCode(b0, b1, b2);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // Normalise a codec-decoded record for storage.
  // Strips underscore-prefixed keys from the wire decoder and fixes casing.
  function normaliseDecoded(decoded) {
    var rec = {}, key;
    for (key in decoded) {
      if (Object.prototype.hasOwnProperty.call(decoded, key)) rec[key] = decoded[key];
    }
    if (rec._chainRef     !== undefined) { rec.chainRef    = rec._chainRef;    delete rec._chainRef; }
    if (rec._ratifiedFrameRecord) {
      rec.ratifiedFrameRecord = rec._ratifiedFrameRecord;
      delete rec._ratifiedFrameRecord;
    }
    if (rec._expenses     !== undefined) { rec.expenses    = rec._expenses;    delete rec._expenses; }
    if (rec._payments     !== undefined) { rec.payments    = rec._payments;    delete rec._payments; }
    if (rec._participants !== undefined) {
      rec.participants = rec._participants;
      delete rec._participants;
      // Split codec roleSignals bitmask back to individual boolean flags
      for (var pi = 0; pi < rec.participants.length; pi++) {
        var p = rec.participants[pi];
        if (p.roleSignals != null) {
          if (p.roleSignals & 1) p.cert = true;
          if (p.roleSignals & 2) p.auth = true;
          if (p.roleSignals & 4) p.lead = true;
        }
      }
    }
    if (rec._trig) {
      if (rec._trig.bytes) {
        rec.trigBytes = [];
        var tb = rec._trig.bytes;
        for (var ti = 0; ti < tb.length; ti++) rec.trigBytes[ti] = tb[ti];
      }
      if (rec._trig.trig_violation) rec.trigViolation = true;
      delete rec._trig;
    }
    if (rec._displaySchema !== undefined) {
      rec.displaySchema = rec._displaySchema;
      delete rec._displaySchema;
    }
    if (rec._formSchema !== undefined) {
      rec.formSchema = rec._formSchema;
      delete rec._formSchema;
    }
    if (rec.relationship === 'acknowledges' &&
        (rec.confirmed_mask | 0) === 0 && (rec.declined_mask | 0) === 0) {
      rec.informational_ack = true;
    }
    if (rec._decodedGroupLocal && rec._decodedGroupLocal[0] & 2) {
      rec.informational_ack = true;
    }
    return rec;
  }

  function compactDate(iso) {
    if (global.WPCodec && global.WPCodec._dateToDays) {
      try { return global.WPCodec._dateToDays(iso || ''); } catch (_) {}
    }
    return 0;
  }

  function parseCtrigProgram(rec) {
    var raw = rec.ctrigProgram || rec.ctrig_program;
    if (!raw) return null;
    if (raw instanceof Uint8Array) return raw;
    if (Array.isArray(raw)) {
      var arr = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) arr[i] = raw[i] & 0xff;
      return arr;
    }
    if (typeof raw === 'string') {
      raw = raw.replace(/\s/g, '');
      if (!raw.length || (raw.length % 2) !== 0) return null;
      var out = new Uint8Array(raw.length / 2);
      for (var j = 0; j < out.length; j++) out[j] = parseInt(raw.substr(j * 2, 2), 16);
      return out;
    }
    return null;
  }

  function buildCtrigRecordView(rec) {
    return {
      participants: rec.participants || [],
      has_financial_block: parseFloat(rec.amount || 0) > 0,
      date: compactDate(rec.date),
      date_start: compactDate(rec.date),
      date_end: rec.date_end ? compactDate(rec.date_end) : null,
      due_date: rec.due_date ? compactDate(rec.due_date) : null,
      location: rec.location || '',
      meta1: { chain: !!rec.chainRef },
      meta2: { has_trig_block: !!(rec.trigBytes && rec.trigBytes.length) }
    };
  }

  function buildChainState(chainRef, allRecords) {
    var state = {
      ack_count: 0,
      disputed: false,
      ratified: false,
      records: [],
      milestone_states: [],
      financial: { paid: 0, total: 0 }
    };
    if (!chainRef) return state;
    var i, r, amt, tmpl;
    for (i = 0; i < allRecords.length; i++) {
      r = allRecords[i];
      if (r.chainRef !== chainRef) continue;
      if (r.ackConfirmed || (r.record_type || '').toLowerCase() === 'ack') state.ack_count++;
      if (r.disputeFlag || (r.record_type || '').toLowerCase() === 'dispute') state.disputed = true;
      if (r.chainComplete && (r.record_type || '').toLowerCase() === 'state_commit') state.ratified = true;
      amt = parseFloat(r.amount || 0);
      if ((r.record_type || '').toLowerCase() === 'payment') state.financial.paid += amt;
      if (!r.parentId && amt > 0) state.financial.total += amt;
      tmpl = recordTypeToBaseTemplate(r.record_type);
      state.records.push({
        template: tmpl,
        commit_type: r.commitType != null ? r.commitType : null,
        ack_present: !!(r.ackConfirmed || r.ackRequest)
      });
    }
    return state;
  }

  function runCtrigSchedule(triggerRec) {
    if (!global.WPCtrig || !global.App || !global.App.prefillRecord) {
      return Promise.resolve();
    }
    return list().then(function(all) {
      var seen = {};
      var programs = [];
      var chainRef = triggerRec.chainRef;

      function queueProgram(r) {
        var bytes = parseCtrigProgram(r);
        if (!bytes || !bytes.length) return;
        var key = '';
        for (var k = 0; k < bytes.length; k++) key += bytes[k] + ',';
        if (seen[key]) return;
        seen[key] = true;
        programs.push(bytes);
      }

      queueProgram(triggerRec);
      if (chainRef) {
        for (var i = 0; i < all.length; i++) {
          if (all[i].chainRef === chainRef) queueProgram(all[i]);
        }
      }

      if (!programs.length) return;

      var chainCtx = buildChainState(chainRef, all);
      var ts = compactDate(todayIso());
      var ctxBase = {
        chain: chainCtx,
        timestamp: ts,
        app: global.App,
        record: buildCtrigRecordView(triggerRec)
      };
      for (var pi = 0; pi < programs.length; pi++) {
        var ctx = merge({}, ctxBase);
        global.WPCtrig.evaluate(programs[pi], ctx);
      }
    });
  }

  function afterPersist(rec) {
    invalidateListCache();
    runCtrigSchedule(rec).catch(function() {});
    return rec;
  }

  function trigBytesFromRecord(rec) {
    if (!rec) return null;
    if (rec.trigBytes && rec.trigBytes.length) {
      var out = new Uint8Array(rec.trigBytes.length);
      for (var i = 0; i < rec.trigBytes.length; i++) out[i] = rec.trigBytes[i] & 0xff;
      return out;
    }
    return null;
  }

  function buildTrigContext(rec) {
    return {
      hasApp: true,
      isHuman: true,
      knownContact: !!(rec.customer || rec.receivedAt),
      hasSavedRecord: true,
      codeVerified: true,
      appVersionOk: true,
      daylightHours: true,
      hasTemplate: !!(rec.displaySchema),
      replyPending: !!rec.draft
    };
  }

  function applyTrigPresentation(rec) {
    if (!rec || !global.WPTrig) return rec;
    if (rec.trigViolation) {
      rec.trigDisplay = { mode: 5, show: false, trig_violation: true };
      return rec;
    }
    var bytes = trigBytesFromRecord(rec);
    rec.trigDisplay = global.WPTrig.evaluate(bytes || new Uint8Array(0), buildTrigContext(rec));
    return rec;
  }

  // ── Core CRUD ─────────────────────────────────────────────────────────────────

  // Create a new draft record. Stamps locale currency and a fresh chainRef.
  function create(fields) {
    var id       = genId();
    var identity = ActivityService.getSenderIdentity();
    var locale   = ActivityService.getLocale();
    var rec = merge({
      id:        id,
      chainRef:  genChainRef(),
      date:      todayIso(),
      worker:    identity.name  || undefined,
      currency:  locale.currency,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      draft:     true,
    }, fields || {});
    return store.put(id, rec).then(function() { return afterPersist(rec); });
  }

  // Save (upsert) a record by ID. Marks as non-draft.
  function save(id, fields) {
    return store.get(id).then(function(existing) {
      var rec = merge(existing || { id: id }, fields, {
        updatedAt: Date.now(),
        draft: false,
      });
      return store.put(id, rec).then(function() { return afterPersist(rec); });
    });
  }

  // Update fields on an existing record without changing draft status.
  function update(id, fields) {
    return store.get(id).then(function(existing) {
      if (!existing) throw new Error('RecordService: record not found: ' + id);
      var rec = merge(existing, fields, { updatedAt: Date.now() });
      return store.put(id, rec).then(function() { return afterPersist(rec); });
    });
  }

  // Get a single active record by ID.
  function get(id) {
    return store.get(id).then(function(rec) { return enrichTrig(rec); });
  }

  // List all active records, newest first (session cache; invalidate on persist).
  function list() {
    if (_listCache) return Promise.resolve(enrichTrigList(_listCache.slice()));
    return store.list().then(function(pairs) {
      _listCache = pairs
        .map(function(p) { return p.data; })
        .sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      return enrichTrigList(_listCache.slice());
    });
  }

  function invalidateList() {
    invalidateListCache();
  }

  // List active child records (expenses, payments) for a given parent ID.
  function listChildren(parentId) {
    return list().then(function(records) {
      return records.filter(function(r) { return r.parentId === parentId; });
    });
  }

  // Records sharing a chainRef (uses list cache).
  function listByChainRef(chainRef) {
    if (!chainRef) return Promise.resolve([]);
    return list().then(function(records) {
      return records.filter(function(r) { return r.chainRef === chainRef; });
    });
  }

  // chainRef → record[] from an already-loaded list (sync).
  function recordsByChainRef(records) {
    var map = {};
    var i, r, ref;
    for (i = 0; i < records.length; i++) {
      r = records[i];
      ref = r.chainRef;
      if (!ref) continue;
      if (!map[ref]) map[ref] = [];
      map[ref].push(r);
    }
    return map;
  }

  // Index child records by parentId from an already-loaded list (one pass, sync).
  function childrenByParentId(records) {
    var map = {};
    var i, r, pid;
    for (i = 0; i < records.length; i++) {
      r = records[i];
      pid = r.parentId;
      if (!pid) continue;
      if (!map[pid]) map[pid] = [];
      map[pid].push(r);
    }
    return map;
  }

  // ── Archive operations ────────────────────────────────────────────────────────

  // Soft-delete: move record to archive namespace.
  function archiveRecord(id) {
    return store.get(id).then(function(rec) {
      if (!rec) return;
      rec.archivedAt = Date.now();
      return archive.put(id, rec).then(function() {
        invalidateListCache();
        return store.remove(id);
      });
    });
  }

  // Restore: move record from archive back to active namespace.
  function restoreRecord(id) {
    return archive.get(id).then(function(rec) {
      if (!rec) return;
      delete rec.archivedAt;
      rec.updatedAt = Date.now();
      return store.put(id, rec).then(function() {
        invalidateListCache();
        return archive.remove(id).then(function() { return rec; });
      });
    });
  }

  // Permanent delete: remove record from archive entirely.
  function removeRecord(id) {
    return archive.remove(id);
  }

  // Get a specific archived record by ID.
  function getArchived(id) {
    return archive.get(id);
  }

  // List all archived records, most recently archived first.
  function listArchived() {
    return archive.list().then(function(pairs) {
      return pairs
        .map(function(p) { return p.data; })
        .sort(function(a, b) { return (b.archivedAt || 0) - (a.archivedAt || 0); });
    });
  }

  // ── URL encode / decode ───────────────────────────────────────────────────────

  // Map a record's vat field to a codec taxCode integer.
  // 'none'|undefined → 0, 'zero' → 1, 'standard'|numeric → 2
  function vatToTaxCode(vat) {
    if (!vat || vat === 'none' || vat === '0') return 0;
    if (vat === 'zero') return 1;
    return 2; // standard or explicit numeric rate
  }

  // Map a record_type to I>O codec opts.
  // Returns { domain, ioDirection, ioTime, ioEffect } or { domain: 3, apDirection } for AP/AR
  function recordTypeToIoOpts(recType, amount) {
    var hasAmount = amount && parseFloat(amount) > 0;
    var rt = (recType || '').toLowerCase();
    switch (rt) {
      case 'payable':    return { domain: 3, apDirection: 1 }; // AP: money owed out
      case 'receivable': return { domain: 3, apDirection: 0 }; // AR: money owed in
      case 'loan':       return { domain: 3, apDirection: 1 }; // AP/loan
    }
    if (!hasAmount) return { domain: 0 };
    switch (rt) {
      case 'quote':   return { domain: 1, ioDirection: 0, ioTime: 0, ioEffect: 0 }; // I>I future
      case 'invoice': return { domain: 1, ioDirection: 0, ioTime: 0, ioEffect: 1 }; // I>I obligation
      case 'receipt': return { domain: 1, ioDirection: 0, ioTime: 1, ioEffect: 0 }; // I<I settled
      default:        return { domain: 1, ioDirection: 0, ioTime: 0, ioEffect: 0 }; // job w/ amount → I>I
    }
  }

  // Map a record_type to the codec baseTemplate integer.
  // 0=Service, 1=Invoice, 2=Receipt, 3=Contact, 5=State Commit, 6=Amendment
  function recordTypeToBaseTemplate(recType) {
    switch ((recType || '').toLowerCase()) {
      case 'invoice':      return 1;
      case 'receipt':      return 2;
      case 'contact':      return 3;
      case 'state_commit': return 5;
      case 'amendment':
      case 'dispute':      return 6;
      default:             return 0; // Service (job, quote, payable, receivable, etc.)
    }
  }

  var AMENDMENT_DIFF_FIELDS = [
    'job', 'customer', 'date', 'location', 'meeting_time',
    'start_time', 'end_time', 'customer_phone', 'worker',
    'details', 'story', 'actions',
    'service_ref', 'expiry_date', 'attachment',
    'context_label', 'tag', 'qty_unit', 'date_end', 'url',
    'website', 'alt_phone', 'business_hours', 'meeting_location',
    'social_handle', 'category',
  ];

  function fieldToWireStr(val) {
    if (val == null || val === undefined) return '';
    if (Array.isArray(val)) {
      return val.map(function(a) {
        return (a && a.title) ? String(a.title) : String(a);
      }).join('\n');
    }
    return String(val);
  }

  function amendmentFieldChanged(cur, orig, fieldId) {
    return fieldToWireStr(cur[fieldId]) !== fieldToWireStr(orig[fieldId]);
  }

  function parseOriginalSnap(rec) {
    if (!rec._originalSnap) return null;
    try { return JSON.parse(rec._originalSnap); } catch (_) { return null; }
  }

  // P1: amendment payload = only fields that differ from _originalSnap
  function buildAmendmentPayload(rec, orig, wireFields) {
    var payload = {};
    var i, f;
    for (i = 0; i < AMENDMENT_DIFF_FIELDS.length; i++) {
      f = AMENDMENT_DIFF_FIELDS[i];
      if (!amendmentFieldChanged(rec, orig, f)) continue;
      if (rec[f] !== null && rec[f] !== undefined) payload[f] = rec[f];
    }
    for (i = 0; i < wireFields.length; i++) {
      f = wireFields[i];
      if (payload[f] !== undefined) continue;
      if (amendmentFieldChanged(rec, orig, f) && rec[f] !== null && rec[f] !== undefined) {
        payload[f] = rec[f];
      }
    }
    return payload;
  }

  function idToParentUid(id) {
    if (!id || !global.WPCrypto || !global.WPCrypto.sha256) return null;
    try {
      var bytes = new Uint8Array(id.length);
      var i;
      for (i = 0; i < id.length; i++) bytes[i] = id.charCodeAt(i) & 0xff;
      return global.WPCrypto.sha256(bytes).subarray(0, 8);
    } catch (_) { return null; }
  }

  function isAmendmentShare(rec) {
    var rt = (rec.record_type || '').toLowerCase();
    return !!(rec._isAmendment || rt === 'amendment' || rt === 'dispute' || rec.disputeLink);
  }

  function amendmentChangedFieldIds(rec) {
    var orig = parseOriginalSnap(rec);
    if (!orig) return [];
    var ids = [];
    var i, f;
    for (i = 0; i < AMENDMENT_DIFF_FIELDS.length; i++) {
      f = AMENDMENT_DIFF_FIELDS[i];
      if (amendmentFieldChanged(rec, orig, f)) ids.push(f);
    }
    return ids;
  }

  function ratifiedFrameBytesFromRecord(rec) {
    if (!rec || !rec._ratifiedFrame) return null;
    try {
      var bin = atob(rec._ratifiedFrame);
      var out = new Uint8Array(bin.length);
      var i;
      for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
      return out.length ? out : null;
    } catch (_) { return null; }
  }

  // Encode a record to a shareable pads-v1 URL.
  // opts.tag: '1pa' (default plain), '1pb' (billboard), '1ps' (full scramble)
  // opts.passphrase: required when tag='1ps'
  // opts.expenses / opts.payments: override inline sub-records
  function encodeUrl(rec, opts) {
    var isContact = (rec.record_type || '').toLowerCase() === 'contact' ||
                    (rec.record_class || '').toLowerCase() === 'contact';
    var payload = {};
    var wireFields = [
      'job', 'customer', 'date', 'location', 'meeting_time',
      'start_time', 'end_time', 'customer_phone', 'worker',
      'details', 'story', 'actions',
      'service_ref', 'expiry_date', 'attachment',
    ];
    if (isContact) {
      wireFields = wireFields.concat(['website', 'alt_phone', 'business_hours', 'meeting_location']);
    }
    for (var i = 0; i < wireFields.length; i++) {
      var f = wireFields[i];
      if (rec[f] !== null && rec[f] !== undefined) payload[f] = rec[f];
    }
    if (isContact) {
      if (rec.social_handle != null && rec.social_handle !== '') payload.social_handle = rec.social_handle;
      if (rec.category != null) payload.category = rec.category; // u8enum integer
    }

    var origSnap = parseOriginalSnap(rec);
    if (origSnap) {
      payload = buildAmendmentPayload(rec, origSnap, wireFields);
    }

    if (!payload.worker) {
      var senderName = ActivityService.getSenderIdentity().name;
      if (senderName) payload.worker = senderName;
    }

    if (rec.record_type) payload.record_type = rec.record_type;
    if (rec.chain_mode) payload.chain_mode = rec.chain_mode;
    if (rec.relationship) payload.relationship = rec.relationship;
    if (rec.relationship_subtype != null) payload.relationship_subtype = rec.relationship_subtype;
    if (rec.confirmed_mask != null) payload.confirmed_mask = rec.confirmed_mask;
    if (rec.declined_mask != null) payload.declined_mask = rec.declined_mask;
    var rtEnc = (rec.record_type || '').toLowerCase();
    if (rtEnc === 'connection' && global.WPChainExecution && WPChainExecution.isConnectionLightAckShare(rec)) {
      payload.relationship = 'acknowledges';
      payload.confirmed_mask = 0;
      payload.declined_mask = 0;
      if (rec.informational_ack) payload.informational_ack = true;
    }
    if (rec.chainRef) payload.chainRef = rec.chainRef;
    if (rec.disputeLink) payload.disputeLink = rec.disputeLink;
    if (rec._amendedFromId) payload._amendedFromId = rec._amendedFromId;
    if (rec._disputedId) payload._disputedId = rec._disputedId;

    var locale   = ActivityService.getLocale();
    var currency = rec.currency || locale.currency || '';
    var taxCode  = vatToTaxCode(rec.vat);
    var ioOpts   = recordTypeToIoOpts(rec.record_type, rec.amount);

    // Decimal position: 0 for integer currencies, 6 for crypto, 2 default
    var noDecimalCurrencies = ['JPY','KRW','VND','IDR','CLP','PYG','RWF','UGX'];
    var cryptoCurrencies    = ['BTC','ETH','BNB','SOL','XRP','LTC','DOGE'];
    var decimalPos = noDecimalCurrencies.indexOf(currency) !== -1 ? 0
                   : cryptoCurrencies.indexOf(currency) !== -1    ? 6
                   : 2;

    // Currency slot: 0=home, else look up in codec currency table
    // For now use 0 (home) unless explicitly non-home
    var homeCurrency = locale.currency || '';
    var currencySlot = (currency && currency !== homeCurrency) ? 3 : 0; // 3 = extended code

    var encOpts = {
      templateLocale: locale.locale,
      chainRef:       rec.chainRef || null,
      baseTemplate:   recordTypeToBaseTemplate(rec.record_type),
      domain:         ioOpts.domain,
      ioDirection:    ioOpts.ioDirection,
      ioTime:         ioOpts.ioTime,
      ioEffect:       ioOpts.ioEffect,
      ioSubtype:      (rec.io_subtype || 0) & 3,
      taxCode:        taxCode,
      decimalPos:     decimalPos,
      currency:       currencySlot,
      currencyCode:   (currencySlot === 3) ? currency : undefined,
      draft:          !!rec.draft,
      participants:   Array.isArray(rec.participants) ? rec.participants.map(function(p) {
        // Map local field names to codec field names
        var mapped = {};
        var keys = Object.keys(p);
        for (var ki = 0; ki < keys.length; ki++) mapped[keys[ki]] = p[keys[ki]];
        if (mapped.role != null && mapped.roleType == null)            mapped.roleType    = mapped.role;
        if (mapped.role_text != null && mapped.roleText == null)       mapped.roleText    = mapped.role_text;
        if (mapped.trading_name != null && mapped.tradingName == null) mapped.tradingName = mapped.trading_name;
        if (mapped.is_org != null && mapped.isOrg == null)             mapped.isOrg       = !!mapped.is_org;
        // cert/auth/lead boolean flags → roleSignals bitmask (bit0=CERT, bit1=AUTH, bit2=LEAD)
        // Only used by codec when roleType=3 and no roleText
        if (mapped.roleSignals == null) {
          var sig = 0;
          if (mapped.cert) sig |= 1;
          if (mapped.auth) sig |= 2;
          if (mapped.lead) sig |= 4;
          if (sig) mapped.roleSignals = sig;
        }
        return mapped;
      }) : [],
    };

    if (Array.isArray(rec.programmable_rules) && rec.programmable_rules.length) {
      payload.programmable_rules = rec.programmable_rules;
      encOpts.programmableRules = rec.programmable_rules;
    }

    // AP/AR domain=3: pass direction, status, completeness
    if (ioOpts.domain === 3) {
      encOpts.apDirection    = ioOpts.apDirection || 0;
      encOpts.apStatus       = rec.ap_status       != null ? (rec.ap_status       & 1) : 0;
      encOpts.apCompleteness = rec.ap_completeness != null ? (rec.ap_completeness & 1) : 0;
      if (rec.amount) {
        payload.amount = rec.amount;
        encOpts.customerAmount = parseFloat(rec.amount) || 0;
      }
    }

    // State commit template (baseTemplate=5): encode commit metadata
    var isStateCommit = (rec.record_type || '').toLowerCase() === 'state_commit';
    if (isStateCommit) {
      encOpts.scCommitType    = rec.sc_commit_type  != null ? (rec.sc_commit_type & 3) : 0;
      encOpts.scChainComplete = !!rec.chainComplete;
      encOpts.scDisputeFlag   = !!rec.disputeFlag;
      encOpts.scTotalAmount   = parseFloat(rec.amount || 0) || 0;
    }

    // Include amount in payload only when financial block is active (non-AP/AR, non-state_commit)
    if (ioOpts.domain > 0 && ioOpts.domain !== 3 && !isStateCommit && rec.amount) {
      payload.amount = rec.amount;
      encOpts.customerAmount = parseFloat(rec.amount) || 0;
    }

    // Qty × Rate
    if (ioOpts.domain > 0 && rec.qty && rec.rate) {
      encOpts.qtySplit = true;
      encOpts.qty      = parseFloat(rec.qty)  || 0;
      encOpts.rate     = parseFloat(rec.rate) || 0;
    }

    // Compound line items
    if (Array.isArray(rec.compound_lines) && rec.compound_lines.length > 0) {
      encOpts.compoundValue = true;
      encOpts.compoundLines = rec.compound_lines.map(function(ln) {
        var li = {
          name:     ln.name     || '',
          amount:   parseFloat(ln.amount || 0),
          lineType: (ln.lineType != null) ? (ln.lineType & 3) : 0,
          taxMode:  (ln.taxMode  != null) ? (ln.taxMode  & 3) : 0,
        };
        if (ln.qty != null && ln.rate != null) {
          li.qty  = parseFloat(ln.qty);
          li.rate = parseFloat(ln.rate);
        }
        return li;
      });
      if (rec.compound_lines_total_summary) encOpts.hasTotalSummary = true;
      if (rec.compound_lines_subtotals)     encOpts.hasSubtotals    = true;
    }

    // Custom / granular tax rate (stored as % string → convert to permille for codec)
    var taxRatePct = parseFloat(rec.custom_tax_rate || rec.vat || 0);
    if (!isNaN(taxRatePct) && taxRatePct > 0) {
      encOpts.taxRate = Math.round(taxRatePct * 10);
    }

    // Worker (internal) amount
    if (rec.worker_amount && parseFloat(rec.worker_amount) > 0) {
      encOpts.workerAmount = parseFloat(rec.worker_amount);
    }

    encOpts.expenses = (opts && opts.expenses !== undefined) ? opts.expenses : (rec.expenses || []);
    encOpts.payments = (opts && opts.payments !== undefined) ? opts.payments : (rec.payments || []);

    // display_schema / form_schema (presentation opts — explicit opts override record)
    if (opts && opts.displaySchema) encOpts.displaySchema = opts.displaySchema;
    else if (rec.displaySchema)     encOpts.displaySchema = rec.displaySchema;
    if (opts && opts.formSchema)    encOpts.formSchema    = opts.formSchema;
    else if (rec.formSchema)        encOpts.formSchema    = rec.formSchema;

    // Routing meta flags — from record fields or explicit opts override
    if (rec.ackRequest      || (opts && opts.ackRequest))      encOpts.ackRequest      = true;
    if (global.WPChainExecution && WPChainExecution.shouldDefaultAckRequest(rec)) {
      encOpts.ackRequest = true;
    }
    if (rec.restrictForward || (opts && opts.restrictForward)) encOpts.restrictForward = true;

    if (isAmendmentShare(rec)) {
      encOpts.baseTemplate = 6;
      if (rec.disputeLink || (rec.record_type || '').toLowerCase() === 'dispute') {
        encOpts.disputeLink = true;
      }
      var linkId = rec._amendedFromId || rec._disputedId;
      var pUid = idToParentUid(linkId);
      if (pUid) encOpts.parentUid = pUid;
    }

    var ratifiedBytes = ratifiedFrameBytesFromRecord(rec);
    if (ratifiedBytes) encOpts.ratifiedFrameBytes = ratifiedBytes;

    if (rec.chainRef) {
      encOpts.chain = true;
      encOpts.chainRef = rec.chainRef;
    }

    // TRIG block — opts.trigCode or stored trigBytes on record
    if (opts && opts.trigCode && opts.trigCode.trim()) {
      var tc = opts.trigCode.trim().slice(0, 20);
      var tcArr = [];
      for (var ti = 0; ti < tc.length; ti++) tcArr.push(tc.charCodeAt(ti) & 0xFF);
      encOpts.hasTrigBlock = true;
      encOpts.trigBytes    = new Uint8Array(tcArr);
    } else {
      var storedTrig = trigBytesFromRecord(rec);
      if (storedTrig && storedTrig.length) {
        encOpts.hasTrigBlock = true;
        encOpts.trigBytes    = storedTrig;
      }
    }

    var tag = (opts && opts.tag) || '1pa';

    if (tag === '1ps') {
      if (!opts || !opts.passphrase) throw new Error('encodeUrl: passphrase required for #1ps/');
      return WPSecurity.secureEncode(payload, encOpts, { passphrase: opts.passphrase });
    }
    if (tag === '1pb') {
      return WPCodec.encode(payload, merge(encOpts, { presentationTag: '1pb' }));
    }
    if (tag === '1dt') {
      return WPCodec.encode(payload, merge(encOpts, { presentationTag: '1dt' }));
    }
    if (tag === '1pv') {
      var v2Opts = merge(encOpts, { padsV2: true });
      if (global.WPRelationalCodec) {
        v2Opts = merge(v2Opts, WPRelationalCodec.buildEncodeOpts(rec, v2Opts));
      }
      return WPCodec.encode(payload, v2Opts);
    }
    return WPCodec.encode(payload, encOpts);
  }

  // Decode a URL to a normalised record object (not stored automatically).
  // Fixes DEV-WP-SUB-001: normalises codec underscore-prefixed keys.
  function decodeUrl(url) {
    return applyTrigPresentation(normaliseDecoded(WPCodec.decode(url)));
  }

  // Store a received record. Assigns a new local ID; preserves all decoded fields.
  function storeReceived(decoded) {
    var id = genId();
    var normal = applyTrigPresentation(normaliseDecoded(decoded));
    var inlineExpenses = normal.expenses || [];
    var inlinePayments = normal.payments || [];
    delete normal.expenses;
    delete normal.payments;

    var rec = merge({ id: id, receivedAt: Date.now(), draft: false }, normal);
    return store.put(id, rec).then(function() {
      var ops = [];
      var now = Date.now();
      var curr = rec.currency || null;
      var i, ex, py, childId;

      for (i = 0; i < inlineExpenses.length; i++) {
        ex = inlineExpenses[i] || {};
        childId = genId();
        ops.push(store.put(childId, {
          id: childId,
          parentId: id,
          record_type: 'expense',
          job: ex.job || 'Expense',
          amount: ex.amount || '0',
          currency: curr,
          expense_billing: ex.expense_billing || ex.billing || 'customer',
          actionIdx: ex.actionIdx,
          linkedExpenseId: ex.linkedExpenseId,
          action_quoted: ex.action_quoted,
          charge_type: ex.charge_type,
          draft: false,
          importedFromShare: true,
          createdAt: now,
          updatedAt: now,
        }));
      }
      for (i = 0; i < inlinePayments.length; i++) {
        py = inlinePayments[i] || {};
        childId = genId();
        ops.push(store.put(childId, {
          id: childId,
          parentId: id,
          record_type: 'payment',
          job: py.job || 'Payment',
          amount: py.amount || '0',
          currency: curr,
          date: py.date,
          draft: false,
          importedFromShare: true,
          createdAt: now,
          updatedAt: now,
        }));
      }
      return Promise.all(ops).then(function() { return afterPersist(rec); });
    });
  }

  global.RecordService = {
    create:        create,
    save:          save,
    update:        update,
    get:           get,
    list:          list,
    invalidateList:     invalidateList,
    listChildren:       listChildren,
    listByChainRef:     listByChainRef,
    childrenByParentId: childrenByParentId,
    recordsByChainRef:  recordsByChainRef,
    archive:       archiveRecord,
    restoreRecord: restoreRecord,
    removeRecord:  removeRecord,
    getArchived:   getArchived,
    listArchived:  listArchived,
    encodeUrl:     encodeUrl,
    decodeUrl:     decodeUrl,
    storeReceived: storeReceived,
    applyTrigPresentation: applyTrigPresentation,
    runCtrigSchedule:      runCtrigSchedule,
    isAmendmentShare:          isAmendmentShare,
    amendmentChangedFieldIds:  amendmentChangedFieldIds,
  };

}(window));
