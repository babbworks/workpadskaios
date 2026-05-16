// Screen: Main record list
// Exposes: window.ListScreen

(function(global) {
  'use strict';

  var el = {
    content: document.getElementById('list-content'),
  };

  var items = [];
  var focusIdx = 0;
  var filterMode = 'all';  // all | recent
  var panelFilter      = null;  // token from WorkpadsPanel browse nav, null = off
  var activityFilter   = [];    // array of activityId strings, empty = no filter
  var typeFilter       = null;  // record_type string or null
  var typePickerOpen   = false;
  var typePickerMode   = 'filter'; // 'filter' | 'new'
  var typePickerSearch = '';
  var typeFocusIdx     = 0;
  var typeItems        = [];       // [{value, label}] currently visible rows

  // Canonical template catalogue — all types the app supports.
  // 'value' maps to record_type stored on records.
  var TEMPLATE_TYPES = [
    { value: '',        label: 'Job',      desc: 'Standard work job'     },
    { value: 'quote',   label: 'Quote',    desc: 'Price quotation'       },
    { value: 'invoice', label: 'Invoice',  desc: 'Payment invoice'       },
    { value: 'receipt', label: 'Receipt',  desc: 'Payment receipt'       },
    { value: 'pads',    label: 'Basic',    desc: 'Basic text pad (P/A/D/S)' },
    { value: 'newent',  label: 'Business', desc: 'New business entity'   },
  ];

  var TYPE_PICKER_LABELS = {
    '':        'Job',
    'quote':   'Quote',
    'invoice': 'Invoice',
    'receipt': 'Receipt',
    'pads':    'Basic',
    'newent':  'Business',
  };

  var PANEL_FILTER_LABELS = {
    'billed':             'Billed',
    'collected':          'Collected',
    'receivables':        'Receivables',
    'payables':           'Payables',
    'loans':              'Loans',
    'job-charges':        'Job Charges',
    'total-taxes':        'Total Taxes',
    'billable-expenses':  'Billable Expenses',
    'real-job-costs':     'Real Job Costs',
    'operating-costs':    'Operating Costs',
  };

  function fmt(rec) {
    var sub = [];
    if (rec.date)     sub.push(rec.date.slice(5));        // MM-DD
    if (rec.customer) sub.push(rec.customer.slice(0, 20));
    if (rec.receivedAt) sub.push('Received');
    return sub.join(' · ');
  }

  function applyPanelFilter(records, token, callback) {
    var mains    = records.filter(function(r) { return !r.parentId; });
    var children = records.filter(function(r) { return !!r.parentId; });

    // Build parent title lookup for child card enrichment
    var parentMap = {};
    mains.forEach(function(r) { parentMap[r.id] = r.job || r.description || ''; });
    function enrich(list) {
      return list.map(function(c) {
        return merge({}, c, { _parentTitle: parentMap[c.parentId] || '' });
      });
    }

    // ── Filters that return child records directly ───────────────────────────
    if (token === 'billable-expenses' || token === 'job-charges') {
      return callback(enrich(children.filter(function(c) {
        return (c.record_type || c.recordType) === 'expense' && c.expense_billing !== 'cogs';
      })));
    }
    if (token === 'real-job-costs') {
      return callback(enrich(children.filter(function(c) {
        return (c.record_type || c.recordType) === 'expense' && c.expense_billing === 'cogs';
      })));
    }
    if (token === 'payables') {
      return callback(enrich(children.filter(function(c) {
        return (c.record_type || c.recordType) === 'expense';
      })));
    }
    if (token === 'operating-costs') {
      return callback(enrich(children.filter(function(c) {
        return (c.record_type || c.recordType) === 'expense' && !c.parentId;
      })));
    }

    // ── Filters that return parent (job) records ──────────────────────────────
    if (token === 'billed') {
      return callback(mains.filter(function(r) { return parseFloat(r.amount || 0) > 0; }));
    }
    if (token === 'total-taxes') {
      return callback(mains.filter(function(r) { return parseFloat(r.vat || 0) > 0; }));
    }
    if (token === 'collected') {
      return callback(mains.filter(function(r) { return !!r.receivedAt; }));
    }
    if (token === 'loans') {
      return callback([]); // loan record type not yet in schema
    }
    if (token === 'receivables') {
      var promises = mains.map(function(r) {
        return RecordService.listChildren(r.id).then(function(ch) {
          return { record: r, children: ch };
        });
      });
      Promise.all(promises).then(function(results) {
        callback(results.filter(function(res) {
          return FinancialModel.summarize(res.record, res.children).outstanding > 0;
        }).map(function(res) { return res.record; }));
      });
      return;
    }

    callback(mains);
  }

  function render() {
    if (typePickerOpen) { renderTypePicker(); return; }
    RecordService.list().then(function(records) {
      if (panelFilter) {
        applyPanelFilter(records, panelFilter, renderItems);
        return;
      }
      var mains = records.filter(function(r) { return !r.parentId; });
      if (typeFilter !== null) {
        mains = mains.filter(function(r) {
          return (r.record_type || r.recordType || '') === typeFilter;
        });
      }
      if (activityFilter.length > 0) {
        mains = mains.filter(function(r) {
          return activityFilter.indexOf(r.activityId) !== -1;
        });
      }
      if (filterMode === 'recent') {
        var now = Date.now();
        mains = mains.filter(function(r) {
          var t = r.updatedAt || r.createdAt || 0;
          return (now - t) <= (7 * 86400000);
        });
      }
      renderItems(mains);
    });
  }

  function recordTypeBadge(r) {
    var rt = (r.record_type || r.recordType || '').toLowerCase();
    if (rt === 'expense') {
      var billing = (r.expense_billing || '').toLowerCase();
      if (billing === 'cogs') return '<span class="rt-badge rt-cogs">COGS</span>';
      return '<span class="rt-badge rt-exp">EXP</span>';
    }
    if (rt === 'payment') return '<span class="rt-badge rt-pmt">PMT</span>';
    if (rt === 'income')  return '<span class="rt-badge rt-inc">INC</span>';
    return '';
  }

  function fmtAmount(r) {
    var v = parseFloat(r.amount || 0);
    if (!v) return '';
    return (r.currency || '') + v.toFixed(2);
  }

  function renderChildCard(r, i) {
    var badge  = recordTypeBadge(r);
    var title  = r.description || r.job || '(untitled)';
    var amount = fmtAmount(r);
    var sub    = [];
    if (r.date) sub.push(r.date.slice(5));
    if (r.vendor || r.customer) sub.push(esc((r.vendor || r.customer || '').slice(0, 18)));
    var parentChip = r._parentTitle
      ? '<span class="li-parent-chip">' + esc(r._parentTitle.slice(0, 22)) + '</span>'
      : '';
    return '<div class="list-item list-item-child" tabindex="0" data-idx="' + i + '">' +
      (parentChip ? '<div class="li-parent-row">' + parentChip + '</div>' : '') +
      '<div class="list-item-title">' + badge + esc(title) + (amount ? '<span class="li-amount">' + esc(amount) + '</span>' : '') + '</div>' +
      (sub.length ? '<div class="list-item-sub">' + sub.join(' · ') + '</div>' : '') +
      '</div>';
  }

  function renderItems(mains) {
    items = mains;

    var hasNewBtn  = typeFilter !== null && !panelFilter;
    var typeLabel  = hasNewBtn ? (TYPE_PICKER_LABELS[typeFilter] || typeFilter || 'Record') : '';
    var isChildView = panelFilter && items.length && items[0].parentId;

    if (!items.length && !hasNewBtn) {
      el.content.innerHTML =
        renderPanelFilterBar() + renderFilterBar() +
        '<div class="empty-state">No records.<br>Try another filter.</div>';
      bindFilters();
      return;
    }

    var newBtnFocused = hasNewBtn && (items.length === 0 || focusIdx >= items.length);
    var newBtnHtml = hasNewBtn
      ? '<div class="list-item list-new-rec' + (newBtnFocused ? ' focused' : '') + '" id="list-new-rec-btn" data-idx="' + items.length + '">' +
          '<div class="list-item-title">+ New ' + esc(typeLabel) + '</div>' +
        '</div>'
      : '';

    var listHtml = items.map(function(r, i) {
      if (r.parentId) return renderChildCard(r, i);
      return '<div class="list-item" tabindex="0" data-idx="' + i + '">' +
        '<div class="list-item-title">' + esc(r.job || '(untitled)') + '</div>' +
        (fmt(r) ? '<div class="list-item-sub">' + esc(fmt(r)) + '</div>' : '') +
        '</div>';
    }).join('');

    var emptyMsg = (!items.length && hasNewBtn)
      ? '<div style="padding:6px 10px 2px;font-size:11px;color:var(--text-muted);">No ' + esc(typeLabel) + ' records yet.</div>'
      : '';

    el.content.innerHTML =
      renderPanelFilterBar() +
      (isChildView ? '' : renderFilterBar()) +
      listHtml + emptyMsg + newBtnHtml;

    var initIdx = (items.length === 0 && hasNewBtn) ? items.length : Math.min(focusIdx, items.length - 1);
    focusItem(initIdx);
    bindFilters();

    var newBtn = document.getElementById('list-new-rec-btn');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        App.showWizard({ record_type: typeFilter });
      });
    }
  }

  function openTypePicker(mode) {
    typePickerMode   = mode || 'filter';
    typePickerOpen   = true;
    typePickerSearch = '';
    typeFocusIdx     = 0;
    render();
  }

  function closeTypePicker() {
    typePickerOpen = false;
    render();
  }

  function selectType(value) {
    var rt = (value === '__all__') ? null : value;
    typePickerOpen = false;
    if (typePickerMode === 'new') {
      render(); // restore list before navigating
      App.showWizard(rt !== null ? { record_type: rt } : null);
    } else {
      typeFilter = rt;
      focusIdx   = 0;
      render();
    }
  }

  function applyTypePickerFocus() {
    var nodes = el.content.querySelectorAll('.type-picker-row');
    nodes.forEach(function(n) { n.classList.remove('focused'); });
    if (typeFocusIdx >= 0 && typeFocusIdx < nodes.length) {
      nodes[typeFocusIdx].classList.add('focused');
      nodes[typeFocusIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function renderTypePicker() {
    RecordService.list().then(function(records) {
      var mains = records.filter(function(r) { return !r.parentId; });
      var counts = {};
      mains.forEach(function(r) {
        var t = r.record_type || r.recordType || '';
        counts[t] = (counts[t] || 0) + 1;
      });

      // Always start from the full catalogue; add any unknown types found in records
      var seen = {};
      var allTypes = (typePickerMode === 'filter')
        ? [{ value: '__all__', label: 'All Types', desc: 'Clear type filter' }]
        : [];
      TEMPLATE_TYPES.forEach(function(t) { allTypes.push(t); seen[t.value] = true; });
      Object.keys(counts).forEach(function(t) {
        if (!seen[t]) {
          allTypes.push({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1), desc: '' });
          seen[t] = true;
        }
      });

      // Apply search filter
      var term = typePickerSearch.toLowerCase();
      typeItems = term
        ? allTypes.filter(function(item) {
            return item.label.toLowerCase().indexOf(term) !== -1 ||
                   (item.desc || '').toLowerCase().indexOf(term) !== -1;
          })
        : allTypes;

      var isNewMode = typePickerMode === 'new';
      var hdrLabel  = isNewMode ? 'New Record \u2014 Choose Type' : 'Filter by Type';

      var listHtml = typeItems.map(function(item, i) {
        var cnt    = (item.value === '__all__') ? null : (counts[item.value] || 0);
        var isSel  = isNewMode ? false
                    : (item.value === '__all__' ? typeFilter === null : typeFilter === item.value);
        var cntHtml = (cnt !== null)
          ? '<span class="type-picker-count">' + cnt + '</span>' : '';
        return '<div class="type-picker-row' + (typeFocusIdx === i ? ' focused' : '') +
          '" data-tval="' + esc(item.value) + '">' +
          '<div class="type-picker-main">' +
            '<span class="type-picker-label' + (isSel ? ' tpl-active' : '') + '">' + esc(item.label) + '</span>' +
            (item.desc ? '<span class="type-picker-desc">' + esc(item.desc) + '</span>' : '') +
          '</div>' +
          cntHtml +
          '</div>';
      }).join('');

      var existingList = el.content.querySelector('.type-picker-list');
      if (!existingList) {
        // Full render — first time this picker instance opens
        el.content.innerHTML =
          '<div class="list-filter-bar" style="border-bottom:1px solid var(--border);">' +
            '<span style="font-size:10px;color:var(--accent);flex:1;">' + hdrLabel + '</span>' +
            '<span class="badge" id="type-cancel-btn" style="font-size:10px;cursor:pointer;">Cancel</span>' +
          '</div>' +
          '<div class="type-picker-search">' +
            '<input class="field-input" id="type-search-inp" type="text" placeholder="Search types\u2026" ' +
              'value="' + esc(typePickerSearch) + '" autocomplete="off" dir="ltr">' +
          '</div>' +
          '<div class="type-picker-list">' +
            (listHtml || '<div class="empty-state">No matching types.</div>') +
          '</div>';

        var inp = document.getElementById('type-search-inp');
        if (inp) {
          // Delay focus so the triggering keystroke doesn't type into the input
          setTimeout(function() { inp.focus(); var l = inp.value.length; inp.setSelectionRange(l, l); }, 0);
          inp.addEventListener('input', function() {
            typePickerSearch = this.value;
            typeFocusIdx = 0;
            renderTypePicker(); // partial re-render below
          });
          inp.addEventListener('keydown', function(e) {
            // Block navigation shortcuts from being typed into search
            if ('0135*'.indexOf(e.key) !== -1) { e.preventDefault(); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); typeFocusIdx = 0; applyTypePickerFocus(); }
          });
        }
        var cancelBtn = document.getElementById('type-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeTypePicker);
      } else {
        // Partial re-render — only update list, preserving search input + cursor position
        existingList.innerHTML = listHtml || '<div class="empty-state">No matching types.</div>';
      }

      // Bind row click handlers (runs on both full and partial render)
      var rows = el.content.querySelectorAll('[data-tval]');
      for (var i = 0; i < rows.length; i++) {
        rows[i].addEventListener('click', (function(val) {
          return function() { selectType(val); };
        })(rows[i].getAttribute('data-tval')));
      }
    });
  }

  function renderPanelFilterBar() {
    var bars = '';
    if (panelFilter) {
      var label = PANEL_FILTER_LABELS[panelFilter] || panelFilter;
      bars += '<div class="list-panel-filter">' +
        '<span class="lpf-label">\u203a ' + esc(label) + '</span>' +
        '<span class="lpf-clear" data-clear-panel-filter="1">Clear \u00d7</span>' +
        '</div>';
    }
    if (activityFilter.length > 0) {
      var actNames = activityFilter.map(function(id) {
        var a = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.getById(id) : null;
        return a ? a.name : id;
      });
      bars += '<div class="list-panel-filter">' +
        '<span class="lpf-label">\u25c6 ' + esc(actNames.join(', ').slice(0, 28)) + '</span>' +
        '<span class="lpf-clear" data-clear-act-filter="1">Clear \u00d7</span>' +
        '</div>';
    }
    return bars;
  }

  function renderFilterBar() {
    function btn(mode, label) {
      return '<span class="badge' + (filterMode === mode ? ' badge-accent' : '') + '" data-filter="' + mode + '" style="margin-right:4px;">' + label + '</span>';
    }
    var sel = CountryScreen && CountryScreen.getSelected ? CountryScreen.getSelected() : null;
    var flagHtml  = sel ? CountryScreen.flagEmoji(sel.iso) : '\uD83C\uDF0D';
    var countText = '<span class="list-count-first">' + items.length + '</span>';
    var typeBtn = typeFilter !== null
      ? '<span class="badge badge-accent type-active-badge" id="type-filter-btn" style="margin-right:4px;">' +
          esc(TYPE_PICKER_LABELS[typeFilter] || typeFilter || 'Type') + ' \u00d7</span>'
      : '<span class="badge" id="type-filter-btn" style="margin-right:4px;">Type \u25be</span>';
    return '<div class="list-filter-bar">' +
      countText +
      btn('all', 'All') + btn('recent', 'Recent') + typeBtn +
      '<span class="list-flag-btn" id="list-flag-btn" title="Country">' + flagHtml + '</span>' +
      '</div>';
  }

  function bindFilters() {
    var els = el.content.querySelectorAll('[data-filter]');
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener('click', function() {
        filterMode = this.getAttribute('data-filter') || 'all';
        focusIdx = 0;
        render();
      });
    }
    var clearEl = el.content.querySelector('[data-clear-panel-filter]');
    if (clearEl) {
      clearEl.addEventListener('click', function() {
        panelFilter = null;
        focusIdx = 0;
        render();
      });
    }
    var clearActEl = el.content.querySelector('[data-clear-act-filter]');
    if (clearActEl) {
      clearActEl.addEventListener('click', function() {
        activityFilter = [];
        focusIdx = 0;
        render();
      });
    }
    var typeBtn = document.getElementById('type-filter-btn');
    if (typeBtn) {
      typeBtn.addEventListener('click', function() {
        if (typeFilter !== null) { typeFilter = null; focusIdx = 0; render(); }
        else { openTypePicker(); }
      });
    }
    var flagBtn = document.getElementById('list-flag-btn');
    if (flagBtn) {
      flagBtn.addEventListener('click', function() { App.showCountry(); });
    }
  }

  function focusItem(idx) {
    var nodes = el.content.querySelectorAll('.list-item');
    nodes.forEach(function(n) { n.classList.remove('focused'); });
    if (idx >= 0 && idx < nodes.length) {
      focusIdx = idx;
      nodes[idx].classList.add('focused');
      nodes[idx].scrollIntoView({ block: 'nearest' });
      WorkpadsPanel.setContext({ screen: 'list', record: items[idx] || null });
    }
  }

  function maxFocusIdx() {
    return items.length - 1 + (typeFilter !== null && !panelFilter ? 1 : 0);
  }

  function focusedRecord() {
    return items[focusIdx] || null;
  }

  function onKey(key) {
    if (typePickerOpen) {
      switch (key) {
        case 'ArrowUp':
          if (typeFocusIdx > 0) { typeFocusIdx--; applyTypePickerFocus(); }
          else { var si = document.getElementById('type-search-inp'); if (si) si.focus(); }
          break;
        case 'ArrowDown':
          if (typeFocusIdx < typeItems.length - 1) { typeFocusIdx++; applyTypePickerFocus(); }
          break;
        case 'Enter':
          if (typeItems[typeFocusIdx]) selectType(typeItems[typeFocusIdx].value);
          break;
        case 'Backspace':
          closeTypePicker();
          break;
      }
      return;
    }
    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) focusItem(focusIdx - 1);
        break;
      case 'ArrowDown':
        if (focusIdx < maxFocusIdx()) focusItem(focusIdx + 1);
        break;
      case 'ArrowLeft':
        cycleFilter(-1);
        break;
      case 'ArrowRight':
        cycleFilter(1);
        break;
      case 'Enter':
        if (typeFilter !== null && focusIdx >= items.length) {
          App.showWizard({ record_type: typeFilter });
        } else {
          var rec = focusedRecord();
          if (rec) App.showView(rec);
        }
        break;
      case '1':
        if (typeFilter !== null) {
          App.showWizard({ record_type: typeFilter });
        } else {
          openTypePicker('new');
        }
        break;
      case '3':
        openTypePicker();
        break;
      case '4':
        App.showLedger();
        break;
      case '5':
        App.showManagement();
        break;
      case '6':
        App.showNewEntWizard();
        break;
    }
  }

  function cycleFilter(dir) {
    var modes = ['all', 'recent'];
    var idx = modes.indexOf(filterMode);
    if (idx < 0) idx = 0;
    var next = idx + dir;
    if (next >= modes.length) { openTypePicker(); return; }
    if (next < 0) return;
    filterMode = modes[next];
    focusIdx = 0;
    render();
  }

  function setFilter(token) {
    panelFilter = token || null;
    filterMode = 'all';
    focusIdx = 0;
    render();
  }

  function setActivityFilter(ids) {
    activityFilter = Array.isArray(ids) ? ids : [];
    panelFilter = null;
    filterMode = 'all';
    focusIdx = 0;
    render();
  }

  function onShow() {
    render();
  }

  global.ListScreen = { onShow: onShow, onKey: onKey, focusedRecord: focusedRecord, render: render, setFilter: setFilter, setActivityFilter: setActivityFilter, itemAt: function(i) { return items[i] || null; } };

}(window));
