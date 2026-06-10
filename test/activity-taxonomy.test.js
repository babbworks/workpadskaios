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

load(__dirname + '/../js/lib/activity-taxonomy.js');
load(__dirname + '/../js/WorkActivityService.js');
var Tax = global.WPActivityTaxonomy;
var WAct = global.WorkActivityService;

var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var fields = Tax.toStoreFields({ ownership: 'other', setting: 'remote' });
assert('toStoreFields type', fields.type === 'other');
assert('toStoreFields setting', fields.setting === 'remote');

var legacy = Tax.normalizeActivity({ type: 'own', name: 'X' });
assert('normalize setting default', legacy.setting === 'field');

var act = WAct.create('Market stall', { type: 'other', setting: 'base' });
assert('create stores setting', act.setting === 'base' && act.type === 'other');
assert('metaLine', Tax.metaLine(act).indexOf('Other') !== -1 && Tax.metaLine(act).indexOf('Base') !== -1);
assert('optionLabel includes name', Tax.optionLabel(act).indexOf('Market stall') === 0);

var again = WAct.getById(act.id);
assert('getById normalize', again && again.setting === 'base');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
