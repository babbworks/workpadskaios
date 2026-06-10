// SaleRollup — one list row per catalogue item / product (inventory tally)
// Exposes: window.SaleRollup

(function(global) {
  'use strict';

  function enabled() {
    return localStorage.getItem('wp_sale_rollup') !== '0';
  }

  function setEnabled(on) {
    localStorage.setItem('wp_sale_rollup', on ? '1' : '0');
  }

  function bucketKey(rec) {
    if (rec.sale_item_id) return 'id:' + rec.sale_item_id;
    var name = (rec.job || '').trim().toLowerCase();
    return name ? 'n:' + name : 'r:' + (rec.id || '');
  }

  function parseQty(rec) {
    var q = parseFloat(rec.sale_qty);
    return isNaN(q) || q <= 0 ? 1 : q;
  }

  function parseAmt(rec) {
    var a = parseFloat(rec.amount);
    return isNaN(a) ? 0 : a;
  }

  /**
   * Replace sale records with rollup rows ({ _saleRollup: true, ... }).
   * Non-sale records pass through unchanged.
   */
  function apply(mains) {
    if (!enabled() || !mains || !mains.length) return mains;

    var sales = [];
    var other = [];
    var i, r, rt;

    for (i = 0; i < mains.length; i++) {
      r = mains[i];
      rt = r.record_type || r.recordType || '';
      if (rt === 'sale') sales.push(r);
      else other.push(r);
    }

    if (!sales.length) return mains;
    if (sales.length === 1 && !sales[0].sale_item_id) {
      /* single anonymous sale — still one row */
    }

    var map = {};
    for (i = 0; i < sales.length; i++) {
      r = sales[i];
      var key = bucketKey(r);
      if (!map[key]) {
        map[key] = {
          _saleRollup:   true,
          _rollupKey:    key,
          record_type:   'sale',
          job:           r.job || '(sale)',
          sale_item_id:  r.sale_item_id || null,
          currency:      r.currency || '',
          count:         0,
          qtyTotal:      0,
          grossTotal:    0,
          records:       [],
          lastDate:      '',
          updatedAt:     0,
        };
      }
      var b = map[key];
      b.count += 1;
      b.qtyTotal += parseQty(r);
      b.grossTotal += parseAmt(r);
      b.records.push(r);
      var d = (r.date || '').slice(0, 10);
      if (d && (!b.lastDate || d > b.lastDate)) b.lastDate = d;
      var ts = r.updatedAt || r.createdAt || 0;
      if (ts > b.updatedAt) b.updatedAt = ts;
      if (!b.sale_item_id && r.sale_item_id) b.sale_item_id = r.sale_item_id;
    }

    var rolled = [];
    var keys = Object.keys(map);
    for (i = 0; i < keys.length; i++) {
      var row = map[keys[i]];
      row.amount = String(row.grossTotal);
      row.id = 'rollup_' + keys[i];
      rolled.push(row);
    }

    return other.concat(rolled);
  }

  /** Sort rollup rows after merge — respects amount / name modes when all sales. */
  function sortRollupsFirst(a, b) {
    if (a._saleRollup && !b._saleRollup) return -1;
    if (!a._saleRollup && b._saleRollup) return 1;
    return 0;
  }

  global.SaleRollup = {
    enabled: enabled,
    setEnabled: setEnabled,
    apply: apply,
    sortRollupsFirst: sortRollupsFirst,
  };

}(window));
