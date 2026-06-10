'use strict';

var fflate = require('../js/lib/fflate.js');
var fs = require('fs');
var window = {
  fflate: fflate,
  btoa: function(s) { return Buffer.from(s, 'binary').toString('base64'); },
  atob: function(s) { return Buffer.from(s, 'base64').toString('binary'); },
  TextEncoder: require('util').TextEncoder,
  TextDecoder: require('util').TextDecoder,
  localStorage: {
    _d: {},
    getItem: function(k) { return this._d[k] || null; },
    setItem: function(k, v) { this._d[k] = v; },
    removeItem: function(k) { delete this._d[k]; }
  }
};

function load(path) {
  new Function('window', 'btoa', 'atob', 'TextEncoder', 'TextDecoder',
    fs.readFileSync(path, 'utf8'))(window, window.btoa, window.atob, window.TextEncoder, window.TextDecoder);
}

load(__dirname + '/../js/lib/native-groups-table.js');
load(__dirname + '/../js/lib/native-v1-split.js');
load(__dirname + '/../js/lib/domain-profile.js');
load(__dirname + '/../js/lib/symbol-table.js');
load(__dirname + '/../js/lib/pathc-v2.js');
load(__dirname + '/../js/lib/pathc-native.js');
load(__dirname + '/../js/lib/codec.js');
load(__dirname + '/../js/lib/compression-metrics.js');

var M = window.WPCompressionMetrics;
var pass = 0, fail = 0;

function assert(label, cond, extra) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label + (extra ? ' — ' + extra : '')); fail++; }
}

var base = {
  job: 'Boiler service annual inspection and parts replacement',
  customer: 'River Cafe Ltd',
  record_type: 'invoice',
  date: '2026-05-24',
  amount: '240.00',
  currency: 'GBP'
};

var cmp = M.compareExchangeSizes(base);
assert('metrics first deflate > 0', cmp.first.deflate > 0);
assert('metrics tenth deflate > 0', cmp.tenth.deflate > 0);
assert('tenth smaller than first', cmp.tenth.deflate < cmp.first.deflate,
  'first=' + cmp.first.deflate + ' tenth=' + cmp.tenth.deflate);
assert('compression target (33% interim)', cmp.targetMet === true, 'reduction ' + cmp.reductionPct + '%');
console.log('  [INFO] reduction ' + cmp.reductionPct + '% (target ' + (cmp.targetRatio * 100) + '%)');

var innerRel = M.pathcInnerBytes(base, {
  padsV2: true,
  relationalMode: true,
  profileId: 1,
  chainRef24: 99
});
assert('relational ext adds bounded bytes', innerRel >= cmp.first.inner && innerRel <= cmp.first.inner + 32);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
