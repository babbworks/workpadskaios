// Screen: Record view (read-only display of a saved record)
// Exposes: window.ViewScreen

(function(global) {
  'use strict';

  var el = {
    title:   document.getElementById('view-title'),
    content: document.getElementById('view-content'),
  };

  var currentRecord = null;
  var optionsOpen   = false;
  var optionsItems  = [];
  var optionsIdx    = 0;

  var LABELS = {
    job:            'Job',
    customer:       'Customer',
    date:           'Date',
    location:       'Location',
    customer_phone: 'Phone',
    start_time:     'Start',
    end_time:       'End',
    meeting_time:   'Meeting',
    worker:         'Worker',
    details:        'Details',
    story:          'Story',
  };

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function render(rec) {
    currentRecord = rec;
    el.title.textContent = rec.job || '(untitled)';

    var html = '';
    Object.keys(LABELS).forEach(function(id) {
      var val = rec[id];
      if (val) {
        html += '<div class="view-field">' +
          '<div class="view-field-label">' + LABELS[id] + '</div>' +
          '<div class="view-field-value">' + esc(val) + '</div>' +
          '</div>';
      }
    });

    if (Array.isArray(rec.actions) && rec.actions.length) {
      html += '<div class="view-field">' +
        '<div class="view-field-label">Actions (' + rec.actions.length + ')</div>' +
        rec.actions.map(function(a) {
          return '<div class="view-field-value" style="padding:2px 0;">· ' + esc(a.title) + '</div>';
        }).join('') +
        '</div>';
    }

    if (rec.receivedAt) {
      html += '<div class="view-field">' +
        '<div class="view-field-label">Source</div>' +
        '<div class="view-field-value" style="color:var(--text-muted);">Received via link</div>' +
        '</div>';
    }

    el.content.innerHTML = html || '<div class="empty-state">Empty record.</div>';
    WorkpadsPanel.setContext({ screen: 'view', record: rec });
  }

  // ── Options menu ──────────────────────────────────────────────────────

  function openOptions() {
    if (!currentRecord) return;
    optionsItems = [
      { label: 'Share',           action: function() { App.showShare(currentRecord); } },
      { label: 'Edit',            action: function() { App.showWizard(currentRecord); } },
      { label: 'Archive record',  action: doArchive },
    ];
    optionsIdx = 0;
    optionsOpen = true;
    renderOptions();
    document.getElementById('overlay-options').style.display = 'flex';
  }

  function closeOptions() {
    optionsOpen = false;
    document.getElementById('overlay-options').style.display = 'none';
  }

  function renderOptions() {
    var listEl = document.getElementById('options-content');
    listEl.innerHTML = optionsItems.map(function(item, i) {
      return '<div class="list-item' + (i === optionsIdx ? ' focused' : '') + '">' +
        '<div class="list-item-title">' + esc(item.label) + '</div>' +
        '</div>';
    }).join('');
  }

  function selectOption() {
    var item = optionsItems[optionsIdx];
    if (item) {
      closeOptions();
      item.action();
    }
  }

  function doArchive() {
    if (!currentRecord || !currentRecord.id) return;
    if (!confirm('Archive this record?\nYou can clear it from Manage > Records.')) return;
    RecordService.archive(currentRecord.id).then(function() {
      App.showList();
    });
  }

  // ── Public API ────────────────────────────────────────────────────────

  function onShow(rec) {
    closeOptions();
    render(rec);
  }

  function onKey(key) {
    if (optionsOpen) {
      switch (key) {
        case 'ArrowUp':
          if (optionsIdx > 0) { optionsIdx--; renderOptions(); }
          break;
        case 'ArrowDown':
          if (optionsIdx < optionsItems.length - 1) { optionsIdx++; renderOptions(); }
          break;
        case 'Enter':
          selectOption();
          break;
        case 'SoftLeft':
        case 'Backspace':
          closeOptions();
          break;
      }
      return;
    }
    switch (key) {
      case 'SoftLeft':
      case 'Backspace':
        App.showList();
        break;
      case 'Enter':
        App.showWizard(currentRecord);
        break;
      case 'SoftRight':
        openOptions();
        break;
    }
  }

  global.ViewScreen = {
    onShow:        onShow,
    onKey:         onKey,
    isOptionsOpen: function() { return optionsOpen; },
  };

}(window));
