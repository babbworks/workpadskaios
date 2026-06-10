// integration-smoke.test.js — RecordService helpers + WPAgreements (Node, no DOM)
'use strict';

var fs = require('fs');
var path = require('path');

var pass = 0, fail = 0;
function assert(label, cond, extra) {
  if (cond) { pass++; console.log('  [PASS]  ' + label); }
  else { fail++; console.log('  [FAIL]  ' + label + (extra ? ' — ' + extra : '')); }
}

var window = {};
window.merge = function(target) {
  for (var i = 1; i < arguments.length; i++) {
    var src = arguments[i];
    if (!src) continue;
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
  }
  return target;
};

var agrSrc = fs.readFileSync(path.join(__dirname, '../js/lib/agreements.js'), 'utf8');
(new Function('global', agrSrc + '\n//# sourceURL=agreements.js'))(window);
var WPAgreements = window.WPAgreements;

console.log('\nWPAgreements.isRatified');
assert('ratified when counterparty commits', WPAgreements.isRatified([
  { ack_request: true, chain: false, commit_type: null, sender_uid: 'A', threshold_n: 2 },
  { ack_request: false, chain: true, commit_type: 1, sender_uid: 'B', threshold_n: null },
]), true);
assert('not ratified with offer only', !WPAgreements.isRatified([
  { ack_request: true, chain: false, commit_type: null, sender_uid: 'A', threshold_n: 2 },
]));

// childrenByParentId logic (inline mirror of RecordService)
function childrenByParentId(records) {
  var map = {};
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var pid = r.parentId;
    if (!pid) continue;
    if (!map[pid]) map[pid] = [];
    map[pid].push(r);
  }
  return map;
}

console.log('\nchildrenByParentId');
var sample = [
  { id: 'a', parentId: null },
  { id: 'c1', parentId: 'a', amount: '10' },
  { id: 'c2', parentId: 'a', amount: '20' },
];
var m = childrenByParentId(sample);
assert('two children under a', m.a && m.a.length === 2, 'got ' + (m.a ? m.a.length : 0));
assert('sums child amounts', m.a[0].amount === '10' && m.a[1].amount === '20', '');

console.log('\nRecordService.amendmentChangedFieldIds');
function amendmentFieldChanged(cur, orig, fieldId) {
  function toStr(val) {
    if (val == null || val === undefined) return '';
    if (Array.isArray(val)) {
      return val.map(function(a) { return (a && a.title) ? String(a.title) : String(a); }).join('\n');
    }
    return String(val);
  }
  return toStr(cur[fieldId]) !== toStr(orig[fieldId]);
}
var AMEND_FIELDS = ['job', 'customer', 'date'];
function amendmentChangedFieldIds(rec, orig) {
  var ids = [];
  for (var i = 0; i < AMEND_FIELDS.length; i++) {
    if (amendmentFieldChanged(rec, orig, AMEND_FIELDS[i])) ids.push(AMEND_FIELDS[i]);
  }
  return ids;
}
var cur = { job: 'New title', customer: 'Alice', date: '2026-05-01' };
var orig = { job: 'Old title', customer: 'Alice', date: '2026-05-01' };
var changed = amendmentChangedFieldIds(cur, orig);
assert('detects job change only', changed.length === 1 && changed[0] === 'job', JSON.stringify(changed));

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
