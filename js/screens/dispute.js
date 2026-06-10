// Screen: Dispute — field-by-field dispute editor
// Exposes: window.DisputeScreen
// Actions (Mark disputed, Submit) live inside content — not on CSK — to avoid
// timing / event-propagation issues with same-click re-firing.

(function(global) {
  'use strict';

  var SECTIONS = [
    {
      key: 'core', label: 'Job',
      fields: [
        { key: 'job',         label: 'Title',       type: 'text'     },
        { key: 'customer',    label: 'Customer',     type: 'text'     },
        { key: 'date',        label: 'Date',         type: 'date'     },
        { key: 'ref_number',  label: 'Reference',    type: 'text'     },
        { key: 'description', label: 'Description',  type: 'text'     },
      ]
    },
    {
      key: 'financial', label: 'Amount',
      fields: [
        { key: 'amount',   label: 'Amount',   type: 'number' },
        { key: 'currency', label: 'Currency', type: 'text'   },
        { key: 'vat',      label: 'VAT',      type: 'text'   },
        { key: 'worker',   label: 'Worker',   type: 'text'   },
      ]
    },
    {
      key: 'story', label: 'Story',
      fields: [
        { key: 'story', label: 'Story / Notes', type: 'textarea' },
        { key: 'tags',  label: 'Tags',          type: 'text'     },
      ]
    },
  ];

  var sourceRecord   = null;
  var disputedFields = {};
  var expanded       = {};
  var searchQuery    = '';
  var view           = 'list';   // 'list' | 'field' | 'review'
  var activeField    = null;
  var focusIdx       = 0;
  var parentUid      = null;
  var focusTimer     = null;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function setCsk(label) {
    var btn = document.getElementById('dispute-csk');
    if (btn) { btn.textContent = label || ''; btn.onclick = null; }
  }

  function setCrumb(text) {
    var el = document.getElementById('dispute-crumb-label');
    if (el) el.textContent = text;
  }

  function visibleSections() {
    var q = searchQuery.toLowerCase();
    var out = [];
    for (var i = 0; i < SECTIONS.length; i++) {
      var sec = SECTIONS[i];
      var fields = [];
      for (var j = 0; j < sec.fields.length; j++) {
        var f = sec.fields[j];
        if (!q || f.label.toLowerCase().indexOf(q) >= 0 ||
            String(sourceRecord[f.key] || '').toLowerCase().indexOf(q) >= 0) {
          fields.push(f);
        }
      }
      if (fields.length) out.push({ key: sec.key, label: sec.label, fields: fields });
    }
    return out;
  }

  function buildNavRows() {
    var rows = [];
    var secs = visibleSections();
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      rows.push({ type: 'section', sec: sec });
      if (expanded[sec.key]) {
        for (var j = 0; j < sec.fields.length; j++) {
          rows.push({ type: 'field', sec: sec, field: sec.fields[j] });
        }
      }
    }
    return rows;
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  function renderList() {
    var el = document.getElementById('dispute-content');
    if (!el) return;

    var rows = buildNavRows();
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var row     = rows[i];
      var focused = (i === focusIdx);
      if (row.type === 'section') {
        var isOpen    = expanded[row.sec.key];
        var dispCount = 0;
        for (var d = 0; d < row.sec.fields.length; d++) {
          if (disputedFields[row.sec.fields[d].key] !== undefined) dispCount++;
        }
        var badge = dispCount ? ' <span class="dp-sec-badge">' + dispCount + '</span>' : '';
        html += '<div class="dp-sec-hdr' + (focused ? ' focused' : '') +
          '" data-sec="' + row.sec.key + '">' +
          '<span class="dp-sec-arrow">' + (isOpen ? '\u25be' : '\u25b8') + '</span>' +
          '<span class="dp-sec-lbl">' + esc(row.sec.label) + badge + '</span>' +
          '<span class="dp-sec-count">(' + row.sec.fields.length + ')</span>' +
        '</div>';
      } else {
        var val      = sourceRecord[row.field.key];
        var disputed = disputedFields[row.field.key] !== undefined;
        var displayVal = (val !== null && val !== undefined && val !== '') ? String(val) : '\u2014';
        html += '<div class="dp-field-row' + (focused ? ' focused' : '') + (disputed ? ' disputed' : '') +
          '" data-sec="' + row.sec.key + '" data-field="' + row.field.key + '">' +
          '<div class="dp-field-lbl">' + esc(row.field.label) + (disputed ? ' \u2713' : '') + '</div>' +
          '<div class="dp-field-val">' + esc(displayVal) + '</div>' +
          '<span class="dp-field-arr">\u203a</span>' +
        '</div>';
      }
    }
    if (!html) html = '<div class="dp-empty">No fields match your search.</div>';

    var n = Object.keys(disputedFields).length;
    if (n) {
      html += '<div class="dp-review-trigger" id="dp-open-review">Review ' + n +
        ' dispute' + (n > 1 ? 's' : '') + ' \u203a</div>';
    }

    el.innerHTML = html;
    setCsk('');

    // Wire section headers and field rows — for loop for KaiOS NodeList compat
    var nodes = el.querySelectorAll('[data-sec]');
    for (var h = 0; h < nodes.length; h++) {
      (function(node) {
        var fkey = node.getAttribute('data-field');
        var skey = node.getAttribute('data-sec');
        if (fkey) {
          node.onclick = function() { enterFieldView(skey, fkey); };
        } else {
          node.onclick = function() {
            expanded[skey] = !expanded[skey];
            syncFocusToSection(skey);
            renderList();
          };
        }
      })(nodes[h]);
    }

    var reviewBtn = document.getElementById('dp-open-review');
    if (reviewBtn) {
      reviewBtn.onclick = function() { openReview(); };
    }

    scrollFocusedIntoView();
  }

  function syncFocusToSection(skey) {
    var rows = buildNavRows();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].type === 'section' && rows[i].sec.key === skey) { focusIdx = i; return; }
    }
  }

  function scrollFocusedIntoView() {
    var el = document.getElementById('dispute-content');
    if (!el) return;
    var focused = el.querySelector('.focused');
    if (focused && focused.scrollIntoView) focused.scrollIntoView({ block: 'nearest' });
  }

  // ── Field view ────────────────────────────────────────────────────────────────

  function enterFieldView(skey, fkey) {
    for (var i = 0; i < SECTIONS.length; i++) {
      if (SECTIONS[i].key !== skey) continue;
      for (var j = 0; j < SECTIONS[i].fields.length; j++) {
        if (SECTIONS[i].fields[j].key !== fkey) continue;
        activeField = SECTIONS[i].fields[j];
        view = 'field';
        setCrumb(activeField.label);
        renderFieldView();
        return;
      }
    }
  }

  function renderFieldView() {
    var el = document.getElementById('dispute-content');
    if (!el || !activeField) return;

    var currentVal  = sourceRecord[activeField.key];
    var proposedVal = disputedFields[activeField.key] !== undefined
      ? String(disputedFields[activeField.key]) : '';
    var displayCurrent = (currentVal !== null && currentVal !== undefined && currentVal !== '')
      ? String(currentVal) : '(empty)';

    var inputHtml = activeField.type === 'textarea'
      ? '<textarea id="dp-proposed-input" class="dp-input dp-textarea" rows="3" placeholder="Your version\u2026">' + esc(proposedVal) + '</textarea>'
      : '<input id="dp-proposed-input" class="dp-input" type="' + activeField.type +
        '" value="' + esc(proposedVal) + '" placeholder="Your version\u2026">';

    el.innerHTML =
      '<div class="dp-field-view">' +
        '<div class="dp-fv-label">Current</div>' +
        '<div class="dp-fv-current">' + esc(displayCurrent) + '</div>' +
        '<div class="dp-fv-label" style="margin-top:8px;">Proposed</div>' +
        inputHtml +
        '<div class="dp-fv-actions">' +
          '<span class="dp-fv-btn dp-fv-btn-confirm" id="dp-confirm-btn">\u2713 Mark disputed</span>' +
          '<span class="dp-fv-btn dp-fv-btn-copy" id="dp-copy-btn">\u2193 Copy</span>' +
          '<span class="dp-fv-btn dp-fv-btn-clear" id="dp-clear-btn">Clear</span>' +
        '</div>' +
      '</div>';

    setCsk('');

    var capturedVal = currentVal;
    var confirmBtn = document.getElementById('dp-confirm-btn');
    var copyBtn    = document.getElementById('dp-copy-btn');
    var clearBtn   = document.getElementById('dp-clear-btn');

    if (confirmBtn) confirmBtn.onclick = function() { confirmFieldDispute(); };
    if (copyBtn)    copyBtn.onclick    = function() {
      var inp = document.getElementById('dp-proposed-input');
      if (inp) inp.value = capturedVal || '';
    };
    if (clearBtn)   clearBtn.onclick   = function() {
      delete disputedFields[activeField.key];
      exitFieldView();
    };

    if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
    focusTimer = setTimeout(function() {
      focusTimer = null;
      var inp = document.getElementById('dp-proposed-input');
      if (inp && view === 'field') inp.focus();
    }, 80);
  }

  function confirmFieldDispute() {
    if (view !== 'field' || !activeField) return;
    var inp = document.getElementById('dp-proposed-input');
    if (!inp) { exitFieldView(); return; }
    var val = inp.value.trim();
    if (val !== '') {
      disputedFields[activeField.key] = val;
    } else {
      delete disputedFields[activeField.key];
    }
    exitFieldView();
  }

  function exitFieldView() {
    if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
    view = 'list';
    activeField = null;
    setCrumb('Dispute: ' + (sourceRecord ? (sourceRecord.job || 'Record') : ''));
    renderList();
  }

  // ── Review view ───────────────────────────────────────────────────────────────

  function openReview() {
    var keys = Object.keys(disputedFields);
    if (!keys.length) return;
    view = 'review';
    setCrumb('Review dispute');
    renderReview();
  }

  function renderReview() {
    var el = document.getElementById('dispute-content');
    if (!el) return;

    var keys = Object.keys(disputedFields);
    var html = '<div class="dp-review-hdr">Disputing ' + keys.length +
      ' field' + (keys.length > 1 ? 's' : '') + ':</div>';

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var label = k;
      for (var s = 0; s < SECTIONS.length; s++) {
        for (var f = 0; f < SECTIONS[s].fields.length; f++) {
          if (SECTIONS[s].fields[f].key === k) { label = SECTIONS[s].fields[f].label; break; }
        }
      }
      html += '<div class="dp-review-row">' +
        '<div class="dp-review-lbl">' + esc(label) + '</div>' +
        '<div class="dp-review-vals">' +
          '<span class="dp-review-old">' + esc(String(sourceRecord[k] || '\u2014')) + '</span>' +
          '<span class="dp-review-arrow">\u2192</span>' +
          '<span class="dp-review-new">' + esc(disputedFields[k]) + '</span>' +
        '</div>' +
      '</div>';
    }

    // Submit button lives inside content — not on CSK
    html += '<div class="dp-submit-btn" id="dp-submit-btn">Submit &amp; share dispute \u203a</div>' +
      '<div class="dp-back-btn" id="dp-back-btn">\u2190 Back to editing</div>';

    el.innerHTML = html;
    setCsk('');

    var submitBtn = document.getElementById('dp-submit-btn');
    var backBtn   = document.getElementById('dp-back-btn');
    if (submitBtn) submitBtn.onclick = function() { submitDispute(); };
    if (backBtn)   backBtn.onclick   = function() { exitReview(); };
  }

  function exitReview() {
    view = 'list';
    setCrumb('Dispute: ' + (sourceRecord ? (sourceRecord.job || 'Record') : ''));
    renderList();
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  function submitDispute() {
    if (view !== 'review' || !sourceRecord) return;
    var disputeRec = {
      record_type:  'dispute',
      record_class: 'financial',
      chainRef:     sourceRecord.chainRef,
      job:          'Dispute: ' + (sourceRecord.job || ''),
      customer:     sourceRecord.customer || '',
      currency:     sourceRecord.currency || 'GBP',
      date:         new Date().toISOString().slice(0, 10),
      _disputedId:  sourceRecord.id,
      _parentUid:   parentUid,
      disputeLink:  true,
      draft:        false,
    };
    var keys = Object.keys(disputedFields);
    for (var i = 0; i < keys.length; i++) { disputeRec[keys[i]] = disputedFields[keys[i]]; }

    RecordService.create(disputeRec).then(function(saved) {
      App.showShare(saved);
    }).catch(function(err) {
      alert('Could not create dispute: ' + (err && err.message ? err.message : 'error'));
    });
  }

  // ── Key handling ─────────────────────────────────────────────────────────────

  function onKey(key) {
    if (view === 'field') {
      if (key === 'Backspace') { exitFieldView(); return; }
      if (key === 'Enter')     { confirmFieldDispute(); return; }
      return;
    }
    if (view === 'review') {
      if (key === 'Backspace') { exitReview(); return; }
      if (key === 'Enter')     { submitDispute(); return; }
      return;
    }
    var rows = buildNavRows();
    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) { focusIdx--; renderList(); }
        break;
      case 'ArrowDown':
        if (focusIdx < rows.length - 1) { focusIdx++; renderList(); }
        break;
      case 'Enter':
        var row = rows[focusIdx];
        if (!row) break;
        if (row.type === 'section') {
          expanded[row.sec.key] = !expanded[row.sec.key];
          renderList();
        } else {
          enterFieldView(row.sec.key, row.field.key);
        }
        break;
      case 'Backspace':
        if (sourceRecord) App.showView(sourceRecord);
        else App.showList();
        break;
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  function onShow(opts) {
    opts           = opts || {};
    sourceRecord   = opts.record   || null;
    parentUid      = opts.parentUid || null;
    disputedFields = {};
    expanded       = {};
    searchQuery    = '';
    view           = 'list';
    activeField    = null;
    focusIdx       = 0;
    if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }

    if (!sourceRecord) { App.showList(); return; }

    setCrumb('Dispute: ' + (sourceRecord.job || 'Record'));

    var backEl = document.getElementById('dispute-crumb-back');
    if (backEl) backEl.onclick = function() { onKey('Backspace'); };

    var searchEl = document.getElementById('dispute-search');
    if (searchEl) {
      searchEl.value = '';
      searchEl.oninput = function() { searchQuery = searchEl.value; focusIdx = 0; renderList(); };
    }

    renderList();
  }

  global.DisputeScreen = { onShow: onShow, onKey: onKey };

}(window));
