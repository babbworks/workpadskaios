'use strict';

var fs = require('fs');
var http = require('http');
var vm = require('vm');

function fetch(path) {
  return new Promise(function(resolve, reject) {
    http.get('http://127.0.0.1:3000' + path, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { resolve(d); });
    }).on('error', reject);
  });
}

function makeDom(html) {
  var store = {};
  var els = {};
  html.replace(/id="([^"]+)"/g, function(_, id) {
    els[id] = {
      id: id,
      classList: { _c: new Set(), toggle: function(k, on) {
        if (on) this._c.add(k); else this._c.delete(k);
      }, contains: function(k) { return this._c.has(k); },
      add: function(k) { this._c.add(k); },
      remove: function(k) { this._c.delete(k); } },
      style: {},
      innerHTML: '',
      addEventListener: function() {},
      removeEventListener: function() {},
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      appendChild: function() {},
      setAttribute: function() {},
      removeAttribute: function() {},
      focus: function() {},
      click: function() {},
      getAttribute: function() { return null; },
      closest: function() { return null; },
    };
    return '';
  });
  function getElementById(id) {
    return els[id] || null;
  }
  var document = {
    getElementById: getElementById,
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    createElement: function() {
      return { id: '', rel: '', href: '', disabled: false, setAttribute: function() {}, removeAttribute: function() {} };
    },
    addEventListener: function() {},
    body: { classList: { add: function() {}, remove: function() {} }, insertAdjacentHTML: function() {} },
    head: { appendChild: function() {} },
  };
  var localStorage = {
    getItem: function(k) { return store[k] != null ? store[k] : null; },
    setItem: function(k, v) { store[k] = String(v); },
    removeItem: function(k) { delete store[k]; },
  };
  return { document: document, localStorage: localStorage, window: {}, els: els };
}

async function main() {
  var html = await fetch('/');
  var scripts = [];
  var re = /<script src="([^"]+)"/g;
  var m;
  while ((m = re.exec(html))) scripts.push(m[1]);

  var dom = makeDom(html);
  var w = dom.window;
  w.document = dom.document;
  w.localStorage = dom.localStorage;
  w.window = w;
  w.location = { hash: '', search: '', pathname: '/' };
  w.history = { replaceState: function() {} };
  w.confirm = function() { return false; };
  w.alert = function() {};
  w.setTimeout = setTimeout;
  w.clearTimeout = clearTimeout;

  var from = scripts.indexOf('js/screens/list.js');
  var tail = scripts.slice(from);
  var fail = null;
  for (var i = 0; i < tail.length; i++) {
    var src = tail[i];
    try {
      var code = await fetch('/' + src);
      vm.runInNewContext(code, w, { filename: src });
      console.log('  ok', src, 'App=' + !!w.App);
    } catch (e) {
      console.log('  FAIL', src, e.message);
      fail = { src: src, err: e.message };
      break;
    }
  }
  if (fail) process.exit(1);
  if (!w.App) {
    console.log('  FAIL app loaded but no App');
    process.exit(1);
  }
  console.log('boot-load: all scripts through app.js');
}

main().catch(function(e) {
  console.error(e);
  process.exit(1);
});
