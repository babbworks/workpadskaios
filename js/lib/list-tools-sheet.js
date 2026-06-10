// ListToolsSheet — overflow list toolbar (when FilterSheet off)
// Exposes: window.ListToolsSheet

(function(global) {
  'use strict';

  function buildRows(ctx) {
    return [
      { kind: 'header', label: 'Sort & filter' },
      { kind: 'action', key: 'sort', label: 'Sort\u2026' },
      { kind: 'action', key: 'type', label: 'Type\u2026' },
      { kind: 'action', key: 'act', label: 'Activity\u2026' },
      { kind: 'header', label: 'List' },
      { kind: 'toggle', key: 'focus', label: 'Focus mode', selected: ctx.focusMode },
      { kind: 'toggle', key: 'group', label: 'Group by type', selected: ctx.listGroupOn },
      { kind: 'toggle', key: 'pending', label: 'Share pending only', selected: ctx.sharePendingFilter },
      { kind: 'toggle', key: 'rhythmNet', label: 'Rhythm network only', selected: ctx.rhythmNetFilter },
      { kind: 'toggle', key: 'saleRollup', label: 'Group sales by item', selected: ctx.saleRollupOn },
      { kind: 'action', key: 'density', label: 'Density: ' + (ctx.densityLabel || 'Normal') },
      { kind: 'header', label: 'Go' },
      { kind: 'action', key: 'connections', label: 'Connections' },
    ];
  }

  function renderHtml(rows, focusIdx) {
    if (global.FilterSheet) return FilterSheet.renderHtml(rows, focusIdx);
    var html = '';
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      if (row.kind === 'header') {
        html += '<div class="fs-section">' + esc(row.label) + '</div>';
        continue;
      }
      var foc = focusIdx === ri;
      html += '<div class="fs-row' + (foc ? ' focused' : '') + (row.selected ? ' fs-selected' : '') +
        '" data-fs-idx="' + ri + '"><span class="fs-check">' + (row.selected ? '\u2714' : '') +
        '</span><span class="fs-label">' + esc(row.label) + '</span></div>';
    }
    return html;
  }

  global.ListToolsSheet = {
    buildRows: buildRows,
    renderHtml: renderHtml,
  };

}(window));
