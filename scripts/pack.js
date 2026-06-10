#!/usr/bin/env node
'use strict';

var fs      = require('fs');
var path    = require('path');
var child   = require('child_process');

var ROOT    = path.resolve(__dirname, '..');
var pkg     = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
var VERSION = pkg.version;
var OUT     = path.join(ROOT, 'workpads-' + VERSION + '.zip');

var EXCLUDE_JS = {
  'js/lib/demo.js': true,
  'js/lib/browser-dev.js': true,
};

function walkJsFiles(dir, base, out) {
  var entries = fs.readdirSync(dir);
  for (var i = 0; i < entries.length; i++) {
    var name = entries[i];
    var full = path.join(dir, name);
    var rel  = base ? (base + '/' + name) : name;
    if (fs.statSync(full).isDirectory()) {
      walkJsFiles(full, rel, out);
    } else if (name.slice(-3) === '.js' && !EXCLUDE_JS[rel]) {
      out.push(rel);
    }
  }
}

if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

var jsFiles = [];
walkJsFiles(path.join(ROOT, 'js'), 'js', jsFiles);

var staging = path.join(ROOT, '.pack-staging');
if (fs.existsSync(staging)) {
  child.spawnSync('rm', ['-rf', staging], { stdio: 'inherit' });
}
fs.mkdirSync(staging, { recursive: true });

var COPY_TOP = ['index.html', 'homescreen.html', 'manifest.webmanifest', 'css', 'img'];
for (var c = 0; c < COPY_TOP.length; c++) {
  var item = COPY_TOP[c];
  var src = path.join(ROOT, item);
  var dst = path.join(staging, item);
  if (!fs.existsSync(src)) continue;
  if (fs.statSync(src).isDirectory()) {
    child.spawnSync('cp', ['-R', src, dst], { stdio: 'inherit' });
  } else {
    fs.copyFileSync(src, dst);
  }
}

fs.mkdirSync(path.join(staging, 'js'), { recursive: true });
fs.mkdirSync(path.join(staging, 'js/lib'), { recursive: true });
fs.mkdirSync(path.join(staging, 'js/screens'), { recursive: true });
fs.mkdirSync(path.join(staging, 'js/panels'), { recursive: true });

for (var j = 0; j < jsFiles.length; j++) {
  var jf = jsFiles[j];
  var jsrc = path.join(ROOT, jf);
  var jdst = path.join(staging, jf);
  fs.mkdirSync(path.dirname(jdst), { recursive: true });
  fs.copyFileSync(jsrc, jdst);
}

var zipArgs = ['-r', OUT, '.'];
var result = child.spawnSync('zip', zipArgs, { cwd: staging, stdio: 'inherit' });
child.spawnSync('rm', ['-rf', staging], { stdio: 'inherit' });

if (result.status !== 0) {
  process.stderr.write('pack failed\n');
  process.exit(1);
}

var size = (fs.statSync(OUT).size / 1024).toFixed(1);
process.stdout.write('packed: ' + path.basename(OUT) + ' (' + size + ' KB, excludes demo.js + browser-dev.js)\n');
