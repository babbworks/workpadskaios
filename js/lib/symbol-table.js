// Symbol table — v0.4 scaffold (local peer-scoped vocab + inline TABLE_ENTRY_ADD)
// Exposes: window.WPSymbolTable

(function(global) {
  'use strict';

  var STORAGE_KEY = 'wp_symbol_tables_v1';
  var OP_TABLE_ENTRY_ADD = 0x01;

  function store() {
    if (global.localStorage) return global.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
  }

  function readAll() {
    var ls = store();
    if (!ls) return {};
    try {
      var raw = ls.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(data) {
    var ls = store();
    if (!ls) return;
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* KaiOS quota */ }
  }

  function peerKey(key) {
    return key == null ? '_default' : String(key);
  }

  function getTable(key) {
    var all = readAll();
    var pk = peerKey(key);
    if (!all[pk]) all[pk] = { version: 1, entries: [], pendingInline: [] };
    return all[pk];
  }

  function saveTable(key, table) {
    var all = readAll();
    all[peerKey(key)] = table;
    writeAll(all);
  }

  function addEntry(key, entry) {
    entry = entry || {};
    var table = getTable(key);
    var tokenId = entry.tokenId != null ? entry.tokenId : (table.entries.length + 1);
    var row = {
      tokenId: tokenId & 0xffff,
      label: String(entry.label || '').slice(0, 63),
      addedAt: Date.now()
    };
    table.entries.push(row);
    table.pendingInline.push(row);
    saveTable(key, table);
    return row;
  }

  function hasInlinePending(key) {
    var t = getTable(key);
    return t.pendingInline && t.pendingInline.length > 0;
  }

  function takeNextInlineEntry(key) {
    var table = getTable(key);
    if (!table.pendingInline || !table.pendingInline.length) return null;
    return table.pendingInline.shift();
  }

  function encodeInlineEntry(entry) {
    if (!entry) return null;
    var label = String(entry.label || '');
    var enc = global.TextEncoder ? new TextEncoder() : null;
    var lb;
    if (enc) lb = enc.encode(label);
    else {
      lb = new Uint8Array(label.length);
      for (var i = 0; i < label.length; i++) lb[i] = label.charCodeAt(i) & 0xff;
    }
    var token = (entry.tokenId != null ? Number(entry.tokenId) : 0) & 0xffff;
    var inner = new Uint8Array(4 + lb.length);
    inner[0] = OP_TABLE_ENTRY_ADD;
    inner[1] = token & 0xff;
    inner[2] = (token >> 8) & 0xff;
    inner[3] = lb.length & 0xff;
    inner.set(lb, 4);
    var out = new Uint8Array(1 + inner.length);
    out[0] = inner.length & 0xff;
    out.set(inner, 1);
    return out;
  }

  function decodeInlineEntry(bytes) {
    if (!bytes || bytes.length < 2) return null;
    var len = bytes[0];
    if (1 + len > bytes.length) return null;
    var inner = bytes.subarray(1, 1 + len);
    if (!inner.length || inner[0] !== OP_TABLE_ENTRY_ADD) return null;
    if (inner.length < 4) return null;
    var tokenId = (inner[1] & 0xff) | ((inner[2] & 0xff) << 8);
    var llen = inner[3];
    var label = '';
    if (inner.length >= 4 + llen && global.TextDecoder) {
      label = new TextDecoder().decode(inner.subarray(4, 4 + llen));
    }
    return { op: 'TABLE_ENTRY_ADD', tokenId: tokenId, label: label };
  }

  function applyDecodedEntry(key, entry) {
    if (!entry || entry.op !== 'TABLE_ENTRY_ADD') return;
    var table = getTable(key);
    var exists = false;
    for (var i = 0; i < table.entries.length; i++) {
      if (table.entries[i].tokenId === entry.tokenId) { exists = true; break; }
    }
    if (!exists) table.entries.push({ tokenId: entry.tokenId, label: entry.label, addedAt: Date.now() });
    saveTable(key, table);
  }

  function listPeerKeys() {
    return Object.keys(readAll());
  }

  function stats(key) {
    var t = getTable(key);
    return {
      entries: (t.entries && t.entries.length) || 0,
      pending: (t.pendingInline && t.pendingInline.length) || 0,
    };
  }

  function resolveLabel(key, tokenId) {
    var t = getTable(key);
    var tid = Number(tokenId) & 0xffff;
    for (var i = 0; i < t.entries.length; i++) {
      if (t.entries[i].tokenId === tid) return t.entries[i].label;
    }
    return null;
  }

  function removeEntry(key, tokenId) {
    var tid = Number(tokenId) & 0xffff;
    var table = getTable(key);
    table.entries = table.entries.filter(function(e) { return e.tokenId !== tid; });
    table.pendingInline = (table.pendingInline || []).filter(function(e) { return e.tokenId !== tid; });
    saveTable(key, table);
  }

  function updateEntry(key, tokenId, label) {
    var tid = Number(tokenId) & 0xffff;
    var table = getTable(key);
    var i, row;
    for (i = 0; i < table.entries.length; i++) {
      if (table.entries[i].tokenId === tid) {
        table.entries[i].label = String(label || '').slice(0, 63);
        row = table.entries[i];
        break;
      }
    }
    if (!row) {
      row = addEntry(key, { tokenId: tid, label: label });
      return row;
    }
    for (i = 0; i < (table.pendingInline || []).length; i++) {
      if (table.pendingInline[i].tokenId === tid) {
        table.pendingInline[i].label = row.label;
      }
    }
    saveTable(key, table);
    return row;
  }

  function clearPeer(key) {
    saveTable(key, { version: 1, entries: [], pendingInline: [] });
  }

  function flushPending(key) {
    var table = getTable(key);
    table.pendingInline = [];
    saveTable(key, table);
  }

  function peerLabelForKey(key, contactNameById) {
    if (key === '_default') return 'General (default)';
    if (contactNameById && contactNameById[key]) return contactNameById[key];
    return 'Peer ' + String(key).slice(0, 12);
  }

  function exportFromBlockRegistry(listFn, peerKey) {
    peerKey = peerKey || '_default';
    return Promise.resolve(listFn()).then(function(contacts) {
      var n = 0;
      var i, c;
      for (i = 0; i < contacts.length; i++) {
        c = contacts[i];
        if (!c || !c.name) continue;
        addEntry(peerKey, { tokenId: i + 1, label: c.name });
        n++;
      }
      return { peerKey: peerKey, count: n };
    });
  }

  global.WPSymbolTable = {
    OP_TABLE_ENTRY_ADD: OP_TABLE_ENTRY_ADD,
    getTable: getTable,
    addEntry: addEntry,
    removeEntry: removeEntry,
    updateEntry: updateEntry,
    clearPeer: clearPeer,
    flushPending: flushPending,
    listPeerKeys: listPeerKeys,
    stats: stats,
    resolveLabel: resolveLabel,
    peerLabelForKey: peerLabelForKey,
    hasInlinePending: hasInlinePending,
    takeNextInlineEntry: takeNextInlineEntry,
    encodeInlineEntry: encodeInlineEntry,
    decodeInlineEntry: decodeInlineEntry,
    applyDecodedEntry: applyDecodedEntry,
    exportFromBlockRegistry: exportFromBlockRegistry
  };

}(typeof window !== 'undefined' ? window : global));
