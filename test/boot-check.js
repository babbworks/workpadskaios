#!/usr/bin/env node
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
global.window = global;
var window = global;
window.localStorage = {
  _d: {},
  getItem: function(k) { return this._d[k] != null ? this._d[k] : null; },
  setItem: function(k, v) { this._d[k] = String(v); },
  removeItem: function(k) { delete this._d[k]; },
  key: function(i) { return Object.keys(this._d)[i] || null; },
  get length() { return Object.keys(this._d).length;   },
  clear: function() { this._d = {}; },
};
window.document = {
  _els: {},
  getElementById: function(id) {
    if (!window.document._els[id]) {
      window.document._els[id] = {
        id: id,
        innerHTML: '',
        className: '',
        classList: {
          _c: [],
          add: function(x) { this._c.push(x); },
          remove: function(x) { var i = this._c.indexOf(x); if (i >= 0) this._c.splice(i, 1); },
          toggle: function(x, on) { if (on) this.add(x); else this.remove(x); },
        },
        style: {},
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; },
        addEventListener: function() {},
      };
    }
    return window.document._els[id];
  },
  body: { classList: { add: function() {}, remove: function() {} } },
  createElement: function() { return { style: {}, appendChild: function() {}, addEventListener: function() {}, click: function() {} }; },
  addEventListener: function() {},
  querySelectorAll: function() { return []; },
};
window.location = { hash: '', pathname: '/index.html', search: '' };
window.history = { replaceState: function() {} };
// navigator already exists on global
window.URL = { createObjectURL: function() { return 'blob:x'; } };
window.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };
window.btoa = function(s) { return Buffer.from(s, 'binary').toString('base64'); };
window.Promise = Promise;

var ctx = vm.createContext(global);

function load(rel) {
  var p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error('missing ' + rel);
  vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
}

var ids = [
  'screen-onboarding', 'screen-country', 'screen-help', 'screen-home', 'screen-user-switcher',
  'screen-list', 'list-content', 'screen-wizard', 'screen-view', 'screen-financial',
  'screen-finance-overview', 'screen-note-share', 'screen-share', 'screen-management',
  'screen-ledger', 'screen-liabilities', 'screen-newent-wizard', 'screen-archive',
  'screen-template-creator', 'screen-timeline', 'screen-tasks', 'screen-calendar-wp',
  'screen-chain', 'screen-dispute', 'panel-workpads', 'panel-workpads-content',
  'panel-personal', 'panel-personal-content', 'panel-backdrop',
  'overlay-quicknote', 'overlay-shortcuts', 'overlay-receive-pp', 'overlay-receive-note',
  'onboard-name', 'list-crumb', 'list-crumb-label', 'list-crumb-back',
];
ids.forEach(function(id) { window.document.getElementById(id); });

try {
  ['js/lib/CurrencyUtil.js', 'js/lib/utils.js', 'js/lib/ui-fields.js', 'js/lib/countries.js',
   'js/lib/fflate.js', 'js/lib/crypto.js', 'js/lib/security.js', 'js/lib/codec.js',
   'js/lib/anon.js', 'js/lib/trig.js', 'js/lib/ctrig.js', 'js/lib/markers.js',
   'js/lib/agreements.js', 'js/lib/roles.js', 'js/lib/attachment-store.js', 'js/lib/script-loader.js',
   'js/lib/ui-phase.js', 'js/lib/sale-catalogue.js', 'js/lib/nav-stack.js', 'js/lib/filter-sheet.js',
   'js/TemplateRegistry.js', 'js/NoteCodec.js', 'js/StorageAdapter.js', 'js/ActivityService.js',
   'js/WorkActivityService.js', 'js/RecordService.js', 'js/FinancialModel.js', 'js/PersonalService.js',
   'js/BlockRegistry.js', 'js/RecordTemplateService.js', 'js/GlobalSynonymsService.js',
  ].forEach(load);

  ['js/screens/sale-tally.js', 'js/screens/io-create.js',
   'js/screens/help.js', 'js/screens/home.js', 'js/screens/user-switcher.js',
   'js/screens/timeline.js', 'js/screens/tasks.js', 'js/screens/calendar-wp.js',
   'js/screens/list.js', 'js/screens/wizard.js', 'js/screens/view.js', 'js/screens/share.js',
   'js/screens/note-share.js', 'js/screens/template-creator.js', 'js/screens/management.js',
   'js/NewEntTemplate.js', 'js/screens/newent-wizard.js', 'js/screens/ledger.js',
   'js/screens/liabilities.js', 'js/screens/financial.js', 'js/screens/finance-overview.js',
   'js/screens/country.js', 'js/screens/archive.js', 'js/screens/chain.js', 'js/screens/dispute.js',
  ].forEach(load);

  load('js/panels/workpads-panel-shared.js');
  load('js/panels/workpads-panel-browse.js');
  load('js/panels/workpads-panel-contact.js');
  load('js/panels/workpads-panel-record.js');
  load('js/panels/WorkpadsPanel.js');
  load('js/panels/PersonalPanel.js');
  load('js/app.js');

  console.log('WorkpadsPanel:', typeof window.WorkpadsPanel);
  console.log('App:', typeof window.App);
  console.log('list-content len:', window.document.getElementById('list-content').innerHTML.length);
} catch (e) {
  console.error('BOOT FAIL:', e.stack || e);
  process.exit(1);
}
