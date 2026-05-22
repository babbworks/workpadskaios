// Screen: Wizard — PADS class defaults to 4 screens (Process / Actions / Details / Story)
// Exposes: window.WizardScreen

(function(global) {
  'use strict';

  var SCREENS_BASE = [
    { name: 'Process',    tab: 'P' },
    { name: 'Actions',    tab: 'A' },
    { name: 'Details',    tab: 'D' },
    { name: 'Story',      tab: 'S' },
  ];
  var SCREENS_FIN = [
    { name: 'Process',    tab: 'P' },
    { name: 'Actions',    tab: 'A' },
    { name: 'Details',    tab: 'D' },
    { name: 'Story',      tab: 'S' },
    { name: 'Financials', tab: 'F' },
  ];
  var SCREENS_CONTACT = [
    { name: 'Identity', tab: 'I' },
    { name: 'Details',  tab: 'D' },
    { name: 'Notes',    tab: 'N' },
  ];

  var FIN_TABS = ['Amount', 'Expenses', 'Payments'];

  var WIZ_TYPES = [
    { value: '',        label: 'Job'     },
    { value: 'quote',   label: 'Quote'   },
    { value: 'invoice', label: 'Invoice' },
    { value: 'receipt', label: 'Receipt' },
    { value: 'pads',    label: 'Basic'   },
    { value: 'contact', label: 'Contact' },
  ];

  var el = {
    title:   document.getElementById('wizard-title'),
    tabs:    document.getElementById('wizard-tabs').querySelectorAll('.wizard-tab'),
    dots:    document.getElementById('wizard-dots').querySelectorAll('.wizard-dot'),
    content: document.getElementById('wizard-content'),
    csk:     document.getElementById('wiz-csk'),
  };

  var currentRecord    = null;
  var currentScreen    = 0;
  var actions          = [];
  var actionFocusIdx   = 0;
  var backFocused      = false;
  var finTab           = 0;   // 0=Amount, 1=Expenses, 2=Payments
  var cachedChildren   = [];  // child records loaded from DB (expenses + payments)
  var finFocusIdx      = 0;
  var entryRecord      = null; // set when editing from view — used for goBack / post-save nav
  var typePickerOpen   = false;
  var typePickerFocusIdx = 0;
  var detailsMoreOpen  = false;
  var participantsOpen = false;
  var partAddOpen      = false;
  var partEditIdx      = -1;
  var finQtyRateOpen   = false;
  var finLinesOpen     = false;
  var finLineAddOpen   = false;
  var finLineEditIdx   = -1;
  var cachedContacts   = null;  // null=not loaded; []=no contacts; [...]=contacts
  var progressiveExpanded = false;

  function useProgressiveForm() {
    return global.ProgressiveForm && ProgressiveForm.enabled() &&
      currentRecord && !currentRecord.id &&
      !isPadsClass(currentRecord) && !isContactType(currentRecord);
  }

  function useInOutFrame() {
    return global.InOutFrame && InOutFrame.enabled() &&
      currentRecord && !isPadsClass(currentRecord) && !isContactType(currentRecord);
  }

  function onActionsScreen() {
    if (useInOutFrame()) return InOutFrame.renderKind(currentScreen, currentRecord) === 'inputs';
    return currentScreen === 1 && !isPadsClass(currentRecord);
  }

  function onFinancialScreen() {
    if (useInOutFrame()) return InOutFrame.renderKind(currentScreen, currentRecord) === 'outputs';
    return hasFinancialStep() && currentScreen === 4;
  }

  function partRoleOpts() {
    return (global.WPRoles && WPRoles.quickRoleOptions)
      ? WPRoles.quickRoleOptions()
      : [
        { val: 0, label: 'Customer' },
        { val: 1, label: 'Worker'   },
        { val: 2, label: 'Supplier' },
        { val: 3, label: 'Other'    },
      ];
  }

  var CAT_OPTS = [
    { val: '0',  label: 'Customer'       },
    { val: '1',  label: 'Client'         },
    { val: '2',  label: 'Vendor'         },
    { val: '3',  label: 'Supplier'       },
    { val: '4',  label: 'Contractor'     },
    { val: '5',  label: 'Sub-contractor' },
    { val: '6',  label: 'Partner'        },
    { val: '7',  label: 'Employee'       },
    { val: '8',  label: 'Agent'          },
    { val: '9',  label: 'Accountant'     },
    { val: '10', label: 'Bank / Lender'  },
    { val: '11', label: 'Insurer'        },
    { val: '12', label: 'Landlord'       },
    { val: '13', label: 'Government'     },
    { val: '14', label: 'Utility'        },
    { val: '15', label: 'Referral'       },
    { val: '16', label: 'Prospect'       },
    { val: '17', label: 'General'        },
  ];
  var CAT_LABELS = {
    0: 'Customer', 1: 'Client',       2: 'Vendor',       3: 'Supplier',
    4: 'Contractor', 5: 'Sub-contractor', 6: 'Partner',  7: 'Employee',
    8: 'Agent',    9: 'Accountant',  10: 'Bank / Lender', 11: 'Insurer',
   12: 'Landlord', 13: 'Government', 14: 'Utility',     15: 'Referral',
   16: 'Prospect', 17: 'General',
  };

  var LINE_TYPE_OPTS = [
    { val: '0', label: 'Standard' },
    { val: '1', label: 'Discount' },
    { val: '2', label: 'Tax line' },
    { val: '3', label: 'Header'   },
  ];
  var TAX_MODE_OPTS = [
    { val: '0', label: 'No tax'    },
    { val: '1', label: 'Inclusive' },
    { val: '2', label: 'Exclusive' },
    { val: '3', label: 'Compound'  },
  ];

  function partRoleLabel(p) {
    if (global.WPRoles && WPRoles.quickRoleLabel) {
      return WPRoles.quickRoleLabel(p.role != null ? p.role : 0, p.role_text);
    }
    if (p.role === 3 && p.role_text) return p.role_text;
    return 'Participant';
  }

  function generateRecordUid() {
    return 'wp:' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 8);
  }

  function currencyTabLabel() {
    var locale = ActivityService.getLocale();
    var c = (locale && locale.currency) || '';
    if (c === 'GBP') return '\u00a3';
    if (c === 'USD' || c === 'CAD' || c === 'AUD' || c === 'NZD') return '$';
    if (c === 'EUR') return '\u20ac';
    if (c === 'JPY' || c === 'CNY') return '\u00a5';
    if (c === 'INR') return '\u20b9';
    return 'Fin';
  }

  function isPadsClass(rec) {
    var c = rec && (rec.record_class || rec.recordClass || rec.record_type || rec.recordType);
    return String(c || '').toLowerCase() === 'pads';
  }

  function isContactType(rec) {
    var t = String((rec && rec.record_type)  || '').toLowerCase();
    var c = String((rec && rec.record_class) || '').toLowerCase();
    return t === 'contact' || c === 'contact';
  }

  function hasFinancialStep() {
    return !isPadsClass(currentRecord) && !isContactType(currentRecord);
  }

  function getScreens() {
    if (isContactType(currentRecord)) return SCREENS_CONTACT;
    if (useInOutFrame()) return InOutFrame.screensFor(currentRecord);
    if (useProgressiveForm() && ProgressiveForm.shouldLimitScreens(currentRecord, progressiveExpanded)) {
      return [{ name: ProgressiveForm.outcomeLabel(), tab: 'O' }];
    }
    return hasFinancialStep() ? SCREENS_FIN : SCREENS_BASE;
  }

  // ── Progress indicators ──────────────────────────────────────────────────

  function updateProgress() {
    var screens = getScreens();
    el.tabs.forEach(function(t, i) {
      t.classList.toggle('active', i === currentScreen);
      if (!screens[i]) {
        t.textContent = '';
        t.style.display = 'none';
        return;
      }
      t.style.display = '';
      if (!useInOutFrame() && i === 4) t.textContent = currencyTabLabel();
      else if (useInOutFrame() && InOutFrame.hasFinancial(currentRecord) &&
               i === InOutFrame.outputsScreenIndex(currentRecord)) {
        t.textContent = currencyTabLabel();
      } else t.textContent = screens[i].tab;
    });
    el.dots.forEach(function(d, i) {
      if (!screens[i]) {
        d.style.display = 'none';
        return;
      }
      d.style.display = '';
      d.classList.toggle('active', i === currentScreen);
    });
    el.title.textContent = screens[currentScreen].name;
  }

  function updateSoftkeys() {
    el.csk.textContent = currentScreen < (getScreens().length - 1) ? 'Next' : 'Save';
  }

  // ── Field helpers ────────────────────────────────────────────────────────

  function fieldGroup(id, label, value, type) {
    var html;
    if (global.UIFields) html = UIFields.fieldGroup(id, label, value, type, 'f-');
    else {
      html = '<div class="field-group">' +
        '<div class="field-label">' + label + '</div>' +
        '<input class="field-input" id="f-' + id + '" type="' + (type || 'text') + '" ' +
          'value="' + esc(value) + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
        '</div>';
    }
    if (global.CaptureLens && CaptureLens.enabled()) {
      var lens = CaptureLens.fieldLens(id);
      html = html.replace('<div class="field-group">', '<div class="field-group" data-lens="' + lens + '">');
    }
    return html;
  }

  function lensPrefix(screenKind) {
    if (!global.CaptureLens || !CaptureLens.enabled()) return '';
    return CaptureLens.barHtml(CaptureLens.get()) + CaptureLens.screenHint(CaptureLens.get(), screenKind);
  }

  function finishRenderLens() {
    if (!global.CaptureLens || !CaptureLens.enabled()) return;
    var bar = el.content.querySelector('[data-lens-bar]');
    if (bar) {
      CaptureLens.wireBar(bar, function() { renderCurrentScreen(); });
    }
    CaptureLens.applyVisibility(el.content, CaptureLens.get());
  }

  function selectGroup(id, label, opts, selected) {
    if (global.UIFields) return UIFields.selectGroup(id, label, opts, selected, 'f-');
    var options = opts.map(function(o) {
      return '<option value="' + esc(o.val) + '"' + (o.val === selected ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
    return '<div class="field-group">' +
      '<div class="field-label">' + label + '</div>' +
      '<select class="field-input" id="f-' + id + '">' + options + '</select>' +
      '</div>';
  }

  // ── Read inputs ──────────────────────────────────────────────────────────

  function readInputs() {
    if (!currentRecord) return;
    var ids = ['job','customer','date','date_end','location','start_time','end_time',
               'meeting_time','customer_phone','worker','details','story',
               'ref_number','tag','context_label','url',
               'alt_phone','website','social_handle','business_hours','meeting_location',
               'attachment'];
    ids.forEach(function(id) {
      var inp = document.getElementById('f-' + id);
      if (inp) currentRecord[id] = inp.value.trim() || undefined;
    });
    // category is an integer enum
    var catInp = document.getElementById('f-category');
    if (catInp) {
      var catVal = parseInt(catInp.value, 10);
      currentRecord.category = isNaN(catVal) ? undefined : catVal;
    }
    if (isPadsClass(currentRecord)) {
      var pIn = document.getElementById('f-pads-process');
      var aIn = document.getElementById('f-pads-actions');
      var dIn = document.getElementById('f-pads-details');
      var sIn = document.getElementById('f-pads-story');
      if (pIn) currentRecord.pads_process = pIn.value.trim() || undefined;
      if (aIn) currentRecord.pads_actions = aIn.value.trim() || undefined;
      if (dIn) currentRecord.pads_details = dIn.value.trim() || undefined;
      if (sIn) currentRecord.pads_story = sIn.value.trim() || undefined;
      currentRecord.actions = undefined;
      return;
    }
    // Project field: combine with free tags into tag field using proj: prefix
    var projInp = document.getElementById('f-project');
    if (projInp !== null) {
      var projVal = projInp.value.trim();
      var freeTag = (currentRecord.tag || '').trim();
      var tagParts = [];
      if (projVal) tagParts.push('proj:' + projVal);
      if (freeTag) tagParts.push(freeTag);
      currentRecord.tag = tagParts.join(',') || undefined;
    }

    var actSel = document.getElementById('f-activity-id');
    if (actSel !== null) currentRecord.activityId = actSel.value || undefined;
    currentRecord.actions = actions.slice();
    // Financial fields (screen 4)
    var finIds = ['fin-record_type', 'fin-amount', 'fin-currency', 'fin-vat', 'fin-due_date', 'fin-qty_unit', 'fin-qty', 'fin-rate', 'fin-custom_tax_rate',
                  'fin-service_ref', 'fin-expiry_date', 'fin-worker_amount'];
    var lnTotalEl = document.getElementById('fin-lines-total-summary');
    if (lnTotalEl) currentRecord.compound_lines_total_summary = lnTotalEl.checked;
    var lnSubtotEl = document.getElementById('fin-lines-subtotals');
    if (lnSubtotEl) currentRecord.compound_lines_subtotals = lnSubtotEl.checked;
    finIds.forEach(function(id) {
      var inp = document.getElementById('f-' + id);
      if (inp) {
        var key = id.replace('fin-', '');
        if (key === 'currency') {
          // Empty = use locale default; non-empty = explicit override
          var locale = ActivityService.getLocale();
          currentRecord.currency = inp.value.trim() || locale.currency;
        } else {
          currentRecord[key] = inp.value.trim() || undefined;
        }
      }
    });
  }

  // ── Screen 0: Process ────────────────────────────────────────────────────

  function renderProcess() {
    var r = currentRecord;
    if (isPadsClass(r)) {
      el.content.innerHTML =
        '<div class="field-group">' +
          '<div class="field-label">Process</div>' +
          '<textarea class="field-input" id="f-pads-process" rows="8" style="height:132px;resize:none;">' +
            esc(r.pads_process || r.job || '') + '</textarea>' +
        '</div>';
      var padsFirst = document.getElementById('f-pads-process');
      if (padsFirst) padsFirst.focus();
      return;
    }
    if (useProgressiveForm()) {
      el.content.innerHTML = lensPrefix('process') +
        ProgressiveForm.renderProcessPanel(r, progressiveExpanded, fieldGroup);
      var moreBtn = document.getElementById('prog-form-more');
      if (moreBtn) {
        moreBtn.onclick = function() {
          progressiveExpanded = true;
          renderCurrentScreen();
        };
      }
      var firstP = document.getElementById('f-job');
      if (firstP) firstP.focus();
      finishRenderLens();
      return;
    }
    var jobLbl = (global.GlobalSynonymsService)
      ? (GlobalSynonymsService.resolve('job', null) || 'Job') + ' *'
      : 'Job *';
    var hdr = useInOutFrame()
      ? InOutFrame.frameHeader('Outcome', 'What is needed — stated plainly')
      : '';
    el.content.innerHTML = lensPrefix('process') + hdr +
      fieldGroup('job',      jobLbl,    r.job      || '') +
      fieldGroup('customer', 'Customer', r.customer || '') +
      fieldGroup('date',     'Date',     r.date     || '', 'date') +
      fieldGroup('date_end', 'End date', r.date_end || '', 'date');
    var first = document.getElementById('f-job');
    if (first) first.focus();
    finishRenderLens();
  }

  function renderInOutInputs() {
    var r = currentRecord;
    var html = InOutFrame.frameHeader('Inputs', 'Activity inputs — who does the work');
    var workerDefault = r.worker || ActivityService.getSenderIdentity().name || '';
    var acts = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];
    if (acts.length) {
      html += '<div class="field-group"><div class="field-label">Activity</div>' +
        '<select class="field-input" id="f-activity-id"><option value="">— None —</option>' +
        acts.map(function(a) {
          return '<option value="' + esc(a.id) + '"' + (a.id === (r.activityId || '') ? ' selected' : '') + '>' +
            esc(a.name) + '</option>';
        }).join('') +
        '</select></div>';
    }
    html += fieldGroup('worker', 'Worker', workerDefault) +
      fieldGroup('customer_phone', 'Phone', r.customer_phone || '') +
      fieldGroup('location', 'Location', r.location || '');
    html += '<div class="io-frame-hdr" style="margin-top:8px;" data-lens-region="words">Actions</div>';
    el.content.innerHTML = lensPrefix('inputs') + html;
    var addFocused = actionFocusIdx === actions.length;
    var actHtml = actions.map(function(a, i) {
      var focused = i === actionFocusIdx ? ' focused' : '';
      return '<div class="action-item' + focused + '" data-lens="words">' +
        '<div class="action-item-title">' + esc(a.title || '(untitled)') + '</div>' +
        (a.notes ? '<div style="font-size:10px;color:var(--text-muted);">' + esc(a.notes) + '</div>' : '') +
        '</div>';
    }).join('');
    actHtml += '<div class="action-add-btn' + (addFocused ? ' focused' : '') + '" id="action-add" data-lens="words">+ Add action</div>';
    el.content.innerHTML += '<div data-lens-region="words">' + actHtml + '</div>';
    var addBtn = document.getElementById('action-add');
    if (addBtn) addBtn.addEventListener('click', promptAddAction);
    var wIn = document.getElementById('f-worker');
    if (wIn) wIn.focus();
    finishRenderLens();
  }

  // ── Screen 1: Actions ────────────────────────────────────────────────────

  function renderActions() {
    if (isPadsClass(currentRecord)) {
      el.content.innerHTML =
        '<div class="field-group">' +
          '<div class="field-label">Actions</div>' +
          '<textarea class="field-input" id="f-pads-actions" rows="8" style="height:132px;resize:none;">' +
            esc(currentRecord.pads_actions || '') + '</textarea>' +
        '</div>';
      var padsFirst = document.getElementById('f-pads-actions');
      if (padsFirst) padsFirst.focus();
      return;
    }
    var addFocused = actionFocusIdx === actions.length;
    var html = actions.map(function(a, i) {
      var focused = i === actionFocusIdx ? ' focused' : '';
      return '<div class="action-item' + focused + '" data-lens="words">' +
        '<div class="action-item-title">' + esc(a.title || '(untitled)') + '</div>' +
        (a.notes
          ? '<div style="font-size:10px;color:var(--text-muted);padding:1px 0 0 2px;">' + esc(a.notes) + '</div>'
          : '') +
        '</div>';
    }).join('');
    html += '<div class="action-add-btn' + (addFocused ? ' focused' : '') + '" id="action-add" data-lens="words">' +
      '+ Add action</div>';
    el.content.innerHTML = lensPrefix('inputs') +
      '<div data-lens-region="words">' + html + '</div>';
    var addBtn = document.getElementById('action-add');
    if (addBtn) addBtn.addEventListener('click', promptAddAction);
    finishRenderLens();
  }

  function navigateActions(dir) {
    actionFocusIdx = Math.max(0, Math.min(actions.length, actionFocusIdx + dir));
    renderActions();
  }

  function promptAddAction() {
    var title = window.prompt('Action title:');
    if (title && title.trim()) {
      actions.push({ title: title.trim(), notes: '' });
      actionFocusIdx = actions.length;
      renderActions();
    }
  }

  function promptActionNote() {
    var a = actions[actionFocusIdx];
    if (!a) return;
    var note = window.prompt('Note for "' + a.title + '":', a.notes || '');
    if (note !== null) {
      actions[actionFocusIdx].notes = note.trim();
      renderActions();
    }
  }

  function removeFocusedAction() {
    if (actionFocusIdx < 0 || actionFocusIdx >= actions.length) return;
    var a = actions[actionFocusIdx];
    if (confirm('Delete action: ' + (a.title || '(untitled)') + '?')) {
      actions.splice(actionFocusIdx, 1);
      if (actionFocusIdx > actions.length) actionFocusIdx = actions.length;
      renderActions();
    }
  }

  // ── Participants helpers ─────────────────────────────────────────────────

  function renderParticipantsSection() {
    var parts = (currentRecord && currentRecord.participants) || [];
    var count = parts.length;
    var caret = participantsOpen ? '&#9652;' : '&#9662;';
    var hdrLabel = 'Participants' + (count ? ' (' + count + ')' : '');
    var hdrHtml = '<div class="field-more-hdr" id="parts-more-hdr"><span>' + hdrLabel + '</span><span>' + caret + '</span></div>';

    if (!participantsOpen) return hdrHtml;

    var listHtml = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      listHtml +=
        '<div class="wiz-part-row" data-part-idx="' + i + '">' +
          '<span class="wiz-part-name">' + esc(p.name || '') + '</span>' +
          '<span class="wiz-part-role">' + esc(partRoleLabel(p)) + '</span>' +
          '<span class="wiz-part-del" data-del-idx="' + i + '">\u00d7</span>' +
        '</div>';
    }

    var bodyHtml;
    if (partAddOpen) {
      var editP = partEditIdx >= 0 ? (parts[partEditIdx] || {}) : {};
      var roleVal = editP.role != null ? editP.role : 0;
      var roleOpts = partRoleOpts().map(function(o) {
        return '<option value="' + o.val + '"' + (o.val === roleVal ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('');
      var contactPickHtml = '';
      if (cachedContacts && cachedContacts.length > 0 && partEditIdx < 0) {
        var cOpts = '<option value="">— From contact —</option>' +
          cachedContacts.map(function(c) {
            return '<option value="' + esc(c.name) + '\u001f' + esc(c.phone || '') + '">' +
              esc(c.name) + (c.phone ? ' \u00b7 ' + esc(c.phone) : '') + '</option>';
          }).join('');
        contactPickHtml = '<select class="field-input" id="part-f-contact">' + cOpts + '</select>';
      }
      bodyHtml = listHtml +
        '<div class="wiz-part-form">' +
          contactPickHtml +
          '<input class="field-input" id="part-f-name" type="text" placeholder="Name *" value="' + esc(editP.name || '') + '" autocomplete="off" autocorrect="off">' +
          '<select class="field-input" id="part-f-role">' + roleOpts + '</select>' +
          '<input class="field-input" id="part-f-role-text" type="text" placeholder="Custom role" value="' + esc(editP.role_text || '') + '" autocomplete="off"' +
            (roleVal === 3 ? '' : ' style="display:none"') + '>' +
          '<input class="field-input" id="part-f-trading-name" type="text" placeholder="Trading name" value="' + esc(editP.trading_name || '') + '" autocomplete="off">' +
          '<input class="field-input" id="part-f-email" type="email" placeholder="Email (optional)" value="' + esc(editP.email || '') + '" autocomplete="off">' +
          '<input class="field-input" id="part-f-phone" type="tel" placeholder="Phone (optional)" value="' + esc(editP.phone || '') + '" autocomplete="off">' +
          '<label class="wiz-part-check-row"><input type="checkbox" id="part-f-is-org"' + (editP.is_org ? ' checked' : '') + '> Organisation</label>' +
          '<div class="wiz-part-signals">' +
            '<label class="wiz-part-signal-chk"><input type="checkbox" id="part-f-cert"' + (editP.cert ? ' checked' : '') + '> CERT</label>' +
            '<label class="wiz-part-signal-chk"><input type="checkbox" id="part-f-auth"' + (editP.auth ? ' checked' : '') + '> AUTH</label>' +
            '<label class="wiz-part-signal-chk"><input type="checkbox" id="part-f-lead"' + (editP.lead ? ' checked' : '') + '> LEAD</label>' +
          '</div>' +
          '<select class="field-input" id="part-f-alt-id-type">' +
            '<option value="">— Alt ID type —</option>' +
            '<option value="1"' + ((editP.altId && editP.altId.type === 1) ? ' selected' : '') + '>Tax / National ID</option>' +
            '<option value="2"' + ((editP.altId && editP.altId.type === 2) ? ' selected' : '') + '>VAT number</option>' +
            '<option value="3"' + ((editP.altId && editP.altId.type === 3) ? ' selected' : '') + '>Company reg</option>' +
            '<option value="4"' + ((editP.altId && editP.altId.type === 4) ? ' selected' : '') + '>Other</option>' +
          '</select>' +
          '<input class="field-input" id="part-f-alt-id-value" type="text" placeholder="Alt ID value" value="' + esc((editP.altId && editP.altId.value) || '') + '" autocomplete="off">' +
          '<div class="wiz-part-form-btns">' +
            '<span class="wiz-part-cancel-btn" id="part-cancel">Cancel</span>' +
            '<span class="wiz-part-save-btn" id="part-save">Save</span>' +
          '</div>' +
        '</div>';
    } else {
      bodyHtml = listHtml +
        '<div class="wiz-part-add-btn" id="part-add-btn">+ Add participant</div>';
    }

    return hdrHtml + bodyHtml;
  }

  function savePartForm() {
    var nameInp      = document.getElementById('part-f-name');
    var roleSel      = document.getElementById('part-f-role');
    var roleTextInp  = document.getElementById('part-f-role-text');
    var tradeInp     = document.getElementById('part-f-trading-name');
    var emailInp     = document.getElementById('part-f-email');
    var phoneInp     = document.getElementById('part-f-phone');
    var isOrgInp     = document.getElementById('part-f-is-org');
    var altIdTypeSel = document.getElementById('part-f-alt-id-type');
    var altIdValInp  = document.getElementById('part-f-alt-id-value');
    if (!nameInp) return;
    var name = nameInp.value.trim();
    if (!name) { alert('Name is required.'); return; }
    var role       = parseInt(roleSel ? roleSel.value : '0', 10);
    var roleText   = (role === 3 && roleTextInp) ? roleTextInp.value.trim() : undefined;
    var phone      = phoneInp ? (phoneInp.value.trim() || undefined) : undefined;
    var email      = emailInp ? (emailInp.value.trim() || undefined) : undefined;
    var trade      = tradeInp ? (tradeInp.value.trim() || undefined) : undefined;
    var isOrg      = isOrgInp ? isOrgInp.checked : false;
    var altIdType  = altIdTypeSel ? parseInt(altIdTypeSel.value || '0', 10) : 0;
    var altIdValue = altIdValInp ? altIdValInp.value.trim() : '';
    var certInp    = document.getElementById('part-f-cert');
    var authInp    = document.getElementById('part-f-auth');
    var leadInp    = document.getElementById('part-f-lead');
    var part = { name: name, role: role };
    if (roleText)      part.role_text    = roleText;
    if (phone)         part.phone        = phone;
    if (email)         part.email        = email;
    if (trade)         part.trading_name = trade;
    if (isOrg)         part.is_org       = true;
    if (certInp && certInp.checked) part.cert = true;
    if (authInp && authInp.checked) part.auth = true;
    if (leadInp && leadInp.checked) part.lead = true;
    if (altIdType && altIdValue) part.altId = { type: altIdType, value: altIdValue };
    if (!currentRecord.participants) currentRecord.participants = [];
    if (partEditIdx >= 0) {
      currentRecord.participants[partEditIdx] = part;
    } else {
      currentRecord.participants.push(part);
    }
    partAddOpen  = false;
    partEditIdx  = -1;
    renderDetails();
  }

  function wireParticipants() {
    var hdr = document.getElementById('parts-more-hdr');
    if (hdr) {
      hdr.addEventListener('click', function() {
        var st = el.content.scrollTop;
        readInputs();
        participantsOpen = !participantsOpen;
        if (!participantsOpen) { partAddOpen = false; partEditIdx = -1; }
        renderDetails();
        el.content.scrollTop = st;
      });
    }

    var addBtn = document.getElementById('part-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        partAddOpen = true;
        partEditIdx = -1;
        if (cachedContacts === null) {
          BlockRegistry.list().then(function(contacts) {
            cachedContacts = contacts || [];
            renderDetails();
          });
        } else {
          renderDetails();
        }
      });
    }

    var saveBtn = document.getElementById('part-save');
    if (saveBtn) saveBtn.addEventListener('click', savePartForm);

    var cancelBtn = document.getElementById('part-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        partAddOpen = false;
        partEditIdx = -1;
        renderDetails();
      });
    }

    var roleSel = document.getElementById('part-f-role');
    if (roleSel) {
      roleSel.addEventListener('change', function() {
        var rt = document.getElementById('part-f-role-text');
        if (rt) rt.style.display = (this.value === '3') ? 'block' : 'none';
      });
    }

    // Contact picker — pre-fills name + phone when a contact is selected
    var contactPickSel = document.getElementById('part-f-contact');
    if (contactPickSel) {
      contactPickSel.addEventListener('change', function() {
        var val = this.value;
        if (!val) return;
        var sep = val.indexOf('\u001f');
        var cName  = sep >= 0 ? val.slice(0, sep)   : val;
        var cPhone = sep >= 0 ? val.slice(sep + 1)  : '';
        var nameInp  = document.getElementById('part-f-name');
        var phoneInp = document.getElementById('part-f-phone');
        if (nameInp)  nameInp.value  = cName;
        if (phoneInp) phoneInp.value = cPhone;
      });
    }

    var delBtns = el.content.querySelectorAll('.wiz-part-del[data-del-idx]');
    for (var di = 0; di < delBtns.length; di++) {
      delBtns[di].addEventListener('click', (function(btn) {
        return function() {
          var idx = parseInt(btn.getAttribute('data-del-idx'), 10);
          if (currentRecord.participants) {
            currentRecord.participants.splice(idx, 1);
          }
          renderDetails();
        };
      })(delBtns[di]));
    }

    var rows = el.content.querySelectorAll('.wiz-part-row[data-part-idx]');
    for (var ri = 0; ri < rows.length; ri++) {
      rows[ri].addEventListener('click', (function(row) {
        return function(e) {
          if (e.target.classList.contains('wiz-part-del')) return;
          partEditIdx = parseInt(row.getAttribute('data-part-idx'), 10);
          partAddOpen = true;
          renderDetails();
        };
      })(rows[ri]));
    }
  }

  // ── Screen 2: Details ────────────────────────────────────────────────────

  function renderDetails() {
    var r = currentRecord;
    if (isPadsClass(r)) {
      el.content.innerHTML =
        '<div class="field-group">' +
          '<div class="field-label">Details</div>' +
          '<textarea class="field-input" id="f-pads-details" rows="8" style="height:132px;resize:none;">' +
            esc(r.pads_details || r.details || '') + '</textarea>' +
        '</div>';
      var padsFirst = document.getElementById('f-pads-details');
      if (padsFirst) padsFirst.focus();
      return;
    }
    var workerDefault = r.worker || ActivityService.getSenderIdentity().name || '';
    var acts = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];
    var actSelectHtml = '';
    if (acts.length) {
      actSelectHtml = '<div class="field-group"><div class="field-label">Activity</div>' +
        '<select class="field-input" id="f-activity-id"><option value="">— None —</option>' +
        acts.map(function(a) {
          return '<option value="' + esc(a.id) + '"' + (a.id === (r.activityId || '') ? ' selected' : '') + '>' + esc(a.name) + '</option>';
        }).join('') +
        '</select></div>';
    }
    var moreHtml;
    if (detailsMoreOpen) {
      var hasUid = !!r.uid;
      var uidHtml = hasUid
        ? '<div class="field-group"><div class="field-label">Link ID</div>' +
          '<div class="wiz-uid-row"><span class="wiz-uid-val">' + esc(r.uid) + '</span>' +
          '<span class="wiz-uid-btn" id="uid-toggle">Disable</span></div></div>'
        : '<div class="field-group"><div class="field-label">Link ID</div>' +
          '<div class="wiz-uid-row"><span class="wiz-uid-off">Off</span>' +
          '<span class="wiz-uid-btn" id="uid-toggle">Enable</span></div></div>';
      var parsedTags = (typeof WPCodec !== 'undefined' && WPCodec.parseProjectTags)
        ? WPCodec.parseProjectTags(r.tag || '')
        : { projectUids: [], freeTags: [] };
      moreHtml =
        '<div class="field-more-hdr" id="details-more-hdr"><span>Extended</span><span>&#9652;</span></div>' +
        fieldGroup('ref_number',    'Ref #',   r.ref_number    || '') +
        fieldGroup('project',       'Project', parsedTags.projectUids[0] || '') +
        fieldGroup('tag',           'Tag',     parsedTags.freeTags.join(', ')) +
        fieldGroup('context_label', 'Label',   r.context_label || '') +
        fieldGroup('url',           'URL',     r.url           || '', 'url') +
        uidHtml;
    } else {
      moreHtml = '<div class="field-more-hdr" id="details-more-hdr"><span>Extended</span><span>&#9662;</span></div>';
    }

    el.content.innerHTML = lensPrefix('inputs') +
      fieldGroup('worker',        'Worker',         workerDefault) +
      fieldGroup('location',      'Location',       r.location       || '') +
      fieldGroup('customer_phone','Customer phone', r.customer_phone || '', 'tel') +
      fieldGroup('start_time',    'Start time',     r.start_time     || '') +
      fieldGroup('end_time',      'End time',       r.end_time       || '') +
      fieldGroup('meeting_time',  'Meeting time',   r.meeting_time   || '') +
      actSelectHtml +
      moreHtml +
      renderParticipantsSection();

    var first = document.getElementById('f-worker');
    if (first) first.focus();

    // Auto-fill customer_phone from BlockRegistry when navigating to Details
    if (currentRecord.customer && !currentRecord.customer_phone) {
      BlockRegistry.lookup(currentRecord.customer).then(function(entry) {
        if (!entry || !entry.phone) return;
        if (currentRecord.customer_phone) return;
        currentRecord.customer_phone = entry.phone;
        var phoneInp = document.getElementById('f-customer_phone');
        if (phoneInp && !phoneInp.value) phoneInp.value = entry.phone;
      });
    }

    var moreHdr = document.getElementById('details-more-hdr');
    if (moreHdr) {
      moreHdr.addEventListener('click', function() {
        var st = el.content.scrollTop;
        readInputs();
        detailsMoreOpen = !detailsMoreOpen;
        renderDetails();
        el.content.scrollTop = st;
      });
    }

    var uidToggle = document.getElementById('uid-toggle');
    if (uidToggle) {
      uidToggle.addEventListener('click', function() {
        readInputs();
        if (currentRecord.uid) {
          currentRecord._pending_uid = currentRecord.uid;
          currentRecord.uid = undefined;
        } else {
          currentRecord.uid = currentRecord._pending_uid || generateRecordUid();
          currentRecord._pending_uid = undefined;
        }
        renderDetails();
      });
    }

    wireParticipants();
    finishRenderLens();
  }

  // ── Screen 3: Story ──────────────────────────────────────────────────────

  function renderStory() {
    var r = currentRecord;
    if (isPadsClass(r)) {
      el.content.innerHTML =
        '<div class="field-group">' +
          '<div class="field-label">Story</div>' +
          '<textarea class="field-input" id="f-pads-story" rows="8" style="height:132px;resize:none;">' +
            esc(r.pads_story || r.story || '') + '</textarea>' +
        '</div>';
      var padsFirst = document.getElementById('f-pads-story');
      if (padsFirst) padsFirst.focus();
      return;
    }
    var notesHdr = useInOutFrame() ? InOutFrame.frameHeader('Notes', 'Story and extra detail') : '';
    el.content.innerHTML = lensPrefix('story') + notesHdr +
      '<div class="field-group" data-lens="words">' +
        '<div class="field-label">Story</div>' +
        '<textarea class="field-input" id="f-story" rows="5" style="height:90px;resize:none;">' +
          esc(r.story || '') + '</textarea>' +
      '</div>' +
      '<div class="field-group" data-lens="words">' +
        '<div class="field-label">Details</div>' +
        '<textarea class="field-input" id="f-details" rows="4" style="height:72px;resize:none;">' +
          esc(r.details || '') + '</textarea>' +
      '</div>' +
      fieldGroup('attachment', 'Attachment URL', r.attachment || '');
    var first = document.getElementById('f-story');
    if (first) first.focus();
    finishRenderLens();
  }

  // ── Contact template screens ─────────────────────────────────────────────

  // Role toggle definitions: primary (emphasised) + secondary
  var ROLE_DEFS = [
    { val: 1,  label: 'Worker',          primary: true  },
    { val: 2,  label: 'Vendor',          primary: true  },
    { val: 5,  label: 'Sub-contractor',  primary: true  },
    { val: 0,  label: 'Customer',        primary: false },
    { val: 1,  label: 'Client',          primary: false, alias: true, aliasOf: 1 },
    { val: 4,  label: 'Contractor',      primary: false },
    { val: 7,  label: 'Employee',        primary: false },
    { val: 6,  label: 'Partner',         primary: false },
    { val: 8,  label: 'Agent',           primary: false },
  ];

  // Deduplicated unique role values (no alias entries for save)
  var ROLE_SAVE_DEFS = [
    { val: 0,  label: 'Customer'       },
    { val: 1,  label: 'Worker'         },
    { val: 2,  label: 'Vendor'         },
    { val: 4,  label: 'Contractor'     },
    { val: 5,  label: 'Sub-contractor' },
    { val: 6,  label: 'Partner'        },
    { val: 7,  label: 'Employee'       },
    { val: 8,  label: 'Agent'          },
  ];

  function renderContactIdentity() {
    var r = currentRecord;
    var activeRoles = Array.isArray(r.roles) ? r.roles : [];

    // Build role toggle chips
    var primaryChips = ROLE_SAVE_DEFS.filter(function(d) {
      return d.val === 1 || d.val === 2 || d.val === 5;
    }).map(function(d) {
      var on = activeRoles.indexOf(d.val) !== -1;
      return '<span class="wiz-role-chip wiz-role-primary' + (on ? ' active' : '') + '" data-rv="' + d.val + '">' + d.label + '</span>';
    }).join('');

    var secondaryChips = ROLE_SAVE_DEFS.filter(function(d) {
      return d.val !== 1 && d.val !== 2 && d.val !== 5;
    }).map(function(d) {
      var on = activeRoles.indexOf(d.val) !== -1;
      return '<span class="wiz-role-chip' + (on ? ' active' : '') + '" data-rv="' + d.val + '">' + d.label + '</span>';
    }).join('');

    el.content.innerHTML =
      fieldGroup('job',           'Name *',        r.job           || '') +
      fieldGroup('customer',      'Organisation',  r.customer      || '') +
      fieldGroup('customer_phone','Phone',         r.customer_phone|| '', 'tel') +
      fieldGroup('alt_phone',     'Alt phone',     r.alt_phone     || '', 'tel') +
      '<div class="field-group">' +
        '<div class="field-label">Roles</div>' +
        '<div class="wiz-role-chips">' + primaryChips + '</div>' +
        '<div class="wiz-role-chips wiz-role-secondary">' + secondaryChips + '</div>' +
      '</div>';

    // Bind role toggles
    var chips = el.content.querySelectorAll('.wiz-role-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', (function(chip) {
        return function() {
          readInputs();
          var rv = parseInt(chip.getAttribute('data-rv'), 10);
          var roles = Array.isArray(currentRecord.roles) ? currentRecord.roles.slice() : [];
          var idx = roles.indexOf(rv);
          if (idx !== -1) roles.splice(idx, 1); else roles.push(rv);
          currentRecord.roles = roles;
          renderContactIdentity();
        };
      })(chips[i]));
    }

    var first = document.getElementById('f-job');
    if (first) first.focus();
  }

  function renderContactDetails() {
    var r = currentRecord;
    el.content.innerHTML =
      fieldGroup('website',          'Website',      r.website          || '', 'url') +
      fieldGroup('social_handle',    'Social',       r.social_handle    || '') +
      fieldGroup('business_hours',   'Hours',        r.business_hours   || '') +
      fieldGroup('meeting_location', 'Meeting loc',  r.meeting_location || '') +
      fieldGroup('location',         'Location',     r.location         || '');
    var first = document.getElementById('f-website');
    if (first) first.focus();
  }

  function renderContactNotes() {
    var r = currentRecord;
    el.content.innerHTML =
      '<div class="field-group"><div class="field-label">Notes</div>' +
        '<textarea class="field-input" id="f-story" rows="5" style="height:90px;resize:none;">' +
          esc(r.story || '') + '</textarea></div>' +
      '<div class="field-group"><div class="field-label">Details</div>' +
        '<textarea class="field-input" id="f-details" rows="4" style="height:72px;resize:none;">' +
          esc(r.details || '') + '</textarea></div>' +
      fieldGroup('attachment', 'Attachment URL', r.attachment || '');
    var first = document.getElementById('f-story');
    if (first) first.focus();
  }

  // ── Financial child helpers ──────────────────────────────────────────────

  function getExpenses() {
    return cachedChildren.filter(function(c) {
      return (c.record_type || c.recordType) === 'expense';
    });
  }

  function getPayments() {
    return cachedChildren.filter(function(c) {
      return (c.record_type || c.recordType) === 'payment';
    });
  }

  function reloadChildren() {
    if (!currentRecord || !currentRecord.id) return;
    RecordService.listChildren(currentRecord.id).then(function(children) {
      cachedChildren = children || [];
      if (onFinancialScreen()) renderFinancial();
    });
  }

  // ── Screen 4: Financials ─────────────────────────────────────────────────

  // ── Financial depth helpers (qty×rate, line items) ──────────────────────

  function renderFinQtyRateSection() {
    var r = currentRecord;
    var caret = finQtyRateOpen ? '&#9652;' : '&#9662;';
    var hdr = '<div class="field-more-hdr" id="fin-qr-hdr"><span>Qty \u00d7 Rate</span><span>' + caret + '</span></div>';
    if (!finQtyRateOpen) return hdr;
    return hdr +
      fieldGroup('fin-qty',  'Quantity', r.qty  || '', 'text') +
      fieldGroup('fin-rate', 'Rate',     r.rate || '', 'text') +
      '<div class="wiz-fin-calc-row" id="fin-qr-calc">' +
        '<span class="wiz-fin-calc-label">= </span>' +
        '<span class="wiz-fin-calc-val" id="fin-qr-result">' + calcQtyRateDisplay(r.qty, r.rate) + '</span>' +
      '</div>';
  }

  function calcQtyRateDisplay(qty, rate) {
    var q = parseFloat(qty);
    var r = parseFloat(rate);
    if (!isNaN(q) && !isNaN(r) && q > 0 && r > 0) {
      var locale = ActivityService.getLocale();
      return esc(locale.currency || '') + '\u00a0' + (q * r).toFixed(2);
    }
    return '\u2014';
  }

  function renderFinLinesSection() {
    var lines = (currentRecord && currentRecord.compound_lines) || [];
    var count = lines.length;
    var caret = finLinesOpen ? '&#9652;' : '&#9662;';
    var hdrLabel = 'Line items' + (count ? ' (' + count + ')' : '');
    var hdrHtml = '<div class="field-more-hdr" id="fin-lines-hdr"><span>' + hdrLabel + '</span><span>' + caret + '</span></div>';
    if (!finLinesOpen) return hdrHtml;

    var locale = ActivityService.getLocale();
    var currency = (currentRecord && currentRecord.currency) || locale.currency || '';
    var listHtml = '';
    var subtotal = 0;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var lineAmt = parseFloat(ln.amount || 0);
      subtotal += lineAmt;
      listHtml +=
        '<div class="wiz-fin-line-row" data-line-idx="' + i + '">' +
          '<span class="wiz-fin-line-name">' + esc(ln.name || '(item)') + '</span>' +
          '<span class="wiz-fin-line-amt">' + esc(currency) + '\u00a0' + lineAmt.toFixed(2) + '</span>' +
          '<span class="wiz-fin-line-del" data-del-line="' + i + '">\u00d7</span>' +
        '</div>';
    }
    if (count > 0) {
      listHtml += '<div class="wiz-fin-line-total"><span>Subtotal</span><span>' + esc(currency) + '\u00a0' + subtotal.toFixed(2) + '</span></div>';
    }

    var metaHtml = '<div class="wiz-lines-meta">' +
      '<label class="wiz-part-check-row"><input type="checkbox" id="fin-lines-total-summary"' +
        (currentRecord && currentRecord.compound_lines_total_summary ? ' checked' : '') + '> Total summary</label>' +
      '<label class="wiz-part-check-row"><input type="checkbox" id="fin-lines-subtotals"' +
        (currentRecord && currentRecord.compound_lines_subtotals ? ' checked' : '') + '> Subtotals</label>' +
    '</div>';

    var bodyHtml;
    if (finLineAddOpen) {
      var editL = finLineEditIdx >= 0 ? (lines[finLineEditIdx] || {}) : {};
      var ltOpts = LINE_TYPE_OPTS.map(function(o) {
        return '<option value="' + o.val + '"' + (parseInt(o.val) === (editL.lineType || 0) ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('');
      var tmOpts = TAX_MODE_OPTS.map(function(o) {
        return '<option value="' + o.val + '"' + (parseInt(o.val) === (editL.taxMode || 0) ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('');
      bodyHtml = listHtml + metaHtml +
        '<div class="wiz-part-form">' +
          '<input class="field-input" id="finl-name" type="text" placeholder="Description *" value="' + esc(editL.name || '') + '" autocomplete="off" autocorrect="off">' +
          '<input class="field-input" id="finl-amount" type="text" placeholder="Amount *" value="' + esc(editL.amount || '') + '">' +
          '<select class="field-input" id="finl-line-type">' + ltOpts + '</select>' +
          '<select class="field-input" id="finl-tax-mode">' + tmOpts + '</select>' +
          '<div class="wiz-part-form-btns">' +
            '<span class="wiz-part-cancel-btn" id="finl-cancel">Cancel</span>' +
            '<span class="wiz-part-save-btn" id="finl-save">Save</span>' +
          '</div>' +
        '</div>';
    } else {
      bodyHtml = listHtml + metaHtml +
        '<div class="wiz-part-add-btn" id="finl-add-btn">+ Add line item</div>';
    }
    return hdrHtml + bodyHtml;
  }

  function saveFinLineForm() {
    var nameInp     = document.getElementById('finl-name');
    var amtInp      = document.getElementById('finl-amount');
    var lineTypeInp = document.getElementById('finl-line-type');
    var taxModeInp  = document.getElementById('finl-tax-mode');
    if (!nameInp) return;
    var name = nameInp.value.trim();
    if (!name) { alert('Description is required.'); return; }
    var amount   = amtInp      ? (amtInp.value.trim() || '0') : '0';
    var lineType = lineTypeInp ? (parseInt(lineTypeInp.value, 10) || 0) : 0;
    var taxMode  = taxModeInp  ? (parseInt(taxModeInp.value,  10) || 0) : 0;
    var line = { name: name, amount: amount, lineType: lineType, taxMode: taxMode };
    if (!currentRecord.compound_lines) currentRecord.compound_lines = [];
    if (finLineEditIdx >= 0) {
      currentRecord.compound_lines[finLineEditIdx] = line;
    } else {
      currentRecord.compound_lines.push(line);
    }
    finLineAddOpen  = false;
    finLineEditIdx  = -1;
    renderFinancial();
  }

  function wireFinDepth() {
    // Qty × Rate section
    var qrHdr = document.getElementById('fin-qr-hdr');
    if (qrHdr) {
      qrHdr.addEventListener('click', function() {
        readInputs();
        finQtyRateOpen = !finQtyRateOpen;
        renderFinancial();
      });
    }
    var qtyEl  = document.getElementById('f-fin-qty');
    var rateEl = document.getElementById('f-fin-rate');
    function updateQrCalc() {
      var result = document.getElementById('fin-qr-result');
      var amtEl  = document.getElementById('f-fin-amount');
      if (!qtyEl || !rateEl) return;
      var display = calcQtyRateDisplay(qtyEl.value, rateEl.value);
      if (result) result.textContent = display.replace('&amp;', '&');
      // Pre-fill amount if it is empty
      if (amtEl && !amtEl.value) {
        var q = parseFloat(qtyEl.value), r = parseFloat(rateEl.value);
        if (!isNaN(q) && !isNaN(r) && q > 0 && r > 0) amtEl.value = (q * r).toFixed(2);
      }
    }
    if (qtyEl)  qtyEl.addEventListener('input',  updateQrCalc);
    if (rateEl) rateEl.addEventListener('input', updateQrCalc);

    // Custom tax reveal
    var vatSel = document.getElementById('f-fin-vat');
    if (vatSel) {
      vatSel.addEventListener('change', function() {
        var wrap = document.getElementById('fin-custom-tax-wrap');
        if (wrap) wrap.style.display = (this.value === 'custom') ? 'block' : 'none';
      });
    }

    // Line items section
    var linesHdr = document.getElementById('fin-lines-hdr');
    if (linesHdr) {
      linesHdr.addEventListener('click', function() {
        readInputs();
        finLinesOpen = !finLinesOpen;
        if (!finLinesOpen) { finLineAddOpen = false; finLineEditIdx = -1; }
        renderFinancial();
      });
    }
    var addLineBtn = document.getElementById('finl-add-btn');
    if (addLineBtn) {
      addLineBtn.addEventListener('click', function() {
        finLineAddOpen = true; finLineEditIdx = -1; renderFinancial();
      });
    }
    var saveLineBtn = document.getElementById('finl-save');
    if (saveLineBtn) saveLineBtn.addEventListener('click', saveFinLineForm);
    var cancelLineBtn = document.getElementById('finl-cancel');
    if (cancelLineBtn) {
      cancelLineBtn.addEventListener('click', function() {
        finLineAddOpen = false; finLineEditIdx = -1; renderFinancial();
      });
    }
    var delLineBtns = el.content.querySelectorAll('.wiz-fin-line-del[data-del-line]');
    for (var di = 0; di < delLineBtns.length; di++) {
      delLineBtns[di].addEventListener('click', (function(btn) {
        return function() {
          var idx = parseInt(btn.getAttribute('data-del-line'), 10);
          if (currentRecord.compound_lines) currentRecord.compound_lines.splice(idx, 1);
          renderFinancial();
        };
      })(delLineBtns[di]));
    }
    var lineRows = el.content.querySelectorAll('.wiz-fin-line-row[data-line-idx]');
    for (var ri = 0; ri < lineRows.length; ri++) {
      lineRows[ri].addEventListener('click', (function(row) {
        return function(e) {
          if (e.target.classList.contains('wiz-fin-line-del')) return;
          finLineEditIdx = parseInt(row.getAttribute('data-line-idx'), 10);
          finLineAddOpen = true;
          renderFinancial();
        };
      })(lineRows[ri]));
    }
  }

  function renderFinancial() {
    var ioHdr = useInOutFrame()
      ? InOutFrame.frameHeader('Outputs', 'Money and flows out')
      : '';
    var tabBar = FIN_TABS.map(function(t, i) {
      var active = i === finTab;
      return '<span data-fin-tab="' + i + '" style="' +
        'flex:1; text-align:center; padding:5px 0; font-size:10px; cursor:pointer;' +
        (active
          ? 'color:var(--accent);border-bottom:2px solid var(--accent);font-weight:bold;'
          : 'color:var(--text-muted);border-bottom:2px solid transparent;') +
        '">' + t + '</span>';
    }).join('');

    var body = '';
    if (finTab === 0)      body = renderFinAmount();
    else if (finTab === 1) body = renderFinExpenses();
    else                   body = renderFinPayments();

    var lens = global.CaptureLens && CaptureLens.enabled() ? CaptureLens.get() : null;
    if (lens === 'words') {
      el.content.innerHTML = lensPrefix('financial') + ioHdr +
        CaptureLens.screenHint(lens, 'financial');
      finishRenderLens();
      return;
    }
    el.content.innerHTML = lensPrefix('financial') + ioHdr +
      '<div data-lens-region="numbers">' +
      '<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:8px;">' +
        tabBar +
      '</div>' +
      body + '</div>';

    // Tab click handlers — also reset line-add state when switching away from Amount
    var tabEls = el.content.querySelectorAll('[data-fin-tab]');
    for (var i = 0; i < tabEls.length; i++) {
      (function(tabEl) {
        tabEl.addEventListener('click', function() {
          readInputs();
          var newTab = parseInt(tabEl.getAttribute('data-fin-tab'), 10);
          if (newTab !== 0) { finLineAddOpen = false; finLineEditIdx = -1; }
          finTab = newTab;
          finFocusIdx = 0;
          renderFinancial();
        });
      }(tabEls[i]));
    }

    // Sub-record add buttons — route to LedgerScreen with returnTo='wizard'
    var addExp  = document.getElementById('fin-add-expense');
    var addCogs = document.getElementById('fin-add-cogs');
    var addPay  = document.getElementById('fin-add-payment');
    if (addExp)  addExp.addEventListener('click',  function() { App.showLedger({ type: 'expense', parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard', returnFinTab: 1 }); });
    if (addCogs) addCogs.addEventListener('click', function() { App.showLedger({ type: 'cogs',    parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard', returnFinTab: 1 }); });
    if (addPay)  addPay.addEventListener('click',  function() { App.showLedger({ type: 'payment', parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard', returnFinTab: 2 }); });
    var linkPay = document.getElementById('fin-link-payable');
    var linkRec = document.getElementById('fin-link-receivable');
    if (linkPay) linkPay.addEventListener('click', function() {
      App.showLiabilities({ type: 'payable', linkedRecord: currentRecord, returnTo: 'wizard' });
    });
    if (linkRec) linkRec.addEventListener('click', function() {
      App.showLiabilities({ type: 'receivable', linkedRecord: currentRecord, returnTo: 'wizard' });
    });

    // Financial depth (qty×rate, line items) — Amount tab only
    if (finTab === 0) wireFinDepth();
    finishRenderLens();
  }

  function renderFinAmount() {
    var r      = currentRecord;
    var locale = ActivityService.getLocale();

    var recTypeOpts = [
      { val: '',        label: 'Job record' },
      { val: 'quote',   label: 'Quote' },
      { val: 'invoice', label: 'Invoice' },
      { val: 'receipt', label: 'Receipt' },
    ];
    var vatOpts = [
      { val: 'none',     label: 'No tax' },
      { val: 'standard', label: (locale.tax_label || 'Tax') + ' ' + (locale.tax_rate || '') + '%' },
      { val: 'zero',     label: 'Zero rated (0%)' },
      { val: 'custom',   label: 'Custom %' },
    ];
    var currencyOpts = [
      { val: '',     label: 'Home (' + esc(locale.currency || '?') + ')' },
      { val: 'USD',  label: 'USD — US Dollar' },
      { val: 'EUR',  label: 'EUR — Euro' },
      { val: 'GBP',  label: 'GBP — Pound' },
      { val: 'JPY',  label: 'JPY — Yen' },
      { val: 'INR',  label: 'INR — Rupee' },
      { val: 'NGN',  label: 'NGN — Naira' },
      { val: 'KES',  label: 'KES — Shilling' },
      { val: 'ZAR',  label: 'ZAR — Rand' },
      { val: 'BTC',  label: 'BTC — Bitcoin' },
      { val: 'ETH',  label: 'ETH — Ethereum' },
      { val: 'BNB',  label: 'BNB — BNB' },
      { val: 'SOL',  label: 'SOL — Solana' },
    ];
    var recCurrency = r.currency && r.currency !== locale.currency ? r.currency : '';

    var showCustomTax = (r.vat === 'custom');
    var customTaxWrap = '<div id="fin-custom-tax-wrap"' + (showCustomTax ? '' : ' style="display:none"') + '>' +
      fieldGroup('fin-custom_tax_rate', 'Custom rate %', r.custom_tax_rate || '') +
      '</div>';

    return selectGroup('fin-record_type', 'Record type', recTypeOpts, r.record_type || '') +
      fieldGroup('fin-amount', 'Amount', r.amount || '', 'text') +
      selectGroup('fin-currency', 'Currency', currencyOpts, recCurrency) +
      selectGroup('fin-vat', 'Tax', vatOpts, r.vat || 'none') +
      customTaxWrap +
      fieldGroup('fin-due_date', 'Due date', r.due_date || '', 'date') +
      fieldGroup('fin-expiry_date', 'Expiry date', r.expiry_date || '', 'date') +
      fieldGroup('fin-service_ref', 'Service ref', r.service_ref || '') +
      fieldGroup('fin-worker_amount', 'Internal cost', r.worker_amount || '', 'text') +
      fieldGroup('fin-qty_unit', 'Unit', r.qty_unit || '') +
      renderFinQtyRateSection() +
      renderFinLinesSection() +
      renderFinLiabLinks();
  }

  function renderFinLiabLinks() {
    if (!currentRecord || !currentRecord.id) return '';
    var rt = currentRecord.record_type || '';
    if (rt !== 'quote' && rt !== 'invoice' && rt !== 'receipt') return '';
    return '<div class="fin-liab-links" style="margin-top:10px;padding:8px 10px;border-top:1px solid var(--border);">' +
      '<div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">Link liability to this document</div>' +
      '<div class="list-item" id="fin-link-payable" style="cursor:pointer;"><div class="list-item-title">Link payable</div></div>' +
      '<div class="list-item" id="fin-link-receivable" style="cursor:pointer;"><div class="list-item-title">Link receivable</div></div>' +
    '</div>';
  }

  function renderFinExpenses() {
    var locale = ActivityService.getLocale();
    var exps = getExpenses();
    var html = '';

    if (!exps.length) {
      html += '<div style="padding:6px 10px 4px;color:var(--text-muted);font-size:11px;">No expenses yet.</div>';
    }
    for (var i = 0; i < exps.length; i++) {
      var e = exps[i];
      var focused = i === finFocusIdx ? ' focused' : '';
      var billing = e.expense_billing || e.billing || 'customer';
      html += '<div class="list-item' + focused + '">' +
        '<div class="list-item-title">' + esc(e.job || e.description || '') + '</div>' +
        '<div class="list-item-sub">' + esc(locale.currency) + ' ' + esc(e.amount) +
          ' · ' + (billing === 'cogs' ? 'COGS' : 'Expense') +
          '</div>' +
        '</div>';
    }

    var addExpFocused  = finFocusIdx === exps.length     ? ' focused' : '';
    var addCogsFocused = finFocusIdx === exps.length + 1 ? ' focused' : '';
    html += '<div class="action-add-btn' + addExpFocused  + '" id="fin-add-expense">+ Customer expense</div>';
    html += '<div class="action-add-btn' + addCogsFocused + '" id="fin-add-cogs">+ COGS item</div>';
    return html;
  }

  function renderFinPayments() {
    var locale = ActivityService.getLocale();
    var pays = getPayments();
    var html = '';

    if (!pays.length) {
      html += '<div style="padding:6px 10px 4px;color:var(--text-muted);font-size:11px;">No payments yet.</div>';
    }
    for (var i = 0; i < pays.length; i++) {
      var p = pays[i];
      var focused = i === finFocusIdx ? ' focused' : '';
      var note = p.story || p.note || '';
      html += '<div class="list-item' + focused + '">' +
        '<div class="list-item-title">' + esc(locale.currency) + ' ' + esc(p.amount) + '</div>' +
        (note ? '<div class="list-item-sub">' + esc(note) + '</div>' : '') +
        '</div>';
    }

    var addPayFocused = finFocusIdx === pays.length ? ' focused' : '';
    html += '<div class="action-add-btn' + addPayFocused + '" id="fin-add-payment">+ Payment received</div>';
    return html;
  }

  function navigateFin(dir) {
    if (finTab === 0) return;
    var max = finTab === 1 ? getExpenses().length + 1 : getPayments().length;
    finFocusIdx = Math.max(0, Math.min(max, finFocusIdx + dir));
    renderFinancial();
  }

  function finEnter() {
    if (finTab === 0) {
      var first = el.content.querySelector('select, input');
      if (first) first.focus();
      return;
    }
    if (finTab === 1) {
      var exps = getExpenses();
      if (finFocusIdx === exps.length)     { App.showLedger({ type: 'expense', parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard', returnFinTab: 1 }); return; }
      if (finFocusIdx === exps.length + 1) { App.showLedger({ type: 'cogs',    parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard', returnFinTab: 1 }); return; }
      if (finFocusIdx < exps.length) {
        App.showLedger({ editRecord: exps[finFocusIdx], parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard', returnFinTab: 1 });
      }
    }
    if (finTab === 2) {
      var pays = getPayments();
      if (finFocusIdx === pays.length) { App.showLedger({ type: 'payment', parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard', returnFinTab: 2 }); return; }
      if (finFocusIdx < pays.length) {
        App.showLedger({ editRecord: pays[finFocusIdx], parentId: currentRecord.id, wizardRecord: currentRecord, returnTo: 'wizard', returnFinTab: 2 });
      }
    }
  }

  // ── Type tag + type picker ───────────────────────────────────────────────

  function getTypeLabel(rec) {
    if (!rec) return 'Job';
    if (isContactType(rec)) return 'Contact';
    if (isPadsClass(rec)) return 'Basic';
    var t = rec.record_type || '';
    for (var i = 0; i < WIZ_TYPES.length; i++) {
      if (WIZ_TYPES[i].value === t) return WIZ_TYPES[i].label;
    }
    return 'Job';
  }

  function updateTypeTag() {
    var tag = document.getElementById('wiz-type-tag');
    if (!tag) return;
    tag.textContent = getTypeLabel(currentRecord);
  }

  function bindTypeTag() {
    var tag = document.getElementById('wiz-type-tag');
    if (tag) tag.onclick = function() { openWizardTypePicker(); };
  }

  function openWizardTypePicker() {
    if (typePickerOpen) return;
    typePickerOpen = true;
    typePickerFocusIdx = 0;
    var cur = currentRecord ? (isPadsClass(currentRecord) ? 'pads' : (currentRecord.record_type || '')) : '';
    for (var i = 0; i < WIZ_TYPES.length; i++) {
      if (WIZ_TYPES[i].value === cur) { typePickerFocusIdx = i; break; }
    }
    renderWizardTypePicker();
  }

  function renderWizardTypePicker() {
    var picker = document.getElementById('wiz-type-picker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'wiz-type-picker';
      picker.className = 'wiz-type-picker';
      document.getElementById('screen-wizard').appendChild(picker);
    }
    var html = '<div class="wiz-type-picker-hdr">Change Type</div>' +
      '<div class="wiz-type-picker-list">';
    for (var i = 0; i < WIZ_TYPES.length; i++) {
      html += '<div class="wiz-type-picker-item' + (i === typePickerFocusIdx ? ' nav-focused' : '') +
        '" data-wiz-type="' + esc(WIZ_TYPES[i].value) + '">' + esc(WIZ_TYPES[i].label) + '</div>';
    }
    html += '</div><div class="wiz-type-picker-footer">Enter: Select &nbsp; Bksp: Cancel</div>';
    picker.innerHTML = html;
    picker.style.display = 'flex';

    var items = picker.querySelectorAll('.wiz-type-picker-item');
    for (var j = 0; j < items.length; j++) {
      (function(item) {
        item.addEventListener('click', function() {
          var val = item.getAttribute('data-wiz-type');
          closeWizardTypePicker();
          changeRecordType(val);
        });
      }(items[j]));
    }
  }

  function closeWizardTypePicker() {
    typePickerOpen = false;
    var picker = document.getElementById('wiz-type-picker');
    if (picker) picker.style.display = 'none';
  }

  function changeRecordType(newVal) {
    if (!currentRecord) return;
    readInputs();
    var wasStandard = !isPadsClass(currentRecord);
    var newIsPads   = (newVal === 'pads');
    if (!currentRecord._orphanFields) currentRecord._orphanFields = {};

    if (wasStandard && newIsPads) {
      // Standard → PADS
      var stdFields = ['job','customer','date','location','start_time','end_time','meeting_time','customer_phone','worker'];
      for (var i = 0; i < stdFields.length; i++) {
        var f = stdFields[i];
        if (currentRecord[f]) currentRecord._orphanFields['std_' + f] = currentRecord[f];
      }
      if (!currentRecord.pads_process) currentRecord.pads_process = currentRecord.job || '';
      if (!currentRecord.pads_story)   currentRecord.pads_story   = currentRecord.story   || '';
      if (!currentRecord.pads_details) currentRecord.pads_details = currentRecord.details || '';
      for (var si = 0; si < stdFields.length; si++) currentRecord[stdFields[si]] = undefined;
      currentRecord.actions      = undefined;
      currentRecord.record_class = 'pads';
      currentRecord.record_type  = 'pads';

    } else if (!wasStandard && !newIsPads) {
      // PADS → Standard
      var padsFields = ['pads_process','pads_actions','pads_details','pads_story'];
      for (var pi = 0; pi < padsFields.length; pi++) {
        var pf = padsFields[pi];
        if (currentRecord[pf]) currentRecord._orphanFields[pf] = currentRecord[pf];
      }
      if (!currentRecord.job)     currentRecord.job     = (currentRecord.pads_process || '').slice(0, 48);
      if (!currentRecord.story)   currentRecord.story   = currentRecord.pads_story   || '';
      if (!currentRecord.details) currentRecord.details = currentRecord.pads_details || '';
      for (var ppi = 0; ppi < padsFields.length; ppi++) currentRecord[padsFields[ppi]] = undefined;
      // Restore any previously saved standard fields
      var restoreFields = ['customer','date','location','start_time','end_time','meeting_time','customer_phone','worker'];
      for (var ri = 0; ri < restoreFields.length; ri++) {
        var rf = restoreFields[ri];
        var saved = currentRecord._orphanFields['std_' + rf];
        if (saved && !currentRecord[rf]) currentRecord[rf] = saved;
      }
      currentRecord.record_class = (newVal === 'contact') ? 'contact' : 'job';
      currentRecord.record_type  = newVal;

    } else {
      // Standard → Standard (or → Contact): just change type + class
      currentRecord.record_type  = newVal;
      currentRecord.record_class = (newVal === 'contact') ? 'contact' : 'job';
    }

    actions = currentRecord.actions ? currentRecord.actions.slice() : [];
    currentScreen = 0;
    renderCurrentScreen();
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function renderCurrentScreen() {
    readInputs();
    if (currentScreen !== 2) { partAddOpen = false; partEditIdx = -1; }
    if (currentScreen !== 4) { finLineAddOpen = false; finLineEditIdx = -1; }
    updateProgress();
    updateSoftkeys();
    updateTypeTag();
    if (isContactType(currentRecord)) {
      switch (currentScreen) {
        case 0: renderContactIdentity(); break;
        case 1: renderContactDetails();  break;
        case 2: renderContactNotes();    break;
      }
    } else if (useInOutFrame()) {
      var kind = InOutFrame.renderKind(currentScreen, currentRecord);
      if (kind === 'outcome') renderProcess();
      else if (kind === 'inputs') {
        if (!isPadsClass(currentRecord)) actionFocusIdx = actions.length;
        renderInOutInputs();
      } else if (kind === 'outputs') {
        finFocusIdx = 0;
        renderFinancial();
      } else renderStory();
    } else {
      switch (currentScreen) {
        case 0: renderProcess();  break;
        case 1:
          if (!isPadsClass(currentRecord)) actionFocusIdx = actions.length;
          renderActions();
          break;
        case 2: renderDetails();  break;
        case 3: renderStory();    break;
        case 4:
          if (hasFinancialStep()) {
            finFocusIdx = 0;
            renderFinancial();
          }
          break;
      }
    }
    WorkpadsPanel.setContext({ screen: 'wizard', wizardScreen: currentScreen, record: currentRecord });
  }

  function goNext() {
    readInputs();
    autoSave();
    if (useProgressiveForm() && !progressiveExpanded &&
        ProgressiveForm.tierFor(currentRecord) < 2) {
      progressiveExpanded = true;
      renderCurrentScreen();
      return;
    }
    if (currentScreen < (getScreens().length - 1)) {
      currentScreen++;
      if (useInOutFrame()) {
        if (InOutFrame.renderKind(currentScreen, currentRecord) === 'outputs') {
          finTab = 0; finFocusIdx = 0;
        }
      } else if (currentScreen === 4 && hasFinancialStep()) {
        finTab = 0; finFocusIdx = 0;
      }
      renderCurrentScreen();
    }
    else saveAndExit();
  }

  function applyBackFocus() {
    var crumb = document.querySelector('#screen-wizard .screen-crumb');
    if (crumb) crumb.classList.toggle('crumb-focused', backFocused);
  }

  function goBack() {
    readInputs();
    autoSave();
    if (currentScreen > 0) {
      currentScreen--;
      renderCurrentScreen();
    } else if (entryRecord) {
      App.showView(entryRecord);
    } else {
      if (App.goBack && App.goBack()) return;
      App.showList();
    }
  }

  function saveAndExit() {
    readInputs();
    if (isContactType(currentRecord)) {
      if (!currentRecord.job) { alert('Name is required.'); return; }
      currentRecord.record_class = 'contact';
      // Sync category from first role for backward compat
      if (Array.isArray(currentRecord.roles) && currentRecord.roles.length) {
        currentRecord.category = currentRecord.roles[0];
      }
    } else if (isPadsClass(currentRecord)) {
      if (!currentRecord.pads_process) {
        alert('Process text is required.');
        return;
      }
      if (!currentRecord.job) {
        currentRecord.job = currentRecord.pads_process.slice(0, 48);
      }
    } else if (!currentRecord.job) {
      var reqLbl = (global.ProgressiveForm && ProgressiveForm.outcomeLabel)
        ? ProgressiveForm.outcomeLabel() : 'Job title';
      alert(reqLbl + ' is required.');
      return;
    }
    // Map VAT display values → codec-compatible numeric strings (DEV-WP-VAT-001)
    var locale = ActivityService.getLocale();
    if (!currentRecord.currency) currentRecord.currency = locale.currency;
    if (currentRecord.vat === 'standard') currentRecord.vat = locale.tax_rate;
    else if (currentRecord.vat === 'custom') currentRecord.vat = currentRecord.custom_tax_rate || '0';
    else if (currentRecord.vat === 'zero' || currentRecord.vat === 'none') currentRecord.vat = '0';

    var saveOp = currentRecord.id
      ? RecordService.save(currentRecord.id, currentRecord)
      : RecordService.create(currentRecord);  // new record (amendment/dispute clone, no id yet)

    saveOp.then(function(saved) {
      if (saved.customer && saved.customer_phone) {
        BlockRegistry.save(saved.customer, saved.customer_phone);
      }
      App.showView(saved);
    }).catch(function(err) {
      alert('Save failed: ' + (err && err.message ? err.message : 'unknown error'));
    });
  }

  function autoSave() {
    if (!currentRecord || !currentRecord.id) return;
    RecordService.update(currentRecord.id, currentRecord).catch(function() {});
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function onShow(record, opts) {
    currentScreen    = (opts && opts.startScreen != null) ? opts.startScreen : 0;
    finTab           = (opts && opts.finTab != null) ? opts.finTab : 0;
    finFocusIdx      = 0;
    cachedChildren   = [];
    typePickerOpen   = false;
    detailsMoreOpen  = false;
    participantsOpen = false;
    partAddOpen      = false;
    partEditIdx      = -1;
    finQtyRateOpen   = false;
    finLinesOpen     = false;
    finLineAddOpen   = false;
    finLineEditIdx   = -1;
    cachedContacts   = null;
    progressiveExpanded = false;
    backFocused      = false;
    entryRecord      = record || null;
    actions          = (record && record.actions) ? record.actions.slice() : [];
    bindTypeTag();

    if (record) {
      currentRecord = merge({}, record);
      // Load child records (expenses, payments) from DB for financial tab
      if (hasFinancialStep()) {
        RecordService.listChildren(record.id).then(function(children) {
          cachedChildren = children || [];
          if (onFinancialScreen()) renderFinancial();
        });
      }
    } else {
      var defType = (opts && opts.defaultType) ? opts.defaultType : 'pads';
      var defClass = defType === 'contact' ? 'contact' : 'pads';
      RecordService.create({ record_class: defClass, record_type: defType || 'pads' }).then(function(r) {
        currentRecord = r;
        entryRecord   = null;
        if (opts && opts.pendingAttachment && global.WPAttachment) {
          WPAttachment.persistBlob(opts.pendingAttachment, function(url) {
            if (url) currentRecord.attachment = url;
            renderCurrentScreen();
          });
          return;
        }
        renderCurrentScreen();
      });
      return;
    }
    renderCurrentScreen();
  }

  function onKey(key) {
    if (typePickerOpen) {
      switch (key) {
        case 'ArrowUp':
          typePickerFocusIdx = Math.max(0, typePickerFocusIdx - 1);
          renderWizardTypePicker();
          break;
        case 'ArrowDown':
          typePickerFocusIdx = Math.min(WIZ_TYPES.length - 1, typePickerFocusIdx + 1);
          renderWizardTypePicker();
          break;
        case 'Enter':
          var sel = WIZ_TYPES[typePickerFocusIdx];
          if (sel) { closeWizardTypePicker(); changeRecordType(sel.value); }
          break;
        case 'Backspace':
          closeWizardTypePicker();
          break;
      }
      return;
    }
    if (backFocused) {
      if (key === 'Enter' || key === 'Backspace') { backFocused = false; applyBackFocus(); goBack(); return; }
      if (key === 'ArrowDown') { backFocused = false; applyBackFocus(); return; }
      return;
    }

    if (global.CaptureLens && CaptureLens.enabled() && key === '#') {
      CaptureLens.toggle();
      renderCurrentScreen();
      return;
    }

    switch (key) {
      case 'Backspace':
        goBack();
        break;
      case 'ArrowUp':
        if (onActionsScreen()) {
          if (actionFocusIdx === 0) { backFocused = true; applyBackFocus(); }
          else { navigateActions(-1); }
        } else if (onFinancialScreen()) {
          if (finFocusIdx === 0) { backFocused = true; applyBackFocus(); }
          else { navigateFin(-1); }
        } else {
          backFocused = true; applyBackFocus();
        }
        break;
      case 'ArrowDown':
        if (onActionsScreen()) navigateActions(1);
        else if (onFinancialScreen()) navigateFin(1);
        break;
      case 'ArrowLeft':
        if (onFinancialScreen()) {
          readInputs();
          finTab = Math.max(0, finTab - 1);
          finFocusIdx = 0;
          renderFinancial();
        }
        break;
      case 'ArrowRight':
        if (onFinancialScreen()) {
          readInputs();
          finTab = Math.min(2, finTab + 1);
          finFocusIdx = 0;
          renderFinancial();
        }
        break;
      case 'Enter':
        if (onActionsScreen()) {
          goNext();
        } else if (onFinancialScreen()) {
          finEnter();
        } else if (currentScreen < (getScreens().length - 1)) {
          goNext();
        } else {
          saveAndExit();
        }
        break;
      case '1':
        if (onActionsScreen()) promptAddAction();
        break;
      case '2':
        if (onActionsScreen() && actionFocusIdx < actions.length) promptActionNote();
        break;
      case '3':
        if (onActionsScreen() && actionFocusIdx < actions.length) removeFocusedAction();
        break;
    }
  }

  // CSK click → goNext (saves on final screen, advances otherwise)
  if (el.csk) {
    el.csk.addEventListener('click', function() { goNext(); });
  }

  global.WizardScreen = {
    onShow: onShow,
    onKey: onKey,
    getCurrentRecord: function() { return currentRecord; },
  };

}(window));
