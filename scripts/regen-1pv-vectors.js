#!/usr/bin/env node
'use strict';
// Regenerate 1pv conformance vectors (native phase 2b). Run from workpadskaios root.

var fs = require('fs');
var path = require('path');
var fflate = require('../js/lib/fflate.js');

var root = path.join(__dirname, '..');
function load(p) {
  var code = fs.readFileSync(p, 'utf8');
  new Function('window', 'global', 'btoa', 'atob', 'TextEncoder', 'TextDecoder',
    code)(global, global, btoa, atob, TextEncoder, TextDecoder);
}

global.window = global;
global.fflate = fflate;
global.btoa = function(s) { return Buffer.from(s, 'binary').toString('base64'); };
global.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };

load(path.join(root, 'js/lib/native-groups-table.js'));
load(path.join(root, 'js/lib/native-v1-split.js'));
load(path.join(root, 'js/lib/pathc-v2.js'));
load(path.join(root, 'js/lib/pathc-native.js'));
load(path.join(root, 'js/lib/codec.js'));

var codec = global.WPCodec;

var specs = [
  { id: 'invoice-live', record: { job: 'Vector invoice', customer: 'Acme', record_type: 'invoice', date: '2026-05-20', amount: '100.00', currency: 'GBP', chain_mode: 'LIVE', details: 'Line item' }, opts: { domain: 1, customerAmount: 100, decimalPos: 2, currency: 0 } },
  { id: 'ack-masks', record: { job: 'Vector ack', customer: 'Acme', record_type: 'ack', date: '2026-05-20', relationship: 'acknowledges', confirmed_mask: 5, declined_mask: 2 }, opts: { chain: true, chainRef: 'AbCd' } },
  { id: 'payment-pays', record: { job: 'Vector pay', customer: 'Acme', record_type: 'payment', date: '2026-05-20', amount: '50.00', currency: 'GBP' }, opts: { domain: 1, customerAmount: 50, decimalPos: 2, currency: 0, chain: true, chainRef: 'XyZ1' } },
  { id: 'schedule-g2', record: { job: 'Site visit', customer: 'Beta', record_type: 'schedule', date: '2026-06-01', location: 'Unit 4' }, opts: {} },
  { id: 'work-record-g4', record: { job: 'Repair boiler', customer: 'Gamma', record_type: 'work_record', date: '2026-05-22', details: 'Replaced valve', actions: [{ title: 'Test', notes: '' }] }, opts: {} },
  { id: 'note-g5', record: { job: 'Daily note', customer: 'Self', record_type: 'note', date: '2026-05-23', story: 'All quiet' }, opts: {} },
  { id: 'need-noc', record: { job: 'Need plumber', customer: 'Delta', record_type: 'need', date: '2026-05-24' }, opts: {} },
  { id: 'job-default', record: { job: 'Default job type', customer: 'Epsilon', record_type: 'job', date: '2026-05-24', details: 'Work done' }, opts: {} }
];

var vectors = specs.map(function(spec) {
  var url = codec.encode(spec.record, Object.assign({ padsV2: true }, spec.opts || {}));
  var hash = url.replace(/^https?:\/\/workpads\.me\/p#?/, '').replace(/^workpads\.me\/p#/, '');
  return { id: spec.id, record: spec.record, url: url.replace(/^https?:\/\/workpads\.me\/p/, 'workpads.me/p'), hash: hash };
});

var out = {
  version: '1pv-native-2b',
  generated: '2026-05-24',
  spec: 'workpads-standard/codec.md §5.2–5.3',
  vectors: vectors
};

var outPath = path.join(root, 'test/fixtures/1pv-vectors.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(root, '../workpads-codec/test/fixtures/1pv-vectors.json'), JSON.stringify(out, null, 2) + '\n');
console.log('Wrote ' + vectors.length + ' vectors to test/fixtures/1pv-vectors.json (+ codec mirror)');
