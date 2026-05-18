// template-registry.js — template store and canonical serialisation
// Depends on: global.WPCrypto.sha256, global.localStorage
// Exposes: global.WPTemplateRegistry

'use strict';

(function(global) {

  var STORAGE_PREFIX = 'wp_template_';

  // ── Canonical serialisation ───────────────────────────────────────────────────
  // Sort all JSON object keys recursively; remove mutable/local fields.

  function sortKeys(obj) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    var sorted = {};
    Object.keys(obj).sort().forEach(function(k) { sorted[k] = sortKeys(obj[k]); });
    return sorted;
  }

  function canonicalSerialise(schema) {
    var clean = {};
    var keys  = Object.keys(schema);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'id' || k === 'name' || k === 'protected') continue;
      if (k === 'meta') {
        var m = Object.assign({}, schema.meta);
        delete m.content_hash;
        clean.meta = m;
      } else {
        clean[k] = schema[k];
      }
    }
    return JSON.stringify(sortKeys(clean));
  }

  function fingerprintSchema(schema) {
    var serialised = canonicalSerialise(schema);
    var bytes      = new TextEncoder().encode(serialised);
    return global.WPCrypto.sha256(bytes);
  }

  // ── Registry ──────────────────────────────────────────────────────────────────

  function storeTemplate(id, schema) {
    var key      = STORAGE_PREFIX + id;
    var version  = schema.version || 1;
    var existing = global.localStorage.getItem(key);
    var versioned = existing ? JSON.parse(existing) : {};
    versioned[version] = schema;
    global.localStorage.setItem(key, JSON.stringify(versioned));
  }

  function getTemplate(id, version) {
    var key = STORAGE_PREFIX + id;
    var raw = global.localStorage.getItem(key);
    if (!raw) return null;
    var versioned = JSON.parse(raw);
    if (version != null) return versioned[version] || null;
    var versions = Object.keys(versioned).map(Number);
    return versioned[Math.max.apply(null, versions)] || null;
  }

  function listTemplates() {
    var ids = [];
    var len = global.localStorage.length;
    for (var i = 0; i < len; i++) {
      var k = global.localStorage.key(i);
      if (k && k.slice(0, STORAGE_PREFIX.length) === STORAGE_PREFIX) {
        ids.push(k.slice(STORAGE_PREFIX.length));
      }
    }
    return ids;
  }

  global.WPTemplateRegistry = {
    storeTemplate:      storeTemplate,
    getTemplate:        getTemplate,
    listTemplates:      listTemplates,
    canonicalSerialise: canonicalSerialise,
    fingerprintSchema:  fingerprintSchema
  };

}(typeof window !== 'undefined' ? window : global));
