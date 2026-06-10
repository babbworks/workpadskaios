'use strict';

var fs = require('fs');
var window = {};

function load(path) {
  new Function('window', fs.readFileSync(path, 'utf8'))(window);
}

load(__dirname + '/../js/lib/native-groups-table.js');

var NG = window.WPNativeGroups;
var mandatory = require('../system/dev_refs/native-groups-mandatory.json');
var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

assert('invoice mandatory G0 G1 G6',
  NG.mandatoryGroupIds({ record_type: 'invoice' }).join() === '0,1,6');
assert('payment mandatory G0 G1',
  NG.mandatoryGroupIds({ record_type: 'payment' }).join() === '0,1');
assert('need mandatory G0 G4',
  NG.mandatoryGroupIds({ record_type: 'need' }).join() === '0,4');

var rt;
for (rt in mandatory.mandatory) {
  if (rt === 'default') continue;
  var js = NG.mandatoryGroupIds({ record_type: rt }).slice().sort().join(',');
  var json = mandatory.mandatory[rt].slice().sort().join(',');
  assert('json sync ' + rt, js === json);
}

assert('presence merges mandatory',
  NG.presenceWithMandatory({ record_type: 'payment' }, 1) === (1 | 2));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
