// Screen: Management — Records | Personal | Settings tabs
// Exposes: window.ManagementScreen

(function(global) {
  'use strict';

  var el = {
    content: document.getElementById('mgmt-content'),
    tabs:    document.getElementById('mgmt-tabs').querySelectorAll('.wizard-tab'),
    rsk:     document.getElementById('mgmt-rsk'),
  };

  var currentTab = 'records';

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
    RecordService.list().then(function(records) {
      RecordService.listArchived().then(function(archived) {
        BlockRegistry.count().then(function(contacts) {
          var kb   = Math.round(JSON.stringify(localStorage).length / 1024 * 10) / 10;
          var sent = records.filter(function(r) { return !r.receivedAt; }).length;
          var recv = records.filter(function(r) { return !!r.receivedAt; }).length;
          el.content.innerHTML =
            '<div class="view-field">' +
              '<div class="view-field-label">Active records</div>' +
              '<div class="view-field-value">' + sent + ' sent · ' + recv + ' received</div>' +
            '</div>' +
            '<div class="view-field">' +
              '<div class="view-field-label">Archived</div>' +
              '<div class="view-field-value" style="color:var(--text-muted);">' +
                archived.length + ' records' +
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
              '<div class="view-field-value">bitpad-v1 + fflate</div>' +
            '</div>';
        });
      });
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

  function renderSettings() {
    var act = ActivityService.getActive() || {};
    el.content.innerHTML =
      '<div style="padding:6px 10px 2px; font-size:10px; color:var(--text-muted);' +
        ' text-transform:uppercase; letter-spacing:0.5px;">Profile</div>' +
      fieldGroup('mgmt-name',  'Your name',          act.name  || '') +
      fieldGroup('mgmt-phone', 'Phone / WhatsApp',   act.phone || '', 'tel') +
      '<div style="padding:6px 10px 2px; font-size:10px; color:var(--text-muted);' +
        ' text-transform:uppercase; letter-spacing:0.5px; border-top:1px solid var(--border);' +
        ' margin-top:4px;">App</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Version</div>' +
        '<div class="view-field-value">Workpads v0.1.0</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Platform</div>' +
        '<div class="view-field-value">KaiOS 3.x</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Dependencies</div>' +
        '<div class="view-field-value">fflate 0.8.2 (MIT)</div>' +
      '</div>';

    var first = document.getElementById('mgmt-name');
    if (first) first.focus();
  }

  function saveProfile() {
    var nameInp  = document.getElementById('mgmt-name');
    var phoneInp = document.getElementById('mgmt-phone');
    var name  = nameInp  ? nameInp.value.trim()  : '';
    var phone = phoneInp ? phoneInp.value.trim() : '';
    if (!name) { if (nameInp) nameInp.focus(); return; }
    ActivityService.update({ name: name, phone: phone });
    // Brief visual feedback — re-render with saved data
    renderSettings();
  }

  // ── Tab switching ──────────────────────────────────────────────────────

  function setTab(tab) {
    currentTab = tab;
    el.tabs.forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    if (el.rsk) el.rsk.textContent = (tab === 'settings') ? 'Save' : '';
    switch (tab) {
      case 'records':  renderRecords();  break;
      case 'personal': renderPersonal(); break;
      case 'settings': renderSettings(); break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  function onShow() {
    setTab('records');
  }

  function onKey(key) {
    var tabs = ['records', 'personal', 'settings'];
    var idx  = tabs.indexOf(currentTab);
    switch (key) {
      case 'ArrowLeft':
        if (idx > 0) setTab(tabs[idx - 1]);
        break;
      case 'ArrowRight':
        if (idx < tabs.length - 1) setTab(tabs[idx + 1]);
        break;
      case 'SoftRight':
        if (currentTab === 'settings') saveProfile();
        break;
      case 'SoftLeft':
      case 'Backspace':
        App.showList();
        break;
    }
  }

  global.ManagementScreen = { onShow: onShow, onKey: onKey };

}(window));
