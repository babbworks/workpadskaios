// Screen: Liabilities — Payable / Receivable / Loan entry
// Exposes: window.LiabilitiesScreen

(function(global) {
  'use strict';

  var ENTRY_TYPES = [
    { value: 'payable',    label: 'Payable',    title: 'Money I Owe'      },
    { value: 'receivable', label: 'Receivable', title: 'Money Owed to Me' },
    { value: 'loan',       label: 'Loan',       title: 'Loan'             },
  ];

  var LOAN_DIRS = [
    { value: 'owing', label: '\u21d3 Owing',  desc: 'Money I borrowed' },
    { value: 'owed',  label: '\u21d1 Owed',   desc: 'Money lent out'   },
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  var entryType    = 'payable';
  var loanDir      = 'owing';
  var amount       = '';
  var description  = '';
  var entryDate    = '';
  var counterparty = '';
  var activityId   = '';
  var linkedRecord = null;
  var linkedContact = null;  // contact pre-fill from contact panel
  var returnTo     = null;
  var editRecord   = null;
  var errorMsg     = '';
  var focusIdx     = 0;

  // Contact picker state
  var contactPickerOpen  = false;
  var contactSearch      = '';
  var allContacts        = [];
  var filteredContacts   = [];
  var contactFocusIdx    = 0;

  var FIELDS = [];

  // ── Helpers ───────────────────────────────────────────────────────────────

  function todayStr() {
    var d = new Date();
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function getTypeMeta() {
    for (var i = 0; i < ENTRY_TYPES.length; i++) {
      if (ENTRY_TYPES[i].value === entryType) return ENTRY_TYPES[i];
    }
    return ENTRY_TYPES[0];
  }

  function counterLabel() {
    if (entryType === 'payable')    return 'Payee';
    if (entryType === 'receivable') return 'From';
    return loanDir === 'owing' ? 'Lender' : 'Borrower';
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  function updateTabs() {
    var tabs = document.getElementById('liab-type-tabs');
    if (!tabs) return;
    var items = tabs.querySelectorAll('.ledger-tab');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-ltype') === entryType);
    }
    var title = document.getElementById('liab-title');
    if (title) title.textContent = getTypeMeta().title;
  }

  function bindTabs() {
    var tabs = document.getElementById('liab-type-tabs');
    if (!tabs) return;
    var items = tabs.querySelectorAll('.ledger-tab');
    for (var i = 0; i < items.length; i++) {
      (function(tab) {
        tab.addEventListener('click', function() {
          entryType = tab.getAttribute('data-ltype');
          focusIdx = 0; errorMsg = '';
          updateTabs(); render();
        });
      }(items[i]));
    }
  }

  // ── Contact picker ────────────────────────────────────────────────────────

  function filterContacts() {
    var term = contactSearch.toLowerCase().trim();
    filteredContacts = term
      ? allContacts.filter(function(c) { return c.name.toLowerCase().indexOf(term) !== -1; })
      : allContacts.slice(0, 30);
    if (contactFocusIdx >= filteredContacts.length) contactFocusIdx = 0;
  }

  function openContactPicker() {
    contactSearch = '';
    contactFocusIdx = 0;
    contactPickerOpen = true;
    if (typeof BlockRegistry !== 'undefined') {
      BlockRegistry.list().then(function(contacts) {
        allContacts = contacts || [];
        renderContactPicker();
      });
    } else {
      allContacts = [];
      renderContactPicker();
    }
  }

  function closeContactPicker() {
    contactPickerOpen = false;
    render();
  }

  function selectContact(c) {
    counterparty = c.name;
    contactPickerOpen = false;
    render();
  }

  function renderContactPicker() {
    var el = document.getElementById('liab-content');
    if (!el) return;
    filterContacts();

    var rows = filteredContacts.map(function(c, i) {
      var cls = 'liab-contact-item' + (i === contactFocusIdx ? ' focused' : '');
      return '<div class="' + cls + '" data-ci="' + i + '">' +
        '<span class="liab-contact-name">' + esc(c.name) + '</span>' +
        (c.phone ? '<span class="liab-contact-sub">' + esc(c.phone) + '</span>' : '') +
      '</div>';
    }).join('');

    var emptyMsg = allContacts.length === 0
      ? '<div class="liab-cp-empty">No contacts saved yet.</div>'
      : (filteredContacts.length === 0 ? '<div class="liab-cp-empty">No matches.</div>' : '');

    el.innerHTML =
      '<div class="liab-cp-search-row">' +
        '<input class="field-input liab-cp-search" id="liab-cp-input" type="text" ' +
          'value="' + esc(contactSearch) + '" placeholder="Search contacts\u2026" autocomplete="off">' +
      '</div>' +
      '<div class="liab-contact-list" id="liab-contact-list">' +
        (rows || emptyMsg) +
      '</div>';

    var inp = document.getElementById('liab-cp-input');
    if (inp) {
      setTimeout(function() { inp.focus(); }, 0);
      inp.addEventListener('input', function() {
        contactSearch = this.value;
        contactFocusIdx = 0;
        filterContacts();
        updateContactList();
      });
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); contactFocusIdx = Math.min(filteredContacts.length - 1, contactFocusIdx + 1); updateContactList(); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); contactFocusIdx = Math.max(0, contactFocusIdx - 1); updateContactList(); }
        if (e.key === 'Enter')     { e.preventDefault(); if (filteredContacts[contactFocusIdx]) selectContact(filteredContacts[contactFocusIdx]); }
        if (e.key === 'Escape')    { closeContactPicker(); }
      });
    }

    bindContactRows();

    var csk = document.getElementById('liab-csk');
    if (csk) { csk.textContent = 'Cancel'; csk.onclick = closeContactPicker; }
  }

  function updateContactList() {
    var listEl = document.getElementById('liab-contact-list');
    if (!listEl) return;
    var rows = filteredContacts.map(function(c, i) {
      var cls = 'liab-contact-item' + (i === contactFocusIdx ? ' focused' : '');
      return '<div class="' + cls + '" data-ci="' + i + '">' +
        '<span class="liab-contact-name">' + esc(c.name) + '</span>' +
        (c.phone ? '<span class="liab-contact-sub">' + esc(c.phone) + '</span>' : '') +
      '</div>';
    }).join('');
    listEl.innerHTML = rows || (filteredContacts.length === 0 ? '<div class="liab-cp-empty">No matches.</div>' : '');
    bindContactRows();
  }

  function bindContactRows() {
    var rows = document.querySelectorAll('.liab-contact-item');
    for (var i = 0; i < rows.length; i++) {
      (function(row, idx) {
        row.addEventListener('click', function() { selectContact(filteredContacts[idx]); });
      }(rows[i], i));
    }
  }

  // ── Main render ───────────────────────────────────────────────────────────

  function render() {
    var el = document.getElementById('liab-content');
    if (!el) return;
    updateTabs();

    if (contactPickerOpen) { renderContactPicker(); return; }

    var activities = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];

    // Loan direction
    var loanDirHtml = '';
    if (entryType === 'loan') {
      loanDirHtml = '<div class="liab-dir-row">' +
        LOAN_DIRS.map(function(d) {
          return '<div class="liab-dir-btn' + (loanDir === d.value ? ' active' : '') + '" data-dir="' + d.value + '">' +
            '<span class="liab-dir-arrow">' + d.label + '</span>' +
            '<span class="liab-dir-desc">' + d.desc + '</span>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    var errHtml = errorMsg
      ? '<div class="liab-error">' + esc(errorMsg) + '</div>' : '';

    // ── Activity (always first, top-level) ────────────────────────────────────
    var activityHtml = '';
    if (activities.length > 0) {
      var actOpts = '<option value="">— No activity —</option>' + activities.map(function(a) {
        return '<option value="' + esc(a.id) + '"' + (a.id === activityId ? ' selected' : '') + '>' + esc(a.name) + '</option>';
      }).join('');
      activityHtml =
        '<div class="field-group">' +
          '<div class="field-label">Activity</div>' +
          '<select class="field-input liab-field" id="liab-activity">' + actOpts + '</select>' +
        '</div>';
    }

    // ── Contact pre-fill ──────────────────────────────────────────────────────
    var contactPrefillHtml = '';
    if (linkedContact) {
      var cName = linkedContact.job || linkedContact.name || '';
      contactPrefillHtml =
        '<div class="field-group">' +
          '<div class="field-label">Contact</div>' +
          '<div class="field-input" style="background:var(--bg3);color:var(--text-muted);cursor:default;">' + esc(cName) + '</div>' +
        '</div>';
    }

    // Amount — prominent
    var amtHtml =
      '<div class="field-group liab-amount-group">' +
        '<div class="field-label">Amount</div>' +
        '<input class="field-input liab-amount-input liab-field" id="liab-amount" ' +
          'type="number" inputmode="decimal" value="' + esc(amount) + '" placeholder="0.00">' +
      '</div>';

    // Counterparty with contact picker button
    var cpHtml =
      '<div class="field-group">' +
        '<div class="field-label">' + counterLabel() + '</div>' +
        '<div class="liab-cp-row">' +
          '<input class="field-input liab-field liab-cp-input-main" id="liab-counterparty" type="text" ' +
            'value="' + esc(counterparty) + '" placeholder="Name or reference">' +
          '<button class="liab-pick-btn" id="liab-pick-contact" type="button">' +
            '\ud83d\udcd2' +
          '</button>' +
        '</div>' +
      '</div>';

    var dateHtml =
      '<div class="field-group">' +
        '<div class="field-label">Date</div>' +
        '<input class="field-input liab-field" id="liab-date" type="date" ' +
          'value="' + esc(entryDate || todayStr()) + '">' +
      '</div>';

    var descHtml =
      '<div class="field-group">' +
        '<div class="field-label">Description</div>' +
        '<input class="field-input liab-field" id="liab-desc" type="text" ' +
          'value="' + esc(description) + '" placeholder="Optional note">' +
      '</div>';

    var linkedHtml = '';
    if (linkedRecord && linkedRecord.id) {
      var recLabel = linkedRecord.job || linkedRecord.customer || linkedRecord.id;
      linkedHtml =
        '<div class="field-group liab-linked-group">' +
          '<div class="field-label">Linked record</div>' +
          '<div class="liab-linked-chip">' +
            '<span class="liab-linked-name">' + esc(recLabel) + '</span>' +
            '<span class="liab-linked-clear" id="liab-clear-link">\u00d7</span>' +
          '</div>' +
        '</div>';
    }

    el.innerHTML =
      loanDirHtml + errHtml +
      activityHtml + contactPrefillHtml +
      amtHtml + cpHtml + dateHtml + descHtml +
      linkedHtml;

    // Focusable fields (activity first if present)
    FIELDS = [];
    if (activities.length > 0) FIELDS.push('liab-activity');
    FIELDS = FIELDS.concat(['liab-amount', 'liab-counterparty', 'liab-date', 'liab-desc']);
    applyFieldFocus();

    // Loan direction buttons
    var dirBtns = el.querySelectorAll('.liab-dir-btn');
    for (var di = 0; di < dirBtns.length; di++) {
      dirBtns[di].addEventListener('click', (function(btn) {
        return function() { loanDir = btn.getAttribute('data-dir'); render(); };
      })(dirBtns[di]));
    }

    // Sync values on change/input
    var inputs = el.querySelectorAll('.liab-field');
    for (var ii = 0; ii < inputs.length; ii++) {
      inputs[ii].addEventListener('change', syncValues);
      inputs[ii].addEventListener('input',  syncValues);
    }

    // Contact picker open
    var pickBtn = document.getElementById('liab-pick-contact');
    if (pickBtn) pickBtn.addEventListener('click', function() { syncValues(); openContactPicker(); });

    // Clear linked record
    var clearLink = document.getElementById('liab-clear-link');
    if (clearLink) clearLink.addEventListener('click', function() { linkedRecord = null; render(); });

    // CSK
    var csk = document.getElementById('liab-csk');
    if (csk) { csk.textContent = editRecord ? 'Update' : 'Save'; csk.onclick = save; }
  }

  function syncValues() {
    var a  = document.getElementById('liab-amount');
    var cp = document.getElementById('liab-counterparty');
    var dt = document.getElementById('liab-date');
    var ds = document.getElementById('liab-desc');
    var ac = document.getElementById('liab-activity');
    if (a)  amount       = a.value;
    if (cp) counterparty = cp.value;
    if (dt) entryDate    = dt.value;
    if (ds) description  = ds.value;
    if (ac) activityId   = ac.value;
  }

  function applyFieldFocus() {
    for (var i = 0; i < FIELDS.length; i++) {
      var el = document.getElementById(FIELDS[i]);
      if (el) el.classList.toggle('field-focused', i === focusIdx);
    }
    var focused = document.getElementById(FIELDS[focusIdx]);
    if (focused) focused.focus();
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function save() {
    syncValues();
    var amt = parseFloat(amount);
    if (!amt || amt <= 0) { errorMsg = 'Amount required'; render(); return; }

    var rec = {
      record_type:  entryType,
      amount:       String(amt),
      description:  description,
      date:         entryDate || todayStr(),
      counterparty: counterparty || (linkedContact ? (linkedContact.job || linkedContact.name || '') : ''),
      updatedAt:    Date.now(),
    };
    if (entryType === 'loan') rec.loan_direction = loanDir;
    if (activityId) rec.activityId = activityId;
    if (linkedRecord && linkedRecord.id) rec.parentId = linkedRecord.id;
    if (linkedContact && linkedContact.id) {
      rec.linkedContactId = linkedContact.id;
      if (!rec.counterparty) rec.counterparty = linkedContact.job || linkedContact.name || '';
    }

    if (editRecord) {
      rec.id        = editRecord.id;
      rec.createdAt = editRecord.createdAt || Date.now();
      RecordService.update(rec).then(function() { goBack(); });
    } else {
      rec.createdAt = Date.now();
      RecordService.create(rec).then(function() { goBack(); });
    }
  }

  function goBack() {
    if (typeof App !== 'undefined') App.showList();
  }

  // ── onShow / onKey ────────────────────────────────────────────────────────

  function onShow(opts) {
    opts = opts || {};
    editRecord      = opts.editRecord    || null;
    returnTo        = opts.returnTo      || null;
    linkedRecord    = opts.linkedRecord  || null;
    linkedContact   = opts.linkedContact || null;
    errorMsg        = '';
    focusIdx        = 0;
    contactPickerOpen = false;

    if (editRecord) {
      entryType    = editRecord.record_type    || 'payable';
      loanDir      = editRecord.loan_direction || 'owing';
      amount       = editRecord.amount         || '';
      description  = editRecord.description    || '';
      entryDate    = editRecord.date           || '';
      counterparty = editRecord.counterparty   || '';
      activityId   = editRecord.activityId     || '';
    } else {
      entryType    = opts.type       || 'payable';
      loanDir      = opts.loanDir    || 'owing';
      activityId   = (linkedContact && linkedContact.activityId) || opts.activityId || '';
      amount       = '';
      description  = '';
      entryDate    = todayStr();
      counterparty = '';
    }

    bindTabs();
    render();
  }

  function onKey(key) {
    if (contactPickerOpen) {
      if (key === 'Backspace' || key === 'SoftLeft') { closeContactPicker(); return; }
      if (key === 'ArrowDown') {
        contactFocusIdx = Math.min(filteredContacts.length - 1, contactFocusIdx + 1);
        updateContactList(); return;
      }
      if (key === 'ArrowUp') {
        contactFocusIdx = Math.max(0, contactFocusIdx - 1);
        updateContactList(); return;
      }
      if (key === 'Enter' || key === 'SoftRight') {
        if (filteredContacts[contactFocusIdx]) selectContact(filteredContacts[contactFocusIdx]);
        return;
      }
      return;
    }

    if (key === 'Backspace' || key === 'SoftLeft') { goBack(); return; }
    if (key === 'Enter' || key === 'SoftRight') {
      var inInput = document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' ||
         document.activeElement.tagName === 'SELECT');
      if (!inInput) { save(); return; }
    }
    if (key === 'ArrowDown') {
      focusIdx = Math.min(FIELDS.length - 1, focusIdx + 1);
      applyFieldFocus();
    }
    if (key === 'ArrowUp') {
      focusIdx = Math.max(0, focusIdx - 1);
      applyFieldFocus();
    }
  }

  global.LiabilitiesScreen = { onShow: onShow, onKey: onKey };

}(window));
