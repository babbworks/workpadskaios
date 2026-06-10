'use strict';

var fs = require('fs');

function load(path) {
  new Function('window', 'global', fs.readFileSync(path, 'utf8'))(global, global);
}

global.esc = function(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;');
};
global.WPChainExecution = {
  hasAckForTarget: function() { return false; },
};

load(__dirname + '/../js/lib/noc-gatekeeper.js');

var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var rec = {
  record_type: 'connection',
  receivedAt: Date.now(),
  informational_ack: true,
  id: 'c1',
};
assert('needs receive', WPNocGatekeeper.needsGatekeeperReceive(rec, []));
assert('light ack defaults', WPNocGatekeeper.defaultsForGateType('light_ack').informational_ack === true);
assert('relay note off', WPNocGatekeeper.defaultsForGateType('relay_note').informational_ack === false);

var p = {};
WPNocGatekeeper.applyPolicyToRecord(p, 'sale_confirmed');
assert('sale type', p.gatekeeper_type === 'sale_confirmed');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
