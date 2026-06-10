// chain-execution.js — conservation, action receive, relationship helpers (CE-08–13)
// Spec: CHAIN-EXECUTION-LOCKED.md, codec.md §5.2
// Exposes: window.WPChainExecution

(function(global) {
  'use strict';

  var FLOW_TYPES = {
    invoice: 1, quote: 1, payment: 1, need: 1, offer: 1, receipt: 1
  };

  var ACTION_SHARE_TYPES = {
    invoice: 1, quote: 1, payment: 1, need: 1, offer: 1
  };

  function rt(rec) {
    return String((rec && (rec.record_type || rec.recordType)) || '').toLowerCase();
  }

  function parseActionList(rec) {
    if (!rec) return [];
    var a = rec.actions;
    if (Array.isArray(a)) return a;
    if (typeof a === 'string' && a.trim()) {
      return a.split('\n').filter(function(s) { return s.trim(); }).map(function(t) {
        return { title: t.trim(), notes: '' };
      });
    }
    return [];
  }

  function chainRecordsFor(ref, all) {
    if (!ref || !all) return [];
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i].chainRef === ref) out.push(all[i]);
    }
    return out;
  }

  function chainIsClosed(chain) {
    var i, r, rt;
    for (i = 0; i < chain.length; i++) {
      r = chain[i];
      rt = (r.record_type || '').toLowerCase();
      if (rt === 'state_commit' && r.chainComplete) return true;
    }
    return false;
  }

  function sumPaymentsToward(mainId, chain) {
    var paid = 0;
    var i, r, rt, amt;
    for (i = 0; i < chain.length; i++) {
      r = chain[i];
      rt = (r.record_type || '').toLowerCase();
      if (rt !== 'payment') continue;
      if (r.parentId && r.parentId !== mainId) continue;
      amt = parseFloat(r.amount || r.customer_amount || 0);
      if (!isNaN(amt)) paid += amt;
    }
    return paid;
  }

  function hasAckForTarget(targetId, all) {
    if (!targetId || !all) return false;
    var i, r, rt;
    for (i = 0; i < all.length; i++) {
      r = all[i];
      rt = (r.record_type || '').toLowerCase();
      if (rt !== 'ack') continue;
      if (r.ackForId === targetId) return true;
    }
    return false;
  }

  function hasOpenObligation(rec, all) {
    if (!rec || rec.parentId || rec.draft) return false;
    if (rec.chainComplete || rec.disputeFlag) return false;
    var rt = (rec.record_type || '').toLowerCase();
    if (!FLOW_TYPES[rt]) return false;
    var chain = chainRecordsFor(rec.chainRef, all);
    if (chainIsClosed(chain)) return false;

    var actions = parseActionList(rec);
    if (actions.length && rec.ackRequest && !hasAckForTarget(rec.id, all)) return true;

    var total = parseFloat(rec.amount || rec.customer_amount || rec.grossTotal || 0);
    if (isNaN(total) || total <= 0) {
      if (rt === 'need' || rt === 'offer') return !chainIsClosed(chain);
      return false;
    }
    var paid = sumPaymentsToward(rec.id, chain);
    if (paid + 0.009 < total) return true;
    return false;
  }

  function shouldEmitActionListOnShare(rec) {
    if (!rec) return false;
    var t = rt(rec);
    if (t === 'connection') return false;
    if (!ACTION_SHARE_TYPES[t]) return false;
    if (t === 'invoice' || t === 'quote') return parseActionList(rec).length > 0;
    return true;
  }

  function shouldDefaultAckRequest(rec) {
    if (!rec || !shouldEmitActionListOnShare(rec)) return false;
    var t = rt(rec);
    if (t === 'invoice' || t === 'quote') return parseActionList(rec).length > 0;
    return parseActionList(rec).length > 0 || !!rec.ackRequest;
  }

  function isConnectionLightAckShare(rec) {
    return rt(rec) === 'connection';
  }

  function needsActionReceive(rec, all) {
    if (!rec) return false;
    var actions = parseActionList(rec);
    if (!actions.length) return false;
    if (all && hasAckForTarget(rec.id, all)) return false;
    return !!(rec.receivedAt || rec.ackRequest);
  }

  function masksFromToggles(toggles) {
    var confirmed = 0;
    var declined = 0;
    var i;
    for (i = 0; i < toggles.length && i < 16; i++) {
      if (toggles[i] === 'accept') confirmed |= (1 << i);
      if (toggles[i] === 'decline') declined |= (1 << i);
    }
    return { confirmed_mask: confirmed, declined_mask: declined };
  }

  function conservationBalanceWarning(rec, all) {
    if (!rec || !all) return null;
    var rt = (rec.record_type || '').toLowerCase();
    if (!FLOW_TYPES[rt] || rt === 'payment') return null;
    var total = parseFloat(rec.amount || rec.customer_amount || 0);
    if (isNaN(total) || total <= 0) return null;
    var chain = chainRecordsFor(rec.chainRef, all);
    var paid = sumPaymentsToward(rec.id, chain);
    if (paid > total + 0.01) {
      return 'Payments in chain exceed record amount (' + paid.toFixed(2) + ' > ' + total.toFixed(2) + ').';
    }
    return null;
  }

  function codecBadgeHtml(rec) {
    if (!rec) return '';
    var parts = [];
    if (rec._codec === '1pv') parts.push('1pv');
    if (rec._codec_v4 || rec.relational_mode) parts.push('v0.4');
    if (rec.chain_mode) parts.push(rec.chain_mode);
    if (rec.profile_id && rec.profile_id !== 'generic') parts.push(rec.profile_id);
    if (rec.chain_seq_compact != null) parts.push('seq:' + rec.chain_seq_compact);
    if (!parts.length) return '';
    return '<span class="wp-codec-badge">' + parts.join(' · ') + '</span>';
  }

  function createAckRecord(parent, toggles) {
    if (!parent || typeof RecordService === 'undefined') {
      return Promise.reject(new Error('WPChainExecution: RecordService missing'));
    }
    var masks = masksFromToggles(toggles || []);
    return RecordService.create({
      record_type:      'ack',
      relationship:     'acknowledges',
      confirmed_mask:   masks.confirmed_mask,
      declined_mask:    masks.declined_mask,
      chainRef:         parent.chainRef || null,
      ackForId:         parent.id,
      job:              'ACK: ' + (parent.job || ''),
      customer:         parent.customer || '',
      currency:         parent.currency || '',
      date:             new Date().toISOString().slice(0, 10),
      draft:            false,
    });
  }

  global.WPChainExecution = {
    parseActionList: parseActionList,
    hasOpenObligation: hasOpenObligation,
    needsActionReceive: needsActionReceive,
    hasAckForTarget: hasAckForTarget,
    masksFromToggles: masksFromToggles,
    conservationBalanceWarning: conservationBalanceWarning,
    codecBadgeHtml: codecBadgeHtml,
    createAckRecord: createAckRecord,
    shouldEmitActionListOnShare: shouldEmitActionListOnShare,
    shouldDefaultAckRequest: shouldDefaultAckRequest,
    isConnectionLightAckShare: isConnectionLightAckShare,
  };

}(window));
