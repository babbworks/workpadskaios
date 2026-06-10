'use strict';

var window = {};
new Function('window', require('fs').readFileSync(__dirname + '/../js/lib/nfc-handoff.js', 'utf8'))(window);

var N = window.WPNfcHandoff;
var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

assert('scenarios defined', N.SCENARIOS.INVOICE_HANDOFF === 'invoice_handoff');
assert('fullUrl hash', N.fullUrl('workpads.me/p#1pv/abc').indexOf('#1pv/') > 0);
assert('fullUrl https', N.fullUrl('https://workpads.me/p#1pa/x').indexOf('https://') === 0);
assert('scenarioLabel ack', N.scenarioLabel(N.SCENARIOS.ACK_RETURN).indexOf('ack') >= 0);
assert('hashFromIncoming', N.hashFromIncoming('https://workpads.me/p#1pv/xyz') === '1pv/xyz');
assert('scenarioForRecord ack', N.scenarioForRecord({ record_type: 'ack', ackForId: 'x' }) === N.SCENARIOS.ACK_RETURN);
assert('scenarioForRecord pos', N.scenarioForRecord({ record_type: 'invoice' }) === N.SCENARIOS.POS_CONFIRM);
assert('uri payload prefix', N.uriNdefPayload('https://workpads.me/p#1pv/a')[0] === 0x04);
assert('decode uri', N.decodeUriPayload(N.uriNdefPayload('https://example.com/x')).indexOf('https://') === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
