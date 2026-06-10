// template-qr.js — #1dt/ template QR helpers (share + receive)
// Spec: dev_refs/TEMPLATE-QR-SPEC.md, PRODUCTION-LANES-LOCKED.md
(function(global) {
  'use strict';

  var DISPLAY_LABELS = ['Standard', 'Billboard', 'Form', 'Form+QR'];

  var RTPL_FIELDS = [
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

  function isCandidate(rec) {
    if (!rec) return false;
    return !!(rec.is_template || rec.template_id || rec.displaySchema || rec.display_schema);
  }

  function defaultShareTag(rec) {
    return isCandidate(rec) ? '1dt' : '1pv';
  }

  function displayLabel(ds) {
    if (!ds) return 'Standard';
    return DISPLAY_LABELS[ds.displayType != null ? ds.displayType : 0] || 'Standard';
  }

  function minDisplayTypeForTag(tag, current) {
    if (tag === '1dt' && (!current || current < 1)) return 1;
    return current != null ? current : 0;
  }

  function fieldsForRtpl(rec) {
    var out = {
      name: (rec.job || rec.pads_process || 'Imported template').slice(0, 48),
      description: 'From template QR',
    }, i, k, v;
    for (i = 0; i < RTPL_FIELDS.length; i++) {
      k = RTPL_FIELDS[i];
      v = rec[k];
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    }
    if (rec.actions && rec.actions.length) out.actions = rec.actions.slice();
    return out;
  }

  function renderPreviewHtml(rec, dsDisplayType) {
    if (!rec) return '';
    var lbl = DISPLAY_LABELS[dsDisplayType != null ? dsDisplayType : 0] || 'Standard';
    var title = rec.job || rec.pads_process || '(untitled)';
    var sub = rec.customer || rec.worker || '';
    var amt = rec.amount ? (rec.currency ? rec.currency + ' ' : '') + rec.amount : '';
    return '<div class="share-tpl-preview">' +
      '<div class="share-tpl-preview-lbl">Template QR · ' + esc(lbl) + '</div>' +
      '<div class="share-tpl-card share-tpl-dt-' + (dsDisplayType || 0) + '">' +
        '<div class="share-tpl-title">' + esc(title) + '</div>' +
        (sub ? '<div class="share-tpl-sub">' + esc(sub) + '</div>' : '') +
        (amt ? '<div class="share-tpl-amt">' + esc(amt) + '</div>' : '') +
      '</div></div>';
  }

  global.WPTemplateQr = {
    DISPLAY_LABELS: DISPLAY_LABELS,
    isCandidate: isCandidate,
    defaultShareTag: defaultShareTag,
    displayLabel: displayLabel,
    minDisplayTypeForTag: minDisplayTypeForTag,
    fieldsForRtpl: fieldsForRtpl,
    renderPreviewHtml: renderPreviewHtml,
  };

}(typeof window !== 'undefined' ? window : global));
