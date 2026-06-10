'use strict';

var fs = require('fs');

function load(path) {
  new Function('window', 'global', 'localStorage', fs.readFileSync(path, 'utf8'))(
    global, global, {
      getItem: function(k) { return global._ls[k] || null; },
      setItem: function(k, v) { global._ls[k] = v; },
      removeItem: function(k) { delete global._ls[k]; },
    }
  );
}

global._ls = {};
global.window = global;
global.esc = function(s) { return String(s == null ? '' : s); };
global.UIPhase = { isOn: function() { return true; } };

load(__dirname + '/../js/lib/symbol-table.js');
load(__dirname + '/../js/lib/relational-codec.js');
load(__dirname + '/../js/lib/relational-ui.js');

var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

WPSymbolTable.addEntry('peer-a', { tokenId: 1, label: 'Acme' });
WPSymbolTable.addEntry('peer-a', { tokenId: 2, label: 'Beta' });
assert('stats entries', WPSymbolTable.stats('peer-a').entries === 2);
assert('resolve label', WPSymbolTable.resolveLabel('peer-a', 1) === 'Acme');
WPSymbolTable.updateEntry('peer-a', 1, 'Acme Ltd');
assert('update label', WPSymbolTable.resolveLabel('peer-a', 1) === 'Acme Ltd');
WPSymbolTable.removeEntry('peer-a', 2);
assert('remove', WPSymbolTable.stats('peer-a').entries === 1);

var rec = { job: 'Test', linkedContactId: 'peer-a' };
var opts = WPRelationalCodec.buildEncodeOpts(rec, {});
assert('encode opts relational', opts.relationalMode === true && opts.counterpartyKey === 'peer-a');

var html = WPRelationalUi.renderShareSection(rec, '1pv');
assert('share section', html.indexOf('Relational') !== -1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
