// RecordTemplateService — My Templates (record templates: personal or imported)
// Not TemplateRegistry (presentation templates). Storage: wp_rtpl_*
// personal: created on device (no receivedAt)
// pending: receivedAt set, importedAt not set — awaiting deliberate import
// imported: importedAt set (adopted external template)
// Exposes: window.RecordTemplateService (synchronous, localStorage)

(function(global) {
  'use strict';

  var PREFIX = 'wp_rtpl_';

  // Fields that can be pre-filled by a template
  var TEMPLATE_FIELDS = [
    'record_type', 'record_class',
    'customer', 'customer_phone', 'worker',
    'location', 'meeting_time', 'start_time', 'end_time',
    'vat', 'custom_tax_rate', 'currency',
    'service_ref', 'expiry_date',
    'qty_unit', 'tag', 'context_label', 'url',
    'details', 'story',
    'compound_lines', 'participants',
    'activityId',
  ];

  function genId() {
    return 'rtpl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function _key(id) { return PREFIX + id; }

  function list() {
    var results = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        try { results.push(JSON.parse(localStorage.getItem(k))); } catch (_) {}
      }
    }
    results.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
    return results;
  }

  function get(id) {
    var raw = localStorage.getItem(_key(id));
    return raw ? JSON.parse(raw) : null;
  }

  function create(fields) {
    var id  = genId();
    var now = Date.now();
    var tpl = { id: id, name: '', description: '', createdAt: now, updatedAt: now };
    for (var k in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, k)) tpl[k] = fields[k];
    }
    tpl.id = id;
    localStorage.setItem(_key(id), JSON.stringify(tpl));
    return tpl;
  }

  function update(id, fields) {
    var tpl = get(id);
    if (!tpl) return null;
    for (var k in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, k)) tpl[k] = fields[k];
    }
    tpl.updatedAt = Date.now();
    localStorage.setItem(_key(id), JSON.stringify(tpl));
    return tpl;
  }

  function remove(id) {
    localStorage.removeItem(_key(id));
  }

  function isPersonal(tpl) {
    return !!(tpl && !tpl.receivedAt);
  }

  function isImported(tpl) {
    return !!(tpl && tpl.importedAt);
  }

  function isPendingImport(tpl) {
    return !!(tpl && tpl.receivedAt && !tpl.importedAt);
  }

  function listPersonal() {
    return list().filter(isPersonal);
  }

  function listImported() {
    return list().filter(isImported);
  }

  function listPendingImport() {
    return list().filter(isPendingImport);
  }

  // External record template landed in storage — not adopted until importTemplate().
  function receiveExternal(fields) {
    var now = Date.now();
    var extra = { receivedAt: now };
    var k;
    for (k in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, k)) extra[k] = fields[k];
    }
    return create(extra);
  }

  function importTemplate(id) {
    var tpl = get(id);
    if (!tpl) return null;
    tpl.importedAt = Date.now();
    tpl.updatedAt = tpl.importedAt;
    localStorage.setItem(_key(id), JSON.stringify(tpl));
    return tpl;
  }

  // Return a plain record object pre-filled from template (no id/chainRef/dates — caller stamps those)
  function buildRecord(id) {
    var tpl = get(id);
    if (!tpl) return {};
    var rec = {};
    for (var i = 0; i < TEMPLATE_FIELDS.length; i++) {
      var f = TEMPLATE_FIELDS[i];
      if (tpl[f] !== undefined && tpl[f] !== null && tpl[f] !== '') {
        rec[f] = tpl[f];
      }
    }
    return rec;
  }

  // Build a template snapshot from an existing record (strips runtime/storage fields)
  function fromRecord(rec, name) {
    var fields = { name: name || (rec.job || 'Template') };
    for (var i = 0; i < TEMPLATE_FIELDS.length; i++) {
      var f = TEMPLATE_FIELDS[i];
      if (rec[f] !== undefined && rec[f] !== null && rec[f] !== '') {
        fields[f] = rec[f];
      }
    }
    return create(fields);
  }

  global.RecordTemplateService = {
    TEMPLATE_FIELDS:     TEMPLATE_FIELDS,
    list:                list,
    listPersonal:        listPersonal,
    listImported:        listImported,
    listPendingImport:   listPendingImport,
    get:                 get,
    create:              create,
    update:              update,
    remove:              remove,
    buildRecord:         buildRecord,
    fromRecord:          fromRecord,
    receiveExternal:     receiveExternal,
    importTemplate:      importTemplate,
    isPersonal:          isPersonal,
    isImported:          isImported,
    isPendingImport:     isPendingImport,
  };

}(window));
