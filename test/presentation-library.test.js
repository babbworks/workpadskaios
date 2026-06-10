'use strict';

var fs = require('fs');
var path = require('path');

var global = {};
var _store = {};
var localStorage = {
  getItem: function(k) { return _store[k] != null ? _store[k] : null; },
  setItem: function(k, v) { _store[k] = String(v); },
  removeItem: function(k) { delete _store[k]; },
  key: function(i) {
    var keys = Object.keys(_store);
    return i < keys.length ? keys[i] : null;
  },
  get length() { return Object.keys(_store).length; },
};
global.localStorage = localStorage;
global.window = global;
global.btoa = function(s) { return Buffer.from(s, 'utf8').toString('base64'); };
global.atob = function(s) { return Buffer.from(s, 'base64').toString('utf8'); };
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.fflate = require(path.join(__dirname, '../js/lib/fflate.js'));
global.esc = function(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

function load(rel) {
  new Function('window', 'global', 'localStorage', fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'))(
    global, global, localStorage);
}

load('js/TemplateRegistry.js');
load('js/lib/presentation-starters.js');
load('js/lib/presentation-library.js');

var Lib = global.WPPresentationLibrary;
var TR = global.TemplateRegistry;

var pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var boot = Lib.ensureBundled();
assert('ensureBundled ok', boot.ok && boot.total === 4);
assert('installs starters', boot.installed >= 4 || boot.skipped >= 4);

var cat = Lib.starterCatalog();
assert('catalog length', cat.length === 4);
assert('stall installed', cat.some(function(c) { return c.uri.indexOf('stall') !== -1 && c.installed; }));

var notes = Lib.noteTemplates();
assert('note templates includes stall', notes.some(function(e) { return e.uri.indexOf('stall') !== -1; }));

var html = Lib.previewHtml('urn:workpads:tpl:starter:rocket:v1');
assert('preview html', html.indexOf('wpt-rocket') !== -1);

Lib.removeStarter('urn:workpads:tpl:starter:rocket:v1');
assert('removed rocket', !TR.getEntry('urn:workpads:tpl:starter:rocket:v1'));
Lib.installStarter('urn:workpads:tpl:starter:rocket:v1');
assert('reinstalled rocket', !!TR.getEntry('urn:workpads:tpl:starter:rocket:v1'));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
