// Screen: User Switcher — switch between ActivityService profiles
// Exposes: window.UserSwitcherScreen

(function(global) {
  'use strict';

  var mode      = 'list'; // 'list' | 'add'
  var focusIdx  = 0;
  var users     = [];

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isFocusInInput() {
    var a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
  }

  function load() {
    users = ActivityService.listAll();
    users.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  }

  // ── List render ────────────────────────────────────────────────────────────

  function render() {
    var el = document.getElementById('usw-content');
    if (!el) return;

    if (mode === 'add') { renderAddForm(el); return; }

    var active   = ActivityService.getActive();
    var activeId = active ? active.id : null;
    var html     = '';

    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var isFocused  = focusIdx === i;
      var isActive   = u.id === activeId;
      html += '<div class="usw-row' + (isFocused ? ' focused' : '') + (isActive ? ' usw-active' : '') +
        '" data-uid="' + esc(u.id) + '">' +
        '<span class="usw-name">' + esc(u.name || '(no name)') + '</span>' +
        (isActive ? '<span class="usw-check">\u2713</span>' : '<span class="usw-check"></span>') +
      '</div>';
    }

    var addFocused = focusIdx === users.length;
    html += '<div class="usw-row usw-add-row' + (addFocused ? ' focused' : '') + '">' +
      '<span class="usw-name">\u271a Add user</span>' +
      '<span class="usw-check"></span>' +
    '</div>';

    el.innerHTML = html;
    bindListClicks(el);
  }

  function bindListClicks(el) {
    var rows = el.querySelectorAll('[data-uid]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', (function(uid) {
        return function() { switchToUser(uid); };
      })(rows[i].getAttribute('data-uid')));
    }
    var addRow = el.querySelector('.usw-add-row');
    if (addRow) addRow.addEventListener('click', function() { mode = 'add'; render(); });
  }

  // ── Add form ───────────────────────────────────────────────────────────────

  function renderAddForm(el) {
    var localeOpts = ActivityService.LOCALE_OPTIONS.map(function(l) {
      return '<option value="' + esc(l.id) + '">' + esc(l.label) + '</option>';
    }).join('');

    el.innerHTML =
      '<div class="usw-add-hdr">Add User</div>' +
      '<div class="field-group" style="margin:8px 10px 4px;">' +
        '<div class="field-label">Name *</div>' +
        '<input class="field-input" id="usw-add-name" type="text" placeholder="Full name" autocomplete="off">' +
      '</div>' +
      '<div class="field-group" style="margin:4px 10px 8px;">' +
        '<div class="field-label">Region / Currency</div>' +
        '<select class="field-input" id="usw-add-locale">' + localeOpts + '</select>' +
      '</div>' +
      '<div style="display:flex; gap:8px; margin:0 10px;">' +
        '<span id="usw-cancel-btn" class="usw-form-btn usw-cancel">Cancel</span>' +
        '<span id="usw-save-btn"   class="usw-form-btn usw-save">Save</span>' +
      '</div>';

    var nameInp = document.getElementById('usw-add-name');
    if (nameInp) {
      setTimeout(function() { nameInp.focus(); }, 60);
      nameInp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); saveNewUser(); }
      });
    }
    var cancelBtn = document.getElementById('usw-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', function() { mode = 'list'; render(); });
    var saveBtn = document.getElementById('usw-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveNewUser);
  }

  function saveNewUser() {
    var nameInp   = document.getElementById('usw-add-name');
    var localeInp = document.getElementById('usw-add-locale');
    var name   = nameInp   ? nameInp.value.trim()  : '';
    var locale = localeInp ? localeInp.value        : 'gb-v1';
    if (!name) { if (nameInp) nameInp.focus(); return; }
    var newAct = ActivityService.create({ name: name, locale: locale });
    ActivityService.setActive(newAct.id);
    location.reload();
  }

  function switchToUser(id) {
    ActivityService.setActive(id);
    location.reload();
  }

  // ── D-pad ──────────────────────────────────────────────────────────────────

  function onKey(key) {
    if (mode === 'add') {
      if (key === 'Backspace' && !isFocusInInput()) { mode = 'list'; render(); }
      else if (key === 'Enter' && !isFocusInInput()) { saveNewUser(); }
      return;
    }
    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) { focusIdx--; render(); }
        break;
      case 'ArrowDown':
        if (focusIdx < users.length) { focusIdx++; render(); }
        break;
      case 'Enter':
        if (focusIdx < users.length) switchToUser(users[focusIdx].id);
        else { mode = 'add'; render(); }
        break;
      case 'Backspace':
        App.showList();
        break;
    }
  }

  // ── onShow ─────────────────────────────────────────────────────────────────

  function onShow() {
    mode     = 'list';
    focusIdx = 0;
    load();
    render();
  }

  global.UserSwitcherScreen = { onShow: onShow, onKey: onKey };

}(window));
