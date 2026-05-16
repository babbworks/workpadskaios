// BlockRegistry — contact store (name + phone from workpad records)
// R11-6: v0.1 scope = name + phone. VCF-aligned fields in v0.2.
// Exposes: window.BlockRegistry (singleton)

(function(global) {
  'use strict';

  var store = new StorageAdapter('wp_block_');

  function normalizeKey(name) {
    return name.trim().toLowerCase().replace(/\s+/g, '_');
  }

  // Save or update a contact entry. Key is the normalized name.
  function save(name, phone) {
    var key = normalizeKey(name);
    return store.get(key).then(function(existing) {
      var entry = merge(existing || { key: key }, {
        name:      name.trim(),
        phone:     (phone || '').trim(),
        updatedAt: Date.now(),
      });
      if (!existing) entry.createdAt = Date.now();
      return store.put(key, entry).then(function() { return entry; });
    });
  }

  // Look up a contact by name (exact, case-insensitive).
  function lookup(name) {
    return store.get(normalizeKey(name));
  }

  // List all contacts, sorted A–Z by name.
  function list() {
    return store.list().then(function(pairs) {
      return pairs
        .map(function(p) { return p.data; })
        .sort(function(a, b) { return a.name.localeCompare(b.name); });
    });
  }

  // Count contacts.
  function count() {
    return store.count();
  }

  global.BlockRegistry = { save: save, lookup: lookup, list: list, count: count };

}(window));
