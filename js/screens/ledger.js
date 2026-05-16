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
    { value: 'none',     label: 'Standalone — no link'     },
    { value: 'activity', label: 'Link to Activity'         },
    { value: 'record',   label: 'Link to Job Record'       },
    { value: 'action',   label: 'Link to Record Action'    },
  ];

  var CHARGE_LABELS = {
    '':  'General labour',
    '1': 'Materials',
    '2': 'Subcontractor',
    '3': 'Equipment',
    '4': 'Travel',
    '5': 'Software / license',
    '6': 'Professional fee',
    '7': 'Other',
  };

  // State
  var entryType    = 'expense';
  var amount       = '';
  var description  = '';
  var entryDate    = '';
  var chargeType   = '';
  var linkMode     = 'none';
  var activityId   = '';
  var linkedRecord = null;   // full record object when record/action mode
  var actionIdx    = null;   // index into linkedRecord.actions
  var allRecords   = [];     // loaded for record picker
  var recSearch    = '';
  var recPickerActive = false;
  var recPickerFocusIdx = 0;
  var filteredRecs = [];
  var returnTo     = null;   // 'wizard' | null — screen to return to after save/back
  var parentId     = null;   // parentId to stamp on created record (when returnTo='wizard')
  var wizardRecord = null;   // the wizard's currentRecord, passed back after save
  var errorMsg     = '';     // inline validation error

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

    // Charge type (COGS only)
    if (entryType === 'cogs') {
      var chargeOpts = Object.keys(CHARGE_LABELS).map(function(k) {
        return '<option value="' + esc(k) + '"' + (k === chargeType ? ' selected' : '') + '>' + esc(CHARGE_LABELS[k]) + '</option>';
      }).join('');
      html += '<div class="field-group">' +
        '<div class="field-label">Category</div>' +
        '<select class="field-input" id="led-charge">' + chargeOpts + '</select></div>';
    }

    // Link mode
    var linkOpts = LINK_MODES.map(function(m) {
      return '<option value="' + m.value + '"' + (m.value === linkMode ? ' selected' : '') + '>' + esc(m.label) + '</option>';
    }).join('');
    html += '<div class="field-group">' +
      '<div class="field-label">Associate with</div>' +
      '<select class="field-input" id="led-link">' + linkOpts + '</select></div>';

    // Activity picker
    if (linkMode === 'activity') {
      if (activities.length) {
        var actOpts = '<option value="">— Select —</option>' + activities.map(function(a) {
          return '<option value="' + esc(a.id) + '"' + (a.id === activityId ? ' selected' : '') + '>' + esc(a.name) + '</option>';
        }).join('');
        html += '<div class="field-group">' +
          '<div class="field-label">Activity</div>' +
          '<select class="field-input" id="led-activity">' + actOpts + '</select></div>';
      } else {
        html += '<div style="padding:6px 10px;font-size:11px;color:var(--text-muted);">No activities. Add them in Manage → Activities.</div>';
      }
    }

    // Record picker
    if (linkMode === 'record' || linkMode === 'action') {
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

    // Bind link mode change
    var linkSel = document.getElementById('led-link');
    if (linkSel) {
      linkSel.addEventListener('change', function() {
        linkMode = this.value;
        linkedRecord = null;
        actionIdx = null;
        activityId = '';
        recSearch = '';
        recPickerActive = (linkMode === 'record' || linkMode === 'action');
        render();
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
      });
    }

    // Bind record picker search
    if (recPickerActive) bindRecPicker();

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
    var fields = {
      job:          description,
      amount:       amount,
      currency:     locale.currency || '',
      date:         entryDate || todayStr(),
      activityId:   activityId || undefined,
      parentId:     linkedRecord ? linkedRecord.id : (parentId || undefined),
      actionIdx:    (actionIdx !== null && actionIdx !== undefined) ? actionIdx : undefined,
    };

    if (entryType === 'payment') {
      fields.record_type = 'payment';
      fields.story       = description;
    } else {
      fields.record_type      = 'expense';
      fields.expense_billing  = (entryType === 'cogs') ? 'cogs' : 'customer';
      if (entryType === 'cogs') fields.charge_type = chargeType;
    }

    RecordService.create(fields).then(function() {
      if (returnTo === 'wizard' && wizardRecord) App.showWizard(wizardRecord, { startScreen: 4 });
      else App.showList();
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function onShow(opts) {
    var t = opts && opts.type;
    entryType    = (t === 'cogs' || t === 'payment') ? t : 'expense';
    amount       = '';
    description  = '';
    entryDate    = todayStr();
    chargeType   = '';
    actionIdx    = null;
    recSearch    = '';
    recPickerFocusIdx = 0;
    filteredRecs = [];
    allRecords   = [];
    errorMsg     = '';
    returnTo     = (opts && opts.returnTo) || null;
    parentId     = (opts && opts.parentId) || null;
    wizardRecord = (opts && opts.wizardRecord) || null;

    // Pre-link from caller (e.g. panel quick-create buttons)
    linkedRecord = (opts && opts.linkedRecord) || null;
    linkMode     = (opts && opts.linkMode) || 'none';
    activityId   = (opts && opts.activityId) || '';
    recPickerActive = (linkMode === 'record' || linkMode === 'action') && !linkedRecord;

    updateTypeTabs();
    bindTypeTabs();
    render();

    // Load records in background for picker
    RecordService.list().then(function(recs) {
      allRecords = recs.filter(function(r) { return !r.parentId; });
    });
  }

  function onKey(key) {
    switch (key) {
      case 'Backspace':
        if (returnTo === 'wizard' && wizardRecord) App.showWizard(wizardRecord, { startScreen: 4 });
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
