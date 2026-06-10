#!/usr/bin/env node
'use strict';
/**
 * Merge research/card-screen-types/workpads-ui.css → css/workpads-ui-v2-struct.css
 * (scoped under html[data-ui-theme="v2"]). Run after research token changes.
 * Keeps workpads-ui-v2.css Layer 1 bridge hand-edited; appends/updates Layer 2 bulk.
 *
 * Usage: node scripts/sync-ui-v2-css.js
 */

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var src = path.join(root, '../../research/card-screen-types/workpads-ui.css');
var out = path.join(root, 'css/workpads-ui-v2-struct.css');

if (!fs.existsSync(src)) {
  console.error('Research CSS not found:', src);
  process.exit(1);
}

var raw = fs.readFileSync(src, 'utf8');
var lines = raw.split('\n');
var outLines = [
  '/* AUTO-GENERATED — node scripts/sync-ui-v2-css.js — do not hand-edit */',
  '/* Import in workpads-ui-v2.css via @import if file exists */',
  '',
];

var skip = false;
for (var i = 0; i < lines.length; i++) {
  var line = lines[i];
  if (line.indexOf('VISUAL BRIEF') >= 0 || line.indexOf('ANCIENT TABLET') >= 0) {
    skip = true;
    continue;
  }
  if (skip && line.indexOf('════') >= 0 && line.indexOf('GLYPH CONFIGURATION') >= 0) {
    skip = false;
  }
  if (skip) continue;
  if (line.trim().indexOf(':root') === 0) continue;
  if (line.trim() === '* { box-sizing: border-box; margin: 0; padding: 0; }') continue;
  if (line.indexOf('body {') === 0 && line.indexOf('background: var(--page)') >= 0) continue;
  if (line.indexOf('.screen {') === 0 && line.indexOf('width: 240px') >= 0) continue;
  if (line.indexOf('.screen-wide') === 0) continue;
  if (line.indexOf('h1 {') === 0 || line.indexOf('.subtitle') === 0) continue;
  if (line.indexOf('.section-label') === 0 || line.indexOf('.row {') === 0) continue;

  if (!line.trim()) {
    outLines.push('');
    continue;
  }
  if (line.trim().startsWith('@') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
    outLines.push(line);
    continue;
  }
  outLines.push('html[data-ui-theme="v2"] ' + line);
}

fs.writeFileSync(out, outLines.join('\n') + '\n');
console.log('Wrote', out, '(' + outLines.length + ' lines)');
