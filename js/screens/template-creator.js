// Screen: My Templates creator (RecordTemplateService — personal or import-on-save)
// Exposes: window.TemplateCreatorScreen

(function(global) {
  'use strict';

  var el = {
    content: document.getElementById('tc-content'),
    title:   document.getElementById('tc-title'),
    stepBar: document.getElementById('tc-step-bar'),
    csk:     document.getElementById('tc-csk'),
    rsk:     document.getElementById('tc-rsk'),
  };

  // ── Codec field catalogue ──────────────────────────────────────────────────

  var CODEC_FIELDS = {
    job:             { label: 'Title',         type: 'text',     syn: true  },
    description:     { label: 'Description',   type: 'text',     syn: true  },
    date:            { label: 'Date',          type: 'date',     syn: false },
    due_date:        { label: 'Due date',      type: 'date',     syn: true  },
    tag:             { label: 'Tag',           type: 'text',     syn: true  },
    context_label:   { label: 'Context',       type: 'text',     syn: true  },
    customer:        { label: 'Customer',      type: 'text',     syn: true  },
    customer_phone:  { label: 'Cust. phone',   type: 'tel',      syn: true  },
    worker:          { label: 'Worker',        type: 'text',     syn: true  },
    worker_amount:   { label: 'Internal cost', type: 'number',   syn: true  },
    location:        { label: 'Location',      type: 'text',     syn: true  },
    url:             { label: 'URL',           type: 'url',      syn: true  },
    attachment:      { label: 'Attachment',    type: 'url',      syn: true  },
    meeting_time:    { label: 'Meeting time',  type: 'text',     syn: true  },
    start_time:      { label: 'Start time',    type: 'text',     syn: true  },
    end_time:        { label: 'End time',      type: 'text',     syn: true  },
    currency:        { label: 'Currency',      type: 'select',   syn: false,
                       options: ['','GBP','USD','EUR','NGN','KES','ZAR','GHS','INR','AUD','PHP'] },
    vat:             { label: 'VAT',           type: 'select',   syn: true,
                       options: ['','none','standard','zero','custom'] },
    custom_tax_rate: { label: 'Tax rate %',    type: 'number',   syn: false },
    service_ref:     { label: 'Service ref',   type: 'text',     syn: true  },
    expiry_date:     { label: 'Expiry date',   type: 'date',     syn: true  },
    qty_unit:        { label: 'Unit',          type: 'text',     syn: true  },
    story:           { label: 'Notes',         type: 'textarea', syn: true  },
    details:         { label: 'Details',       type: 'textarea', syn: true  },
    actions:         { label: 'Action items',  type: 'block',    syn: true  },
    participants:    { label: 'Participants',  type: 'block',    syn: false },
    compound_lines:  { label: 'Line items',    type: 'block',    syn: false },
  };

  function roleCodebook() {
    return (global.WPRoles && WPRoles.EXTENDED_ROLE_LABELS) ? WPRoles.EXTENDED_ROLE_LABELS : [
      'Witness','Guarantor','Signatory','Observer','Approver',
      'Beneficiary','Agent','Referee','Representative','Director',
      'Shareholder','Auditor','Solicitor','Accountant','Trustee','Custom',
    ];
  }

  var LINE_TYPES   = ['Standard','Discount','Tax line','Header'];
  var TAX_MODES    = ['No tax','Inclusive','Exclusive','Compound'];
  var VIS_MODES    = ['visible','internal','locked','locked-internal','hidden'];
  var VIS_LABELS   = { visible:'Visible', internal:'Internal', locked:'Locked',
                       'locked-internal':'Locked+Int', hidden:'Hidden' };
  var CF_TYPES     = ['text','number','date','url','phone','textarea','toggle'];

  // ── Blocks catalogue ───────────────────────────────────────────────────────

  var BLOCKS = [
    { id:'identity-sm',    label:'Identity (small)',   fields:['job','date','tag'] },
    { id:'identity-full',  label:'Identity (full)',    fields:['job','description','date','due_date','tag','context_label'] },
    { id:'parties-sm',     label:'Parties (compact)',  fields:['customer','customer_phone'] },
    { id:'parties-full',   label:'Parties (full)',     fields:['customer','customer_phone','worker','worker_amount'] },
    { id:'participants',   label:'Participants',       fields:['participants'] },
    { id:'schedule',       label:'Schedule',           fields:['meeting_time','start_time','end_time'] },
    { id:'location',       label:'Location & links',  fields:['location','url','attachment'] },
    { id:'financial-sm',   label:'Financial (basic)',  fields:['currency','vat'] },
    { id:'financial-full', label:'Financial (full)',   fields:['currency','vat','custom_tax_rate','service_ref','expiry_date','due_date'] },
    { id:'lines',          label:'Line items',        fields:['compound_lines'] },
    { id:'content',        label:'Content',           fields:['story','details'] },
    { id:'actions',        label:'Action items',      fields:['actions'] },
    { id:'routing',        label:'Routing flags',     fields:['__routing__'] },
  ];

  // Starter preset: which block ids to pre-insert per record type
  var PRESETS = {
    'blank':   [],
    '':        ['identity-sm','parties-sm','financial-sm','lines'],
    'quote':   ['identity-sm','parties-sm','financial-full','lines'],
    'invoice': ['identity-sm','parties-sm','financial-full','lines'],
    'receipt': ['identity-sm','parties-sm','financial-sm'],
    'pads':    ['identity-sm','content'],
    'newent':  ['identity-sm','parties-full','location'],
    'contact': ['identity-sm','parties-sm','location'],
  };

  var TYPE_OPTS = [
    { value:'blank',   label:'Blank',    desc:'Fully custom \u2014 no preset fields' },
    { value:'',        label:'Job',      desc:'Standard work job'   },
    { value:'quote',   label:'Quote',    desc:'Price quotation'     },
    { value:'invoice', label:'Invoice',  desc:'Payment invoice'     },
    { value:'receipt', label:'Receipt',  desc:'Payment receipt'     },
    { value:'pads',    label:'Basic',    desc:'Basic text pad'      },
    { value:'newent',  label:'Business', desc:'New business entity' },
    { value:'contact', label:'Contact',  desc:'Contact record'      },
  ];

  var STEPS = ['type','identity','canvas','synonyms','routing','review'];

  // ── State ──────────────────────────────────────────────────────────────────

  // canvasMode values: 'list'|'block-picker'|'add-field'|'field-editor'|
  //   'part-list'|'part-editor'|'line-list'|'line-editor'|'action-list'|'action-editor'
  var s = {};

  function resetState(opts) {
    opts = opts || {};
    s.returnTo    = opts.returnTo || 'management';
    s.editId      = opts.editId   || null;
    s.adoptOnSave = !!opts.adoptOnSave;
    s.pipeline   = STEPS.slice();
    s.pipelineIdx = 0;

    s.typeFocusIdx    = 0;
    s.identFocusIdx   = 0;
    s.canvasFocusIdx  = 0;
    s.canvasMode      = 'list'; // 'list'|'block-picker'|'add-field'|'field-editor'|'part-list'|'part-editor'|'line-list'|'line-editor'
    s.blockFocusIdx   = 0;
    s.addFocusIdx     = 0;
    s.editingKey      = null;
    s.editingPartIdx  = -1;
    s.editingLineIdx  = -1;
    s.editingActIdx   = -1;
    s.partSubStep     = 0;
    s.lineSubStep     = 0;
    s.actSubStep      = 0;
    s.synFocusIdx     = 0;
    s.routingFocusIdx = 0;

    var existing = s.editId ? (RecordTemplateService.get(s.editId) || {}) : {};
    var fromRec  = opts.fromRecord || {};

    s.tpl = {
      name:           existing.name           || fromRec.name           || '',
      description:    existing.description    || fromRec.description    || '',
      iconColor:      existing.iconColor      || '#4a9eff',
      record_type:    existing.record_type    !== undefined ? existing.record_type
                    : (opts.recordType        !== undefined ? opts.recordType : null),
      record_class:   existing.record_class   || '',
      activityId:     existing.activityId     || fromRec.activityId     || '',
      fieldSynonyms:  existing.fieldSynonyms  || {},
      fieldVisibility:existing.fieldVisibility|| {},
      requiredFields: existing.requiredFields || [],
      routingDefaults:existing.routingDefaults|| { ackRequest: false, restrictForward: false },
      customFields:   existing.customFields   || [],
      fieldOrder:     existing.fieldOrder     || [],
      participants:   existing.participants   || fromRec.participants   || [],
      compound_lines: existing.compound_lines || fromRec.compound_lines || [],
      actions:        existing.actions        || fromRec.actions        || [],
      hasTotalSummary:existing.hasTotalSummary|| false,
      hasSubtotals:   existing.hasSubtotals   || false,
    };

    // Copy over any codec pre-fill values from existing template or fromRecord
    var wireFields = ['job','description','date','due_date','tag','context_label',
      'customer','customer_phone','worker','worker_amount','location','url',
      'attachment','meeting_time','start_time','end_time','currency','vat',
      'custom_tax_rate','service_ref','expiry_date','qty_unit','story','details'];
    for (var i = 0; i < wireFields.length; i++) {
      var f = wireFields[i];
      if (existing[f] !== undefined)  s.tpl[f] = existing[f];
      else if (fromRec[f] !== undefined) s.tpl[f] = fromRec[f];
    }

    // If type already set, build starter fieldOrder if blank
    if (s.tpl.record_type !== null && !s.tpl.fieldOrder.length) {
      applyPreset(s.tpl.record_type);
    }

    if (s.tpl.record_type !== null) {
      s.pipeline    = STEPS.slice(1); // drop 'type'
      s.pipelineIdx = 0;
    }
  }

  function applyPreset(typeVal) {
    var blockIds = PRESETS[typeVal] || PRESETS[''];
    var order = [];
    var seen = {};
    for (var b = 0; b < blockIds.length; b++) {
      var blk = blockById(blockIds[b]);
      if (!blk) continue;
      for (var f = 0; f < blk.fields.length; f++) {
        var key = blk.fields[f];
        if (!seen[key]) { order.push(key); seen[key] = true; }
      }
    }
    s.tpl.fieldOrder = order;
  }

  function blockById(id) {
    for (var i = 0; i < BLOCKS.length; i++) { if (BLOCKS[i].id === id) return BLOCKS[i]; }
    return null;
  }

  // ── Step bar ───────────────────────────────────────────────────────────────

  function updateStepBar() {
    var total    = s.pipeline.length;
    var stepId   = s.pipeline[s.pipelineIdx] || '';
    var stepName = capitalise(stepId);
    if (el.stepBar) el.stepBar.textContent = 'Step ' + (s.pipelineIdx + 1) + ' of ' + total + ' \u2014 ' + stepName;
    if (el.title)   el.title.textContent   = 'Template';
    // RSK: context-specific label
    if (el.rsk) {
      if (stepId === 'canvas' && s.canvasMode === 'list') el.rsk.textContent = 'Block \u25be';
      else if (stepId === 'canvas') el.rsk.textContent = '';
      else el.rsk.textContent = '';
    }
  }

  function capitalise(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function currentStepId() {
    return s.pipeline[s.pipelineIdx] || s.pipeline[s.pipeline.length - 1];
  }

  // ── Render dispatcher ──────────────────────────────────────────────────────

  function render() {
    updateStepBar();
    var step = currentStepId();
    if (step === 'type')     { renderTypeStep();     return; }
    if (step === 'identity') { renderIdentityStep(); return; }
    if (step === 'canvas')   { renderCanvasStep();   return; }
    if (step === 'synonyms') { renderSynonymsStep(); return; }
    if (step === 'routing')  { renderRoutingStep();  return; }
    if (step === 'review')   { renderReviewStep();   return; }
  }

  // ── Step: Type ─────────────────────────────────────────────────────────────

  function renderTypeStep() {
    if (el.csk) el.csk.textContent = 'Select';
    var html = '<div class="tc-hdr">Choose record type</div>';
    TYPE_OPTS.forEach(function(t, i) {
      html += '<div class="tc-type-row' + (s.typeFocusIdx === i ? ' focused' : '') +
        '" data-tci="' + i + '">' +
        '<span class="tc-type-label">' + esc(t.label) + '</span>' +
        '<span class="tc-type-desc">' + esc(t.desc) + '</span>' +
        '</div>';
    });
    el.content.innerHTML = html;
    bindClicks('.tc-type-row[data-tci]', function(el2) {
      var i = parseInt(el2.getAttribute('data-tci'), 10);
      selectType(TYPE_OPTS[i].value);
    });
  }

  function selectType(value) {
    s.tpl.record_type  = (value === 'blank') ? '' : value;
    s.tpl.record_class = (value === 'pads') ? 'pads'
                       : (value === 'contact') ? 'contact'
                       : (value === 'newent')  ? 'newent' : 'job';
    if (!s.tpl.fieldOrder.length) applyPreset(value); // 'blank' → PRESETS['blank'] = []
    s.pipeline    = STEPS.slice(1); // drop 'type'
    s.pipelineIdx = 0;
    render();
  }

  // ── Step: Identity ─────────────────────────────────────────────────────────

  var IDENT_FIELDS = [
    { id: 'tc-name',    label: 'Template name *', key: 'name',        type: 'text'   },
    { id: 'tc-desc',    label: 'Description',     key: 'description', type: 'text'   },
    { id: 'tc-color',   label: 'Icon colour',     key: 'iconColor',   type: 'color'  },
    { id: 'tc-activity',label: 'Activity',        key: 'activityId',  type: 'select' },
  ];

  function renderIdentityStep() {
    if (el.csk) el.csk.textContent = 'Next';
    var acts = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];
    var actOpts = '<option value="">None</option>' +
      acts.map(function(a) {
        return '<option value="' + esc(a.id) + '"' +
          (s.tpl.activityId === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>';
      }).join('');

    var html = '<div class="tc-hdr">Template identity</div>';
    IDENT_FIELDS.forEach(function(f, i) {
      var foc = s.identFocusIdx === i ? ' tc-row-focused' : '';
      html += '<div class="tc-field-row' + foc + '" data-ident-idx="' + i + '">';
      html += '<div class="tc-field-label">' + esc(f.label) + '</div>';
      if (f.type === 'color') {
        html += '<input class="tc-color-inp" id="' + f.id + '" type="color" value="' +
          esc(s.tpl[f.key] || '#4a9eff') + '">';
      } else if (f.type === 'select') {
        html += '<select class="field-input" id="' + f.id + '">' + actOpts + '</select>';
      } else {
        html += '<input class="field-input" id="' + f.id + '" type="text" ' +
          'value="' + esc(s.tpl[f.key] || '') + '" autocomplete="off" autocorrect="off" spellcheck="false">';
      }
      html += '</div>';
    });
    el.content.innerHTML = html;

    // Wire Enter key: advance focus through fields, advance step on last field
    var inputIds = ['tc-name', 'tc-desc', 'tc-activity'];
    inputIds.forEach(function(id, idx) {
      var inp = document.getElementById(id);
      if (!inp) return;
      inp.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        var nextId = inputIds[idx + 1];
        var nextEl = nextId ? document.getElementById(nextId) : null;
        if (nextEl) { nextEl.focus(); }
        else { readIdentity(); if (identityValid()) advanceStep(); else document.getElementById('tc-name').focus(); }
      });
    });

    var first = document.getElementById('tc-name');
    if (first) setTimeout(function() { first.focus(); }, 0);
  }

  function readIdentity() {
    IDENT_FIELDS.forEach(function(f) {
      var inp = document.getElementById(f.id);
      if (inp) s.tpl[f.key] = inp.value;
    });
  }

  function identityValid() {
    var inp = document.getElementById('tc-name');
    return inp && inp.value.trim().length > 0;
  }

  // ── Step: Canvas ───────────────────────────────────────────────────────────

  function fieldLabel(key) {
    if (CODEC_FIELDS[key]) {
      return GlobalSynonymsService.resolve(key, s.tpl.fieldSynonyms) ||
             CODEC_FIELDS[key].label;
    }
    if (key.indexOf('cf_') === 0) {
      var cf = cfByKey(key);
      return cf ? cf.label : key;
    }
    if (key === '__routing__') return 'Routing flags';
    return key;
  }

  function cfByKey(key) {
    for (var i = 0; i < s.tpl.customFields.length; i++) {
      if (s.tpl.customFields[i].key === key) return s.tpl.customFields[i];
    }
    return null;
  }

  function fieldKind(key) {
    if (key === '__routing__')    return 'routing';
    if (key === 'participants')   return 'block';
    if (key === 'compound_lines') return 'block';
    if (key === 'actions')        return 'block';
    if (key.indexOf('cf_') === 0) return 'custom';
    return 'codec';
  }

  function fieldValue(key) {
    if (key === 'participants')   return s.tpl.participants.length + ' seed';
    if (key === 'compound_lines') return s.tpl.compound_lines.length + ' lines';
    if (key === 'actions')        return s.tpl.actions.length + ' seed';
    if (key === '__routing__') {
      var parts = [];
      if (s.tpl.routingDefaults.ackRequest)    parts.push('receipt');
      if (s.tpl.routingDefaults.restrictForward) parts.push('no fwd');
      return parts.length ? parts.join(', ') : 'none';
    }
    if (key.indexOf('cf_') === 0) {
      var cf = cfByKey(key);
      return cf && cf.defaultValue ? cf.defaultValue : '(empty)';
    }
    var v = s.tpl[key];
    return (v !== undefined && v !== null && v !== '') ? String(v) : '(empty)';
  }

  function visLabel(key) {
    var v = s.tpl.fieldVisibility[key];
    if (!v || v === 'visible') return '';
    return VIS_LABELS[v] || v;
  }

  function renderCanvasStep() {
    if (el.rsk) { el.rsk.textContent = ''; el.rsk.onclick = null; } // clear unless overridden below
    if (s.canvasMode === 'block-picker')  { renderBlockPicker();  return; }
    if (s.canvasMode === 'add-field')     { renderAddField();     return; }
    if (s.canvasMode === 'field-editor')  { renderFieldEditor();  return; }
    if (s.canvasMode === 'part-list')     { renderPartList();     return; }
    if (s.canvasMode === 'part-editor')   { renderPartEditor();   return; }
    if (s.canvasMode === 'line-list')     { renderLineList();     return; }
    if (s.canvasMode === 'line-editor')   { renderLineEditor();   return; }
    if (s.canvasMode === 'action-list')   { renderActionList();   return; }
    if (s.canvasMode === 'action-editor') { renderActionEditor(); return; }

    if (el.csk) el.csk.textContent = 'Next';
    if (el.rsk) {
      el.rsk.textContent = 'Blocks';
      el.rsk.onclick = function() { s.canvasMode = 'block-picker'; s.blockFocusIdx = 0; renderCanvasStep(); };
    }
    var order = s.tpl.fieldOrder;
    var html  = '<div class="tc-hdr">Form canvas <span style="float:right;font-size:9px;color:var(--text-muted);">* = insert block</span></div>';

    if (!order.length) {
      html += '<div class="empty-state" style="font-size:11px;padding:8px;">Canvas is empty.<br>Press * to insert a block,<br>or # to add a custom field.</div>';
    } else {
      order.forEach(function(key, i) {
        var kind  = fieldKind(key);
        var label = fieldLabel(key);
        var val   = fieldValue(key);
        var vis   = visLabel(key);
        var isReq = s.tpl.requiredFields.indexOf(key) !== -1;
        var foc   = s.canvasFocusIdx === i ? ' focused' : '';
        html += '<div class="tc-canvas-row' + foc + '" data-ci="' + i + '">' +
          '<span class="tc-canvas-kind tc-kind-' + kind + '">' + kind.charAt(0).toUpperCase() + '</span>' +
          '<div class="tc-canvas-mid">' +
            '<div class="tc-canvas-label">' + esc(label) +
              (isReq ? '<span class="tc-req-star">*</span>' : '') +
            '</div>' +
            '<div class="tc-canvas-val">' + esc(val.slice(0, 28)) + '</div>' +
          '</div>' +
          (vis ? '<span class="tc-vis-badge">' + esc(vis) + '</span>' : '') +
          '</div>';
      });
    }

    html += '<div class="tc-canvas-row tc-canvas-add" data-ci="' + order.length + '">' +
      '<span class="tc-canvas-kind" style="background:var(--bg3);color:var(--text-muted);">+</span>' +
      '<div class="tc-canvas-mid"><div class="tc-canvas-label" style="color:var(--text-muted);">Add custom field</div></div>' +
      '</div>';

    el.content.innerHTML = html;
    applyCanvasFocus();
    bindClicks('.tc-canvas-row[data-ci]', function(el2) {
      var i = parseInt(el2.getAttribute('data-ci'), 10);
      if (i >= s.tpl.fieldOrder.length) { openAddField(); return; }
      s.canvasFocusIdx = i;
      var fieldKey = s.tpl.fieldOrder[i];
      if (fieldKey === 'participants')   { s.canvasMode = 'part-list';   renderCanvasStep(); return; }
      if (fieldKey === 'compound_lines') { s.canvasMode = 'line-list';   renderCanvasStep(); return; }
      if (fieldKey === 'actions')        { s.canvasMode = 'action-list'; renderCanvasStep(); return; }
      openFieldEditor(fieldKey);
    });
  }

  function applyCanvasFocus() {
    var rows = el.content.querySelectorAll('.tc-canvas-row');
    rows.forEach(function(r) { r.classList.remove('focused'); });
    var idx = s.canvasFocusIdx;
    if (idx >= 0 && idx < rows.length) {
      rows[idx].classList.add('focused');
      rows[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  // ── Canvas: Block picker ───────────────────────────────────────────────────

  function renderBlockPicker() {
    if (el.csk) el.csk.textContent = 'Insert';
    var html = '<div class="tc-hdr">Insert block <span style="float:right;font-size:9px;color:var(--text-muted);">Back to cancel</span></div>';
    BLOCKS.forEach(function(blk, i) {
      var foc = s.blockFocusIdx === i ? ' focused' : '';
      var already = blk.fields.every(function(f) { return s.tpl.fieldOrder.indexOf(f) !== -1; });
      html += '<div class="tc-type-row' + foc + (already ? ' tc-row-dim' : '') + '" data-blk="' + i + '">' +
        '<span class="tc-type-label">' + esc(blk.label) + (already ? ' \u2714' : '') + '</span>' +
        '<span class="tc-type-desc">' + esc(blk.fields.filter(function(f) { return f !== '__routing__'; }).join(', ').slice(0, 30)) + '</span>' +
        '</div>';
    });
    el.content.innerHTML = html;
    applyListFocus('.tc-type-row[data-blk]', s.blockFocusIdx);
    bindClicks('.tc-type-row[data-blk]', function(el2) {
      insertBlock(BLOCKS[parseInt(el2.getAttribute('data-blk'), 10)]);
    });
  }

  function insertBlock(blk) {
    blk.fields.forEach(function(key) {
      if (s.tpl.fieldOrder.indexOf(key) === -1) s.tpl.fieldOrder.push(key);
    });
    s.canvasMode = 'list';
    s.blockFocusIdx = 0;
    renderCanvasStep();
  }

  // ── Canvas: Add custom field ───────────────────────────────────────────────

  function renderAddField() {
    if (el.csk) el.csk.textContent = 'Add';
    var html = '<div class="tc-hdr">New custom field</div>' +
      '<div class="tc-field-row"><div class="tc-field-label">Label</div>' +
        '<input class="field-input" id="cf-label" type="text" autocomplete="off" autocorrect="off" spellcheck="false"></div>' +
      '<div class="tc-field-row"><div class="tc-field-label">Type</div>' +
        '<select class="field-input" id="cf-type">' +
        CF_TYPES.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('') +
        '</select></div>' +
      '<div class="tc-field-row"><div class="tc-field-label">Default value</div>' +
        '<input class="field-input" id="cf-default" type="text" autocomplete="off" autocorrect="off" spellcheck="false"></div>' +
      '<div class="tc-field-row"><div class="tc-field-label">Placeholder</div>' +
        '<input class="field-input" id="cf-placeholder" type="text" autocomplete="off" autocorrect="off" spellcheck="false"></div>' +
      '<div class="tc-field-row"><div class="tc-field-label">Visibility</div>' +
        '<select class="field-input" id="cf-vis">' +
        VIS_MODES.map(function(m) { return '<option value="' + m + '">' + VIS_LABELS[m] + '</option>'; }).join('') +
        '</select></div>' +
      '<div class="tc-row-actions">' +
        '<span class="badge" id="cf-cancel">Cancel</span>' +
        '<span class="badge badge-accent" id="cf-save">Add field</span>' +
      '</div>';
    el.content.innerHTML = html;
    var labelInp = document.getElementById('cf-label');
    if (labelInp) setTimeout(function() { labelInp.focus(); }, 0);
    var cancel = document.getElementById('cf-cancel');
    if (cancel) cancel.addEventListener('click', function() { s.canvasMode = 'list'; renderCanvasStep(); });
    var save = document.getElementById('cf-save');
    if (save) save.addEventListener('click', saveCustomField);
  }

  function saveCustomField() {
    var labelInp = document.getElementById('cf-label');
    var label    = labelInp ? labelInp.value.trim() : '';
    if (!label) { if (labelInp) labelInp.focus(); return; }
    var key = 'cf_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    // Ensure unique key
    var existing = cfByKey(key);
    if (existing) key = key + '_' + Date.now().toString(36).slice(-4);

    var type  = (document.getElementById('cf-type')        || {}).value || 'text';
    var def   = (document.getElementById('cf-default')     || {}).value || '';
    var ph    = (document.getElementById('cf-placeholder')  || {}).value || '';
    var vis   = (document.getElementById('cf-vis')          || {}).value || 'visible';

    s.tpl.customFields.push({ key: key, label: label, type: type,
      defaultValue: def, placeholder: ph, visibility: vis, required: false });
    s.tpl.fieldOrder.push(key);
    s.canvasMode = 'list';
    s.canvasFocusIdx = s.tpl.fieldOrder.length - 1;
    renderCanvasStep();
  }

  // ── Canvas: Field editor ───────────────────────────────────────────────────

  function openAddField()       { s.canvasMode = 'add-field';    renderCanvasStep(); }
  function openFieldEditor(key) { s.editingKey = key; s.canvasMode = 'field-editor'; renderCanvasStep(); }

  function renderFieldEditor() {
    var key  = s.editingKey;
    var kind = fieldKind(key);
    var cf   = (kind === 'custom') ? cfByKey(key) : null;
    var cdef = CODEC_FIELDS[key];

    if (el.csk) el.csk.textContent = 'Save';

    var label = cf ? cf.label : (cdef ? cdef.label : key);
    var curVal = cf ? cf.defaultValue : (s.tpl[key] || '');
    var curSyn = (cdef && cdef.syn) ? (s.tpl.fieldSynonyms[key] || '') : null;
    var curVis = s.tpl.fieldVisibility[key] || 'visible';
    var isReq  = s.tpl.requiredFields.indexOf(key) !== -1;

    var html = '<div class="tc-hdr">Edit: ' + esc(label) + '</div>';

    // Show codec key for codec fields
    if (kind === 'codec' || kind === 'block' || kind === 'routing') {
      html += '<div class="tc-codec-key">codec: ' + esc(key) + '</div>';
    }

    // Synonym field (only for synonym-able codec fields)
    if (curSyn !== null) {
      html += '<div class="tc-field-row"><div class="tc-field-label">Label synonym</div>' +
        '<input class="field-input" id="fe-syn" type="text" placeholder="' + esc(label) + '" ' +
        'value="' + esc(curSyn) + '" autocomplete="off" autocorrect="off" spellcheck="false"></div>';
    }

    // Custom field label edit
    if (kind === 'custom') {
      html += '<div class="tc-field-row"><div class="tc-field-label">Field label</div>' +
        '<input class="field-input" id="fe-cf-label" type="text" value="' + esc(label) + '" autocomplete="off" autocorrect="off" spellcheck="false"></div>';
      html += '<div class="tc-field-row"><div class="tc-field-label">Type</div>' +
        '<select class="field-input" id="fe-cf-type">' +
        CF_TYPES.map(function(t) {
          return '<option value="' + t + '"' + (cf.type === t ? ' selected' : '') + '>' + t + '</option>';
        }).join('') + '</select></div>';
      html += '<div class="tc-field-row"><div class="tc-field-label">Placeholder</div>' +
        '<input class="field-input" id="fe-cf-ph" type="text" value="' +
        esc(cf.placeholder || '') + '" autocomplete="off" autocorrect="off" spellcheck="false"></div>';
    }

    // Default value (not for block/routing kinds)
    if (kind !== 'block' && kind !== 'routing') {
      var inputType = cf ? cf.type : (cdef ? cdef.type : 'text');
      if (inputType === 'block') inputType = 'text';
      if (inputType === 'select' && cdef && cdef.options) {
        html += '<div class="tc-field-row"><div class="tc-field-label">Default value</div>' +
          '<select class="field-input" id="fe-default">' +
          cdef.options.map(function(o) {
            return '<option value="' + esc(o) + '"' + (o === curVal ? ' selected' : '') + '>' + esc(o || '(not set)') + '</option>';
          }).join('') + '</select></div>';
      } else if (inputType === 'textarea') {
        html += '<div class="tc-field-row"><div class="tc-field-label">Default value</div>' +
          '<textarea class="field-input" id="fe-default" rows="3">' + esc(curVal) + '</textarea></div>';
      } else {
        html += '<div class="tc-field-row"><div class="tc-field-label">Default value</div>' +
          '<input class="field-input" id="fe-default" type="text" value="' +
          esc(curVal) + '" autocomplete="off" autocorrect="off" spellcheck="false"></div>';
      }
    }

    // Visibility
    html += '<div class="tc-field-row"><div class="tc-field-label">Visibility</div>' +
      '<select class="field-input" id="fe-vis">' +
      VIS_MODES.map(function(m) {
        return '<option value="' + m + '"' + (curVis === m ? ' selected' : '') + '>' + VIS_LABELS[m] + '</option>';
      }).join('') + '</select></div>';

    // Required toggle
    html += '<div class="tc-field-row tc-toggle-row"><div class="tc-field-label">Required (gates share)</div>' +
      '<input type="checkbox" id="fe-req"' + (isReq ? ' checked' : '') + '></div>';

    // Move up/down / remove
    var orderIdx = s.tpl.fieldOrder.indexOf(key);
    html += '<div class="tc-row-actions">' +
      '<span class="badge" id="fe-cancel">Cancel</span>' +
      (orderIdx > 0 ? '<span class="badge" id="fe-up">\u2191</span>' : '') +
      (orderIdx < s.tpl.fieldOrder.length - 1 ? '<span class="badge" id="fe-down">\u2193</span>' : '') +
      '<span class="badge badge-danger" id="fe-remove">Remove</span>' +
      '<span class="badge badge-accent" id="fe-save">Save</span>' +
    '</div>';

    el.content.innerHTML = html;

    var cancelBtn = document.getElementById('fe-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function() { s.canvasMode = 'list'; renderCanvasStep(); });

    var saveBtn = document.getElementById('fe-save');
    if (saveBtn) saveBtn.addEventListener('click', saveFieldEditor);

    var removeBtn = document.getElementById('fe-remove');
    if (removeBtn) removeBtn.addEventListener('click', function() {
      s.tpl.fieldOrder.splice(orderIdx, 1);
      // Also remove from customFields if custom
      if (kind === 'custom') {
        s.tpl.customFields = s.tpl.customFields.filter(function(c) { return c.key !== key; });
      }
      s.canvasMode = 'list';
      s.canvasFocusIdx = Math.max(0, orderIdx - 1);
      renderCanvasStep();
    });

    var upBtn = document.getElementById('fe-up');
    if (upBtn) upBtn.addEventListener('click', function() {
      var arr = s.tpl.fieldOrder;
      var tmp = arr[orderIdx - 1]; arr[orderIdx - 1] = arr[orderIdx]; arr[orderIdx] = tmp;
      s.canvasFocusIdx = orderIdx - 1;
      s.canvasMode = 'list'; renderCanvasStep();
    });

    var downBtn = document.getElementById('fe-down');
    if (downBtn) downBtn.addEventListener('click', function() {
      var arr = s.tpl.fieldOrder;
      var tmp = arr[orderIdx + 1]; arr[orderIdx + 1] = arr[orderIdx]; arr[orderIdx] = tmp;
      s.canvasFocusIdx = orderIdx + 1;
      s.canvasMode = 'list'; renderCanvasStep();
    });

    var first = document.getElementById('fe-syn') || document.getElementById('fe-cf-label') || document.getElementById('fe-default');
    if (first) setTimeout(function() { first.focus(); }, 0);
  }

  function saveFieldEditor() {
    var key  = s.editingKey;
    var kind = fieldKind(key);
    var cf   = (kind === 'custom') ? cfByKey(key) : null;
    var cdef = CODEC_FIELDS[key];

    // Synonym
    var synInp = document.getElementById('fe-syn');
    if (synInp !== null && cdef && cdef.syn) {
      var synVal = synInp.value.trim();
      if (synVal) s.tpl.fieldSynonyms[key] = synVal;
      else delete s.tpl.fieldSynonyms[key];
    }

    // Default value
    var defInp = document.getElementById('fe-default');
    if (defInp && kind !== 'block' && kind !== 'routing') {
      var defVal = defInp.value;
      if (kind === 'custom') {
        if (cf) cf.defaultValue = defVal;
      } else {
        s.tpl[key] = defVal;
      }
    }

    // Custom field label / type / placeholder
    if (kind === 'custom' && cf) {
      var labelInp = document.getElementById('fe-cf-label');
      if (labelInp) cf.label = labelInp.value.trim() || cf.label;
      var typeInp = document.getElementById('fe-cf-type');
      if (typeInp) cf.type = typeInp.value;
      var phInp = document.getElementById('fe-cf-ph');
      if (phInp) cf.placeholder = phInp.value;
    }

    // Visibility
    var visInp = document.getElementById('fe-vis');
    if (visInp) {
      var visVal = visInp.value;
      if (visVal === 'visible') delete s.tpl.fieldVisibility[key];
      else s.tpl.fieldVisibility[key] = visVal;
    }

    // Required
    var reqInp = document.getElementById('fe-req');
    var reqIdx = s.tpl.requiredFields.indexOf(key);
    if (reqInp && reqInp.checked && reqIdx === -1) s.tpl.requiredFields.push(key);
    if (reqInp && !reqInp.checked && reqIdx !== -1) s.tpl.requiredFields.splice(reqIdx, 1);

    s.canvasMode = 'list';
    renderCanvasStep();
  }

  // ── Canvas: Participant mini-wizard ────────────────────────────────────────

  var PART_FIELDS = [
    { label: 'Name',         key: 'name',        type: 'text' },
    { label: 'Role',         key: '_roleChoice',  type: 'role' },
    { label: 'Role text',    key: 'roleText',     type: 'text', condition: function(p) { return p._roleChoice === 15; } },
    { label: 'Phone',        key: 'phone',        type: 'tel'  },
    { label: 'Email',        key: 'email',        type: 'text' },
    { label: 'Trading name', key: 'tradingName',  type: 'text' },
    { label: 'Is org',       key: 'isOrg',        type: 'toggle' },
    { label: 'Locked',       key: 'locked',       type: 'toggle', hint: 'Locked = pre-filled, not editable in wizard' },
  ];

  function renderPartList() {
    if (el.csk) el.csk.textContent = 'Edit';
    if (el.rsk) el.rsk.textContent = '+ Add';
    var parts = s.tpl.participants;
    var html  = '<div class="tc-hdr">Seed participants <span style="float:right;font-size:9px;color:var(--text-muted);">* = add</span></div>';
    if (!parts.length) {
      html += '<div class="empty-state" style="font-size:11px;padding:8px;">No seed participants.<br>Press * to add one.</div>';
    }
    parts.forEach(function(p, i) {
      var roleLabel = roleCodebook()[p.roleType || 0] || 'Witness';
      var foc = s.editingPartIdx === i ? ' focused' : '';
      html += '<div class="tc-canvas-row' + foc + '" data-pi="' + i + '">' +
        '<span class="tc-canvas-kind tc-kind-codec">' + (p.locked ? '\u{1F512}' : 'P') + '</span>' +
        '<div class="tc-canvas-mid">' +
          '<div class="tc-canvas-label">' + esc(p.name || '(unnamed)') + '</div>' +
          '<div class="tc-canvas-val">' + esc(roleLabel) + (p.isOrg ? ' \u00b7 org' : '') + '</div>' +
        '</div>' +
        '<span class="tc-canvas-del" data-pdel="' + i + '">\u00d7</span>' +
      '</div>';
    });
    html += '<div class="tc-row-actions"><span class="badge" id="pl-done">Done</span></div>';
    el.content.innerHTML = html;

    var done = document.getElementById('pl-done');
    if (done) done.addEventListener('click', function() { s.canvasMode = 'list'; renderCanvasStep(); });
    if (el.rsk) { el.rsk.onclick = function() { openPartEditor(-1); }; }
    bindClicks('.tc-canvas-row[data-pi]', function(el2) {
      var i = parseInt(el2.getAttribute('data-pi'), 10);
      if (!isNaN(i)) openPartEditor(i);
    });
    bindClicks('[data-pdel]', function(el2) {
      var i = parseInt(el2.getAttribute('data-pdel'), 10);
      if (!isNaN(i)) { s.tpl.participants.splice(i, 1); renderPartList(); }
    });
  }

  function openPartEditor(idx) {
    if (idx === -1) {
      s.tpl.participants.push({ name:'', roleType:0, roleText:'', phone:'',
        email:'', tradingName:'', isOrg:false, locked:false });
      idx = s.tpl.participants.length - 1;
    }
    s.editingPartIdx = idx;
    s.partSubStep    = 0;
    s.canvasMode     = 'part-editor';
    renderCanvasStep();
  }

  function renderPartEditor() {
    var p   = s.tpl.participants[s.editingPartIdx];
    var fld = PART_FIELDS.filter(function(f) {
      return !f.condition || f.condition(p);
    });
    var fieldDef = fld[s.partSubStep];
    if (!fieldDef) { s.canvasMode = 'part-list'; renderCanvasStep(); return; }

    if (el.csk) el.csk.textContent = s.partSubStep < fld.length - 1 ? 'Next' : 'Done';

    var total = fld.length;
    var html = '<div class="tc-hdr">Participant ' + (s.editingPartIdx + 1) +
      ' \u2014 ' + (s.partSubStep + 1) + '/' + total + '</div>';
    html += '<div class="tc-field-row"><div class="tc-field-label">' + esc(fieldDef.label) + '</div>';

    if (fieldDef.type === 'toggle') {
      html += '<div class="tc-toggle-row"><input type="checkbox" id="pe-val"' + (p[fieldDef.key] ? ' checked' : '') + '>' +
        '<label for="pe-val" style="margin-left:6px;font-size:11px;">' + (fieldDef.hint || '') + '</label></div>';
    } else if (fieldDef.type === 'role') {
      html += '<select class="field-input" id="pe-val">' +
        roleCodebook().map(function(r, i) {
          return '<option value="' + i + '"' + ((p._roleChoice || p.roleType || 0) === i ? ' selected' : '') + '>' + esc(r) + '</option>';
        }).join('') + '</select>';
    } else {
      html += '<input class="field-input" id="pe-val" type="' + fieldDef.type + '" ' +
        'value="' + esc(p[fieldDef.key] || '') + '" autocomplete="off" autocorrect="off" spellcheck="false">';
    }
    html += '</div>';
    html += '<div class="tc-row-actions">' +
      '<span class="badge" id="pe-cancel">Cancel</span>' +
      (s.partSubStep > 0 ? '<span class="badge" id="pe-back">Back</span>' : '') +
      '<span class="badge badge-accent" id="pe-next">' + (s.partSubStep < fld.length - 1 ? 'Next' : 'Done') + '</span>' +
    '</div>';
    el.content.innerHTML = html;

    var inp = document.getElementById('pe-val');
    if (inp && inp.tagName === 'INPUT') setTimeout(function() { inp.focus(); }, 0);

    document.getElementById('pe-cancel').addEventListener('click', function() {
      s.canvasMode = 'part-list'; renderCanvasStep();
    });
    var backBtn = document.getElementById('pe-back');
    if (backBtn) backBtn.addEventListener('click', function() { s.partSubStep--; renderCanvasStep(); });
    document.getElementById('pe-next').addEventListener('click', function() { savePartSubStep(p, fieldDef, fld); });
  }

  function savePartSubStep(p, fieldDef, fld) {
    var inp = document.getElementById('pe-val');
    if (!inp) return;
    if (fieldDef.type === 'toggle') {
      p[fieldDef.key] = inp.checked;
    } else if (fieldDef.type === 'role') {
      var roleIdx = parseInt(inp.value, 10);
      p._roleChoice = roleIdx;
      p.roleType    = roleIdx < 15 ? roleIdx : 14;
    } else {
      p[fieldDef.key] = inp.value;
    }
    if (s.partSubStep < fld.length - 1) {
      s.partSubStep++;
      renderCanvasStep();
    } else {
      s.canvasMode = 'part-list'; renderCanvasStep();
    }
  }

  // ── Canvas: Line item mini-wizard ──────────────────────────────────────────

  var LINE_EDIT_FIELDS = [
    { label: 'Name',      key: 'name',     type: 'text'   },
    { label: 'Amount',    key: 'amount',   type: 'number', hint: 'Fixed amount, or leave blank and set qty \u00d7 rate' },
    { label: 'Quantity',  key: 'qty',      type: 'number', hint: 'Leave blank = user fills in' },
    { label: 'Rate',      key: 'rate',     type: 'number', hint: 'Leave blank = user fills in' },
    { label: 'Line type', key: 'lineType', type: 'select', options: LINE_TYPES },
    { label: 'Tax mode',  key: 'taxMode',  type: 'select', options: TAX_MODES },
  ];

  function renderLineList() {
    if (el.csk) el.csk.textContent = 'Edit';
    if (el.rsk) el.rsk.textContent = '+ Add';
    var lines = s.tpl.compound_lines;
    var html  = '<div class="tc-hdr">Seed lines <span style="float:right;font-size:9px;color:var(--text-muted);">* = add</span></div>';
    html += '<div class="tc-field-row tc-toggle-row">' +
      '<label><input type="checkbox" id="ll-total"' + (s.tpl.hasTotalSummary ? ' checked' : '') + '> Total row</label>' +
      '<label style="margin-left:10px;"><input type="checkbox" id="ll-sub"' + (s.tpl.hasSubtotals ? ' checked' : '') + '> Subtotals</label>' +
    '</div>';
    if (!lines.length) {
      html += '<div class="empty-state" style="font-size:11px;padding:8px;">No seed lines.<br>Press * to add one.</div>';
    }
    lines.forEach(function(ln, i) {
      var foc = s.editingLineIdx === i ? ' focused' : '';
      var typeLabel = LINE_TYPES[ln.lineType || 0] || 'Standard';
      html += '<div class="tc-canvas-row' + foc + '" data-li="' + i + '">' +
        '<span class="tc-canvas-kind tc-kind-codec">L</span>' +
        '<div class="tc-canvas-mid">' +
          '<div class="tc-canvas-label">' + esc(ln.name || '(untitled)') + '</div>' +
          '<div class="tc-canvas-val">' + esc(typeLabel) +
            (ln.qty  !== '' && ln.qty  !== undefined ? ' \u00b7 qty:' + ln.qty  : '') +
            (ln.rate !== '' && ln.rate !== undefined ? ' \u00b7 @' + ln.rate    : '') +
          '</div>' +
        '</div>' +
        '<span class="tc-canvas-del" data-ldel="' + i + '">\u00d7</span>' +
      '</div>';
    });
    html += '<div class="tc-row-actions"><span class="badge" id="ll-done">Done</span></div>';
    el.content.innerHTML = html;

    var totalChk = document.getElementById('ll-total');
    var subChk   = document.getElementById('ll-sub');
    if (totalChk) totalChk.addEventListener('change', function() { s.tpl.hasTotalSummary = this.checked; });
    if (subChk)   subChk.addEventListener('change',   function() { s.tpl.hasSubtotals    = this.checked; });

    var done = document.getElementById('ll-done');
    if (done) done.addEventListener('click', function() { s.canvasMode = 'list'; renderCanvasStep(); });
    if (el.rsk) { el.rsk.onclick = function() { openLineEditor(-1); }; }
    bindClicks('.tc-canvas-row[data-li]', function(el2) {
      var i = parseInt(el2.getAttribute('data-li'), 10);
      if (!isNaN(i)) openLineEditor(i);
    });
    bindClicks('[data-ldel]', function(el2) {
      var i = parseInt(el2.getAttribute('data-ldel'), 10);
      if (!isNaN(i)) { s.tpl.compound_lines.splice(i, 1); renderLineList(); }
    });
  }

  function openLineEditor(idx) {
    if (idx === -1) {
      s.tpl.compound_lines.push({ name:'', amount:'', lineType:0, qty:'', rate:'', taxMode:0 });
      idx = s.tpl.compound_lines.length - 1;
    }
    s.editingLineIdx = idx;
    s.lineSubStep    = 0;
    s.canvasMode     = 'line-editor';
    renderCanvasStep();
  }

  function renderLineEditor() {
    var ln  = s.tpl.compound_lines[s.editingLineIdx];
    var fld = LINE_EDIT_FIELDS;
    var fieldDef = fld[s.lineSubStep];
    if (!fieldDef) { s.canvasMode = 'line-list'; renderCanvasStep(); return; }

    if (el.csk) el.csk.textContent = s.lineSubStep < fld.length - 1 ? 'Next' : 'Done';
    var html = '<div class="tc-hdr">Line ' + (s.editingLineIdx + 1) +
      ' \u2014 ' + (s.lineSubStep + 1) + '/' + fld.length + '</div>';
    html += '<div class="tc-field-row"><div class="tc-field-label">' + esc(fieldDef.label) + '</div>';

    if (fieldDef.type === 'select') {
      html += '<select class="field-input" id="le-val">' +
        fieldDef.options.map(function(o, i) {
          return '<option value="' + i + '"' + ((ln[fieldDef.key] || 0) === i ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select>';
    } else {
      html += '<input class="field-input" id="le-val" type="' + fieldDef.type + '" ' +
        'value="' + esc(ln[fieldDef.key] !== undefined ? String(ln[fieldDef.key]) : '') + '" ' +
        'autocomplete="off" autocorrect="off" spellcheck="false">' +
        (fieldDef.hint ? '<div style="font-size:10px;color:var(--text-muted);padding:2px 0;">' + esc(fieldDef.hint) + '</div>' : '');
    }
    html += '</div>';
    html += '<div class="tc-row-actions">' +
      '<span class="badge" id="le-cancel">Cancel</span>' +
      (s.lineSubStep > 0 ? '<span class="badge" id="le-back">Back</span>' : '') +
      '<span class="badge badge-accent" id="le-next">' + (s.lineSubStep < fld.length - 1 ? 'Next' : 'Done') + '</span>' +
    '</div>';
    el.content.innerHTML = html;

    var inp = document.getElementById('le-val');
    if (inp && inp.tagName === 'INPUT') setTimeout(function() { inp.focus(); }, 0);

    document.getElementById('le-cancel').addEventListener('click', function() {
      s.canvasMode = 'line-list'; renderCanvasStep();
    });
    var backBtn = document.getElementById('le-back');
    if (backBtn) backBtn.addEventListener('click', function() { s.lineSubStep--; renderCanvasStep(); });
    document.getElementById('le-next').addEventListener('click', function() { saveLineSubStep(ln, fieldDef); });
  }

  function saveLineSubStep(ln, fieldDef) {
    var inp = document.getElementById('le-val');
    if (!inp) return;
    if (fieldDef.type === 'select') ln[fieldDef.key] = parseInt(inp.value, 10);
    else if (fieldDef.type === 'number') ln[fieldDef.key] = inp.value !== '' ? parseFloat(inp.value) : '';
    else ln[fieldDef.key] = inp.value;

    if (s.lineSubStep < LINE_EDIT_FIELDS.length - 1) {
      s.lineSubStep++;
      renderCanvasStep();
    } else {
      s.canvasMode = 'line-list'; renderCanvasStep();
    }
  }

  // ── Canvas: Action items mini-wizard ──────────────────────────────────────

  var ACT_FIELDS = [
    { label: 'Title',  key: 'title', type: 'text' },
    { label: 'Notes',  key: 'notes', type: 'text' },
  ];

  function renderActionList() {
    if (el.csk) el.csk.textContent = 'Edit';
    if (el.rsk) { el.rsk.textContent = '+ Add'; el.rsk.onclick = function() { openActionEditor(-1); }; }
    var acts = s.tpl.actions;
    var html = '<div class="tc-hdr">Seed action items <span style="float:right;font-size:9px;color:var(--text-muted);">* = add</span></div>';
    if (!acts.length) {
      html += '<div class="empty-state" style="font-size:11px;padding:8px;">No seed actions.<br>Press * to add one.</div>';
    }
    acts.forEach(function(a, i) {
      var foc = s.editingActIdx === i ? ' focused' : '';
      html += '<div class="tc-canvas-row' + foc + '" data-ai="' + i + '">' +
        '<span class="tc-canvas-kind tc-kind-custom">A</span>' +
        '<div class="tc-canvas-mid">' +
          '<div class="tc-canvas-label">' + esc(a.title || '(untitled)') + '</div>' +
          (a.notes ? '<div class="tc-canvas-val">' + esc(a.notes.slice(0, 28)) + '</div>' : '') +
        '</div>' +
        '<span class="tc-canvas-del" data-adel="' + i + '">\u00d7</span>' +
      '</div>';
    });
    html += '<div class="tc-row-actions"><span class="badge" id="al-done">Done</span></div>';
    el.content.innerHTML = html;

    var done = document.getElementById('al-done');
    if (done) done.addEventListener('click', function() { s.canvasMode = 'list'; renderCanvasStep(); });
    bindClicks('.tc-canvas-row[data-ai]', function(el2) {
      var i = parseInt(el2.getAttribute('data-ai'), 10);
      if (!isNaN(i)) openActionEditor(i);
    });
    bindClicks('[data-adel]', function(el2) {
      var i = parseInt(el2.getAttribute('data-adel'), 10);
      if (!isNaN(i)) { s.tpl.actions.splice(i, 1); renderActionList(); }
    });
  }

  function openActionEditor(idx) {
    if (idx === -1) {
      s.tpl.actions.push({ title: '', notes: '' });
      idx = s.tpl.actions.length - 1;
    }
    s.editingActIdx = idx;
    s.actSubStep    = 0;
    s.canvasMode    = 'action-editor';
    renderCanvasStep();
  }

  function renderActionEditor() {
    var a   = s.tpl.actions[s.editingActIdx];
    var fld = ACT_FIELDS;
    var fieldDef = fld[s.actSubStep];
    if (!fieldDef) { s.canvasMode = 'action-list'; renderCanvasStep(); return; }

    if (el.csk) el.csk.textContent = s.actSubStep < fld.length - 1 ? 'Next' : 'Done';
    var html = '<div class="tc-hdr">Action ' + (s.editingActIdx + 1) +
      ' \u2014 ' + (s.actSubStep + 1) + '/' + fld.length + '</div>';
    html += '<div class="tc-field-row"><div class="tc-field-label">' + esc(fieldDef.label) + '</div>' +
      '<input class="field-input" id="ae-val" type="text" ' +
      'value="' + esc(a[fieldDef.key] || '') + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
      '</div>';
    html += '<div class="tc-row-actions">' +
      '<span class="badge" id="ae-cancel">Cancel</span>' +
      (s.actSubStep > 0 ? '<span class="badge" id="ae-back">Back</span>' : '') +
      '<span class="badge badge-accent" id="ae-next">' + (s.actSubStep < fld.length - 1 ? 'Next' : 'Done') + '</span>' +
    '</div>';
    el.content.innerHTML = html;

    var inp = document.getElementById('ae-val');
    if (inp) setTimeout(function() { inp.focus(); }, 0);

    document.getElementById('ae-cancel').addEventListener('click', function() {
      s.canvasMode = 'action-list'; renderCanvasStep();
    });
    var backBtn = document.getElementById('ae-back');
    if (backBtn) backBtn.addEventListener('click', function() { s.actSubStep--; renderCanvasStep(); });
    document.getElementById('ae-next').addEventListener('click', function() { saveActSubStep(a, fieldDef); });
  }

  function saveActSubStep(a, fieldDef) {
    var inp = document.getElementById('ae-val');
    if (!inp) return;
    a[fieldDef.key] = inp.value;
    if (s.actSubStep < ACT_FIELDS.length - 1) {
      s.actSubStep++;
      renderCanvasStep();
    } else {
      s.canvasMode = 'action-list'; renderCanvasStep();
    }
  }

  // ── Step: Synonyms ─────────────────────────────────────────────────────────

  function renderSynonymsStep() {
    if (el.csk) el.csk.textContent = 'Next';
    var global = GlobalSynonymsService.getAll();
    // Only show synonym-able fields that are in the current fieldOrder
    var synFields = s.tpl.fieldOrder.filter(function(key) {
      return CODEC_FIELDS[key] && CODEC_FIELDS[key].syn;
    });
    // Always show global synonyms editor even if field not in canvas
    var globalOnly = GlobalSynonymsService.SYNONYMABLE.filter(function(k) {
      return synFields.indexOf(k) === -1;
    });

    var html = '<div class="tc-hdr">Label synonyms</div>' +
      '<div style="font-size:10px;color:var(--text-muted);padding:3px 10px 6px;">Override field names for this template (or set global defaults below).</div>';

    if (synFields.length) {
      html += '<div class="tc-section-label">This template</div>';
      synFields.forEach(function(key) {
        var canon    = GlobalSynonymsService.canonicalLabel(key);
        var tplSyn   = s.tpl.fieldSynonyms[key] || '';
        var globSyn  = global[key] || '';
        html += '<div class="tc-syn-row">' +
          '<div class="tc-syn-canon">' + esc(canon) +
            (globSyn ? ' <span class="tc-syn-global">(' + esc(globSyn) + ')</span>' : '') +
          '</div>' +
          '<input class="tc-syn-inp field-input" data-skey="' + esc(key) + '" type="text" ' +
            'placeholder="' + esc(globSyn || canon) + '" ' +
            'value="' + esc(tplSyn) + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
        '</div>';
      });
    }

    if (globalOnly.length) {
      html += '<div class="tc-section-label">Global defaults</div>';
      globalOnly.slice(0, 8).forEach(function(key) {
        var canon   = GlobalSynonymsService.canonicalLabel(key);
        var globSyn = global[key] || '';
        html += '<div class="tc-syn-row">' +
          '<div class="tc-syn-canon">' + esc(canon) + '</div>' +
          '<input class="tc-syn-inp tc-syn-global-inp field-input" data-gkey="' + esc(key) + '" type="text" ' +
            'placeholder="' + esc(canon) + '" ' +
            'value="' + esc(globSyn) + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
        '</div>';
      });
    }

    el.content.innerHTML = html;
  }

  function readSynonyms() {
    var tplInps = el.content.querySelectorAll('[data-skey]');
    for (var i = 0; i < tplInps.length; i++) {
      var key = tplInps[i].getAttribute('data-skey');
      var val = tplInps[i].value.trim();
      if (val) s.tpl.fieldSynonyms[key] = val;
      else delete s.tpl.fieldSynonyms[key];
    }
    var globInps = el.content.querySelectorAll('[data-gkey]');
    for (var j = 0; j < globInps.length; j++) {
      GlobalSynonymsService.setOne(globInps[j].getAttribute('data-gkey'), globInps[j].value.trim());
    }
  }

  // ── Step: Routing ──────────────────────────────────────────────────────────

  function renderRoutingStep() {
    if (el.csk) el.csk.textContent = 'Next';
    var rd = s.tpl.routingDefaults;
    el.content.innerHTML =
      '<div class="tc-hdr">Routing defaults</div>' +
      '<div class="tc-field-row tc-toggle-row">' +
        '<input type="checkbox" id="rt-ack"' + (rd.ackRequest ? ' checked' : '') + '>' +
        '<label for="rt-ack" style="margin-left:6px;">Request read receipt (ackRequest)</label>' +
      '</div>' +
      '<div class="tc-field-row tc-toggle-row">' +
        '<input type="checkbox" id="rt-fwd"' + (rd.restrictForward ? ' checked' : '') + '>' +
        '<label for="rt-fwd" style="margin-left:6px;">Restrict forwarding (restrictForward)</label>' +
      '</div>' +
      '<div style="font-size:10px;color:var(--text-muted);padding:6px 10px;">These are defaults — user can override at share time.</div>';
  }

  function readRouting() {
    var ackInp = document.getElementById('rt-ack');
    var fwdInp = document.getElementById('rt-fwd');
    if (ackInp) s.tpl.routingDefaults.ackRequest     = ackInp.checked;
    if (fwdInp) s.tpl.routingDefaults.restrictForward = fwdInp.checked;
  }

  // ── Step: Review ───────────────────────────────────────────────────────────

  function renderReviewStep() {
    if (el.csk) el.csk.textContent = 'Save';
    var tpl      = s.tpl;
    var typeLabel = TYPE_OPTS.filter(function(t) { return t.value === tpl.record_type; }).map(function(t) { return t.label; })[0] || 'Job';
    var synCount  = Object.keys(tpl.fieldSynonyms).length;
    var visCount  = Object.keys(tpl.fieldVisibility).length;
    var cfCount   = tpl.customFields.length;
    var reqCount  = tpl.requiredFields.length;
    var partCount = tpl.participants.length;
    var lineCount = tpl.compound_lines.length;
    var actCount  = tpl.actions.length;

    el.content.innerHTML =
      '<div class="tc-hdr">Review &amp; save</div>' +
      '<div class="view-field"><div class="view-field-label">Name</div><div class="view-field-value">' + esc(tpl.name || '(unnamed)') + '</div></div>' +
      '<div class="view-field"><div class="view-field-label">Type</div><div class="view-field-value">' + esc(typeLabel) + '</div></div>' +
      '<div class="view-field"><div class="view-field-label">Canvas fields</div><div class="view-field-value">' + tpl.fieldOrder.length + ' fields</div></div>' +
      (cfCount ? '<div class="view-field"><div class="view-field-label">Custom fields</div><div class="view-field-value">' + cfCount + '</div></div>' : '') +
      (synCount ? '<div class="view-field"><div class="view-field-label">Synonyms</div><div class="view-field-value">' + synCount + ' overrides</div></div>' : '') +
      (visCount ? '<div class="view-field"><div class="view-field-label">Visibility rules</div><div class="view-field-value">' + visCount + ' fields</div></div>' : '') +
      (reqCount ? '<div class="view-field"><div class="view-field-label">Required fields</div><div class="view-field-value">' + reqCount + ' (gates share)</div></div>' : '') +
      (partCount ? '<div class="view-field"><div class="view-field-label">Seed participants</div><div class="view-field-value">' + partCount + '</div></div>' : '') +
      (lineCount ? '<div class="view-field"><div class="view-field-label">Seed lines</div><div class="view-field-value">' + lineCount + '</div></div>' : '') +
      (actCount  ? '<div class="view-field"><div class="view-field-label">Seed actions</div><div class="view-field-value">' + actCount + '</div></div>' : '') +
      (tpl.routingDefaults.ackRequest ? '<div class="view-field"><div class="view-field-label">Routing</div><div class="view-field-value">Read receipt default on</div></div>' : '') +
      '<div style="padding:8px 10px;font-size:10px;color:var(--text-muted);">Press Enter or Centre key to save.</div>';
  }

  // ── Save template ──────────────────────────────────────────────────────────

  function saveTemplate() {
    var tpl  = s.tpl;
    var name = tpl.name.trim();
    if (!name) { alert('Template name is required.'); return; }

    var payload = {
      name:            name,
      description:     tpl.description,
      iconColor:       tpl.iconColor,
      record_type:     tpl.record_type,
      record_class:    tpl.record_class,
      activityId:      tpl.activityId,
      fieldSynonyms:   tpl.fieldSynonyms,
      fieldVisibility: tpl.fieldVisibility,
      requiredFields:  tpl.requiredFields,
      routingDefaults: tpl.routingDefaults,
      customFields:    tpl.customFields,
      fieldOrder:      tpl.fieldOrder,
      participants:    tpl.participants,
      compound_lines:  tpl.compound_lines,
      actions:         tpl.actions,
      hasTotalSummary: tpl.hasTotalSummary,
      hasSubtotals:    tpl.hasSubtotals,
    };

    // Copy codec pre-fill values
    var wireFields = ['job','description','date','due_date','tag','context_label',
      'customer','customer_phone','worker','worker_amount','location','url',
      'attachment','meeting_time','start_time','end_time','currency','vat',
      'custom_tax_rate','service_ref','expiry_date','qty_unit','story','details'];
    for (var i = 0; i < wireFields.length; i++) {
      if (tpl[wireFields[i]] !== undefined) payload[wireFields[i]] = tpl[wireFields[i]];
    }

    var tid = s.editId;
    if (tid) RecordTemplateService.update(tid, payload);
    else tid = (RecordTemplateService.create(payload) || {}).id;

    if (s.adoptOnSave && tid) RecordTemplateService.importTemplate(tid);

    if (s.returnTo === 'list') App.showList();
    else if (s.adoptOnSave) App.showManagement({ tab: 'templates', tplScope: 'imported' });
    else App.showTemplates();
  }

  // ── Step navigation ────────────────────────────────────────────────────────

  function advanceStep() {
    var step = currentStepId();

    // Save current step data before advancing
    if (step === 'identity')  { if (!identityValid()) { alert('Template name is required.'); return; } readIdentity(); }
    if (step === 'synonyms')  { readSynonyms(); }
    if (step === 'routing')   { readRouting(); }
    if (step === 'review')    { saveTemplate(); return; }

    if (s.pipelineIdx < s.pipeline.length - 1) {
      s.pipelineIdx++;
      s.canvasMode = 'list';
      render();
    }
  }

  function retreatStep() {
    var step = currentStepId();

    // Canvas sub-mode back
    if (step === 'canvas') {
      if (s.canvasMode !== 'list') {
        if (s.canvasMode === 'field-editor' || s.canvasMode === 'add-field' || s.canvasMode === 'block-picker') {
          s.canvasMode = 'list'; renderCanvasStep(); return;
        }
        if (s.canvasMode === 'part-editor') {
          if (s.partSubStep > 0) { s.partSubStep--; renderCanvasStep(); }
          else { s.canvasMode = 'part-list'; renderCanvasStep(); }
          return;
        }
        if (s.canvasMode === 'line-editor') {
          if (s.lineSubStep > 0) { s.lineSubStep--; renderCanvasStep(); }
          else { s.canvasMode = 'line-list'; renderCanvasStep(); }
          return;
        }
        if (s.canvasMode === 'part-list' || s.canvasMode === 'line-list' || s.canvasMode === 'action-list') {
          s.canvasMode = 'list'; renderCanvasStep(); return;
        }
        if (s.canvasMode === 'action-editor') {
          if (s.actSubStep > 0) { s.actSubStep--; renderCanvasStep(); }
          else { s.canvasMode = 'action-list'; renderCanvasStep(); }
          return;
        }
      }
    }

    if (s.pipelineIdx > 0) {
      s.pipelineIdx--;
      s.canvasMode = 'list';
      render();
    } else {
      // Back on first step → exit creator
      if (s.returnTo === 'list') App.showList();
      else App.showTemplates();
    }
  }

  // ── Key handler ────────────────────────────────────────────────────────────

  function onKey(key) {
    var step = currentStepId();
    var inInput = (function() {
      var ae = document.activeElement;
      return ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT');
    }());

    // Star key — context action per canvas mode
    if (key === '*' && step === 'canvas') {
      if (s.canvasMode === 'list')        { s.canvasMode = 'block-picker'; s.blockFocusIdx = 0; renderCanvasStep(); return; }
      if (s.canvasMode === 'part-list')   { openPartEditor(-1);  return; }
      if (s.canvasMode === 'line-list')   { openLineEditor(-1);  return; }
      if (s.canvasMode === 'action-list') { openActionEditor(-1); return; }
    }
    // Hash key — add custom field (canvas list mode)
    if (key === '#' && step === 'canvas' && s.canvasMode === 'list') {
      openAddField(); return;
    }

    // Steps where Enter/SoftRight should advance even while an input is focused
    var advancesFromInput = (step === 'synonyms' || step === 'routing');

    if (key === 'Backspace' && !inInput) { retreatStep(); return; }
    if (key === 'SoftLeft'  && !inInput) { retreatStep(); return; }
    if (key === 'Enter'     && (!inInput || advancesFromInput)) { handleEnterKey(step); return; }

    // RSK: open block picker on canvas, advance on other steps
    if (key === 'SoftRight') {
      if (step === 'canvas' && s.canvasMode === 'list' && !inInput) {
        s.canvasMode = 'block-picker'; s.blockFocusIdx = 0; renderCanvasStep();
      } else if (step === 'canvas' && (s.canvasMode === 'part-list' || s.canvasMode === 'line-list' || s.canvasMode === 'action-list') && !inInput) {
        if (s.canvasMode === 'part-list')   openPartEditor(-1);
        else if (s.canvasMode === 'action-list') openActionEditor(-1);
        else openLineEditor(-1);
      } else if (!inInput || advancesFromInput) {
        advanceStep();
      }
      return;
    }

    // Step-specific navigation
    if (step === 'type')   { typeStepNav(key); return; }
    if (step === 'canvas') { canvasStepNav(key, inInput); return; }
  }

  function handleEnterKey(step) {
    if (step === 'type') {
      selectType(TYPE_OPTS[s.typeFocusIdx].value); return;
    }
    if (step === 'review') { saveTemplate(); return; }
    if (step === 'canvas' && s.canvasMode === 'block-picker') {
      insertBlock(BLOCKS[s.blockFocusIdx]); return;
    }
    // Canvas list: Enter = Next (row editing via click/tap)
    advanceStep();
  }

  function typeStepNav(key) {
    if (key === 'ArrowUp'   && s.typeFocusIdx > 0)                       { s.typeFocusIdx--; renderTypeStep(); }
    if (key === 'ArrowDown' && s.typeFocusIdx < TYPE_OPTS.length - 1)    { s.typeFocusIdx++; renderTypeStep(); }
    if (key === 'Enter') { selectType(TYPE_OPTS[s.typeFocusIdx].value); }
  }

  function canvasStepNav(key, inInput) {
    var mode = s.canvasMode;
    if (mode === 'block-picker') {
      if (key === 'ArrowUp'   && s.blockFocusIdx > 0)                { s.blockFocusIdx--; applyListFocus('.tc-type-row[data-blk]', s.blockFocusIdx); }
      if (key === 'ArrowDown' && s.blockFocusIdx < BLOCKS.length - 1){ s.blockFocusIdx++; applyListFocus('.tc-type-row[data-blk]', s.blockFocusIdx); }
      return;
    }
    if (mode === 'list') {
      var maxIdx = s.tpl.fieldOrder.length; // includes "+" row
      if (key === 'ArrowUp'   && s.canvasFocusIdx > 0)    { s.canvasFocusIdx--; applyCanvasFocus(); }
      if (key === 'ArrowDown' && s.canvasFocusIdx < maxIdx){ s.canvasFocusIdx++; applyCanvasFocus(); }
    }
  }

  // ── Utility helpers ────────────────────────────────────────────────────────

  function applyListFocus(selector, idx) {
    var nodes = el.content.querySelectorAll(selector);
    nodes.forEach(function(n) { n.classList.remove('focused'); });
    if (idx >= 0 && idx < nodes.length) {
      nodes[idx].classList.add('focused');
      nodes[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  function bindClicks(selector, handler) {
    var nodes = el.content.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      (function(node) {
        node.addEventListener('click', function(e) {
          e.stopPropagation();
          handler(node);
        });
      })(nodes[i]);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function onShow(opts) {
    resetState(opts || {});
    // CSK clicks are routed via browser-dev.js click→keydown(Enter)→onKey.
    // No direct onclick here — avoids double-fire advancing two steps at once.
    if (el.csk) el.csk.onclick = null;
    render();
  }

  global.TemplateCreatorScreen = {
    onShow: onShow,
    onKey:  onKey,
  };

}(window));
