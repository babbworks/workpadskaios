// CaptureLens — Words / Numbers capture lenses in wizard (R7.5)
// Exposes: window.CaptureLens

(function(global) {
  'use strict';

  var LENS_WORDS = 'words';
  var LENS_NUMBERS = 'numbers';
  var STORAGE_KEY = 'wp_capture_lens';

  var NUM_FIELD_IDS = {
    date: 1, date_end: 1, due_date: 1, amount: 1, qty: 1, rate: 1, vat: 1,
    start_time: 1, end_time: 1, meeting_time: 1, qty_unit: 1,
    'fin-amount': 1, 'fin-qty': 1, 'fin-rate': 1, 'fin-vat': 1, 'fin-due_date': 1,
    'fin-custom_tax_rate': 1, 'fin-worker_amount': 1,
  };

  var DEFAULT_ON = { capture_lens: true };

  function enabled() {
    if (!global.UIPhase) return !!DEFAULT_ON.capture_lens;
    var v = localStorage.getItem('wp_ui_phase_capture_lens');
    if (v === null) return !!DEFAULT_ON.capture_lens;
    return v === '1';
  }

  function get() {
    var v = localStorage.getItem(STORAGE_KEY);
    return v === LENS_NUMBERS ? LENS_NUMBERS : LENS_WORDS;
  }

  function set(lens) {
    localStorage.setItem(STORAGE_KEY, lens === LENS_NUMBERS ? LENS_NUMBERS : LENS_WORDS);
  }

  function toggle() {
    set(get() === LENS_WORDS ? LENS_NUMBERS : LENS_WORDS);
    return get();
  }

  function fieldLens(fieldId) {
    if (!fieldId) return LENS_WORDS;
    if (NUM_FIELD_IDS[fieldId] || String(fieldId).indexOf('fin-') === 0) return LENS_NUMBERS;
    return LENS_WORDS;
  }

  function barHtml(active) {
    active = active || get();
    return '<div class="capture-lens-bar" data-lens-bar="1">' +
      '<span class="capture-lens-btn' + (active === LENS_WORDS ? ' active' : '') + '" data-lens-pick="words">Words</span>' +
      '<span class="capture-lens-btn' + (active === LENS_NUMBERS ? ' active' : '') + '" data-lens-pick="numbers">Numbers</span>' +
      '</div>';
  }

  function wireBar(barEl, onChange) {
    if (!barEl) return;
    var picks = barEl.querySelectorAll('[data-lens-pick]');
    for (var i = 0; i < picks.length; i++) {
      picks[i].onclick = (function(lens) {
        return function() {
          set(lens);
          if (onChange) onChange(get());
        };
      })(picks[i].getAttribute('data-lens-pick'));
    }
  }

  function applyVisibility(root, lens) {
    if (!enabled() || !root) return;
    lens = lens || get();
    var nodes = root.querySelectorAll('[data-lens]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var t = n.getAttribute('data-lens');
      var show = t === lens || t === 'both';
      n.style.display = show ? '' : 'none';
    }
    var regions = root.querySelectorAll('[data-lens-region]');
    for (var r = 0; r < regions.length; r++) {
      var reg = regions[r].getAttribute('data-lens-region');
      regions[r].style.display = (reg === lens || reg === 'both') ? '' : 'none';
    }
    var hint = root.querySelector('.capture-lens-screen-hint');
    if (hint) hint.style.display = '';
  }

  function screenHint(lens, screenKind) {
    if (!enabled()) return '';
    if (screenKind === 'financial' && lens === LENS_WORDS) {
      return '<div class="capture-lens-screen-hint">Switch to <b>Numbers</b> for amounts and tax.</div>';
    }
    if (screenKind === 'process' && lens === LENS_NUMBERS) {
      return '<div class="capture-lens-screen-hint">Switch to <b>Words</b> for outcome and customer.</div>';
    }
    if (screenKind === 'story' && lens === LENS_NUMBERS) {
      return '<div class="capture-lens-screen-hint" style="display:none;"></div>';
    }
    return '';
  }

  global.CaptureLens = {
    LENS_WORDS: LENS_WORDS,
    LENS_NUMBERS: LENS_NUMBERS,
    enabled: enabled,
    get: get,
    set: set,
    toggle: toggle,
    fieldLens: fieldLens,
    barHtml: barHtml,
    wireBar: wireBar,
    applyVisibility: applyVisibility,
    screenHint: screenHint,
  };

}(window));
