// finance-overview-aggregate.test.js — date window + aggregate (mirrors finance-overview.js)
'use strict';

var pass = 0, fail = 0;
function assert(label, cond, extra) {
  if (cond) { pass++; console.log('  [PASS]  ' + label); }
  else { fail++; console.log('  [FAIL]  ' + label + (extra ? ' — ' + extra : '')); }
}

var windowMode = 'all';

function windowStart(mode) {
  var now = new Date();
  if (mode === 'week') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
      .toISOString().slice(0, 10);
  }
  if (mode === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().slice(0, 10);
  }
  return null;
}

function inWindow(rec, mode) {
  var start = windowStart(mode);
  if (!start) return true;
  return (rec.date || '') >= start;
}

function aggregate(records, childrenMap, mode, typeFilter) {
  var byc = {};
  var mains = records.filter(function(r) {
    if (r.parentId) return false;
    if (r.record_class === 'contact') return false;
    if (!inWindow(r, mode)) return false;
    if (typeFilter !== null && (r.record_type || '') !== typeFilter) return false;
    return true;
  });
  for (var i = 0; i < mains.length; i++) {
    var rec = mains[i];
    var cur = (rec.currency || 'unknown').toUpperCase();
    var children = childrenMap[rec.id] || [];
    var billed = 0;
    for (var ci = 0; ci < children.length; ci++) {
      billed += parseFloat(children[ci].amount || children[ci].customer_amount || 0) || 0;
    }
    if (!byc[cur]) byc[cur] = { billed: 0 };
    byc[cur].billed += billed;
  }
  return { byc: byc, recordCount: mains.length };
}

console.log('\nfinance-overview inWindow');
assert('all includes old date', inWindow({ date: '2020-01-01' }, 'all'), '');
assert('month excludes old', !inWindow({ date: '2020-01-01' }, 'month'), '');
var today = new Date().toISOString().slice(0, 10);
assert('month includes today', inWindow({ date: today }, 'month'), '');

console.log('\nfinance-overview aggregate');
var records = [
  { id: 'j1', record_type: 'invoice', currency: 'GBP', date: today },
  { id: 'c1', parentId: 'j1', amount: '100' },
  { id: 'j-old', record_type: 'invoice', currency: 'GBP', date: '2020-01-01' },
];
var map = { j1: [{ id: 'c1', parentId: 'j1', amount: '100' }] };
var aggAll = aggregate(records, map, 'all', null);
assert('all: counts mains without parentId', aggAll.recordCount === 2, 'count=' + aggAll.recordCount);
assert('all: GBP billed 100', aggAll.byc.GBP && aggAll.byc.GBP.billed === 100, JSON.stringify(aggAll.byc));

var aggMonth = aggregate(records, map, 'month', null);
assert('month: excludes old-date main', aggMonth.recordCount === 1, 'count=' + aggMonth.recordCount);
assert('month: billed 100 only', aggMonth.byc.GBP && aggMonth.byc.GBP.billed === 100, '');

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
