// Test-only shim for legacy wp_template_* store (was js/lib/template-registry.js)
'use strict';

module.exports = function attachWpTemplateRegistry(global) {
  var STORAGE_PREFIX = 'wp_template_';

  function sortKeys(obj) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    var sorted = {};
    Object.keys(obj).sort().forEach(function(k) { sorted[k] = sortKeys(obj[k]); });
    return sorted;
  }

  function canonicalSerialise(schema) {
    var clean = {};
    var keys = Object.keys(schema);
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
    var bytes = new TextEncoder().encode(serialised);
    return global.WPCrypto.sha256(bytes);
  }

  function storeTemplate(id, schema) {
    var key = STORAGE_PREFIX + id;
    var version = schema.version || 1;
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
    for (var i = 0; i < global.localStorage.length; i++) {
      var k = global.localStorage.key(i);
      if (k && k.slice(0, STORAGE_PREFIX.length) === STORAGE_PREFIX) {
        ids.push(k.slice(STORAGE_PREFIX.length));
      }
    }
    return ids;
  }

  global.WPTemplateRegistry = {
    storeTemplate: storeTemplate,
    getTemplate: getTemplate,
    listTemplates: listTemplates,
    canonicalSerialise: canonicalSerialise,
    fingerprintSchema: fingerprintSchema,
  };
};
