// UI Phase flags — R1–R8 deliverables; legacy shell default
// Exposes: window.UIPhase
// See: system/dev_refs/UI-INTEGRATION-MAP.md, UI-ROADMAP-IO-PHILOSOPHY.md

(function(global) {
  'use strict';

  var PREFIX = 'wp_ui_phase_';

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
    in_out_frame: {
      label: 'R7: In/Out UI frame (codec unchanged)',
      legacy: 'PADS section layout only',
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
    return localStorage.getItem(PREFIX + key) === '1';
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
    // R1+: NavStack.restore(), share_pending tag hooks, etc.
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
