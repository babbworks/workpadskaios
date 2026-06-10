'use strict';

var fs = require('fs');

function load(path) {
  new Function('window', fs.readFileSync(path, 'utf8'))(global);
}

global.esc = function(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

load(__dirname + '/../js/lib/programmable-rules.js');
load(__dirname + '/../js/lib/programmable-compose.js');

var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var ed = WPProgrammableCompose.getEditor('test');
ed.rules = [];
ed.draftOp = 'when_paid';
var rule = ed._draftToRule();
assert('draft when_paid', rule && rule.op_name === 'when_paid');

ed.draftOp = 'when_confirmed';
ed.draftMask = 3;
rule = ed._draftToRule();
assert('draft mask', rule && rule.mask === 3);

var rec = { job: 'T', programmable_rules: [{ op: 'when_paid' }] };
ed.load(rec);
ed.syncToRecord(rec);
assert('sync keeps rules', rec.programmable_rules && rec.programmable_rules.length === 1);

var html = ed.renderHtml(rec, 't-prog');
assert('render section', html.indexOf('Obligations') !== -1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
