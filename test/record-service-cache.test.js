// record-service-cache.test.js — RecordService list cache + template receive (Node)
'use strict';

var fs = require('fs');
var path = require('path');

var pass = 0, fail = 0;
function assert(label, cond, extra) {
  if (cond) { pass++; console.log('  [PASS]  ' + label); }
  else { fail++; console.log('  [FAIL]  ' + label + (extra ? ' — ' + extra : '')); }
}

function loadIntoWindow(relPath) {
  var src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
  (new Function('global', src + '\n//# sourceURL=' + relPath))(global);
}

function makeLocalStorage() {
  var data = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function(k, v) { data[k] = String(v); },
    removeItem: function(k) { delete data[k]; },
    key: function(i) {
      var keys = Object.keys(data);
      return i < keys.length ? keys[i] : null;
    },
    get length() { return Object.keys(data).length; },
    clear: function() { data = {}; },
  };
}

global.localStorage = makeLocalStorage();
global.window = global;
global.merge = function(target) {
  for (var i = 1; i < arguments.length; i++) {
    var src = arguments[i];
    if (!src) continue;
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
  }
  return target;
};
global.ActivityService = {
  getSenderIdentity: function() { return { name: 'Test Worker' }; },
  getLocale: function() { return { currency: 'GBP' }; },
};

loadIntoWindow('js/lib/utils.js');
loadIntoWindow('js/StorageAdapter.js');

var listCalls = 0;
var _origList = global.StorageAdapter.prototype.list;
global.StorageAdapter.prototype.list = function() {
  listCalls++;
  return _origList.apply(this, arguments);
};

loadIntoWindow('js/RecordService.js');
var RecordService = global.RecordService;

function parseRtplPayload(hashBody) {
  var h = hashBody.indexOf('#') >= 0 ? hashBody.split('#').pop() : hashBody;
  if (h.slice(0, 5) !== 'rtpl/') return null;
  var b64 = h.slice(5).replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

console.log('\nRecordService.list cache');
listCalls = 0;
global.localStorage.clear();

RecordService.create({ job: 'Cache test A' })
  .then(function() {
    return RecordService.list();
  })
  .then(function(rows) {
    assert('first list returns one record', rows.length === 1, 'len=' + rows.length);
    assert('first list hits storage', listCalls === 1, 'calls=' + listCalls);
    return RecordService.list();
  })
  .then(function(rows) {
    assert('second list uses cache', listCalls === 1, 'calls=' + listCalls);
    assert('cached job unchanged', rows[0].job === 'Cache test A', rows[0].job);
    var id = rows[0].id;
    return RecordService.update(id, { job: 'Cache test B' }).then(function() { return id; });
  })
  .then(function(id) {
    assert('update does not list until next read', listCalls === 1, 'calls=' + listCalls);
    return RecordService.list().then(function(rows) { return { id: id, rows: rows }; });
  })
  .then(function(o) {
    assert('list after update reloads storage', listCalls === 2, 'calls=' + listCalls);
    assert('list after update sees new job', o.rows[0].job === 'Cache test B', o.rows[0].job);
    RecordService.invalidateList();
    return RecordService.list().then(function(rows) { return { id: o.id, rows: rows }; });
  })
  .then(function(o) {
    assert('invalidateList forces storage read', listCalls === 3, 'calls=' + listCalls);
    return RecordService.listChildren(o.id);
  })
  .then(function(children) {
    assert('listChildren uses warm cache', listCalls === 3, 'calls=' + listCalls);
    assert('no children yet', children.length === 0, 'len=' + children.length);
  })
  .then(function() {
    console.log('\n#rtpl/ receive (RecordTemplateService)');
    global.localStorage.clear();
    loadIntoWindow('js/RecordTemplateService.js');
    loadIntoWindow('js/lib/template-receive.js');
    var RTS = global.RecordTemplateService;
    var Recv = global.WPTemplateReceive;

    var fields = { name: 'Shared boiler tpl', record_type: 'service', job: 'Boiler check' };
    var hash = Recv.encodeRtplHash(fields);
    var parsed = Recv.parseRtplFields(hash);
    assert('rtpl hash parses to fields', parsed && parsed.name === 'Shared boiler tpl', '');
    var recv = Recv.receiveFromHash(hash);
    var tpl = recv.tpl;
    assert('receiveExternal sets receivedAt', !!(tpl && tpl.receivedAt), '');
    assert('pending import', RTS.isPendingImport(tpl), '');
    assert('listPendingImport includes tpl', RTS.listPendingImport().some(function(t) { return t.id === tpl.id; }), '');

    console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
    process.exit(fail ? 1 : 0);
  })
  .catch(function(err) {
    console.error(err);
    process.exit(1);
  });
