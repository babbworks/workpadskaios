// Screen: Wizard — PADS class defaults to 4 screens (Process / Actions / Details / Story)
// Exposes: window.WizardScreen

(function(global) {
  'use strict';

  var SCREENS_BASE = [
    { name: 'Process',    tab: 'P' },
    { name: 'Actions',    tab: 'A' },
    { name: 'Details',    tab: 'D' },
    { name: 'Story',      tab: 'S' },
  ];
  var SCREENS_FIN = [
    { name: 'Process',    tab: 'P' },
    { name: 'Actions',    tab: 'A' },
    { name: 'Details',    tab: 'D' },
    { name: 'Story',      tab: 'S' },
    { name: 'Financials', tab: 'F' },
  ];

  var FIN_TABS = ['Amount', 'Expenses', 'Payments'];

  var WIZ_TYPES = [
    { value: '',        label: 'Job'     },
    { value: 'quote',   label: 'Quote'   },
    { value: 'invoice', label: 'Invoice' },
    { value: 'receipt', label: 'Receipt' },
    { value: 'pads',    label: 'Basic'   },
  ];

  var el = {
    title:   document.getElementById('wizard-title'),
    tabs:    document.getElementById('wizard-tabs').querySelectorAll('.wizard-tab'),
    dots:    document.getElementById('wizard-dots').querySelectorAll('.wizard-dot'),
    content: document.getElementById('wizard-content'),
    csk:     document.getElementById('wiz-csk'),
  };

  var currentRecord    = null;
  var currentScreen    = 0;
  var actions          = [];
  var actionFocusIdx   = 0;
  var finTab           = 0;   // 0=Amount, 1=Expenses, 2=Payments
  var cachedChildren   = [];  // child records loaded from DB (expenses + payments)
  var finFocusIdx      = 0;
  var entryRecord      = null; // set when editing from view — used for goBack / post-save nav
  var typePickerOpen   = false;
  var typePickerFocusIdx = 0;

  function currencyTabLabel() {
    var locale = ActivityService.getLocale();
    var c = (locale && locale.currency) || '';
    if (c === 'GBP') return '\u00a3';
    if (c === 'USD' || c === 'CAD' || c === 'AUD' || c === 'NZD') return '$';
    if (c === 'EUR') return '\u20ac';
    if (c === 'JPY' || c === 'CNY') return '\u00a5';
    if (c === 'INR') return '\u20b9';
    return 'Fin';
  }

  function isPadsClass(rec) {
    var c = rec && (rec.record_class || rec.recordClass || rec.record_type || rec.recordType);
    return String(c || '').toLowerCase() === 'pads';
  }

  function hasFinancialStep() {
    return !isPadsClass(currentRecord);
  }

  function getScreens() {
    return hasFinancialStep() ? SCREENS_FIN : SCREENS_BASE;
  }

  // ── Progress indicators ──────────────────────────────────────────────────

  function updateProgress() {
    var screens = getScreens();
    el.tabs.forEach(function(t, i) {
      t.classList.toggle('active', i === currentScreen);
      if (!screens[i]) {
        t.textContent = '';
        t.style.display = 'none';
        return;
      }
      t.style.display = '';
      if (i === 4) t.textContent = currencyTabLabel();
      else t.textContent = screens[i].tab;
    });
    el.dots.forEach(function(d, i) {
      if (!screens[i]) {
        d.style.display = 'none';
        return;
      }
      d.style.display = '';
      d.classList.toggle('active', i === currentScreen);
    });
    el.title.textContent = screens[currentScreen].name;
  }

  function updateSoftkeys() {
    el.csk.textContent = currentScreen < (getScreens().length - 1) ? 'Next' : 'Save';
  }

  // ── Field helpers ────────────────────────────────────────────────────────

  function fieldGroup(id, label, value, type) {
    return '<div class="field-group">' +
      '<div class="field-label">' + label + '</div>' +
      '<input class="field-input" id="f-' + id + '" type="' + (type || 'text') + '" ' +
        'value="' + esc(value) + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
      '</div>';
  }

  function selectGroup(id, label, opts, selected) {
    var options = opts.map(function(o) {
      return '<option value="' + esc(o.val) + '"' + (o.val === selected ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
    return '<div class="field-group">' +
      '<div class="field-label">' + label + '</div>' +
      '<select class="field-input" id="f-' + id + '">' + options + '</select>' +
      '</div>';
  }

  // ── Read inputs ──────────────────────────────────────────────────────────

  function readInputs() {
    if (!currentRecord) return;
    var ids = ['job','customer','date','location','start_time','end_time',
               'meeting_time','customer_phone','worker','details','story'];
    ids.forEach(function(id) {
      var inp = document.getElementById('f-' + id);
      if (inp) currentRecord[id] = inp.value.trim() || undefined;
    });
    if (isPadsClass(currentRecord)) {
      var pIn = document.getElementById('f-pads-process');
      var aIn = document.getElementById('f-pads-actions');
      var dIn = document.getElementById('f-pads-details');
      var sIn = document.getElementById('f-pads-story');
      if (pIn) currentRecord.pads_process = pIn.value.trim() || undefined;
      if (aIn) currentRecord.pads_actions = aIn.value.trim() || undefined;
      if (dIn) currentRecord.pads_details = dIn.value.trim() || undefined;
      if (sIn) currentRecord.pads_story = sIn.value.trim() || undefined;
      currentRecord.actions = undefined;
      return;
    }
    var actSel = document.getElementById('f-activity-id');
    if (actSel !== null) currentRecord.activityId = actSel.value || undefined;
    currentRecord.actions = actions.slice();
    // Financial fields (screen 4)
    var finIds = ['fin-record_type', 'fin-amount', 'fin-vat'];
    finIds.forEach(function(id) {
      var inp = document.getElementById('f-' + id);
      if (inp) {
        var key = id.replace('fin-', '');
        currentRecord[key] = inp.value.trim() || undefined;
      }
    });
  }

  // ── Screen 0: Process ────────────────────────────────────────────────────

  function renderProcess() {
    var r = currentRecord;
    if (isPadsClass(r)) {
      el.content.innerHTML =
        '<div class="field-group">' +
          '<div class="field-label">Process</div>' +
          '<textarea class="field-input" id="f-pads-process" rows="8" style="height:132px;resize:none;">' +
            esc(r.pads_process || r.job || '') + '</textarea>' +
        '</div>';
      var padsFirst = document.getElementById('f-pads-process');
      if (padsFirst) padsFirst.focus();
      return;
    }
    el.content.innerHTML =
      fieldGroup('job',      'Job *',    r.job      || '') +
      fieldGroup('customer', 'Customer', r.customer || '') +
      fieldGroup('date',     'Date',     r.date     || '', 'date');
    var first = document.getElementById('f-job');
    if (first) first.focus();
  }

  // ── Screen 1: Actions ────────────────────────────────────────────────────

  function renderActions() {
    if (isPadsClass(currentRecord)) {
      el.content.innerHTML =
        '<div class="field-group">' +
          '<div class="field-label">Actions</div>' +
          '<textarea class="field-input" id="f-pads-actions" rows="8" style="height:132px;resize:none;">' +
            esc(currentRecord.pads_actions || '') + '</textarea>' +
        '</div>';
      var padsFirst = document.getElementById('f-pads-actions');
      if (padsFirst) padsFirst.focus();
      return;
    }
    var addFocused = actionFocusIdx === actions.length;
    var html = actions.map(function(a, i) {
      var focused = i === actionFocusIdx ? ' focused' : '';
      return '<div class="action-item' + focused + '">' +
        '<div class="action-item-title">' + esc(a.title || '(untitled)') + '</div>' +
        (a.notes
          ? '<div style="font-size:10px;color:var(--text-muted);padding:1px 0 0 2px;">' + esc(a.notes) + '</div>'
          : '') +
        '</div>';
    }).join('');
    html += '<div class="action-add-btn' + (addFocused ? ' focused' : '') + '" id="action-add">' +
      '+ Add action</div>';
    el.content.innerHTML = html;
    var addBtn = document.getElementById('action-add');
    if (addBtn) addBtn.addEventListener('click', promptAddAction);
  }

  function navigateActions(dir) {
    actionFocusIdx = Math.max(0, Math.min(actions.length, actionFocusIdx + dir));
    renderActions();
  }

  function promptAddAction() {
    var title = window.prompt('Action title:');
    if (title && title.trim()) {
      actions.push({ title: title.trim(), notes: '' });
      actionFocusIdx = actions.length;
      renderActions();
    }
  }

  function promptActionNote() {
    var a = actions[actionFocusIdx];
    if (!a) return;
    var note = window.prompt('Note for "' + a.title + '":', a.notes || '');
    if (note !== null) {
      actions[actionFocusIdx].notes = note.trim();
      renderActions();
    }
  }

  function removeFocusedAction() {
    if (actionFocusIdx < 0 || actionFocusIdx >= actions.length) return;
    var a = actions[actionFocusIdx];
    if (confirm('Delete action: ' + (a.title || '(untitled)') + '?')) {
      actions.splice(actionFocusIdx, 1);
      if (actionFocusIdx > actions.length) actionFocusIdx = actions.length;
      renderActions();
    }
  }

  // ── Screen 2: Details ────────────────────────────────────────────────────

  function renderDetails() {
    var r = currentRecord;
    if (isPadsClass(r)) {
      el.content.innerHTML =
        '<div class="field-group">' +
          '<div class="field-label">Details</div>' +
          '<textarea class="field-input" id="f-pads-details" rows="8" style="height:132px;resize:none;">' +
            esc(r.pads_details || r.details || '') + '</textarea>' +
        '</div>';
      var padsFirst = document.getElementById('f-pads-details');
      if (padsFirst) padsFirst.focus();
      return;
    }
    var workerDefault = r.worker || ActivityService.getSenderIdentity().name || '';
    var acts = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];
    var actSelectHtml = '';
    if (acts.length) {
      actSelectHtml = '<div class="field-group"><div class="field-label">Activity</div>' +
        '<select class="field-input" id="f-activity-id"><option value="">— None —</option>' +
        acts.map(function(a) {
          return '<option value="' + esc(a.id) + '"' + (a.id === (r.activityId || '') ? ' selected' : '') + '>' + esc(a.name) + '</option>';
        }).join('') +
        '</select></div>';
    }
    el.content.innerHTML =
      fieldGroup('worker',        'Worker',         workerDefault) +
      fieldGroup('location',      'Location',       r.location       || '') +
      fieldGroup('customer_phone','Customer phone', r.customer_phone || '', 'tel') +
      fieldGroup('start_time',    'Start time',     r.start_time     || '') +
      fieldGroup('end_time',      'End time',       r.end_time       || '') +
      fieldGroup('meeting_time',  'Meeting time',   r.meeting_time   || '') +
      actSelectHtml;
    var first = document.getElementById('f-worker');
    if (first) first.focus();
  }

  // ── Screen 3: Story ──────────────────────────────────────────────────────

  function renderStory() {
    var r = currentRecord;
    if (isPadsClass(r)) {
      el.content.innerHTML =
        '<div class="field-group">' +
          '<div class="field-label">Story</div>' +
          '<textarea class="field-input" id="f-pads-story" rows="8" style="height:132px;resize:none;">' +
            esc(r.pads_story || r.story || '') + '</textarea>' +
        '</div>';
      var padsFirst = document.getElementById('f-pads-story');
      if (padsFirst) padsFirst.focus();
      return;
    }
    el.content.innerHTML =
      '<div class="field-group">' +
        '<div class="field-label">Story</div>' +
        '<textarea class="field-input" id="f-story" rows="5" style="height:90px;resize:none;">' +
          esc(r.story || '') + '</textarea>' +
      '</div>' +
      '<div class="field-group">' +
        '<div class="field-label">Details</div>' +
        '<textarea class="field-input" id="f-details" rows="4" style="height:72px;resize:none;">' +
          esc(r.details || '') + '</textarea>' +
      '</div>';
    var first = document.getElementById('f-story');
    if (first) first.focus();
  }

  // ── Financial child helpers ──────────────────────────────────────────────

  function getExpenses() {
    return cachedChildren.filter(function(c) {
      return (c.record_type || c.recordType) === 'expense';
    });
  }

  function getPayments() {
    return cachedChildren.filter(function(c) {
      return (c.record_type || c.recordType) === 'payment';
    });
  }

  function reloadChildren() {
    if (!currentRecord || !currentRecord.id) return;
    RecordService.listChildren(currentRecord.id).then(function(children) {
      cachedChildren = children || [];
      if (currentScreen === 4 && hasFinancialStep()) renderFinancial();
    });
  }

  // ── Screen 4: Financials ─────────────────────────────────────────────────

  function renderFinancial() {
    var tabBar = FIN_TABS.map(function(t, i) {
      var active = i === finTab;
      return '<span data-fin-tab="' + i + '" style="' +
        'flex:1; text-align:center; padding:5px 0; font-size:10px; cursor:pointer;' +
        (active
          ? 'color:var(--accent);border-bottom:2px solid var(--accent);font-weight:bold;'
          : 'color:var(--text-muted);border-bottom:2px solid transparent;') +
        '">' + t + '</span>';
    }).join('');

    var body = '';
    if (finTab === 0)      body = renderFinAmount();
    else if (finTab === 1) body = renderFinExpenses();
    else                   body = renderFinPayments();

    el.content.innerHTML =
      '<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:8px;">' +
        tabBar +
      '</div>' +
      body;

    // Tab click handlers
    var tabEls = el.content.querySelectorAll('[data-fin-tab]');
    for (var i = 0; i < tabEls.length; i++) {
      (function(tabEl) {
        tabEl.addEventListener('click', function() {
          readInputs();
          finTab = parseInt(tabEl.getAttribute('data-fin-tab'), 10);
          finFocusIdx = 0;
          renderFinancial();
        });
      }(tabEls[i]));
    }

    // Sub-record add buttons — route to LedgerScreen with returnTo='wizard'
    var addExp  = document.getElementById('fin-add-expense');
    var addCogs = document.getElementById('fin-add-cogs');
    var addPay  = document.getElementById('fin-add-payment');
    if (addExp)  addExp.addEventListener('click',  function() { App.showLedger({ type: 'expense', parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard' }); });
    if (addCogs) addCogs.addEventListener('click', function() { App.showLedger({ type: 'cogs',    parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard' }); });
    if (addPay)  addPay.addEventListener('click',  function() { App.showLedger({ type: 'payment', parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard' }); });
  }

  function renderFinAmount() {
    var r      = currentRecord;
    var locale = ActivityService.getLocale();

    var recTypeOpts = [
      { val: '',        label: 'Job record' },
      { val: 'quote',   label: 'Quote' },
      { val: 'invoice', label: 'Invoice' },
      { val: 'receipt', label: 'Receipt' },
    ];
    var vatOpts = [
      { val: 'none',     label: 'No tax' },
      { val: 'standard', label: locale.tax_label + ' ' + locale.tax_rate + '%' },
      { val: 'zero',     label: 'Zero rated (0%)' },
    ];

    return selectGroup('fin-record_type', 'Record type', recTypeOpts, r.record_type || '') +
      fieldGroup('fin-amount', 'Amount (' + esc(locale.currency) + ')', r.amount || '', 'text') +
      selectGroup('fin-vat', 'Tax', vatOpts, r.vat || 'none');
  }

  function renderFinExpenses() {
    var locale = ActivityService.getLocale();
    var exps = getExpenses();
    var html = '';

    if (!exps.length) {
      html += '<div style="padding:6px 10px 4px;color:var(--text-muted);font-size:11px;">No expenses yet.</div>';
    }
    for (var i = 0; i < exps.length; i++) {
      var e = exps[i];
      var focused = i === finFocusIdx ? ' focused' : '';
      var billing = e.expense_billing || e.billing || 'customer';
      html += '<div class="list-item' + focused + '">' +
        '<div class="list-item-title">' + esc(e.job || e.description || '') + '</div>' +
        '<div class="list-item-sub">' + esc(locale.currency) + ' ' + esc(e.amount) +
          ' · ' + (billing === 'cogs' ? 'COGS' : 'Expense') +
          '</div>' +
        '</div>';
    }

    var addExpFocused  = finFocusIdx === exps.length     ? ' focused' : '';
    var addCogsFocused = finFocusIdx === exps.length + 1 ? ' focused' : '';
    html += '<div class="action-add-btn' + addExpFocused  + '" id="fin-add-expense">+ Customer expense</div>';
    html += '<div class="action-add-btn' + addCogsFocused + '" id="fin-add-cogs">+ COGS item</div>';
    return html;
  }

  function renderFinPayments() {
    var locale = ActivityService.getLocale();
    var pays = getPayments();
    var html = '';

    if (!pays.length) {
      html += '<div style="padding:6px 10px 4px;color:var(--text-muted);font-size:11px;">No payments yet.</div>';
    }
    for (var i = 0; i < pays.length; i++) {
      var p = pays[i];
      var focused = i === finFocusIdx ? ' focused' : '';
      var note = p.story || p.note || '';
      html += '<div class="list-item' + focused + '">' +
        '<div class="list-item-title">' + esc(locale.currency) + ' ' + esc(p.amount) + '</div>' +
        (note ? '<div class="list-item-sub">' + esc(note) + '</div>' : '') +
        '</div>';
    }

    var addPayFocused = finFocusIdx === pays.length ? ' focused' : '';
    html += '<div class="action-add-btn' + addPayFocused + '" id="fin-add-payment">+ Payment received</div>';
    return html;
  }

  function navigateFin(dir) {
    if (finTab === 0) return;
    var max = finTab === 1 ? getExpenses().length + 1 : getPayments().length;
    finFocusIdx = Math.max(0, Math.min(max, finFocusIdx + dir));
    renderFinancial();
  }

  function finEnter() {
    if (finTab === 0) {
      var first = el.content.querySelector('select, input');
      if (first) first.focus();
      return;
    }
    if (finTab === 1) {
      var exps = getExpenses();
      if (finFocusIdx === exps.length)     { App.showLedger({ type: 'expense', parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard' }); return; }
      if (finFocusIdx === exps.length + 1) { App.showLedger({ type: 'cogs',    parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard' }); return; }
      if (finFocusIdx < exps.length) {
        var e = exps[finFocusIdx];
        if (confirm('Delete: ' + (e.job || e.description || '(item)') + '?')) {
          RecordService.archive(e.id).then(function() { reloadChildren(); });
        }
      }
    }
    if (finTab === 2) {
      var pays = getPayments();
      if (finFocusIdx === pays.length) { App.showLedger({ type: 'payment', parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard' }); return; }
      if (finFocusIdx < pays.length) {
        var p = pays[finFocusIdx];
        if (confirm('Delete payment of ' + p.amount + '?')) {
          RecordService.archive(p.id).then(function() { reloadChildren(); });
        }
      }
    }
  }

  // ── Type tag + type picker ───────────────────────────────────────────────

  function getTypeLabel(rec) {
    if (!rec) return 'Job';
    if (isPadsClass(rec)) return 'Basic';
    var t = rec.record_type || '';
    for (var i = 0; i < WIZ_TYPES.length; i++) {
      if (WIZ_TYPES[i].value === t) return WIZ_TYPES[i].label;
    }
    return 'Job';
  }

  function updateTypeTag() {
    var tag = document.getElementById('wiz-type-tag');
    if (!tag) return;
    tag.textContent = getTypeLabel(currentRecord);
  }

  function bindTypeTag() {
    var tag = document.getElementById('wiz-type-tag');
    if (tag) tag.onclick = function() { openWizardTypePicker(); };
  }

  function openWizardTypePicker() {
    if (typePickerOpen) return;
    typePickerOpen = true;
    typePickerFocusIdx = 0;
    var cur = currentRecord ? (isPadsClass(currentRecord) ? 'pads' : (currentRecord.record_type || '')) : '';
    for (var i = 0; i < WIZ_TYPES.length; i++) {
      if (WIZ_TYPES[i].value === cur) { typePickerFocusIdx = i; break; }
    }
    renderWizardTypePicker();
  }

  function renderWizardTypePicker() {
    var picker = document.getElementById('wiz-type-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'wiz-type-picker';
      picker.className = 'wiz-type-picker';
      document.getElementById('screen-wizard').appendChild(picker);
    }
    var html = '<div class="wiz-type-picker-hdr">Change Type</div>' +
      '<div class="wiz-type-picker-list">';
    for (var i = 0; i < WIZ_TYPES.length; i++) {
      html += '<div class="wiz-type-picker-item' + (i === typePickerFocusIdx ? ' nav-focused' : '') +
        '" data-wiz-type="' + esc(WIZ_TYPES[i].value) + '">' + esc(WIZ_TYPES[i].label) + '</div>';
    }
    html += '</div><div class="wiz-type-picker-footer">Enter: Select &nbsp; Bksp: Cancel</div>';
    picker.innerHTML = html;
    picker.style.display = 'flex';

    var items = picker.querySelectorAll('.wiz-type-picker-item');
    for (var j = 0; j < items.length; j++) {
      (function(item) {
        item.addEventListener('click', function() {
          var val = item.getAttribute('data-wiz-type');
          closeWizardTypePicker();
          changeRecordType(val);
        });
      }(items[j]));
    }
  }

  function closeWizardTypePicker() {
    typePickerOpen = false;
    var picker = document.getElementById('wiz-type-picker');
    if (picker) picker.style.display = 'none';
  }

  function changeRecordType(newVal) {
    if (!currentRecord) return;
    readInputs();
    var wasStandard = !isPadsClass(currentRecord);
    var newIsPads   = (newVal === 'pads');
    if (!currentRecord._orphanFields) currentRecord._orphanFields = {};

    if (wasStandard && newIsPads) {
      // Standard → PADS
      var stdFields = ['job','customer','date','location','start_time','end_time','meeting_time','customer_phone','worker'];
      for (var i = 0; i < stdFields.length; i++) {
        var f = stdFields[i];
        if (currentRecord[f]) currentRecord._orphanFields['std_' + f] = currentRecord[f];
      }
      if (!currentRecord.pads_process) currentRecord.pads_process = currentRecord.job || '';
      if (!currentRecord.pads_story)   currentRecord.pads_story   = currentRecord.story   || '';
      if (!currentRecord.pads_details) currentRecord.pads_details = currentRecord.details || '';
      for (var si = 0; si < stdFields.length; si++) currentRecord[stdFields[si]] = undefined;
      currentRecord.actions      = undefined;
      currentRecord.record_class = 'pads';
      currentRecord.record_type  = 'pads';

    } else if (!wasStandard && !newIsPads) {
      // PADS → Standard
      var padsFields = ['pads_process','pads_actions','pads_details','pads_story'];
      for (var pi = 0; pi < padsFields.length; pi++) {
        var pf = padsFields[pi];
        if (currentRecord[pf]) currentRecord._orphanFields[pf] = currentRecord[pf];
      }
      if (!currentRecord.job)     currentRecord.job     = (currentRecord.pads_process || '').slice(0, 48);
      if (!currentRecord.story)   currentRecord.story   = currentRecord.pads_story   || '';
      if (!currentRecord.details) currentRecord.details = currentRecord.pads_details || '';
      for (var ppi = 0; ppi < padsFields.length; ppi++) currentRecord[padsFields[ppi]] = undefined;
      // Restore any previously saved standard fields
      var restoreFields = ['customer','date','location','start_time','end_time','meeting_time','customer_phone','worker'];
      for (var ri = 0; ri < restoreFields.length; ri++) {
        var rf = restoreFields[ri];
        var saved = currentRecord._orphanFields['std_' + rf];
        if (saved && !currentRecord[rf]) currentRecord[rf] = saved;
      }
      currentRecord.record_class = 'job';
      currentRecord.record_type  = newVal;

    } else {
      // Standard → Standard: just change type
      currentRecord.record_type  = newVal;
      currentRecord.record_class = 'job';
    }

    actions = currentRecord.actions ? currentRecord.actions.slice() : [];
    currentScreen = 0;
    renderCurrentScreen();
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function renderCurrentScreen() {
    readInputs();
    updateProgress();
    updateSoftkeys();
    updateTypeTag();
    switch (currentScreen) {
      case 0: renderProcess();  break;
      case 1:
        if (!isPadsClass(currentRecord)) actionFocusIdx = actions.length;
        renderActions();
        break;
      case 2: renderDetails();  break;
      case 3: renderStory();    break;
      case 4:
        if (hasFinancialStep()) {
          finTab = 0; finFocusIdx = 0; renderFinancial();
        }
        break;
    }
    WorkpadsPanel.setContext({ screen: 'wizard', wizardScreen: currentScreen, record: currentRecord });
  }

  function goNext() {
    readInputs();
    autoSave();
    if (currentScreen < (getScreens().length - 1)) { currentScreen++; renderCurrentScreen(); }
    else saveAndExit();
  }

  function goBack() {
    readInputs();
    autoSave();
    if (currentScreen > 0) {
      currentScreen--;
      renderCurrentScreen();
    } else if (entryRecord) {
      App.showView(entryRecord);
    } else {
      App.showList();
    }
  }

  function saveAndExit() {
    readInputs();
    if (isPadsClass(currentRecord)) {
      if (!currentRecord.pads_process) {
        alert('Process text is required.');
        return;
      }
      if (!currentRecord.job) {
        currentRecord.job = currentRecord.pads_process.slice(0, 48);
      }
    } else if (!currentRecord.job) {
      alert('Job title is required.');
      return;
    }
    // Map VAT display values → codec-compatible numeric strings (DEV-WP-VAT-001)
    var locale = ActivityService.getLocale();
    if (!currentRecord.currency) currentRecord.currency = locale.currency;
    if (currentRecord.vat === 'standard') currentRecord.vat = locale.tax_rate;
    else if (currentRecord.vat === 'zero' || currentRecord.vat === 'none') currentRecord.vat = '0';

    RecordService.save(currentRecord.id, currentRecord).then(function(saved) {
      if (saved.customer && saved.customer_phone) {
        BlockRegistry.save(saved.customer, saved.customer_phone);
      }
      if (entryRecord) App.showView(saved);
      else App.showList();
    });
  }

  function autoSave() {
    if (!currentRecord || !currentRecord.id) return;
    RecordService.update(currentRecord.id, currentRecord).catch(function() {});
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function onShow(record, opts) {
    currentScreen    = (opts && opts.startScreen != null) ? opts.startScreen : 0;
    finTab           = 0;
    finFocusIdx      = 0;
    cachedChildren   = [];
    typePickerOpen   = false;
    entryRecord      = record || null;
    actions          = (record && record.actions) ? record.actions.slice() : [];
    bindTypeTag();

    if (record) {
      currentRecord = merge({}, record);
      // Load child records (expenses, payments) from DB for financial tab
      if (hasFinancialStep()) {
        RecordService.listChildren(record.id).then(function(children) {
          cachedChildren = children || [];
        });
      }
    } else {
      RecordService.create({ record_class: 'pads', record_type: 'pads' }).then(function(r) {
        currentRecord = r;
        entryRecord   = null;
        renderCurrentScreen();
      });
      return;
    }
    renderCurrentScreen();
  }

  function onKey(key) {
    if (typePickerOpen) {
      switch (key) {
        case 'ArrowUp':
          typePickerFocusIdx = Math.max(0, typePickerFocusIdx - 1);
          renderWizardTypePicker();
          break;
        case 'ArrowDown':
          typePickerFocusIdx = Math.min(WIZ_TYPES.length - 1, typePickerFocusIdx + 1);
          renderWizardTypePicker();
          break;
        case 'Enter':
          var sel = WIZ_TYPES[typePickerFocusIdx];
          if (sel) { closeWizardTypePicker(); changeRecordType(sel.value); }
          break;
        case 'Backspace':
          closeWizardTypePicker();
          break;
      }
      return;
    }
    switch (key) {
      case 'Backspace':
        goBack();
        break;
      case 'ArrowUp':
        if (currentScreen === 1 && !isPadsClass(currentRecord)) navigateActions(-1);
        else if (hasFinancialStep() && currentScreen === 4) navigateFin(-1);
        break;
      case 'ArrowDown':
        if (currentScreen === 1 && !isPadsClass(currentRecord)) navigateActions(1);
        else if (hasFinancialStep() && currentScreen === 4) navigateFin(1);
        break;
      case 'ArrowLeft':
        if (hasFinancialStep() && currentScreen === 4) {
          readInputs();
          finTab = Math.max(0, finTab - 1);
          finFocusIdx = 0;
          renderFinancial();
        }
        break;
      case 'ArrowRight':
        if (hasFinancialStep() && currentScreen === 4) {
          readInputs();
          finTab = Math.min(2, finTab + 1);
          finFocusIdx = 0;
          renderFinancial();
        }
        break;
      case 'Enter':
        if (currentScreen === 1 && !isPadsClass(currentRecord)) {
          goNext();
        } else if (hasFinancialStep() && currentScreen === 4) {
          finEnter();
        } else if (currentScreen < (getScreens().length - 1)) {
          goNext();
        } else {
          saveAndExit();
        }
        break;
      case '1':
        if (!isPadsClass(currentRecord) && currentScreen === 1) promptAddAction();
        break;
      case '2':
        if (!isPadsClass(currentRecord) && currentScreen === 1 && actionFocusIdx < actions.length) promptActionNote();
        break;
      case '3':
        if (!isPadsClass(currentRecord) && currentScreen === 1 && actionFocusIdx < actions.length) removeFocusedAction();
        break;
    }
  }

  global.WizardScreen = {
    onShow: onShow,
    onKey: onKey,
    getCurrentRecord: function() { return currentRecord; },
  };

}(window));
