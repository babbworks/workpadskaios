'use strict';

var fs = require('fs');

var global = {};
var _store = {};
var localStorage = {
  getItem: function(k) { return _store[k] != null ? _store[k] : null; },
  setItem: function(k, v) { _store[k] = String(v); },
  removeItem: function(k) { delete _store[k]; },
};
global.localStorage = localStorage;
global.window = global;

function load(path) {
  new Function('window', 'global', 'localStorage', fs.readFileSync(path, 'utf8'))(global, global, localStorage);
}

load(__dirname + '/../js/lib/written-code.js');
var WC = global.WPWrittenCode;

var pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

_store = {};
var reg = WC.register('@fence24', '1pv/testfragment');
assert('register ok', reg.ok && reg.alias === 'fence24');

assert('lookup', WC.lookup('fence24') === '1pv/testfragment');
assert('resolve @', WC.resolve('@fence24') === '1pv/testfragment');
assert('resolve written:', WC.resolve('written:fence24') === '1pv/testfragment');

assert('list', WC.listAliases().length === 1);
assert('invalid alias', WC.register('!!', '1pv/x').ok === false);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
