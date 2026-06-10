// activity-taxonomy.js — C14 minimal work-activity taxonomy (not money/materials/social)
// Exposes: window.WPActivityTaxonomy

(function(global) {
  'use strict';

  /**
   * Ownership — whose work this bucket tracks.
   * Rejected divisions (IO): money | materials | social as top-level kinds.
   */
  var OWNERSHIP = {
    own: {
      id: 'own',
      label: 'Personal',
      short: 'Mine',
      hint: 'Your trade, jobs, or sales you run yourself',
    },
    other: {
      id: 'other',
      label: 'For others',
      short: 'Other',
      hint: 'Work you do on behalf of someone else (client, employer, relay)',
    },
  };

  /** Where work mainly happens — optional second axis. */
  var SETTINGS = {
    field: {
      id: 'field',
      label: 'Field',
      hint: 'On-site, mobile, market stall, visits',
    },
    base: {
      id: 'base',
      label: 'Base',
      hint: 'Shop, yard, kitchen, fixed location',
    },
    remote: {
      id: 'remote',
      label: 'Remote',
      hint: 'Phone, messages, office — little travel',
    },
  };

  var SETTING_IDS = ['field', 'base', 'remote'];
  var OWNERSHIP_IDS = ['own', 'other'];

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function defaultDraft() {
    return { name: '', ownership: 'own', setting: 'field' };
  }

  function normalizeOwnership(v) {
    return v === 'other' ? 'other' : 'own';
  }

  function normalizeSetting(v) {
    return SETTINGS[v] ? v : 'field';
  }

  function normalizeActivity(act) {
    if (!act) return act;
    act.type = normalizeOwnership(act.type);
    act.setting = normalizeSetting(act.setting);
    return act;
  }

  function toStoreFields(draft) {
    draft = draft || {};
    return {
      type: normalizeOwnership(draft.ownership),
      setting: normalizeSetting(draft.setting),
    };
  }

  function ownershipLabel(id) {
    var o = OWNERSHIP[normalizeOwnership(id)];
    return o ? o.label : 'Personal';
  }

  function settingLabel(id) {
    var s = SETTINGS[normalizeSetting(id)];
    return s ? s.label : 'Field';
  }

  function metaLine(act) {
    if (!act) return '';
    var o = OWNERSHIP[normalizeOwnership(act.type)];
    var s = SETTINGS[normalizeSetting(act.setting)];
    return (o ? o.short : 'Mine') + ' \u00b7 ' + (s ? s.label : 'Field');
  }

  function optionLabel(act) {
    if (!act) return '';
    return (act.name || '(activity)') + ' — ' + metaLine(act);
  }

  function pillRow(ids, map, selectedId, prefix, focusKey) {
    var html = '<div class="at-pill-row" data-at-row="' + esc(prefix) + '">';
    var i, id, item, on, foc;
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      item = map[id];
      if (!item) continue;
      on = selectedId === id;
      foc = focusKey === prefix + ':' + id;
      html += '<span class="at-pill' + (on ? ' at-on' : '') + (foc ? ' focused' : '') + '" ' +
        'data-at-pick="' + esc(prefix) + '" data-at-val="' + esc(id) + '">' +
        esc(item.label) + '</span>';
    }
    return html + '</div>';
  }

  function explainHtml() {
    return '<div class="at-explain">' +
      '<div class="at-explain-title">Activity buckets</div>' +
      '<div class="at-explain-body">Group records by <strong>whose work</strong> and <strong>where</strong> you usually operate. ' +
      'Not money vs materials — use record types (sale, invoice, need) for that.</div></div>';
  }

  function renderManagementCreate(draft, focusKey) {
    draft = draft || defaultDraft();
    return explainHtml() +
      '<div class="act-new-row' + (focusKey === 'name' ? ' focused' : '') + '" id="act-new-row">' +
        '<input class="field-input act-new-input" id="act-new-input" ' +
          'placeholder="Activity name (e.g. Car wash, Side jobs)\u2026" ' +
          'value="' + esc(draft.name) + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
      '</div>' +
      '<div class="at-lbl">Whose work?</div>' +
      pillRow(OWNERSHIP_IDS, OWNERSHIP, draft.ownership, 'own', focusKey) +
      '<div class="at-lbl">Main setting</div>' +
      pillRow(SETTING_IDS, SETTINGS, draft.setting, 'set', focusKey) +
      '<div class="act-new-row" style="margin-top:8px;">' +
        '<span class="badge badge-accent act-add-btn' + (focusKey === 'add' ? ' badge-accent' : '') + '" id="act-add-btn">Add activity</span>' +
      '</div>';
  }

  function readManagementDraft() {
    var inp = document.getElementById('act-new-input');
    var draft = defaultDraft();
    if (inp) draft.name = inp.value.trim();
    var picks = document.querySelectorAll('[data-at-pick].at-on');
    var i, p, v;
    for (i = 0; i < picks.length; i++) {
      p = picks[i].getAttribute('data-at-pick');
      v = picks[i].getAttribute('data-at-val');
      if (p === 'own') draft.ownership = v;
      if (p === 'set') draft.setting = v;
    }
    return draft;
  }

  function renderPickerCreate(draft, focusKey) {
    draft = draft || defaultDraft();
    return '<div class="at-lbl">New activity</div>' +
      '<div class="act-new-row act-picker-create' + (focusKey === 'name' ? ' focused' : '') + '" id="act-picker-create-row">' +
        '<input class="field-input act-new-input" id="act-picker-new-inp" ' +
          'placeholder="Name\u2026" value="' + esc(draft.name) + '" autocomplete="off">' +
        '<span class="badge badge-accent act-add-btn" id="act-picker-add-btn">Add</span>' +
      '</div>' +
      pillRow(OWNERSHIP_IDS, OWNERSHIP, draft.ownership, 'own', focusKey) +
      pillRow(SETTING_IDS, SETTINGS, draft.setting, 'set', focusKey);
  }

  function readPickerDraft(defaultOwnership) {
    var inp = document.getElementById('act-picker-new-inp');
    var draft = defaultDraft();
    if (defaultOwnership === 'other') draft.ownership = 'other';
    if (inp) draft.name = inp.value.trim();
    var picks = document.querySelectorAll('#act-picker-create-row [data-at-pick].at-on, .act-picker-create [data-at-pick].at-on');
    if (!picks.length) picks = document.querySelectorAll('[data-at-pick].at-on');
    var i, p, v;
    for (i = 0; i < picks.length; i++) {
      p = picks[i].getAttribute('data-at-pick');
      v = picks[i].getAttribute('data-at-val');
      if (p === 'own') draft.ownership = v;
      if (p === 'set') draft.setting = v;
    }
    return draft;
  }

  function wirePills(root, onChange) {
    if (!root) return;
    var pills = root.querySelectorAll('[data-at-pick]');
    var i;
    for (i = 0; i < pills.length; i++) {
      pills[i].addEventListener('click', function() {
        var row = this.getAttribute('data-at-pick');
        var val = this.getAttribute('data-at-val');
        var siblings = root.querySelectorAll('[data-at-pick="' + row + '"]');
        var j;
        for (j = 0; j < siblings.length; j++) siblings[j].classList.remove('at-on');
        this.classList.add('at-on');
        if (onChange) onChange();
      });
    }
  }

  global.WPActivityTaxonomy = {
    OWNERSHIP: OWNERSHIP,
    SETTINGS: SETTINGS,
    defaultDraft: defaultDraft,
    normalizeActivity: normalizeActivity,
    toStoreFields: toStoreFields,
    ownershipLabel: ownershipLabel,
    settingLabel: settingLabel,
    metaLine: metaLine,
    optionLabel: optionLabel,
    renderManagementCreate: renderManagementCreate,
    readManagementDraft: readManagementDraft,
    renderPickerCreate: renderPickerCreate,
    readPickerDraft: readPickerDraft,
    wirePills: wirePills,
    explainHtml: explainHtml,
  };

}(window));
