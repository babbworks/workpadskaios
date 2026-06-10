#!/usr/bin/env node
'use strict';
// V4-5 — export BlockRegistry contacts into WPSymbolTable (per-peer default bucket).
// Run from workpadskaios root: node scripts/export-block-registry-symbols.js

var path = require('path');
var fs = require('fs');

var root = path.join(__dirname, '..');
var storeData = {};

function load(p) {
  new Function('window', 'global', 'localStorage',
    fs.readFileSync(p, 'utf8'))(global, global, {
      getItem: function(k) { return storeData[k] || null; },
      setItem: function(k, v) { storeData[k] = v; },
      removeItem: function(k) { delete storeData[k]; }
    });
}

global.window = global;
load(path.join(root, 'js/StorageAdapter.js'));
load(path.join(root, 'js/BlockRegistry.js'));
load(path.join(root, 'js/lib/symbol-table.js'));

function runExport(peerKey) {
  peerKey = peerKey || '_default';
  return BlockRegistry.list().then(function(contacts) {
    var n = 0;
    contacts.forEach(function(c, idx) {
      if (!c || !c.name) return;
      WPSymbolTable.addEntry(peerKey, {
        tokenId: idx + 1,
        label: c.name
      });
      n++;
    });
    return { peerKey: peerKey, count: n };
  });
}

if (require.main === module) {
  runExport('_default').then(function(r) {
    console.log('Exported ' + r.count + ' contacts to symbol table [' + r.peerKey + ']');
    process.exit(0);
  }).catch(function(e) {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { runExport: runExport };
