// browser-dev.js — browser/simulator keyboard shim + softkey click support
// Loaded ONLY in development. Do not include in production KaiOS build.
//
// Key mappings for browser testing:
//   a           → SoftLeft  (LSK)  — only outside input fields
//   s           → CSK/Enter        — only outside input fields
//   d           → SoftRight (RSK)  — only outside input fields
//   Backspace   → Back (same as device)
//   Arrow keys  → native (same as device)
//   Numpad 0-9  → '0'-'9' (explicit, works regardless of NumLock state)
//   Numpad *    → '*'

(function() {
  'use strict';

  var SOFTKEY_MAP = {
    'a': 'SoftLeft',
    'd': 'SoftRight',
  };

  var NUMPAD_CODE_MAP = {
    'Numpad0': '0', 'Numpad1': '1', 'Numpad2': '2', 'Numpad3': '3',
    'Numpad4': '4', 'Numpad5': '5', 'Numpad6': '6', 'Numpad7': '7',
    'Numpad8': '8', 'Numpad9': '9', 'NumpadMultiply': '*',
  };

  var sidebarEl = null;
  var shortcutsListEl = null;
  var screenLabelEl = null;

  function isInInput() {
    var el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  function fire(key) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true }));
  }

  function fireCSK() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    setTimeout(function() {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true }));
    }, 50);
  }

  document.addEventListener('keydown', function(e) {
    if (SOFTKEY_MAP[e.key] && !isInInput()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      fire(SOFTKEY_MAP[e.key]);
      return;
    }

    if (e.key === 's' && !isInInput()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      fireCSK();
      return;
    }

    if (NUMPAD_CODE_MAP[e.code]) {
      e.preventDefault();
      e.stopImmediatePropagation();
      fire(NUMPAD_CODE_MAP[e.code]);
      updateShortcutBar();
      return;
    }

    if (e.code === 'NumpadEnter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      fireCSK();
      return;
    }

    setTimeout(updateShortcutBar, 50);
  }, true);

  function bindSoftkeyClicks() {
    document.querySelectorAll('.sk-lsk').forEach(function(el) {
      if (el.closest('.panel')) return;
      if (el.closest('#overlay-options, #overlay-commit, #overlay-progression')) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() { fire('SoftLeft'); });
    });
    document.querySelectorAll('.sk-rsk').forEach(function(el) {
      if (el.closest('.panel')) return;
      if (el.closest('#overlay-options, #overlay-commit, #overlay-progression')) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() { fire('SoftRight'); });
    });
    document.querySelectorAll('.sk-csk').forEach(function(el) {
      if (el.closest('.panel')) return;
      if (el.closest('#overlay-options, #overlay-commit, #overlay-progression')) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() { fireCSK(); });
    });
    /* Overlay softkeys sit above the active screen — bind once per overlay bar */
    ['overlay-options', 'overlay-commit', 'overlay-progression'].forEach(function(id) {
      var ov = document.getElementById(id);
      if (!ov) return;
      var lsk = ov.querySelector('.sk-lsk');
      var csk = ov.querySelector('.sk-csk');
      if (lsk) {
        lsk.style.cursor = 'pointer';
        lsk.addEventListener('click', function(ev) {
          ev.stopPropagation();
          fire('SoftLeft');
        });
      }
      if (csk) {
        csk.style.cursor = 'pointer';
        csk.addEventListener('click', function(ev) {
          ev.stopPropagation();
          fireCSK();
        });
      }
    });
  }

  /** Wrap app DOM in #wp-device-shell; shortcuts live in #wp-dev-sidebar beside it. */
  function ensureDevLayout() {
    if (document.getElementById('wp-dev-host')) {
      sidebarEl = document.getElementById('wp-dev-sidebar');
      shortcutsListEl = document.getElementById('wp-dev-shortcuts');
      screenLabelEl = document.getElementById('wp-dev-screen-label');
      return;
    }

    document.documentElement.classList.add('wp-dev-layout');

    var host = document.createElement('div');
    host.id = 'wp-dev-host';

    var shell = document.createElement('div');
    shell.id = 'wp-device-shell';

    var body = document.body;
    while (body.firstChild) {
      shell.appendChild(body.firstChild);
    }

    sidebarEl = document.createElement('aside');
    sidebarEl.id = 'wp-dev-sidebar';
    sidebarEl.setAttribute('aria-label', 'Developer shortcuts');
    sidebarEl.innerHTML =
      '<h2>Browser dev</h2>' +
      '<p class="wp-dev-keys">a = LSK &nbsp; s = CSK &nbsp; d = RSK<br>' +
      'Arrows = nav &nbsp; Backspace = back<br>' +
      'Numpad 0–9 and * = shortcuts</p>' +
      '<h3 id="wp-dev-screen-label">Screen</h3>' +
      '<ul id="wp-dev-shortcuts"></ul>' +
      '<h3>Theme</h3>' +
      '<p style="font-size:10px;color:#888;margin:0 0 6px;">Manage → Settings tab → Theme (master). Or:</p>' +
      '<p class="wp-dev-keys" style="margin:0;">UITheme.set(\'v2\') / UITheme.set(\'legacy\')</p>';

    shortcutsListEl = sidebarEl.querySelector('#wp-dev-shortcuts');
    screenLabelEl = sidebarEl.querySelector('#wp-dev-screen-label');

    body.appendChild(host);
    host.appendChild(shell);
    host.appendChild(sidebarEl);

    var legacyBar = document.getElementById('dev-bar');
    var legacyShort = document.getElementById('dev-shortbar');
    if (legacyBar) legacyBar.remove();
    if (legacyShort) legacyShort.remove();
  }

  function updateShortcutBar() {
    if (!shortcutsListEl) return;
    var screen = (typeof App !== 'undefined' && App.getCurrentScreen) ? App.getCurrentScreen() : '';
    var maps   = (typeof App !== 'undefined' && App.SHORTCUT_MAPS) ? App.SHORTCUT_MAPS : {};
    var list   = maps[screen] || [];

    if (screenLabelEl) {
      screenLabelEl.textContent = screen ? 'Screen: ' + screen : 'Screen: (booting)';
    }

    if (!list.length) {
      shortcutsListEl.innerHTML =
        '<li><span class="wp-dev-k">*</span> shortcut map (this screen)</li>';
      return;
    }

    shortcutsListEl.innerHTML = list.map(function(s) {
      return '<li><span class="wp-dev-k">' + esc(s.key) + '</span> ' + esc(s.label) + '</li>';
    }).join('');
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Desktop shell (workpadskaios-desktop) loads the app in an iframe with ?embed=1 */
  function isDesktopEmbed() {
    return /(?:\?|&)embed=1(?:&|$)/.test(location.search);
  }

  function init() {
    if (!isDesktopEmbed()) ensureDevLayout();
    bindSoftkeyClicks();
    updateShortcutBar();
    setInterval(updateShortcutBar, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log(isDesktopEmbed()
    ? '[workpads dev] embed mode — desktop shell owns sidebar'
    : '[workpads dev] browser shim — shortcuts in #wp-dev-sidebar beside device');
}());
