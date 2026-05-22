// GlobalSynonymsService — app-wide field label overrides
// Resolution: template.fieldSynonyms[key] > global[key] > canonical label
// Exposes: window.GlobalSynonymsService

(function(global) {
  'use strict';

  var KEY = 'wp_global_synonyms';

  var CANONICAL = {
    job:            'Outcome',
    description:    'Description',
    customer:       'Customer',
    customer_phone: 'Customer phone',
    worker:         'Worker',
    worker_amount:  'Internal cost',
    due_date:       'Due date',
    tag:            'Tag',
    context_label:  'Context',
    location:       'Location',
    meeting_time:   'Meeting time',
    start_time:     'Start time',
    end_time:       'End time',
    url:            'URL',
    attachment:     'Attachment',
    vat:            'VAT',
    service_ref:    'Service ref',
    expiry_date:    'Expiry date',
    story:          'Notes',
    details:        'Details',
    qty_unit:       'Unit',
    currency:       'Currency',
    participants:   'Participants',
    compound_lines: 'Line items',
  };

  var SYNONYMABLE = [
    'job','customer','customer_phone','worker','worker_amount',
    'due_date','tag','context_label','location','meeting_time',
    'start_time','end_time','url','attachment',
    'vat','service_ref','expiry_date','story','details','qty_unit',
  ];

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; }
  }

  function setAll(map) {
    localStorage.setItem(KEY, JSON.stringify(map));
  }

  function setOne(fieldKey, synonym) {
    var map = getAll();
    if (synonym) map[fieldKey] = synonym; else delete map[fieldKey];
    setAll(map);
  }

  // Three-level resolution: template override → global → canonical
  function resolve(fieldKey, tplSynonyms) {
    if (tplSynonyms && tplSynonyms[fieldKey]) return tplSynonyms[fieldKey];
    var g = getAll();
    if (g[fieldKey]) return g[fieldKey];
    return CANONICAL[fieldKey] || fieldKey;
  }

  function canonicalLabel(fieldKey) {
    return CANONICAL[fieldKey] || fieldKey;
  }

  global.GlobalSynonymsService = {
    CANONICAL:   CANONICAL,
    SYNONYMABLE: SYNONYMABLE,
    getAll:      getAll,
    setAll:      setAll,
    setOne:      setOne,
    resolve:     resolve,
    canonicalLabel: canonicalLabel,
  };

}(window));
