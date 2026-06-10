// relational-ui.js — share/view helpers for v0.4 relational + symbol table
(function(global) {
  'use strict';

  function peerKeyForRecord(rec) {
    if (!rec) return '_default';
    return String(rec.linkedContactId || rec.counterparty_id || rec.linked_contact_id || '_default');
  }

  function encodeEnabled() {
    return !!(global.UIPhase && UIPhase.isOn('relational_encode'));
  }

  function statusForRecord(rec) {
    var peer = peerKeyForRecord(rec);
    var st = global.WPSymbolTable ? WPSymbolTable.stats(peer) : { entries: 0, pending: 0 };
    var willEncode = false;
    if (global.WPRelationalCodec && rec) {
      var opts = WPRelationalCodec.buildEncodeOpts(rec, { padsV2: true });
      willEncode = !!opts.relationalMode;
    }
    return {
      peerKey: peer,
      entries: st.entries,
      pending: st.pending,
      encodeOn: encodeEnabled(),
      willEncode: willEncode,
    };
  }

  function renderShareSection(rec, tag) {
    if (tag !== '1pv' && tag !== '1dt') return '';
    if (!global.WPSymbolTable) return '';
    var s = statusForRecord(rec);
    var peerLbl = WPSymbolTable.peerLabelForKey(s.peerKey, null);
    var encBadge = s.encodeOn
      ? (s.willEncode ? '<span class="badge badge-accent">Will send</span>' : '<span class="badge">Ready</span>')
      : '<span class="badge">Off</span>';
    var pend = s.pending
      ? ' <span class="badge badge-warn">' + s.pending + ' pending</span>' : '';
    return '<div class="share-rel-section">' +
      '<div class="view-field-label" style="padding:6px 10px 2px;">Relational (#1pv/)</div>' +
      '<div class="share-rel-row">' +
        '<span class="share-rel-lbl">Encode</span>' +
        '<span class="share-rel-val">' + encBadge + '</span>' +
      '</div>' +
      '<div class="share-rel-row" data-rel-action="symbols">' +
        '<span class="share-rel-lbl">Symbols · ' + esc(peerLbl) + '</span>' +
        '<span class="share-rel-val">' + s.entries + ' tokens' + pend + ' <span class="badge">Edit</span></span>' +
      '</div>' +
      '<div class="share-rel-hint">Short names ride inline on the next share to this peer. Manage in Settings → Symbols.</div>' +
      '</div>';
  }

  function wireShareSection(root, rec, openSymbols) {
    if (!root) return;
    var row = root.querySelector('[data-rel-action="symbols"]');
    if (row && openSymbols) {
      row.addEventListener('click', function() {
        openSymbols({ peerKey: peerKeyForRecord(rec), returnTo: 'share' });
      });
    }
  }

  function inlineEntryBanner(rec) {
    if (!rec) return '';
    var ent = rec._inline_table_entry;
    if (!ent) return '';
    var label = ent.label || (ent.tokenId != null ? ('token ' + ent.tokenId) : '');
    if (!label) return '';
    var peer = peerKeyForRecord(rec);
    return 'Symbol on wire: ' + label + (peer !== '_default' ? ' (peer table)' : '');
  }

  global.WPRelationalUi = {
    peerKeyForRecord: peerKeyForRecord,
    encodeEnabled: encodeEnabled,
    statusForRecord: statusForRecord,
    renderShareSection: renderShareSection,
    wireShareSection: wireShareSection,
    inlineEntryBanner: inlineEntryBanner,
  };

}(typeof window !== 'undefined' ? window : global));
