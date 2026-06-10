// script-loader.js — lazy-load optional scripts (e.g. qr.js on first share)
// Exposes: window.WPScriptLoader

(function(global) {
  'use strict';

  var _pending = {};

  function load(src) {
    if (_pending[src]) return _pending[src];
    _pending[src] = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function() { resolve(); };
      s.onerror = function() { reject(new Error('WPScriptLoader: failed to load ' + src)); };
      (document.head || document.documentElement).appendChild(s);
    });
    return _pending[src];
  }

  function ensureQr(callback) {
    if (typeof global.MiniQR !== 'undefined') {
      if (callback) callback();
      return Promise.resolve();
    }
    return load('js/lib/qr.js').then(function() {
      if (callback) callback();
    });
  }

  global.WPScriptLoader = {
    load:     load,
    ensureQr: ensureQr,
  };

}(window));
