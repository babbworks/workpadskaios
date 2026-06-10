// glyph-card.js — Phase 6 read-only card + list glyphs (behind UIPhase flags)
// Spec: PRODUCT-SURFACE-LOCKED.md G-01, G-04; DISPLAY-LAYER-LOCKED.md
// Exposes: window.GlyphCard

(function(global) {
  'use strict';

  var REG = function() { return global.GlyphRegistry; };

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function rt(rec) {
    return REG() ? REG().rt(rec) : (rec.record_type || rec.recordType || '').toLowerCase();
  }

  function glyphChar(rec) {
    if (REG()) return REG().recordGlyph(rec);
    return '\u25aa';
  }

  function accentClass(rec) {
    if (REG()) return REG().recordAccentClass(rec);
    return 'wp-rt-generic';
  }

  function cardFrameOn() {
    return global.UIPhase && UIPhase.isOn('card_frame');
  }

  function listGlyphsOn() {
    return global.UIPhase && UIPhase.isOn('list_glyphs');
  }

  function chainSpineOn(rec) {
    if (!global.UIPhase || !UIPhase.isOn('chain_spine')) return false;
    return !!(rec && (rec.chainRef || rec._chainRef));
  }

  function chainGlyphsOn() {
    return listGlyphsOn() || (global.UIPhase && UIPhase.isOn('chain_spine'));
  }

  function listL0On() {
    return global.UIPhase && UIPhase.isOn('list_l0_strip');
  }

  function bilateralHtml(rec) {
    var t = rt(rec);
    if (t === 'need') {
      return '<div class="wp-io"><span class="wp-io-in">In</span>' +
        '<span class="wp-io-mid">\u2192</span><span class="wp-io-out">Out</span></div>';
    }
    if (t === 'offer') {
      return '<div class="wp-io"><span class="wp-io-out">Out</span>' +
        '<span class="wp-io-mid">\u2190</span><span class="wp-io-in">In</span></div>';
    }
    return '';
  }

  function chainStripHtml(rec) {
    if (!cardFrameOn() || !rec) return '';
    var ref = rec.chainRef || rec._chainRef;
    if (!ref) return '';
    var mode = REG() ? REG().inferChainMode(rec, {}) : 'INFORMATIONAL';
    var g = REG() ? REG().chainModeGlyph(mode) : '\u2192';
    return '<div class="zx"><span class="chain-g">' + esc(g) + '</span>' +
      esc(mode) + (ref ? ' \u00b7 ' + esc(String(ref).slice(0, 8)) : '') + '</div>';
  }

  function listPrefix(rec) {
    if (!listGlyphsOn()) return '';
    var g = glyphChar(rec);
    var open = rec._openObligation;
    var l0 = (listL0On() && open) ? '<span class="wp-l0-mark" title="Open obligation">\u25d0</span>' : '';
    return '<span class="wp-list-glyph' + (open ? ' wp-open' : '') + '" title="' + esc(REG() ? REG().recordLabel(rec) : rt(rec)) + '">' +
      esc(g) + l0 + '</span>';
  }

  function renderViewCard(rec) {
    if (!cardFrameOn() || !rec) return '';
    var accent = accentClass(rec);
    var typeLbl = REG() ? REG().recordLabel(rec) : rt(rec);
    var zones =
      '<div class="zh"><div class="rail rail-head">' +
        '<span class="t-title">' + esc(rec.job || '(untitled)') + '</span>' +
        '<span class="t-muted">' + esc(typeLbl) + '</span>' +
      '</div></div>' +
      '<div class="zb"><div class="rail">' + esc(rec.customer || rec.worker || rec.vendor || '\u2014') + '</div></div>' +
      '<div class="zb"><div class="rail">' + esc(rec.date || '') +
        (rec.amount ? ' \u00b7 ' + esc(rec.amount) + (rec.currency ? ' ' + esc(rec.currency) : '') : '') +
      '</div></div>';
    var detail = (rec.details || rec.story || '').trim();
    if (detail) {
      zones += '<div class="zb"><div class="rail" style="white-space:normal;">' + esc(detail.slice(0, 120)) + '</div></div>';
    }
    zones += chainStripHtml(rec);
    return '<div class="wp-card ' + esc(accent) + '">' +
      '<div class="wp-card-glyph"><span class="g-rec">' + esc(glyphChar(rec)) + '</span></div>' +
      '<div class="wp-card-body">' + zones + bilateralHtml(rec) + '</div>' +
      '</div>';
  }

  function renderSharePreview(rec) {
    if (!cardFrameOn() || !rec) return '';
    return '<div class="wp-share-preview"><div class="wp-share-lbl">Preview (Face 1)</div>' +
      renderViewCard(rec) + '</div>';
  }

  function spineMarginHtml(rec) {
    if (!chainSpineOn(rec)) return '';
    var ref = (rec.chainRef || rec._chainRef || '').slice(0, 6);
    return '<div class="wp-spine" title="Chain ' + esc(ref) + '"></div>';
  }

  function chainConnector(rec, idx, total, pending) {
    if (!chainGlyphsOn()) {
      if (idx === 0) return '\u25c9';
      if (rec.record_type === 'state_commit') return '\u25ce';
      return '\u2500';
    }
    if (REG()) return REG().chainConnector(rec, idx, total, pending);
    if (idx === 0) return '\u22b3';
    if (pending) return '\u21d2';
    return '\u2500';
  }

  function chainRowGlyph(rec) {
    if (!chainGlyphsOn()) return '';
    return glyphChar(rec);
  }

  global.GlyphCard = {
    glyphChar: glyphChar,
    listPrefix: listPrefix,
    renderViewCard: renderViewCard,
    renderSharePreview: renderSharePreview,
    spineMarginHtml: spineMarginHtml,
    chainConnector: chainConnector,
    chainRowGlyph: chainRowGlyph,
    cardFrameOn: cardFrameOn,
    listGlyphsOn: listGlyphsOn,
    chainGlyphsOn: chainGlyphsOn,
  };

}(window));
