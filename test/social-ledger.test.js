'use strict';

var fs = require('fs');

function load(path) {
  new Function('window', 'global', 'localStorage', fs.readFileSync(path, 'utf8'))(global, global, global.localStorage);
}

var _store = {};
global.localStorage = {
  getItem: function(k) { return _store[k] != null ? _store[k] : null; },
  setItem: function(k, v) { _store[k] = String(v); },
  removeItem: function(k) { delete _store[k]; },
};

load(__dirname + '/../js/lib/social-ledger.js');

var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

SocialLedger.logEvent('relay_created', {
  connectionId: 'c1',
  contactId: 'p1',
  ackRequired: true,
  note: 'Intro',
});
SocialLedger.logEvent('relay_confirmed', {
  connectionId: 'c1',
  contactId: 'p1',
  confirmed: true,
});
SocialLedger.resolvePendingForConnection('c1');

var entries = SocialLedger.entriesForContact('p1', [
  { id: 'c1', record_type: 'connection', linkedContactId: 'p1' },
]);
assert('contact entries', entries.length >= 2);
assert('pending after confirm', SocialLedger.pendingForContact('p1', []) === 0);

SocialLedger.logEvent('relay_received', {
  connectionId: 'c2',
  contactId: 'p2',
  ackRequired: true,
});
assert('pending open', SocialLedger.pendingForContact('p2', []) === 1);

var html = SocialLedger.renderTrailHtml(entries, { max: 5 });
assert('trail html', html.indexOf('sl-trail-row') >= 0);

var sum = SocialLedger.summaryForContact('p1', []);
assert('summary total', sum.total >= 2);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
