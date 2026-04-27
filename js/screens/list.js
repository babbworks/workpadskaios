// Screen: Main record list
// Exposes: window.ListScreen

(function(global) {
  'use strict';

  var el = {
    content: document.getElementById('list-content'),
    count:   document.getElementById('list-count'),
  };

  var items = [];
  var focusIdx = 0;

  function fmt(rec) {
    var sub = [];
    if (rec.date)     sub.push(rec.date.slice(5));        // MM-DD
    if (rec.customer) sub.push(rec.customer.slice(0, 20));
    if (rec.receivedAt) sub.push('Received');
    return sub.join(' · ');
  }

  function render() {
    RecordService.list().then(function(records) {
      items = records;
      el.count.textContent = records.length ? records.length + '' : '';

      if (!records.length) {
        el.content.innerHTML =
          '<div class="empty-state">No records yet.<br>Press RSK to create one.</div>';
        return;
      }

      el.content.innerHTML = records.map(function(r, i) {
        return '<div class="list-item" tabindex="0" data-idx="' + i + '">' +
          '<div class="list-item-title">' + esc(r.job || '(untitled)') + '</div>' +
          (fmt(r) ? '<div class="list-item-sub">' + esc(fmt(r)) + '</div>' : '') +
          '</div>';
      }).join('');

      focusItem(Math.min(focusIdx, records.length - 1));
    });
  }

  function focusItem(idx) {
    var nodes = el.content.querySelectorAll('.list-item');
    nodes.forEach(function(n) { n.classList.remove('focused'); });
    if (idx >= 0 && idx < nodes.length) {
      focusIdx = idx;
      nodes[idx].classList.add('focused');
      nodes[idx].scrollIntoView({ block: 'nearest' });
      WorkpadsPanel.setContext({ screen: 'list', record: items[idx] || null });
    }
  }

  function focusedRecord() {
    return items[focusIdx] || null;
  }

  function onKey(key) {
    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) focusItem(focusIdx - 1);
        break;
      case 'ArrowDown':
        if (focusIdx < items.length - 1) focusItem(focusIdx + 1);
        break;
      case 'Enter':       // CSK — open focused record
        var rec = focusedRecord();
        if (rec) App.showView(rec);
        break;
      case 'SoftRight':   // RSK — new record
        App.showWizard(null);
        break;
      case 'SoftLeft':    // LSK — management screen
        App.showManagement();
        break;
    }
  }

  function onShow() {
    render();
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  global.ListScreen = { onShow: onShow, onKey: onKey, focusedRecord: focusedRecord, render: render };

}(window));
