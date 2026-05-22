// Screen: Management — User | Records | Personal | Activities | My Templates tabs
// My Templates = RecordTemplateService (Personal / Imported / awaiting import)
// Exposes: window.ManagementScreen

(function(global) {
  'use strict';

  var el = {
    content: document.getElementById('mgmt-content'),
    tabs:    document.getElementById('mgmt-tabs').querySelectorAll('.wizard-tab'),
    csk:     document.getElementById('mgmt-csk'),
  };

  var currentTab = 'records';
  var actFocusIdx   = 0;  // focused activity item index (-1 = new-input row)
  var actItems      = []; // current WorkActivity list
  var actDelPending = null; // id of activity pending delete confirmation

  // ── My Templates tab state (RecordTemplateService) ───────────────────────
  var tplItems      = [];
  var tplFocusIdx   = 0;
  var tplScopeTab   = 'personal'; // 'personal' | 'imported'
  var tplMode       = 'list';     // 'list' | 'pending-list' | 'form' | 'confirm-delete'
  var tplEditId     = null;
  var tplDelPending = null;

  var TPL_TYPE_OPTS = [
    { val: '',        label: 'Job'      },
    { val: 'quote',   label: 'Quote'    },
    { val: 'invoice', label: 'Invoice'  },
    { val: 'receipt', label: 'Receipt'  },
    { val: 'contact', label: 'Contact'  },
    { val: 'pads',    label: 'Basic'    },
  ];
  var TPL_VAT_OPTS = [
    { val: '',         label: 'Not set'   },
    { val: 'none',     label: 'No tax'    },
    { val: 'standard', label: 'Standard'  },
    { val: 'zero',     label: 'Zero rate' },
    { val: 'custom',   label: 'Custom %'  },
  ];

  function uiPhaseToggleRows() {
    if (!global.UIPhase || !UIPhase.list) return '';
    var keys = ['progressive_form', 'in_out_frame', 'capture_lens'];
    var html = '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var item = null;
      var all = UIPhase.list();
      for (var j = 0; j < all.length; j++) {
        if (all[j].key === k) item = all[j];
      }
      if (!item) continue;
      html += '<div class="view-field mgmt-phase-row" data-phase-key="' + esc(k) + '" style="cursor:pointer;">' +
        '<div class="view-field-label">' + esc(item.label) + '</div>' +
        '<div class="view-field-value">' +
          (item.on
            ? '<span class="badge badge-accent">On</span>'
            : '<span class="badge">Off</span>') +
          ' <span style="font-size:10px;color:var(--text-muted);">tap to toggle</span>' +
        '</div></div>';
    }
    return html;
  }

  function wireUiPhaseToggles() {
    var rows = document.querySelectorAll('.mgmt-phase-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', function() {
        var key = this.getAttribute('data-phase-key');
        if (!key || !global.UIPhase) return;
        if (UIPhase.isOn(key)) UIPhase.disable(key);
        else UIPhase.enable(key);
        renderSettings();
      });
    }
  }

  function fieldGroup(id, label, value, type) {
    return '<div class="field-group">' +
      '<div class="field-label">' + label + '</div>' +
      '<input class="field-input" id="' + id + '" type="' + (type || 'text') + '" ' +
        'value="' + esc(value) + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
      '</div>';
  }

  // ── Tab renderers ──────────────────────────────────────────────────────

  function renderRecords() {
    Promise.all([RecordService.list(), RecordService.listArchived(), BlockRegistry.count()])
      .then(function(results) {
        var records  = results[0];
        var archived = results[1];
        var contacts = results[2];
        var kb   = Math.round(JSON.stringify(localStorage).length / 1024 * 10) / 10;
        var sent = records.filter(function(r) { return !r.receivedAt; }).length;
        var recv = records.filter(function(r) { return !!r.receivedAt; }).length;
        el.content.innerHTML =
          '<div class="view-sec-hdr">Records</div>' +
          '<div class="view-field">' +
            '<div class="view-field-label">Active</div>' +
            '<div class="view-field-value">' + sent + ' sent · ' + recv + ' received</div>' +
          '</div>' +
          '<div class="view-field" id="mgmt-arc-row" style="cursor:pointer;">' +
            '<div class="view-field-label">Archived</div>' +
            '<div class="view-field-value">' +
              archived.length +
              '<span class="badge" style="margin-left:8px;font-size:10px;">View</span>' +
            '</div>' +
          '</div>' +
          '<div class="view-sec-hdr">Contacts</div>' +
          '<div class="view-field">' +
            '<div class="view-field-label">Block Registry</div>' +
            '<div class="view-field-value">' + contacts + ' saved</div>' +
          '</div>' +
          '<div class="view-sec-hdr">Storage</div>' +
          '<div class="view-field">' +
            '<div class="view-field-label">Used</div>' +
            '<div class="view-field-value">~' + kb + ' KB</div>' +
          '</div>' +
          '<div class="view-field">' +
            '<div class="view-field-label">Codec</div>' +
            '<div class="view-field-value">pads-v1 + fflate</div>' +
          '</div>';
        var arcRow = document.getElementById('mgmt-arc-row');
        if (arcRow) arcRow.addEventListener('click', function() { App.showArchive(); });
      });
  }

  function renderPersonal() {
    PersonalService.count().then(function(n) {
      el.content.innerHTML =
        '<div class="view-field">' +
          '<div class="view-field-label">Quick notes</div>' +
          '<div class="view-field-value">' + n + ' captures</div>' +
        '</div>' +
        '<div class="view-field">' +
          '<div class="view-field-label">Export</div>' +
          '<div class="view-field-value" style="color:var(--text-muted);">Coming in v0.2</div>' +
        '</div>';
    });
  }

  function localeSelect(currentLocale) {
    var opts = ActivityService.LOCALE_OPTIONS;
    var html = '<select class="field-input" id="mgmt-locale">';
    for (var i = 0; i < opts.length; i++) {
      var sel = opts[i].id === currentLocale ? ' selected' : '';
      html += '<option value="' + opts[i].id + '"' + sel + '>' + esc(opts[i].label) + '</option>';
    }
    return html + '</select>';
  }

  var FIN_CCY_OPTS = ['', 'GBP', 'USD', 'EUR', 'NGN', 'KES', 'ZAR', 'GHS', 'INR', 'AUD'];

  function finCcySelectRow(id, label, current) {
    var html = '<div class="field-group"><div class="field-label">' + esc(label) + '</div>' +
      '<select class="field-input" id="' + id + '">';
    for (var i = 0; i < FIN_CCY_OPTS.length; i++) {
      var v = FIN_CCY_OPTS[i];
      var lbl = v || '(profile default)';
      html += '<option value="' + v + '"' + (v === current ? ' selected' : '') + '>' + esc(lbl) + '</option>';
    }
    return html + '</select></div>';
  }

  // ── Activities tab ─────────────────────────────────────────────────────

  function renderActivities() {
    actDelPending = null;
    actItems = WorkActivityService.listAll();
    var rows = actItems.map(function(act, i) {
      return '<div class="act-item' + (actFocusIdx === i ? ' focused' : '') + '" data-act-idx="' + i + '">' +
        '<span class="act-name">' + esc(act.name) + '</span>' +
        '<span class="act-del" data-act-del="' + esc(act.id) + '">\u00d7</span>' +
        '</div>';
    }).join('');
    el.content.innerHTML =
      '<div class="act-new-row" id="act-new-row">' +
        '<input class="field-input act-new-input" id="act-new-input" ' +
          'placeholder="New activity name\u2026" autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<span class="badge badge-accent act-add-btn" id="act-add-btn">Add</span>' +
      '</div>' +
      (actItems.length ? rows : '<div class="empty-state" style="font-size:11px;">No activities yet.</div>');
    bindActivityEvents();
    if (el.csk) el.csk.textContent = actItems.length ? 'Delete' : '';
  }

  function bindActivityEvents() {
    var addBtn = document.getElementById('act-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function() { actAdd(); });
    }
    var input = document.getElementById('act-new-input');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { actAdd(); e.preventDefault(); e.stopPropagation(); }
      });
    }
    var delBtns = el.content.querySelectorAll('[data-act-del]');
    for (var i = 0; i < delBtns.length; i++) {
      delBtns[i].addEventListener('click', (function(actId) {
        return function(e) { e.stopPropagation(); actDeletePrompt(actId); };
      })(delBtns[i].getAttribute('data-act-del')));
    }
    var items = el.content.querySelectorAll('.act-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', (function(idx) {
        return function() { actFocusIdx = idx; applyActFocus(); };
      })(j));
    }
  }

  function actAdd() {
    var inp = document.getElementById('act-new-input');
    if (!inp) return;
    var name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    WorkActivityService.create(name);
    actFocusIdx = 0;
    renderActivities();
  }

  function applyActFocus() {
    var nodes = el.content.querySelectorAll('.act-item');
    nodes.forEach(function(n) { n.classList.remove('focused'); });
    if (actFocusIdx >= 0 && actFocusIdx < nodes.length) {
      nodes[actFocusIdx].classList.add('focused');
      nodes[actFocusIdx].scrollIntoView({ block: 'nearest' });
    }
    if (el.csk) el.csk.textContent = actItems.length ? 'Delete' : '';
  }

  function actDeletePrompt(actId) {
    actDelPending = actId;
    var act = WorkActivityService.getById(actId);
    if (!act) { renderActivities(); return; }
    WorkActivityService.countRecords(actId).then(function(count) {
      var others = WorkActivityService.listAll().filter(function(a) { return a.id !== actId; });
      var selectHtml = '';
      if (count > 0) {
        selectHtml =
          '<div class="field-group" style="margin:6px 0;">' +
            '<div class="field-label">Re-assign ' + count + ' record(s) to:</div>' +
            '<select class="field-input" id="act-reassign-sel">' +
              '<option value="">— Unassign —</option>' +
              others.map(function(o) {
                return '<option value="' + esc(o.id) + '">' + esc(o.name) + '</option>';
              }).join('') +
            '</select>' +
          '</div>';
      }
      el.content.innerHTML =
        '<div class="act-del-prompt">' +
          '<div class="act-del-title">Delete &ldquo;' + esc(act.name) + '&rdquo;?</div>' +
          (count > 0 ? selectHtml : '<div style="font-size:11px;color:var(--text-muted);margin:6px 0;">No records assigned.</div>') +
          '<div class="act-del-actions">' +
            '<span class="badge act-cancel-btn" id="act-cancel-btn">Cancel</span>' +
            '<span class="badge badge-danger act-confirm-btn" id="act-confirm-btn">Delete</span>' +
          '</div>' +
        '</div>';
      document.getElementById('act-cancel-btn').addEventListener('click', function() {
        actDelPending = null; renderActivities();
      });
      document.getElementById('act-confirm-btn').addEventListener('click', function() {
        var sel = document.getElementById('act-reassign-sel');
        var toId = sel ? sel.value || null : null;
        WorkActivityService.reassignRecords(actDelPending, toId).then(function() {
          WorkActivityService.remove(actDelPending);
          actDelPending = null;
          actFocusIdx = 0;
          renderActivities();
        });
      });
    });
  }

  function actOnKey(key) {
    switch (key) {
      case 'ArrowUp':
        if (actDelPending) return;
        if (actFocusIdx > 0) { actFocusIdx--; applyActFocus(); }
        else { var inp = document.getElementById('act-new-input'); if (inp) inp.focus(); }
        break;
      case 'ArrowDown':
        if (actDelPending) return;
        if (actFocusIdx < actItems.length - 1) { actFocusIdx++; applyActFocus(); }
        break;
      case 'Enter': {
        if (actDelPending) return;
        var ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
        if (actItems[actFocusIdx]) actDeletePrompt(actItems[actFocusIdx].id);
        break;
      }
      case 'Backspace':
        if (actDelPending) { actDelPending = null; renderActivities(); }
        else { App.showList(); }
        break;
    }
  }

  function tplScopeFilterBtn(val, label) {
    var active = tplScopeTab === val ? ' active' : '';
    return '<span class="tp-pad-btn' + active + '" data-tpl-scope="' + val + '">' + label + '</span>';
  }

  function tplLoadItems() {
    if (tplMode === 'pending-list') {
      return RecordTemplateService.listPendingImport();
    }
    if (tplScopeTab === 'imported') {
      return RecordTemplateService.listImported();
    }
    return RecordTemplateService.listPersonal();
  }

  function tplPendingCount() {
    return RecordTemplateService.listPendingImport().length;
  }

  // ── My Templates tab ─────────────────────────────────────────────────────

  function tplTypeLabel(tpl) {
    if (tpl.record_class === 'contact' || tpl.record_type === 'contact') return 'Contact';
    if (tpl.record_class === 'pads')    return 'Basic';
    for (var i = 0; i < TPL_TYPE_OPTS.length; i++) {
      if (TPL_TYPE_OPTS[i].val === (tpl.record_type || '')) return TPL_TYPE_OPTS[i].label;
    }
    return 'Job';
  }

  function renderTemplates() {
    if (tplMode === 'confirm-delete') { renderTplDeleteConfirm(); return; }

    tplItems = tplLoadItems();
    if (tplFocusIdx >= tplItems.length) tplFocusIdx = Math.max(0, tplItems.length - 1);

    var pendingN = tplPendingCount();
    var awaitBar = '';
    if (tplMode === 'list' && tplScopeTab === 'imported' && pendingN > 0) {
      awaitBar =
        '<div class="act-item" data-tpl-await-bar="1" style="border:1px dashed var(--accent);cursor:pointer;">' +
          '<span class="act-name" style="color:var(--accent);">' + pendingN + ' awaiting import</span>' +
          '<span class="badge" style="font-size:9px;">Review</span>' +
        '</div>';
    }

    var rows = tplItems.map(function(t, i) {
      var foc = (tplFocusIdx === i) ? ' focused' : '';
      var badge = tplMode === 'pending-list'
        ? '<span class="badge" style="font-size:9px;margin-left:4px;">Awaiting</span>'
        : '<span class="badge" style="font-size:9px;margin-left:4px;">' + esc(tplTypeLabel(t)) + '</span>';
      var del = tplMode === 'pending-list' ? '' :
        '<span class="act-del" data-tpl-del="' + esc(t.id) + '">\u00d7</span>';
      return '<div class="act-item' + foc + '" data-tpl-idx="' + i + '">' +
        '<span class="act-name">' + esc(t.name || '(unnamed)') + '</span>' + del + badge +
      '</div>';
    }).join('');

    var scopeBar = tplMode === 'pending-list' ? '' :
      '<div class="tp-pad-filters" style="margin-bottom:6px;">' +
        tplScopeFilterBtn('personal', 'Personal') +
        tplScopeFilterBtn('imported', 'Imported') +
      '</div>';

    var hdr = tplMode === 'pending-list'
      ? '<div style="font-size:10px;color:var(--text-muted);padding:4px 10px 8px;">In storage but not imported. Import to add to My Templates.</div>'
      : '';

    var emptyMsg = tplMode === 'pending-list'
      ? 'Nothing awaiting import.'
      : (tplScopeTab === 'imported'
        ? 'No imported templates yet.<br>Import external templates when you review them.'
        : 'No personal templates yet.<br>Create one or save a record as template.');

    var newRow = (tplMode === 'list' && tplScopeTab === 'personal')
      ? '<div class="act-new-row">' +
          '<span class="badge badge-accent act-add-btn" id="tpl-new-btn" style="width:100%;text-align:center;cursor:pointer;">+ New template</span>' +
        '</div>'
      : '';

    el.content.innerHTML =
      scopeBar + hdr + newRow + awaitBar +
      (tplItems.length ? rows : '<div class="empty-state" style="font-size:11px;">' + emptyMsg + '</div>');

    if (el.csk) {
      if (tplMode === 'pending-list') el.csk.textContent = tplItems.length ? 'Import' : '';
      else el.csk.textContent = tplItems.length ? 'Apply' : '';
    }

    var newBtn = document.getElementById('tpl-new-btn');
    if (newBtn) newBtn.addEventListener('click', function() { App.showTemplateCreator({ returnTo: 'management' }); });

    var awaitEl = el.content.querySelector('[data-tpl-await-bar]');
    if (awaitEl) {
      awaitEl.addEventListener('click', function() {
        tplMode = 'pending-list'; tplFocusIdx = 0; renderTemplates();
      });
    }

    var scopeBtns = el.content.querySelectorAll('[data-tpl-scope]');
    for (var si = 0; si < scopeBtns.length; si++) {
      scopeBtns[si].addEventListener('click', (function(btn) {
        return function() {
          tplScopeTab = btn.getAttribute('data-tpl-scope');
          tplMode = 'list'; tplFocusIdx = 0; renderTemplates();
        };
      })(scopeBtns[si]));
    }

    var delBtns = el.content.querySelectorAll('[data-tpl-del]');
    for (var di = 0; di < delBtns.length; di++) {
      delBtns[di].addEventListener('click', (function(id) {
        return function(e) { e.stopPropagation(); tplStartDelete(id); };
      })(delBtns[di].getAttribute('data-tpl-del')));
    }
    var rows2 = el.content.querySelectorAll('.act-item[data-tpl-idx]');
    for (var ri = 0; ri < rows2.length; ri++) {
      rows2[ri].addEventListener('click', (function(idx) {
        return function(e) {
          if (e.target.classList.contains('act-del')) return;
          tplFocusIdx = idx;
          applyTplFocus();
        };
      })(ri));
      rows2[ri].addEventListener('dblclick', (function(idx) {
        return function() { tplFocusIdx = idx; tplDoPrimary(tplItems[idx]); };
      })(ri));
    }
    applyTplFocus();
  }

  function tplDoPrimary(tpl) {
    if (!tpl) return;
    if (tplMode === 'pending-list') {
      RecordTemplateService.importTemplate(tpl.id);
      tplScopeTab = 'imported';
      tplMode = 'list';
      tplFocusIdx = 0;
      renderTemplates();
      return;
    }
    tplApply(tpl);
  }

  function applyTplFocus() {
    var nodes = el.content.querySelectorAll('.act-item[data-tpl-idx]');
    nodes.forEach(function(n) { n.classList.remove('focused'); });
    if (tplFocusIdx >= 0 && tplFocusIdx < nodes.length) {
      nodes[tplFocusIdx].classList.add('focused');
      nodes[tplFocusIdx].scrollIntoView({ block: 'nearest' });
    }
    if (el.csk) el.csk.textContent = tplItems.length ? 'Apply' : '';
  }

  function tplStartDelete(id) {
    tplDelPending = id;
    tplMode = 'confirm-delete';
    renderTemplates();
  }

  function renderTplDeleteConfirm() {
    var tpl = RecordTemplateService.get(tplDelPending) || {};
    el.content.innerHTML =
      '<div class="act-del-prompt">' +
        '<div class="act-del-title">Delete &ldquo;' + esc(tpl.name || 'template') + '&rdquo;?</div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin:6px 0;">This cannot be undone.</div>' +
        '<div class="act-del-actions">' +
          '<span class="badge act-cancel-btn" id="tpl-del-cancel">Cancel</span>' +
          '<span class="badge badge-danger act-confirm-btn" id="tpl-del-confirm">Delete</span>' +
        '</div>' +
      '</div>';
    document.getElementById('tpl-del-cancel').addEventListener('click', function() {
      tplDelPending = null; tplMode = 'list'; renderTemplates();
    });
    document.getElementById('tpl-del-confirm').addEventListener('click', function() {
      RecordTemplateService.remove(tplDelPending);
      tplDelPending = null; tplMode = 'list'; tplFocusIdx = 0;
      renderTemplates();
    });
  }

  function tplApply(tpl) {
    if (!tpl) return;
    var preFields = RecordTemplateService.buildRecord(tpl.id);
    // Preserve record_type for routing; record_class determines wizard variant
    var recClass = tpl.record_class || 'job';
    preFields.record_class = recClass;
    if (recClass !== 'contact' && recClass !== 'pads' && tpl.record_type) {
      preFields.record_type = tpl.record_type;
    }
    RecordService.create(preFields).then(function(rec) {
      App.showWizard(rec);
    });
  }

  function tplOnKey(key) {
    if (tplMode === 'confirm-delete') {
      if (key === 'Backspace') { tplDelPending = null; tplMode = 'list'; renderTemplates(); }
      return;
    }
    if (tplMode === 'pending-list') {
      if (key === 'Backspace') {
        tplMode = 'list'; tplScopeTab = 'imported'; tplFocusIdx = 0; renderTemplates();
        return;
      }
      switch (key) {
        case 'ArrowUp':
          if (tplFocusIdx > 0) { tplFocusIdx--; applyTplFocus(); }
          break;
        case 'ArrowDown':
          if (tplFocusIdx < tplItems.length - 1) { tplFocusIdx++; applyTplFocus(); }
          break;
        case 'Enter':
        case 'SoftRight':
          if (tplItems[tplFocusIdx]) {
            if (key === 'SoftRight') {
              App.showTemplateCreator({ editId: tplItems[tplFocusIdx].id, returnTo: 'management', adoptOnSave: true });
            } else {
              tplDoPrimary(tplItems[tplFocusIdx]);
            }
          }
          break;
      }
      return;
    }
    switch (key) {
      case 'ArrowUp':
        if (tplFocusIdx > 0) { tplFocusIdx--; applyTplFocus(); }
        break;
      case 'ArrowDown':
        if (tplFocusIdx < tplItems.length - 1) { tplFocusIdx++; applyTplFocus(); }
        break;
      case 'Enter': {
        var ae2 = document.activeElement;
        if (ae2 && (ae2.tagName === 'INPUT' || ae2.tagName === 'TEXTAREA')) return;
        if (tplItems[tplFocusIdx]) tplDoPrimary(tplItems[tplFocusIdx]);
        break;
      }
      case 'SoftRight':
        if (tplItems[tplFocusIdx]) {
          App.showTemplateCreator({ editId: tplItems[tplFocusIdx].id, returnTo: 'management' });
        }
        break;
      case 'Backspace':
        App.showList();
        break;
    }
  }

  function renderSettings() {
    var act    = ActivityService.getActive() || {};
    var locale = ActivityService.getLocale();
    var sel    = (typeof CountryScreen !== 'undefined' && CountryScreen.getSelected)
                   ? CountryScreen.getSelected() : null;
    var countryName = sel ? sel.name : 'Not set';
    var countryFlag = (sel && CountryScreen.flagEmoji) ? CountryScreen.flagEmoji(sel.iso) + ' ' : '';

    el.content.innerHTML =
      '<div class="view-sec-hdr">Profile</div>' +
      fieldGroup('mgmt-name',  'Your name',         act.name  || '') +
      fieldGroup('mgmt-phone', 'Phone / WhatsApp',  act.phone || '', 'tel') +
      '<div class="field-group">' +
        '<div class="field-label">Region / Currency</div>' +
        localeSelect(locale.locale) +
      '</div>' +
      '<div class="view-field" style="cursor:pointer;" id="mgmt-country-row">' +
        '<div class="view-field-label">Country</div>' +
        '<div class="view-field-value">' +
          countryFlag + esc(countryName) +
          '<span class="badge" style="margin-left:8px; font-size:10px;">Change</span>' +
        '</div>' +
      '</div>' +
      '<div class="view-sec-hdr">Finance overview</div>' +
      finCcySelectRow('mgmt-fin-ccy-1', 'Primary currency', ActivityService.getFinPriority().primary) +
      finCcySelectRow('mgmt-fin-ccy-2', 'Secondary currency', ActivityService.getFinPriority().secondary) +
      '<div class="view-sec-hdr">Job &amp; connections (IO)</div>' +
      fieldGroup('mgmt-outcome-label', 'Outcome label',
        (global.GlobalSynonymsService ? (GlobalSynonymsService.getAll().job || GlobalSynonymsService.canonicalLabel('job')) : 'Outcome')) +
      '<div class="view-field" id="mgmt-job-inputs-row" style="cursor:pointer;">' +
        '<div class="view-field-label">Inputs label</div>' +
        '<div class="view-field-value" id="mgmt-job-inputs-val">' +
          esc(global.IOLabels ? IOLabels.jobInputsLabel() : 'Job Inputs') +
          ' <span style="font-size:10px;color:var(--text-muted);">tap: Job \u2192 Work</span>' +
        '</div>' +
      '</div>' +
      '<div class="view-field" id="mgmt-connections-row" style="cursor:pointer;">' +
        '<div class="view-field-label">Connections</div>' +
        '<div class="view-field-value">Rhythm view (rel-volume) <span class="badge" style="margin-left:6px;">Open</span></div>' +
      '</div>' +
      (global.RelVolumeSettings ? RelVolumeSettings.renderSection() : '') +
      '<div class="view-sec-hdr">App</div>' +
      uiPhaseToggleRows() +
      '<div class="view-field" id="mgmt-home-toggle" style="cursor:pointer;">' +
        '<div class="view-field-label">Home Screen (boot)</div>' +
        '<div class="view-field-value" id="mgmt-home-val">' +
          '<span class="badge badge-accent" id="mgmt-home-badge">' + esc(App.homeModeLabel(App.getHomeMode())) + '</span>' +
          ' <span style="font-size:10px; color:var(--text-muted);">tap: List \u2192 WP+ \u2192 Sell</span>' +
        '</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Version</div>' +
        '<div class="view-field-value">Workpads v0.2.0</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Codec</div>' +
        '<div class="view-field-value">pads-v1 (1pa/) + fflate</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Platform</div>' +
        '<div class="view-field-value">KaiOS 3.x</div>' +
      '</div>';

    var homeToggle = document.getElementById('mgmt-home-toggle');
    if (homeToggle) {
      homeToggle.addEventListener('click', function() {
        var next = App.cycleHomeMode();
        var badge = document.getElementById('mgmt-home-badge');
        if (badge) badge.textContent = App.homeModeLabel(next);
      });
    }

    wireUiPhaseToggles();

    var jiRow = document.getElementById('mgmt-job-inputs-row');
    if (jiRow && global.IOLabels) {
      jiRow.addEventListener('click', function() {
        var next = IOLabels.jobInputsMode() === 'work' ? 'job' : 'work';
        IOLabels.setJobInputsMode(next);
        var v = document.getElementById('mgmt-job-inputs-val');
        if (v) v.textContent = IOLabels.jobInputsLabel() + ' \u00b7 tap: Job \u2192 Work';
      });
    }
    var connRow = document.getElementById('mgmt-connections-row');
    if (connRow) {
      connRow.addEventListener('click', function() { App.showConnections(); });
    }
    if (global.RelVolumeSettings) RelVolumeSettings.wire(el.content);

    var countryRow = document.getElementById('mgmt-country-row');
    if (countryRow) {
      countryRow.addEventListener('click', function() {
        App.showCountry('management');
      });
    }

    var first = document.getElementById('mgmt-name');
    if (first) first.focus();
  }

  function saveProfile() {
    var nameInp   = document.getElementById('mgmt-name');
    var phoneInp  = document.getElementById('mgmt-phone');
    var localeSel = document.getElementById('mgmt-locale');
    var ccy1      = document.getElementById('mgmt-fin-ccy-1');
    var ccy2      = document.getElementById('mgmt-fin-ccy-2');
    var name   = nameInp   ? nameInp.value.trim()  : '';
    var phone  = phoneInp  ? phoneInp.value.trim() : '';
    var locale = localeSel ? localeSel.value        : null;
    if (locale) ActivityService.setLocale(locale);
    ActivityService.setFinPriority(
      ccy1 ? ccy1.value : '',
      ccy2 ? ccy2.value : ''
    );
    ActivityService.update({ name: name, phone: phone });
    var outcomeInp = document.getElementById('mgmt-outcome-label');
    if (outcomeInp && global.GlobalSynonymsService) {
      var ol = outcomeInp.value.trim();
      GlobalSynonymsService.setOne('job', ol || '');
    }
    if (global.RelVolumeSettings) RelVolumeSettings.readFromDom();
    renderSettings();
  }

  // ── Tab switching ──────────────────────────────────────────────────────

  function setTab(tab) {
    currentTab = tab;
    WorkpadsPanel.setContext({ screen: 'management', tab: tab });
    el.tabs.forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    if (el.csk) el.csk.textContent = (tab === 'user') ? 'Save' : '';
    switch (tab) {
      case 'records':    renderRecords();                              break;
      case 'activities': renderActivities();                           break;
      case 'personal':   renderPersonal();                             break;
      case 'templates':
        tplMode = 'list'; tplFocusIdx = 0; renderTemplates();
        break;
      case 'user':       renderSettings();                             break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  function onShow(opts) {
    opts = opts || {};
    var tab = opts.tab;
    if (tab === 'templates' || tab === 'user' || tab === 'records' ||
        tab === 'personal' || tab === 'activities') {
      setTab(tab);
    } else {
      setTab('records');
    }
    if (tab === 'templates') {
      if (opts.tplScope === 'imported' || opts.tplScope === 'personal') {
        tplScopeTab = opts.tplScope;
      }
      if (opts.tplMode === 'pending-list') {
        tplScopeTab = 'imported';
        tplMode = 'pending-list';
        tplFocusIdx = 0;
        renderTemplates();
      }
    }
  }

  function onKey(key) {
    // Tab order: User | Records | Personal | Activities | My Templates
    var tabs = ['user', 'records', 'personal', 'activities', 'templates'];
    var idx  = tabs.indexOf(currentTab);

    if (key === 'ArrowLeft') {
      if (idx > 0) setTab(tabs[idx - 1]);
      return;
    }
    if (key === 'ArrowRight') {
      if (idx < tabs.length - 1) setTab(tabs[idx + 1]);
      return;
    }

    if (currentTab === 'activities') { actOnKey(key); return; }
    if (currentTab === 'templates')  { tplOnKey(key); return; }

    switch (key) {
      case 'Enter':
        if (currentTab === 'user') saveProfile();
        break;
      case 'Backspace':
        App.showList();
        break;
      case '1': setTab('user');        break;
      case '2': setTab('records');     break;
      case '3': setTab('personal');    break;
      case '4': setTab('activities');  break;
      case '5': setTab('templates');   break;
    }
  }

  global.ManagementScreen = { onShow: onShow, onKey: onKey, showTab: setTab };

}(window));
