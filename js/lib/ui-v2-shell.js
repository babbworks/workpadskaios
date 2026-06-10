// ui-v2-shell.js — structural HTML for Workpads v2 (glyph rail + zones)
// Active when UITheme.isV2(). Legacy screens use token bridge until list_v2/view_v2.
// Exposes: window.UIV2Shell

(function(global) {
  'use strict';

  function enabled() {
    return global.UITheme && UITheme.isV2();
  }

  function esc(s) {
    if (global.esc) return global.esc(s);
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  function glyphForRec(rec) {
    if (global.GlyphRegistry && GlyphRegistry.recordGlyph) {
      return GlyphRegistry.recordGlyph(rec);
    }
    return '\u25aa';
  }

  function headerZone(title, glyph, subtitle) {
    var g = glyph != null ? glyph : '';
    var sub = subtitle
      ? '<div class="rail"><div class="g"></div><div class="t t-muted">' + esc(subtitle) + '</div></div>'
      : '';
    return '<div class="zh wp-v2-zh">' +
      '<div class="rail"><div class="g g-rec">' + esc(g) + '</div>' +
      '<div class="t t-title">' + esc(title || '') + '</div></div>' +
      sub + '</div>';
  }

  function filterBar(glyph, label, count) {
    return '<div class="filter-bar wp-v2-filter">' +
      '<span class="fb-glyph">' + esc(glyph || '\u25a6') + '</span>' +
      '<span class="fb-label">' + esc(label || '') + '</span>' +
      (count != null ? '<span class="fb-count">' + esc(String(count)) + '</span>' : '') +
      '</div>';
  }

  function lrow(opts) {
    opts = opts || {};
    var cls = 'lrow';
    if (opts.focused) cls += ' col-selected';
    if (opts.priority) cls += ' lrow-priority lrow-warn';
    if (opts.unread) cls += ' lrow-unread';
    if (opts.muted) cls += ' lrow-muted';
    if (opts.statusRow) cls += ' ' + opts.statusRow;

    return '<div class="' + cls + '" tabindex="' + (opts.tabindex != null ? opts.tabindex : '0') + '"' +
      (opts.dataIdx != null ? ' data-idx="' + opts.dataIdx + '"' : '') +
      (opts.extraAttrs || '') + '>' +
      '<div class="lg" style="' + escAttr(opts.glyphStyle || '') + '">' + esc(opts.glyph || '') + '</div>' +
      '<div class="lb"><div class="lt">' + (opts.titleHtml || esc(opts.title || '')) + '</div>' +
      (opts.sub ? '<div class="ls">' + opts.sub + '</div>' : '') +
      '</div>' +
      '<div class="la">' + esc(opts.arrow || '\u203a') + '</div></div>';
  }

  function lrowFromRecord(rec, idx, opts) {
    opts = opts || {};
    if (!rec) return '';
    var title = rec.job || rec.name || '(untitled)';
    var subParts = [];
    if (rec.date) subParts.push(esc(rec.date));
    if (rec.amount) subParts.push('<strong>' + esc(rec.amount) + '</strong>');
    return lrow({
      glyph: glyphForRec(rec),
      title: title,
      sub: subParts.join(' &nbsp;\u00b7 '),
      dataIdx: idx,
      focused: opts.focused,
      priority: opts.priority,
      unread: opts.unread,
      muted: opts.muted,
      extraAttrs: opts.extraAttrs,
    });
  }

  function fieldRow(label, value, valueClass) {
    return '<div class="field wp-v2-field">' +
      '<div class="fl">' + esc(label) + '</div>' +
      '<div class="fv' + (valueClass ? ' ' + valueClass : '') + '">' + esc(value || '') + '</div></div>';
  }

  function softkeys(left, center, right) {
    return '<div class="softkey wp-v2-sk" data-wp-v2-softkey="1">' +
      '<div class="sk">' + esc(left || '') + '</div>' +
      '<div class="sk sk-center">' + esc(center || '') + '</div>' +
      '<div class="sk">' + esc(right || '') + '</div></div>';
  }

  function wrapContent(inner) {
    return '<div class="wp-v2-frame">' + (inner || '') + '</div>';
  }

  global.UIV2Shell = {
    enabled: enabled,
    headerZone: headerZone,
    filterBar: filterBar,
    lrow: lrow,
    lrowFromRecord: lrowFromRecord,
    fieldRow: fieldRow,
    softkeys: softkeys,
    wrapContent: wrapContent,
    esc: esc,
  };

}(typeof window !== 'undefined' ? window : global));
