// social-ledger.js — C9 social trail (referrals, relays, acks) — local log, no wire bytes
// Exposes: window.SocialLedger

(function(global) {
  'use strict';

  var KEY = 'wp_social_ledger';
  var MAX = 500;

  var KIND_LABELS = {
    referral:           'Referral',
    relay_created:      'Relay created',
    relay_received:     'Relay received',
    relay_confirmed:    'Relay confirmed',
    relay_noted_local:  'Relay noted (local)',
    light_ack_sent:     'Light ack sent',
    sale_confirmed:     'Sale confirmed',
  };

  var ACK_LABELS = {
    light_ack:       'Light ack',
    relay_note:      'Relay note',
    sale_confirmed:  'Sale confirmed',
    relay_confirmed: 'Relay confirmed',
  };

  function list() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
  }

  function save(arr) {
    if (arr.length > MAX) arr = arr.slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(arr));
  }

  function append(entry) {
    var arr = list();
    entry.id = entry.id || ('sl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    entry.ts = entry.ts || Date.now();
    entry.kind = entry.kind || 'referral';
    arr.push(entry);
    save(arr);
    return entry;
  }

  function logEvent(kind, opts) {
    opts = opts || {};
    return append({
      kind: kind,
      ackType: opts.ackType || null,
      ackRequired: !!opts.ackRequired,
      connectionId: opts.connectionId || null,
      contactId: opts.contactId || null,
      targetId: opts.targetId || null,
      needId: opts.needId || null,
      note: opts.note || '',
      confirmed: !!opts.confirmed,
      label: opts.label || null,
    });
  }

  /** @deprecated use logEvent */
  function logReferral(opts) {
    opts = opts || {};
    return logEvent(opts.kind || 'referral', opts);
  }

  function resolvePendingForConnection(connectionId) {
    if (!connectionId) return;
    var arr = list();
    var changed = false;
    var i;
    for (i = 0; i < arr.length; i++) {
      if (arr[i].connectionId === connectionId && isPending(arr[i])) {
        arr[i].confirmed = true;
        changed = true;
      }
    }
    if (changed) save(arr);
  }

  function onSaleConfirmed(saleRec, linkRec) {
    if (!saleRec) return;
    logEvent('sale_confirmed', {
      ackType: 'sale_confirmed',
      ackRequired: true,
      targetId: saleRec.id,
      connectionId: linkRec && linkRec.id,
      contactId: linkRec && linkRec.linkedContactId,
      confirmed: true,
      label: saleRec.job ? 'Sale: ' + saleRec.job : null,
    });
  }

  function formatTs(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toISOString().slice(0, 10);
  }

  function labelForEntry(e) {
    if (!e) return '';
    if (e.label) return e.label;
    if (e.kind && KIND_LABELS[e.kind]) return KIND_LABELS[e.kind];
    if (e.ackType && ACK_LABELS[e.ackType]) return ACK_LABELS[e.ackType];
    return e.kind || 'Event';
  }

  function isPending(e) {
    return !!(e && e.ackRequired && !e.confirmed);
  }

  function matchesRecord(e, rec) {
    if (!e || !rec || !rec.id) return false;
    if (e.connectionId === rec.id) return true;
    if (e.targetId === rec.id) return true;
    if (e.needId === rec.id) return true;
    if (rec.linkedContactId && e.contactId === rec.linkedContactId) return true;
    return false;
  }

  function connectionIdsForContact(contactId, records) {
    if (!contactId) return [];
    var ids = [];
    var i, r;
    for (i = 0; i < (records || []).length; i++) {
      r = records[i];
      if ((r.record_type || '') !== 'connection') continue;
      if (r.linkedContactId === contactId) ids.push(r.id);
    }
    return ids;
  }

  function matchesContact(e, contactId, records) {
    if (!e || !contactId) return false;
    if (e.contactId === contactId) return true;
    var connIds = connectionIdsForContact(contactId, records);
    if (e.connectionId && connIds.indexOf(e.connectionId) >= 0) return true;
    return false;
  }

  function entriesForRecord(rec, opts) {
    opts = opts || {};
    var all = list();
    var out = [];
    var i;
    for (i = all.length - 1; i >= 0; i--) {
      if (matchesRecord(all[i], rec)) out.push(all[i]);
    }
    out.sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });
    if (opts.limit) out = out.slice(0, opts.limit);
    return out;
  }

  function entriesForContact(contactId, records, opts) {
    opts = opts || {};
    if (!contactId) return [];
    var all = list();
    var out = [];
    var i;
    for (i = all.length - 1; i >= 0; i--) {
      if (matchesContact(all[i], contactId, records)) out.push(all[i]);
    }
    out.sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });
    if (opts.limit) out = out.slice(0, opts.limit);
    return out;
  }

  function pendingForContact(contactId, records) {
    var entries = entriesForContact(contactId, records);
    var n = 0, i;
    for (i = 0; i < entries.length; i++) {
      if (isPending(entries[i])) n++;
    }
    return n;
  }

  function summaryForContact(contactId, records) {
    var entries = entriesForContact(contactId, records, { limit: 1 });
    var pending = pendingForContact(contactId, records);
    var all = entriesForContact(contactId, records);
    var counts = { relay: 0, sale: 0, ack: 0 };
    for (var i = 0; i < all.length; i++) {
      var k = all[i].kind;
      if (k === 'sale_confirmed') counts.sale++;
      else if (k === 'light_ack_sent' || k === 'relay_confirmed') counts.ack++;
      else if (k.indexOf('relay') === 0) counts.relay++;
    }
    return {
      pending: pending,
      last: entries[0] || null,
      total: all.length,
      counts: counts,
    };
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderTrailHtml(entries, opts) {
    opts = opts || {};
    var max = opts.max || 8;
    var title = opts.title || 'Social trail';
    if (!entries || !entries.length) {
      return '<div class="sl-trail-empty">' + esc(opts.empty || 'No social events yet.') + '</div>';
    }
    var html = '<div class="sl-trail-hdr">' + esc(title) + '</div>';
    var i, e, pend;
    for (i = 0; i < entries.length && i < max; i++) {
      e = entries[i];
      pend = isPending(e);
      html += '<div class="sl-trail-row' + (pend ? ' sl-pending' : '') + '">' +
        '<span class="sl-trail-ts">' + esc(formatTs(e.ts)) + '</span>' +
        '<span class="sl-trail-lbl">' + esc(labelForEntry(e)) + '</span>' +
        (pend ? '<span class="sl-trail-pend">open</span>' : '') +
        (e.note ? '<div class="sl-trail-note">' + esc(e.note.slice(0, 80)) + '</div>' : '') +
        '</div>';
    }
    if (entries.length > max) {
      html += '<div class="sl-trail-more">+' + (entries.length - max) + ' earlier</div>';
    }
    return html;
  }

  function renderSummaryBadge(summary) {
    if (!summary || !summary.pending) return '';
    return '<span class="badge badge-warn sl-pend-badge">' + summary.pending + ' ack</span>';
  }

  global.SocialLedger = {
    list: list,
    append: append,
    logEvent: logEvent,
    logReferral: logReferral,
    resolvePendingForConnection: resolvePendingForConnection,
    onSaleConfirmed: onSaleConfirmed,
    labelForEntry: labelForEntry,
    formatTs: formatTs,
    isPending: isPending,
    entriesForRecord: entriesForRecord,
    entriesForContact: entriesForContact,
    pendingForContact: pendingForContact,
    summaryForContact: summaryForContact,
    renderTrailHtml: renderTrailHtml,
    renderSummaryBadge: renderSummaryBadge,
  };

}(window));
