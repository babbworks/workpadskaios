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
global.document = {
  documentElement: { setAttribute: function() {}, removeAttribute: function() {} },
  getElementById: function() { return null; },
  createElement: function() {
    return {
      id: '', rel: '', href: '', disabled: false,
      setAttribute: function() {},
      removeAttribute: function(k) { if (k === 'href') this.href = ''; },
    };
  },
  head: { appendChild: function() {} },
};

function load(path) {
  new Function('window', 'global', 'localStorage', 'document', fs.readFileSync(path, 'utf8'))(
    global, global, localStorage, global.document);
}

load(__dirname + '/../js/lib/ui-theme.js');
var T = global.UITheme;

var pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

_store = {};
assert('default legacy', T.get() === 'legacy');
T.set('v2');
assert('set v2', T.get() === 'v2' && T.isV2());
assert('list themes', T.list().length >= 2);
var cycled = T.cycle();
assert('cycle from v2', cycled === 'legacy' || cycled === 'v2');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
