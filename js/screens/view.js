// Screen: Record view (read-only display of a saved record)
// Exposes: window.ViewScreen

(function(global) {
  'use strict';

  var el = {
    title:   document.getElementById('view-title'),
    content: document.getElementById('view-content'),
  };

  var currentRecord   = null;
  var currentParent   = null;
  var optionsOpen     = false;
  var optionsItems    = [];
  var optionsIdx      = 0;
  var collapseState   = 0;  // 0=full 1=field-labels 2=section-headers 3=minimal (title only)
  var collapsedFocusIdx = 0;
  var backFocused     = false;
  var commitPickerOpen      = false;
  var commitPickerIdx       = 0;
  var progressionPickerOpen = false;
  var progressionPickerIdx  = 0;
  var progressionPickerItems = [];
  var progConfirmOpen       = false;
  var _viewScrollId         = null;
  var optionsScrollReset    = true;
  var progConfirmTarget     = null; // { type, label } of chosen progression
  var progConfirmBtnIdx     = 0;

  var PROG_ICONS = { quote: 'Q', invoice: 'I', receipt: 'R' };

  function getProgressionItems(rec) {
    if (!rec) return null;
    var rt = rec.record_type || '';
    var acts = global.Lifecycle ? Lifecycle.nextActions(rt) : null;
    if (!acts || !acts.length) return null;
    var out = [];
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      var lbl = global.Lifecycle ? Lifecycle.TYPE_LABEL(a.type) : a.type;
      out.push({
        type:  a.type,
        label: '\u2192 ' + lbl,
        icon:  PROG_ICONS[a.type] || '',
      });
    }
    return out;
  }

  function isLifecycleType(rt) {
    return rt === '' || rt === 'quote' || rt === 'invoice' || rt === 'receipt';
  }

  function lifecycleStripOn() {
    return !global.UIPhase || UIPhase.isOn('lifecycle_strip');
  }

  // Commit type definitions for "Close / commit" picker
  var COMMIT_TYPES = [
    { val: 0, label: 'Mark complete',    icon: '\u2713' },
    { val: 1, label: 'Confirm payment',  icon: '\u00a3' },
    { val: 2, label: 'Accept terms',     icon: '\u270f' },
    { val: 3, label: 'Flag dispute',     icon: '\u26a0' },
  ];

  // Human-readable labels for each commitType value
  var COMMIT_TYPE_LABELS = { 0: 'Job complete', 1: 'Payment confirmed', 2: 'Terms accepted', 3: 'Disputed' };

  var LABELS = {
    job:              'Job',
    customer:         'Customer',
    date:             'Date',
    date_end:         'End date',
    due_date:         'Due date',
    ref_number:       'Ref',
    location:         'Location',
    customer_phone:   'Phone',
    alt_phone:        'Alt phone',
    start_time:       'Start',
    end_time:         'End',
    meeting_time:     'Meeting',
    worker:           'Worker',
    qty_unit:         'Unit',
    qty:              'Qty',
    rate:             'Rate',
    tag:              'Tag',
    context_label:    'Label',
    url:              'URL',
    uid:              'Link ID',
    website:          'Website',
    social_handle:    'Social',
    business_hours:   'Hours',
    meeting_location: 'Meet at',
    details:          'Details',
    story:            'Story',
    attachment:       'Attachment',
    service_ref:      'Service ref',
    expiry_date:      'Expiry',
    worker_amount:    'Internal cost',
  };

  var CATEGORY_LABELS = {
    0: 'Customer',    1: 'Client',         2: 'Vendor',        3: 'Supplier',
    4: 'Contractor',  5: 'Sub-contractor', 6: 'Partner',       7: 'Employee',
    8: 'Agent',       9: 'Accountant',    10: 'Bank / Lender', 11: 'Insurer',
   12: 'Landlord',   13: 'Government',   14: 'Utility',       15: 'Referral',
   16: 'Prospect',   17: 'General',
  };

  function isContactType(rec) {
    var t = String((rec && rec.record_type)  || '').toLowerCase();
    var c = String((rec && rec.record_class) || '').toLowerCase();
    return t === 'contact' || c === 'contact';
  }

  var TYPE_LABELS = {
    '':          'Job',
    'quote':     'Quote',
    'invoice':   'Invoice',
    'receipt':   'Receipt',
    'collected': 'Collecting',
    'paid':      'Paid in Full',
    'need':      'Need',
    'offer':     'Offer',
    'connection':'Connection',
  };

  function isIORecordType(rt) {
    return rt === 'need' || rt === 'offer' || rt === 'connection';
  }

  function fieldLabel(id) {
    if (id === 'job' && global.GlobalSynonymsService) {
      return GlobalSynonymsService.resolve('job', null);
    }
    return LABELS[id] || id;
  }

  function doCreateOfferFromConnection() {
    if (!currentRecord) return;
    var src = currentRecord;
    var label = src.relay_to || src.customer || src.job || 'connection';
    RecordService.create({
      record_type: 'offer',
      job: 'Offer: ' + label,
      customer: src.customer || src.relay_to || '',
      chainRef: src.chainRef || null,
      linkedContactId: src.linkedContactId || src.id || null,
      relationship: 'responds',
      date: new Date().toISOString().slice(0, 10),
      draft: true,
    }).then(function(offerRec) {
      App.showWizard(offerRec);
    });
  }

  function doConfirmConnection() {
    if (!currentRecord || !currentRecord.id) return;
    RecordService.save(currentRecord.id, { connection_ack: 'confirmed' }).then(function(updated) {
      if (global.SocialLedger) {
        SocialLedger.logEvent('relay_confirmed', {
          ackType: 'relay_confirmed',
          connectionId: currentRecord.id,
          contactId: currentRecord.linkedContactId || null,
          confirmed: true,
        });
        SocialLedger.resolvePendingForConnection(currentRecord.id);
      }
      if (updated) App.showView(updated);
      else render(currentRecord);
    });
  }

  var ROLE_LABELS = { 0: 'Customer', 1: 'Worker', 2: 'Supplier', 3: 'Other' };
  function roleLabel(p) {
    var r = p.role;
    if (r === 0 || r === 1 || r === 2) return ROLE_LABELS[r];
    if (p.role_text) return p.role_text;
    return 'Participant';
  }

  var CLASS_LABELS = { pads: 'PADS', job: 'Status', contact: 'CONTACT' };
  function recordDesignation(rec) {
    var cls = (rec.record_class || rec.recordClass || '').toLowerCase();
    return CLASS_LABELS[cls] || 'Status';
  }

  function toNum(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function fmtMoney(n, currency) {
    var val = toNum(n);
    return esc(currency || '') + '\u00a0' + val.toFixed(2);
  }

  function viewRow(label, value, style) {
    return '<div class="view-field">' +
      '<div class="view-field-label">' + label + '</div>' +
      '<div class="view-field-value"' + (style ? ' style="' + style + '"' : '') + '>' + value + '</div>' +
      '</div>';
  }

  function viewSection(id, title, bodyHtml) {
    return '<div class="view-section" id="' + id + '">' +
      '<div class="view-sec-hdr">' + esc(title) + '</div>' +
      '<div class="view-sec-body">' + bodyHtml + '</div>' +
      '</div>';
  }

  // ── Collapsed navigation helpers ─────────────────────────────────────────

  function getCollapsedItems() {
    if (collapseState === 1) return el.content.querySelectorAll('.view-field');
    if (collapseState === 2 || collapseState === 3) return el.content.querySelectorAll('.view-section');
    return [];
  }

  function updateCollapsedFocus() {
    var items = getCollapsedItems();
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('nav-focused', i === collapsedFocusIdx);
    }
    if (items[collapsedFocusIdx]) {
      items[collapsedFocusIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function moveCollapsedFocus(dir) {
    var items = getCollapsedItems();
    collapsedFocusIdx = Math.max(0, Math.min(items.length - 1, collapsedFocusIdx + dir));
    updateCollapsedFocus();
  }

  function updateViewCsk() {
    var csk = document.getElementById('view-csk');
    if (csk) csk.textContent = collapseState > 0 ? 'Open' : 'Options';
  }

  function flashField(field) {
    if (!field) return;
    field.classList.remove('flash-highlight');
    // Force reflow so re-adding the class restarts the animation
    void field.offsetWidth;
    field.classList.add('flash-highlight');
    setTimeout(function() { field.classList.remove('flash-highlight'); }, 1200);
  }

  function expandToItem(focusedItem, state) {
    // Identify target field BEFORE clearing collapsed state
    var targetField = null;
    if (state === 1) {
      targetField = focusedItem; // focusedItem IS a .view-field
    } else if (state === 2) {
      // focusedItem is a .view-section — target its first .view-field
      targetField = focusedItem ? focusedItem.querySelector('.view-field') : null;
    }

    // Expand to full view
    collapseState = 0;
    el.content.classList.remove('view-collapsed', 'view-sec-collapsed');
    var togBtn = document.getElementById('view-toggle-btn');
    if (togBtn) togBtn.className = 'view-tb-toggle';
    var navItems = el.content.querySelectorAll('.nav-focused');
    for (var i = 0; i < navItems.length; i++) navItems[i].classList.remove('nav-focused');
    updateViewCsk();

    // Scroll to target and flash
    if (targetField) {
      setTimeout(function() {
        targetField.scrollIntoView({ block: 'center' });
        flashField(targetField);
      }, 40);
    }
  }

  function expandFromCollapsed() {
    collapseState = 0;
    el.content.classList.remove('view-collapsed', 'view-sec-collapsed');
    var togBtn = document.getElementById('view-toggle-btn');
    if (togBtn) togBtn.className = 'view-tb-toggle';
    var items = el.content.querySelectorAll('.nav-focused');
    for (var i = 0; i < items.length; i++) items[i].classList.remove('nav-focused');
    updateViewCsk();
  }

  function scheduleViewScrollRestore(rec, scrollTop, collapse) {
    function apply() {
      if (currentRecord !== rec || !el.content) return;
      el.content.scrollTop = scrollTop;
      if (collapse > 0) {
        collapseState = collapse;
        el.content.classList.toggle('view-collapsed', collapseState === 1);
        el.content.classList.toggle('view-sec-collapsed', collapseState === 2);
        el.content.classList.toggle('view-minimal', collapseState === 3);
        var togBtn = document.getElementById('view-toggle-btn');
        if (togBtn) {
          togBtn.className = 'view-tb-toggle' +
            (collapseState === 1 ? ' collapsed' : collapseState === 2 ? ' collapsed-2' : collapseState === 3 ? ' collapsed-3' : '');
        }
        updateCollapsedFocus();
      }
      updateViewCsk();
    }
    apply();
    setTimeout(apply, 0);
    setTimeout(apply, 80);
    setTimeout(apply, 150);
  }

  // ── View toolbar (sections dropdown + search + 3-state collapse) ─────────

  function populateViewToolbar(rec, preserveNav, savedCollapse) {
    var sel    = document.getElementById('view-sec-sel');
    var inp    = document.getElementById('view-search');
    var togBtn = document.getElementById('view-toggle-btn');
    if (!sel || !inp) return;

    // ── Sections dropdown ──────────────────────────────────────────────────
    var sections = [{ id: '', label: 'Sections' }, { id: 'view-sec-top', label: 'Top' }];
    if (rec.parentId)                                             sections.push({ id: 'view-parent-super',   label: 'Parent' });
    if (Array.isArray(rec.actions)      && rec.actions.length)    sections.push({ id: 'view-sec-actions',    label: 'Actions' });
    if (Array.isArray(rec.participants) && rec.participants.length) sections.push({ id: 'vsec-participants', label: 'Participants' });
    sections.push({ id: 'vsec-fin', label: 'Financials' });

    sel.innerHTML = sections.map(function(s) {
      return '<option value="' + s.id + '">' + esc(s.label) + '</option>';
    }).join('');
    sel.onchange = function() {
      var target = this.value ? document.getElementById(this.value) : null;
      if (target) target.scrollIntoView({ block: 'start' });
      this.value = '';
    };

    // ── 4-state collapse toggle ────────────────────────────────────────────
    if (!preserveNav) {
      collapseState = 0;
      collapsedFocusIdx = 0;
      el.content.classList.remove('view-collapsed', 'view-sec-collapsed', 'view-minimal');
      updateViewCsk();
    } else if (savedCollapse > 0) {
      collapseState = savedCollapse;
      el.content.classList.toggle('view-collapsed', collapseState === 1);
      el.content.classList.toggle('view-sec-collapsed', collapseState === 2);
      el.content.classList.toggle('view-minimal', collapseState === 3);
      updateViewCsk();
    }
    if (togBtn) {
      togBtn.className = 'view-tb-toggle';
      togBtn.onclick = function() {
        collapseState = (collapseState + 1) % 4;
        el.content.classList.toggle('view-collapsed',     collapseState === 1);
        el.content.classList.toggle('view-sec-collapsed', collapseState === 2);
        el.content.classList.toggle('view-minimal',       collapseState === 3);
        togBtn.className = 'view-tb-toggle' +
          (collapseState === 1 ? ' collapsed' : collapseState === 2 ? ' collapsed-2' : collapseState === 3 ? ' collapsed-3' : '');
        collapsedFocusIdx = 0;
        if (collapseState > 0) updateCollapsedFocus();
        else {
          var focused = el.content.querySelectorAll('.nav-focused');
          for (var i = 0; i < focused.length; i++) focused[i].classList.remove('nav-focused');
        }
        updateViewCsk();
      };
    }

    // ── Click-to-expand in collapsed mode ─────────────────────────────────
    el.content.onclick = function(e) {
      if (collapseState === 0) return;
      // Find which item was clicked
      var clickedField   = e.target.closest ? e.target.closest('.view-field')   : null;
      var clickedSection = e.target.closest ? e.target.closest('.view-section') : null;
      var target = collapseState === 1 ? clickedField : clickedSection;
      var prevState = collapseState;
      if (target) {
        expandToItem(target, prevState);
      } else {
        expandFromCollapsed();
      }
    };

    // ── Search — granular: drills into sub-values within a block ──────────
    inp.value = '';
    inp.oninput = function() {
      var term = this.value.toLowerCase().trim();
      var all = el.content.querySelectorAll('.view-field, .view-field-value');
      for (var r = 0; r < all.length; r++) all[r].style.display = '';
      if (!term) return;

      var fields = el.content.querySelectorAll('.view-field');
      for (var i = 0; i < fields.length; i++) {
        var f     = fields[i];
        var vals  = f.querySelectorAll('.view-field-value');
        var label = f.querySelector('.view-field-label');
        var labelHit = label && label.textContent.toLowerCase().indexOf(term) !== -1;

        if (vals.length > 1) {
          var anyHit = labelHit;
          for (var v = 0; v < vals.length; v++) {
            var hit = vals[v].textContent.toLowerCase().indexOf(term) !== -1;
            vals[v].style.display = hit ? '' : 'none';
            if (hit) anyHit = true;
          }
          if (labelHit) {
            for (var v2 = 0; v2 < vals.length; v2++) vals[v2].style.display = '';
          }
          f.style.display = anyHit ? '' : 'none';
        } else {
          f.style.display = f.textContent.toLowerCase().indexOf(term) !== -1 ? '' : 'none';
        }
      }
    };
  }

  function wireProgrammableSection(rec, all) {
    var slot = document.getElementById('view-pr-obligations');
    if (!slot || !global.WPProgrammableReceive) return;
    var body = WPProgrammableReceive.renderViewSection(rec, all);
    if (!body) {
      slot.parentNode && slot.parentNode.removeChild(slot);
      return;
    }
    slot.outerHTML = '<div class="view-section" id="vsec-programmable">' +
      '<div class="view-sec-hdr">Obligations</div>' +
      '<div class="view-sec-body">' + body + '</div></div>';
  }

  function wireActionReceiveBar(rec, all) {
    var bar = document.getElementById('view-action-receive-bar');
    if (!bar) return;
    function paint(all) {
      if (global.WPNocGatekeeper && WPNocGatekeeper.needsGatekeeperReceive(rec, all)) {
        bar.style.display = 'block';
        bar.innerHTML = '<button type="button" class="view-action-btn" id="view-gk-receive-btn">' +
          'Gatekeeper — respond to relay</button>';
        var gkBtn = document.getElementById('view-gk-receive-btn');
        if (gkBtn) gkBtn.onclick = function() {
          App.showGatekeeperReceive({ parentRecord: rec });
        };
        return;
      }
      if (!global.WPChainExecution) return;
      if (!WPChainExecution.parseActionList(rec).length) return;
      if (!WPChainExecution.needsActionReceive(rec, all)) return;
      bar.style.display = 'block';
      bar.innerHTML = '<button type="button" class="view-action-btn" id="view-action-receive-btn">' +
        'Confirm actions (' + WPChainExecution.parseActionList(rec).length + ')</button>';
      var btn = document.getElementById('view-action-receive-btn');
      if (btn) btn.onclick = function() { App.showActionReceive({ parentRecord: rec }); };
    }
    bar.style.display = 'none';
    bar.innerHTML = '';
    if (all) paint(all);
    else RecordService.list().then(paint);
  }

  // ── Main render ──────────────────────────────────────────────────────────

  function render(rec) {
    var preserveNav = _viewScrollId === rec.id && !!el.content;
    var savedScroll = preserveNav ? el.content.scrollTop : 0;
    var savedCollapse = preserveNav ? collapseState : 0;

    currentRecord   = rec;
    currentParent   = null;
    if (!preserveNav) {
      collapseState = 0;
      collapsedFocusIdx = 0;
    }
    el.title.textContent = rec.job || '(untitled)';
    updateViewCsk();

    var rt = rec.record_type || '';
    var typeLabel = TYPE_LABELS.hasOwnProperty(rt) ? TYPE_LABELS[rt] : '';
    var designation = rec.parentId
      ? ((rt || rec.recordType || 'entry').toUpperCase())
      : recordDesignation(rec);

    var spineHtml = (global.GlyphCard && GlyphCard.spineMarginHtml)
      ? GlyphCard.spineMarginHtml(rec) : '';
    var cardHtml = (global.GlyphCard && GlyphCard.renderViewCard)
      ? GlyphCard.renderViewCard(rec) : '';
    var html = spineHtml + '<div class="view-paper' + (spineHtml ? ' view-with-spine' : '') + '" id="view-sec-top">';

    var progressions = getProgressionItems(rec);
    var progBadge = progressions
      ? '<span class="view-prog-badge view-prog-pulse" id="view-prog-badge">' + esc(designation) + ' \u203a</span>'
      : '<span class="view-rec-class">' + esc(designation) + '</span>';
    html += '<div class="view-paper-header">' +
      progBadge +
      (typeLabel ? '<span class="view-rec-type">' + esc(typeLabel) + '</span>' : '') +
      (global.WPChainExecution ? WPChainExecution.codecBadgeHtml(rec) : '') +
      '</div>';
    html += '<div id="view-action-receive-bar" class="view-action-bar" style="display:none"></div>';
    if (cardHtml) html += cardHtml;
    if (lifecycleStripOn() && isLifecycleType(rt)) {
      html += '<div id="view-lifecycle-wrap" class="view-lifecycle-wrap"></div>';
    }

    if (rec._templateQr) {
      var tqLbl = (global.WPTemplateQr && rec.displaySchema)
        ? WPTemplateQr.displayLabel(rec.displaySchema) : 'Template QR';
      html += '<div class="view-trig-banner">Received via #1dt/ · ' + esc(tqLbl) + '</div>';
    }
    if (global.WPRelationalUi) {
      var symBanner = WPRelationalUi.inlineEntryBanner(rec);
      if (symBanner) {
        html += '<div class="view-trig-banner">' + esc(symBanner) + '</div>';
      }
      if (rec.relational_mode || rec._codec_v4) {
        var pk = WPRelationalUi.peerKeyForRecord(rec);
        var st = global.WPSymbolTable ? WPSymbolTable.stats(pk) : { entries: 0, pending: 0 };
        html += '<div class="view-field" id="view-symbols-row" style="cursor:pointer;">' +
          '<div class="view-field-label">Symbol table</div>' +
          '<div class="view-field-value">' + st.entries + ' known · peer ' +
          esc(WPSymbolTable.peerLabelForKey(pk, {})) +
          ' <span class="badge">Manage</span></div></div>';
      }
    }
    if (rec.trigDisplay) {
      if (rec.trigDisplay.trig_violation) {
        html += '<div class="view-trig-banner">Display rules invalid (TRIG length)</div>';
      } else if (!rec.trigDisplay.show) {
        html += '<div class="view-trig-banner">Hidden by display trigger</div>';
      } else if (rec.displaySchema && !rec._templateQr) {
        var dsLbl = ['Standard', 'Billboard', 'Form', 'Form+QR'][rec.displaySchema.displayType || 0];
        html += '<div class="view-trig-banner">Presentation: ' + esc(dsLbl) + '</div>';
      }
    }

    if (rec.parentId) {
      html += '<div id="view-parent-super"></div>';
    }

    // Process section
    var processBody = '';
    var keys = Object.keys(LABELS);
    for (var i = 0; i < keys.length; i++) {
      var id  = keys[i];
      var val = rec[id];
      if (val) processBody += viewRow(fieldLabel(id), esc(val));
    }
    if (isContactType(rec)) {
      var roleDisplay;
      if (Array.isArray(rec.roles) && rec.roles.length) {
        roleDisplay = rec.roles.map(function(rv) { return CATEGORY_LABELS[rv] || String(rv); }).join(', ');
      } else if (rec.category != null) {
        roleDisplay = CATEGORY_LABELS[rec.category] || String(rec.category);
      }
      if (roleDisplay) processBody += viewRow('Role', esc(roleDisplay));
    }
    if (rec.receivedAt) {
      processBody += viewRow('Source', '<span style="color:var(--text-muted);">Received via link</span>');
    }
    // State commit — show status and chain completion details
    if (rec.record_type === 'state_commit') {
      var ctLabel = COMMIT_TYPE_LABELS[rec.commitType] || 'Committed';
      processBody += viewRow('Status', esc(ctLabel), rec.disputeFlag ? 'color:var(--danger);' : 'color:var(--green);');
      if (rec.chainComplete) processBody += viewRow('Chain', 'Complete \u2713', 'color:var(--green);');
      if (rec.chainRef) processBody += viewRow('Chain ref', esc(rec.chainRef));
    }
    if (processBody) {
      html += viewSection('vsec-process', 'Process', processBody);
    }

    if (global.WPProgrammableReceive && WPProgrammableReceive.hasRules(rec)) {
      html += '<div id="view-pr-obligations"></div>';
    } else if (Array.isArray(rec._programmablePlain) && rec._programmablePlain.length) {
      var prBody = '';
      var pri;
      for (pri = 0; pri < rec._programmablePlain.length; pri++) {
        prBody += viewRow('Rule ' + (pri + 1), esc(rec._programmablePlain[pri]));
      }
      html += viewSection('vsec-programmable', 'Obligations', prBody);
    } else if (Array.isArray(rec.programmable_rules) && rec.programmable_rules.length &&
        global.WPProgrammableRules) {
      var hints = WPProgrammableRules.describeAll(rec.programmable_rules);
      var prBody2 = '';
      for (pri = 0; pri < hints.length; pri++) {
        prBody2 += viewRow('Rule ' + (pri + 1), esc(hints[pri]));
      }
      html += viewSection('vsec-programmable', 'Obligations', prBody2);
    }

    if (rec.informational_ack) {
      html += '<div class="view-trig-banner">Light acknowledgement — no per-action list required</div>';
    }

    // Actions section — each action is its own .view-field for collapsed navigation
    if (Array.isArray(rec.actions) && rec.actions.length) {
      var actBody = '';
      for (var j = 0; j < rec.actions.length; j++) {
        var a = rec.actions[j];
        actBody += '<div class="view-field">' +
          '<div class="view-field-label">' +
            '<span style="color:var(--accent);margin-right:4px;">' + (j + 1) + '</span>' +
            esc(a.title || '(untitled)') +
          '</div>' +
          '<div class="view-field-value" style="font-size:11px;color:var(--text-muted);">' +
            (a.notes ? esc(a.notes) : '\u2014') +
          '</div>' +
          '</div>';
      }
      html += '<div class="view-section" id="view-sec-actions">' +
        '<div class="view-sec-hdr">Actions (' + rec.actions.length + ')</div>' +
        '<div class="view-sec-body">' + actBody + '</div>' +
        '</div>';
    }

    // Participants section
    if (Array.isArray(rec.participants) && rec.participants.length) {
      var partBody = '';
      for (var pi = 0; pi < rec.participants.length; pi++) {
        var p    = rec.participants[pi];
        var rlbl = roleLabel(p);
        var signals = [];
        if (p.cert)  signals.push('CERT');
        if (p.auth)  signals.push('AUTH');
        if (p.lead)  signals.push('LEAD');
        var badge = signals.length
          ? ' <span class="part-signal">' + signals.join('\u00b7') + '</span>'
          : '';
        partBody +=
          '<div class="view-field part-row">' +
            '<div class="view-field-label">' + esc(rlbl) + badge + '</div>' +
            '<div class="view-field-value part-name">' + esc(p.name || '\u2014') + (p.is_org || p.isOrg ? ' [org]' : '') + '</div>' +
            (p.trading_name || p.tradingName ? '<div class="view-field-value part-phone">' + esc(p.trading_name || p.tradingName) + '</div>' : '') +
            (p.email ? '<div class="view-field-value part-phone">' + esc(p.email) + '</div>' : '') +
            (p.phone ? '<div class="view-field-value part-phone">' + esc(p.phone) + '</div>' : '') +
            (p.note  ? '<div class="view-field-value part-note">'  + esc(p.note)  + '</div>' : '') +
          '</div>';
      }
      html += '<div class="view-section" id="vsec-participants">' +
        '<div class="view-sec-hdr">Participants (' + rec.participants.length + ')</div>' +
        '<div class="view-sec-body">' + partBody + '</div>' +
        '</div>';
    }

    if (isIORecordType(rt)) {
      html += '<div class="view-section" id="vsec-io">' +
        '<div class="view-sec-hdr">' + esc(TYPE_LABELS[rt] || rt) + '</div>' +
        '<div class="view-sec-body" id="view-io-card"></div>' +
      '</div>';
      html += '<div class="view-section" id="vsec-social">' +
        '<div class="view-sec-hdr">Social trail</div>' +
        '<div class="view-sec-body" id="view-social-trail"></div>' +
      '</div>';
    } else if (rt === 'contact') {
      html += '<div class="view-section" id="vsec-social">' +
        '<div class="view-sec-hdr">Social trail</div>' +
        '<div class="view-sec-body" id="view-social-trail"></div>' +
      '</div>';
    } else {
      html += '<div class="view-section" id="vsec-fin">' +
        '<div class="view-sec-hdr">Financials</div>' +
        '<div class="view-sec-body"><div id="view-fin-card"></div></div>' +
      '</div>';
    }

    html += '</div>';
    if (lifecycleStripOn() && isLifecycleType(rt)) {
      html += '<div id="view-chain-docs"></div>';
    }
    el.content.innerHTML = html;
    RecordService.list().then(function(all) {
      wireProgrammableSection(rec, all);
      wireActionReceiveBar(rec, all);
    });

    var symRow = document.getElementById('view-symbols-row');
    if (symRow && global.App && App.showSymbols && global.WPRelationalUi) {
      symRow.addEventListener('click', function() {
        App.showSymbols({
          peerKey: WPRelationalUi.peerKeyForRecord(rec),
          peerLabel: rec.customer || rec.job,
          record: rec,
          returnTo: 'view',
        });
      });
    }

    // Wire progression badge (only present when progressions exist)
    var progBadgeEl = document.getElementById('view-prog-badge');
    if (progBadgeEl) {
      progBadgeEl.onclick = function() { openProgressionPicker(); };
    }

    WorkpadsPanel.setContext({ screen: 'view', record: rec });

    populateViewToolbar(rec, preserveNav, savedCollapse);
    _viewScrollId = rec.id;
    if (preserveNav) scheduleViewScrollRestore(rec, savedScroll, savedCollapse);
    loadParentSuperLabel(rec);
    if (isIORecordType(rt)) {
      loadIOCard(rec);
      loadSocialTrail(rec);
    } else {
      loadFinancialCard(rec);
    }
    loadLifecycleUI(rec);

    // Chain state enrichment — runs for all records that have a chainRef
    // Sets _chainHasDispute so openOptions() can adjust labels without a second async call
    if (rec.chainRef) {
      RecordService.listByChainRef(rec.chainRef).then(function(chainAll) {
        if (currentRecord !== rec) return;
        var chain = chainAll.filter(function(r) { return r.id !== rec.id; });
        var chainRatified = chain.some(function(r) {
          return (r.record_type || '').toLowerCase() === 'state_commit' && r.chainComplete;
        });
        currentRecord._chainRatified = chainRatified;
        if (global.WPAgreements) {
          var summaries = chainAll.map(function(r) {
            return {
              ack_request: !!(r.ackRequest),
              chain: !!r.chainRef,
              commit_type: r.sc_commit_type != null ? r.sc_commit_type : null,
              sender_uid: r.sender_uid || r.worker || '',
              threshold_n: r.threshold_n,
            };
          });
          if (WPAgreements.isRatified(summaries)) currentRecord._chainRatified = true;
        }
        // Mark dispute presence on the live currentRecord object
        currentRecord._chainHasDispute = chain.some(function(r) {
          return r.record_type === 'dispute' || r.disputeFlag;
        });

        refreshLifecycleUI(rec, chainAll);

        // ACK bar — only if this record requested acknowledgement
        if (rec.ackRequest || (rec._meta && rec._meta.ackRequest)) {
          var acked = chain.some(function(r) { return r.record_type === 'ack' || r.ackConfirmed; });
          var ackEl = document.getElementById('view-ack-bar');
          if (!ackEl) return;
          if (acked) {
            ackEl.style.display = 'flex';
            ackEl.innerHTML = '<span style="color:var(--green);">\u2713 Acknowledged</span>';
          } else {
            ackEl.style.display = 'flex';
            ackEl.innerHTML = '<span style="color:var(--accent);">ACK requested</span>' +
              '<span class="view-ack-btn" id="view-ack-generate">Generate ACK \u203a</span>';
            var btn = document.getElementById('view-ack-generate');
            if (btn) {
              btn.addEventListener('click', function() { doGenerateAck(rec); });
            }
          }
        }
      });
    }
  }

  function buildLifecycleCtaHtml(rec) {
    if (!global.Lifecycle) return '';
    var acts = Lifecycle.nextActions(rec.record_type || '');
    if (!acts || !acts.length) return '';
    return '<div class="view-lifecycle-cta" id="view-lifecycle-cta" data-prog-type="' +
      esc(acts[0].type) + '">' + esc(acts[0].label) + '</div>';
  }

  function wireLifecycleCta(rec) {
    var btn = document.getElementById('view-lifecycle-cta');
    if (!btn) return;
    btn.onclick = function() {
      var t = btn.getAttribute('data-prog-type');
      var acts = Lifecycle.nextActions(rec.record_type || '') || [];
      var item = null;
      for (var i = 0; i < acts.length; i++) {
        if (acts[i].type === t) { item = acts[i]; break; }
      }
      if (!item && acts[0]) item = acts[0];
      if (item) openProgConfirm({ type: item.type, label: item.label });
    };
  }

  function wireChainDocRows() {
    var rows = document.querySelectorAll('.view-chain-doc-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].onclick = (function(id) {
        return function() {
          RecordService.get(id).then(function(r) { if (r) App.showView(r); });
        };
      })(rows[i].getAttribute('data-chain-id'));
    }
  }

  function refreshLifecycleUI(rec, chainAll) {
    if (!lifecycleStripOn() || !global.Lifecycle || !isLifecycleType(rec.record_type || '')) return;
    var wrap = document.getElementById('view-lifecycle-wrap');
    if (!wrap || currentRecord !== rec) return;
    var rt = rec.record_type || '';
    var chainComplete = false;
    if (chainAll && chainAll.length) {
      chainComplete = chainAll.some(function(r) {
        return (r.record_type || '') === 'state_commit' && r.chainComplete;
      });
    }
    wrap.innerHTML = Lifecycle.stripHtml(rt, chainComplete) + buildLifecycleCtaHtml(rec);
    wireLifecycleCta(rec);
    var docsEl = document.getElementById('view-chain-docs');
    if (docsEl) {
      var cref = rec.chainRef || rec.id;
      var docs = Lifecycle.collectChainDocs(chainAll || [], cref);
      docsEl.innerHTML = Lifecycle.chainDocsHtml(docs, rec.id);
      wireChainDocRows();
    }
  }

  function loadLifecycleUI(rec) {
    if (!lifecycleStripOn() || !global.Lifecycle || !isLifecycleType(rec.record_type || '')) return;
    var cref = rec.chainRef || rec.id;
    refreshLifecycleUI(rec, []);
    RecordService.listByChainRef(cref).then(function(chainAll) {
      if (currentRecord !== rec) return;
      refreshLifecycleUI(rec, chainAll);
    });
  }

  function loadParentSuperLabel(rec) {
    if (!rec.parentId) return;
    RecordService.get(rec.parentId).then(function(parent) {
      if (!parent || currentRecord !== rec) return;
      currentParent = parent;
      var elp = document.getElementById('view-parent-super');
      if (!elp) return;
      var pType = parent.record_type ? parent.record_type.toUpperCase() : 'RECORD';
      var childType = (rec.record_type || rec.recordType || 'entry').toUpperCase();
      elp.innerHTML =
        '<div style="margin:6px 10px 8px;padding:6px 8px;border:1px solid var(--border);background:var(--bg2);">' +
          '<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">' +
            'Parent ' + esc(pType) + ' · ' + esc(childType) +
          '</div>' +
          '<div style="font-size:12px;font-weight:bold;color:var(--text);padding-top:2px;">' + esc(parent.job || '(untitled)') + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);">' + esc(parent.date || '') + (parent.customer ? ' · ' + esc(parent.customer) : '') + '</div>' +
        '</div>';
    });
  }

  function loadSocialTrail(rec) {
    var el = document.getElementById('view-social-trail');
    var sec = document.getElementById('vsec-social');
    if (!el || currentRecord !== rec) return;
    if (!global.SocialLedger) {
      if (sec) sec.style.display = 'none';
      return;
    }
    var rt = rec.record_type || '';
    var entries = [];
    if (rt === 'contact') {
      RecordService.list().then(function(all) {
        if (currentRecord !== rec) return;
        entries = SocialLedger.entriesForContact(rec.id, all, { limit: 10 });
        if (!entries.length) {
          if (sec) sec.style.display = 'none';
          return;
        }
        if (sec) sec.style.display = '';
        el.innerHTML = SocialLedger.renderTrailHtml(entries, { max: 8 });
      });
      return;
    }
    if (!isIORecordType(rt)) {
      if (sec) sec.style.display = 'none';
      return;
    }
    entries = SocialLedger.entriesForRecord(rec, { limit: 10 });
    if (!entries.length) {
      if (sec) sec.style.display = 'none';
      return;
    }
    if (sec) sec.style.display = '';
    el.innerHTML = SocialLedger.renderTrailHtml(entries, { max: 8 });
  }

  function loadIOCard(rec) {
    var card = document.getElementById('view-io-card');
    if (!card || currentRecord !== rec) return;
    var rt = rec.record_type || '';
    var html = '';
    if (rt === 'need') {
      var srcLbl = global.IOLabels ? IOLabels.inputSourceLabel(rec.input_source) : (rec.input_source || 'Input');
      html += viewRow('Input source', esc(srcLbl));
      if (rec.labour_count) {
        var labour = esc(String(rec.labour_count)) + ' people';
        if (rec.labour_role) labour += ' · ' + esc(rec.labour_role);
        html += viewRow(global.IOLabels ? IOLabels.jobInputsLabel() : 'Job Inputs', labour);
      }
    }
    if (rt === 'offer') {
      html += viewRow('Offer', esc(rec.job || ''));
      html += '<div class="view-field-value" style="font-size:11px;color:var(--text-muted);padding:4px 0;">Resource offer — not a relay.</div>';
    }
    if (rt === 'connection') {
      if (rec.relay_to) html += viewRow('Point toward', esc(rec.relay_to));
      if (rec.relay_note) html += viewRow('Relay note', esc(rec.relay_note));
      if (global.WPNocGatekeeper) {
        html += viewRow('Gatekeeper', esc(WPNocGatekeeper.policyLabel(WPNocGatekeeper.getGateType(rec))));
      }
      html += viewRow('Relay ack', esc(rec.connection_ack || 'pending'));
      if (rec.gatekeeper_sale_confirmed) {
        html += viewRow('Sale', 'Confirmed');
      }
      html += '<div class="view-field-value" style="font-size:11px;color:var(--text-muted);padding:4px 0;">Bridge — menu: Offer, Confirm relay, Gatekeeper.</div>';
      var pend = SocialLedger ? SocialLedger.entriesForRecord(rec).filter(SocialLedger.isPending).length : 0;
      if (pend) {
        html += '<div class="view-field-value" style="color:var(--warn);font-size:11px;">' +
          pend + ' open social ack(s) on trail</div>';
      }
    }
    card.innerHTML = html || '<div class="view-field-value">—</div>';
  }

  // ── Financial card ───────────────────────────────────────────────────────

  function loadFinancialCard(rec) {
    if (!rec.id) return;
    RecordService.listChildren(rec.id).then(function(children) {
      var card = document.getElementById('view-fin-card');
      if (!card || currentRecord !== rec) return;
      var summary = FinancialModel.summarize(rec, children);
      var rt = rec.record_type || '';
      var lcHtml = '';
      if (global.InvoiceLifecycle && InvoiceLifecycle.isLifecycleParent(rec)) {
        var roll = InvoiceLifecycle.rollup(rec, children);
        lcHtml = InvoiceLifecycle.stripHtml(roll, rec.currency || '');
      }
      if (!rec.amount && !summary.expenses.length && !summary.payments.length) {
        var finSec = document.getElementById('vsec-fin');
        if (finSec) finSec.style.display = 'none';
        return;
      }
      var currency = rec.currency || '';
      var outByCat = summary.expenseByCategory;
      var cogsByCat = summary.cogsByCategory;
      var actionOut = summary.expenseByAction;
      var actionCogs = summary.cogsByAction;
      var outCats = Object.keys(outByCat);
      var cogsCats = Object.keys(cogsByCat);
      var actionKeys = Object.keys(actionOut).filter(function(k) { return k !== ''; });

      var html = lcHtml + '<div style="padding-top:4px;">';

      // Qty × Rate
      if (rec.qty && rec.rate) {
        html += viewRow('Qty \u00d7 Rate',
          esc(rec.qty) + ' \u00d7 ' + esc(rec.rate) + ' = ' + fmtMoney(toNum(rec.qty) * toNum(rec.rate), currency));
      }

      if (summary.price) {
        html += viewRow('Amount', fmtMoney(summary.price, currency));
      }
      if (summary.tax) {
        html += viewRow('Tax (' + esc(rec.vat) + '%)', fmtMoney(summary.tax, currency));
      }
      if (summary.total) {
        html += viewRow('Total', fmtMoney(summary.total, currency), 'font-weight:bold;');
      }

      // Compound line items
      if (Array.isArray(rec.compound_lines) && rec.compound_lines.length > 0) {
        var linesSubtotal = 0;
        for (var li = 0; li < rec.compound_lines.length; li++) {
          var cln = rec.compound_lines[li];
          var clnAmt = toNum(cln.amount);
          linesSubtotal += clnAmt;
          html += viewRow(esc(cln.name || 'Item ' + (li + 1)), fmtMoney(clnAmt, currency), 'font-size:11px;');
        }
        html += viewRow('Lines subtotal', fmtMoney(linesSubtotal, currency), 'font-weight:bold;');
      }

      for (var i = 0; i < summary.billedExp.length; i++) {
        html += viewRow(
          'Out · ' + esc(summary.billedExp[i].job || ''),
          fmtMoney(parseFloat(summary.billedExp[i].amount || 0), currency)
        );
      }
      for (var j = 0; j < summary.cogs.lines.length; j++) {
        var line = summary.cogs.lines[j];
        var ref = line.status === 'overrun' ? ' (overrun)' : (line.status === 'within' ? ' (within)' : ' (unlinked)');
        var cogsLbl = global.IOLabels ? IOLabels.cogsLabel() : 'COGS';
        html += viewRow(
          cogsLbl + ' · ' + esc((line.record.job || cogsLbl) + ref),
          fmtMoney(parseFloat(line.record.amount || 0), currency),
          'color:var(--text-muted);'
        );
      }
      for (var k = 0; k < summary.payments.length; k++) {
        var p = summary.payments[k];
        html += viewRow(
          'In' + (p.story ? ' · ' + esc(p.story) : ''),
          '\u2212\u00a0' + fmtMoney(parseFloat(p.amount || 0), currency),
          'color:var(--accent);'
        );
      }
      if (summary.total && summary.payments.length) {
        var outStyle = summary.outstanding > 0 ? 'font-weight:bold;' : 'color:var(--accent);font-weight:bold;';
        html += viewRow('Outstanding', fmtMoney(summary.outstanding, currency), outStyle);
      }
      var cogsSplitLbl = global.IOLabels ? IOLabels.cogsLabel() : 'COGS';
      html += viewRow(cogsSplitLbl + ' split',
        'within ' + fmtMoney(summary.cogs.withinBudget, currency) +
        ' · overrun ' + fmtMoney(summary.cogs.overrun, currency) +
        ' · unlinked ' + fmtMoney(summary.cogs.unlinked, currency),
        'font-size:11px;color:var(--text-muted);'
      );
      html += viewRow('Gross margin', fmtMoney(summary.grossMargin, currency), summary.grossMargin >= 0 ? 'color:var(--green);' : 'color:var(--danger);');
      html += viewRow('Net margin', fmtMoney(summary.netMargin, currency), summary.netMargin >= 0 ? 'color:var(--green);' : 'color:var(--danger);');

      if (outCats.length || cogsCats.length) {
        html += '<div class="view-field"><div class="view-field-label">By Category</div>';
        for (var oc = 0; oc < outCats.length; oc++) {
          html += '<div class="view-field-value" style="padding:2px 0;">Out · ' + esc(outCats[oc]) + ': ' + fmtMoney(outByCat[outCats[oc]], currency) + '</div>';
        }
        for (var cc = 0; cc < cogsCats.length; cc++) {
          html += '<div class="view-field-value" style="padding:2px 0;color:var(--text-muted);">COGS · ' + esc(cogsCats[cc]) + ': ' + fmtMoney(cogsByCat[cogsCats[cc]], currency) + '</div>';
        }
        html += '</div>';
      }

      if (actionKeys.length) {
        html += '<div class="view-field"><div class="view-field-label">By Action</div>';
        for (var ak = 0; ak < actionKeys.length; ak++) {
          var key = actionKeys[ak];
          var out = actionOut[key];
          var cgs = actionCogs[key];
          var label = out.title || ('Action ' + (parseInt(key, 10) + 1));
          html += '<div class="view-field-value" style="padding:2px 0;">' +
            esc(label) + ': Out ' + fmtMoney(out.amount, currency) +
            (cgs ? (' · COGS ' + fmtMoney(cgs.amount, currency)) : '') +
            '</div>';
        }
        html += '</div>';
      }

      html += '</div>';
      card.innerHTML = html;
    });
  }

  // ── Options menu ──────────────────────────────────────────────────────────

  function openOptions() {
    if (!currentRecord) return;
    var rec           = currentRecord;
    var isContact     = rec.record_class === 'contact';
    var isStateCommit = rec.record_type  === 'state_commit';
    var isDispute     = rec.record_type  === 'dispute';
    var isAmendment   = rec.record_type  === 'amendment';
    var isChild       = !!rec.parentId;
    var isLocked      = isStateCommit || isDispute || isAmendment;

    var rt = rec.record_type || '';
    var ioRec = isIORecordType(rt);

    optionsItems = [
      { key: '1', label: 'Edit',             action: function() { App.showWizard(rec); } },
      { key: '2', label: 'Share',            action: function() {
        var meta = {};
        if (global.WPNfcHandoff) meta.nfcScenario = WPNfcHandoff.scenarioForRecord(rec);
        App.showShare(rec, meta);
      } },
    ];
    if (global.WPPrintRecord) {
      optionsItems.push({
        key: '',
        label: 'Print summary',
        action: function() {
          var text = WPPrintRecord.formatText(rec);
          if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
              alert('Summary copied to clipboard.');
            }, function() { alert(text); });
          } else {
            alert(text);
          }
        },
      });
    }
    optionsItems = optionsItems.concat([
      { key: '3', label: 'Financials',       action: function() { App.showFinancial(rec); } },
      { key: '4', label: 'View chain',       action: function() { App.showChain({ chainRef: rec.chainRef, sourceId: rec.id }); } },
      { key: '5', label: 'Archive record',   action: doArchive },
      { key: '6', label: 'Save as template', action: doSaveAsTemplate },
    ]);
    if (!isContact && !isLocked && global.WPProgrammableCompose) {
      optionsItems.push({
        key: '0',
        label: 'Edit obligations',
        action: function() {
          App.showWizard(rec, { startScreen: 3, entryRecord: rec });
        },
      });
    }
    if (global.App && App.showSymbols && global.WPRelationalUi) {
      optionsItems.push({
        key: '',
        label: 'Symbol table',
        action: function() {
          App.showSymbols({
            peerKey: WPRelationalUi.peerKeyForRecord(rec),
            record: rec,
            returnTo: 'view',
          });
        },
      });
    }

    if (ioRec) {
      optionsItems = optionsItems.filter(function(o) { return o.key !== '3'; });
    }
    if (rt === 'connection' && rec.connection_ack !== 'confirmed') {
      optionsItems.unshift({ key: '', label: 'Confirm relay', action: doConfirmConnection });
    }
    if (rt === 'connection' && global.WPNocGatekeeper && WPNocGatekeeper.getGateType(rec) === 'sale_confirmed' &&
        !rec.gatekeeper_sale_confirmed) {
      optionsItems.unshift({
        key: '',
        label: 'Mark sale confirmed',
        action: function() {
          WPNocGatekeeper.markSaleConfirmed(rec).then(function(updated) {
            App.showView(updated || rec);
          });
        },
      });
    }
    if (rt === 'connection' && rec.receivedAt && global.App && App.showGatekeeperReceive) {
      optionsItems.unshift({
        key: '',
        label: 'Gatekeeper respond',
        action: function() {
          RecordService.list().then(function(all) {
            if (WPNocGatekeeper.needsGatekeeperReceive(rec, all)) {
              App.showGatekeeperReceive({ parentRecord: rec });
            } else {
              alert('No gatekeeper response needed.');
            }
          });
        },
      });
    }
    if (rt === 'connection') {
      optionsItems.unshift({ key: '', label: 'Create offer', action: doCreateOfferFromConnection });
    }

    if (!isContact && !isLocked && !isChild) {
      optionsItems.push({ key: '7', label: 'Close / commit \u2026', action: doOpenCommitPicker });

      if (!rec._chainRatified) {
        var amendLabel   = 'Amend record';
        var disputeLabel = rec._chainHasDispute ? 'Dispute record \u26a0' : 'Dispute record';
        optionsItems.push({ key: '8', label: amendLabel,   action: doAmend   });
        optionsItems.push({ key: '9', label: disputeLabel, action: doDispute });
      }
    }

    optionsIdx = 0;
    optionsOpen = true;
    optionsScrollReset = true;
    renderOptions();
    document.getElementById('overlay-options').style.display = 'flex';
  }

  function closeOptions() {
    optionsOpen = false;
    document.getElementById('overlay-options').style.display = 'none';
  }

  function renderOptions() {
    var listEl = document.getElementById('options-content');
    if (!listEl) return;
    listEl.innerHTML = optionsItems.map(function(item, i) {
      var hint = item.key ? '<span class="opt-key-hint">[' + esc(item.key) + ']</span>' : '';
      return '<div class="list-item opt-menu-row' + (i === optionsIdx ? ' focused' : '') + '" data-opt-idx="' + i + '">' +
        '<div class="list-item-title">' + esc(item.label) + '</div>' +
        hint +
        '</div>';
    }).join('');
    if (global.OverlayFocus) {
      OverlayFocus.bindRows(listEl, 'data-opt-idx', function(idx) {
        optionsIdx = idx;
        selectOption();
      });
    }
    if (optionsScrollReset) {
      listEl.scrollTop = 0;
      optionsScrollReset = false;
    }
    var focused = listEl.children[optionsIdx];
    if (focused) focused.scrollIntoView({ block: 'nearest' });
  }

  function selectOption() {
    var item = optionsItems[optionsIdx];
    if (item) { closeOptions(); item.action(); }
  }

  function applyBackFocus() {
    var crumb = document.querySelector('#screen-view .screen-crumb');
    if (crumb) crumb.classList.toggle('crumb-focused', backFocused);
  }

  function goBack() {
    if (currentRecord && currentRecord.parentId) {
      RecordService.get(currentRecord.parentId).then(function(parent) {
        if (parent) App.showView(parent);
        else App.showList();
      });
    } else {
      if (App.goBack && App.goBack()) return;
      App.showList({ restoreNav: true });
    }
  }

  function doSaveAsTemplate() {
    if (!currentRecord) return;
    App.showTemplateCreator({ fromRecord: currentRecord, returnTo: 'management' });
  }

  function doArchive() {
    if (!currentRecord || !currentRecord.id) return;
    if (!confirm('Archive this record?')) return;
    RecordService.archive(currentRecord.id).then(function() { goBack(); });
  }

  // ── Commit picker (Close / commit overlay) ─────────────────────────────

  function doOpenCommitPicker() {
    commitPickerOpen = true;
    commitPickerIdx  = 0;
    renderCommitPicker();
    document.getElementById('overlay-commit').style.display = 'flex';
  }

  function closeCommitPicker() {
    commitPickerOpen = false;
    document.getElementById('overlay-commit').style.display = 'none';
  }

  function renderCommitPicker() {
    var el = document.getElementById('commit-content');
    if (!el) return;
    el.innerHTML = COMMIT_TYPES.map(function(t, i) {
      return '<div class="list-item' + (i === commitPickerIdx ? ' focused' : '') + '" data-commit-idx="' + i + '">' +
        '<div class="list-item-title">' + esc(t.icon + ' ' + t.label) + '</div>' +
        '</div>';
    }).join('');
    if (global.OverlayFocus) {
      OverlayFocus.bindRows(el, 'data-commit-idx', function(idx) {
        confirmCommit(COMMIT_TYPES[idx].val);
      });
    }
  }

  function confirmCommit(commitType) {
    closeCommitPicker();
    if (!currentRecord) return;
    var COMMIT_LABELS = { 0: 'Job complete', 1: 'Payment confirmed', 2: 'Terms accepted', 3: 'Disputed' };
    var today = new Date().toISOString().slice(0, 10);
    var newRec = {
      record_type:   'state_commit',
      chainRef:      currentRecord.chainRef,
      job:           COMMIT_LABELS[commitType] + ': ' + (currentRecord.job || ''),
      customer:      currentRecord.customer || '',
      currency:      currentRecord.currency || 'GBP',
      date:          today,
      commitType:    commitType,
      chainComplete: commitType !== 3,
      disputeFlag:   commitType === 3,
      draft:         false,
    };
    // Stamp ratified frame bytes onto the record if markers + codec available
    if (global.WPMarkers && global.WPCodec && global.WPCodec._buildFrame) {
      try {
        var frameBytes = global.WPMarkers.buildRatifiedFrame({
          story:        COMMIT_LABELS[commitType],
          job:          currentRecord.job || '',
          date:         today,
          refNumber:    currentRecord.ref_number || '',
          contextLabel: currentRecord.chainRef   || '',
          commitType:   commitType,
        });
        if (frameBytes && frameBytes.length) {
          // Store as base64 string so it survives JSON serialisation
          var b64 = '';
          for (var i = 0; i < frameBytes.length; i++) {
            b64 += String.fromCharCode(frameBytes[i]);
          }
          newRec._ratifiedFrame = btoa(b64);
        }
      } catch (_) { /* markers optional — don't block commit */ }
    }
    RecordService.create(newRec).then(function(commitRec) {
      App.showView(commitRec);
    });
  }

  // ── Progression picker ─────────────────────────────────────────────────

  function openProgressionPicker() {
    if (!currentRecord) return;
    var items = getProgressionItems(currentRecord);
    if (!items || !items.length) return;
    progressionPickerItems = items;
    progressionPickerIdx   = 0;
    progressionPickerOpen  = true;
    renderProgressionPicker();
    document.getElementById('overlay-progression').style.display = 'flex';
  }

  function closeProgressionPicker() {
    progressionPickerOpen = false;
    document.getElementById('overlay-progression').style.display = 'none';
  }

  function renderProgressionPicker() {
    var el = document.getElementById('progression-content');
    if (!el) return;
    var html = '';
    for (var i = 0; i < progressionPickerItems.length; i++) {
      var item = progressionPickerItems[i];
      html += '<div class="list-item' + (i === progressionPickerIdx ? ' focused' : '') +
        '" data-prog-idx="' + i + '" data-idx="' + i + '">' +
        '<div class="list-item-title">' + esc(item.label) + '</div>' +
        '</div>';
    }
    el.innerHTML = html;
    var rows = el.querySelectorAll('[data-prog-idx]');
    for (var r = 0; r < rows.length; r++) {
      rows[r].onclick = (function(idx) {
        return function() { selectProgression(idx); };
      })(parseInt(rows[r].getAttribute('data-prog-idx'), 10));
    }
  }

  function selectProgression(idx) {
    if (idx === undefined) idx = progressionPickerIdx;
    var item = progressionPickerItems[idx];
    if (!item) return;
    closeProgressionPicker();
    openProgConfirm(item);
  }

  // ── Progression confirm overlay ─────────────────────────────────────────

  function updateProgConfirmFocus() {
    if (!global.OverlayFocus) return;
    OverlayFocus.markChipFocus(
      document.getElementById('prog-confirm-cancel'),
      document.getElementById('prog-confirm-ok'),
      progConfirmBtnIdx
    );
  }

  function openProgConfirm(item) {
    progConfirmTarget = item;
    progConfirmOpen   = true;
    progConfirmBtnIdx = 1;
    var titleEl = document.getElementById('prog-confirm-title');
    var subEl   = document.getElementById('prog-confirm-sub');
    if (titleEl) titleEl.textContent = item.label;
    if (subEl)   subEl.textContent   = 'A new ' + (item.type || '') + ' record will be created in this chain.';
    var cancelBtn = document.getElementById('prog-confirm-cancel');
    var okBtn     = document.getElementById('prog-confirm-ok');
    if (cancelBtn) cancelBtn.onclick = function() { closeProgConfirm(); };
    if (okBtn)     okBtn.onclick     = function() { doProgressTo(progConfirmTarget); };
    document.getElementById('overlay-prog-confirm').style.display = 'flex';
    updateProgConfirmFocus();
  }

  function closeProgConfirm() {
    progConfirmOpen   = false;
    progConfirmTarget = null;
    document.getElementById('overlay-prog-confirm').style.display = 'none';
  }

  function doProgressTo(item) {
    closeProgConfirm();
    if (!currentRecord || !item) return;
    var src = currentRecord;
    var clone = merge({}, src, {
      record_type: item.type,
      parentId:    src.id,
      chainRef:    src.chainRef || src.id,
      draft:       true,
    });
    // Must delete id so RecordService.create() generates a fresh one
    delete clone.id;
    delete clone._ratifiedFrame;
    delete clone._isAmendment;
    delete clone._amendedFromId;
    delete clone._originalSnap;
    delete clone.chainComplete;
    delete clone.disputeFlag;
    delete clone.ackRequest;
    delete clone.ackConfirmed;
    App.showWizard(clone);
  }

  // ── Amendment ──────────────────────────────────────────────────────────

  function doAmend() {
    if (!currentRecord) return;
    var src = currentRecord;
    // Clone the record, stripping id so it creates a new one
    // _amendedFromId links back to the original; changedMask starts empty
    // wizard will set _isAmendment so share codec uses BASE_TEMPLATE=6
    var clone = merge({}, src, {
      chainRef:       src.chainRef,
      record_type:    'amendment',
      _isAmendment:   true,
      _amendedFromId: src.id,
      _originalSnap:  JSON.stringify(src),
      draft:          true,
    });
    delete clone.id;
    App.showWizard(clone);
  }

  // ── Dispute ────────────────────────────────────────────────────────────

  function doDispute() {
    if (!currentRecord) return;
    var src = currentRecord;
    var parentUid = null;
    if (global.WPCrypto && global.WPCrypto.sha256) {
      try {
        var idBytes = [];
        var idStr = src.id || '';
        for (var ci = 0; ci < idStr.length; ci++) { idBytes.push(idStr.charCodeAt(ci) & 0xFF); }
        parentUid = global.WPCrypto.sha256(new Uint8Array(idBytes)).subarray(0, 8);
      } catch (_) { parentUid = null; }
    }
    App.showDispute({ record: src, parentUid: parentUid });
  }

  // ── ACK generation ─────────────────────────────────────────────────────

  function doGenerateAck(rec) {
    // Create a minimal ACK record in the same chain, then share it
    RecordService.create({
      record_type:  'ack',
      chainRef:     rec.chainRef,
      job:          'ACK: ' + (rec.job || ''),
      customer:     rec.customer || '',
      currency:     rec.currency || 'GBP',
      date:         new Date().toISOString().slice(0, 10),
      ackConfirmed: true,
      ackForId:     rec.id,
      draft:        false,
    }).then(function(ackRec) {
      App.showShare(ackRec, { nfcScenario: 'ack_return' });
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function onShow(rec) {
    closeOptions();
    closeCommitPicker();
    closeProgressionPicker();
    closeProgConfirm();
    backFocused = false;
    var ackBar = document.getElementById('view-ack-bar');
    if (ackBar) ackBar.style.display = 'none';
    render(rec);
  }

  function onKey(key) {
    // Progression confirm overlay (highest priority)
    if (progConfirmOpen) {
      var chipSt = { idx: progConfirmBtnIdx };
      if (global.OverlayFocus && OverlayFocus.handleChipKey(
        key, chipSt,
        function() { progConfirmBtnIdx = chipSt.idx; updateProgConfirmFocus(); },
        function(i) {
          if (i === 0) closeProgConfirm();
          else doProgressTo(progConfirmTarget);
        },
        closeProgConfirm
      )) return;
      return;
    }

    // Progression picker
    if (progressionPickerOpen) {
      var progSt = { idx: progressionPickerIdx };
      if (global.OverlayFocus && OverlayFocus.handleKey(
        key, progSt, progressionPickerItems.length,
        function() { progressionPickerIdx = progSt.idx; renderProgressionPicker(); },
        function(i) { selectProgression(i); },
        closeProgressionPicker
      )) return;
      return;
    }

    // Commit picker has highest priority after options overlay
    if (commitPickerOpen) {
      var commitSt = { idx: commitPickerIdx };
      if (global.OverlayFocus && OverlayFocus.handleKey(
        key, commitSt, COMMIT_TYPES.length,
        function() { commitPickerIdx = commitSt.idx; renderCommitPicker(); },
        function(i) { confirmCommit(COMMIT_TYPES[i].val); },
        closeCommitPicker
      )) return;
      return;
    }

    if (optionsOpen) {
      var numKey = parseInt(key, 10);
      if (numKey >= 1 && numKey <= 9) {
        var oi = numKey - 1;
        if (oi < optionsItems.length) { optionsIdx = oi; selectOption(); }
        return;
      }
      var optSt = { idx: optionsIdx };
      if (global.OverlayFocus && OverlayFocus.handleKey(
        key, optSt, optionsItems.length,
        function() { optionsIdx = optSt.idx; renderOptions(); },
        function(i) { optionsIdx = i; selectOption(); },
        closeOptions
      )) return;
      return;
    }

    // Back-button focus mode
    if (backFocused) {
      if (key === 'Enter' || key === 'Backspace') { backFocused = false; applyBackFocus(); goBack(); return; }
      if (key === 'ArrowDown') { backFocused = false; applyBackFocus(); return; }
      return;
    }

    // Collapsed navigation mode
    if (collapseState > 0) {
      switch (key) {
        case 'ArrowUp':
          if (collapsedFocusIdx === 0) { backFocused = true; applyBackFocus(); }
          else { moveCollapsedFocus(-1); }
          return;
        case 'ArrowDown': moveCollapsedFocus(1);  return;
        case 'Enter': {
          var items = getCollapsedItems();
          var focused = items[collapsedFocusIdx] || null;
          var prevState = collapseState;
          expandToItem(focused, prevState);
          return;
        }
        case 'Backspace': goBack(); return;
      }
      return;
    }

    switch (key) {
      case 'ArrowUp':   backFocused = true; applyBackFocus();               break;
      case 'Backspace': goBack();                                             break;
      case 'Enter':     openOptions();                                        break;
      case '1':         App.showWizard(currentRecord);                       break;
      case '2':         if (currentRecord) App.showShare(currentRecord);     break;
      case '3':         if (currentRecord) App.showFinancial(currentRecord); break;
      case '4':         if (currentRecord) App.showChain({ chainRef: currentRecord.chainRef, sourceId: currentRecord.id }); break;
      case '5':         doArchive();                                          break;
      case '6':         doSaveAsTemplate();                                   break;
      case '7':
        if (currentRecord && currentRecord.record_class !== 'contact' &&
            !currentRecord.parentId && currentRecord.record_type !== 'state_commit' &&
            currentRecord.record_type !== 'dispute' && currentRecord.record_type !== 'amendment') {
          doOpenCommitPicker();
        }
        break;
      case '8':
        if (currentRecord && !currentRecord._chainRatified &&
            currentRecord.record_type !== 'state_commit' &&
            currentRecord.record_type !== 'dispute' && currentRecord.record_type !== 'amendment' &&
            !currentRecord.parentId) {
          doAmend();
        }
        break;
      case '9':
        if (currentRecord && !currentRecord._chainRatified &&
            currentRecord.record_type !== 'state_commit' &&
            currentRecord.record_type !== 'dispute' && currentRecord.record_type !== 'amendment' &&
            !currentRecord.parentId) {
          doDispute();
        }
        break;
    }
  }

  function merge() {
    var out = {};
    for (var ai = 0; ai < arguments.length; ai++) {
      var obj = arguments[ai];
      if (!obj) continue;
      for (var k in obj) {
        if (obj.hasOwnProperty(k)) out[k] = obj[k];
      }
    }
    return out;
  }

  global.ViewScreen = {
    onShow:        onShow,
    onKey:         onKey,
    isOptionsOpen: function() { return optionsOpen || commitPickerOpen || progressionPickerOpen || progConfirmOpen; },
    getCurrentRecord: function() { return currentRecord; },
    openCommitPickerFor: function(fields) {
      // Called by App.prefillRecord — if a record is currently shown, open commit picker
      if (currentRecord) { doOpenCommitPicker(); }
    },
  };

}(window));
