// UI Phase flags — R1–R8 deliverables; legacy shell default
// Exposes: window.UIPhase
// See: system/dev_refs/UI-INTEGRATION-MAP.md, UI-ROADMAP-IO-PHILOSOPHY.md

(function(global) {
  'use strict';

  var PREFIX = 'wp_ui_phase_';

  // R1/R2 default on when unset (disable via UIPhase.disable)
  var DEFAULT_ON = {
    nav_stack: true,
    filter_sheet: true,
    work_surface: true,
    lifecycle_strip: true,
    money_four: true,
    sale_screen_lock: true,
    progressive_form: true,
    capture_lens: true,
  };

  var FLAGS = {
    nav_stack: {
      label: 'R1: Unified navigation stack',
      legacy: 'Per-screen back + saveNavState',
    },
    work_surface: {
      label: 'R2: Unified list + panel + sale catalogue',
      legacy: 'activityFilter vs browseActivities',
    },
    filter_sheet: {
      label: 'R7: Combined FilterSheet picker',
      legacy: 'Separate sort / activity / type pickers',
    },
    io_create: {
      label: 'R3: Outcome-only create + draft/share',
      legacy: 'Type picker → wizard',
    },
    sale_tally: {
      label: 'R3–R6: Sale calculator + catalogue',
      legacy: 'No dedicated sale surface',
    },
    lifecycle_strip: {
      label: 'R3: Lifecycle strip + chain docs on view',
      legacy: 'Progression badge only',
    },
    money_four: {
      label: 'R4: Four money beats on panel summary',
      legacy: 'Full finance summary list only',
    },
    progressive_form: {
      label: 'R7: Progressive form (outcome-first wizard)',
      legacy: 'All PADS tabs visible from start',
    },
    in_out_frame: {
      label: 'R7: In/Out UI frame (codec unchanged)',
      legacy: 'PADS P/A/D/S/F section layout',
    },
    capture_lens: {
      label: 'R7: Words / Numbers capture lenses in wizard',
      legacy: 'All fields visible at once',
    },
    sale_screen_lock: {
      label: 'R5: Market screen lock for sale mode',
      legacy: 'No screen lock',
    },
    relations_home: {
      label: 'Focused round: needs/offers home',
      legacy: 'WP+ home + record list',
    },
  };

  function isOn(key) {
    var v = localStorage.getItem(PREFIX + key);
    if (v === null) return !!DEFAULT_ON[key];
    return v === '1';
  }

  function enable(key) {
    if (!FLAGS[key]) return false;
    localStorage.setItem(PREFIX + key, '1');
    return true;
  }

  function disable(key) {
    localStorage.removeItem(PREFIX + key);
  }

  function list() {
    var out = [];
    var keys = Object.keys(FLAGS);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      out.push({
        key: k,
        on: isOn(k),
        label: FLAGS[k].label,
        legacy: FLAGS[k].legacy,
      });
    }
    return out;
  }

  function onBoot() {
    if (global.NavStack && NavStack.initCrumbBar) NavStack.initCrumbBar();
  }

  global.UIPhase = {
    FLAGS: FLAGS,
    isOn: isOn,
    enable: enable,
    disable: disable,
    list: list,
    onBoot: onBoot,
  };

}(window));
