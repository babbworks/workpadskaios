'use strict';

var fs = require('fs');

var global = {};
global.window = global;
global.btoa = function(s) { return Buffer.from(s, 'binary').toString('base64'); };
global.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };

function load(path) {
  new Function('window', 'global', fs.readFileSync(path, 'utf8'))(global, global);
}

load(__dirname + '/../js/lib/binary-qr.js');
var BQ = global.WPBinaryQr;

var pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var frag = '1pv/abc123payload';
var pkt = BQ.packFromHash(frag);
assert('pack magic', BQ.isBinaryPacket(pkt));
assert('round-trip unpack', BQ.unpackToHash(pkt) === frag);

var bq1 = BQ.encodeBq1Hash(frag);
assert('bq1 prefix', BQ.isBq1Hash(bq1));
assert('decode bq1', BQ.decodeBq1Hash(bq1) === frag);

assert('bad prefix null', BQ.packFromHash('rtpl/foo') === null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
