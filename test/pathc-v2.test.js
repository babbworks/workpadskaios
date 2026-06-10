// pathc-v2.test.js — #1pv/ bridge round-trip
'use strict';

var fflate = require('../js/lib/fflate.js');
var fs = require('fs');
var window = { fflate: fflate, btoa: function(s) { return Buffer.from(s, 'binary').toString('base64'); },
  atob: function(s) { return Buffer.from(s, 'base64').toString('binary'); },
  TextEncoder: require('util').TextEncoder, TextDecoder: require('util').TextDecoder };

function load(path) {
  new Function('window', 'btoa', 'atob', 'TextEncoder', 'TextDecoder',
    fs.readFileSync(path, 'utf8'))(window, window.btoa, window.atob, window.TextEncoder, window.TextDecoder);
}

load(__dirname + '/../js/lib/domain-profile.js');
load(__dirname + '/../js/lib/symbol-table.js');
load(__dirname + '/../js/lib/relational-codec.js');
load(__dirname + '/../js/lib/native-groups-table.js');
load(__dirname + '/../js/lib/native-v1-split.js');
load(__dirname + '/../js/lib/programmable-rules.js');
load(__dirname + '/../js/lib/pathc-v2.js');
load(__dirname + '/../js/lib/pathc-native.js');
load(__dirname + '/../js/lib/codec.js');

window.localStorage = {
  _d: {},
  getItem: function(k) { return this._d[k] || null; },
  setItem: function(k, v) { this._d[k] = v; },
  removeItem: function(k) { delete this._d[k]; }
};
window.UIPhase = {
  isOn: function(key) { return key === 'relational_encode'; }
};

var codec = window.WPCodec;
var pass = 0, fail = 0;

function assert(label, cond, extra) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label + (extra ? ' — ' + extra : '')); fail++; }
}

var rec = {
  job: 'Path C rebuild test',
  customer: 'Acme',
  record_type: 'invoice',
  date: '2026-05-20',
  amount: '100.00',
  currency: 'GBP',
  chain_mode: 'LIVE'
};

var urlV2 = codec.encode(rec, { padsV2: true });
assert('v2 url tag', urlV2.indexOf('#1pv/') >= 0);
var dec = codec.decode(urlV2);
assert('round-trip job', dec.job === rec.job);
assert('_pathc meta', dec._pathc && dec._pathc.recordType === 'invoice');
assert('chain_mode', dec.chain_mode === 'LIVE');
assert('native groups default', dec._nativeGroups === true);

var urlBridge = codec.encode(rec, { padsV2: true, bridgeV1: true });
var decBridge = codec.decode(urlBridge);
assert('bridge opt-in round-trip', decBridge.job === rec.job);

var urlV1 = codec.encode(rec, {});
assert('v1 still works', urlV1.indexOf('#1pa/') >= 0);
var dec1 = codec.decode(urlV1);
assert('v1 round-trip', dec1.job === rec.job);

var ackRec = {
  job: 'Ack test',
  customer: 'Acme',
  record_type: 'ack',
  date: '2026-05-20',
  relationship: 'acknowledges',
  confirmed_mask: 0x0005,
  declined_mask: 0x0002,
  chainRef: 'AbCd'
};
var urlAck = codec.encode(ackRec, { padsV2: true, chain: true, chainRef: 'AbCd' });
var decAck = codec.decode(urlAck);
assert('ack relationship', decAck.relationship === 'acknowledges');
assert('ack confirmed_mask', decAck.confirmed_mask === 5);
assert('ack declined_mask', decAck.declined_mask === 2);

var payRec = {
  job: 'Payment',
  customer: 'Acme',
  record_type: 'payment',
  date: '2026-05-20',
  amount: '50.00',
  currency: 'GBP',
  chainRef: 'XyZ1'
};
var urlPay = codec.encode(payRec, { padsV2: true, chain: true, chainRef: 'XyZ1' });
assert('pay infers relationship', codec.decode(urlPay).relationship === 'pays');

var v4Rec = {
  job: 'Relational scaffold',
  customer: 'Acme',
  record_type: 'need',
  date: '2026-05-24',
  relational_mode: true,
  chain_seq_compact: 0x00aabb,
  profile_id: 'service_work.v1'
};
var urlV4 = codec.encode(v4Rec, {
  padsV2: true,
  relationalMode: true,
  chainRef24: 0x00aabb,
  profileId: 1
});
var decV4 = codec.decode(urlV4);
assert('v4 relational_mode', decV4.relational_mode === true);
assert('v4 chain_seq_compact', decV4.chain_seq_compact === 0x00aabb);
assert('v4 profile_id', decV4.profile_id === 'service_work.v1');

window.WPSymbolTable.addEntry('peer-1', { tokenId: 42, label: 'Acme Ltd' });
var urlSym = codec.encode(
  { job: 'With symbol', customer: 'X', record_type: 'need', date: '2026-05-24' },
  { padsV2: true, relationalMode: true, counterpartyKey: 'peer-1' }
);
var decSym = codec.decode(urlSym);
assert('v4 inline table entry', decSym._inline_table_entry && decSym._inline_table_entry.tokenId === 42);

var fixtures = JSON.parse(fs.readFileSync(__dirname + '/fixtures/1pv-vectors.json', 'utf8'));
fixtures.vectors.forEach(function(v) {
  var d = codec.decode(v.url);
  assert('fixture ' + v.id + ' job', d.job === v.record.job);
  if (v.record.relationship) assert('fixture ' + v.id + ' rel', d.relationship === v.record.relationship);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
