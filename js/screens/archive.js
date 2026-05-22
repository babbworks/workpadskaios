// Screen: Archive — browse, restore, and permanently delete archived records
// Exposes: window.ArchiveScreen

(function(global) {
  'use strict';

  var el = {
    content: document.getElementById('archive-content'),
    csk:     document.getElementById('archive-csk'),
  };

  var records    = [];
  var focusIdx   = 0;
  var delPending = null; // id of record awaiting delete confirm

  // ── Render ─────────────────────────────────────────────────────────────────

  function render() {
    if (!records.length) {
      el.content.innerHTML = global.EmptyState
        ? EmptyState.render('No archived records', {
            hint: 'Archive a record from its view screen.',
          })
        : '<div class="empty-state">No archived records.<br>' +
          '<span style="font-size:10px;color:var(--text-muted);">Archive a record from its view screen.</span></div>';
      if (el.csk) el.csk.textContent = '';
      return;
    }

    var html = '';
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var focused = (i === focusIdx) ? ' focused' : '';
      var when = r.archivedAt ? fmtDate(r.archivedAt) : '';
      html +=
        '<div class="list-item' + focused + '" data-arc-idx="' + i + '">' +
          '<div class="list-item-title">' + esc(r.job || '(no title)') + '</div>' +
          '<div class="list-item-sub">' +
            (r.customer ? esc(r.customer) + '  \u00b7  ' : '') +
            (when ? 'archived ' + esc(when) : '') +
          '</div>' +
        '</div>';
    }
    el.content.innerHTML = html;

    if (el.csk) el.csk.textContent = records.length ? 'Restore' : '';

    bindItemClicks();
    scrollToFocus();
  }

  function fmtDate(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  function scrollToFocus() {
    var focused = el.content.querySelector('.list-item.focused');
    if (focused && focused.scrollIntoView) focused.scrollIntoView({ block: 'nearest' });
  }

  function bindItemClicks() {
    var items = el.content.querySelectorAll('.list-item[data-arc-idx]');
    for (var i = 0; i < items.length; i++) {
      (function(item) {
        item.addEventListener('click', function() {
          var idx = parseInt(item.getAttribute('data-arc-idx'), 10);
          focusIdx = idx;
          render();
        });
        item.addEventListener('dblclick', function() {
          restore();
        });
      }(items[i]));
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  function restore() {
    if (!records.length) return;
    var rec = records[focusIdx];
    if (!rec) return;
    RecordService.restoreRecord(rec.id).then(function() {
      load();
    });
  }

  function deleteRecord() {
    if (!records.length) return;
    var rec = records[focusIdx];
    if (!rec) return;
    var label = esc(rec.job || 'this record');
    if (!global.confirm('Permanently delete "' + label + '"?\nThis cannot be undone.')) return;
    RecordService.removeRecord(rec.id).then(function() {
      if (focusIdx >= records.length - 1) focusIdx = Math.max(0, records.length - 2);
      load();
    });
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  function load() {
    RecordService.listArchived().then(function(list) {
      records  = list;
      focusIdx = Math.min(focusIdx, Math.max(0, list.length - 1));
      delPending = null;
      render();
    });
  }

  // ── Key handler ────────────────────────────────────────────────────────────

  function onKey(key) {
    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) { focusIdx--; render(); }
        break;
      case 'ArrowDown':
        if (focusIdx < records.length - 1) { focusIdx++; render(); }
        break;
      case 'Enter':
        restore();
        break;
      case 'SoftRight':
        deleteRecord();
        break;
      case 'Backspace':
        App.showManagement();
        break;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  function onShow() {
    focusIdx = 0;
    delPending = null;
    load();
  }

  // Softkey click bindings
  (function() {
    var panel = document.getElementById('screen-archive');
    if (!panel) return;
    var cskEl = panel.querySelector('.sk-csk');
    var rskEl = panel.querySelector('.sk-rsk');
    if (cskEl) cskEl.addEventListener('click', function() { restore(); });
    if (rskEl) rskEl.addEventListener('click', function() { deleteRecord(); });
  }());

  global.ArchiveScreen = {
    onShow: onShow,
    onKey:  onKey,
  };

}(window));
