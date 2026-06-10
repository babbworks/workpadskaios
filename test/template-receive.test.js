'use strict';

var fs = require('fs');

var global = {};
var _store = {};
var localStorage = {
  getItem: function(k) { return _store[k] != null ? _store[k] : null; },
  setItem: function(k, v) { _store[k] = String(v); },
  removeItem: function(k) { delete _store[k]; },
  key: function(i) {
    var keys = Object.keys(_store);
    return i < keys.length ? keys[i] : null;
  },
  get length() { return Object.keys(_store).length; },
};
global.localStorage = localStorage;
global.window = global;
global.btoa = function(s) { return Buffer.from(s, 'utf8').toString('base64'); };
global.atob = function(s) { return Buffer.from(s, 'base64').toString('utf8'); };

function load(path) {
  new Function('window', 'global', 'localStorage', fs.readFileSync(path, 'utf8'))(global, global, localStorage);
}

load(__dirname + '/../js/RecordTemplateService.js');
load(__dirname + '/../js/lib/template-receive.js');
var Recv = global.WPTemplateReceive;
var RTS = global.RecordTemplateService;

var pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var fields = { name: 'Boiler tpl', record_type: 'service', job: 'Boiler check' };
var hash = Recv.encodeRtplHash(fields);
assert('encode hash prefix', hash.indexOf('rtpl/') === 0);

var parsed = Recv.parseRtplFields(hash);
assert('parse round-trip', parsed && parsed.name === 'Boiler tpl');

var res = Recv.receiveFromHash(hash);
assert('receive ok', res.ok && res.tpl && res.tpl.receivedAt);
assert('pending', RTS.isPendingImport(res.tpl));

Recv.dismissPending(res.tpl.id);
assert('dismiss removes', !RTS.get(res.tpl.id));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
