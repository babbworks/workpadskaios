// PersonalPanel — ArrowRight overlay, Learning Engine surface
// Spec: workpads-standard/panel-access-model.md + personal-panel-design.md (ARC-007/016)
// Exposes: window.PersonalPanel

(function(global) {
  'use strict';

  var el = {
    panel:   document.getElementById('panel-personal'),
    content: document.getElementById('panel-personal-content'),
  };

  var isOpen       = false;
  var filterRecord = null;   // set from Workpads Panel bridge

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function open() {
    // Bridge: inherit record context from last Workpads Panel session
    var last = WorkpadsPanel.lastContext();
    filterRecord = (last && last.record && last.record.id) ? last.record.id : null;

    isOpen = true;
    el.panel.classList.add('open');
    render();
  }

  function close() {
    isOpen = false;
    el.panel.classList.remove('open');
  }

  function toggle() {
    if (isOpen) close(); else open();
  }

  function render() {
    PersonalService.list().then(function(captures) {
      var shown = filterRecord
        ? captures.filter(function(c) { return c.linkedRecordId === filterRecord; })
        : captures;

      if (!shown.length) {
        el.content.innerHTML =
          '<div class="panel-label" style="padding:8px;">' +
            (filterRecord ? 'No saves for this record.' : 'No saves yet. Press * to capture.') +
          '</div>';
        return;
      }

      el.content.innerHTML = shown.slice(0, 6).map(function(c) {
        var d = new Date(c.timestamp);
        var ts = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
                 ' ' + d.toTimeString().slice(0, 5);
        return '<div class="panel-section">' +
          '<div class="panel-label">' + esc(ts) +
            (c.linkedFieldId ? ' &middot; ' + esc(c.linkedFieldId) : '') +
          '</div>' +
          '<div class="panel-value">' + esc(c.text.slice(0, 60)) + '</div>' +
          (c.tags && c.tags.length
            ? '<div style="color:var(--text-muted);font-size:10px;margin-top:2px;">' +
              c.tags.map(function(t) { return '#' + esc(t); }).join(' ') + '</div>'
            : '') +
        '</div>';
      }).join('');
    });
  }

  global.PersonalPanel = {
    open: open,
    close: close,
    toggle: toggle,
    isOpen: function() { return isOpen; },
  };

}(window));
