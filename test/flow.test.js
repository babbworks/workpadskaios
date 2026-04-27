// Integration test: full record flow
// create → validate → encode → decode → round-trip fidelity
// Uses @workpads/codec (Node.js) — same algorithm as browser codec.js
// Run: node test/flow.test.js

'use strict';

var codec = require('../node_modules/@workpads/codec');

var pass = 0;
var fail = 0;

function assert(label, condition, extra) {
  if (condition) {
    console.log('  [PASS]  ' + label);
    pass++;
  } else {
    console.log('  [FAIL]  ' + label + (extra ? ' — ' + extra : ''));
    fail++;
  }
}

function roundTrip(record) {
  var url = codec.encode(record);
  var dec = codec.decode(url);
  return { url: url, decoded: dec };
}

// ── Validate ───────────────────────────────────────────────────────────────────
console.log('\nvalidate');
(function() {
  var r1 = codec.validate({});
  assert('empty record invalid',         !r1.valid);
  assert('empty record: job error',      r1.errors.some(function(e) { return e.includes('job'); }));

  var r2 = codec.validate({ job: 'Fix boiler' });
  assert('job-only record valid',        r2.valid);

  var r3 = codec.validate({ job: 'X'.repeat(200) });
  assert('oversized job invalid',        !r3.valid);

  var r4 = codec.validate({ job: 'Test', actions: 'not-array' });
  assert('non-array actions invalid',    !r4.valid);
})();

// ── Minimal record ─────────────────────────────────────────────────────────────
console.log('\nminimal record (job only)');
(function() {
  var rec = { job: 'Fix boiler' };
  var result = roundTrip(rec);

  assert('encodes to string',            typeof result.url === 'string');
  assert('URL contains workpads.me/p#',  result.url.includes('workpads.me/p#'));
  assert('URL contains alg=bitpad-v1',   result.url.includes('alg=bitpad-v1'));
  assert('job round-trips',              result.decoded.job === rec.job);
  assert('URL under 200 chars',          result.url.length < 200, result.url.length + ' chars');
})();

// ── Full svc-basic v2 record ───────────────────────────────────────────────────
console.log('\nfull svc-basic v2 record');
(function() {
  var rec = {
    job:            'Annual boiler service',
    customer:       'Alice Smith',
    date:           '2026-04-27',
    location:       'Client warehouse, 123 High St',
    customer_phone: '+44 7700 900123',
    start_time:     '09:00',
    end_time:       '11:30',
    worker:         'Bob Field',
    details:        'Pressure checked, filters replaced, no issues found.',
    story:          'Routine annual service completed on schedule.',
  };

  var result = roundTrip(rec);

  assert('encodes without error',        !!result.url);
  Object.keys(rec).forEach(function(field) {
    assert('field round-trips: ' + field, result.decoded[field] === rec[field]);
  });
  assert('URL under 600 chars',          result.url.length < 600, result.url.length + ' chars');
})();

// ── Record with actions ────────────────────────────────────────────────────────
console.log('\nrecord with actions');
(function() {
  var rec = {
    job:     'Flat roof repair',
    date:    '2026-04-27',
    actions: [
      { title: 'Inspect existing membrane', notes: 'Found 3 splits near edge' },
      { title: 'Apply patch compound',       notes: '' },
      { title: 'Test water drainage',        notes: 'Passed' },
    ],
  };

  var result = roundTrip(rec);

  assert('encodes with actions',             !!result.url);
  assert('actions array present',            Array.isArray(result.decoded.actions));
  assert('action count correct',             result.decoded.actions.length === 3);
  assert('action[0] title round-trips',      result.decoded.actions[0].title === rec.actions[0].title);
  assert('action[0] notes round-trips',      result.decoded.actions[0].notes === rec.actions[0].notes);
  assert('action[2] notes round-trips',      result.decoded.actions[2].notes === rec.actions[2].notes);
})();

// ── Non-ASCII / UTF-8 ─────────────────────────────────────────────────────────
console.log('\nUTF-8 field values');
(function() {
  var rec = {
    job:      'Réparation chaudière',
    customer: 'Björn Åkesson',
    details:  'Travail effectué correctement — système OK.',
  };

  var result = roundTrip(rec);

  assert('UTF-8 job round-trips',      result.decoded.job      === rec.job);
  assert('UTF-8 customer round-trips', result.decoded.customer === rec.customer);
  assert('UTF-8 details round-trips',  result.decoded.details  === rec.details);
})();

// ── URL format ────────────────────────────────────────────────────────────────
console.log('\nURL format');
(function() {
  var url = codec.encode({ job: 'Test job', worker: 'Alice' });
  var fullUrl = 'https://' + url;

  // Simulate what the share screen displays
  assert('can prepend https://',        fullUrl.startsWith('https://workpads.me/p#'));

  // Simulate what checkIncomingUrl does: extract hash
  var hash = fullUrl.slice(fullUrl.indexOf('#') + 1);
  assert('hash contains d= param',      hash.includes('d='));

  // Decode from hash directly (as browser would)
  var dec = codec.decode(hash);
  assert('decode from hash fragment',   dec.job === 'Test job');
  assert('worker preserved via hash',   dec.worker === 'Alice');
})();

// ── Received record simulation ────────────────────────────────────────────────
console.log('\nreceived record simulation');
(function() {
  // Sender creates and encodes
  var sent = { job: 'Emergency callout', customer: 'Dave Jones', date: '2026-04-27', worker: 'Carol Field' };
  var url = codec.encode(sent);

  // Receiver decodes
  var received = codec.decode(url);

  assert('received job matches',      received.job      === sent.job);
  assert('received customer matches', received.customer === sent.customer);
  assert('received worker matches',   received.worker   === sent.worker);
  assert('received date matches',     received.date     === sent.date);
})();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + (pass + fail) + ' tests: ' + pass + ' pass  ' + fail + ' fail');
process.exit(fail > 0 ? 1 : 0);
