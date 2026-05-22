// WorkpadsPanelBrowse — WorkpadsPanel split module
(function(global) {
  'use strict';

  var LIAB_TYPES = { payable: true, receivable: true, loan: true };
  var ACT_OV_FILTER_IDS = ['all', 'own', 'other'];

  function install(S) {
  function removeNode(el) {
    if (!el) return;
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  function openDatePicker(target) {
    S.datePickerTarget = target;
    var existing = target === 'start' ? S.browseDateStart : S.browseDateEnd;
    if (!S.browseDateEnd) S.browseDateEnd = S.todayIso();
    var src = existing || (target === 'end' ? S.browseDateEnd : S.todayIso());
    var d = new Date(src + 'T00:00:00');
    S.datePickerYear  = d.getFullYear();
    S.datePickerMonth = d.getMonth();
    S.datePickerDay   = d.getDate();
    S.datePickerOpen  = true;
    S.datePickerZone  = 'grid';
    S.renderDatePicker();
  }

  function closeDatePicker() {
    S.datePickerOpen = false;
    S.renderListPanel();
  }

  function selectPickerDay(day) {
    var iso = S.datePickerYear + '-' + S.pad2(S.datePickerMonth + 1) + '-' + S.pad2(day);
    if (S.datePickerTarget === 'start') S.browseDateStart = iso;
    else S.browseDateEnd = iso;
    S.closeDatePicker();
  }

  function renderDatePicker() {
    var MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    var DAY_HDRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    var daysInMonth = new Date(S.datePickerYear, S.datePickerMonth + 1, 0).getDate();
    var firstDow    = new Date(S.datePickerYear, S.datePickerMonth, 1).getDay();
    var todayStr    = S.todayIso();
    var selIso      = S.datePickerTarget === 'start' ? S.browseDateStart : S.browseDateEnd;

    var hdrCells = DAY_HDRS.map(function(h) {
      return '<div class="dp-cell dp-hdr">' + h + '</div>';
    }).join('');

    var blanks = '';
    for (var b = 0; b < firstDow; b++) blanks += '<div class="dp-cell dp-empty"></div>';

    var dayCells = '';
    for (var day = 1; day <= daysInMonth; day++) {
      var iso = S.datePickerYear + '-' + S.pad2(S.datePickerMonth + 1) + '-' + S.pad2(day);
      var cls = 'dp-cell dp-day';
      if (iso === selIso)  cls += ' dp-sel';
      if (iso === todayStr && iso !== selIso) cls += ' dp-today';
      if (day === S.datePickerDay) cls += ' dp-focus';
      dayCells += '<div class="' + cls + '" data-day="' + day + '">' + day + '</div>';
    }

    var footerHtml = (S.datePickerTarget === 'start'
      ? '<div class="dp-btn dp-clear-btn' + (S.datePickerZone === 'clear' ? ' dp-focus' : '') + '" id="dp-clear">Clear start</div>' : '') +
      '<div class="dp-btn dp-cancel-btn' + (S.datePickerZone === 'cancel' ? ' dp-focus' : '') + '" id="dp-cancel">Cancel</div>';

    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;position:relative;';
    S.el.content.innerHTML =
      '<div class="dp-overlay">' +
        '<div class="dp-header">' +
          '<div class="dp-nav' + (S.datePickerZone === 'prev' ? ' dp-focus' : '') + '" id="dp-prev">\u2039</div>' +
          '<div class="dp-title' + (S.datePickerZone === 'title' ? ' dp-focus' : '') + '">' + MONTHS[S.datePickerMonth] + ' ' + S.datePickerYear + '</div>' +
          '<div class="dp-nav' + (S.datePickerZone === 'next' ? ' dp-focus' : '') + '" id="dp-next">\u203a</div>' +
        '</div>' +
        '<div class="dp-grid">' + hdrCells + blanks + dayCells + '</div>' +
        '<div class="dp-footer">' + footerHtml + '</div>' +
      '</div>';

    document.getElementById('dp-prev').addEventListener('click', function() {
      S.datePickerMonth--;
      if (S.datePickerMonth < 0) { S.datePickerMonth = 11; S.datePickerYear--; }
      S.datePickerDay = 1;
      S.renderDatePicker();
    });
    document.getElementById('dp-next').addEventListener('click', function() {
      S.datePickerMonth++;
      if (S.datePickerMonth > 11) { S.datePickerMonth = 0; S.datePickerYear++; }
      S.datePickerDay = 1;
      S.renderDatePicker();
    });
    var cancelEl = document.getElementById('dp-cancel');
    if (cancelEl) cancelEl.addEventListener('click', closeDatePicker);
    var clearEl = document.getElementById('dp-clear');
    if (clearEl) clearEl.addEventListener('click', function() {
      S.browseDateStart = ''; S.closeDatePicker();
    });
    var cells = S.el.content.querySelectorAll('.dp-day');
    for (var ci = 0; ci < cells.length; ci++) {
      cells[ci].addEventListener('click', (function(cell) {
        return function() { S.selectPickerDay(parseInt(cell.getAttribute('data-day'), 10)); };
      })(cells[ci]));
    }
  }

  // ── Browse helpers ─────────────────────────────────────────────────────────

  var LIAB_TYPES = { payable: true, receivable: true, loan: true };

  function computeAggregate(summaries, liabTotals, liabByc) {
    liabTotals = liabTotals || { payables: 0, receivables: 0, loansOwing: 0, loansOwed: 0 };
    liabByc    = liabByc    || {};
    var billed = 0, collected = 0, receivables = 0, sales = 0;
    var totalCharges = 0, totalTaxes = 0;
    var totalExpenses = 0, billableExp = 0, realJobCosts = 0;
    var count = summaries.length;
    var profileCur = '';
    if (typeof ActivityService !== 'undefined') {
      profileCur = (ActivityService.getLocale().currency || '').toUpperCase();
    }

    var byc = {};

    for (var i = 0; i < summaries.length; i++) {
      var s   = summaries[i];
      var cur = s._currency || 'unknown';
      var inProfile = !profileCur || cur === profileCur;
      if (inProfile) {
        billed       += s.price;
        collected    += s.paidTotal;
        if (s.outstanding > 0) receivables += s.outstanding;
        if (s._recordType === 'invoice') sales += s.price;
        totalCharges += s.total;
        totalTaxes   += s.tax;
        billableExp  += s.billedTotal;
        realJobCosts += s.cogsTotal;
        totalExpenses += s.billedTotal + s.cogsTotal;
      }

      CurrencyUtil.addKeyed(byc, cur, 'billed',    s.price);
      CurrencyUtil.addKeyed(byc, cur, 'collected', s.paidTotal);
      if (s.outstanding > 0) CurrencyUtil.addKeyed(byc, cur, 'receivables', s.outstanding);
      CurrencyUtil.addKeyed(byc, cur, 'expenses',  s.billedTotal + s.cogsTotal);
    }
    // Merge liability buckets into byc
    Object.keys(liabByc).forEach(function(cur) {
      var lb = liabByc[cur];
      if (lb.payables)    CurrencyUtil.addKeyed(byc, cur, 'payables',    lb.payables);
      if (lb.receivables) CurrencyUtil.addKeyed(byc, cur, 'receivables', lb.receivables);
      if (lb.loansOwing)  CurrencyUtil.addKeyed(byc, cur, 'loansOwing',  lb.loansOwing);
      if (lb.loansOwed)   CurrencyUtil.addKeyed(byc, cur, 'loansOwed',   lb.loansOwed);
    });

    receivables += liabTotals.receivables;
    var payables    = liabTotals.payables;
    var loansOwing  = liabTotals.loansOwing;
    var loansOwed   = liabTotals.loansOwed;
    var loans       = loansOwing - loansOwed;
    var rpl         = receivables - payables - loansOwing;
    var jobCostMargin  = billed > 0 ? (billed - billableExp) / billed * 100 : 0;
    var totalJobMargin = billed > 0 ? (billed - totalExpenses) / billed * 100 : 0;
    var grossMarginPct = billed > 0 ? (billed - billableExp - realJobCosts) / billed * 100 : 0;
    var netMarginPct   = billed > 0 ? (billed - totalExpenses) / billed * 100 : 0;
    return {
      billed: billed, collected: collected, receivables: receivables, sales: sales,
      payables: payables, loans: loans, loansOwing: loansOwing, loansOwed: loansOwed,
      rpl: rpl, rp: receivables - payables,
      totalCharges: totalCharges, jobCharges: billed, totalTaxes: totalTaxes,
      totalExpenses: totalExpenses, billableExpenses: billableExp,
      realJobCosts: realJobCosts, operatingCosts: 0,
      jobCostMargin: jobCostMargin, totalJobMargin: totalJobMargin,
      estJobCosts: 0, actJobCosts: realJobCosts, jobCostSplit: realJobCosts,
      estOpCosts: 0, actOpCosts: 0, opCostSplit: 0,
      operatingMargin: 0, grossMarginPct: grossMarginPct, netMarginPct: netMarginPct,
      expenseRatio: billed > 0 ? totalExpenses / billed * 100 : 0,
      avgRevPerJob: count > 0 ? billed / count : 0,
      byc: byc,
    };
  }

  function loadBrowseAgg(currency, callback) {
    RecordService.list().then(function(records) {
      var childMap = RecordService.childrenByParentId(records);
      var jobs = [];
      var liabByc = {};
      var liabTotals = { payables: 0, receivables: 0, loansOwing: 0, loansOwed: 0 };
      var actLen = S.browseActivities.length;
      var i, r, rt, cur, amt, ch, s;

      for (i = 0; i < records.length; i++) {
        r = records[i];
        if (r.parentId) continue;
        if (actLen > 0 && S.browseActivities.indexOf(r.activityId) === -1) continue;
        if (S.browseDateStart && r.date && r.date < S.browseDateStart) continue;
        if (S.browseDateEnd && r.date && r.date > S.browseDateEnd) continue;
        rt = r.record_type || '';
        cur = (r.currency || currency || 'unknown').toUpperCase();
        amt = parseFloat(r.amount || 0);
        if (LIAB_TYPES[rt]) {
          if (rt === 'payable')    CurrencyUtil.addKeyed(liabByc, cur, 'payables',    amt);
          if (rt === 'receivable') CurrencyUtil.addKeyed(liabByc, cur, 'receivables', amt);
          if (rt === 'loan') {
            if (r.loan_direction === 'owed') CurrencyUtil.addKeyed(liabByc, cur, 'loansOwed',  amt);
            else                             CurrencyUtil.addKeyed(liabByc, cur, 'loansOwing', amt);
          }
          continue;
        }
        ch = childMap[r.id] || [];
        s = FinancialModel.summarize(r, ch);
        s._currency = cur;
        jobs.push(s);
      }

      Object.keys(liabByc).forEach(function(c) {
        var b = liabByc[c];
        liabTotals.payables    += b.payables    || 0;
        liabTotals.receivables += b.receivables || 0;
        liabTotals.loansOwing  += b.loansOwing  || 0;
        liabTotals.loansOwed   += b.loansOwed   || 0;
      });

      var agg = S.computeAggregate(jobs, liabTotals, liabByc);
      S.browseAgg = agg;
      callback(agg, currency);
    });
  }

  function browseNavLine(filter, label, valHtml, labelNeg) {
    return '<div class="pb-sl nav" data-filter="' + filter + '">' +
      '<span class="pb-sll' + (labelNeg ? ' neg' : '') + '">' + esc(label) + '</span>' +
      valHtml + '<span class="pb-sla">\u203a</span>' +
    '</div>';
  }

  function browseDispLine(label, valHtml, labelNeg, labelMute) {
    return '<div class="pb-sl">' +
      '<span class="pb-sll' + (labelNeg ? ' neg' : '') + (labelMute ? ' mute' : '') + '">' + esc(label) + '</span>' +
      valHtml +
    '</div>';
  }

  function browseParentLine(label, valHtml) {
    return '<div class="pb-sl-parent"><span class="pb-sll">' + esc(label) + '</span>' + valHtml + '</div>';
  }

  function renderBrowseSummaryLines(agg, currency) {
    if (!agg) {
      return '<div style="padding:8px;color:var(--text-muted);font-size:10px;">Loading\u2026</div>';
    }
    var byc = agg.byc || {};
    // Use per-currency formatting when byc is available, otherwise fall back to flat S.money()
    function mv(v, cls, field) {
      var str = (field && Object.keys(byc).length)
        ? CurrencyUtil.fmtKeyed(byc, field)
        : S.money(currency, v);
      return '<span class="pb-slv ' + (cls || '') + '">' + str + '</span>';
    }
    function pv(v) { return '<span class="pb-slv pos">' + S.pct(v) + '</span>'; }
    var sep = '<div class="pb-sep"></div>';
    return (
      S.browseNavLine('billed',            'Billed',           mv(agg.billed,           'pos',  'billed')) +
      S.browseNavLine('sales',             'Sales',            mv(agg.sales || 0,       'pos',  'billed')) +
      S.browseNavLine('collected',         'Collecting',        mv(agg.collected,        'pos',  'collected')) +
      S.browseNavLine('receivables',       'Receivables',       mv(agg.receivables,      'warn', 'receivables')) +
      S.browseNavLine('payables',          'Payables',          mv(agg.payables,         'neg',  'payables'), true) +
      S.browseNavLine('loans',             'Loans',             mv(agg.loans,            'neg'), true) +
      S.browseDispLine('R \u2212 P \u2212 L', mv(agg.rpl, 'warn'), false, true) +
      S.browseDispLine('R \u2212 P',          mv(agg.rp,  'warn'), false, true) +
      sep +
      S.browseParentLine('Total Charges',  mv(agg.totalCharges, '')) +
      S.browseNavLine('job-charges',       'Job Charges',       mv(agg.jobCharges,       '')) +
      S.browseNavLine('total-taxes',       'Total Taxes',       mv(agg.totalTaxes,       '')) +
      sep +
      S.browseParentLine('Total Expenses', mv(agg.totalExpenses, 'neg', 'expenses')) +
      S.browseNavLine('billable-expenses', 'Billable Expenses', mv(agg.billableExpenses, 'neg'), true) +
      S.browseNavLine('real-job-costs',    'Real Job Costs',    mv(agg.realJobCosts,     'neg'), true) +
      S.browseNavLine('operating-costs',   'Operating Costs',   mv(agg.operatingCosts,   'neg'), true) +
      sep +
      S.browseDispLine('Job Cost Margin',  pv(agg.jobCostMargin),  false, true) +
      S.browseDispLine('Total Job Margin', pv(agg.totalJobMargin), false, true) +
      sep +
      S.browseDispLine('Est. Job Costs',   mv(agg.estJobCosts,  'neg'), true, true) +
      S.browseDispLine('Act. Job Costs',   mv(agg.actJobCosts,  'neg'), true, true) +
      S.browseDispLine('Jobs Cost Split',  mv(agg.jobCostSplit, 'warn'), false, true) +
      sep +
      S.browseDispLine('Est. Operating',   mv(agg.estOpCosts,   'neg'), true, true) +
      S.browseDispLine('Act. Operating',   mv(agg.actOpCosts,   'neg'), true, true) +
      S.browseDispLine('Cost Split',       mv(agg.opCostSplit,  'warn'), false, true) +
      sep +
      S.browseDispLine('Operating Margin', pv(agg.operatingMargin), false, true) +
      S.browseDispLine('Gross Margin',     pv(agg.grossMarginPct),  false, true) +
      S.browseDispLine('Net Margin',       pv(agg.netMarginPct),    false, true) +
      sep +
      S.browseDispLine('Expense Ratio',    pv(agg.expenseRatio),    false, true) +
      S.browseDispLine('Avg. Rev / Job',   mv(agg.avgRevPerJob, ''), false, true) +
      S.browseDispLine('Present / Future', '<span class="pb-slv">\u2014</span>', false, true)
    );
  }

  function buildBrowseFocusables() {
    S.browseFocusables = [];
    // Activity header button (always first)
    var actBtn = document.getElementById('pb-btn-activity');
    if (actBtn) S.browseFocusables.push({ type: 'activity-btn', el: actBtn });
    // Quick-create buttons
    var qcEls = S.el.content.querySelectorAll('.pb-qc[data-qc]');
    for (var qi = 0; qi < qcEls.length; qi++) {
      S.browseFocusables.push({ type: 'qc', el: qcEls[qi], kind: qcEls[qi].getAttribute('data-qc') });
    }
    // Activity filter chips
    var chipsRowEl = document.getElementById('pb-chips');
    if (chipsRowEl && !chipsRowEl.classList.contains('pb-chips-collapsed')) {
      var chipEls = chipsRowEl.querySelectorAll('.pb-chip');
      for (var ci = 0; ci < chipEls.length; ci++) {
        S.browseFocusables.push({ type: 'chip', el: chipEls[ci], actId: chipEls[ci].getAttribute('data-act-id') });
      }
      var chipX = document.getElementById('pb-chips-x');
      if (chipX) S.browseFocusables.push({ type: 'chips-x', el: chipX });
    }
    var dateX = document.getElementById('pb-date-clear');
    if (dateX) S.browseFocusables.push({ type: 'date-x', el: dateX });
    var sumEl = document.getElementById('pb-summary');
    if (sumEl) {
      var navEls = sumEl.querySelectorAll('.pb-sl.nav');
      for (var ni = 0; ni < navEls.length; ni++) {
        S.browseFocusables.push({ type: 'summary', el: navEls[ni] });
      }
    }
    if (S.browseFocusIdx >= S.browseFocusables.length) S.browseFocusIdx = Math.max(0, S.browseFocusables.length - 1);
  }

  function applyBrowseFocus() {
    for (var i = 0; i < S.browseFocusables.length; i++) S.browseFocusables[i].el.classList.remove('dpfocus');
    var f = S.browseFocusables[S.browseFocusIdx];
    if (!f) return;
    f.el.classList.add('dpfocus');
    if (f.type === 'summary') {
      var sumEl = document.getElementById('pb-summary');
      if (sumEl) {
        var pr = sumEl.getBoundingClientRect();
        var lr = f.el.getBoundingClientRect();
        if (lr.bottom > pr.bottom) sumEl.scrollTop += lr.bottom - pr.bottom + 2;
        else if (lr.top < pr.top)  sumEl.scrollTop -= pr.top - lr.top + 2;
      }
    }
    var cskEl = S.el.panel.querySelector('.sk-csk');
    if (cskEl) {
      if (f.type === 'activity-btn') cskEl.textContent = 'Select';
      else if (f.type === 'qc') cskEl.textContent = 'Add';
      else if (f.type === 'chip') cskEl.textContent = 'View';
      else if (f.type === 'chips-x' || f.type === 'date-x') cskEl.textContent = 'Clear';
      else cskEl.textContent = 'Open';
    }
  }

  function updateBrowseModeStrip() {
    var strip = document.getElementById('pb-mode-strip');
    if (!strip) return;
    strip.innerHTML = S.browseNavMode === 'line'
      ? '\u2195 line &middot; <em>* chunk</em>'
      : '\u2195 chunk &middot; <em>* line</em>';
  }

  // ── Activity picker overlay ────────────────────────────────────────────────

  var ACT_OV_FILTER_IDS = ['all', 'own', 'other'];
  function getFilteredActivities() {
    var acts = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];
    if (S.actOvFilter === 'own')   return acts.filter(function(a) { return a.type !== 'other'; });
    if (S.actOvFilter === 'other') return acts.filter(function(a) { return a.type === 'other'; });
    return acts;
  }

  function closeActOverlay() {
    S.actOvOpen    = false;
    S.actOvAddMode = false;
    var ov = document.getElementById('pb-act-ov');
    removeNode(ov);
  }

  // kept as alias so S.close() still compiles during transition
  function closeActPopup() { S.closeActOverlay(); }

  function renderActOverlay() {
    var ov = document.getElementById('pb-act-ov');
    removeNode(ov);

    var acts = S.getFilteredActivities();

    var filterBtnsHtml = ACT_OV_FILTER_IDS.map(function(fid, i) {
      var label = fid === 'all' ? 'All' : (fid === 'own' ? 'Personal' : 'Other');
      var active = S.actOvFilter === fid ? ' act-ov-flt-active' : '';
      var focused = (S.actOvZone === 'filters' && S.actOvFilterFocusIdx === i) ? ' focused' : '';
      return '<button class="act-ov-flt' + active + focused + '" data-flt="' + fid + '">' + label + '</button>';
    }).join('') +
    '<button class="act-ov-new-btn' + (S.actOvZone === 'filters' && S.actOvFilterFocusIdx === 3 ? ' focused' : '') + '" id="pb-act-ov-add-btn">+</button>';

    var addRowHtml = '';
    if (S.actOvAddMode) {
      addRowHtml =
        '<div class="act-ov-add-row">' +
          '<div class="act-ov-type-row">' +
            '<button class="act-ov-type-btn' + (S.actOvNewType === 'own' ? ' active' : '') + '" data-nt="own">Personal</button>' +
            '<button class="act-ov-type-btn' + (S.actOvNewType === 'other' ? ' active' : '') + '" data-nt="other">Other</button>' +
          '</div>' +
          '<input class="act-ov-inp" id="pb-act-ov-inp" type="text" placeholder="Name\u2026">' +
          '<div class="act-ov-add-actions">' +
            '<button id="pb-act-ov-save">Save</button>' +
            '<button id="pb-act-ov-cancel">Cancel</button>' +
          '</div>' +
        '</div>';
    }

    var itemsHtml = acts.map(function(act, i) {
      var sel     = S.browseActivities.indexOf(act.id) !== -1;
      var focused = (S.actOvZone === 'list' && S.actOvFocusIdx === i) ? ' focused' : '';
      var badge   = act.type === 'other' ? 'other' : 'own';
      return '<div class="act-ov-item' + (sel ? ' selected' : '') + focused + '" data-act-id="' + esc(act.id) + '">' +
        '<span class="act-ov-dot" style="background:' + (act.color || 'var(--accent)') + ';"></span>' +
        '<span class="act-ov-name">' + esc(act.name) + '</span>' +
        '<span class="act-ov-badge">' + badge + '</span>' +
        '<span class="act-ov-check">\u2713</span>' +
      '</div>';
    }).join('');
    if (!acts.length && !S.actOvAddMode) {
      itemsHtml = '<div class="act-ov-empty">No activities' + (S.actOvFilter !== 'all' ? ' in this filter' : ' yet') + '.</div>';
    }

    var el2 = document.createElement('div');
    el2.id = 'pb-act-ov';
    el2.className = 'act-ov';
    el2.innerHTML =
      '<div class="act-ov-hdr"><span>Activity Filter</span></div>' +
      '<div class="act-ov-filters" id="pb-act-ov-filters">' + filterBtnsHtml + '</div>' +
      '<div class="act-ov-list" id="pb-act-ov-list">' + addRowHtml + itemsHtml + '</div>';

    S.el.panel.appendChild(el2);

    // scroll focused item into view
    if (S.actOvZone === 'list') {
      var focEl = el2.querySelector('.act-ov-item.focused');
      if (focEl) focEl.scrollIntoView({ block: 'nearest' });
    }

    // filter button clicks
    var fltBtns = el2.querySelectorAll('.act-ov-flt');
    for (var fi = 0; fi < fltBtns.length; fi++) {
      fltBtns[fi].addEventListener('click', (function(btn) {
        return function() {
          S.actOvFilter = btn.getAttribute('data-flt');
          S.actOvFocusIdx = 0; S.actOvZone = 'list';
          S.renderActOverlay();
        };
      })(fltBtns[fi]));
    }

    var addBtn = document.getElementById('pb-act-ov-add-btn');
    if (addBtn) addBtn.addEventListener('click', function() {
      S.actOvAddMode = true; S.actOvZone = 'list'; S.renderActOverlay();
      var inp = document.getElementById('pb-act-ov-inp');
      if (inp) setTimeout(function() { inp.focus(); }, 0);
    });

    // add-row handlers
    if (S.actOvAddMode) {
      var typeBtns = el2.querySelectorAll('.act-ov-type-btn');
      for (var ti = 0; ti < typeBtns.length; ti++) {
        typeBtns[ti].addEventListener('click', (function(btn) {
          return function() { S.actOvNewType = btn.getAttribute('data-nt'); S.renderActOverlay(); };
        })(typeBtns[ti]));
      }
      var inp2 = document.getElementById('pb-act-ov-inp');
      if (inp2) setTimeout(function() { inp2.focus(); }, 0);
      function saveNewAct() {
        var v = inp2 ? inp2.value.trim() : '';
        if (v && typeof WorkActivityService !== 'undefined') {
          var na = WorkActivityService.create(v, S.actOvNewType);
          if (na && na.id) { S.browseActivities.push(na.id); S.browseChipsOn = true; }
        }
        S.actOvAddMode = false; S.actOvNewType = 'own';
        S.renderActOverlay(); S.refreshChips();
      }
      if (inp2) inp2.addEventListener('keydown', function(e) {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'SoftRight') { e.preventDefault(); saveNewAct(); }
        if (e.key === 'Escape' || e.key === 'SoftLeft' || (e.key === 'Backspace' && !inp2.value)) {
          e.preventDefault(); S.actOvAddMode = false; S.renderActOverlay();
        }
      });
      var saveBtn = document.getElementById('pb-act-ov-save');
      var cancelBtn = document.getElementById('pb-act-ov-cancel');
      if (saveBtn) saveBtn.addEventListener('click', saveNewAct);
      if (cancelBtn) cancelBtn.addEventListener('click', function() { S.actOvAddMode = false; S.renderActOverlay(); });
    }

    // item click toggle
    var rows = el2.querySelectorAll('.act-ov-item[data-act-id]');
    for (var ri = 0; ri < rows.length; ri++) {
      rows[ri].addEventListener('click', (function(row) {
        return function() {
          var id  = row.getAttribute('data-act-id');
          var idx = S.browseActivities.indexOf(id);
          if (idx === -1) { S.browseActivities.push(id); S.browseChipsOn = true; }
          else { S.browseActivities.splice(idx, 1); if (!S.browseActivities.length) S.browseChipsOn = false; }
          S.renderActOverlay(); S.refreshChips();
        };
      })(rows[ri]));
    }
  }

  function openActOverlay() {
    S.actOvOpen           = true;
    S.actOvFilter         = 'all';
    S.actOvZone           = 'list';
    S.actOvFocusIdx       = 0;
    S.actOvFilterFocusIdx = 0;
    S.actOvAddMode        = false;
    S.renderActOverlay();
  }

  function handleBackKey() {
    if (!S.actOvOpen) return false;
    if (S.actOvAddMode) { S.actOvAddMode = false; S.renderActOverlay(); return true; }
    S.closeActOverlay();
    return true;
  }

  function refreshChips() {
    var chipsEl = document.getElementById('pb-chips');
    if (!chipsEl) return;
    chipsEl.classList.toggle('pb-chips-collapsed', !S.browseChipsOn || !S.browseActivities.length);
    var html = '';
    for (var i = 0; i < S.browseActivities.length; i++) {
      var act = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.getById(S.browseActivities[i]) : null;
      var letter = act && act.name ? act.name.trim().charAt(0).toUpperCase() : '?';
      var color  = (act && act.color) ? act.color : 'var(--accent)';
      html += '<div class="pb-chip" data-act-id="' + esc(S.browseActivities[i]) + '" ' +
        'style="border-color:' + color + ';color:' + color + ';">' + esc(letter) + '</div>';
    }
    html += '<div class="pb-chip-x" id="pb-chips-x">\u2715</div>';
    chipsEl.innerHTML = html;
    var x = document.getElementById('pb-chips-x');
    if (x) x.addEventListener('click', function() { S.browseActivities = []; S.browseChipsOn = false; S.renderListPanel(); });
    // Live-refresh summary totals when activity filter changes
    S.browseAgg = null;
    var locale2 = ActivityService.getLocale();
    S.loadBrowseAgg(locale2.currency, function(agg) {
      var sumEl = document.getElementById('pb-summary');
      if (sumEl) {
        sumEl.innerHTML = S.renderBrowseSummaryLines(agg, locale2.currency);
        var navEls2 = sumEl.querySelectorAll('.pb-sl.nav');
        for (var ni2 = 0; ni2 < navEls2.length; ni2++) {
          navEls2[ni2].addEventListener('click', (function(row) {
            return function() {
              var filter = row.getAttribute('data-filter');
              if (filter && typeof ListScreen !== 'undefined' && typeof App !== 'undefined') {
                S.close(); ListScreen.setFilter(filter); App.showList();
              }
            };
          })(navEls2[ni2]));
        }
      }
    });
  }

  function renderListPanel() {
    if (S.datePickerOpen) { S.renderDatePicker(); return; }
    var locale = ActivityService.getLocale();
    var act    = ActivityService.getActive();
    var name   = act ? (act.name || 'there') : 'there';
    var currency = locale.currency;
    if (!S.browseDateEnd) S.browseDateEnd = S.todayIso();

    var logoEl = document.querySelector('.pb-logo');
    if (logoEl && !logoEl._wBound) {
      logoEl._wBound = true;
      logoEl.addEventListener('click', function() {
        var ret = (typeof App !== 'undefined' && App.getCurrentScreen) ? App.getCurrentScreen() : 'list';
        if (ret !== 'home') ret = 'list';
        S.close();
        if (typeof App !== 'undefined') App.showHelp({ returnTo: ret, tour: true });
      });
    }

    // Panel-header icon click handlers (attached once per open)
    var btnAct = document.getElementById('pb-btn-activity');
    if (btnAct && !btnAct._wBound) {
      btnAct._wBound = true;
      btnAct.addEventListener('click', function() {
        if (S.actOvOpen) S.closeActOverlay(); else S.openActOverlay();
      });
    }
    var btnFin = document.getElementById('pb-btn-financial');
    if (btnFin && !btnFin._wBound) {
      btnFin._wBound = true;
      btnFin.addEventListener('click', function() { S.close(); App.showFinanceOverview(); });
    }
    var btnContacts = document.getElementById('pb-btn-contacts');
    if (btnContacts && !btnContacts._wBound) {
      btnContacts._wBound = true;
      btnContacts.addEventListener('click', function() {
        S.close();
        if (typeof ListScreen !== 'undefined') ListScreen.setTypeFilter('contact');
        App.showList();
      });
    }
    var btnSwitch = document.getElementById('pb-btn-switch');
    if (btnSwitch && !btnSwitch._wBound) {
      btnSwitch._wBound = true;
      btnSwitch.addEventListener('click', function() { S.close(); App.showUserSwitcher(); });
    }

    var chipsCollapsed = !S.browseChipsOn || S.browseActivities.length === 0;
    var chipsHtml = '';
    if (!chipsCollapsed) {
      for (var ai = 0; ai < S.browseActivities.length; ai++) {
        var actObj = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.getById(S.browseActivities[ai]) : null;
        var chipLabel = actObj && actObj.name ? actObj.name.trim().charAt(0).toUpperCase() : '?';
        var chipColor = (actObj && actObj.color) ? actObj.color : 'var(--accent)';
        chipsHtml += '<div class="pb-chip" data-act-id="' + esc(S.browseActivities[ai]) + '" style="border-color:' + chipColor + ';color:' + chipColor + ';">' + esc(chipLabel) + '</div>';
      }
    }

    var dateStartTxt = S.browseDateStart ? S.fmtDate(S.browseDateStart) : '\u2014 start';
    var dateEndTxt   = S.fmtDate(S.browseDateEnd);

    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    S.el.content.innerHTML =
      '<div class="pb-controls" id="pb-controls">' +
        '<div class="pb-qc-row">' +
          '<div class="pb-qc pb-qc-exp"  data-qc="out">Exp</div>' +
          '<div class="pb-qc pb-qc-cogs" data-qc="cogs">COGS</div>' +
          '<div class="pb-qc pb-qc-inc"  data-qc="in">Inc</div>' +
        '</div>' +
        '<div class="pb-qc-row pb-qc-row2">' +
          '<div class="pb-qc pb-qc-payable"    data-qc="payable">Payable</div>' +
          '<div class="pb-qc pb-qc-loan"       data-qc="loan">Loan</div>' +
          '<div class="pb-qc pb-qc-receivable" data-qc="receivable">Receivable</div>' +
        '</div>' +
        '<div class="pb-chips-row' + (chipsCollapsed ? ' pb-chips-collapsed' : '') + '" id="pb-chips">' +
          chipsHtml +
          '<div class="pb-chip-x" id="pb-chips-x">\u2715</div>' +
        '</div>' +
        '<div class="pb-date-row">' +
          '<div class="pb-date-box' + (S.browseDateStart ? '' : ' pb-date-empty') + '" id="pb-date-start">' + esc(dateStartTxt) + '</div>' +
          '<div class="pb-date-sep" id="pb-date-clear">\u2715</div>' +
          '<div class="pb-date-box" id="pb-date-end">' + esc(dateEndTxt) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pb-summary" id="pb-summary">' +
        S.renderBrowseSummaryLines(S.browseAgg, currency) +
      '</div>' +
      '<div class="pb-mode-strip" id="pb-mode-strip"></div>';

    S.updateBrowseModeStrip();

    // Bind controls
    var chipsXEl = document.getElementById('pb-chips-x');
    if (chipsXEl) {
      chipsXEl.addEventListener('click', function() {
        S.browseChipsOn = false; S.browseActivities = []; S.renderListPanel();
      });
    }

    var chipEls = S.el.content.querySelectorAll('.pb-chip');
    for (var chi = 0; chi < chipEls.length; chi++) {
      chipEls[chi].addEventListener('click', function() {
        if (S.browseActivities.length > 0 && typeof ListScreen !== 'undefined') {
          S.close();
          ListScreen.setActivityFilter(S.browseActivities.slice());
          App.showList();
        }
      });
    }

    var dateStartEl = document.getElementById('pb-date-start');
    if (dateStartEl) {
      dateStartEl.addEventListener('click', function() { S.openDatePicker('start'); });
    }
    var dateEndEl = document.getElementById('pb-date-end');
    if (dateEndEl) {
      dateEndEl.addEventListener('click', function() { S.openDatePicker('end'); });
    }
    var dateClearEl = document.getElementById('pb-date-clear');
    if (dateClearEl) {
      dateClearEl.addEventListener('click', function() {
        S.browseDateStart = ''; S.browseDateEnd = S.todayIso(); S.renderListPanel();
      });
    }

    var qcEls = S.el.content.querySelectorAll('.pb-qc[data-qc]');
    for (var qi = 0; qi < qcEls.length; qi++) {
      qcEls[qi].addEventListener('click', (function(qc) {
        return function() { S.createFromPanel(qc.getAttribute('data-qc')); };
      })(qcEls[qi]));
    }

    // Summary line click handlers
    var navEls = S.el.content.querySelectorAll('.pb-sl.nav');
    for (var ni = 0; ni < navEls.length; ni++) {
      navEls[ni].addEventListener('click', (function(row) {
        return function() {
          var filter = row.getAttribute('data-filter');
          if (filter && typeof ListScreen !== 'undefined' && typeof App !== 'undefined') {
            S.close(); ListScreen.setFilter(filter); App.showList();
          }
        };
      })(navEls[ni]));
    }

    S.buildBrowseFocusables();
    S.applyBrowseFocus();

    // Load financial aggregation async, update summary when ready
    S.loadBrowseAgg(currency, function(agg) {
      var sumEl = document.getElementById('pb-summary');
      if (sumEl) {
        sumEl.innerHTML = S.renderBrowseSummaryLines(agg, currency);
        // Re-bind summary click handlers
        var newNavEls = sumEl.querySelectorAll('.pb-sl.nav');
        for (var nni = 0; nni < newNavEls.length; nni++) {
          newNavEls[nni].addEventListener('click', (function(row) {
            return function() {
              var filter = row.getAttribute('data-filter');
              if (filter && typeof ListScreen !== 'undefined' && typeof App !== 'undefined') {
                S.close(); ListScreen.setFilter(filter); App.showList();
              }
            };
          })(newNavEls[nni]));
        }
        S.buildBrowseFocusables();
        S.applyBrowseFocus();
      }
    });
  }

  function datePickerZones() {
    var z = ['prev', 'title', 'next', 'grid'];
    if (S.datePickerTarget === 'start') z.push('clear');
    z.push('cancel');
    return z;
  }

  function navigateDatePicker(vertDir) {
    var zones = datePickerZones();
    var zi = zones.indexOf(S.datePickerZone);
    if (zi < 0) zi = zones.indexOf('grid');
    if (S.datePickerZone === 'grid') {
      var dim = new Date(S.datePickerYear, S.datePickerMonth + 1, 0).getDate();
      S.datePickerDay = Math.max(1, Math.min(dim, S.datePickerDay + vertDir * 7));
      S.renderDatePicker();
      return;
    }
    var next = zi + vertDir;
    if (next >= 0 && next < zones.length) {
      S.datePickerZone = zones[next];
    } else if (vertDir > 0 && zones.indexOf('grid') >= 0) {
      S.datePickerZone = 'grid';
    } else if (vertDir < 0 && zones.indexOf('grid') >= 0) {
      S.datePickerZone = 'grid';
    }
    S.renderDatePicker();
  }

  function cycleDatePickerZone(hDir) {
    if (S.datePickerZone === 'grid') {
      var dim = new Date(S.datePickerYear, S.datePickerMonth + 1, 0).getDate();
      S.datePickerDay = Math.max(1, Math.min(dim, S.datePickerDay + hDir));
      S.renderDatePicker();
      return;
    }
    if (S.datePickerZone === 'prev' || S.datePickerZone === 'title' || S.datePickerZone === 'next') {
      if (hDir < 0) {
        if (S.datePickerZone === 'next') S.datePickerZone = 'title';
        else if (S.datePickerZone === 'title') S.datePickerZone = 'prev';
      } else {
        if (S.datePickerZone === 'prev') S.datePickerZone = 'title';
        else if (S.datePickerZone === 'title') S.datePickerZone = 'next';
      }
      S.renderDatePicker();
    }
  }

  function navigateListBrowse(dir) {
    if (S.actOvOpen && !S.actOvAddMode) {
      if (S.actOvZone === 'filters') {
        if (dir === 1) { S.actOvZone = 'list'; S.actOvFocusIdx = 0; S.renderActOverlay(); }
        return true;
      }
      // zone === 'list'
      var fActs = S.getFilteredActivities();
      var newIdx = S.actOvFocusIdx + dir;
      if (newIdx < 0) { S.actOvZone = 'filters'; S.renderActOverlay(); return true; }
      S.actOvFocusIdx = Math.min(fActs.length - 1, Math.max(0, newIdx));
      S.renderActOverlay();
      return true;
    }
    if (S.datePickerOpen) {
      S.navigateDatePicker(dir);
      return true;
    }
    if (!S.isOpen) return false;
    if (S.context.screen !== 'list' && S.context.screen !== 'home') return false;
    if (S.browseNavMode === 'chunk') {
      var sumEl = document.getElementById('pb-summary');
      if (sumEl) sumEl.scrollTop += dir * 48;
      return true;
    }
    if (!S.browseFocusables.length) return true;
    S.browseFocusIdx = Math.max(0, Math.min(S.browseFocusables.length - 1, S.browseFocusIdx + dir));
    S.applyBrowseFocus();
    return true;
    return false;
  }

  function cycleListTabBrowse(dir) {
    if (S.actOvOpen && !S.actOvAddMode) {
      var total = ACT_OV_FILTER_IDS.length + 1; // 3 filters + New btn
      S.actOvZone = 'filters';
      S.actOvFilterFocusIdx = (S.actOvFilterFocusIdx + dir + total) % total;
      S.renderActOverlay();
      return true;
    }
    if (S.datePickerOpen) {
      S.cycleDatePickerZone(dir);
      return true;
    }
    return false;
  }

  function toggleNavModeBrowse() {
    if (!S.isOpen || S.context.screen !== 'list' && S.context.screen !== 'home') return false;
    S.browseNavMode = S.browseNavMode === 'line' ? 'chunk' : 'line';
    S.updateBrowseModeStrip();
    if (S.browseNavMode === 'line') S.applyBrowseFocus();
    else {
      for (var i = 0; i < S.browseFocusables.length; i++) S.browseFocusables[i].el.classList.remove('dpfocus');
    }
    return true;
  }

  function handleEnterBrowse() {
    if (S.actOvOpen && !S.actOvAddMode) {
      if (S.actOvZone === 'filters') {
        if (S.actOvFilterFocusIdx === 3) {
          S.actOvAddMode = true; S.actOvZone = 'list'; S.renderActOverlay();
          var inp3 = document.getElementById('pb-act-ov-inp');
          if (inp3) setTimeout(function() { inp3.focus(); }, 0);
        } else {
          S.actOvFilter = ACT_OV_FILTER_IDS[S.actOvFilterFocusIdx] || 'all';
          S.actOvFocusIdx = 0; S.actOvZone = 'list'; S.renderActOverlay();
        }
      } else {
        var fItems = S.getFilteredActivities();
        var item = fItems[S.actOvFocusIdx];
        if (item) {
          var ii = S.browseActivities.indexOf(item.id);
          if (ii === -1) { S.browseActivities.push(item.id); S.browseChipsOn = true; }
          else { S.browseActivities.splice(ii, 1); if (!S.browseActivities.length) S.browseChipsOn = false; }
          S.renderActOverlay(); S.refreshChips();
        }
      }
      return true;
    }
    if (S.datePickerOpen) {
      if (S.datePickerZone === 'prev') {
        S.datePickerMonth--;
        if (S.datePickerMonth < 0) { S.datePickerMonth = 11; S.datePickerYear--; }
        S.datePickerDay = 1;
        S.renderDatePicker();
        return true;
      }
      if (S.datePickerZone === 'next') {
        S.datePickerMonth++;
        if (S.datePickerMonth > 11) { S.datePickerMonth = 0; S.datePickerYear++; }
        S.datePickerDay = 1;
        S.renderDatePicker();
        return true;
      }
      if (S.datePickerZone === 'clear') {
        S.browseDateStart = '';
        S.closeDatePicker();
        return true;
      }
      if (S.datePickerZone === 'cancel') {
        S.closeDatePicker();
        return true;
      }
      S.selectPickerDay(S.datePickerDay);
      return true;
    }
    if (S.context.screen === 'list' || S.context.screen === 'home') {
      var f = S.browseFocusables[S.browseFocusIdx];
      if (!f) return true;
      if (f.type === 'activity-btn') {
        if (S.actOvOpen) S.closeActOverlay(); else S.openActOverlay();
        return true;
      }
      if (f.type === 'qc') {
        S.createFromPanel(f.kind);
        return true;
      }
      if (f.type === 'chip') {
        var actId = f.actId || (f.el && f.el.getAttribute('data-act-id'));
        if (actId) {
          var ai = S.browseActivities.indexOf(actId);
          if (ai === -1) S.browseActivities.push(actId);
          else S.browseActivities.splice(ai, 1);
          S.browseAgg = null;
          S.renderListPanel();
        }
        return true;
      }
      if (f.type === 'chips-x') {
        S.browseChipsOn = false; S.browseActivities = []; S.renderListPanel();
        return true;
      }
      if (f.type === 'date-x') {
        S.browseDateStart = '';
        var s = document.getElementById('pb-date-start');
        if (s) { s.textContent = '\u2014 start'; s.classList.add('pb-date-empty'); }
        S.buildBrowseFocusables(); S.applyBrowseFocus();
        return true;
      }
      if (f.type === 'summary') {
        var filter = f.el.getAttribute('data-filter');
        if (filter && typeof ListScreen !== 'undefined' && typeof App !== 'undefined') {
          S.close(); ListScreen.setFilter(filter); App.showList();
        }
        return true;
      }
      return true;
    }
    return false;
  }

    S.openDatePicker = openDatePicker;
    S.closeDatePicker = closeDatePicker;
    S.selectPickerDay = selectPickerDay;
    S.renderDatePicker = renderDatePicker;
    S.computeAggregate = computeAggregate;
    S.loadBrowseAgg = loadBrowseAgg;
    S.browseNavLine = browseNavLine;
    S.browseDispLine = browseDispLine;
    S.browseParentLine = browseParentLine;
    S.renderBrowseSummaryLines = renderBrowseSummaryLines;
    S.buildBrowseFocusables = buildBrowseFocusables;
    S.applyBrowseFocus = applyBrowseFocus;
    S.updateBrowseModeStrip = updateBrowseModeStrip;
    S.getFilteredActivities = getFilteredActivities;
    S.closeActOverlay = closeActOverlay;
    S.closeActPopup = closeActPopup;
    S.renderActOverlay = renderActOverlay;
    S.openActOverlay = openActOverlay;
    S.handleBackKey = handleBackKey;
    S.refreshChips = refreshChips;
    S.renderListPanel = renderListPanel;
    S.navigateDatePicker = navigateDatePicker;
    S.cycleDatePickerZone = cycleDatePickerZone;
    S.navigateListBrowse = navigateListBrowse;
    S.cycleListTabBrowse = cycleListTabBrowse;
    S.toggleNavModeBrowse = toggleNavModeBrowse;
    S.handleEnterBrowse = handleEnterBrowse;
  }

  global.WorkpadsPanelBrowse = { install: install };
}(window));
