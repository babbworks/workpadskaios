// Screen: Ledger Entry — direct Exp / COGS / Inc creation
// Supports: standalone, activity-linked, record-linked, action-linked
// Exposes: window.LedgerScreen

(function(global) {
  'use strict';

  var ENTRY_TYPES = [
    { value: 'expense', label: 'Exp',  title: 'Customer Expense', billing: 'customer' },
    { value: 'cogs',    label: 'COGS', title: 'Cost (COGS)',      billing: 'cogs'     },
    { value: 'payment', label: 'Inc',  title: 'Income',           billing: null       },
  ];

  var LINK_MODES = [
    { value: 'none',   label: 'Standalone'            },
    { value: 'record', label: 'Link to Job Record'    },
    { value: 'action', label: 'Link to Record Action' },
  ];

  function chargeLabels() {
    return (global.FinancialModel && FinancialModel.CHARGE_LABELS) || { '': 'Labour' };
  }

  // State
  var entryType    = 'expense';
  var amount       = '';
  var description  = '';
  var entryDate    = '';
  var chargeType   = '';
  var inputSource  = 'unsourced';
  var labourCount  = '';
  var labourRole   = '';
  var linkMode     = 'none';
  var activityId   = '';
  var linkedRecord = null;   // full record object when record/action mode
  var actionIdx    = null;   // index into linkedRecord.actions
  var allRecords   = [];     // loaded on demand for record picker
  var recordsLoading = false;
  var parentRecord   = null; // fetched parent when not passed via wizard/financial
  var recSearch    = '';
  var recPickerActive = false;
  var recPickerFocusIdx = 0;
  var filteredRecs = [];
  var returnTo        = null;  // 'wizard' | 'financial' | null
  var returnFinTab    = 0;     // finTab to restore when returning to wizard F tab
  var parentId        = null;  // parentId to stamp on created record
  var wizardRecord    = null;  // the wizard's currentRecord, passed back after save
  var financialRecord = null;  // the financial screen's record, used when returnTo='financial'
  var editRecord    = null;   // if set, we are editing an existing record (not creating)
  var linkedContact = null;  // contact record pre-fill (from contact panel)
  var paidOwed      = 'paid'; // 'paid' | 'owed' — toggle shown for Worker/Vendor contacts
  var errorMsg      = '';     // inline validation error

  // Category values that warrant the "Paid/Owed" toggle
  var WORKER_VENDOR_CATS = { 2: 1, 3: 1, 4: 1, 5: 1, 7: 1, 8: 1 };

  function isWorkerVendorContact(c) {
    if (!c) return false;
    if (c.roles && c.roles.length) {
      for (var i = 0; i < c.roles.length; i++) {
        if (WORKER_VENDOR_CATS[c.roles[i]]) return true;
      }
      return false;
    }
    return !!WORKER_VENDOR_CATS[parseInt(c.category, 10)];
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getEntryTypeMeta() {
    for (var i = 0; i < ENTRY_TYPES.length; i++) {
      if (ENTRY_TYPES[i].value === entryType) return ENTRY_TYPES[i];
    }
    return ENTRY_TYPES[0];
  }

  function todayStr() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart ? String(d.getMonth() + 1).padStart(2, '0') : ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = d.getDate() < 10 ? '0' + d.getDate() : String(d.getDate());
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function parentRecForDisplay() {
    if (!parentId) return null;
    if (wizardRecord && wizardRecord.id === parentId) return wizardRecord;
    if (financialRecord && financialRecord.id === parentId) return financialRecord;
    if (linkedRecord && linkedRecord.id === parentId) return linkedRecord;
    return parentRecord;
  }

  function fixedParentContext() {
    if (!parentId) return false;
    return (wizardRecord && wizardRecord.id === parentId) ||
      (financialRecord && financialRecord.id === parentId);
  }

  function parentCardHtml(rec) {
    if (!rec) {
      return '<div style="padding:6px 10px;font-size:11px;color:var(--text-muted);">Loading parent\u2026</div>';
    }
    return '<div class="ledger-linked-rec">' +
      '<div class="field-label" style="padding:6px 10px 2px;">Parent job</div>' +
      '<div class="list-item focused" style="margin:0 10px;border-radius:2px;pointer-events:none;">' +
        '<div class="list-item-title">' + esc(rec.job || '(untitled)') + '</div>' +
        '<div class="list-item-sub">' + esc(rec.date || '') + (rec.customer ? ' \u00b7 ' + esc(rec.customer) : '') + '</div>' +
      '</div></div>';
  }

  function loadParentRecord() {
    if (!parentId) return;
    if (parentRecForDisplay()) return;
    RecordService.get(parentId).then(function(p) {
      if (!p || p.id !== parentId) return;
      parentRecord = p;
      render();
    });
  }

  function ensureRecordsLoaded(done) {
    if (!recPickerActive || linkedRecord) return;
    if (allRecords.length) {
      if (done) done();
      return;
    }
    if (recordsLoading) return;
    recordsLoading = true;
    RecordService.list().then(function(recs) {
      recordsLoading = false;
      allRecords = recs.filter(function(r) { return !r.parentId; });
      filterRecs();
      if (done) done();
      else if (recPickerActive) updateRecPickerList();
    });
  }

  // ── Type tabs ─────────────────────────────────────────────────────────────

  function updateTypeTabs() {
    var tabs = document.getElementById('ledger-type-tabs');
    if (!tabs) return;
    var items = tabs.querySelectorAll('.ledger-tab');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-ltype') === entryType);
    }
    var tag = document.getElementById('ledger-type-tag');
    if (tag) tag.textContent = getEntryTypeMeta().label;
  }

  function bindTypeTabs() {
    var tabs = document.getElementById('ledger-type-tabs');
    if (!tabs) return;
    var items = tabs.querySelectorAll('.ledger-tab');
    for (var i = 0; i < items.length; i++) {
      (function(tab) {
        tab.addEventListener('click', function() {
          entryType = tab.getAttribute('data-ltype');
          if (entryType !== 'cogs') chargeType = '';
          updateTypeTabs();
          render();
        });
      }(items[i]));
    }
  }

  // ── Record picker ─────────────────────────────────────────────────────────

  function filterRecs() {
    var term = recSearch.toLowerCase().trim();
    filteredRecs = term
      ? allRecords.filter(function(r) {
          return (r.job || '').toLowerCase().indexOf(term) !== -1 ||
                 (r.customer || '').toLowerCase().indexOf(term) !== -1;
        })
      : allRecords.slice(0, 20);
  }

  function recPickerHtml() {
    if (!recPickerActive) return '';
    if (!allRecords.length) {
      return '<div class="ledger-rec-picker">' +
        '<div style="padding:8px 10px;font-size:11px;color:var(--text-muted);">Loading records\u2026</div>' +
        '</div>';
    }
    filterRecs();
    var rows = filteredRecs.map(function(r, i) {
      var focused = i === recPickerFocusIdx ? ' focused' : '';
      return '<div class="list-item' + focused + '" data-rec-idx="' + i + '">' +
        '<div class="list-item-title">' + esc(r.job || '(untitled)') + '</div>' +
        '<div class="list-item-sub">' + esc(r.date || '') + (r.customer ? ' · ' + esc(r.customer) : '') + '</div>' +
        '</div>';
    }).join('');
    return '<div class="ledger-rec-picker">' +
      '<div class="field-group" style="padding-bottom:4px;">' +
        '<div class="field-label">Search job records</div>' +
        '<input class="field-input" id="ledger-rec-search" type="text" value="' + esc(recSearch) + '" ' +
          'placeholder="Type to filter\u2026" autocomplete="off" dir="ltr">' +
      '</div>' +
      '<div class="ledger-rec-list">' +
        (rows || '<div style="padding:6px 10px;font-size:11px;color:var(--text-muted);">No matching records.</div>') +
      '</div>' +
      '</div>';
  }

  function bindRecPicker() {
    var inp = document.getElementById('ledger-rec-search');
    if (!inp) return;
    // Delay focus to avoid triggering keystroke
    setTimeout(function() { inp.focus(); var l = inp.value.length; inp.setSelectionRange(l, l); }, 0);
    inp.addEventListener('input', function() {
      recSearch = this.value;
      recPickerFocusIdx = 0;
      updateRecPickerList();
    });
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); recPickerFocusIdx = Math.min(filteredRecs.length - 1, recPickerFocusIdx + 1); updateRecPickerList(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); recPickerFocusIdx = Math.max(0, recPickerFocusIdx - 1); updateRecPickerList(); }
      if (e.key === 'Enter')     { e.preventDefault(); selectRec(filteredRecs[recPickerFocusIdx]); }
    });
    var rows = document.querySelectorAll('.ledger-rec-list .list-item');
    for (var i = 0; i < rows.length; i++) {
      (function(row, idx) {
        row.addEventListener('click', function() { selectRec(filteredRecs[idx]); });
      }(rows[i], i));
    }
  }

  function updateRecPickerList() {
    filterRecs();
    var listEl = document.querySelector('.ledger-rec-list');
    if (!listEl) return;
    var rows = filteredRecs.map(function(r, i) {
      var focused = i === recPickerFocusIdx ? ' focused' : '';
      return '<div class="list-item' + focused + '" data-rec-idx="' + i + '">' +
        '<div class="list-item-title">' + esc(r.job || '(untitled)') + '</div>' +
        '<div class="list-item-sub">' + esc(r.date || '') + (r.customer ? ' · ' + esc(r.customer) : '') + '</div>' +
        '</div>';
    }).join('');
    listEl.innerHTML = rows || '<div style="padding:6px 10px;font-size:11px;color:var(--text-muted);">No matching records.</div>';
    var items = listEl.querySelectorAll('.list-item');
    for (var i = 0; i < items.length; i++) {
      (function(item, idx) {
        item.addEventListener('click', function() { selectRec(filteredRecs[idx]); });
      }(items[i], i));
    }
  }

  function selectRec(rec) {
    if (!rec) return;
    linkedRecord = rec;
    recPickerActive = false;
    recSearch = '';
    actionIdx = null;
    render();
  }

  // ── Main render ───────────────────────────────────────────────────────────

  function render() {
    readInputs();
    var content = document.getElementById('ledger-content');
    if (!content) return;

    var meta = getEntryTypeMeta();
    var locale = (typeof ActivityService !== 'undefined') ? ActivityService.getLocale() : { currency: '' };
    var currency = locale.currency || '';
    var activities = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];

    var html = '';

    if (errorMsg) {
      html += '<div style="padding:4px 10px 2px;color:#f44336;font-size:11px;">' + esc(errorMsg) + '</div>';
    }

    // ── Activity (always first, independent top-level field) ──────────────────
    if (activities.length) {
      var actOpts = '<option value="">— No activity —</option>' + activities.map(function(a) {
        return '<option value="' + esc(a.id) + '"' + (a.id === activityId ? ' selected' : '') + '>' + esc(a.name) + '</option>';
      }).join('');
      html += '<div class="field-group">' +
        '<div class="field-label">Activity</div>' +
        '<select class="field-input" id="led-activity">' + actOpts + '</select></div>';
    }

    // ── Contact pre-fill (when launched from contact panel) ───────────────────
    if (linkedContact) {
      var cName = linkedContact.job || linkedContact.name || '';
      html += '<div class="field-group">' +
        '<div class="field-label">Contact</div>' +
        '<div class="field-input" style="background:var(--bg3);color:var(--text-muted);cursor:default;">' + esc(cName) + '</div>' +
      '</div>';
    }

    // Amount
    html += '<div class="field-group">' +
      '<div class="field-label">Amount' + (currency ? ' (' + esc(currency) + ')' : '') + ' *</div>' +
      '<input class="field-input" id="led-amount" type="text" inputmode="decimal" ' +
        'value="' + esc(amount) + '" autocomplete="off" dir="ltr"></div>';

    // Description
    html += '<div class="field-group">' +
      '<div class="field-label">Description *</div>' +
      '<input class="field-input" id="led-desc" type="text" ' +
        'value="' + esc(description) + '" autocomplete="off" autocorrect="off" spellcheck="false" dir="ltr"></div>';

    // Date
    html += '<div class="field-group">' +
      '<div class="field-label">Date</div>' +
      '<input class="field-input" id="led-date" type="date" value="' + esc(entryDate) + '"></div>';

    // Parent job (edit or wizard/financial context — view screen already shows this on read)
    if (parentId && (editRecord || fixedParentContext())) {
      html += parentCardHtml(parentRecForDisplay());
    }

    // Charge type (COGS only)
    if (entryType === 'cogs') {
      var labels = chargeLabels();
      var chargeOpts = Object.keys(labels).map(function(k) {
        return '<option value="' + esc(k) + '"' + (k === chargeType ? ' selected' : '') + '>' + esc(labels[k]) + '</option>';
      }).join('');
      html += '<div class="field-group">' +
        '<div class="field-label">Category</div>' +
        '<select class="field-input" id="led-charge">' + chargeOpts + '</select></div>';
      var jiLbl = global.IOLabels ? IOLabels.jobInputsLabel() : 'Job Inputs';
      var srcUn = global.IOLabels ? IOLabels.unsourcedInputsLabel() : 'Unsourced Inputs';
      var srcSo = global.IOLabels ? IOLabels.sourcedInputsLabel() : 'Sourced Inputs';
      html += '<div class="field-group">' +
        '<div class="field-label">' + esc(jiLbl) + ' — source</div>' +
        '<select class="field-input" id="led-input-src">' +
          '<option value="unsourced"' + (inputSource === 'unsourced' ? ' selected' : '') + '>' + esc(srcUn) + '</option>' +
          '<option value="sourced"' + (inputSource === 'sourced' ? ' selected' : '') + '>' + esc(srcSo) + '</option>' +
        '</select></div>';
      html += '<div class="field-group">' +
        '<div class="field-label">Labour headcount</div>' +
        '<input class="field-input" id="led-labour-count" type="number" min="0" value="' + esc(labourCount) + '"></div>';
      html += '<div class="field-group">' +
        '<div class="field-label">Labour role</div>' +
        '<input class="field-input" id="led-labour-role" value="' + esc(labourRole) + '"></div>';
    }

    // ── Paid / Owed toggle (Worker/Vendor contacts + Exp/COGS only) ──────────
    if (linkedContact && isWorkerVendorContact(linkedContact) &&
        (entryType === 'expense' || entryType === 'cogs')) {
      html += '<div class="field-group">' +
        '<div class="field-label">Status</div>' +
        '<div class="liab-dir-row">' +
          '<div class="liab-dir-btn' + (paidOwed === 'paid' ? ' active' : '') + '" id="led-paid-btn">' +
            '<span class="liab-dir-arrow">&#10003; Paid</span>' +
            '<span class="liab-dir-desc">Already paid out</span>' +
          '</div>' +
          '<div class="liab-dir-btn' + (paidOwed === 'owed' ? ' active' : '') + '" id="led-owed-btn">' +
            '<span class="liab-dir-arrow">&#8681; Owed</span>' +
            '<span class="liab-dir-desc">Not yet paid (Payable)</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // ── Link to Job Record / Action (hidden when parent is fixed from caller) ─
    var hideLinkUi = (editRecord && parentId) || fixedParentContext();
    if (!hideLinkUi) {
      var linkOpts = LINK_MODES.map(function(m) {
        return '<option value="' + m.value + '"' + (m.value === linkMode ? ' selected' : '') + '>' + esc(m.label) + '</option>';
      }).join('');
      html += '<div class="field-group">' +
        '<div class="field-label">Link to record</div>' +
        '<select class="field-input" id="led-link">' + linkOpts + '</select></div>';
    }

    // Record picker
    if (!hideLinkUi && (linkMode === 'record' || linkMode === 'action')) {
      if (linkedRecord) {
        html += '<div class="ledger-linked-rec">' +
          '<div class="field-label" style="padding:6px 10px 2px;">Linked record</div>' +
          '<div class="list-item focused" style="margin:0 10px;border-radius:2px;">' +
            '<div class="list-item-title">' + esc(linkedRecord.job || '(untitled)') + '</div>' +
            '<div class="list-item-sub">' + esc(linkedRecord.date || '') + (linkedRecord.customer ? ' · ' + esc(linkedRecord.customer) : '') + '</div>' +
          '</div>' +
          '<div style="padding:4px 10px;"><span class="badge" id="led-clear-rec" style="cursor:pointer;font-size:10px;">Change record \u00d7</span></div>' +
        '</div>';

        // Action picker (action mode only)
        if (linkMode === 'action' && Array.isArray(linkedRecord.actions) && linkedRecord.actions.length) {
          var actionOpts = '<option value="">— Select action —</option>' + linkedRecord.actions.map(function(a, i) {
            return '<option value="' + i + '"' + (actionIdx === i ? ' selected' : '') + '>' + esc(a.title || '(untitled)') + '</option>';
          }).join('');
          html += '<div class="field-group">' +
            '<div class="field-label">Action item</div>' +
            '<select class="field-input" id="led-action">' + actionOpts + '</select></div>';
        } else if (linkMode === 'action') {
          html += '<div style="padding:6px 10px;font-size:11px;color:var(--text-muted);">This record has no actions defined.</div>';
        }
      } else {
        html += recPickerHtml();
      }
    }

    content.innerHTML = html;

    // Bind Paid/Owed toggle
    var paidBtn = document.getElementById('led-paid-btn');
    var owedBtn = document.getElementById('led-owed-btn');
    if (paidBtn) paidBtn.addEventListener('click', function() { paidOwed = 'paid'; render(); });
    if (owedBtn) owedBtn.addEventListener('click', function() { paidOwed = 'owed'; render(); });

    // Bind link mode change
    var linkSel = document.getElementById('led-link');
    if (linkSel) {
      linkSel.addEventListener('change', function() {
        linkMode = this.value;
        linkedRecord = null;
        actionIdx = null;
        recSearch = '';
        recPickerActive = (linkMode === 'record' || linkMode === 'action');
        render();
        if (recPickerActive) ensureRecordsLoaded(function() { render(); });
      });
    }

    // Bind activity select
    var actSel = document.getElementById('led-activity');
    if (actSel) actSel.addEventListener('change', function() { activityId = this.value; });

    // Bind action select
    var actIdx = document.getElementById('led-action');
    if (actIdx) actIdx.addEventListener('change', function() { actionIdx = this.value !== '' ? parseInt(this.value, 10) : null; });

    // Clear linked record
    var clearBtn = document.getElementById('led-clear-rec');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        linkedRecord = null;
        actionIdx = null;
        recSearch = '';
        recPickerActive = true;
        render();
        ensureRecordsLoaded(function() { render(); });
      });
    }

    // Bind record picker search
    if (recPickerActive) {
      ensureRecordsLoaded(function() {
        if (allRecords.length) bindRecPicker();
      });
    }

    // Focus first field
    var firstInp = document.getElementById('led-amount');
    if (firstInp && !recPickerActive) setTimeout(function() { firstInp.focus(); }, 0);
  }

  function readInputs() {
    var a = document.getElementById('led-amount');
    var d = document.getElementById('led-desc');
    var dt = document.getElementById('led-date');
    var ch = document.getElementById('led-charge');
    var ac = document.getElementById('led-activity');
    var ai = document.getElementById('led-action');
    if (a)  amount      = a.value.trim();
    if (d)  description = d.value.trim();
    if (dt) entryDate   = dt.value;
    if (ch) chargeType  = ch.value;
    var src = document.getElementById('led-input-src');
    var lc = document.getElementById('led-labour-count');
    var lr = document.getElementById('led-labour-role');
    if (src) inputSource = src.value;
    if (lc) labourCount = lc.value.trim();
    if (lr) labourRole = lr.value.trim();
    if (ac) activityId  = ac.value;
    if (ai) actionIdx   = ai.value !== '' ? parseInt(ai.value, 10) : null;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function save() {
    readInputs();
    errorMsg = '';
    if (!amount || isNaN(parseFloat(amount))) { errorMsg = 'Amount is required.'; render(); return; }
    if (!description) { errorMsg = 'Description is required.'; render(); return; }

    var locale = (typeof ActivityService !== 'undefined') ? ActivityService.getLocale() : { currency: '' };
    // "Owed" toggle redirects to Payable in LiabilitiesScreen
    if (linkedContact && paidOwed === 'owed' &&
        (entryType === 'expense' || entryType === 'cogs') &&
        isWorkerVendorContact(linkedContact)) {
      if (typeof App !== 'undefined') {
        App.showLiabilities({
          type: 'payable',
          linkedContact: linkedContact,
          returnTo: returnTo,
        });
      }
      return;
    }

    var fields = {
      job:             description,
      amount:          amount,
      currency:        locale.currency || '',
      date:            entryDate || todayStr(),
      activityId:      activityId || undefined,
      parentId:        linkedRecord ? linkedRecord.id : (parentId || undefined),
      actionIdx:       (actionIdx !== null && actionIdx !== undefined) ? actionIdx : undefined,
      customer:        linkedContact ? (linkedContact.job || linkedContact.name || undefined) : undefined,
      linkedContactId: linkedContact ? linkedContact.id : undefined,
    };

    if (entryType === 'payment') {
      fields.record_type = 'payment';
      fields.story       = description;
    } else {
      fields.record_type      = 'expense';
      fields.expense_billing  = (entryType === 'cogs') ? 'cogs' : 'customer';
      if (entryType === 'cogs') {
        fields.charge_type = chargeType;
        if (inputSource) fields.input_source = inputSource;
        if (labourCount) fields.labour_count = labourCount;
        if (labourRole) fields.labour_role = labourRole;
      }
    }

    var op = editRecord
      ? RecordService.save(editRecord.id, fields)
      : RecordService.create(fields);

    op.then(function() {
      if (returnTo === 'financial' && financialRecord) App.showFinancial(financialRecord);
      else if (returnTo === 'wizard' && wizardRecord) App.showWizard(wizardRecord, { startScreen: 4, finTab: returnFinTab });
      else App.showList();
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function onShow(opts) {
    editRecord      = (opts && opts.editRecord)      || null;
    returnTo        = (opts && opts.returnTo)        || null;
    returnFinTab    = (opts && opts.returnFinTab != null) ? opts.returnFinTab : 0;
    parentId        = (opts && opts.parentId)        || null;
    wizardRecord    = (opts && opts.wizardRecord)    || null;
    financialRecord = (opts && opts.financialRecord) || null;
    errorMsg      = '';
    recSearch     = '';
    recPickerFocusIdx = 0;
    filteredRecs  = [];
    allRecords    = [];
    recordsLoading = false;
    parentRecord  = null;

    linkedContact = (opts && opts.linkedContact) || null;
    paidOwed = 'paid';

    if (editRecord) {
      // Edit mode — pre-populate from existing record
      var rt = (editRecord.record_type || '').toLowerCase();
      var billing = (editRecord.expense_billing || '').toLowerCase();
      entryType   = rt === 'payment' ? 'payment' : (billing === 'cogs' ? 'cogs' : 'expense');
      amount      = editRecord.amount || '';
      description = editRecord.job || editRecord.description || '';
      entryDate   = editRecord.date || todayStr();
      chargeType  = editRecord.charge_type || '';
      inputSource = editRecord.input_source || 'unsourced';
      labourCount = editRecord.labour_count || '';
      labourRole  = editRecord.labour_role || '';
      activityId  = editRecord.activityId  || '';
      actionIdx   = editRecord.actionIdx   != null ? editRecord.actionIdx : null;
      parentId    = editRecord.parentId    || parentId;
      linkedRecord = null;
      linkMode     = 'none';
      recPickerActive = false;
    } else {
      // Create mode
      var t = opts && opts.type;
      entryType    = (t === 'cogs' || t === 'payment') ? t : 'expense';
      amount       = '';
      description  = '';
      entryDate    = todayStr();
      chargeType   = '';
      inputSource  = 'unsourced';
      labourCount  = '';
      labourRole   = '';
      actionIdx    = null;
      linkedRecord = (opts && opts.linkedRecord) || null;
      linkMode     = (opts && opts.linkMode) || 'none';
      // Pre-fill activityId from contact if provided, else from opts
      activityId   = (linkedContact && linkedContact.activityId) || (opts && opts.activityId) || '';
      recPickerActive = (linkMode === 'record' || linkMode === 'action') && !linkedRecord;
    }

    updateTypeTabs();
    bindTypeTabs();
    render();

    if (parentId) loadParentRecord();
    if (recPickerActive) ensureRecordsLoaded(function() { render(); });
  }

  function onKey(key) {
    switch (key) {
      case 'Backspace':
        if (returnTo === 'financial' && financialRecord) App.showFinancial(financialRecord);
        else if (returnTo === 'wizard' && wizardRecord) App.showWizard(wizardRecord, { startScreen: 4, finTab: returnFinTab });
        else App.showList();
        break;
      case 'Enter':
        if (!(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'))) {
          save();
        }
        break;
    }
  }

  global.LedgerScreen = {
    onShow: onShow,
    onKey:  onKey,
    save:   save,
  };

}(window));
