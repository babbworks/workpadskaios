// ui-fields.js — shared form/list HTML helpers (ES5, no bundler)
// Exposes: window.UIFields

(function(global) {
  'use strict';

  var esc = global.esc || function(s) { return String(s || ''); };

  var CATEGORY_LABELS = {
    '0': 'Customer', '1': 'Client', '2': 'Vendor', '3': 'Supplier',
    '4': 'Contractor', '5': 'Sub-contractor', '6': 'Partner', '7': 'Employee',
    '8': 'Agent', '9': 'Accountant', '10': 'Bank / Lender', '11': 'Insurer',
    '12': 'Landlord', '13': 'Government', '14': 'Utility', '15': 'Referral',
    '16': 'Prospect', '17': 'General',
  };

  function fieldGroup(id, label, value, type, inputIdPrefix) {
    var pid = (inputIdPrefix != null && inputIdPrefix !== '') ? inputIdPrefix : 'f-';
    return '<div class="field-group">' +
      '<div class="field-label">' + esc(label) + '</div>' +
      '<input class="field-input" id="' + esc(pid + id) + '" type="' + esc(type || 'text') + '" ' +
        'value="' + esc(value) + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
      '</div>';
  }

  function selectGroup(id, label, opts, selected, inputIdPrefix) {
    var pid = (inputIdPrefix != null && inputIdPrefix !== '') ? inputIdPrefix : 'f-';
    var options = opts.map(function(o) {
      return '<option value="' + esc(o.val) + '"' + (o.val === selected ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
    return '<div class="field-group">' +
      '<div class="field-label">' + esc(label) + '</div>' +
      '<select class="field-input" id="' + esc(pid + id) + '">' + options + '</select>' +
      '</div>';
  }

  function listRow(title, sub, opts) {
    opts = opts || {};
    var focused = opts.focused ? ' focused' : '';
    var extra = opts.extraClass ? ' ' + opts.extraClass : '';
    var data = opts.dataIdx != null ? ' data-rec-idx="' + opts.dataIdx + '"' : '';
    return '<div class="list-item' + focused + extra + '"' + data + '>' +
      '<div class="list-item-title">' + esc(title || '(untitled)') + '</div>' +
      (sub ? '<div class="list-item-sub">' + esc(sub) + '</div>' : '') +
      '</div>';
  }

  function contactCategoryLabel(rec) {
    if (!rec) return '';
    if (Array.isArray(rec.roles) && rec.roles.length) {
      return rec.roles.map(function(rv) { return CATEGORY_LABELS[String(rv)] || ''; }).filter(Boolean).join(' \u00b7 ');
    }
    var catNum = rec.category != null ? rec.category : null;
    return catNum != null ? (CATEGORY_LABELS[String(catNum)] || '') : '';
  }

  global.UIFields = {
    CATEGORY_LABELS: CATEGORY_LABELS,
    fieldGroup:      fieldGroup,
    selectGroup:     selectGroup,
    listRow:         listRow,
    contactCategoryLabel: contactCategoryLabel,
  };

}(window));
