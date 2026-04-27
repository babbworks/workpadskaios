// browser-dev.js — browser/simulator keyboard shim + softkey click support
// Loaded ONLY in development. Do not include in production KaiOS build.
//
// Key mappings for browser testing:
//   F1          → SoftLeft  (LSK)
//   F2  / Enter → SoftRight (RSK) — note: Enter is CSK on device, handled natively
//   F3          → SoftRight (RSK)
//   Backspace   → Back (same as device)
//   Arrow keys  → native (same as device)
//
// For KaiOS Simulator (Firefox-based):
//   F1 = LSK, F2 = CSK, F6 = RSK — adjust KEYMAP below if needed.

(function() {
  'use strict';

  var KEYMAP = {
    'F1': 'SoftLeft',
    'F3': 'SoftRight',
  };

  // Remap function keys to KaiOS soft key names
  document.addEventListener('keydown', function(e) {
    if (KEYMAP[e.key]) {
      var fakeEvent = new KeyboardEvent('keydown', {
        key:       KEYMAP[e.key],
        bubbles:   true,
        cancelable: true,
      });
      e.preventDefault();
      e.stopImmediatePropagation();
      document.dispatchEvent(fakeEvent);
    }
  }, true); // capture phase — fires before app.js handlers

  // Make softkey bar labels clickable
  function bindSoftkeyClicks() {
    document.querySelectorAll('.sk-lsk').forEach(function(el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'SoftLeft', bubbles: true }));
      });
    });
    document.querySelectorAll('.sk-rsk').forEach(function(el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'SoftRight', bubbles: true }));
      });
    });
    document.querySelectorAll('.sk-csk').forEach(function(el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function() {
        // Simulate short CSK press (keydown + keyup)
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        setTimeout(function() {
          document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        }, 50);
      });
    });
  }

  // Dev overlay — shows current screen name and key hints
  function createDevOverlay() {
    var bar = document.createElement('div');
    bar.id = 'dev-bar';
    bar.style.cssText = [
      'position:fixed', 'bottom:40px', 'left:0', 'width:240px',
      'background:rgba(0,0,0,0.7)', 'color:#4a9eff', 'font-size:9px',
      'padding:2px 6px', 'z-index:999', 'pointer-events:none',
      'font-family:monospace',
    ].join(';');
    bar.textContent = 'DEV  F1=LSK  Enter=CSK  F3=RSK  Arrows=nav';
    document.body.appendChild(bar);
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      bindSoftkeyClicks();
      createDevOverlay();
    });
  } else {
    bindSoftkeyClicks();
    createDevOverlay();
  }

  console.log('[workpads dev] browser shim active — F1=LSK, Enter=CSK, F3=RSK');
}());
