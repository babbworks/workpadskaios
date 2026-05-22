// InOutFrame — alternate wizard tabs (Outcome / Inputs / Outputs / Notes) (R7)
// Codec unchanged; maps to existing PADS wizard screens.
// Exposes: window.InOutFrame

(function(global) {
  'use strict';

  var SCREENS_WITH_FIN = [
    { name: 'Outcome', tab: 'O' },
    { name: 'Inputs',  tab: 'I' },
    { name: 'Outputs', tab: '>' },
    { name: 'Notes',   tab: 'N' },
  ];

  var SCREENS_NO_FIN = [
    { name: 'Outcome', tab: 'O' },
    { name: 'Inputs',  tab: 'I' },
    { name: 'Notes',   tab: 'N' },
  ];

  function enabled() {
    if (!global.UIPhase) return false;
    return UIPhase.isOn('in_out_frame');
  }

  function hasFinancial(rec) {
    if (!rec) return true;
    var c = String((rec.record_class || rec.recordClass || '') || '').toLowerCase();
    var t = String((rec.record_type || '') || '').toLowerCase();
    if (c === 'pads' || t === 'contact') return false;
    return true;
  }

  function screensFor(rec) {
    return hasFinancial(rec) ? SCREENS_WITH_FIN.slice() : SCREENS_NO_FIN.slice();
  }

  /** Wizard currentScreen index → render kind */
  function renderKind(screenIdx, rec) {
    var fin = hasFinancial(rec);
    if (screenIdx === 0) return 'outcome';
    if (screenIdx === 1) return 'inputs';
    if (fin && screenIdx === 2) return 'outputs';
    return 'notes';
  }

  function outputsScreenIndex(rec) {
    return hasFinancial(rec) ? 2 : -1;
  }

  function notesScreenIndex(rec) {
    return hasFinancial(rec) ? 3 : 2;
  }

  function frameHeader(title, sub) {
    return '<div class="io-frame-hdr">' + esc(title) +
      (sub ? '<div class="io-frame-sub">' + esc(sub) + '</div>' : '') +
      '</div>';
  }

  global.InOutFrame = {
    enabled: enabled,
    hasFinancial: hasFinancial,
    screensFor: screensFor,
    renderKind: renderKind,
    outputsScreenIndex: outputsScreenIndex,
    notesScreenIndex: notesScreenIndex,
    frameHeader: frameHeader,
  };

}(window));
