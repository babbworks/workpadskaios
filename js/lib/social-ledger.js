// SocialLedger — lightweight invisible referral / ack log (IO C9–C10 scaffold)
// Exposes: window.SocialLedger

(function(global) {
  'use strict';

  var KEY = 'wp_social_ledger';

  function list() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
  }

  function append(entry) {
    var arr = list();
    entry.ts = entry.ts || Date.now();
    arr.push(entry);
    if (arr.length > 500) arr = arr.slice(-500);
    localStorage.setItem(KEY, JSON.stringify(arr));
  }

  /** Log referral bridge — ack may be required (e.g. sale_confirmed). */
  function logReferral(opts) {
    opts = opts || {};
    append({
      kind:       'referral',
      ackType:    opts.ackType || null,
      ackRequired: !!opts.ackRequired,
      connectionId: opts.connectionId || null,
      targetId:   opts.targetId || null,
      needId:     opts.needId || null,
      note:       opts.note || '',
      confirmed:  !!opts.confirmed,
    });
  }

  function onSaleConfirmed(saleRec, linkRec) {
    if (!saleRec) return;
    logReferral({
      ackType: 'sale_confirmed',
      ackRequired: true,
      targetId: saleRec.id,
      connectionId: linkRec && linkRec.id,
      confirmed: true,
    });
  }

  global.SocialLedger = {
    list: list,
    append: append,
    logReferral: logReferral,
    onSaleConfirmed: onSaleConfirmed,
  };

}(window));
