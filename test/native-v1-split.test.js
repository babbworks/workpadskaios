'use strict';

var fs = require('fs');
var fflate = require('../js/lib/fflate.js');
var window = {
  fflate: fflate,
  TextEncoder: require('util').TextEncoder,
  TextDecoder: require('util').TextDecoder,
  btoa: function(s) { return Buffer.from(s, 'binary').toString('base64'); },
  atob: function(s) { return Buffer.from(s, 'base64').toString('binary'); }
};

function load(path) {
  new Function('window', 'btoa', 'atob', 'TextEncoder', 'TextDecoder',
    fs.readFileSync(path, 'utf8'))(window, window.btoa, window.atob, window.TextEncoder, window.TextDecoder);
}

load(__dirname + '/../js/lib/native-groups-table.js');
load(__dirname + '/../js/lib/native-v1-split.js');
load(__dirname + '/../js/lib/programmable-rules.js');
load(__dirname + '/../js/lib/pathc-v2.js');
load(__dirname + '/../js/lib/pathc-native.js');
load(__dirname + '/../js/lib/codec.js');

var codec = window.WPCodec;
var pass = 0, fail = 0;

function assert(label, cond, extra) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label + (extra ? ' — ' + extra : '')); fail++; }
}

var rec = {
  job: 'Split test invoice',
  customer: 'Beta Ltd',
  record_type: 'invoice',
  date: '2026-05-20',
  amount: '240.00',
  currency: 'GBP',
  chain_mode: 'LIVE',
  details: 'Phase 2 native split'
};

var frame = codec._buildFrame(rec, {
  domain: 1,
  customerAmount: 240,
  decimalPos: 2,
  currency: 0
});

var split = window.WPNativeV1Split.splitV1ToNativeGroups(frame);
assert('split has G0', split.groups[0] && split.groups[0].length > 0);
assert('split has G1 financial', split.groups[1] && split.groups[1].length > 0);
assert('presence G0', !!(split.presence & 1));
assert('presence G1', !!(split.presence & 2));
assert('G2 time slice', split.groups[2] && split.groups[2].length > 0, 'date in G2 not G0-only');
assert('G4 work slice', split.groups[4] && split.groups[4].length > 0, 'details in G4');
assert('G0 no date payload alone', !(split.groups[0].length > 80), 'G0 should be identity+flags only');

var merged = window.WPNativeV1Split.mergeNativeGroupsToV1(split.groups, split.presence, split.headerPrefix);
assert('merge length', merged.length === frame.length, merged.length + ' vs ' + frame.length);

var decMerged = codec._parseFrame(merged);
assert('merge round-trip job', decMerged.job === rec.job);
assert('merge round-trip amount', decMerged.customer_amount === '240.00');

var url = codec.encode(rec, { padsV2: true });
var dec = codec.decode(url);
assert('native encode job', dec.job === rec.job);
assert('native encode details', dec.details === rec.details);
assert('multi-group presence', dec._nativeGroups === true);

var pay = {
  job: 'Pay',
  customer: 'Beta',
  record_type: 'payment',
  date: '2026-05-21',
  amount: '240.00'
};
var urlPay = codec.encode(pay, { padsV2: true });
var decPay = codec.decode(urlPay);
assert('payment round-trip', decPay.job === pay.job);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
