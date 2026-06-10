// Screen: Financial Detail — per-record COGS waterfall, expense ledger, margin
// Exposes: window.FinancialScreen

(function(global) {
  'use strict';

  var el = { content: document.getElementById('financial-content') };

  var currentRecord = null;
  var navItems      = [];   // {type, record} for navigable rows
  var focusIdx      = 0;
  var _finScrollId  = null;
  var _finScrollTop = 0;

  // ── Formatting helpers ────────────────────────────────────────────────────

  function fmtMoney(n, currency) {
    return (currency ? currency + '\u00a0' : '') + parseFloat(n || 0).toFixed(2);
  }

  function fmtDate(d) { return d ? String(d).slice(0, 10) : ''; }

  // ── Render ────────────────────────────────────────────────────────────────

  function render(rec, children) {
    var preserveScroll = _finScrollId === rec.id && !!el.content;
    var savedScroll = preserveScroll ? el.content.scrollTop : 0;

    var summary  = FinancialModel.summarize(rec, children);
    var currency = rec.currency || '';
    var navReg   = [];   // accumulate navigable {type, record} entries
    var html     = '';

    // ── Price block ──
    html += '<div class="fin-section">';
    html += '<div class="fin-sec-hdr">Summary</div>';
    if (summary.price)   html += finRow('Amount',      fmtMoney(summary.price,  currency));
    if (summary.tax)     html += finRow('Tax',         fmtMoney(summary.tax,    currency));
    if (summary.total)   html += finRow('Total',       fmtMoney(summary.total,  currency), 'bold');
    if (summary.outstanding !== null && summary.payments.length) {
      var ostStyle = summary.outstanding > 0 ? 'danger' : 'green';
      html += finRow('Outstanding', fmtMoney(summary.outstanding, currency), ostStyle);
    }
    html += '</div>';

    // ── Outgoings ──
    if (summary.billedExp.length) {
      html += '<div class="fin-section">';
      html += '<div class="fin-sec-hdr">Outgoings (' + summary.billedExp.length + ')</div>';
      for (var i = 0; i < summary.billedExp.length; i++) {
        var e = summary.billedExp[i];
        var idx = navReg.length;
        navReg.push({ type: 'expense', record: e });
        html += finNavRow(idx, e.job || 'Expense',
          fmtMoney(e.amount, currency),
          billingBadge(e.expense_billing));
      }
      html += '</div>';
    }

    // ── COGS ──
    if (summary.cogs.lines.length) {
      html += '<div class="fin-section">';
      html += '<div class="fin-sec-hdr">COGS (' + summary.cogs.lines.length + ')</div>';
      for (var j = 0; j < summary.cogs.lines.length; j++) {
        var line   = summary.cogs.lines[j];
        var jIdx   = navReg.length;
        navReg.push({ type: 'expense', record: line.record });
        html += finNavRow(jIdx, line.record.job || 'COGS',
          fmtMoney(line.record.amount, currency),
          cogsStatusBadge(line.status));
      }
      html += finRow('Total COGS', fmtMoney(summary.cogsTotal, currency), 'muted');
      html += '</div>';
    }

    // ── Payments ──
    if (summary.payments.length) {
      html += '<div class="fin-section">';
      html += '<div class="fin-sec-hdr">Payments (' + summary.payments.length + ')</div>';
      var running = summary.total || 0;
      for (var k = 0; k < summary.payments.length; k++) {
        var py = summary.payments[k];
        var kIdx = navReg.length;
        navReg.push({ type: 'payment', record: py });
        running -= parseFloat(py.amount || 0);
        var sub = fmtDate(py.date) + (running > 0 ? (' · left ' + fmtMoney(running, '')) : ' · cleared');
        html += finNavRow(kIdx,
          py.job || 'Payment',
          fmtMoney(py.amount, currency),
          null, sub);
      }
      html += '</div>';
    }

    // ── Margin waterfall ──
    html += '<div class="fin-section">';
    html += '<div class="fin-sec-hdr">Margin</div>';
    var gmStyle = summary.grossMargin >= 0 ? 'green' : 'danger';
    var nmStyle = summary.netMargin   >= 0 ? 'green' : 'danger';
    if (summary.billedTotal) html += finRow('Outgoings',    fmtMoney(summary.billedTotal, currency), 'muted');
    if (summary.cogsTotal)   html += finRow('COGS',         fmtMoney(summary.cogsTotal,   currency), 'muted');
    html += finRow('Gross margin', fmtMoney(summary.grossMargin, currency), gmStyle);
    html += finRow('Net margin',   fmtMoney(summary.netMargin,   currency), nmStyle);
    html += '</div>';

    // ── COGS breakdown ──
    if (summary.cogs.overrun || summary.cogs.unlinked) {
      html += '<div class="fin-section">';
      html += '<div class="fin-sec-hdr">COGS detail</div>';
      if (summary.cogs.withinBudget) html += finRow('Within budget', fmtMoney(summary.cogs.withinBudget, currency), 'green');
      if (summary.cogs.overrun)      html += finRow('Overrun',       fmtMoney(summary.cogs.overrun,      currency), 'danger');
      if (summary.cogs.unlinked)     html += finRow('Unlinked',      fmtMoney(summary.cogs.unlinked,     currency), 'muted');
      html += '</div>';
    }

    navItems = navReg;
    el.content.innerHTML = html;
    _finScrollId = rec.id;
    if (preserveScroll) {
      el.content.scrollTop = savedScroll;
      var st = savedScroll;
      setTimeout(function() {
        if (currentRecord === rec && el.content) el.content.scrollTop = st;
      }, 0);
    }
    updateFocus();
    WorkpadsPanel.setContext({ screen: 'financial', record: rec });
  }

  function finRow(label, value, style) {
    var valStyle = style === 'bold'   ? 'font-weight:bold;'                           :
                   style === 'green'  ? 'color:var(--green);font-weight:bold;'        :
                   style === 'danger' ? 'color:var(--danger);font-weight:bold;'       :
                   style === 'muted'  ? 'color:var(--text-muted);'                    : '';
    return '<div class="fin-row">' +
      '<span class="fin-row-label">' + esc(label) + '</span>' +
      '<span class="fin-row-value" style="' + valStyle + '">' + esc(value) + '</span>' +
    '</div>';
  }

  function finNavRow(navIdx, label, value, badge, sub) {
    return '<div class="fin-nav-row" data-nav="' + navIdx + '">' +
      '<div class="fin-nav-main">' +
        '<span class="fin-row-label">' + esc(label) + '</span>' +
        (badge ? badge : '') +
        '<span class="fin-row-value">' + esc(value) + '</span>' +
      '</div>' +
      (sub ? '<div class="fin-nav-sub">' + esc(sub) + '</div>' : '') +
    '</div>';
  }

  function billingBadge(billing) {
    var label = billing === 'cogs' ? 'COGS' : billing === 'internal' ? 'INT' : 'OUT';
    var color = billing === 'cogs' ? 'var(--text-muted)' : billing === 'internal' ? 'var(--accent)' : 'var(--green)';
    return '<span class="fin-badge" style="border-color:' + color + ';color:' + color + ';">' + label + '</span>';
  }

  function cogsStatusBadge(status) {
    var label = status === 'overrun' ? 'OVER' : status === 'within' ? 'OK' : 'UNL';
    var color = status === 'overrun' ? 'var(--danger)' : status === 'within' ? 'var(--green)' : 'var(--text-muted)';
    return '<span class="fin-badge" style="border-color:' + color + ';color:' + color + ';">' + label + '</span>';
  }

  // ── Focus management ─────────────────────────────────────────────────────

  function updateFocus() {
    var rows = el.content.querySelectorAll('.fin-nav-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('nav-focused', parseInt(rows[i].getAttribute('data-nav'), 10) === focusIdx);
    }
    if (navItems.length && rows[focusIdx]) {
      rows[focusIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function moveFocus(dir) {
    if (!navItems.length) return;
    focusIdx = Math.max(0, Math.min(navItems.length - 1, focusIdx + dir));
    updateFocus();
  }

  function openFocused() {
    if (!navItems.length || focusIdx >= navItems.length) return;
    var item = navItems[focusIdx];
    var finTab = item.type === 'payment' ? 2 : 1;
    App.showLedger({
      editRecord:    item.record,
      returnTo:      'financial',
      financialRecord: currentRecord,
      parentId:      currentRecord.id,
      wizardRecord:  currentRecord,
      returnFinTab:  finTab,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  function onShow(rec) {
    currentRecord = rec;
    focusIdx      = 0;
    navItems      = [];
    el.content.innerHTML = global.EmptyState
      ? EmptyState.loading('Loading financials\u2026')
      : '<div class="empty-state">Loading\u2026</div>';
    document.getElementById('financial-title').textContent = rec.job || 'Finance';
    RecordService.listChildren(rec.id).then(function(children) {
      if (currentRecord !== rec) return;
      render(rec, children);
    });
  }

  // ── Key handler ───────────────────────────────────────────────────────────

  function onKey(key) {
    switch (key) {
      case 'ArrowUp':   moveFocus(-1); break;
      case 'ArrowDown': moveFocus(1);  break;
      case 'Enter':
        if (navItems.length) { openFocused(); }
        break;
      case 'Backspace':
        App.showView(currentRecord);
        break;
    }
  }

  global.FinancialScreen = {
    onShow: onShow,
    onKey:  onKey,
    getCurrentRecord: function() { return currentRecord; },
  };

}(window));
