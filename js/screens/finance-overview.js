// Screen: Finance Overview — cross-record portfolio aggregation
// Exposes: window.FinanceOverviewScreen

(function(global) {
  'use strict';

  var el = { content: document.getElementById('finance-overview-content') };

  var windowMode  = 'all';   // 'all' | 'month' | 'week'
  var curFilter   = null;    // null = all currencies, else 'GBP' / 'BTC' etc.
  var ovTypeFilter = null;   // null = all, else record_type string
  var moreOpen    = false;
  var availCurs   = [];      // populated after each aggregate

  var WINDOWS       = ['all', 'month', 'week'];
  var WINDOW_LABELS = { all: 'All', month: 'Month', week: 'Week' };

  var OV_TYPE_OPTIONS = [
    { val: null,      label: 'All types' },
    { val: 'invoice', label: 'Invoices'  },
    { val: 'quote',   label: 'Quotes'    },
    { val: 'receipt', label: 'Receipts'  },
    { val: '',        label: 'Jobs'      },
  ];

  // ── Date window filter ────────────────────────────────────────────────────

  function windowStart() {
    var now = new Date();
    if (windowMode === 'week') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
               .toISOString().slice(0, 10);
    }
    if (windowMode === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1)
               .toISOString().slice(0, 10);
    }
    return null;
  }

  function inWindow(rec) {
    var start = windowStart();
    if (!start) return true;
    return (rec.date || '') >= start;
  }

  // ── Aggregation ───────────────────────────────────────────────────────────

  function aggregate(records, childrenMap) {
    var byc = {};
    var byType = {};
    var mains = records.filter(function(r) {
      if (r.parentId) return false;
      if (r.record_class === 'contact') return false;
      if (!inWindow(r)) return false;
      if (ovTypeFilter !== null && (r.record_type || '') !== ovTypeFilter) return false;
      return true;
    });

    for (var i = 0; i < mains.length; i++) {
      var rec      = mains[i];
      var cur      = (rec.currency || 'unknown').toUpperCase();
      var children = childrenMap[rec.id] || [];
      var s        = FinancialModel.summarize(rec, children);
      if (!s.total && !s.expenses.length && !s.payments.length) continue;

      CurrencyUtil.addKeyed(byc, cur, 'billed',      s.total);
      CurrencyUtil.addKeyed(byc, cur, 'cogs',        s.cogsTotal);
      CurrencyUtil.addKeyed(byc, cur, 'paid',        s.paidTotal);
      CurrencyUtil.addKeyed(byc, cur, 'outstanding', s.outstanding > 0 ? s.outstanding : 0);
      CurrencyUtil.addKeyed(byc, cur, 'grossMargin', s.grossMargin);
      CurrencyUtil.addKeyed(byc, cur, 'netMargin',   s.netMargin);

      var rt = rec.record_type || '';
      if (!byType[rt]) byType[rt] = { count: 0, byc: {} };
      byType[rt].count++;
      CurrencyUtil.addKeyed(byType[rt].byc, cur, 'billed',      s.total);
      CurrencyUtil.addKeyed(byType[rt].byc, cur, 'outstanding', s.outstanding > 0 ? s.outstanding : 0);
    }

    Object.keys(byc).forEach(function(c) {
      var b = byc[c];
      b.grossMarginPct = b.billed > 0 ? Math.round(b.grossMargin / b.billed * 100) : null;
      b.netMarginPct   = b.billed > 0 ? Math.round(b.netMargin   / b.billed * 100) : null;
    });

    // Track available currencies for the currency picker (priority order from settings)
    availCurs = (typeof ActivityService !== 'undefined' && ActivityService.sortCurrencies)
      ? ActivityService.sortCurrencies(Object.keys(byc))
      : Object.keys(byc).sort();

    // Apply currency filter — narrow byc to just the selected currency
    if (curFilter && byc[curFilter]) {
      var filtered = {};
      filtered[curFilter] = byc[curFilter];
      byc = filtered;
    } else if (curFilter) {
      byc = {};  // selected currency has no data in this window
    }

    return { byc: byc, byType: byType, recordCount: mains.length };
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function pct(v) {
    if (v === null || v === undefined) return '';
    return ' (' + (v >= 0 ? '+' : '') + v + '%)';
  }

  function ovRow(label, value, style) {
    var vstyle = style === 'green'   ? 'color:var(--green);font-weight:bold;'   :
                 style === 'danger'  ? 'color:var(--danger);font-weight:bold;'  :
                 style === 'accent'  ? 'color:var(--accent);font-weight:bold;'  :
                 style === 'bold'    ? 'font-weight:bold;'                       :
                 style === 'muted'   ? 'color:var(--text-muted);'               : '';
    return '<div class="ov-row">' +
      '<span class="ov-label">' + esc(label) + '</span>' +
      '<span class="ov-value" style="' + vstyle + '">' + value + '</span>' +
    '</div>';
  }

  function ovSec(title, body) {
    return '<div class="ov-section">' +
      '<div class="ov-sec-hdr">' + esc(title) + '</div>' +
      body +
    '</div>';
  }

  var TYPE_LABELS = { '': 'Jobs', 'quote': 'Quotes', 'invoice': 'Invoices', 'receipt': 'Receipts', 'pads': 'Notes' };

  function buildWindowBar() {
    var ccyLabel = curFilter ? CurrencyUtil.symbol(curFilter) : 'Ccy';
    var hasTypeFilt = ovTypeFilter !== null;
    return '<div class="ov-window-bar">' +
      WINDOWS.map(function(w) {
        return '<span class="ov-win-btn' + (windowMode === w ? ' active' : '') + '" data-win="' + w + '">' +
          WINDOW_LABELS[w] + '</span>';
      }).join('') +
      '<span class="ov-win-spacer"></span>' +
      '<span class="ov-ccy-btn' + (curFilter ? ' active' : '') + '" id="ov-ccy-btn">' + esc(ccyLabel) + '</span>' +
      '<span class="ov-more-btn' + (hasTypeFilt ? ' active' : '') + '" id="ov-more-btn">\u2295</span>' +
    '</div>';
  }

  function buildMoreDrop() {
    if (!moreOpen) return '';
    var rows = OV_TYPE_OPTIONS.map(function(opt) {
      var active = (ovTypeFilter === opt.val);
      return '<div class="ov-more-row" data-ov-type="' + (opt.val === null ? '__all__' : esc(opt.val)) + '">' +
        '<span class="ov-more-check">' + (active ? '\u2714' : '') + '</span>' +
        '<span>' + esc(opt.label) + '</span>' +
      '</div>';
    }).join('');
    return '<div class="ov-more-drop">' + rows + '</div>';
  }

  function render(result) {
    var byc    = result.byc;
    var byType = result.byType;
    var curs   = Object.keys(byc).sort();

    // Summary
    var summaryBody = ovRow('Records', String(result.recordCount));

    if (curs.length === 0) {
      summaryBody += ovRow('Billed', '\u2014', 'muted');
    } else {
      summaryBody += ovRow('Billed', CurrencyUtil.fmtKeyed(byc, 'billed'), 'bold');
      var hasCogs = curs.some(function(c) { return (byc[c].cogs || 0) > 0; });
      if (hasCogs) summaryBody += ovRow('COGS', CurrencyUtil.fmtKeyed(byc, 'cogs'), 'muted');

      curs.forEach(function(cur) {
        var b = byc[cur];
        if (!b.billed) return;
        var pfx = curs.length > 1 ? (CurrencyUtil.symbol(cur) + '\u2009') : '';
        var gmStyle = (b.grossMargin || 0) >= 0 ? 'green' : 'danger';
        var nmStyle = (b.netMargin   || 0) >= 0 ? 'green' : 'danger';
        if (curs.length > 1) {
          summaryBody += '<div class="ov-cur-divider" style="font-size:9px;color:var(--border);padding:2px 10px 0;">' + esc(cur) + '</div>';
        }
        summaryBody += ovRow(pfx + 'Gross margin', esc(CurrencyUtil.fmt(b.grossMargin, cur) + pct(b.grossMarginPct)), gmStyle);
        summaryBody += ovRow(pfx + 'Net margin',   esc(CurrencyUtil.fmt(b.netMargin,   cur) + pct(b.netMarginPct)),   nmStyle);
      });
    }

    // Payments
    var ostFlat = {};
    curs.forEach(function(cur) { if (byc[cur] && byc[cur].outstanding) ostFlat[cur] = byc[cur].outstanding; });
    var hasOst = curs.some(function(cur) { return (byc[cur] && byc[cur].outstanding || 0) > 0; });
    var paymentBody =
      ovRow('Received',    CurrencyUtil.fmtKeyed(byc, 'paid'), 'green') +
      ovRow('Outstanding', CurrencyUtil.fmtFlat(ostFlat),      hasOst ? 'accent' : 'muted');

    // By type (respect curFilter — only show types that have data in visible currencies)
    var typeKeys = Object.keys(byType).sort();
    var typeBody = '';
    typeKeys.forEach(function(t) {
      var d = byType[t];
      var curs = Object.keys(d.byc).sort();
      if (typeof ActivityService !== 'undefined' && ActivityService.sortCurrencies) {
        curs = ActivityService.sortCurrencies(curs);
      }
      var lblBase = (TYPE_LABELS[t] || t || 'Job') + ' (' + d.count + ')';
      var wrote = false;
      curs.forEach(function(cur) {
        if (curFilter && cur !== curFilter) return;
        var b = d.byc[cur];
        if (!b) return;
        var billed = b.billed || 0;
        var ost = b.outstanding || 0;
        if (!billed && !ost) return;
        var line = CurrencyUtil.fmt(billed, cur);
        if (ost > 0) line += ' \u00b7 ' + CurrencyUtil.fmt(ost, cur) + ' due';
        var rowLbl = curs.length > 1 ? (lblBase + ' \u00b7 ' + cur) : lblBase;
        typeBody += ovRow(rowLbl, esc(line));
        wrote = true;
      });
      if (!wrote && !curFilter) {
        typeBody += ovRow(lblBase, '\u2014', 'muted');
      }
    });
    if (!typeBody) typeBody = ovRow('No records', '', 'muted');

    el.content.innerHTML =
      buildWindowBar() +
      buildMoreDrop() +
      ovSec('Summary',  summaryBody) +
      ovSec('Payments', paymentBody) +
      ovSec('By type',  typeBody);

    // Window buttons
    var winBtns = el.content.querySelectorAll('[data-win]');
    for (var i = 0; i < winBtns.length; i++) {
      winBtns[i].addEventListener('click', (function(w) {
        return function() { windowMode = w; load(); };
      })(winBtns[i].getAttribute('data-win')));
    }

    // Currency button — cycle through available currencies (→ null = All)
    var ccyBtn = document.getElementById('ov-ccy-btn');
    if (ccyBtn) {
      ccyBtn.addEventListener('click', function() {
        if (!availCurs.length) return;
        if (curFilter === null) {
          curFilter = availCurs[0];
        } else {
          var idx = availCurs.indexOf(curFilter);
          curFilter = (idx < 0 || idx >= availCurs.length - 1) ? null : availCurs[idx + 1];
        }
        load();
      });
    }

    // More button — toggle type dropdown
    var moreBtn = document.getElementById('ov-more-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', function() {
        moreOpen = !moreOpen;
        render(result);
      });
    }

    // More dropdown rows
    var moreRows = el.content.querySelectorAll('[data-ov-type]');
    for (var j = 0; j < moreRows.length; j++) {
      moreRows[j].addEventListener('click', (function(row) {
        return function() {
          var v = row.getAttribute('data-ov-type');
          ovTypeFilter = (v === '__all__') ? null : v;
          moreOpen = false;
          load();
        };
      })(moreRows[j]));
    }

    WorkpadsPanel.setContext({ screen: 'finance-overview' });
  }

  function renderLoading() {
    el.content.innerHTML = '<div class="empty-state">Loading\u2026</div>';
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  function load() {
    renderLoading();
    RecordService.list().then(function(records) {
      var childrenMap = RecordService.childrenByParentId(records);
      var mains = records.filter(function(r) { return !r.parentId; });

      if (!mains.length) {
        el.content.innerHTML = '<div class="empty-state">No records yet.</div>';
        WorkpadsPanel.setContext({ screen: 'finance-overview' });
        return;
      }

      render(aggregate(records, childrenMap));
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  function onShow() {
    windowMode   = 'all';
    curFilter    = null;
    ovTypeFilter = null;
    moreOpen     = false;
    if (typeof ActivityService !== 'undefined' && ActivityService.getFinPriority) {
      var pri = ActivityService.getFinPriority().primary;
      if (pri) curFilter = pri;
    }
    load();
  }

  function onKey(key) {
    switch (key) {
      case 'ArrowLeft':
        cycleWindow(-1);
        break;
      case 'ArrowRight':
        cycleWindow(1);
        break;
      case 'Backspace':
        App.showList();
        break;
    }
  }

  function cycleWindow(dir) {
    var idx = WINDOWS.indexOf(windowMode);
    var next = idx + dir;
    if (next < 0 || next >= WINDOWS.length) return;
    windowMode = WINDOWS[next];
    load();
  }

  global.FinanceOverviewScreen = {
    onShow: onShow,
    onKey:  onKey,
  };

}(window));
