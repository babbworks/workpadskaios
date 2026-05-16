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
//   NumpadEnter → Enter

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
    // a / d → SoftLeft / SoftRight (outside inputs only)
    if (SOFTKEY_MAP[e.key] && !isInInput()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      fire(SOFTKEY_MAP[e.key]);
      return;
    }

    // s → CSK Enter (outside inputs only)
    if (e.key === 's' && !isInInput()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      fireCSK();
      return;
    }

    // Numpad digits and * — remap by code so NumLock state doesn't matter
    if (NUMPAD_CODE_MAP[e.code]) {
      e.preventDefault();
      e.stopImmediatePropagation();
      fire(NUMPAD_CODE_MAP[e.code]);
      updateShortcutBar();
      return;
    }

    // NumpadEnter → Enter
    if (e.code === 'NumpadEnter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      fireCSK();
      return;
    }

    // Update shortcut bar on any non-input key
    setTimeout(updateShortcutBar, 50);
  }, true); // capture phase

  // ── Softkey bar click bindings ───────────────────────────────────────────
  // Skip softkeys inside .panel — panels install their own click handlers.

  function bindSoftkeyClicks() {
    document.querySelectorAll('.sk-lsk').forEach(function(el) {
      if (el.closest('.panel')) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() { fire('SoftLeft'); });
    });
    document.querySelectorAll('.sk-rsk').forEach(function(el) {
      if (el.closest('.panel')) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() { fire('SoftRight'); });
    });
    document.querySelectorAll('.sk-csk').forEach(function(el) {
      if (el.closest('.panel')) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() { fireCSK(); });
    });
  }

  // ── Dev overlay ──────────────────────────────────────────────────────────

  var devBar  = null;
  var shortBar = null;

  function createDevOverlay() {
    devBar = document.createElement('div');
    devBar.id = 'dev-bar';
    devBar.style.cssText = [
      'position:fixed', 'bottom:40px', 'left:0', 'width:240px',
      'background:rgba(0,0,0,0.75)', 'color:#4a9eff', 'font-size:9px',
      'padding:2px 6px', 'z-index:999', 'pointer-events:none',
      'font-family:monospace', 'line-height:1.5',
    ].join(';');
    devBar.textContent = 'DEV  a=LSK  s=CSK  d=RSK  Arrows=nav  Numpad=0-9/*';
    document.body.appendChild(devBar);

    shortBar = document.createElement('div');
    shortBar.id = 'dev-shortbar';
    shortBar.style.cssText = [
      'position:fixed', 'bottom:58px', 'left:0', 'width:240px',
      'background:rgba(0,0,0,0.65)', 'color:#aaa', 'font-size:9px',
      'padding:2px 6px', 'z-index:999', 'pointer-events:none',
      'font-family:monospace', 'line-height:1.5',
    ].join(';');
    document.body.appendChild(shortBar);

    updateShortcutBar();
  }

  function updateShortcutBar() {
    if (!shortBar || typeof App === 'undefined') return;
    var screen = App.getCurrentScreen ? App.getCurrentScreen() : '';
    var maps   = App.SHORTCUT_MAPS || {};
    var list   = maps[screen] || [];
    if (!list.length) {
      shortBar.textContent = screen ? '[' + screen + '] *=keys' : '*=keys';
      return;
    }
    var parts = list.map(function(s) { return s.key + '=' + s.label; });
    shortBar.textContent = '[' + screen + '] ' + parts.join('  ');
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      bindSoftkeyClicks();
      createDevOverlay();
    });
  } else {
    bindSoftkeyClicks();
    createDevOverlay();
  }

  console.log('[workpads dev] browser shim active — a=LSK, s=CSK, d=RSK, Numpad=0-9/*');
}());
