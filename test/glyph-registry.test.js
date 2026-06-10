'use strict';

var fs = require('fs');

function load(path) {
  new Function('window', 'global', fs.readFileSync(path, 'utf8'))(global, global);
}

var _store = {};
global.localStorage = {
  getItem: function(k) { return _store[k] != null ? _store[k] : null; },
  setItem: function(k, v) { _store[k] = String(v); },
  removeItem: function(k) { delete _store[k]; },
};

load(__dirname + '/../js/lib/glyph-registry.js');
load(__dirname + '/../js/lib/ui-phase.js');
load(__dirname + '/../js/lib/glyph-card.js');

var pass = 0, fail = 0;

function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

assert('need glyph', GlyphRegistry.recordGlyph({ record_type: 'need' }) === '\u25c9');
assert('invoice glyph', GlyphRegistry.recordGlyph({ record_type: 'invoice' }) === '\u25fc');
assert('chain FIRST', GlyphRegistry.chainModeGlyph('FIRST') === '\u22b3');
assert('infer CLOSING', GlyphRegistry.inferChainMode({ chainComplete: true }) === 'CLOSING');

var card = GlyphCard.renderViewCard({ record_type: 'offer', job: 'Test' });
assert('card off by default', card === '');

localStorage.setItem('wp_ui_phase_card_frame', '1');
assert('card on when flag', GlyphCard.renderViewCard({ record_type: 'offer', job: 'Test' }).indexOf('wp-card') >= 0);
localStorage.removeItem('wp_ui_phase_card_frame');

assert('list prefix off', GlyphCard.listPrefix({ record_type: 'need' }) === '');
localStorage.setItem('wp_ui_phase_list_glyphs', '1');
assert('list prefix on', GlyphCard.listPrefix({ record_type: 'need', _openObligation: true }).indexOf('\u25c9') >= 0);
localStorage.removeItem('wp_ui_phase_list_glyphs');

assert('export json v1', GlyphRegistry.exportJson().version === 1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
