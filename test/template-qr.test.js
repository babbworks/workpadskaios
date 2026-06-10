'use strict';

var fs = require('fs');

function load(path) {
  new Function('window', fs.readFileSync(path, 'utf8'))(global);
}

global.esc = function(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

load(__dirname + '/../js/lib/template-qr.js');

var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

assert('candidate with displaySchema', WPTemplateQr.isCandidate({ displaySchema: { displayType: 1 } }));
assert('default tag 1dt', WPTemplateQr.defaultShareTag({ is_template: true }) === '1dt');
assert('default tag 1pv', WPTemplateQr.defaultShareTag({ job: 'x' }) === '1pv');
assert('min display billboard', WPTemplateQr.minDisplayTypeForTag('1dt', 0) === 1);
assert('fields for rtpl', WPTemplateQr.fieldsForRtpl({ job: 'Job', customer: 'A' }).customer === 'A');
assert('preview html', WPTemplateQr.renderPreviewHtml({ job: 'J' }, 1).indexOf('Billboard') !== -1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
