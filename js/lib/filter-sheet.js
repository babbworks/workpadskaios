// FilterSheet — unified list filters (R2 / R7)
// Used by ListScreen when filter_sheet is on (default).
// Exposes: window.FilterSheet

(function(global) {
  'use strict';

  var DEFAULT_ON = { filter_sheet: true };

  function enabled() {
    if (!global.UIPhase) return true;
    var v = localStorage.getItem('wp_ui_phase_filter_sheet');
    if (v === null) return DEFAULT_ON.filter_sheet;
    return v === '1';
  }

  /**
   * Build flat row list for sheet UI.
   * ctx = { sortMode, SORT_MODES, SORT_LABELS, typeFilter, TYPE_PICKER_LABELS,
   *         TEMPLATE_TYPES, activityFilter, WorkActivityService, focusMode,
   *         sharePendingFilter, listGroupOn }
   */
  function buildRows(ctx) {
    var rows = [];
    var i, m, t, acts, act, name;

    rows.push({ kind: 'header', label: 'Sort' });
    for (i = 0; i < ctx.SORT_MODES.length; i++) {
      m = ctx.SORT_MODES[i];
      rows.push({
        kind: 'sort',
        value: m,
        label: ctx.SORT_LABELS[m] || m,
        selected: ctx.sortMode === m,
      });
    }

    rows.push({ kind: 'header', label: 'Type' });
    rows.push({
      kind: 'type',
      value: null,
      label: 'All types',
      selected: ctx.typeFilter === null,
    });
    ctx.TEMPLATE_TYPES.forEach(function(tp) {
      if (tp.value === '__outcome__' || tp.value === 'sale') return;
      rows.push({
        kind: 'type',
        value: tp.value,
        label: tp.label,
        selected: ctx.typeFilter === tp.value,
      });
    });

    rows.push({ kind: 'header', label: 'Activity' });
    rows.push({
      kind: 'act',
      value: '__clear__',
      label: 'All activities',
      selected: !ctx.activityFilter.length,
    });
    acts = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];
    for (i = 0; i < acts.length; i++) {
      act = acts[i];
      name = act.name || act.id;
      rows.push({
        kind: 'act',
        value: act.id,
        label: name,
        selected: ctx.activityFilter.indexOf(act.id) !== -1,
      });
    }

    rows.push({ kind: 'header', label: 'Options' });
    rows.push({
      kind: 'toggle',
      key: 'focus',
      label: 'Focus mode',
      selected: ctx.focusMode,
    });
    rows.push({
      kind: 'toggle',
      key: 'pending',
      label: 'Share pending only',
      selected: ctx.sharePendingFilter,
    });
    rows.push({
      kind: 'toggle',
      key: 'obligations',
      label: 'Open obligations',
      selected: ctx.obligationsFilter,
    });
    rows.push({
      kind: 'toggle',
      key: 'rhythmNet',
      label: 'Rhythm network only',
      selected: ctx.rhythmNetFilter,
    });
    rows.push({
      kind: 'toggle',
      key: 'group',
      label: 'Group by type',
      selected: ctx.listGroupOn,
    });
    rows.push({
      kind: 'toggle',
      key: 'saleRollup',
      label: 'Group sales by item',
      selected: ctx.saleRollupOn !== false,
    });
    rows.push({ kind: 'header', label: 'More' });
    rows.push({ kind: 'action', key: 'density', label: 'Density: ' + (ctx.densityLabel || 'Normal') });
    rows.push({ kind: 'action', key: 'connections', label: 'Connections' });

    return rows;
  }

  function renderHtml(rows, focusIdx) {
    var html = '';
    var ri, row, foc;
    for (ri = 0; ri < rows.length; ri++) {
      row = rows[ri];
      if (row.kind === 'header') {
        html += '<div class="fs-section">' + esc(row.label) + '</div>';
        continue;
      }
      foc = focusIdx === ri;
      html += '<div class="fs-row' + (foc ? ' focused' : '') + (row.selected ? ' fs-selected' : '') + '" data-fs-idx="' + ri + '">' +
        '<span class="fs-check">' + (row.selected ? '\u2714' : '') + '</span>' +
        '<span class="fs-label">' + esc(row.label) + '</span>' +
      '</div>';
    }
    return html;
  }

  function applyRow(row, state, multiAct) {
    if (row.kind === 'sort') {
      state.sortMode = row.value;
      return;
    }
    if (row.kind === 'type') {
      state.typeFilter = row.value;
      return;
    }
    if (row.kind === 'act') {
      if (row.value === '__clear__') {
        state.activityFilter = [];
      } else if (multiAct) {
        var idx = state.activityFilter.indexOf(row.value);
        if (idx === -1) state.activityFilter.push(row.value);
        else state.activityFilter.splice(idx, 1);
      } else {
        state.activityFilter = [row.value];
      }
      return;
    }
    if (row.kind === 'toggle') {
      if (row.key === 'focus') state.focusMode = !state.focusMode;
      if (row.key === 'pending') state.sharePendingFilter = !state.sharePendingFilter;
      if (row.key === 'obligations') state.obligationsFilter = !state.obligationsFilter;
      if (row.key === 'rhythmNet') state.rhythmNetFilter = !state.rhythmNetFilter;
      if (row.key === 'group') state.listGroupOn = !state.listGroupOn;
      if (row.key === 'saleRollup' && global.SaleRollup) {
        SaleRollup.setEnabled(!SaleRollup.enabled());
        state.saleRollupOn = SaleRollup.enabled();
      }
    }
  }

  global.FilterSheet = {
    enabled: enabled,
    buildRows: buildRows,
    renderHtml: renderHtml,
    applyRow: applyRow,
  };

}(window));
