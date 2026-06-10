'use strict';

var fs = require('fs');

var global = {};
global.window = global;

function load(path) {
  new Function('window', 'global', fs.readFileSync(path, 'utf8'))(global, global);
}

load(__dirname + '/../js/lib/programmable-rules.js');
load(__dirname + '/../js/lib/programmable-receive.js');

var Recv = global.WPProgrammableReceive;

var pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var rec = {
  id: 'r1',
  chainRef: 'chain-test-1',
  receivedAt: Date.now(),
  programmable_rules: [{ op: 'when_paid' }],
  _programmablePlain: ['When paid'],
};

var allPending = [rec];
var a0 = Recv.analyze(rec, allPending);
assert('analyze pending', a0 && a0.hasPending && a0.countPending === 1);
assert('banner waiting', a0.banner.indexOf('waiting') >= 0);

var allPaid = [rec, { record_type: 'payment', chainRef: 'chain-test-1' }];
var a1 = Recv.analyze(rec, allPaid);
assert('all fired after payment', a1 && a1.allFired && a1.countFired === 1);

var pill = Recv.listPill(rec, allPending);
assert('list pill wait', pill.indexOf('ls-pill-prog-wait') >= 0);
assert('done pill', Recv.listPill(rec, allPaid).indexOf('prog-done') >= 0);

var html = Recv.renderViewSection(rec, allPending);
assert('view section html', html.indexOf('Waiting') >= 0 && html.indexOf('view-pr-banner') >= 0);

assert('needsAction when_confirmed pending', Recv.needsActionFromRules({
  programmable_rules: [{ op: 'when_confirmed', mask: 1 }],
}, []) === true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
