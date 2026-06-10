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

load(__dirname + '/../js/lib/rel-volume.js');
var RelVolume = global.RelVolume;

var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var records = [
  { id: 'c1', record_type: 'contact', job: 'Alice', createdAt: Date.now() },
  { id: 'r1', record_type: 'sale', customer: 'Alice', amount: 10, createdAt: Date.now() },
  { id: 'r2', record_type: 'sale', customer: 'Alice', amount: 5, createdAt: Date.now() - 86400000 * 40 },
  { id: 'n1', record_type: 'need', customer: 'Bob', job: 'Need x', createdAt: Date.now() },
];

var scored = RelVolume.scoreByContact(records);
assert('alice scored', scored.some(function(s) { return s.contactId === 'c1' && s.score > 0; }));

var ex = RelVolume.explainContact('c1', records);
assert('explain lines', ex.lines && ex.lines.length > 0);

var band = RelVolume.bandForScore(4.5);
assert('rhythm band', band === 'rhythm');

assert('in network', RelVolume.recordInRhythmNetwork(records[1], records));

RelVolume.applyPreset('market');
assert('preset', RelVolume.getDials().weightSale === 3);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
