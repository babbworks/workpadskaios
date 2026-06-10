/* Shared helpers for link-lab pages */
(function(global) {
  'use strict';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function normalizeHash(input) {
    input = (input || '').trim();
    if (!input) return '';
    var hi = input.indexOf('#');
    if (hi >= 0) input = input.slice(hi + 1);
    input = input.replace(/^#+/, '');
    if (input.indexOf('/') < 0 && /^[A-Za-z0-9_-]+$/.test(input)) {
      throw new Error('Paste the full fragment including tag, e.g. #1pa/' + input.slice(0, 12) + '…');
    }
    return input;
  }

  function detectTag(hash) {
    if (!hash) return null;
    if (hash.indexOf('1pm/') === 0) return '1pm';
    if (hash.indexOf('1pv/') === 0) return '1pv';
    if (hash.indexOf('1dt/') === 0) return '1dt';
    if (hash.indexOf('t/') === 0 || hash.indexOf('te/') === 0) return 't';
    var m = hash.match(/^(1p[a-z]\/|1[a-z]g\/)/);
    if (m) return m[1].slice(0, 3);
    return null;
  }

  function canonicalUrl(hash, base) {
    hash = normalizeHash(hash);
    base = (base || 'https://workpads.me/p').replace(/\/$/, '');
    if (base.indexOf('#') >= 0) return base.split('#')[0] + '#' + hash;
    return base + '#' + hash;
  }

  function getLinkBase(defaultBase) {
    try {
      var b = localStorage.getItem('wp_link_base');
      if (b) return b.replace(/\/$/, '');
    } catch (e) {}
    return defaultBase || 'http://localhost:8765/link-lab/p';
  }

  function setLinkBase(v) {
    try { localStorage.setItem('wp_link_base', v); } catch (e) {}
  }

  global.WPLabCommon = {
    esc: esc,
    normalizeHash: normalizeHash,
    detectTag: detectTag,
    canonicalUrl: canonicalUrl,
    getLinkBase: getLinkBase,
    setLinkBase: setLinkBase
  };
})(window);
