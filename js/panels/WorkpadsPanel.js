// WorkpadsPanel — ArrowLeft overlay, Exchange Engine context layer
// Spec: workpads-standard/panel-access-model.md (ARC-016)
// Exposes: window.WorkpadsPanel

(function(global) {
  'use strict';

  var el = {
    panel:   document.getElementById('panel-workpads'),
    content: document.getElementById('panel-workpads-content'),
  };

  var isOpen  = false;
  var context = {};           // { screen, record, wizardScreen, url, tab }
  var lastContext = null;     // exposed for Personal Panel bridge
  var finActionIdx    = 0;    // 0=Out, 1=COGS, 2=In
  var mgmtPanelFocusIdx = 0;  // focused row in management panel

  var MGMT_TABS = ['records', 'personal', 'activities', 'settings'];
  var MGMT_TAB_LABELS = { records: 'Records', activities: 'Activities', personal: 'Personal', settings: 'Settings' };

  // ── Browse mode state ──────────────────────────────────────────────────────
  var browseScope       = 'projects'; // 'projects' | 'tags' | 'other'
  var browseActivities  = [];         // selected activity IDs
  var browseChipsOn     = false;      // chips row visible
  var actPopupOpen      = false;      // activity picker popup
  var actAddMode        = false;      // show add-new input in act popup
  var browseDateStart   = '';         // ISO date string or ''
  var browseDateEnd     = '';         // ISO date string or '' (defaults to today)
  var browseFocusables  = [];         // flat nav list: {type, el, ...}
  var browseFocusIdx    = 0;
  var browseNavMode     = 'line';     // 'line' | 'chunk'
  var browseAgg         = null;       // cached aggregation result

  function setContext(ctx) {
    context = ctx || {};
    finActionIdx = 0;
    if (context.screen !== 'list') { browseFocusIdx = 0; browseNavMode = 'line'; }
    if (isOpen) render();
  }

  function showBackdrop(side) {
    var backdrop = document.getElementById('panel-backdrop');
    if (!backdrop) return;
    var sel = (typeof CountryScreen !== 'undefined' && CountryScreen.getSelected)
      ? CountryScreen.getSelected() : null;
    var iso = sel ? sel.iso : null;
    var img = iso ? localStorage.getItem('wp_country_img_' + iso) : null;
    backdrop.className = 'side-' + (side || 'left');
    if (img) {
      backdrop.innerHTML = '<img class="backdrop-img" src="' + img + '" alt="">';
    } else if (iso && typeof CountryScreen !== 'undefined' && CountryScreen.flagEmoji) {
      backdrop.innerHTML = '<div class="backdrop-flag">' + CountryScreen.flagEmoji(iso) + '</div>';
    } else {
      backdrop.innerHTML = '';
    }
    backdrop.classList.add('active');
  }

  function hideBackdrop() {
    var backdrop = document.getElementById('panel-backdrop');
    if (backdrop) { backdrop.className = ''; backdrop.innerHTML = ''; }
  }

  function open() {
    if (typeof PersonalPanel !== 'undefined') PersonalPanel.close();
    lastContext = context;
    isOpen = true;
    el.panel.classList.add('open');
    document.body.classList.add('wp-panel-open');
    showBackdrop('left');
    if (context.screen === 'list') browseFocusIdx = 0;
    render();
  }

  function close() {
    isOpen = false;
    el.panel.classList.remove('open');
    document.body.classList.remove('wp-panel-open');
    closeActPopup();
    hideBackdrop();
  }

  function toggle() {
    if (isOpen) close(); else open();
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function fmtDate(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr + 'T00:00:00');
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var day = d.getDate();
    var suf = day === 1 ? 'st' : (day === 2 ? 'nd' : (day === 3 ? 'rd' : 'th'));
    return M[d.getMonth()] + ' ' + day + suf + ', ' + d.getFullYear();
  }

  function pct(v) {
    return (Math.round(v * 10) / 10).toFixed(1) + '%';
  }

  function panelActionLabel(idx) {
    return idx === 0 ? 'Out' : (idx === 1 ? 'COGS' : 'In');
  }

  function toNum(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function money(currency, v) {
    var n = toNum(v);
    var sym = currency === 'GBP' ? '\u00a3' : (currency || '');
    return esc(sym) + '\u00a0' + (Math.round(n * 100) / 100).toFixed(2);
  }

  function createFromPanel(kind) {
    var rec = context.record;
    var typeMap = { 'out': 'expense', 'cogs': 'cogs', 'in': 'payment' };
    close();
    App.showLedger({
      type:         typeMap[kind] || 'expense',
      linkedRecord: rec && rec.id ? rec : null,
      linkMode:     rec && rec.id ? 'record' : 'none',
    });
    return true;
  }

  // ── Content rendering ──────────────────────────────────────────────────

  function render() {
    var screen = context.screen;
    var rec    = context.record;

    if (screen === 'list') {
      renderListPanel();
    } else if (screen === 'view') {
      renderRecordPreview(rec);
    } else if (screen === 'wizard') {
      renderWizardContext();
    } else if (screen === 'newent-wizard') {
      renderNewEntWizardPanel();
    } else if (screen === 'share') {
      renderShareContext();
    } else if (screen === 'management') {
      renderManagementContext();
    } else {
      el.content.innerHTML = '<div class="panel-label">No context.</div>';
    }
  }

  // ── Browse helpers ─────────────────────────────────────────────────────────

  function computeAggregate(summaries) {
    var billed = 0, collected = 0, receivables = 0;
    var totalCharges = 0, totalTaxes = 0;
    var totalExpenses = 0, billableExp = 0, realJobCosts = 0;
    var count = summaries.length;
    for (var i = 0; i < summaries.length; i++) {
      var s = summaries[i];
      billed       += s.price;
      collected    += s.paidTotal;
      if (s.outstanding > 0) receivables += s.outstanding;
      totalCharges += s.total;
      totalTaxes   += s.tax;
      billableExp  += s.billedTotal;
      realJobCosts += s.cogsTotal;
      totalExpenses += s.billedTotal + s.cogsTotal;
    }
    var jobCostMargin  = billed > 0 ? (billed - billableExp) / billed * 100 : 0;
    var totalJobMargin = billed > 0 ? (billed - totalExpenses) / billed * 100 : 0;
    var grossMarginPct = billed > 0 ? (billed - billableExp - realJobCosts) / billed * 100 : 0;
    var netMarginPct   = billed > 0 ? (billed - totalExpenses) / billed * 100 : 0;
    return {
      billed: billed, collected: collected, receivables: receivables,
      payables: 0, loans: 0,
      rpl: receivables,   // payables + loans = 0 until those types land
      rp: receivables,
      totalCharges: totalCharges, jobCharges: billed, totalTaxes: totalTaxes,
      totalExpenses: totalExpenses, billableExpenses: billableExp,
      realJobCosts: realJobCosts, operatingCosts: 0,
      jobCostMargin: jobCostMargin, totalJobMargin: totalJobMargin,
      estJobCosts: 0, actJobCosts: realJobCosts, jobCostSplit: realJobCosts,
      estOpCosts: 0, actOpCosts: 0, opCostSplit: 0,
      operatingMargin: 0, grossMarginPct: grossMarginPct, netMarginPct: netMarginPct,
      expenseRatio: billed > 0 ? totalExpenses / billed * 100 : 0,
      avgRevPerJob: count > 0 ? billed / count : 0,
    };
  }

  function loadBrowseAgg(currency, callback) {
    RecordService.list().then(function(records) {
      var mains = records.filter(function(r) { return !r.parentId; });
      if (browseActivities.length > 0) {
        mains = mains.filter(function(r) { return browseActivities.indexOf(r.activityId) !== -1; });
      }
      Promise.all(mains.map(function(r) {
        return RecordService.listChildren(r.id).then(function(ch) {
          return FinancialModel.summarize(r, ch);
        });
      })).then(function(summaries) {
        var agg = computeAggregate(summaries);
        browseAgg = agg;
        callback(agg, currency);
      });
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
    function mv(v, cls) { return '<span class="pb-slv ' + (cls || '') + '">' + money(currency, v) + '</span>'; }
    function pv(v)      { return '<span class="pb-slv pos">' + pct(v) + '</span>'; }
    var sep = '<div class="pb-sep"></div>';
    return (
      browseNavLine('billed',            'Billed',           mv(agg.billed,           'pos')) +
      browseNavLine('collected',         'Collected',         mv(agg.collected,        'pos')) +
      browseNavLine('receivables',       'Receivables',       mv(agg.receivables,      'warn')) +
      browseNavLine('payables',          'Payables',          mv(agg.payables,         'neg'), true) +
      browseNavLine('loans',             'Loans',             mv(agg.loans,            'neg'), true) +
      browseDispLine('R \u2212 P \u2212 L', mv(agg.rpl, 'warn'), false, true) +
      browseDispLine('R \u2212 P',          mv(agg.rp,  'warn'), false, true) +
      sep +
      browseParentLine('Total Charges',  mv(agg.totalCharges, '')) +
      browseNavLine('job-charges',       'Job Charges',       mv(agg.jobCharges,       '')) +
      browseNavLine('total-taxes',       'Total Taxes',       mv(agg.totalTaxes,       '')) +
      sep +
      browseParentLine('Total Expenses', mv(agg.totalExpenses, 'neg')) +
      browseNavLine('billable-expenses', 'Billable Expenses', mv(agg.billableExpenses, 'neg'), true) +
      browseNavLine('real-job-costs',    'Real Job Costs',    mv(agg.realJobCosts,     'neg'), true) +
      browseNavLine('operating-costs',   'Operating Costs',   mv(agg.operatingCosts,   'neg'), true) +
      sep +
      browseDispLine('Job Cost Margin',  pv(agg.jobCostMargin),  false, true) +
      browseDispLine('Total Job Margin', pv(agg.totalJobMargin), false, true) +
      sep +
      browseDispLine('Est. Job Costs',   mv(agg.estJobCosts,  'neg'), true, true) +
      browseDispLine('Act. Job Costs',   mv(agg.actJobCosts,  'neg'), true, true) +
      browseDispLine('Jobs Cost Split',  mv(agg.jobCostSplit, 'warn'), false, true) +
      sep +
      browseDispLine('Est. Operating',   mv(agg.estOpCosts,   'neg'), true, true) +
      browseDispLine('Act. Operating',   mv(agg.actOpCosts,   'neg'), true, true) +
      browseDispLine('Cost Split',       mv(agg.opCostSplit,  'warn'), false, true) +
      sep +
      browseDispLine('Operating Margin', pv(agg.operatingMargin), false, true) +
      browseDispLine('Gross Margin',     pv(agg.grossMarginPct),  false, true) +
      browseDispLine('Net Margin',       pv(agg.netMarginPct),    false, true) +
      sep +
      browseDispLine('Expense Ratio',    pv(agg.expenseRatio),    false, true) +
      browseDispLine('Avg. Rev / Job',   mv(agg.avgRevPerJob, ''), false, true) +
      browseDispLine('Present / Future', '<span class="pb-slv">\u2014</span>', false, true)
    );
  }

  function buildBrowseFocusables() {
    browseFocusables = [];
    // Activity header button (always first)
    var actBtn = document.getElementById('pb-btn-activity');
    if (actBtn) browseFocusables.push({ type: 'activity-btn', el: actBtn });
    // Quick-create buttons
    var qcEls = el.content.querySelectorAll('.pb-qc[data-qc]');
    for (var qi = 0; qi < qcEls.length; qi++) {
      browseFocusables.push({ type: 'qc', el: qcEls[qi], kind: qcEls[qi].getAttribute('data-qc') });
    }
    // Activity filter chips
    var chipsRowEl = document.getElementById('pb-chips');
    if (chipsRowEl && !chipsRowEl.classList.contains('pb-chips-collapsed')) {
      var chipEls = chipsRowEl.querySelectorAll('.pb-chip');
      for (var ci = 0; ci < chipEls.length; ci++) {
        browseFocusables.push({ type: 'chip', el: chipEls[ci], letter: chipEls[ci].getAttribute('data-letter') });
      }
      var chipX = document.getElementById('pb-chips-x');
      if (chipX) browseFocusables.push({ type: 'chips-x', el: chipX });
    }
    var dateX = document.getElementById('pb-date-clear');
    if (dateX) browseFocusables.push({ type: 'date-x', el: dateX });
    var sumEl = document.getElementById('pb-summary');
    if (sumEl) {
      var navEls = sumEl.querySelectorAll('.pb-sl.nav');
      for (var ni = 0; ni < navEls.length; ni++) {
        browseFocusables.push({ type: 'summary', el: navEls[ni] });
      }
    }
    if (browseFocusIdx >= browseFocusables.length) browseFocusIdx = Math.max(0, browseFocusables.length - 1);
  }

  function applyBrowseFocus() {
    for (var i = 0; i < browseFocusables.length; i++) browseFocusables[i].el.classList.remove('dpfocus');
    var f = browseFocusables[browseFocusIdx];
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
    var cskEl = el.panel.querySelector('.sk-csk');
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
    strip.innerHTML = browseNavMode === 'line'
      ? '\u2195 line &middot; <em>* chunk</em>'
      : '\u2195 chunk &middot; <em>* line</em>';
  }

  // ── Activity picker popup ──────────────────────────────────────────────────

  function closeActPopup() {
    actAddMode = false;
    actPopupOpen = false;
    var pop = document.getElementById('pb-act-popup');
    if (pop) pop.remove();
  }

  function renderActPopup() {
    var prevAddMode = actAddMode;
    closeActPopup();
    actAddMode = prevAddMode;
    actPopupOpen = true;
    var acts = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];

    var itemsHtml;
    if (actAddMode) {
      itemsHtml =
        '<div class="pb-act-pop-add">' +
          '<input type="text" id="pb-act-add-input" placeholder="Activity name\u2026">' +
          '<div class="pb-act-pop-add-btns">' +
            '<span id="pb-act-add-cancel" style="color:var(--text-muted);cursor:pointer;">Cancel</span>' +
            '<span id="pb-act-add-save" style="color:var(--accent);cursor:pointer;">Save</span>' +
          '</div>' +
        '</div>';
    } else {
      itemsHtml = acts.map(function(act) {
        var sel = browseActivities.indexOf(act.id) !== -1;
        return '<div class="pb-act-pop-item' + (sel ? ' selected' : '') + '" data-act-id="' + esc(act.id) + '">' +
          '<span class="pb-act-pop-check">' + (sel ? '\u2713' : '\u00a0') + '</span>' +
          '<span class="pb-act-pop-name">' + esc(act.name) + '</span>' +
        '</div>';
      }).join('');
      if (!acts.length) itemsHtml = '<div class="pb-act-pop-empty">No activities yet.</div>';
      itemsHtml += '<div class="pb-act-pop-item pb-act-pop-add-new" id="pb-act-add-new">' +
        '<span class="pb-act-pop-check">+</span><span>Add new\u2026</span></div>';
    }

    var pop = document.createElement('div');
    pop.id = 'pb-act-popup';
    pop.className = 'pb-act-popup';
    pop.innerHTML =
      '<div class="pb-act-pop-hdr">' +
        '<span>Activities</span>' +
        '<span id="pb-act-pop-close" style="cursor:pointer;">\u00d7</span>' +
      '</div>' +
      '<div class="pb-act-pop-list">' + itemsHtml + '</div>' +
      '<div class="pb-act-pop-footer">' +
        '<span id="pb-act-pop-clear" style="color:var(--warn);">Clear all</span>' +
        '<span id="pb-act-pop-manage">Manage \u203a</span>' +
      '</div>';

    el.panel.appendChild(pop);

    document.getElementById('pb-act-pop-close').addEventListener('click', closeActPopup);
    document.getElementById('pb-act-pop-manage').addEventListener('click', function() {
      closeActPopup(); close(); App.showActivities();
    });
    document.getElementById('pb-act-pop-clear').addEventListener('click', function() {
      browseActivities = []; browseChipsOn = false;
      closeActPopup(); refreshChips();
    });

    if (actAddMode) {
      var inp = document.getElementById('pb-act-add-input');
      if (inp) setTimeout(function() { inp.focus(); }, 0);
      function saveNewActivity() {
        var val = inp ? inp.value.trim() : '';
        if (val && typeof WorkActivityService !== 'undefined') {
          var newAct = WorkActivityService.create(val);
          if (newAct && newAct.id) { browseActivities.push(newAct.id); browseChipsOn = true; }
        }
        actAddMode = false; renderActPopup(); refreshChips();
      }
      if (inp) inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === 'SoftRight') { e.preventDefault(); saveNewActivity(); }
        if (e.key === 'Escape' || e.key === 'SoftLeft' || (e.key === 'Backspace' && !inp.value)) {
          e.preventDefault(); actAddMode = false; renderActPopup();
        }
      });
      document.getElementById('pb-act-add-cancel').addEventListener('click', function() {
        actAddMode = false; renderActPopup();
      });
      document.getElementById('pb-act-add-save').addEventListener('click', saveNewActivity);
    } else {
      var addNewEl = document.getElementById('pb-act-add-new');
      if (addNewEl) addNewEl.addEventListener('click', function() {
        actAddMode = true; renderActPopup();
      });
      var rows = pop.querySelectorAll('.pb-act-pop-item[data-act-id]');
      for (var i = 0; i < rows.length; i++) {
        rows[i].addEventListener('click', (function(row) {
          return function() {
            var id  = row.getAttribute('data-act-id');
            var idx = browseActivities.indexOf(id);
            if (idx === -1) { browseActivities.push(id); browseChipsOn = true; }
            else { browseActivities.splice(idx, 1); if (!browseActivities.length) browseChipsOn = false; }
            renderActPopup(); refreshChips();
          };
        })(rows[i]));
      }
    }
  }

  function refreshChips() {
    var chipsEl = document.getElementById('pb-chips');
    if (!chipsEl) return;
    chipsEl.classList.toggle('pb-chips-collapsed', !browseChipsOn || !browseActivities.length);
    var html = '';
    for (var i = 0; i < browseActivities.length; i++) {
      var act = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.getById(browseActivities[i]) : null;
      var label = act ? act.name.slice(0, 10) : browseActivities[i].slice(0, 10);
      html += '<div class="pb-chip" data-act-id="' + esc(browseActivities[i]) + '">' + esc(label) + '</div>';
    }
    html += '<div class="pb-chip-x" id="pb-chips-x">\u2715</div>';
    chipsEl.innerHTML = html;
    var x = document.getElementById('pb-chips-x');
    if (x) x.addEventListener('click', function() { browseActivities = []; browseChipsOn = false; renderListPanel(); });
  }

  function renderListPanel() {
    var locale = ActivityService.getLocale();
    var act    = ActivityService.getActive();
    var name   = act ? (act.name || 'there') : 'there';
    var currency = locale.currency;
    if (!browseDateEnd) browseDateEnd = todayIso();

    // Panel-header icon click handlers (attached once per open)
    var btnAct = document.getElementById('pb-btn-activity');
    if (btnAct && !btnAct._wBound) {
      btnAct._wBound = true;
      btnAct.addEventListener('click', function() {
        if (actPopupOpen) closeActPopup(); else renderActPopup();
      });
    }
    var btnFin = document.getElementById('pb-btn-financial');
    if (btnFin && !btnFin._wBound) {
      btnFin._wBound = true;
      btnFin.addEventListener('click', function() { close(); App.showLedger(); });
    }

    var chipsCollapsed = !browseChipsOn || browseActivities.length === 0;
    var chipsHtml = '';
    if (!chipsCollapsed) {
      for (var ai = 0; ai < browseActivities.length; ai++) {
        var actObj = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.getById(browseActivities[ai]) : null;
        var chipLabel = actObj ? actObj.name.slice(0, 10) : browseActivities[ai].slice(0, 10);
        chipsHtml += '<div class="pb-chip" data-act-id="' + esc(browseActivities[ai]) + '">' + esc(chipLabel) + '</div>';
      }
    }

    function scopeTab(scope, label) {
      return '<div class="pb-scope-tab' + (browseScope === scope ? ' pb-scope-active' : '') + '" data-scope="' + scope + '">' + label + '</div>';
    }

    var dateStartTxt = browseDateStart ? fmtDate(browseDateStart) : '\u2014 start';
    var dateEndTxt   = fmtDate(browseDateEnd);

    el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    el.content.innerHTML =
      '<div class="pb-controls" id="pb-controls">' +
        '<div class="pb-greeting-row">' +
          '<div class="pb-greeting">Hello, ' + esc(name) + '.</div>' +
          '<div class="pb-switch" title="Switch user">\u21c4</div>' +
        '</div>' +
        '<div class="pb-qc-row">' +
          '<div class="pb-qc pb-qc-exp" data-qc="out">Exp</div>' +
          '<div class="pb-qc pb-qc-cogs" data-qc="cogs">COGS</div>' +
          '<div class="pb-qc pb-qc-inc" data-qc="in">Inc</div>' +
        '</div>' +
        '<div class="pb-scope-row">' +
          scopeTab('projects', 'PROJECTS') + scopeTab('tags', 'TAGS') + scopeTab('other', 'OTHER') +
        '</div>' +
        '<div class="pb-chips-row' + (chipsCollapsed ? ' pb-chips-collapsed' : '') + '" id="pb-chips">' +
          chipsHtml +
          '<div class="pb-chip-x" id="pb-chips-x">\u2715</div>' +
        '</div>' +
        '<div class="pb-date-row">' +
          '<div class="pb-date-box' + (browseDateStart ? '' : ' pb-date-empty') + '" id="pb-date-start">' + esc(dateStartTxt) + '</div>' +
          '<div class="pb-date-sep" id="pb-date-clear">\u2715</div>' +
          '<div class="pb-date-box" id="pb-date-end">' + esc(dateEndTxt) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pb-summary" id="pb-summary">' +
        renderBrowseSummaryLines(browseAgg, currency) +
      '</div>' +
      '<div class="pb-mode-strip" id="pb-mode-strip"></div>';

    updateBrowseModeStrip();

    // Bind controls
    var scopeTabs = el.content.querySelectorAll('.pb-scope-tab');
    for (var si = 0; si < scopeTabs.length; si++) {
      scopeTabs[si].addEventListener('click', (function(tab) {
        return function() {
          browseScope = tab.getAttribute('data-scope');
          for (var j = 0; j < scopeTabs.length; j++) {
            scopeTabs[j].classList.toggle('pb-scope-active', scopeTabs[j].getAttribute('data-scope') === browseScope);
          }
        };
      })(scopeTabs[si]));
    }

    var chipsXEl = document.getElementById('pb-chips-x');
    if (chipsXEl) {
      chipsXEl.addEventListener('click', function() {
        browseChipsOn = false; browseActivities = []; renderListPanel();
      });
    }

    var chipEls = el.content.querySelectorAll('.pb-chip');
    for (var chi = 0; chi < chipEls.length; chi++) {
      chipEls[chi].addEventListener('click', function() {
        if (browseActivities.length > 0 && typeof ListScreen !== 'undefined') {
          close();
          ListScreen.setActivityFilter(browseActivities.slice());
          App.showList();
        }
      });
    }

    var dateStartEl = document.getElementById('pb-date-start');
    if (dateStartEl) {
      dateStartEl.addEventListener('click', function() {
        if (browseDateStart) {
          browseDateStart = '';
          this.textContent = '\u2014 start';
          this.classList.add('pb-date-empty');
        } else {
          browseDateStart = new Date().toISOString().slice(0, 8) + '01';
          this.textContent = fmtDate(browseDateStart);
          this.classList.remove('pb-date-empty');
        }
      });
    }

    var dateClearEl = document.getElementById('pb-date-clear');
    if (dateClearEl) {
      dateClearEl.addEventListener('click', function() {
        browseDateStart = '';
        var s = document.getElementById('pb-date-start');
        if (s) { s.textContent = '\u2014 start'; s.classList.add('pb-date-empty'); }
      });
    }

    var qcEls = el.content.querySelectorAll('.pb-qc');
    for (var qi = 0; qi < qcEls.length; qi++) {
      qcEls[qi].addEventListener('click', (function(qc) {
        return function() { createFromPanel(qc.getAttribute('data-qc')); };
      })(qcEls[qi]));
    }

    // Summary line click handlers
    var navEls = el.content.querySelectorAll('.pb-sl.nav');
    for (var ni = 0; ni < navEls.length; ni++) {
      navEls[ni].addEventListener('click', (function(row) {
        return function() {
          var filter = row.getAttribute('data-filter');
          if (filter && typeof ListScreen !== 'undefined' && typeof App !== 'undefined') {
            close(); ListScreen.setFilter(filter); App.showList();
          }
        };
      })(navEls[ni]));
    }

    buildBrowseFocusables();
    applyBrowseFocus();

    // Load financial aggregation async, update summary when ready
    loadBrowseAgg(currency, function(agg) {
      var sumEl = document.getElementById('pb-summary');
      if (sumEl) {
        sumEl.innerHTML = renderBrowseSummaryLines(agg, currency);
        // Re-bind summary click handlers
        var newNavEls = sumEl.querySelectorAll('.pb-sl.nav');
        for (var nni = 0; nni < newNavEls.length; nni++) {
          newNavEls[nni].addEventListener('click', (function(row) {
            return function() {
              var filter = row.getAttribute('data-filter');
              if (filter && typeof ListScreen !== 'undefined' && typeof App !== 'undefined') {
                close(); ListScreen.setFilter(filter); App.showList();
              }
            };
          })(newNavEls[nni]));
        }
        buildBrowseFocusables();
        applyBrowseFocus();
      }
    });
  }

  function renderRecordPreview(rec) {
    if (!rec) { el.content.innerHTML = '<div class="panel-label">No record.</div>'; return; }
    // NewEnt business records get the plan section browser
    if ((rec.record_class || rec.recordClass || '') === 'newent' && rec.newent_slug) {
      renderNewEntPanel(rec);
      return;
    }
    if (rec.parentId) {
      renderChildPanel(rec);
    } else {
      renderJobPanel(rec);
    }
  }

  // ── NewEnt Wizard Panel (left panel when template #6 is active) ──────────
  // Shows the plan section browser with dots, dropdown, collapse, search.
  // This is the primary panel for the newent template experience.

  function renderNewEntWizardPanel() {
    var fd = context.formData || {};
    var editSlug = context.editingSlug;

    // Sync section index from main wizard if provided
    if (context.planSectionIdx !== undefined) {
      neState.sectionIdx = context.planSectionIdx;
    }

    // Build a virtual business object from form data for rendering
    var frameworkId = fd.industry_framework || 'generic';
    var sections = NewEntTemplate.FRAMEWORK_SECTIONS[frameworkId] || NewEntTemplate.FRAMEWORK_SECTIONS['generic'];
    if (!sections || !sections.length) sections = [{ slug: 'overview', title: 'Overview' }];
    if (neState.sectionIdx >= sections.length) neState.sectionIdx = 0;

    var currentSection = sections[neState.sectionIdx];

    // Build a virtual biz for content rendering
    var virtualBiz = {
      name: fd.name || '(New Business)',
      slug: fd.slug || '',
      stage: fd.stage || 'idea',
      industry_hint: fd.industry_hint || '',
      sections: sections,
      ent: {
        purpose: fd.ent_purpose || '',
        value: fd.ent_value || '',
        customer: fd.ent_customer || '',
        diff: fd.ent_diff || '',
        edge: fd.ent_edge || '',
        moat: fd.ent_moat || '',
        proof: fd.ent_proof || '',
        blocker: fd.ent_blocker || '',
      },
      profile: {
        vision: fd.vision || '',
        mission: fd.mission || '',
        founding_story: fd.founding_story || '',
      },
      plan: {
        title: fd.plan_title || 'Startup Plan',
        type: fd.plan_type || 'startup',
        industry_framework: frameworkId,
        audience_framework: fd.audience_framework || '',
      },
    };

    // If editing an existing business, merge stored ent data
    if (editSlug) {
      var stored = NewEntTemplate.get(editSlug);
      if (stored && stored.ent) {
        var entKeys = Object.keys(stored.ent);
        for (var ek = 0; ek < entKeys.length; ek++) {
          if (!virtualBiz.ent[entKeys[ek]]) {
            virtualBiz.ent[entKeys[ek]] = stored.ent[entKeys[ek]];
          }
        }
      }
    }

    neState.biz = virtualBiz;

    // Build dots
    var dotsHtml = sections.map(function(s, i) {
      var active = i === neState.sectionIdx ? ' ne-dot-active' : '';
      var filled = neEntSectionHasContent(virtualBiz, s.slug) ? ' ne-dot-filled' : '';
      return '<div class="ne-dot' + active + filled + '" data-ne-dot="' + i + '"></div>';
    }).join('');

    // Build section dropdown
    var selOpts = sections.map(function(s, i) {
      return '<option value="' + i + '"' + (i === neState.sectionIdx ? ' selected' : '') + '>' + esc(s.title) + '</option>';
    }).join('');

    // Build section content
    var bodyHtml = renderNewEntSectionBody(virtualBiz, currentSection);

    // Framework + audience labels
    var fwLabel = frameworkId;
    for (var fi = 0; fi < NewEntTemplate.INDUSTRY_FRAMEWORKS.length; fi++) {
      if (NewEntTemplate.INDUSTRY_FRAMEWORKS[fi].value === frameworkId) {
        fwLabel = NewEntTemplate.INDUSTRY_FRAMEWORKS[fi].label;
        break;
      }
    }

    el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    el.content.innerHTML =
      // Top bar with Plan button centered
      '<div class="ne-panel-topbar">' +
        '<div class="ne-panel-plan-btn" id="ne-plan-btn">' + esc(fwLabel) + '</div>' +
      '</div>' +
      // Toolbar: dropdown + toggle + search
      '<div class="ne-panel-toolbar">' +
        '<select class="ne-panel-sel" id="ne-panel-sel">' + selOpts + '</select>' +
        '<div class="ne-panel-toggle" id="ne-panel-toggle"></div>' +
        '<input class="ne-panel-search" id="ne-panel-search" type="text" placeholder="Search\u2026" value="' + esc(neState.searchTerm) + '">' +
      '</div>' +
      // Dots row
      '<div class="ne-panel-dots" id="ne-panel-dots">' + dotsHtml + '</div>' +
      // Section body
      '<div class="ne-panel-body' +
        (neState.collapseState === 1 ? ' ne-compact-1' : '') +
        (neState.collapseState === 2 ? ' ne-compact-2' : '') +
        '" id="ne-panel-body">' + bodyHtml + '</div>';

    // Bind: Plan button (shows framework name, clicking does nothing extra in wizard mode)
    var planBtn = document.getElementById('ne-plan-btn');
    if (planBtn) planBtn.addEventListener('click', function() {
      // Already in the wizard — just close the panel
      close();
    });

    // Bind: Section dropdown
    var selEl = document.getElementById('ne-panel-sel');
    if (selEl) selEl.addEventListener('change', function() {
      neState.sectionIdx = parseInt(this.value, 10) || 0;
      // Sync to main wizard screen
      if (typeof NewEntWizardScreen !== 'undefined' && NewEntWizardScreen.setSectionIdx) {
        NewEntWizardScreen.setSectionIdx(neState.sectionIdx);
      }
      renderNewEntWizardPanel();
    });

    // Bind: Toggle (3-state collapse)
    var togEl = document.getElementById('ne-panel-toggle');
    if (togEl) togEl.addEventListener('click', function() {
      neState.collapseState = (neState.collapseState + 1) % 3;
      renderNewEntWizardPanel();
    });

    // Bind: Search
    var searchEl = document.getElementById('ne-panel-search');
    if (searchEl) searchEl.addEventListener('input', function() {
      neState.searchTerm = this.value.trim().toLowerCase();
      filterNewEntBody();
    });

    // Bind: Dots click
    var dotEls = el.content.querySelectorAll('[data-ne-dot]');
    for (var di = 0; di < dotEls.length; di++) {
      dotEls[di].addEventListener('click', (function(idx) {
        return function() {
          neState.sectionIdx = idx;
          // Sync to main wizard screen
          if (typeof NewEntWizardScreen !== 'undefined' && NewEntWizardScreen.setSectionIdx) {
            NewEntWizardScreen.setSectionIdx(neState.sectionIdx);
          }
          renderNewEntWizardPanel();
        };
      })(parseInt(dotEls[di].getAttribute('data-ne-dot'), 10)));
    }

    // Bind: Click-to-expand in collapsed modes
    var bodyEl = document.getElementById('ne-panel-body');
    if (bodyEl) bodyEl.addEventListener('click', function(e) {
      if (neState.collapseState === 0) return;
      var field = e.target.closest ? e.target.closest('.ne-pf') : null;
      if (field) {
        neState.collapseState = 0;
        renderNewEntWizardPanel();
        setTimeout(function() {
          var fid = field.getAttribute('data-ne-fid');
          if (fid) {
            var target = document.querySelector('[data-ne-fid="' + fid + '"]');
            if (target) {
              target.scrollIntoView({ block: 'nearest' });
              target.classList.add('ne-flash');
              setTimeout(function() { target.classList.remove('ne-flash'); }, 1000);
            }
          }
        }, 50);
      }
    });
  }

  // ── NewEnt Business Plan Panel (for saved records viewed from list) ─────
  // Mirrors the view screen's toolbar: sections dropdown, 3-state collapse,
  // search bar, dots anchored to sections, Plan button in top bar.

  var neState = {
    sectionIdx: 0,
    collapseState: 0,  // 0=full, 1=partial-compact, 2=section-headers-only
    searchTerm: '',
    biz: null,
  };

  function renderNewEntPanel(rec) {
    var biz = NewEntTemplate.get(rec.newent_slug);
    if (!biz) {
      el.content.innerHTML = '<div class="panel-label">Business not found.</div>';
      return;
    }
    neState.biz = biz;
    var sections = biz.sections || [];
    if (!sections.length) sections = [{ slug: 'overview', title: 'Overview' }];
    if (neState.sectionIdx >= sections.length) neState.sectionIdx = 0;

    var currentSection = sections[neState.sectionIdx];

    // Build dots
    var dotsHtml = sections.map(function(s, i) {
      var active = i === neState.sectionIdx ? ' ne-dot-active' : '';
      var filled = neEntSectionHasContent(biz, s.slug) ? ' ne-dot-filled' : '';
      return '<div class="ne-dot' + active + filled + '" data-ne-dot="' + i + '"></div>';
    }).join('');

    // Build section dropdown options
    var selOpts = sections.map(function(s, i) {
      return '<option value="' + i + '"' + (i === neState.sectionIdx ? ' selected' : '') + '>' + esc(s.title) + '</option>';
    }).join('');

    // Build section content
    var bodyHtml = renderNewEntSectionBody(biz, currentSection);

    el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    el.content.innerHTML =
      // Top bar with Plan button centered
      '<div class="ne-panel-topbar">' +
        '<div class="ne-panel-plan-btn" id="ne-plan-btn">Plan</div>' +
      '</div>' +
      // Toolbar: dropdown + toggle + search
      '<div class="ne-panel-toolbar">' +
        '<select class="ne-panel-sel" id="ne-panel-sel">' + selOpts + '</select>' +
        '<div class="ne-panel-toggle" id="ne-panel-toggle"></div>' +
        '<input class="ne-panel-search" id="ne-panel-search" type="text" placeholder="Search\u2026" value="' + esc(neState.searchTerm) + '">' +
      '</div>' +
      // Dots row
      '<div class="ne-panel-dots" id="ne-panel-dots">' + dotsHtml + '</div>' +
      // Section body
      '<div class="ne-panel-body' +
        (neState.collapseState === 1 ? ' ne-compact-1' : '') +
        (neState.collapseState === 2 ? ' ne-compact-2' : '') +
        '" id="ne-panel-body">' + bodyHtml + '</div>';

    // Bind: Plan button
    var planBtn = document.getElementById('ne-plan-btn');
    if (planBtn) planBtn.addEventListener('click', function() {
      close();
      App.showNewEntWizard(biz.slug);
    });

    // Bind: Section dropdown
    var selEl = document.getElementById('ne-panel-sel');
    if (selEl) selEl.addEventListener('change', function() {
      neState.sectionIdx = parseInt(this.value, 10) || 0;
      renderNewEntPanel(rec);
    });

    // Bind: Toggle (3-state collapse)
    var togEl = document.getElementById('ne-panel-toggle');
    if (togEl) togEl.addEventListener('click', function() {
      neState.collapseState = (neState.collapseState + 1) % 3;
      renderNewEntPanel(rec);
    });

    // Bind: Search
    var searchEl = document.getElementById('ne-panel-search');
    if (searchEl) searchEl.addEventListener('input', function() {
      neState.searchTerm = this.value.trim().toLowerCase();
      filterNewEntBody();
    });

    // Bind: Dots click
    var dotEls = el.content.querySelectorAll('[data-ne-dot]');
    for (var di = 0; di < dotEls.length; di++) {
      dotEls[di].addEventListener('click', (function(idx) {
        return function() {
          neState.sectionIdx = idx;
          renderNewEntPanel(rec);
        };
      })(parseInt(dotEls[di].getAttribute('data-ne-dot'), 10)));
    }

    // Bind: Click-to-expand in collapsed modes
    var bodyEl = document.getElementById('ne-panel-body');
    if (bodyEl) bodyEl.addEventListener('click', function(e) {
      if (neState.collapseState === 0) return;
      var field = e.target.closest ? e.target.closest('.ne-pf') : null;
      if (field) {
        neState.collapseState = 0;
        renderNewEntPanel(rec);
        // Scroll to the clicked field after re-render
        setTimeout(function() {
          var fid = field.getAttribute('data-ne-fid');
          if (fid) {
            var target = document.querySelector('[data-ne-fid="' + fid + '"]');
            if (target) {
              target.scrollIntoView({ block: 'nearest' });
              target.classList.add('ne-flash');
              setTimeout(function() { target.classList.remove('ne-flash'); }, 1000);
            }
          }
        }, 50);
      }
    });
  }

  function neEntSectionHasContent(biz, slug) {
    // Check if any ent fields or profile data relate to this section
    if (!biz.ent) return false;
    var sectionEntMap = {
      'executive-summary': ['purpose', 'value', 'pitch', 'thesis'],
      'problem': ['pain', 'customer', 'switch'],
      'solution': ['diff', 'core', 'wedge'],
      'market': ['market', 'niche', 'category', 'trend'],
      'business-model': ['revenue', 'unit', 'margin', 'model'],
      'go-to-market': ['channel', 'cac', 'ltv', 'viral'],
      'competition': ['rival', 'threat', 'moat', 'edge'],
      'team': ['founder', 'team', 'hire'],
      'financials': ['runway', 'raise', 'unit'],
      'risk': ['risks', 'blocker', 'anchor', 'scenario'],
      'operations': ['constraint', 'speed', 'flow', 'depend'],
      'overview': ['purpose', 'value', 'customer', 'diff'],
    };
    var fields = sectionEntMap[slug] || [];
    for (var i = 0; i < fields.length; i++) {
      if (biz.ent[fields[i]]) return true;
    }
    return false;
  }

  function renderNewEntSectionBody(biz, section) {
    var slug = section.slug;
    var html = '';

    // Section header
    html += '<div class="ne-pf ne-pf-hdr" data-ne-fid="hdr-' + esc(slug) + '">' +
      '<div class="ne-pf-title">' + esc(section.title) + '</div>' +
      '</div>';

    // Map section to relevant ent fields
    var sectionEntMap = {
      'executive-summary': ['purpose', 'value', 'pitch', 'thesis', 'model'],
      'problem': ['pain', 'customer', 'switch', 'core'],
      'solution': ['diff', 'core', 'wedge'],
      'consumer-problem': ['pain', 'customer', 'switch'],
      'product': ['diff', 'core'],
      'market': ['market', 'niche', 'category', 'trend', 'window'],
      'business-model': ['revenue', 'unit', 'margin', 'model'],
      'go-to-market': ['channel', 'cac', 'ltv', 'wedge'],
      'channels': ['channel', 'cac'],
      'competition': ['rival', 'threat', 'moat', 'edge', 'myth'],
      'team': ['founder', 'team', 'hire'],
      'financials': ['runway', 'raise', 'unit', 'margin'],
      'risk': ['risks', 'blocker', 'anchor', 'scenario', 'hedge'],
      'operations': ['constraint', 'speed', 'flow', 'depend', 'tech'],
      'supply-chain': ['depend', 'constraint'],
      'quality-compliance': ['constraint'],
      'production': ['speed', 'constraint', 'tech'],
      'client-problem': ['pain', 'customer', 'switch'],
      'service-offering': ['diff', 'core', 'wedge'],
      'delivery-model': ['speed', 'flow'],
      'pricing': ['revenue', 'unit', 'margin'],
      'mission-problem': ['purpose', 'pain'],
      'programs': ['core', 'diff'],
      'beneficiaries': ['customer'],
      'impact': ['star', 'proof'],
      'overview': ['purpose', 'value', 'customer', 'diff', 'revenue', 'star', 'focus'],
    };

    var fields = sectionEntMap[slug] || ['purpose', 'value', 'diff'];

    // Find field metadata from ENT_GROUPS
    var allEntFields = {};
    var groups = Object.keys(NewEntTemplate.ENT_GROUPS);
    for (var g = 0; g < groups.length; g++) {
      var gFields = NewEntTemplate.ENT_GROUPS[groups[g]];
      for (var f = 0; f < gFields.length; f++) {
        allEntFields[gFields[f].id] = gFields[f];
      }
    }

    for (var i = 0; i < fields.length; i++) {
      var fid = fields[i];
      var meta = allEntFields[fid];
      var val = biz.ent ? biz.ent[fid] || '' : '';
      var label = meta ? meta.label : fid;
      var prompt = meta ? meta.prompt : '';

      html += '<div class="ne-pf" data-ne-fid="' + esc(fid) + '">' +
        '<div class="ne-pf-label">' + esc(label) + '</div>' +
        '<div class="ne-pf-val' + (val ? '' : ' ne-pf-empty') + '">' +
          (val ? esc(val) : '<span class="ne-pf-prompt">' + esc(prompt) + '</span>') +
        '</div>' +
      '</div>';
    }

    // Profile fields for relevant sections
    if (slug === 'executive-summary' || slug === 'overview') {
      if (biz.profile) {
        if (biz.profile.vision) {
          html += '<div class="ne-pf" data-ne-fid="vision"><div class="ne-pf-label">Vision</div><div class="ne-pf-val">' + esc(biz.profile.vision) + '</div></div>';
        }
        if (biz.profile.mission) {
          html += '<div class="ne-pf" data-ne-fid="mission"><div class="ne-pf-label">Mission</div><div class="ne-pf-val">' + esc(biz.profile.mission) + '</div></div>';
        }
      }
    }

    return html;
  }

  function filterNewEntBody() {
    var term = neState.searchTerm;
    var bodyEl = document.getElementById('ne-panel-body');
    if (!bodyEl) return;
    var fields = bodyEl.querySelectorAll('.ne-pf');
    for (var i = 0; i < fields.length; i++) {
      if (!term) {
        fields[i].style.display = '';
      } else {
        var text = fields[i].textContent.toLowerCase();
        fields[i].style.display = text.indexOf(term) !== -1 ? '' : 'none';
      }
    }
  }

  function renderJobPanel(rec) {
    var currency = rec.currency || '';
    el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    el.content.innerHTML =
      '<div class="pb-rec-identity">' +
        '<div class="pb-rec-title">' + esc((rec.job || '(untitled)').slice(0, 26)) + '</div>' +
        '<div class="pb-rec-meta">' +
          (rec.date ? esc(rec.date.slice(5)) : '') +
          (rec.customer ? ' \u00b7 ' + esc(rec.customer.slice(0, 16)) : '') +
        '</div>' +
      '</div>' +
      '<div id="pb-job-fin" class="pb-rec-fin">' +
        '<div style="padding:4px 8px;color:var(--text-muted);font-size:10px;">Loading\u2026</div>' +
      '</div>' +
      '<div id="pb-job-children" class="pb-rec-children"></div>' +
      '<div class="pb-qc-row">' +
        '<div class="pb-qc pb-qc-exp" data-qc="out">+ Exp</div>' +
        '<div class="pb-qc pb-qc-cogs" data-qc="cogs">+ COGS</div>' +
        '<div class="pb-qc pb-qc-inc" data-qc="in">+ Pmt</div>' +
      '</div>';

    var qcEls = el.content.querySelectorAll('.pb-qc[data-qc]');
    for (var qi = 0; qi < qcEls.length; qi++) {
      qcEls[qi].addEventListener('click', (function(kind) {
        return function() { createFromPanel(kind); };
      })(qcEls[qi].getAttribute('data-qc')));
    }

    RecordService.listChildren(rec.id).then(function(children) {
      function mv(v, cls) { return '<span class="pb-slv ' + (cls || '') + '">' + money(currency, v) + '</span>'; }
      var summary = FinancialModel.summarize(rec, children);

      var finEl = document.getElementById('pb-job-fin');
      if (finEl) {
        finEl.innerHTML =
          '<div class="pb-sl"><span class="pb-sll">Billed</span>' + mv(summary.price, summary.price ? 'pos' : '') + '</div>' +
          '<div class="pb-sl"><span class="pb-sll">Received</span>' + mv(summary.paidTotal, summary.paidTotal ? 'pos' : '') + '</div>' +
          (summary.outstanding > 0 ? '<div class="pb-sl"><span class="pb-sll">Outstanding</span>' + mv(summary.outstanding, 'warn') + '</div>' : '') +
          (summary.tax ? '<div class="pb-sl"><span class="pb-sll mute">Tax</span>' + mv(summary.tax, '') + '</div>' : '');
      }

      var childEl = document.getElementById('pb-job-children');
      if (childEl && children.length) {
        var childRows = children.slice(0, 6).map(function(ch) {
          var chRt = (ch.record_type || ch.recordType || '').toLowerCase();
          var chBilling = (ch.expense_billing || '').toLowerCase();
          var chBadge = chRt === 'expense'
            ? (chBilling === 'cogs' ? '<span class="rt-badge rt-cogs">COGS</span>' : '<span class="rt-badge rt-exp">EXP</span>')
            : (chRt === 'payment' ? '<span class="rt-badge rt-pmt">PMT</span>' : '<span class="rt-badge rt-inc">INC</span>');
          return '<div class="pb-child-row" data-sub-id="' + esc(ch.id) + '">' +
            chBadge +
            '<span class="pb-child-name">' + esc((ch.job || ch.description || ch.story || 'Entry').slice(0, 15)) + '</span>' +
            '<span class="pb-child-amt">' + money(currency, ch.amount || 0) + '</span>' +
            '</div>';
        }).join('');
        childEl.innerHTML = '<div class="pb-children-hdr">Items (' + children.length + ')</div>' + childRows;
        var subEls = childEl.querySelectorAll('[data-sub-id]');
        for (var i = 0; i < subEls.length; i++) {
          subEls[i].addEventListener('click', (function(sid) {
            return function() {
              RecordService.get(sid).then(function(sub) { if (sub) { close(); App.showView(sub); } });
            };
          })(subEls[i].getAttribute('data-sub-id')));
        }
      }
    });
  }

  function renderChildPanel(rec) {
    var rt = (rec.record_type || rec.recordType || '').toLowerCase();
    var billing = (rec.expense_billing || '').toLowerCase();
    var badge = rt === 'expense'
      ? (billing === 'cogs' ? '<span class="rt-badge rt-cogs">COGS</span>' : '<span class="rt-badge rt-exp">EXP</span>')
      : (rt === 'payment' ? '<span class="rt-badge rt-pmt">PMT</span>' : '<span class="rt-badge rt-inc">INC</span>');
    var billingLabel = billing === 'cogs' ? 'Job cost' : (billing === 'customer' ? 'Billable' : (billing || '\u2014'));
    var currency = rec.currency || '';

    el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    el.content.innerHTML =
      '<div class="pb-child-identity">' +
        '<div class="pb-child-id-row">' + badge +
          '<span class="pb-child-id-title">' + esc((rec.description || rec.job || '(untitled)').slice(0, 22)) + '</span>' +
        '</div>' +
        '<div class="pb-child-id-amt">' + money(currency, rec.amount || 0) + '</div>' +
      '</div>' +
      '<div class="pb-parent-crumb" id="pb-parent-crumb">' +
        '<span class="pb-parent-arrow">\u2191</span>' +
        '<span id="pb-parent-title">Loading\u2026</span>' +
      '</div>' +
      '<div class="pb-rec-fin">' +
        (rec.date ? '<div class="pb-sl"><span class="pb-sll mute">Date</span><span class="pb-slv">' + esc(rec.date.slice(5)) + '</span></div>' : '') +
        (billing ? '<div class="pb-sl"><span class="pb-sll mute">Billing</span><span class="pb-slv">' + esc(billingLabel) + '</span></div>' : '') +
        (rec.vendor ? '<div class="pb-sl"><span class="pb-sll mute">Vendor</span><span class="pb-slv">' + esc(rec.vendor.slice(0, 14)) + '</span></div>' : '') +
      '</div>' +
      '<div class="pb-qc-row" style="margin-top:auto;">' +
        '<div class="pb-qc pb-qc-edit" id="pb-child-edit">\u270e Edit</div>' +
        '<div class="pb-qc pb-qc-share" id="pb-child-share">&#8599; Share</div>' +
      '</div>';

    var editBtn = document.getElementById('pb-child-edit');
    if (editBtn) editBtn.addEventListener('click', function() { close(); App.showWizard(rec); });
    var shareBtn = document.getElementById('pb-child-share');
    if (shareBtn) shareBtn.addEventListener('click', function() { close(); App.showShare(rec); });

    if (rec.parentId) {
      RecordService.get(rec.parentId).then(function(parent) {
        var titleEl = document.getElementById('pb-parent-title');
        var crumbEl = document.getElementById('pb-parent-crumb');
        if (!titleEl) return;
        if (parent) {
          titleEl.textContent = parent.job || '(untitled)';
          if (crumbEl) crumbEl.addEventListener('click', function() { close(); App.showView(parent); });
        } else {
          titleEl.textContent = '(not found)';
        }
      });
    }
  }

  function renderWizardContext() {
    var rec = context.record;
    var ws  = context.wizardScreen || 0;
    if (!rec) {
      el.content.innerHTML = '<div class="panel-label">No draft context.</div>';
      return;
    }

    var isPads = String((rec && (rec.record_class || rec.recordClass || rec.record_type || rec.recordType)) || '').toLowerCase() === 'pads';
    var stepNames = isPads
      ? ['Process', 'Actions', 'Details', 'Story']
      : ['Process', 'Actions', 'Details', 'Story', 'Finance'];
    var stepName = stepNames[ws] || 'Process';
    RecordService.listChildren(rec.id).then(function(children) {
      var summary = FinancialModel.summarize(rec, children);
      var filledP = isPads ? (rec.pads_process ? 1 : 0) : ((rec.job ? 1 : 0) + (rec.customer ? 1 : 0) + (rec.date ? 1 : 0));
      var actionsCount = isPads ? (rec.pads_actions ? 1 : 0) : (rec.actions || []).length;
      var notesCount = isPads ? 0 : (rec.actions || []).filter(function(a) { return a && a.notes; }).length;
      var detailsFilled = isPads ? (rec.pads_details ? 1 : 0) : ((rec.worker ? 1 : 0) + (rec.location ? 1 : 0) + (rec.customer_phone ? 1 : 0) + (rec.start_time ? 1 : 0) + (rec.end_time ? 1 : 0));
      var storyFilled = isPads ? (rec.pads_story ? 1 : 0) : ((rec.story ? 1 : 0) + (rec.details ? 1 : 0));
      var warnings = [];
      if (isPads) {
        if (!rec.pads_process) warnings.push('Missing Process text');
        if (!rec.pads_actions) warnings.push('Missing Actions text');
        if (!rec.pads_details) warnings.push('Missing Details text');
      } else {
        if (!rec.job) warnings.push('Missing job title');
        if (!rec.customer) warnings.push('Missing customer');
        if (summary.cogs.unlinked > 0) warnings.push('Unlinked COGS: ' + money(rec.currency, summary.cogs.unlinked));
        if (summary.total && summary.paidTotal <= 0) warnings.push('No payments recorded');
        if (actionsCount && notesCount < actionsCount) warnings.push('Some actions have no note');
      }
      var warnHtml = warnings.length ? warnings.slice(0, 3).map(function(w) {
        return '<div class="panel-value panel-mini" style="color:var(--warn);">• ' + esc(w) + '</div>';
      }).join('') : '<div class="panel-value panel-mini" style="color:var(--green);">No immediate warnings</div>';

      el.content.innerHTML =
        '<div class="panel-section">' +
          '<div class="panel-label">Step</div>' +
          '<div class="panel-value" style="font-weight:bold;">' + esc(stepName) + ' (' + (ws + 1) + '/' + stepNames.length + ')</div>' +
          '<div class="panel-value panel-mini">' +
            (isPads
              ? ('P ' + filledP + '/1 · A ' + actionsCount + '/1 · D ' + detailsFilled + '/1 · S ' + storyFilled + '/1')
              : ('P ' + filledP + '/3 · A ' + actionsCount + ' · D ' + detailsFilled + '/5 · S ' + storyFilled + '/2')) +
          '</div>' +
        '</div>' +
        (isPads ? '' : '<div class="panel-section panel-moneybar-actions">' +
          '<div class="panel-label">Quick Lines</div>' +
          '<div class="moneybar-btn-row">' +
            '<div class="moneybar-btn moneybar-out' + (finActionIdx === 0 ? ' focused' : '') + '"><span class="moneybar-arrow">&#8599;</span> Out</div>' +
            '<div class="moneybar-btn moneybar-cogs' + (finActionIdx === 1 ? ' focused' : '') + '"><span class="moneybar-arrow">&#8613;</span> COGS</div>' +
            '<div class="moneybar-btn moneybar-in' + (finActionIdx === 2 ? ' focused' : '') + '"><span class="moneybar-arrow">&#8601;</span> In</div>' +
          '</div>' +
          '<div class="panel-value panel-mini">&#8593;/&#8595; Select · Enter Add ' + panelActionLabel(finActionIdx) + '</div>' +
        '</div>') +
        (isPads ? '' : '<div class="panel-section">' +
          '<div class="panel-label">Money Snapshot</div>' +
          '<div class="panel-value">Out: ' + money(rec.currency, summary.billedTotal) + '</div>' +
          '<div class="panel-value">COGS: ' + money(rec.currency, summary.cogsTotal) + '</div>' +
          '<div class="panel-value">In: ' + money(rec.currency, summary.paidTotal) + '</div>' +
          (summary.total ? '<div class="panel-value panel-mini">Due: ' + money(rec.currency, Math.max(0, summary.outstanding)) + '</div>' : '') +
        '</div>') +
        '<div class="panel-section">' +
          '<div class="panel-label">Warnings</div>' + warnHtml +
        '</div>';
    });
  }

  function renderShareContext() {
    var rec = context.record;
    var url = context.url || '';
    if (!rec) { el.content.innerHTML = '<div class="panel-label">No record.</div>'; return; }
    var rt = (rec.record_type || rec.recordType || '').toLowerCase();
    var badge = rt === 'expense' ? '<span class="rt-badge rt-exp">EXP</span>' :
                rt === 'payment' ? '<span class="rt-badge rt-pmt">PMT</span>' : '';
    el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    el.content.innerHTML =
      '<div class="pb-rec-identity">' +
        '<div class="pb-rec-title">' + badge + esc((rec.job || '(untitled)').slice(0, 24)) + '</div>' +
        '<div class="pb-rec-meta">Ready to share</div>' +
      '</div>' +
      '<div class="pb-rec-fin">' +
        '<div class="pb-sl"><span class="pb-sll mute">Format</span><span class="pb-slv">URL \u00b7 bitpad-c</span></div>' +
        (url ? '<div class="pb-sl"><span class="pb-sll mute">Size</span><span class="pb-slv">' + url.length + ' chars</span></div>' : '') +
        (rec.chainRef ? '<div class="pb-sl"><span class="pb-sll mute">Chain</span><span class="pb-slv" style="font-family:monospace;">' + esc(rec.chainRef.slice(0, 6)) + '</span></div>' : '') +
        (rec.customer ? '<div class="pb-sl"><span class="pb-sll mute">To</span><span class="pb-slv">' + esc(rec.customer.slice(0, 16)) + '</span></div>' : '') +
      '</div>' +
      '<div style="padding:8px 10px;font-size:10px;color:var(--text-muted);">CSK \u2192 Copy to clipboard</div>';
  }

  function renderManagementContext() {
    var currentTab = context.tab || 'records';
    var focusIdx = MGMT_TABS.indexOf(currentTab);
    if (focusIdx < 0) focusIdx = 0;
    mgmtPanelFocusIdx = focusIdx;
    el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    el.content.innerHTML =
      '<div class="pb-mgmt-hdr">Navigate</div>' +
      MGMT_TABS.map(function(tab, i) {
        var isActive = tab === currentTab;
        return '<div class="pb-mgmt-row' + (isActive ? ' pb-mgmt-active' : '') + (mgmtPanelFocusIdx === i ? ' dpfocus' : '') +
          '" data-mgmt-tab="' + tab + '">' +
          '<span class="pb-mgmt-dot">' + (isActive ? '\u25cf' : '\u25cb') + '</span>' +
          '<span class="pb-mgmt-name">' + esc(MGMT_TAB_LABELS[tab]) + '</span>' +
          '</div>';
      }).join('');

    var rows = el.content.querySelectorAll('[data-mgmt-tab]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', (function(tab, idx) {
        return function() {
          mgmtPanelFocusIdx = idx;
          context.tab = tab;
          if (typeof ManagementScreen !== 'undefined') ManagementScreen.showTab(tab);
          renderManagementContext();
        };
      })(rows[i].getAttribute('data-mgmt-tab'), i));
    }
  }

  function applyMgmtPanelFocus() {
    var rows = el.content.querySelectorAll('[data-mgmt-tab]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('dpfocus', i === mgmtPanelFocusIdx);
    }
  }

  function scrollContent(dir) {
    el.content.scrollTop += dir * 30;
  }

  function navigateFinancialAction(dir) {
    var rec = context.record;
    if (!isOpen || !rec || (context.screen !== 'view' && context.screen !== 'wizard')) return false;
    if (rec.parentId) return false; // child records don't support quick-create sub-items
    var isPads = String((rec.record_class || rec.recordClass || rec.record_type || rec.recordType) || '').toLowerCase() === 'pads';
    if (isPads && context.screen === 'wizard') return false;
    finActionIdx = Math.max(0, Math.min(2, finActionIdx + dir));
    if (context.screen === 'wizard') renderWizardContext();
    else renderRecordPreview(rec);
    return true;
  }

  function navigateList(dir) {
    if (!isOpen) return false;
    if (context.screen === 'management') {
      mgmtPanelFocusIdx = Math.max(0, Math.min(MGMT_TABS.length - 1, mgmtPanelFocusIdx + dir));
      applyMgmtPanelFocus();
      return true;
    }
    if (context.screen !== 'list') return false;
    if (browseNavMode === 'chunk') {
      var sumEl = document.getElementById('pb-summary');
      if (sumEl) sumEl.scrollTop += dir * 48;
      return true;
    }
    if (!browseFocusables.length) return true;
    browseFocusIdx = Math.max(0, Math.min(browseFocusables.length - 1, browseFocusIdx + dir));
    applyBrowseFocus();
    return true;
  }

  function cycleListTab(dir) {
    if (!isOpen) return false;
    // NewEnt panel (wizard or view): left/right moves through section dots
    if ((context.screen === 'newent-wizard') ||
        (context.screen === 'view' && context.record &&
         (context.record.record_class || context.record.recordClass) === 'newent' &&
         context.record.newent_slug)) {
      var biz = neState.biz;
      if (biz && biz.sections && biz.sections.length > 1) {
        neState.sectionIdx = (neState.sectionIdx + dir + biz.sections.length) % biz.sections.length;
        if (context.screen === 'newent-wizard') {
          renderNewEntWizardPanel();
        } else {
          renderNewEntPanel(context.record);
        }
        return true;
      }
      return false;
    }
    if (context.screen !== 'list') return false;
    var scopes = ['projects', 'tags', 'other'];
    var idx = scopes.indexOf(browseScope);
    if (idx < 0) idx = 0;
    browseScope = scopes[(idx + dir + scopes.length) % scopes.length];
    var tabs = el.content.querySelectorAll('.pb-scope-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('pb-scope-active', tabs[i].getAttribute('data-scope') === browseScope);
    }
    return true;
  }

  function toggleNavMode() {
    if (!isOpen || context.screen !== 'list') return false;
    browseNavMode = browseNavMode === 'line' ? 'chunk' : 'line';
    updateBrowseModeStrip();
    if (browseNavMode === 'line') applyBrowseFocus();
    else {
      for (var i = 0; i < browseFocusables.length; i++) browseFocusables[i].el.classList.remove('dpfocus');
    }
    return true;
  }

  function handleEnter() {
    var rec = context.record;
    if (!isOpen) return false;
    if (context.screen === 'management') {
      var tab = MGMT_TABS[mgmtPanelFocusIdx];
      if (tab) {
        context.tab = tab;
        if (typeof ManagementScreen !== 'undefined') ManagementScreen.showTab(tab);
        renderManagementContext();
      }
      return true;
    }
    if (context.screen === 'list') {
      var f = browseFocusables[browseFocusIdx];
      if (!f) return true;
      if (f.type === 'activity-btn') {
        if (actPopupOpen) closeActPopup(); else renderActPopup();
        return true;
      }
      if (f.type === 'qc') {
        createFromPanel(f.kind);
        return true;
      }
      if (f.type === 'chip') {
        close(); /* TODO: App.showActivityDetail(f.letter) */
        return true;
      }
      if (f.type === 'chips-x') {
        browseChipsOn = false; browseActivities = []; renderListPanel();
        return true;
      }
      if (f.type === 'date-x') {
        browseDateStart = '';
        var s = document.getElementById('pb-date-start');
        if (s) { s.textContent = '\u2014 start'; s.classList.add('pb-date-empty'); }
        buildBrowseFocusables(); applyBrowseFocus();
        return true;
      }
      if (f.type === 'summary') {
        var filter = f.el.getAttribute('data-filter');
        if (filter && typeof ListScreen !== 'undefined' && typeof App !== 'undefined') {
          close(); ListScreen.setFilter(filter); App.showList();
        }
        return true;
      }
      return true;
    }
    if (!rec || (context.screen !== 'view' && context.screen !== 'wizard')) return false;
    if (finActionIdx === 0) return createFromPanel('out');
    if (finActionIdx === 1) return createFromPanel('cogs');
    return createFromPanel('in');
  }

  function focusedRecord() {
    return context.record || null;
  }

  // Panel-internal softkey click handlers (bypass global browser-dev binding)
  (function() {
    var lsk = el.panel.querySelector('.sk-lsk');
    var csk = el.panel.querySelector('.sk-csk');
    var rsk = el.panel.querySelector('.sk-rsk');
    if (lsk) lsk.addEventListener('click', function() { close(); });
    if (csk) csk.addEventListener('click', function() {
      if (!handleEnter()) {
        var rec = focusedRecord();
        close();
        if (rec && typeof App !== 'undefined') App.showView(rec);
      }
    });
    if (rsk) rsk.addEventListener('click', function() {
      close();
      if (typeof App !== 'undefined') App.showManagement();
    });
  }());

  global.WorkpadsPanel = {
    open: open,
    close: close,
    toggle: toggle,
    setContext: setContext,
    scrollContent: scrollContent,
    navigateFinancialAction: navigateFinancialAction,
    navigateList: navigateList,
    cycleListTab: cycleListTab,
    toggleNavMode: toggleNavMode,
    handleEnter: handleEnter,
    focusedRecord: focusedRecord,
    isOpen: function() { return isOpen; },
    lastContext: function() { return lastContext; },
    showBackdrop: showBackdrop,
    hideBackdrop: hideBackdrop,
  };

}(window));
