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
  var collapseState   = 0;  // 0=full 1=field-labels 2=section-headers
  var collapsedFocusIdx = 0;

  var LABELS = {
    job:            'Job',
    customer:       'Customer',
    date:           'Date',
    location:       'Location',
    customer_phone: 'Phone',
    start_time:     'Start',
    end_time:       'End',
    meeting_time:   'Meeting',
    worker:         'Worker',
    details:        'Details',
    story:          'Story',
  };

  var TYPE_LABELS = { quote: 'Quote', invoice: 'Invoice', receipt: 'Receipt' };

  var CLASS_LABELS = { pads: 'PADS', job: 'JOB' };
  function recordDesignation(rec) {
    var cls = (rec.record_class || rec.recordClass || '').toLowerCase();
    return CLASS_LABELS[cls] || 'JOB';
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
    if (collapseState === 2) return el.content.querySelectorAll('.view-section');
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
    if (csk) csk.textContent = collapseState > 0 ? 'Open' : 'Edit';
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

  // ── View toolbar (sections dropdown + search + 3-state collapse) ─────────

  function populateViewToolbar(rec) {
    var sel    = document.getElementById('view-sec-sel');
    var inp    = document.getElementById('view-search');
    var togBtn = document.getElementById('view-toggle-btn');
    if (!sel || !inp) return;

    // ── Sections dropdown ──────────────────────────────────────────────────
    var sections = [{ id: '', label: 'Sections' }, { id: 'view-sec-top', label: 'Top' }];
    if (rec.parentId)                                     sections.push({ id: 'view-parent-super', label: 'Parent' });
    if (Array.isArray(rec.actions) && rec.actions.length) sections.push({ id: 'view-sec-actions',  label: 'Actions' });
    sections.push({ id: 'vsec-fin', label: 'Financials' });

    sel.innerHTML = sections.map(function(s) {
      return '<option value="' + s.id + '">' + esc(s.label) + '</option>';
    }).join('');
    sel.onchange = function() {
      var target = this.value ? document.getElementById(this.value) : null;
      if (target) target.scrollIntoView({ block: 'start' });
      this.value = '';
    };

    // ── 3-state collapse toggle ────────────────────────────────────────────
    collapseState = 0;
    collapsedFocusIdx = 0;
    el.content.classList.remove('view-collapsed', 'view-sec-collapsed');
    updateViewCsk();
    if (togBtn) {
      togBtn.className = 'view-tb-toggle';
      togBtn.onclick = function() {
        collapseState = (collapseState + 1) % 3;
        el.content.classList.toggle('view-collapsed',     collapseState === 1);
        el.content.classList.toggle('view-sec-collapsed', collapseState === 2);
        togBtn.className = 'view-tb-toggle' +
          (collapseState === 1 ? ' collapsed' : collapseState === 2 ? ' collapsed-2' : '');
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

  // ── Main render ──────────────────────────────────────────────────────────

  function render(rec) {
    currentRecord   = rec;
    currentParent   = null;
    collapseState   = 0;
    collapsedFocusIdx = 0;
    el.title.textContent = rec.job || '(untitled)';
    updateViewCsk();

    var typeLabel   = TYPE_LABELS[rec.record_type] || '';
    var designation = rec.parentId
      ? ((rec.record_type || rec.recordType || 'entry').toUpperCase())
      : recordDesignation(rec);

    var html = '<div class="view-paper" id="view-sec-top">';

    html += '<div class="view-paper-header">' +
      '<span class="view-rec-class">' + esc(designation) + '</span>' +
      (typeLabel ? '<span class="view-rec-type">' + esc(typeLabel) + '</span>' : '') +
      '</div>';

    if (rec.parentId) {
      html += '<div id="view-parent-super"></div>';
    }

    // Process section
    var processBody = '';
    var keys = Object.keys(LABELS);
    for (var i = 0; i < keys.length; i++) {
      var id  = keys[i];
      var val = rec[id];
      if (val) processBody += viewRow(LABELS[id], esc(val));
    }
    if (rec.receivedAt) {
      processBody += viewRow('Source', '<span style="color:var(--text-muted);">Received via link</span>');
    }
    if (processBody) {
      html += viewSection('vsec-process', 'Process', processBody);
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

    // Financials section (content injected async)
    html += '<div class="view-section" id="vsec-fin">' +
      '<div class="view-sec-hdr">Financials</div>' +
      '<div class="view-sec-body"><div id="view-fin-card"></div></div>' +
      '</div>';

    html += '</div>';
    el.content.innerHTML = html;
    WorkpadsPanel.setContext({ screen: 'view', record: rec });

    populateViewToolbar(rec);
    loadParentSuperLabel(rec);
    loadFinancialCard(rec);
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

  // ── Financial card ───────────────────────────────────────────────────────

  function loadFinancialCard(rec) {
    if (!rec.id) return;
    RecordService.listChildren(rec.id).then(function(children) {
      var card = document.getElementById('view-fin-card');
      if (!card || currentRecord !== rec) return;
      var summary = FinancialModel.summarize(rec, children);
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

      var html = '<div style="padding-top:4px;">';

      if (summary.price) {
        html += viewRow('Amount', fmtMoney(summary.price, currency));
      }
      if (summary.tax) {
        html += viewRow('Tax (' + esc(rec.vat) + '%)', fmtMoney(summary.tax, currency));
      }
      if (summary.total) {
        html += viewRow('Total', fmtMoney(summary.total, currency), 'font-weight:bold;');
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
        html += viewRow(
          'COGS · ' + esc((line.record.job || 'COGS') + ref),
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
      html += viewRow('COGS split',
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
    optionsItems = [
      { label: 'Share',          action: function() { App.showShare(currentRecord); } },
      { label: 'Edit',           action: function() { App.showWizard(currentRecord); } },
      { label: 'Archive record', action: doArchive },
    ];
    optionsIdx = 0;
    optionsOpen = true;
    renderOptions();
    document.getElementById('overlay-options').style.display = 'flex';
  }

  function closeOptions() {
    optionsOpen = false;
    document.getElementById('overlay-options').style.display = 'none';
  }

  function renderOptions() {
    var listEl = document.getElementById('options-content');
    listEl.innerHTML = optionsItems.map(function(item, i) {
      return '<div class="list-item' + (i === optionsIdx ? ' focused' : '') + '">' +
        '<div class="list-item-title">' + esc(item.label) + '</div>' +
        '</div>';
    }).join('');
  }

  function selectOption() {
    var item = optionsItems[optionsIdx];
    if (item) { closeOptions(); item.action(); }
  }

  function goBack() {
    if (currentRecord && currentRecord.parentId) {
      RecordService.get(currentRecord.parentId).then(function(parent) {
        if (parent) App.showView(parent);
        else App.showList();
      });
    } else {
      App.showList();
    }
  }

  function doArchive() {
    if (!currentRecord || !currentRecord.id) return;
    if (!confirm('Archive this record?')) return;
    RecordService.archive(currentRecord.id).then(function() { goBack(); });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function onShow(rec) {
    closeOptions();
    render(rec);
  }

  function onKey(key) {
    if (optionsOpen) {
      switch (key) {
        case 'ArrowUp':
          if (optionsIdx > 0) { optionsIdx--; renderOptions(); }
          break;
        case 'ArrowDown':
          if (optionsIdx < optionsItems.length - 1) { optionsIdx++; renderOptions(); }
          break;
        case 'Enter':   selectOption();  break;
        case 'Backspace': closeOptions(); break;
      }
      return;
    }

    // Collapsed navigation mode
    if (collapseState > 0) {
      switch (key) {
        case 'ArrowUp':   moveCollapsedFocus(-1); return;
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
      case 'Backspace': goBack();                              break;
      case 'Enter':
      case '1':         App.showWizard(currentRecord);        break;
      case '2':         if (currentRecord) App.showShare(currentRecord); break;
      case '3':         doArchive();                          break;
    }
  }

  global.ViewScreen = {
    onShow:        onShow,
    onKey:         onKey,
    isOptionsOpen: function() { return optionsOpen; },
    getCurrentRecord: function() { return currentRecord; },
  };

}(window));
