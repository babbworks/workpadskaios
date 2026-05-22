// RelVolume — relationship volume tuning engine (IO C11)
// Exposes: window.RelVolume

(function(global) {
  'use strict';

  var STORAGE_KEY = 'wp_rel_volume_dials';

  var DEFAULT_DIALS = {
    windowDays:     90,
    minInteractions: 2,
    weightSale:     2,
    weightReceipt:  1.5,
    weightInvoice:  1,
    weightPayment:  1,
    weightNeed:       0.5,
    weightOffer:      0.75,
    weightConnection: 1,
    decayPerDay:    0.01,
    advancedOpen:   false,
  };

  function getDials() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      var out = {};
      var keys = Object.keys(DEFAULT_DIALS);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        out[k] = raw[k] !== undefined ? raw[k] : DEFAULT_DIALS[k];
      }
      return out;
    } catch (_) {
      return merge({}, DEFAULT_DIALS);
    }
  }

  function setDials(partial) {
    var cur = getDials();
    var keys = Object.keys(partial || {});
    for (var i = 0; i < keys.length; i++) cur[keys[i]] = partial[keys[i]];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
  }

  function contactKey(rec) {
    var rt = (rec.record_type || rec.recordType || '').toLowerCase();
    if (rt === 'contact') {
      return (rec.job || rec.name || rec.customer || '').trim().toLowerCase();
    }
    return (rec.customer || rec.worker || '').trim().toLowerCase();
  }

  function scoreRecords(records, dials) {
    dials = dials || getDials();
    var cutoff = Date.now() - dials.windowDays * 86400000;
    var scores = {};
    var i, r, ck, w, ts;

    for (i = 0; i < records.length; i++) {
      r = records[i];
      if (r.parentId) continue;
      ck = contactKey(r);
      if (!ck) continue;
      ts = r.updatedAt || r.createdAt || 0;
      if (ts && ts < cutoff) continue;
      if (!scores[ck]) scores[ck] = { key: ck, score: 0, count: 0, label: r.customer || r.worker };
      w = 0;
      var rt = r.record_type || '';
      if (rt === 'sale') w = dials.weightSale;
      else if (rt === 'receipt') w = dials.weightReceipt;
      else if (rt === 'invoice') w = dials.weightInvoice;
      else if (rt === 'payment') w = dials.weightPayment;
      else if (rt === 'need') w = dials.weightNeed;
      else if (rt === 'offer') w = dials.weightOffer;
      else if (rt === 'connection') w = dials.weightConnection;
      else w = 0.25;
      scores[ck].score += w;
      scores[ck].count += 1;
    }

    var list = [];
    var keys = Object.keys(scores);
    for (i = 0; i < keys.length; i++) {
      if (scores[keys[i]].score >= dials.minInteractions) list.push(scores[keys[i]]);
    }
    list.sort(function(a, b) { return b.score - a.score; });
    return list;
  }

  global.RelVolume = {
    DEFAULT_DIALS: DEFAULT_DIALS,
    getDials: getDials,
    setDials: setDials,
    scoreRecords: scoreRecords,
  };

}(window));
