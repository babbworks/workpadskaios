// written-code.js — CT-2 short alias → URL fragment (device + lab)
// Exposes: window.WPWrittenCode

(function(global) {
  'use strict';

  var STORE_KEY = 'wp_written_aliases_v1';
  var ALIAS_RE = /^[A-Za-z0-9._-]{4,30}$/;

  function readAll() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function writeAll(map) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(map || {}));
      return true;
    } catch (_) {
      return false;
    }
  }

  function normaliseAlias(alias) {
    alias = String(alias || '').trim();
    if (alias.indexOf('written:') === 0) alias = alias.slice(8);
    if (alias.charAt(0) === '@') alias = alias.slice(1);
    if (!ALIAS_RE.test(alias)) return null;
    return alias;
  }

  function register(alias, fragment) {
    var a = normaliseAlias(alias);
    if (!a) return { ok: false, error: 'invalid-alias' };
    fragment = String(fragment || '').trim();
    if (fragment.charAt(0) === '#') fragment = fragment.slice(1);
    if (!fragment || fragment.length < 8) return { ok: false, error: 'invalid-fragment' };
    var map = readAll();
    map[a] = fragment;
    writeAll(map);
    return { ok: true, alias: a };
  }

  function lookup(alias) {
    var a = normaliseAlias(alias);
    if (!a) return null;
    var map = readAll();
    return map[a] || null;
  }

  function resolve(input) {
    input = String(input || '').trim();
    if (!input) return null;
    if (input.indexOf('written:') === 0) return lookup(input.slice(8));
    if (input.charAt(0) === '@') return lookup(input.slice(1));
    if (ALIAS_RE.test(input) && input.indexOf('/') === -1) {
      var hit = lookup(input);
      if (hit) return hit;
    }
    return null;
  }

  function listAliases() {
    var map = readAll();
    return Object.keys(map).sort().map(function(k) {
      return { alias: k, fragment: map[k] };
    });
  }

  global.WPWrittenCode = {
    STORE_KEY: STORE_KEY,
    register: register,
    lookup: lookup,
    resolve: resolve,
    listAliases: listAliases,
    normaliseAlias: normaliseAlias,
  };

}(typeof window !== 'undefined' ? window : global));
