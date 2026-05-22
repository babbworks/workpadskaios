// EmptyState — unified empty / loading blocks (R1)
// Exposes: window.EmptyState

(function(global) {
  'use strict';

  function render(message, opts) {
    opts = opts || {};
    var hint = opts.hint || '';
    var action = opts.action || '';
    var extraClass = opts.className ? ' ' + opts.className : '';
    var html = '<div class="empty-state' + extraClass + '">';
    html += esc(message || 'Nothing here yet.');
    if (hint) {
      html += '<div class="empty-state-hint">' + esc(hint) + '</div>';
    }
    if (action) {
      html += '<div class="empty-state-action">' + esc(action) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function loading(msg) {
    return render(msg || 'Loading\u2026', { className: 'empty-state-loading' });
  }

  global.EmptyState = {
    render: render,
    loading: loading,
  };

}(window));
