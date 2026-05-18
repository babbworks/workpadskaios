// Screen: Management — Records | Personal | Settings tabs
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
          '<div class="view-field">' +
            '<div class="view-field-label">Active records</div>' +
            '<div class="view-field-value">' + sent + ' sent · ' + recv + ' received</div>' +
          '</div>' +
          '<div class="view-field" id="mgmt-arc-row" style="cursor:pointer;">' +
            '<div class="view-field-label">Archived</div>' +
            '<div class="view-field-value">' +
              archived.length + ' records' +
              '<span class="badge" style="margin-left:8px;font-size:10px;">View</span>' +
            '</div>' +
          '</div>' +
          '<div class="view-field">' +
            '<div class="view-field-label">Contacts (Block Registry)</div>' +
            '<div class="view-field-value">' + contacts + ' saved</div>' +
          '</div>' +
          '<div class="view-field">' +
            '<div class="view-field-label">Storage</div>' +
            '<div class="view-field-value">~' + kb + ' KB used</div>' +
          '</div>' +
          '<div class="view-field">' +
            '<div class="view-field-label">Codec</div>' +
            '<div class="view-field-value">pads-v1 (1pa/) + fflate</div>' +
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

  function renderSettings() {
    var act    = ActivityService.getActive() || {};
    var locale = ActivityService.getLocale();
    var sel    = (typeof CountryScreen !== 'undefined' && CountryScreen.getSelected)
                   ? CountryScreen.getSelected() : null;
    var countryName = sel ? sel.name : 'Not set';
    var countryFlag = (sel && CountryScreen.flagEmoji) ? CountryScreen.flagEmoji(sel.iso) + ' ' : '';

    el.content.innerHTML =
      '<div style="padding:6px 10px 2px; font-size:10px; color:var(--text-muted);' +
        ' text-transform:uppercase; letter-spacing:0.5px;">Profile</div>' +
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
      '<div style="padding:6px 10px 2px; font-size:10px; color:var(--text-muted);' +
        ' text-transform:uppercase; letter-spacing:0.5px; border-top:1px solid var(--border);' +
        ' margin-top:4px;">App</div>' +
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
    var name   = nameInp   ? nameInp.value.trim()  : '';
    var phone  = phoneInp  ? phoneInp.value.trim() : '';
    var locale = localeSel ? localeSel.value        : null;
    if (!name) { if (nameInp) nameInp.focus(); return; }
    ActivityService.update({ name: name, phone: phone });
    if (locale) ActivityService.setLocale(locale);
    renderSettings();
  }

  // ── Tab switching ──────────────────────────────────────────────────────

  function setTab(tab) {
    currentTab = tab;
    WorkpadsPanel.setContext({ screen: 'management', tab: tab });
    el.tabs.forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    if (el.csk) el.csk.textContent = (tab === 'settings') ? 'Save' : '';
    switch (tab) {
      case 'records':    renderRecords();     break;
      case 'activities': renderActivities();  break;
      case 'personal':   renderPersonal();    break;
      case 'settings':   renderSettings();    break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  function onShow() {
    setTab('records');
  }

  function onKey(key) {
    if (currentTab === 'activities') { actOnKey(key); return; }
    var tabs = ['records', 'activities', 'personal', 'settings'];
    var idx  = tabs.indexOf(currentTab);
    switch (key) {
      case 'ArrowLeft':
        if (idx > 0) setTab(tabs[idx - 1]);
        break;
      case 'ArrowRight':
        if (idx < tabs.length - 1) setTab(tabs[idx + 1]);
        break;
      case 'Enter':
        if (currentTab === 'settings') saveProfile();
        break;
      case 'Backspace':
        App.showList();
        break;
      case '1': setTab('records');     break;
      case '2': setTab('personal');    break;
      case '3': setTab('activities');  break;
      case '4': setTab('settings');    break;
    }
  }

  global.ManagementScreen = { onShow: onShow, onKey: onKey, showTab: setTab };

}(window));
