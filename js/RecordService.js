// RecordService — create, store, list, archive, and share workpad records
// Exposes: window.RecordService (singleton)

(function(global) {
  'use strict';

  var store   = new StorageAdapter('wp_record_');
  var archive = new StorageAdapter('wp_archive_');

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
    if (rec._chainRef    !== undefined) { rec.chainRef    = rec._chainRef;    delete rec._chainRef; }
    if (rec._expenses    !== undefined) { rec.expenses    = rec._expenses;    delete rec._expenses; }
    if (rec._payments    !== undefined) { rec.payments    = rec._payments;    delete rec._payments; }
    if (rec._participants !== undefined) { rec.participants = rec._participants; delete rec._participants; }
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
    return store.put(id, rec).then(function() { return rec; });
  }

  // Save (upsert) a record by ID. Marks as non-draft.
  function save(id, fields) {
    return store.get(id).then(function(existing) {
      var rec = merge(existing || { id: id }, fields, {
        updatedAt: Date.now(),
        draft: false,
      });
      return store.put(id, rec).then(function() { return rec; });
    });
  }

  // Update fields on an existing record without changing draft status.
  function update(id, fields) {
    return store.get(id).then(function(existing) {
      if (!existing) throw new Error('RecordService: record not found: ' + id);
      var rec = merge(existing, fields, { updatedAt: Date.now() });
      return store.put(id, rec).then(function() { return rec; });
    });
  }

  // Get a single active record by ID.
  function get(id) {
    return store.get(id);
  }

  // List all active records, newest first.
  function list() {
    return store.list().then(function(pairs) {
      return pairs
        .map(function(p) { return p.data; })
        .sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    });
  }

  // List active child records (expenses, payments) for a given parent ID.
  function listChildren(parentId) {
    return store.list().then(function(pairs) {
      return pairs
        .map(function(p) { return p.data; })
        .filter(function(r) { return r.parentId === parentId; });
    });
  }

  // ── Archive operations ────────────────────────────────────────────────────────

  // Soft-delete: move record to archive namespace.
  function archiveRecord(id) {
    return store.get(id).then(function(rec) {
      if (!rec) return;
      rec.archivedAt = Date.now();
      return archive.put(id, rec).then(function() {
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

  // Encode a record to a shareable workpads URL (codebook-c, 1eg/).
  // opts: { expenses, payments } — override inline sub-records for this encode.
  function encodeUrl(rec, opts) {
    var payload = {};
    var wireFields = [
      'job', 'customer', 'date', 'location', 'meeting_time',
      'start_time', 'end_time', 'customer_phone', 'worker',
      'details', 'story', 'actions',
      'record_type', 'currency', 'vat', 'amount',
    ];
    for (var i = 0; i < wireFields.length; i++) {
      var f = wireFields[i];
      if (rec[f] !== null && rec[f] !== undefined) payload[f] = rec[f];
    }
    if (!payload.worker) {
      var senderName = ActivityService.getSenderIdentity().name;
      if (senderName) payload.worker = senderName;
    }
    var locale = ActivityService.getLocale();
    var encOpts = {
      templateLocale: locale.locale,
      chainRef:       rec.chainRef  || null,
      expenses:       (opts && opts.expenses !== undefined) ? opts.expenses : (rec.expenses  || []),
      payments:       (opts && opts.payments !== undefined) ? opts.payments : (rec.payments  || []),
    };
    return WPCodec.encode(payload, encOpts);
  }

  // Decode a URL to a normalised record object (not stored automatically).
  // Fixes DEV-WP-SUB-001: normalises codec underscore-prefixed keys.
  function decodeUrl(url) {
    return normaliseDecoded(WPCodec.decode(url));
  }

  // Store a received record. Assigns a new local ID; preserves all decoded fields.
  function storeReceived(decoded) {
    var id = genId();
    var normal = normaliseDecoded(decoded);
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
      return Promise.all(ops).then(function() { return rec; });
    });
  }

  global.RecordService = {
    create:        create,
    save:          save,
    update:        update,
    get:           get,
    list:          list,
    listChildren:  listChildren,
    archive:       archiveRecord,
    restoreRecord: restoreRecord,
    removeRecord:  removeRecord,
    getArchived:   getArchived,
    listArchived:  listArchived,
    encodeUrl:     encodeUrl,
    decodeUrl:     decodeUrl,
    storeReceived: storeReceived,
  };

}(window));
