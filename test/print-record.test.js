'use strict';

var fs = require('fs');

var global = {};
global.window = global;

function load(path) {
  new Function('window', 'global', fs.readFileSync(path, 'utf8'))(global, global);
}

load(__dirname + '/../js/lib/print-record.js');
var PR = global.WPPrintRecord;

var pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var text = PR.formatText({
  job: 'Fence',
  record_type: 'invoice',
  amount: '50',
  currency: 'GBP',
  _programmablePlain: ['When paid'],
});
assert('header', text.indexOf('WORKPADS') >= 0);
assert('job line', text.indexOf('Fence') >= 0);
assert('obligations', text.indexOf('When paid') >= 0);
assert('options count', PR.options().length === 3);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
