// WorkpadsPanel — ArrowLeft overlay, Exchange Engine context layer
// Spec: workpads-standard/panel-access-model.md (ARC-016)
// Exposes: window.WorkpadsPanel

(function(global) {
  'use strict';

  var el = {
    panel:   document.getElementById('panel-workpads'),
    content: document.getElementById('panel-workpads-content'),
  };

  var isOpen  = false;
  var context = {};           // { screen, record, wizardScreen, url }
  var lastContext = null;     // exposed for Personal Panel bridge

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function setContext(ctx) {
    context = ctx || {};
    if (isOpen) render();
  }

  function open() {
    lastContext = context;
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

  // ── Content rendering ──────────────────────────────────────────────────

  function render() {
    var screen = context.screen;
    var rec    = context.record;

    if (screen === 'list') {
      if (rec) renderRecordPreview(rec);
      else     renderAggregate();
    } else if (screen === 'view') {
      renderRecordPreview(rec);
    } else if (screen === 'wizard') {
      renderWizardContext();
    } else if (screen === 'share') {
      renderShareContext();
    } else {
      el.content.innerHTML = '<div class="panel-label">No context.</div>';
    }
  }

  function renderAggregate() {
    RecordService.list().then(function(records) {
      var sentCount = records.filter(function(r) { return !r.receivedAt; }).length;
      var recvCount = records.filter(function(r) { return !!r.receivedAt; }).length;
      var recent = records.slice(0, 3);

      el.content.innerHTML =
        '<div class="panel-section">' +
          '<div class="panel-label">This session</div>' +
          '<div class="panel-value">' +
            sentCount + ' sent · ' + recvCount + ' received' +
          '</div>' +
        '</div>' +
        (recent.length ? '<div class="panel-section">' +
          '<div class="panel-label">Recent</div>' +
          recent.map(function(r) {
            return '<div class="panel-value" style="padding:2px 0;">' +
              esc((r.date || '').slice(5)) + ' · ' + esc((r.job || '').slice(0, 18)) +
              '</div>';
          }).join('') +
        '</div>' : '');
    });
  }

  function renderRecordPreview(rec) {
    if (!rec) { el.content.innerHTML = '<div class="panel-label">No record.</div>'; return; }
    var role = rec.receivedAt ? '14 Received' : '24 Sent';
    el.content.innerHTML =
      '<div class="panel-section">' +
        '<div class="panel-value" style="font-weight:bold;">' + esc((rec.job || '').slice(0, 22)) + '</div>' +
        '<div class="panel-value">' + esc(rec.date || '') + (rec.customer ? ' · ' + esc(rec.customer.slice(0,14)) : '') + '</div>' +
        '<div class="panel-value" style="color:var(--text-muted);">' + role + '</div>' +
      '</div>' +
      '<div class="panel-section">' +
        '<div class="panel-label">Shares</div>' +
        '<div class="panel-value" style="color:var(--text-muted);">No shares recorded</div>' +
      '</div>';
  }

  function renderWizardContext() {
    var rec = context.record;
    var ws  = context.wizardScreen || 0;

    if (ws === 0 && rec && rec.customer) {
      // Customer context
      RecordService.list().then(function(records) {
        var past = records.filter(function(r) {
          return r.id !== rec.id && r.customer && r.customer === rec.customer;
        }).slice(0, 2);

        el.content.innerHTML =
          '<div class="panel-section">' +
            '<div class="panel-label">Customer</div>' +
            '<div class="panel-value">' + esc(rec.customer) + '</div>' +
          '</div>' +
          (past.length ? '<div class="panel-section">' +
            '<div class="panel-label">Past jobs</div>' +
            past.map(function(r) {
              return '<div class="panel-value" style="padding:2px 0;">' +
                esc((r.date || '').slice(5)) + ' · ' + esc((r.job || '').slice(0,16)) +
                '</div>';
            }).join('') +
          '</div>' : '');
      });
    } else {
      // Field guidance
      var required = ['Job'];
      el.content.innerHTML =
        '<div class="panel-section">' +
          '<div class="panel-label">Required fields</div>' +
          '<div class="panel-value">' + required.join(', ') + '</div>' +
        '</div>';
    }
  }

  function renderShareContext() {
    var rec = context.record;
    el.content.innerHTML =
      '<div class="panel-section">' +
        '<div class="panel-label">Sending</div>' +
        '<div class="panel-value">' + esc((rec && rec.job) || '') + '</div>' +
      '</div>' +
      '<div class="panel-section">' +
        '<div class="panel-label">Prior shares</div>' +
        '<div class="panel-value" style="color:var(--text-muted);">None</div>' +
      '</div>';
  }

  global.WorkpadsPanel = {
    open: open,
    close: close,
    toggle: toggle,
    setContext: setContext,
    isOpen: function() { return isOpen; },
    lastContext: function() { return lastContext; },
  };

}(window));
