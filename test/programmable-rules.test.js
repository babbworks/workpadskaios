'use strict';

var fs = require('fs');
var fflate = require('../js/lib/fflate.js');
var window = {
  fflate: fflate,
  TextEncoder: require('util').TextEncoder,
  TextDecoder: require('util').TextDecoder
};

function load(path) {
  new Function('window', fs.readFileSync(path, 'utf8'))(window);
}

load(__dirname + '/../js/lib/programmable-rules.js');
load(__dirname + '/../js/lib/fflate.js');
load(__dirname + '/../js/lib/pathc-v2.js');
load(__dirname + '/../js/lib/pathc-native.js');
load(__dirname + '/../js/lib/codec.js');

window.btoa = function(s) { return Buffer.from(s, 'binary').toString('base64'); };
window.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };

var PR = window.WPProgrammableRules;
var codec = window.WPCodec;
var pass = 0, fail = 0;

function assert(label, cond, extra) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label + (extra ? ' — ' + extra : '')); fail++; }
}

var rules = [
  { op: 'when_confirmed', mask: 0x0003 },
  { op: 'when_declined', mask: 0x0002 },
  { op: 'when_paid' },
  { op: 'when_date_before', date: '2026-12-31' },
  { op: 'when_date_reached', date: '2026-01-01' },
  { op: 'when_ack_received', party_slot: 1 }
];

var block = PR.encodeBlock(rules);
assert('encode six rules', block && block.length > 10);

var dec = PR.decodeBlock(block, 0);
assert('decode count', dec.rules.length === 6);
assert('confirmed mask', dec.rules[0].mask === 3);

var rec = {
  job: 'Prog test',
  customer: 'Acme',
  record_type: 'invoice',
  date: '2026-05-20',
  amount: '50',
  programmable_rules: rules
};

var url = codec.encode(rec, { padsV2: true });
var out = codec.decode(url);
assert('wire round-trip rules', out.programmable_rules && out.programmable_rules.length === 6);
assert('plain hints', out._programmablePlain && out._programmablePlain.length === 6);
assert('native decode', out._nativeGroups === true);

var ev = PR.evaluate(rules, [{ record_type: 'payment' }], { today: '2026-06-01' });
assert('when_paid satisfied', ev[2].satisfied === true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
