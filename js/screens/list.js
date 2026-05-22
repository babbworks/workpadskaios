// Screen: Main record list
// Exposes: window.ListScreen

(function(global) {
  'use strict';

  var el = {
    content: document.getElementById('list-content'),
  };

  var items = [];
  var focusIdx = 0;
  var summaryCache = null; // cached {billed, outstanding, currency} for summary bar
  var panelFilter      = null;  // token from WorkpadsPanel browse nav, null = off
  var activityFilter   = [];    // array of activityId strings, empty = no filter
  var typeFilter       = null;  // record_type string or null
  var contactFilter    = null;  // { id, name, recordType } — from contact panel tally nav
  var workFilter       = null;  // 'today' | 'future' | 'past' | null (from WP+ home)
  var padsFilter       = null;  // 'received' | 'sent' | 'locked' | null
  var dateRange        = null;  // { start, end, label } from calendar-wp
  var listReturnTo     = null;  // 'home' | 'calendar' | null
  var actPickerOpen    = false; // inline activity picker overlay
  var actPickerFocusIdx = 0;
  var actPickerFilter  = 'all'; // 'all' | 'own' | 'other'
  var actPickerZone    = 'list'; // 'list' | 'pills'
  var actPickerPillIdx = 0;     // 0=All 1=Personal 2=Other
  var savedTplsOpen    = false; // saved templates section expanded
  var typePickerOpen   = false;
  var typePickerMode   = 'filter'; // 'filter' | 'new' | 'template' (template = My Templates tab)
  var typePickerFromNew = false;   // true when opened via "1" new record
  var typePickerSearch = '';
  var typeFocusIdx     = 0;
  var typeItems        = [];       // [{value, label}] currently visible rows
  var tplPickerFilter      = 'standard'; // 'standard' | 'all' | 'personal' | 'imported'
  var typePickerRecFilter  = 'standard'; // 'standard' | 'all' (Record tab sub-filter)
  var typePickerListFilter = 'all';      // 'all' | 'standard' | 'custom' | 'received' (filter-mode sub-filter)
  var typePickerPillFocus  = false;      // true when D-pad focus is on filter pills row
  var pillFocusIdx         = 0;
  var PILL_IDS = ['tp-fl-all', 'tp-fl-standard', 'tp-fl-custom', 'tp-fl-received'];
  var sortPickerOpen   = false;
  var sortFocusIdx     = 0;
  var sortMode = localStorage.getItem('wp_sort_mode') || 'newest';
  var listDensity = parseInt(localStorage.getItem('wp_list_density') || '0', 10);
  // Focus mode: when true, hides chain derivative types and dims completed records.
  // Persisted so the user's preference survives navigation.
  var focusMode = localStorage.getItem('wp_focus_mode') !== '0'; // default ON

  // Record types that are chain derivatives — never shown in Focus mode main list
  var CHAIN_DERIVATIVE_TYPES = { state_commit: true, ack: true, amendment: true, dispute: true };
  var NEW_RECORD_HIDDEN_TYPES = { state_commit: true, amendment: true };
  var NEW_RECORD_BRANCH_TYPES = { payable: true, receivable: true, dispute: true, ack: true };
  var NEW_RECORD_EXTRA_TYPES = [
    { value: 'payable',    label: 'Payable',         desc: 'Money you owe' },
    { value: 'receivable', label: 'Receivable',      desc: 'Money owed to you' },
    { value: 'dispute',    label: 'Dispute',         desc: 'Challenge a record' },
    { value: 'ack',        label: 'Acknowledgement', desc: 'Confirm receipt or agreement' },
  ];
  var PAYABLE_LINK_TYPES    = { invoice: true, receipt: true };
  var RECEIVABLE_LINK_TYPES = { invoice: true, quote: true, receipt: true };
  var DENSITY_LABELS = ['Normal', 'Compact', 'Min'];
  var toolbarFocusIdx  = -1;  // -1 = toolbar not active; 0+ = focused button index
  var branchPickerOpen = false;
  var branchPickerType = null;
  var branchFocusIdx   = 0;
  var linkPickerOpen   = false;
  var linkPickerType   = null;
  var linkPickerFocusIdx = 0;
  var linkPickerItems  = [];
  var linkPickerGroup  = 'all';
  var linkPickerZone   = 'list';
  var linkPickerPillIdx = 0;
  var savedNavState    = null;

  // ── Contact browser sub-screen state ──────────────────────────────────────
  var contactBrowserOpen  = false;  // contact sub-screen active
  var contactSearch       = '';     // search string in contact browser
  var contactCatFilter    = null;   // integer or null, category filter
  var contactBrowserZone  = 'list'; // 'list' | 'pills' | 'search'
  var contactCatFocusIdx  = 0;      // focused pill index (0 = All)
  var contactFocusIdx     = 0;      // focused contact item index

  var SORT_MODES = ['newest', 'oldest', 'az', 'za', 'type', 'activity', 'amount-hi', 'amount-lo'];
  var SORT_LABELS = {
    newest: 'Newest', oldest: 'Oldest', az: 'A\u2192Z', za: 'Z\u2192A',
    type: 'By type', activity: 'By activity',
    'amount-hi': 'Amt\u2193', 'amount-lo': 'Amt\u2191',
  };
  var listGroupOn = localStorage.getItem('wp_list_group') !== '0';
  var listGroupCollapsed = {};
  try {
    listGroupCollapsed = JSON.parse(localStorage.getItem('wp_list_group_collapsed') || '{}');
  } catch (_) { listGroupCollapsed = {}; }

  // Canonical template catalogue — all types the app supports.
  // 'value' maps to record_type stored on records.
  var TEMPLATE_TYPES = [
    { value: '__outcome__', label: 'Outcome', desc: 'The need stated — share to worker' },
    { value: 'sale',        label: 'Sale',    desc: 'Quick market tally' },
    { value: '',        label: 'Job',      desc: 'Standard work job'     },
    { value: 'quote',   label: 'Quote',    desc: 'Price quotation'       },
    { value: 'invoice', label: 'Invoice',  desc: 'Payment invoice'       },
    { value: 'receipt', label: 'Receipt',  desc: 'Payment receipt'       },
    { value: 'pads',    label: 'Basic',    desc: 'Basic text pad (P/A/D/S)' },
    { value: 'newent',  label: 'Business', desc: 'New business entity'   },
    { value: 'contact', label: 'Contact',  desc: 'Contact record'        },
  ];

  var CONTACT_CATEGORIES = [
    { val: null, label: 'All'          },
    { val: 0,    label: 'Customer'     },
    { val: 1,    label: 'Client'       },
    { val: 2,    label: 'Vendor'       },
    { val: 3,    label: 'Supplier'     },
    { val: 4,    label: 'Contractor'   },
    { val: 5,    label: 'Sub-contractor' },
    { val: 6,    label: 'Partner'      },
    { val: 7,    label: 'Employee'     },
    { val: 8,    label: 'Agent'        },
    { val: 9,    label: 'Accountant'   },
    { val: 10,   label: 'Bank / Lender' },
    { val: 11,   label: 'Insurer'      },
    { val: 12,   label: 'Landlord'     },
    { val: 13,   label: 'Government'   },
    { val: 14,   label: 'Utility'      },
    { val: 15,   label: 'Referral'     },
    { val: 16,   label: 'Prospect'     },
    { val: 17,   label: 'General'      },
  ];

  var CAT_LABEL_MAP = {};
  CONTACT_CATEGORIES.forEach(function(c) { if (c.val !== null) CAT_LABEL_MAP[c.val] = c.label; });

  var TYPE_PICKER_LABELS = {
    '__outcome__': 'Outcome',
    'sale':        'Sale',
    '':        'Job',
    'quote':   'Quote',
    'invoice': 'Invoice',
    'receipt': 'Receipt',
    'pads':    'Basic',
    'newent':  'Business',
    'contact': 'Contact',
  };

  var PANEL_FILTER_LABELS = {
    'billed':             'Billed',
    'collected':          'Collecting',
    'receivables':        'Receivables',
    'payables':           'Payables',
    'loans':              'Loans',
    'sales':              'Sales',
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

  // One pass over all records — avoids chained .filter() on weak devices
  function filterMainRecords(records) {
    var out = [];
    var useFocus = focusMode && !contactFilter && !typeFilter;
    var todayStr = workFilter ? new Date().toISOString().slice(0, 10) : null;
    var cfId = contactFilter ? contactFilter.id : null;
    var cfName = contactFilter ? (contactFilter.name || '').toLowerCase() : '';
    var cfType = contactFilter ? contactFilter.recordType : null;
    var typeVal = typeFilter;
    var actF = activityFilter;
    var actLen = actF.length;
    var dr = dateRange;
    var i, r, rt, d10, d, byId, byName;

    for (i = 0; i < records.length; i++) {
      r = records[i];
      if (r.parentId) continue;

      if (useFocus && CHAIN_DERIVATIVE_TYPES[r.record_type || '']) continue;

      if (contactFilter) {
        if (r.id === cfId) continue;
        byId = cfId && r.linkedContactId === cfId;
        byName = cfName && (
          (r.customer || '').toLowerCase() === cfName ||
          (r.counterparty || '').toLowerCase() === cfName
        );
        if (!byId && !byName) continue;
        if (cfType) {
          rt = (r.record_type || r.recordType || '').toLowerCase();
          if (cfType === 'expense') {
            if (rt !== 'expense' && rt !== 'cogs') continue;
          } else if (rt !== cfType) continue;
        }
      }

      if (typeVal !== null && (r.record_type || r.recordType || '') !== typeVal) continue;
      if (actLen > 0 && actF.indexOf(r.activityId) === -1) continue;

      if (workFilter && todayStr) {
        d10 = (r.date || '').slice(0, 10);
        if (workFilter === 'today' && d10 !== todayStr) continue;
        if (workFilter === 'future' && (r.date || '') <= todayStr) continue;
        if (workFilter === 'past' && (!d10 || d10 >= todayStr)) continue;
      }

      if (padsFilter) {
        rt = r.record_type || '';
        if (padsFilter === 'received' && !r.receivedAt) continue;
        if (padsFilter === 'sent' && r.receivedAt) continue;
        if (padsFilter === 'locked' && !r.locked) continue;
        if (padsFilter === 'standard' && STANDARD_TYPES.indexOf(rt) === -1) continue;
        if (padsFilter === 'custom' && (STANDARD_TYPES.indexOf(rt) !== -1 || r.receivedAt)) continue;
        if (padsFilter === 'imported' && !r.receivedAt) continue;
      }

      if (dr) {
        d = (r.date || '').slice(0, 10);
        if (!d || d < dr.start || d > dr.end) continue;
      }

      out.push(r);
    }
    return out;
  }

  function sortMainRecords(mains) {
    mains.sort(function(a, b) {
      if (sortMode === 'oldest') return (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0);
      if (sortMode === 'az') return (a.job || '').localeCompare(b.job || '');
      if (sortMode === 'za') return (b.job || '').localeCompare(a.job || '');
      if (sortMode === 'amount-hi') return parseFloat(b.amount || 0) - parseFloat(a.amount || 0);
      if (sortMode === 'amount-lo') return parseFloat(a.amount || 0) - parseFloat(b.amount || 0);
      if (sortMode === 'type') {
        var ta = TYPE_PICKER_LABELS[a.record_type || ''] || a.record_type || '';
        var tb = TYPE_PICKER_LABELS[b.record_type || ''] || b.record_type || '';
        var tc = ta.localeCompare(tb);
        return tc !== 0 ? tc : (a.job || '').localeCompare(b.job || '');
      }
      if (sortMode === 'activity') {
        if (typeof WorkActivityService !== 'undefined') {
          var aa = a.activityId ? (WorkActivityService.getById(a.activityId) || {}).name || '' : '';
          var ab = b.activityId ? (WorkActivityService.getById(b.activityId) || {}).name || '' : '';
          var ac = aa.localeCompare(ab);
          return ac !== 0 ? ac : (a.job || '').localeCompare(b.job || '');
        }
        return (a.job || '').localeCompare(b.job || '');
      }
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
    return mains;
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
      // Outstanding payables: expense/cogs children not yet marked paid
      return callback(enrich(children.filter(function(c) {
        var rt = c.record_type || c.recordType || '';
        return (rt === 'expense' || rt === 'cogs') && !c.paidAt && parseFloat(c.amount || 0) > 0;
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
      // Records where payment has been collected (paidTotal > 0)
      var colPromises = mains.map(function(r) {
        return RecordService.listChildren(r.id).then(function(ch) {
          return { record: r, children: ch };
        });
      });
      Promise.all(colPromises).then(function(results) {
        callback(results.filter(function(res) {
          return FinancialModel.summarize(res.record, res.children).paidTotal > 0;
        }).map(function(res) { return res.record; }));
      });
      return;
    }
    if (token === 'loans') {
      return callback(mains.filter(function(r) {
        return (r.record_type || r.recordType || '') === 'loan';
      }));
    }
    if (token === 'sales') {
      return callback(mains.filter(function(r) {
        var rt = (r.record_type || r.recordType || '');
        return rt === 'sale' || (rt === 'invoice' && parseFloat(r.amount || 0) > 0);
      }));
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
    if (contactBrowserOpen) { renderContactBrowser(); return; }
    if (linkPickerOpen)   { renderLinkPicker();   return; }
    if (branchPickerOpen) { renderBranchPicker(); return; }
    if (actPickerOpen)  { renderActPicker();  return; }
    if (sortPickerOpen) { renderSortPicker(); return; }
    if (typePickerOpen) { renderTypePicker(); return; }
    RecordService.list().then(function(records) {
      if (panelFilter) {
        applyPanelFilter(records, panelFilter, function(mains) { renderItems(mains, records); });
        return;
      }
      renderItems(sortMainRecords(filterMainRecords(records)), records);
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
    return CurrencyUtil.fmt(v, r.currency || '');
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

  function renderSummaryBar() {
    if (panelFilter || typeFilter !== null || activityFilter.length > 0) return '';
    var cached = summaryCache;
    var inner;
    if (cached) {
      var billedStr = CurrencyUtil.fmtFlat(cached.billed);
      var ostStr    = CurrencyUtil.fmtFlat(cached.outstanding);
      var hasOst    = Object.keys(cached.outstanding).some(function(c) { return cached.outstanding[c] > 0; });
      inner =
        '<span class="sb-num">' + esc(billedStr) + '</span>' +
        '<span class="sb-sep">\u00b7</span>' +
        '<span class="sb-lbl">due</span>' +
        '<span class="sb-num' + (hasOst ? ' sb-due' : '') + '">' + esc(ostStr) + '</span>' +
        '<span class="sb-fin-link" id="sb-fin-link">Finance \u203a</span>';
    } else {
      inner =
        '<span class="sb-loading">Loading\u2026</span>' +
        '<span class="sb-fin-link" id="sb-fin-link">Finance \u203a</span>';
    }
    return '<div class="list-summary-bar" id="list-summary-bar">' + inner + '</div>';
  }

  function loadSummaryBar(allRecords) {
    if (panelFilter || typeFilter !== null || activityFilter.length > 0) return;
    if (summaryCache && !allRecords) return;

    function computeSummary(records) {
      var childMap = RecordService.childrenByParentId(records);
      var billedBuckets = {};
      var paidBuckets = {};
      var i, r, cur, amt, ch, ci, c, paid;

      for (i = 0; i < records.length; i++) {
        r = records[i];
        if (r.parentId || parseFloat(r.amount || 0) <= 0) continue;
        cur = (r.currency || 'unknown').toUpperCase();
        amt = parseFloat(r.amount || 0);
        if (parseFloat(r.vat || 0) > 0) amt += amt * parseFloat(r.vat) / 100;
        CurrencyUtil.addFlat(billedBuckets, cur, amt);
        ch = childMap[r.id] || [];
        paid = 0;
        for (ci = 0; ci < ch.length; ci++) {
          c = ch[ci];
          if ((c.record_type || c.recordType) === 'payment') {
            paid += parseFloat(c.amount || 0);
          }
        }
        if (paid > 0) CurrencyUtil.addFlat(paidBuckets, cur, paid);
      }

      var ostBuckets = {};
      Object.keys(billedBuckets).forEach(function(c) {
        var ost = (billedBuckets[c] || 0) - (paidBuckets[c] || 0);
        if (ost !== 0) ostBuckets[c] = ost;
      });

      summaryCache = { billed: billedBuckets, outstanding: ostBuckets };
      var bar = document.getElementById('list-summary-bar');
      if (!bar) return;
      var billedStr = CurrencyUtil.fmtFlat(billedBuckets);
      var ostStr    = CurrencyUtil.fmtFlat(ostBuckets);
      var hasOst    = Object.keys(ostBuckets).some(function(c) { return ostBuckets[c] > 0; });
      bar.innerHTML =
        '<span class="sb-num">' + esc(billedStr) + '</span>' +
        '<span class="sb-sep">\u00b7</span>' +
        '<span class="sb-lbl">due</span>' +
        '<span class="sb-num' + (hasOst ? ' sb-due' : '') + '">' + esc(ostStr) + '</span>' +
        '<span class="sb-fin-link" id="sb-fin-link">Finance \u203a</span>';
      bindSummaryBar();
    }

    if (allRecords) {
      computeSummary(allRecords);
      return;
    }
    RecordService.list().then(computeSummary);
  }

  function bindSummaryBar() {
    var link = document.getElementById('sb-fin-link');
    if (link) link.addEventListener('click', function() { App.showFinanceOverview(); });
  }

  // Status pill derived from record fields — no async chain lookup needed
  // Uses fields already on the record (commitType, disputeFlag, chainComplete, draft)
  var STATUS_PILL_COMMIT = { 0: 'Done', 1: 'Paid', 2: 'Agreed', 3: 'Disputed' };
  function buildStatusPill(r) {
    if ((r.tag || '') === 'share_pending') {
      return '<span class="ls-pill ls-pill-draft">Share pending</span>';
    }
    if (r.draft)        return '<span class="ls-pill ls-pill-draft">Draft</span>';
    if (r.disputeFlag)  return '<span class="ls-pill ls-pill-dispute">\u26a0 Disputed</span>';
    if (r.chainComplete) {
      var lbl = r.commitType !== undefined ? (STATUS_PILL_COMMIT[r.commitType] || 'Done') : 'Done';
      return '<span class="ls-pill ls-pill-done">' + lbl + '</span>';
    }
    return '';
  }

  function renderItems(mains, allRecords) {
    items = mains;

    var hasNewBtn  = typeFilter !== null && !panelFilter;
    var typeLabel  = hasNewBtn ? (TYPE_PICKER_LABELS[typeFilter] || typeFilter || 'Record') : '';
    var isChildView = panelFilter && items.length && items[0].parentId;

    if (!items.length && !hasNewBtn) {
      el.content.classList.remove('density-compact', 'density-minimal');
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

    var listHtml = buildListBodyHtml();

    var emptyMsg = (!items.length && hasNewBtn)
      ? '<div style="padding:6px 10px 2px;font-size:11px;color:var(--text-muted);">No ' + esc(typeLabel) + ' records yet.</div>'
      : '';

    el.content.classList.remove('density-compact', 'density-minimal');
    if (listDensity === 1) el.content.classList.add('density-compact');
    else if (listDensity === 2) el.content.classList.add('density-minimal');
    el.content.innerHTML =
      renderPanelFilterBar() +
      (isChildView ? '' : renderFilterBar()) +
      renderSummaryBar() +
      renderSavedTemplates() +
      listHtml + emptyMsg + newBtnHtml;

    var initIdx = (items.length === 0 && hasNewBtn) ? items.length : Math.min(focusIdx, Math.max(0, items.length - 1));
    var pendingScroll = savedNavState ? savedNavState.scrollTop : null;
    if (savedNavState) savedNavState = null;
    focusItem(initIdx);
    if (pendingScroll != null && el.content) {
      el.content.scrollTop = pendingScroll;
      var node = el.content.querySelectorAll('.list-item')[initIdx];
      if (node) node.scrollIntoView({ block: 'nearest' });
      el.content.scrollTop = pendingScroll;
    }
    bindFilters();
    bindSummaryBar();
    loadSummaryBar();
    bindSavedTemplates();

    var newBtn = document.getElementById('list-new-rec-btn');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        App.showWizard({ record_type: typeFilter });
      });
    }
  }

  function openTypePicker(mode) {
    toolbarFocusIdx  = -1;
    typePickerMode   = mode || 'filter';
    typePickerOpen    = true;
    typePickerFromNew = (mode === 'new');
    typePickerSearch  = '';
    typeFocusIdx          = 0;
    tplPickerFilter       = 'standard';
    typePickerRecFilter   = 'standard';
    typePickerListFilter  = 'all';
    render();
  }

  function closeTypePicker() {
    typePickerOpen = false;
    typePickerFromNew = false;
    typePickerPillFocus = false;
    render();
  }

  function selectType(value) {
    var rt = (value === '__all__') ? null : value;
    typePickerOpen = false;
    if (typePickerMode === 'template') {
      render();
      App.showTemplateCreator({ recordType: value, returnTo: 'list' });
    } else if (typePickerMode === 'new') {
      if (rt === '__outcome__') {
        render();
        App.showIOCreate({ returnTo: 'list' });
        return;
      }
      if (rt === 'sale') {
        render();
        App.showSaleTally({ returnTo: 'list' });
        return;
      }
      if (rt && NEW_RECORD_BRANCH_TYPES[rt]) {
        branchPickerType = rt;
        branchPickerOpen = true;
        branchFocusIdx   = 0;
        render();
        return;
      }
      render();
      App.showWizard(rt !== null ? { record_type: rt } : null);
    } else {
      typeFilter = rt;
      focusIdx   = 0;
      render();
    }
  }

  function saveNavState() {
    savedNavState = {
      focusIdx:  focusIdx,
      scrollTop: el.content ? el.content.scrollTop : 0,
    };
  }

  function pickerShellHtml(title, bodyHtml) {
    return '<div class="list-filter-bar picker-bar">' +
      '<span class="picker-bar-title">' + esc(title) + '</span>' +
      '<span class="badge" id="picker-cancel-btn">Cancel</span>' +
    '</div>' +
    '<div class="type-picker-list">' + bodyHtml + '</div>';
  }

  function bindPickerCancel(fn) {
    var btn = document.getElementById('picker-cancel-btn');
    if (btn) btn.addEventListener('click', fn);
  }

  function closeBranchPicker() {
    branchPickerOpen = false;
    branchPickerType = null;
    render();
  }

  function closeLinkPicker() {
    linkPickerOpen = false;
    linkPickerType = null;
    linkPickerItems = [];
    render();
  }

  function branchPickerRows() {
    var t = branchPickerType;
    var label = (t || '').charAt(0).toUpperCase() + (t || '').slice(1);
    var rows = [];
    if (t !== 'ack') {
      rows.push({ id: 'new',  label: 'New ' + label, desc: 'Create from scratch' });
    }
    rows.push({ id: 'link', label: 'Link to record', desc: 'Tie to an existing record' });
    return rows;
  }

  function renderBranchPicker() {
    var rows = branchPickerRows();
    var body = rows.map(function(row, i) {
      return '<div class="type-picker-row' + (branchFocusIdx === i ? ' focused' : '') + '" data-branch="' + row.id + '">' +
        '<div class="type-picker-main">' +
          '<span class="type-picker-label">' + esc(row.label) + '</span>' +
          '<span class="type-picker-desc">' + esc(row.desc) + '</span>' +
        '</div></div>';
    }).join('');
    el.content.innerHTML = pickerShellHtml('New ' + esc((branchPickerType || '').charAt(0).toUpperCase() + (branchPickerType || '').slice(1)), body);
    bindPickerCancel(closeBranchPicker);
    var rowEls = el.content.querySelectorAll('[data-branch]');
    for (var i = 0; i < rowEls.length; i++) {
      rowEls[i].addEventListener('click', (function(id) {
        return function() { selectBranch(id); };
      })(rowEls[i].getAttribute('data-branch')));
    }
  }

  function selectBranch(id) {
    var t = branchPickerType;
    if (id === 'link') {
      branchPickerOpen = false;
      linkPickerType   = t;
      linkPickerOpen   = true;
      linkPickerGroup  = 'all';
      linkPickerZone   = 'list';
      linkPickerFocusIdx = 0;
      renderLinkPicker();
      return;
    }
    branchPickerOpen = false;
    if (t === 'payable' || t === 'receivable') {
      App.showLiabilities({ type: t });
    } else if (t === 'dispute') {
      App.showWizard({ record_type: 'dispute', draft: true, job: 'Dispute', description: 'New dispute — link to a record from options after save.' });
    }
    branchPickerType = null;
    render();
  }

  function recordLinkGroup(r) {
    return r.receivedAt ? 'received' : 'issued';
  }

  function filterLinkCandidates(records, mode, group) {
    var out = [];
    var i, r, rt, g;
    for (i = 0; i < records.length; i++) {
      r = records[i];
      if (r.parentId) continue;
      rt = (r.record_type || r.recordType || '').toLowerCase();
      if (CHAIN_DERIVATIVE_TYPES[rt] && rt !== 'dispute') continue;
      g = recordLinkGroup(r);
      if (group === 'received' && g !== 'received') continue;
      if (group === 'issued' && g !== 'issued') continue;
      if (mode === 'payable') {
        if (!PAYABLE_LINK_TYPES[rt] || !r.receivedAt) continue;
      } else if (mode === 'receivable') {
        if (!RECEIVABLE_LINK_TYPES[rt] || r.receivedAt) continue;
      }
      out.push(r);
    }
    out.sort(function(a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); });
    return out;
  }

  function renderLinkPicker() {
    RecordService.list().then(function(records) {
      linkPickerItems = filterLinkCandidates(records, linkPickerType, linkPickerGroup);
      var showGroups = linkPickerType === 'dispute' || linkPickerType === 'ack';
      var pillsHtml = '';
      if (showGroups) {
        var LINK_PILLS = ['all', 'received', 'issued'];
        var LINK_LABELS = { all: 'All', received: 'Received', issued: 'Issued' };
        pillsHtml = '<div class="tp-pad-filters cb-pills-row">' +
          LINK_PILLS.map(function(p, i) {
            return '<span class="tp-pad-btn' + (linkPickerGroup === p ? ' active' : '') +
              (linkPickerZone === 'pills' && linkPickerPillIdx === i ? ' focused' : '') +
              '" data-link-pill="' + p + '">' + esc(LINK_LABELS[p]) + '</span>';
          }).join('') + '</div>';
      }
      var rows = linkPickerItems.map(function(r, i) {
        var rt = (r.record_type || r.recordType || '');
        var sub = [rt, recordLinkGroup(r)].join(' \u00b7 ');
        return '<div class="type-picker-row' + (linkPickerZone === 'list' && linkPickerFocusIdx === i ? ' focused' : '') +
          '" data-link-idx="' + i + '">' +
          '<div class="type-picker-main">' +
            '<span class="type-picker-label">' + esc(r.job || '(untitled)') + '</span>' +
            '<span class="type-picker-desc">' + esc(sub) + '</span>' +
          '</div></div>';
      }).join('');
      var empty = linkPickerItems.length
        ? ''
        : '<div class="empty-state" style="font-size:11px;padding:10px;">No matching records for this filter.</div>';
      var title = 'Link ' + (linkPickerType || 'record');
      el.content.innerHTML = pickerShellHtml(title, pillsHtml + (rows || empty));
      bindPickerCancel(function() {
        var t = linkPickerType;
        linkPickerOpen = false;
        linkPickerItems = [];
        linkPickerType = null;
        branchPickerType = t;
        branchPickerOpen = true;
        renderBranchPicker();
      });
      var pillEls = el.content.querySelectorAll('[data-link-pill]');
      for (var pi = 0; pi < pillEls.length; pi++) {
        pillEls[pi].addEventListener('click', (function(btn) {
          return function() {
            linkPickerGroup = btn.getAttribute('data-link-pill');
            linkPickerFocusIdx = 0;
            linkPickerZone = 'list';
            renderLinkPicker();
          };
        })(pillEls[pi]));
      }
      var rowEls = el.content.querySelectorAll('[data-link-idx]');
      for (var ri = 0; ri < rowEls.length; ri++) {
        rowEls[ri].addEventListener('click', (function(idx) {
          return function() { selectLinkRecord(idx); };
        })(parseInt(rowEls[ri].getAttribute('data-link-idx'), 10)));
      }
    });
  }

  function selectLinkRecord(idx) {
    var rec = linkPickerItems[idx];
    if (!rec) return;
    var mode = linkPickerType;
    linkPickerOpen = false;
    linkPickerType = null;
    branchPickerType = null;
    if (mode === 'payable' || mode === 'receivable') {
      App.showLiabilities({ type: mode, linkedRecord: rec });
    } else if (mode === 'dispute') {
      App.showDispute({ record: rec });
    } else if (mode === 'ack') {
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
        App.showShare(ackRec);
      });
    }
    render();
  }

  function applyTypePickerFocus() {
    var nodes = el.content.querySelectorAll('.type-picker-row');
    nodes.forEach(function(n) { n.classList.remove('focused'); });
    if (typeFocusIdx >= 0 && typeFocusIdx < nodes.length) {
      nodes[typeFocusIdx].classList.add('focused');
      nodes[typeFocusIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function applyPillFocus() {
    PILL_IDS.forEach(function(id, i) {
      var btn = document.getElementById(id);
      if (btn) btn.classList.toggle('focused', typePickerPillFocus && i === pillFocusIdx);
    });
  }

  function renderTypePicker() {
    if (typePickerMode === 'template') {
      renderTemplatePickerContent();
      return;
    }
    RecordService.list().then(function(records) {
      var mains = records.filter(function(r) { return !r.parentId; });
      var counts = {};
      var receivedTypes = {};
      var STANDARD_VALS = TEMPLATE_TYPES.map(function(t) { return t.value; });
      mains.forEach(function(r) {
        var t = r.record_type || r.recordType || '';
        counts[t] = (counts[t] || 0) + 1;
        if (r.receivedAt) receivedTypes[t] = true;
      });

      // Always start from the full catalogue; add any unknown types found in records
      var seen = {};
      var allTypes = (typePickerMode === 'filter')
        ? [{ value: '__all__', label: 'All Types', desc: 'Clear type filter' }]
        : [];
      TEMPLATE_TYPES.forEach(function(t) { allTypes.push(t); seen[t.value] = true; });
      Object.keys(counts).forEach(function(t) {
        if (!seen[t] && !NEW_RECORD_HIDDEN_TYPES[t] &&
            !(CHAIN_DERIVATIVE_TYPES[t] && !NEW_RECORD_BRANCH_TYPES[t])) {
          allTypes.push({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1), desc: '' });
          seen[t] = true;
        }
      });
      if (typePickerMode === 'new') {
        NEW_RECORD_EXTRA_TYPES.forEach(function(ex) {
          if (!seen[ex.value]) { allTypes.push(ex); seen[ex.value] = true; }
        });
      }

      var isNewMode    = typePickerMode === 'new';
      var isFilterMode = typePickerMode === 'filter';

      // Record tab sub-filter
      if (isNewMode && typePickerRecFilter === 'standard') {
        allTypes = allTypes.filter(function(item) {
          return TEMPLATE_TYPES.some(function(t) { return t.value === item.value; });
        });
      }
      if (isNewMode && typePickerRecFilter === 'all') {
        allTypes = allTypes.filter(function(item) {
          if (NEW_RECORD_HIDDEN_TYPES[item.value]) return false;
          if (CHAIN_DERIVATIVE_TYPES[item.value] && !NEW_RECORD_BRANCH_TYPES[item.value]) return false;
          return true;
        });
      }

      // Filter mode sub-filter (filters the type list in-place)
      if (isFilterMode && typePickerListFilter !== 'all') {
        allTypes = allTypes.filter(function(item) {
          if (item.value === '__all__') return true; // always keep the "All Types" clear option
          if (typePickerListFilter === 'standard') return STANDARD_VALS.indexOf(item.value) !== -1;
          if (typePickerListFilter === 'custom')   return STANDARD_VALS.indexOf(item.value) === -1;
          if (typePickerListFilter === 'received') return !!receivedTypes[item.value];
          return true;
        });
      }

      // Apply search filter
      var term = typePickerSearch.toLowerCase();
      typeItems = term
        ? allTypes.filter(function(item) {
            return item.label.toLowerCase().indexOf(term) !== -1 ||
                   (item.desc || '').toLowerCase().indexOf(term) !== -1;
          })
        : allTypes;

      var hdrLabel = isNewMode ? 'New Record \u2014 Choose Type' : 'Filter by Type';

      // Mode-toggle tabs (Record | My Templates) shown in 'new' mode
      var modeTabs = isNewMode
        ? '<div class="tc-type-mode-tabs">' +
            '<span class="tc-type-tab active" id="tp-mode-rec">Record</span>' +
            '<span class="tc-type-tab" id="tp-mode-tpl">My Templates</span>' +
          '</div>'
        : '';

      function pill(id, label, active) {
        return '<span class="tp-pad-btn' + (active ? ' active' : '') + '" id="' + id + '">' + label + '</span>';
      }

      // Sub-filter pills
      var filterHtml = '';
      if (isNewMode) {
        filterHtml = '<div class="tp-pad-filters">' +
          pill('tp-rec-all',      'All',      typePickerRecFilter === 'all') +
          pill('tp-rec-standard', 'Standard', typePickerRecFilter === 'standard') +
        '</div>';
      } else if (isFilterMode) {
        filterHtml = '<div class="tp-pad-filters">' +
          pill('tp-fl-all',      'All',      typePickerListFilter === 'all') +
          pill('tp-fl-standard', 'Standard', typePickerListFilter === 'standard') +
          pill('tp-fl-custom',   'Custom',   typePickerListFilter === 'custom') +
          pill('tp-fl-received', 'Received', typePickerListFilter === 'received') +
        '</div>';
      }

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
          modeTabs +
          filterHtml +
          '<div class="type-picker-search">' +
            '<input class="field-input" id="type-search-inp" type="text" placeholder="Search types\u2026" ' +
              'value="' + esc(typePickerSearch) + '" autocomplete="off" dir="ltr">' +
          '</div>' +
          '<div class="type-picker-list">' +
            (listHtml || '<div class="empty-state">No matching types.</div>') +
          '</div>';

        var inp = document.getElementById('type-search-inp');
        if (inp) {
          setTimeout(function() { inp.focus(); var l = inp.value.length; inp.setSelectionRange(l, l); }, 0);
          inp.addEventListener('input', function() {
            typePickerSearch = this.value;
            typeFocusIdx = 0;
            renderTypePicker();
          });
          inp.addEventListener('keydown', function(e) {
            if ('0135*'.indexOf(e.key) !== -1) { e.preventDefault(); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); typeFocusIdx = 0; applyTypePickerFocus(); }
          });
        }
        var cancelBtn = document.getElementById('type-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeTypePicker);

        var recTab = document.getElementById('tp-mode-rec');
        if (recTab) recTab.addEventListener('click', function() {
          typePickerMode = 'new'; typePickerSearch = ''; typeFocusIdx = 0; typePickerRecFilter = 'standard';
          el.content.innerHTML = ''; renderTypePicker();
        });
        var tplTab = document.getElementById('tp-mode-tpl');
        if (tplTab) tplTab.addEventListener('click', function() {
          typePickerMode = 'template'; typePickerSearch = ''; typeFocusIdx = 0; tplPickerFilter = 'standard';
          el.content.innerHTML = ''; renderTypePicker();
        });

        // Record tab sub-filter pills
        var recAllBtn = document.getElementById('tp-rec-all');
        if (recAllBtn) recAllBtn.addEventListener('click', function() {
          typePickerRecFilter = 'all'; typeFocusIdx = 0; el.content.innerHTML = ''; renderTypePicker();
        });
        var recStdBtn = document.getElementById('tp-rec-standard');
        if (recStdBtn) recStdBtn.addEventListener('click', function() {
          typePickerRecFilter = 'standard'; typeFocusIdx = 0; el.content.innerHTML = ''; renderTypePicker();
        });

        // Filter mode sub-filter pills — filter type list in-place
        var flAllBtn = document.getElementById('tp-fl-all');
        if (flAllBtn) flAllBtn.addEventListener('click', function() {
          typePickerListFilter = 'all'; typeFocusIdx = 0; el.content.innerHTML = ''; renderTypePicker();
        });
        var flStdBtn = document.getElementById('tp-fl-standard');
        if (flStdBtn) flStdBtn.addEventListener('click', function() {
          typePickerListFilter = 'standard'; typeFocusIdx = 0; el.content.innerHTML = ''; renderTypePicker();
        });
        var flCusBtn = document.getElementById('tp-fl-custom');
        if (flCusBtn) flCusBtn.addEventListener('click', function() {
          typePickerListFilter = 'custom'; typeFocusIdx = 0; el.content.innerHTML = ''; renderTypePicker();
        });
        var flRecBtn = document.getElementById('tp-fl-received');
        if (flRecBtn) flRecBtn.addEventListener('click', function() {
          typePickerListFilter = 'received'; typeFocusIdx = 0; el.content.innerHTML = ''; renderTypePicker();
        });
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

  function tplPickerHdrLabel() {
    return typePickerFromNew ? 'New record \u2014 template' : 'My Templates';
  }

  function tplPickerUseItem(item) {
    if (!item) return;
    typePickerOpen = false;
    render();
    if (item._awaitImport) {
      App.showManagement({ tab: 'templates', tplMode: 'pending-list' });
      return;
    }
    if (typePickerFromNew) {
      if (item._isStandard) {
        var rt = item._blank ? null : item.value;
        App.showWizard(rt !== null ? { record_type: rt } : null);
      } else {
        var pre = (typeof RecordTemplateService !== 'undefined')
          ? RecordTemplateService.buildRecord(item.value) : {};
        App.showWizard(pre);
      }
      return;
    }
    if (item._isStandard) {
      App.showTemplateCreator({ recordType: item._blank ? null : item.value, returnTo: 'list' });
    } else {
      App.showTemplateCreator({ editId: item.value, returnTo: 'list' });
    }
  }

  function renderTemplatePickerContent() {
    var term = typePickerSearch.toLowerCase();
    var items = [];

    if (tplPickerFilter === 'standard' || tplPickerFilter === 'all') {
      items.push({ value: '__blank__', label: 'Blank', desc: 'Fully custom \u2014 empty starter', _isStandard: true, _blank: true });
      TEMPLATE_TYPES.forEach(function(t) {
        items.push({ value: t.value, label: t.label, desc: t.desc + ' starter', _isStandard: true });
      });
    }
    if (tplPickerFilter === 'personal' || tplPickerFilter === 'all') {
      (typeof RecordTemplateService !== 'undefined' ? RecordTemplateService.listPersonal() : [])
        .forEach(function(t) {
          items.push({ value: t.id, label: t.name || 'Untitled', desc: t.description || 'Personal', _isStandard: false, _tpl: t });
        });
    }
    if (tplPickerFilter === 'imported' || tplPickerFilter === 'all') {
      (typeof RecordTemplateService !== 'undefined' ? RecordTemplateService.listImported() : [])
        .forEach(function(t) {
          items.push({ value: t.id, label: t.name || 'Untitled', desc: t.description || 'Imported', _isStandard: false, _tpl: t, _imported: true });
        });
    }

    var pendingN = (typeof RecordTemplateService !== 'undefined')
      ? RecordTemplateService.listPendingImport().length : 0;
    if (tplPickerFilter === 'imported' && pendingN > 0) {
      items.unshift({
        _awaitImport: true,
        label: pendingN + ' awaiting import',
        desc: 'In storage \u2014 review to import',
      });
    }

    if (term) {
      items = items.filter(function(item) {
        if (item._awaitImport) return item.label.toLowerCase().indexOf(term) !== -1;
        return item.label.toLowerCase().indexOf(term) !== -1 ||
               (item.desc || '').toLowerCase().indexOf(term) !== -1;
      });
    }

    typeItems = items;

    function fBtn(val, label) {
      return '<span class="tp-pad-btn' + (tplPickerFilter === val ? ' active' : '') + '" data-tpl-filter="' + val + '">' + label + '</span>';
    }

    var listHtml = items.length
      ? items.map(function(item, i) {
          if (item._awaitImport) {
            return '<div class="type-picker-row' + (typeFocusIdx === i ? ' focused' : '') +
              '" data-tpl-item="' + i + '" style="border:1px dashed var(--accent);">' +
              '<div class="type-picker-main">' +
                '<span class="type-picker-label" style="color:var(--accent);">' + esc(item.label) + '</span>' +
                '<span class="type-picker-desc">' + esc(item.desc) + '</span>' +
              '</div></div>';
          }
          var badge = item._imported ? '<span class="tp-tpl-badge">Imported</span>' : '';
          var descText = item.desc || '';
          return '<div class="type-picker-row' + (typeFocusIdx === i ? ' focused' : '') +
            '" data-tpl-item="' + i + '">' +
            '<div class="type-picker-main">' +
              '<span class="type-picker-label">' + esc(item.label) + badge + '</span>' +
              (descText ? '<span class="type-picker-desc">' + esc(descText) + '</span>' : '') +
            '</div></div>';
        }).join('')
      : '<div class="empty-state">No templates in this filter.</div>';

    var filterHint = typePickerFromNew
      ? '<div class="tp-tpl-filter-hint" style="font-size:9px;color:var(--text-muted);padding:2px 10px 4px;">' +
          'Standard = starters \u00b7 Personal = yours \u00b7 Imported = adopted</div>'
      : '';

    var existingList = el.content.querySelector('.type-picker-list');
    if (!existingList) {
      el.content.innerHTML =
        '<div class="list-filter-bar" style="border-bottom:1px solid var(--border);">' +
          '<span style="font-size:10px;color:var(--accent);flex:1;">' + tplPickerHdrLabel() + '</span>' +
          '<span class="badge" id="type-cancel-btn" style="font-size:10px;cursor:pointer;">Cancel</span>' +
        '</div>' +
        (typePickerFromNew
          ? '<div class="tc-type-mode-tabs">' +
              '<span class="tc-type-tab" id="tp-mode-rec">Record</span>' +
              '<span class="tc-type-tab active" id="tp-mode-tpl">My Templates</span>' +
            '</div>'
          : '') +
        '<div class="tp-pad-filters">' +
          fBtn('all', 'All') + fBtn('standard', 'Standard') + fBtn('personal', 'Personal') + fBtn('imported', 'Imported') +
        '</div>' +
        filterHint +
        '<div class="type-picker-search">' +
          '<input class="field-input" id="type-search-inp" type="text" placeholder="Search templates\u2026" ' +
            'value="' + esc(typePickerSearch) + '" autocomplete="off" dir="ltr">' +
        '</div>' +
        '<div class="type-picker-list">' + listHtml + '</div>';

      var inp = document.getElementById('type-search-inp');
      if (inp) {
        setTimeout(function() { inp.focus(); var l = inp.value.length; inp.setSelectionRange(l, l); }, 0);
        inp.addEventListener('input', function() {
          typePickerSearch = this.value; typeFocusIdx = 0; renderTypePicker();
        });
        inp.addEventListener('keydown', function(e) {
          if ('0135*'.indexOf(e.key) !== -1) { e.preventDefault(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); typeFocusIdx = 0; applyTypePickerFocus(); }
        });
      }
      document.getElementById('type-cancel-btn').addEventListener('click', closeTypePicker);

      var recTab = document.getElementById('tp-mode-rec');
      if (recTab) recTab.addEventListener('click', function() {
        typePickerMode = 'new'; typePickerSearch = ''; typeFocusIdx = 0; typePickerRecFilter = 'standard';
        el.content.innerHTML = ''; renderTypePicker();
      });
      var tplTab = document.getElementById('tp-mode-tpl');
      if (tplTab) tplTab.addEventListener('click', function() {
        typePickerMode = 'template'; typePickerSearch = ''; typeFocusIdx = 0; tplPickerFilter = 'standard';
        el.content.innerHTML = ''; renderTypePicker();
      });

      var filterBtns = el.content.querySelectorAll('[data-tpl-filter]');
      for (var fi = 0; fi < filterBtns.length; fi++) {
        filterBtns[fi].addEventListener('click', (function(btn) {
          return function() {
            tplPickerFilter = btn.getAttribute('data-tpl-filter');
            typeFocusIdx = 0; el.content.innerHTML = ''; renderTypePicker();
          };
        })(filterBtns[fi]));
      }
    } else {
      existingList.innerHTML = listHtml;
      var hintEl = el.content.querySelector('.tp-tpl-filter-hint');
      if (hintEl) hintEl.style.display = filterHint ? 'block' : 'none';
    }

    var rows = el.content.querySelectorAll('[data-tpl-item]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', (function(idx) {
        return function() {
          tplPickerUseItem(typeItems[idx]);
        };
      })(parseInt(rows[i].getAttribute('data-tpl-item'), 10)));
    }
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
    var countText = '<span class="lfb-count">' + items.length + '</span>';
    var sortBtn = '<span class="badge lfb-badge" id="list-sort-btn">' +
      esc(SORT_LABELS[sortMode] || 'Sort') + '</span>';
    var typeBtn = typeFilter !== null
      ? '<span class="badge badge-accent lfb-badge type-active-badge" id="type-filter-btn">' +
          esc(TYPE_PICKER_LABELS[typeFilter] || typeFilter || 'Type') + ' \u00d7</span>'
      : '<span class="badge lfb-badge" id="type-filter-btn">Type</span>';
    var actBtn = activityFilter.length > 0
      ? '<span class="badge badge-accent lfb-badge" id="list-act-btn">A \u00d7</span>'
      : '<span class="badge lfb-badge" id="list-act-btn">A</span>';
    var focusBtn = focusMode
      ? '<span class="badge badge-accent lfb-badge" id="list-focus-btn">Focus</span>'
      : '<span class="badge lfb-badge" id="list-focus-btn">Full</span>';
    var densBtn = '<span class="badge lfb-badge' + (listDensity > 0 ? ' badge-accent' : '') +
      '" id="list-density-btn" title="List density">' + esc(DENSITY_LABELS[listDensity] || 'D') + '</span>';
    var grpBtn = '<span class="badge lfb-badge' + (listGroupOn ? ' badge-accent' : '') +
      '" id="list-group-btn" title="Group by type">Grp</span>';
    var sel = CountryScreen && CountryScreen.getSelected ? CountryScreen.getSelected() : null;
    var flagHtml = sel ? CountryScreen.flagEmoji(sel.iso) : '\uD83C\uDF0D';
    var sellBtn = '<span class="badge lfb-badge badge-sell" id="list-sell-btn">Sell</span>';
    var flagBtn  = '<span class="lfb-flag" id="list-flag-btn">' + flagHtml + '</span>';
    return '<div class="list-filter-bar">' +
      countText +
      sellBtn + sortBtn + typeBtn + actBtn + densBtn + grpBtn + focusBtn +
      '<span style="flex:1;"></span>' +
      flagBtn +
    '</div>';
  }

  function cycleListDensity() {
    listDensity = (listDensity + 1) % 3;
    localStorage.setItem('wp_list_density', String(listDensity));
    focusIdx = 0;
    render();
  }

  // ── Sort picker ────────────────────────────────────────────────────────────

  function openSortPicker() { toolbarFocusIdx = -1; sortPickerOpen = true; sortFocusIdx = SORT_MODES.indexOf(sortMode); if (sortFocusIdx < 0) sortFocusIdx = 0; render(); }
  function closeSortPicker() { sortPickerOpen = false; render(); }

  function renderSortPicker() {
    var rows = SORT_MODES.map(function(m, i) {
      var isSel = m === sortMode;
      var isFoc = sortFocusIdx === i;
      return '<div class="type-picker-row' + (isFoc ? ' focused' : '') + '" data-sort-mode="' + m + '">' +
        '<span class="type-picker-check">' + (isSel ? '\u2714' : '') + '</span>' +
        '<span class="type-picker-label">' + esc(SORT_LABELS[m]) + '</span>' +
      '</div>';
    }).join('');

    el.content.innerHTML = pickerShellHtml('Sort records', rows);
    bindPickerCancel(closeSortPicker);

    var rowEls = el.content.querySelectorAll('[data-sort-mode]');
    for (var i = 0; i < rowEls.length; i++) {
      rowEls[i].addEventListener('click', (function(m) {
        return function() { selectSort(m); };
      })(rowEls[i].getAttribute('data-sort-mode')));
    }
    var foc = el.content.querySelectorAll('[data-sort-mode]')[sortFocusIdx];
    if (foc) foc.scrollIntoView({ block: 'nearest' });
  }

  function selectSort(m) {
    sortMode = m;
    localStorage.setItem('wp_sort_mode', m);
    focusIdx = 0;
    closeSortPicker();
  }

  // ── Activity picker ────────────────────────────────────────────────────────

  function openActPicker() { toolbarFocusIdx = -1; actPickerOpen = true; actPickerFocusIdx = 0; actPickerZone = 'list'; actPickerFilter = 'all'; actPickerPillIdx = 0; render(); }
  function closeActPicker() { actPickerOpen = false; render(); }

  function actAddFromPicker() {
    if (typeof WorkActivityService === 'undefined') return;
    var inp = document.getElementById('act-picker-new-inp');
    var name = inp && inp.value.trim();
    if (!name) return;
    var kind = actPickerFilter === 'other' ? 'other' : 'own';
    WorkActivityService.create(name, kind);
    actPickerFocusIdx = 0;
    actPickerZone = 'list';
    renderActPicker();
    if (inp) { inp.value = ''; }
  }

  function renderActPicker() {
    var allActs = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];
    var acts = actPickerFilter === 'own'   ? allActs.filter(function(a) { return a.type !== 'other'; }) :
               actPickerFilter === 'other' ? allActs.filter(function(a) { return a.type === 'other'; }) :
               allActs;
    var ACT_PILLS = ['all', 'own', 'other'];
    var ACT_PILL_LABELS = { all: 'All', own: 'Personal', other: 'Other' };
    var pillsHtml = '<div class="tp-pad-filters cb-pills-row">' + ACT_PILLS.map(function(p, i) {
      var active = actPickerFilter === p;
      var focused = actPickerZone === 'pills' && actPickerPillIdx === i;
      return '<span class="tp-pad-btn' + (active ? ' active' : '') + (focused ? ' focused' : '') +
        '" data-act-pill="' + p + '">' + esc(ACT_PILL_LABELS[p]) + '</span>';
    }).join('') + '</div>';

    var createFocused = actPickerZone === 'create';
    var createRow =
      '<div class="act-new-row act-picker-create' + (createFocused ? ' focused' : '') + '" id="act-picker-create-row">' +
        '<input class="field-input act-new-input" id="act-picker-new-inp" ' +
          'placeholder="New activity name\u2026" autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<span class="badge badge-accent act-add-btn" id="act-picker-add-btn">Add</span>' +
      '</div>';

    var rows = acts.map(function(a, i) {
      var selected = activityFilter.indexOf(a.id) !== -1;
      var focused  = actPickerZone === 'list' && actPickerFocusIdx === i;
      var badge    = a.type === 'other' ? ' <span style="font-size:9px;color:var(--text-muted);">other</span>' : '';
      return '<div class="type-picker-row' + (focused ? ' focused' : '') + '" data-act-id="' + esc(a.id) + '">' +
        '<span class="type-picker-check">' + (selected ? '\u2714' : '') + '</span>' +
        '<span class="type-picker-label">' + esc(a.name) + badge + '</span>' +
      '</div>';
    }).join('');
    var clearIdx = acts.length;
    var clearRow = '<div class="type-picker-row' + (actPickerZone === 'list' && actPickerFocusIdx === clearIdx ? ' focused' : '') + '" data-act-id="__clear__">' +
      '<span class="type-picker-check"></span>' +
      '<span class="type-picker-label" style="color:var(--text-muted);">Clear filter</span>' +
    '</div>';

    var body = pillsHtml + createRow +
      (rows || '<div class="empty-state" style="font-size:11px;padding:8px;">No activities in this filter — add one below.</div>') +
      clearRow;
    el.content.innerHTML = pickerShellHtml('Filter by Activity', body);
    bindPickerCancel(closeActPicker);

    var addBtn = document.getElementById('act-picker-add-btn');
    if (addBtn) addBtn.addEventListener('click', actAddFromPicker);
    var actInp = document.getElementById('act-picker-new-inp');
    if (actInp) {
      if (createFocused) setTimeout(function() { actInp.focus(); }, 0);
      actInp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { actAddFromPicker(); e.preventDefault(); e.stopPropagation(); }
      });
    }

    var pillEls = el.content.querySelectorAll('[data-act-pill]');
    for (var pi = 0; pi < pillEls.length; pi++) {
      pillEls[pi].addEventListener('click', (function(btn) {
        return function() {
          actPickerFilter = btn.getAttribute('data-act-pill');
          actPickerFocusIdx = 0; actPickerZone = 'list'; renderActPicker();
        };
      })(pillEls[pi]));
    }

    var rowEls = el.content.querySelectorAll('[data-act-id]');
    for (var i = 0; i < rowEls.length; i++) {
      rowEls[i].addEventListener('click', (function(id) {
        return function() { selectActivity(id); };
      })(rowEls[i].getAttribute('data-act-id')));
    }
  }

  function selectActivity(id) {
    if (id === '__clear__') {
      activityFilter = [];
    } else {
      var idx = activityFilter.indexOf(id);
      if (idx !== -1) activityFilter.splice(idx, 1);
      else activityFilter.push(id);
    }
    focusIdx = 0;
    closeActPicker();
  }

  // ── Contact browser sub-screen ─────────────────────────────────────────────

  function openContactBrowser() {
    contactBrowserOpen = true;
    contactSearch = '';
    contactCatFilter = null;
    contactBrowserZone = 'list';
    contactFocusIdx = 0;
    contactCatFocusIdx = 0;
    render();
  }

  function closeContactBrowser() {
    contactBrowserOpen = false;
    contactSearch = '';
    contactCatFilter = null;
    contactBrowserZone = 'list';
    typeFilter = null;
    focusIdx = 0;
    render();
  }

  function renderContactBrowser() {
    var sVal = contactSearch.toLowerCase();
    RecordService.list().then(function(records) {
      var contacts = records.filter(function(r) {
        var rt = (r.record_type || r.recordType || '').toLowerCase();
        if (rt !== 'contact') return false;
        if (contactCatFilter !== null && r.category !== contactCatFilter) return false;
        if (sVal) {
          var name = (r.job || r.name || '').toLowerCase();
          var phone = (r.phone || '').toLowerCase();
          var email = (r.email || '').toLowerCase();
          if (name.indexOf(sVal) === -1 && phone.indexOf(sVal) === -1 && email.indexOf(sVal) === -1) return false;
        }
        return true;
      });

      var pillsHtml = CONTACT_CATEGORIES.map(function(c, i) {
        var active = c.val === contactCatFilter;
        var focused = contactBrowserZone === 'pills' && contactCatFocusIdx === i;
        return '<span class="cb-pill' + (active ? ' active' : '') + (focused ? ' focused' : '') +
          '" data-cb-cat="' + (c.val === null ? '__all__' : c.val) + '">' + esc(c.label) + '</span>';
      }).join('');

      var listHtml = contacts.map(function(r, i) {
        var focused = contactBrowserZone === 'list' && contactFocusIdx === i;
        var catLabel = r.category != null ? (CAT_LABEL_MAP[r.category] || '') : '';
        var sub = [];
        if (r.phone) sub.push(r.phone);
        if (r.email) sub.push(r.email);
        if (catLabel) sub.push(catLabel);
        return '<div class="list-item' + (focused ? ' focused' : '') + '" data-contact-idx="' + i + '">' +
          '<div class="list-item-title">' + esc(r.job || r.name || 'Unnamed') + '</div>' +
          (sub.length ? '<div class="list-item-sub">' + esc(sub.join(' \u00b7 ')) + '</div>' : '') +
        '</div>';
      }).join('');

      var searchFocused = contactBrowserZone === 'search';
      el.content.innerHTML =
        '<div class="list-filter-bar">' +
          '<span class="badge badge-accent" style="margin-right:4px;" id="cb-back-btn">\u2190 Contacts</span>' +
          '<span class="badge" id="cb-new-btn">+ New</span>' +
        '</div>' +
        '<div class="cb-search-row' + (searchFocused ? ' focused' : '') + '">' +
          '<input class="cb-search-inp" id="cb-search-inp" type="text" placeholder="Search contacts\u2026" value="' + esc(contactSearch) + '">' +
        '</div>' +
        '<div class="cb-pills" id="cb-pills">' + pillsHtml + '</div>' +
        (contacts.length ? listHtml : '<div class="empty-state">No contacts' + (sVal || contactCatFilter !== null ? ' matching filter' : '') + '.</div>') +
        '<div class="list-new-btn' + (contactBrowserZone === 'list' && contactFocusIdx === contacts.length ? ' focused' : '') + '" id="cb-new-inline">+ New Contact</div>';

      document.getElementById('cb-back-btn').addEventListener('click', closeContactBrowser);
      document.getElementById('cb-new-btn').addEventListener('click', function() {
        App.showWizard({ record_type: 'contact' });
      });
      var cbNewInline = document.getElementById('cb-new-inline');
      if (cbNewInline) cbNewInline.addEventListener('click', function() {
        App.showWizard({ record_type: 'contact' });
      });

      var inp = document.getElementById('cb-search-inp');
      if (inp) {
        if (searchFocused) setTimeout(function() { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);
        inp.addEventListener('input', function() {
          contactSearch = inp.value;
          renderContactBrowser();
        });
        inp.addEventListener('keydown', function(e) {
          e.stopPropagation();
          if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            contactBrowserZone = 'pills'; contactCatFocusIdx = 0;
            renderContactBrowser();
          }
          if (e.key === 'Backspace' && !inp.value) { e.preventDefault(); closeContactBrowser(); }
          if (e.key === 'Escape') { e.preventDefault(); contactSearch = ''; renderContactBrowser(); }
        });
      }

      var pillEls = el.content.querySelectorAll('.cb-pill');
      for (var pi = 0; pi < pillEls.length; pi++) {
        pillEls[pi].addEventListener('click', (function(btn) {
          return function() {
            var v = btn.getAttribute('data-cb-cat');
            contactCatFilter = v === '__all__' ? null : parseInt(v, 10);
            contactFocusIdx = 0; contactBrowserZone = 'list';
            renderContactBrowser();
          };
        })(pillEls[pi]));
      }

      var rowEls = el.content.querySelectorAll('[data-contact-idx]');
      for (var ri = 0; ri < rowEls.length; ri++) {
        rowEls[ri].addEventListener('click', (function(idx) {
          return function() {
            var c = contacts[idx];
            if (c) App.showView(c);
          };
        })(parseInt(rowEls[ri].getAttribute('data-contact-idx'), 10)));
      }
    });
  }

  // ── Pinned quick-start (per activity) ───────────────────────────────────────
  // wp_pinned_tpls_{activityId}: standard type values ('', 'quote', …) or rtpl_* template ids

  function tplPinLabel(tv) {
    if (tv && tv.indexOf('rtpl_') === 0 && typeof RecordTemplateService !== 'undefined') {
      var t = RecordTemplateService.get(tv);
      return t ? (t.name || 'Template') : 'Template';
    }
    return TYPE_PICKER_LABELS[tv] || tv || 'Job';
  }

  function getPinnedTpls(activityId) {
    if (!activityId) return [];
    try { return JSON.parse(localStorage.getItem('wp_pinned_tpls_' + activityId) || '[]'); } catch (_) { return []; }
  }

  function setPinnedTpls(activityId, arr) {
    try { localStorage.setItem('wp_pinned_tpls_' + activityId, JSON.stringify(arr)); } catch (_) {}
  }

  function togglePinnedTpl(activityId, typeValue) {
    var pinned = getPinnedTpls(activityId);
    var idx = pinned.indexOf(typeValue);
    if (idx !== -1) pinned.splice(idx, 1); else pinned.push(typeValue);
    setPinnedTpls(activityId, pinned);
  }

  function renderSavedTemplates() {
    var actId = activityFilter.length === 1 ? activityFilter[0] : null;
    if (!actId) return '';
    var pinned = getPinnedTpls(actId);
    var countLabel = pinned.length ? ' (' + pinned.length + ')' : '';
    var hdr = '<div class="list-tpl-hdr" id="list-tpl-hdr">' +
      'Pinned' + countLabel +
      '<span style="float:right;font-size:10px;color:var(--text-muted);">' + (savedTplsOpen ? '\u25b4' : '\u25be') + '</span>' +
    '</div>';

    if (!savedTplsOpen) return hdr;

    var pinnedRows = '';
    if (pinned.length) {
      pinnedRows = '<div class="list-tpl-section">';
      pinned.forEach(function(tv) {
        var lbl = tplPinLabel(tv);
        pinnedRows += '<div class="list-tpl-row" data-tpl-new="' + esc(tv) + '">' +
          '<span class="list-tpl-label">' + esc(lbl) + '</span>' +
          '<span class="list-tpl-pin active" data-tpl-unpin="' + esc(tv) + '">\u2605</span>' +
        '</div>';
      });
      pinnedRows += '</div>';
    }

    var allRows = '<div class="list-tpl-section">';
    allRows += '<div class="list-tpl-sec-label">All Types</div>';
    TEMPLATE_TYPES.forEach(function(t) {
      var isPinned = pinned.indexOf(t.value) !== -1;
      allRows += '<div class="list-tpl-row" data-tpl-new="' + esc(t.value) + '">' +
        '<span class="list-tpl-label">' + esc(t.label) + '</span>' +
        '<span class="list-tpl-pin' + (isPinned ? ' active' : '') + '" data-tpl-pin-toggle="' + esc(t.value) + '">' + (isPinned ? '\u2605' : '\u2606') + '</span>' +
      '</div>';
    });
    allRows += '</div>';

    return hdr + pinnedRows + allRows;
  }

  function bindSavedTemplates() {
    var hdrEl = document.getElementById('list-tpl-hdr');
    if (hdrEl) {
      hdrEl.addEventListener('click', function() { savedTplsOpen = !savedTplsOpen; render(); });
    }
    var actId = activityFilter.length === 1 ? activityFilter[0] : null;
    if (!actId) return;

    var newBtns = el.content.querySelectorAll('[data-tpl-new]');
    for (var i = 0; i < newBtns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          if (e.target && (e.target.getAttribute('data-tpl-pin-toggle') || e.target.getAttribute('data-tpl-unpin'))) return;
          var tv = btn.getAttribute('data-tpl-new');
          if (tv && tv.indexOf('rtpl_') === 0 && typeof RecordTemplateService !== 'undefined') {
            var pre = RecordTemplateService.buildRecord(tv);
            pre.activityId = actId;
            App.showWizard(pre);
          } else {
            App.showWizard(tv !== null ? { record_type: tv, activityId: actId } : { activityId: actId });
          }
        });
      })(newBtns[i]);
    }

    var pinBtns = el.content.querySelectorAll('[data-tpl-pin-toggle]');
    for (var j = 0; j < pinBtns.length; j++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          togglePinnedTpl(actId, btn.getAttribute('data-tpl-pin-toggle'));
          render();
        });
      })(pinBtns[j]);
    }

    var unpinBtns = el.content.querySelectorAll('[data-tpl-unpin]');
    for (var k = 0; k < unpinBtns.length; k++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          togglePinnedTpl(actId, btn.getAttribute('data-tpl-unpin'));
          render();
        });
      })(unpinBtns[k]);
    }
  }

  function bindFilters() {
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
    var sortBtn = document.getElementById('list-sort-btn');
    if (sortBtn) sortBtn.addEventListener('click', openSortPicker);

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
    var actBtn = document.getElementById('list-act-btn');
    if (actBtn) {
      actBtn.addEventListener('click', function() {
        if (activityFilter.length > 0) { activityFilter = []; focusIdx = 0; render(); }
        else { openActPicker(); }
      });
    }
    var densBtn = document.getElementById('list-density-btn');
    if (densBtn) densBtn.addEventListener('click', cycleListDensity);
    var grpBtn = document.getElementById('list-group-btn');
    if (grpBtn) grpBtn.addEventListener('click', toggleListGroup);
    var grpHdrs = el.content.querySelectorAll('.list-group-hdr');
    for (var gi = 0; gi < grpHdrs.length; gi++) {
      grpHdrs[gi].addEventListener('click', (function(hdr) {
        return function() {
          var k = hdr.getAttribute('data-grp');
          if (!k) return;
          listGroupCollapsed[k] = !listGroupCollapsed[k];
          try { localStorage.setItem('wp_list_group_collapsed', JSON.stringify(listGroupCollapsed)); } catch (_) {}
          render();
        };
      })(grpHdrs[gi]));
    }
    var focusBtn = document.getElementById('list-focus-btn');
    if (focusBtn) {
      focusBtn.addEventListener('click', function() {
        focusMode = !focusMode;
        localStorage.setItem('wp_focus_mode', focusMode ? '1' : '0');
        focusIdx = 0;
        render();
      });
    }
    var sellBtn = document.getElementById('list-sell-btn');
    if (sellBtn) {
      sellBtn.addEventListener('click', function() {
        App.showSaleTally({ returnTo: 'list' });
      });
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

  // ── Toolbar (filter bar) focus ──────────────────────────────────────────────
  // Buttons in order: sort, type-filter, activity, focus, flag

  var TOOLBAR_BTN_IDS = [
    'list-sort-btn', 'type-filter-btn', 'list-act-btn',
    'list-density-btn', 'list-group-btn', 'list-focus-btn', 'list-flag-btn',
  ];

  function toolbarEnter() {
    toolbarFocusIdx = 0;
    toolbarApplyFocus();
  }

  function toolbarBlur() {
    toolbarFocusIdx = -1;
    TOOLBAR_BTN_IDS.forEach(function(id) {
      var b = document.getElementById(id);
      if (b) b.classList.remove('tb-focused');
    });
  }

  function toolbarMove(dir) {
    var max = TOOLBAR_BTN_IDS.length - 1;
    toolbarFocusIdx = Math.max(0, Math.min(max, toolbarFocusIdx + dir));
    toolbarApplyFocus();
  }

  function toolbarApplyFocus() {
    TOOLBAR_BTN_IDS.forEach(function(id, i) {
      var b = document.getElementById(id);
      if (b) b.classList.toggle('tb-focused', i === toolbarFocusIdx);
    });
  }

  function toolbarActivate() {
    var id = TOOLBAR_BTN_IDS[toolbarFocusIdx];
    var btn = document.getElementById(id);
    if (btn) btn.click();
    toolbarBlur();
  }

  function focusedRecord() {
    return items[focusIdx] || null;
  }

  function onKey(key) {
    // ── Contact browser key handler ──────────────────────────────────────────
    if (contactBrowserOpen) {
      var cRows = el.content ? el.content.querySelectorAll('[data-contact-idx]') : [];
      var cCount = cRows.length;
      switch (key) {
        case 'ArrowUp':
          if (contactBrowserZone === 'list') {
            if (contactFocusIdx > 0) { contactFocusIdx--; renderContactBrowser(); }
            else { contactBrowserZone = 'pills'; renderContactBrowser(); }
          } else if (contactBrowserZone === 'pills') {
            contactBrowserZone = 'search'; renderContactBrowser();
            var si = document.getElementById('cb-search-inp'); if (si) si.focus();
          }
          break;
        case 'ArrowDown':
          if (contactBrowserZone === 'search') {
            contactBrowserZone = 'pills'; contactCatFocusIdx = 0; renderContactBrowser();
          } else if (contactBrowserZone === 'pills') {
            contactBrowserZone = 'list'; contactFocusIdx = 0; renderContactBrowser();
          } else {
            if (contactFocusIdx < cCount) { contactFocusIdx++; renderContactBrowser(); }
          }
          break;
        case 'ArrowLeft':
          if (contactBrowserZone === 'pills') {
            contactCatFocusIdx = Math.max(0, contactCatFocusIdx - 1); renderContactBrowser();
          }
          break;
        case 'ArrowRight':
          if (contactBrowserZone === 'pills') {
            contactCatFocusIdx = Math.min(CONTACT_CATEGORIES.length - 1, contactCatFocusIdx + 1); renderContactBrowser();
          }
          break;
        case 'Enter':
          if (contactBrowserZone === 'pills') {
            var cat = CONTACT_CATEGORIES[contactCatFocusIdx];
            contactCatFilter = cat ? cat.val : null;
            contactFocusIdx = 0; contactBrowserZone = 'list'; renderContactBrowser();
          } else if (contactBrowserZone === 'list') {
            if (contactFocusIdx === cCount) {
              App.showWizard({ record_type: 'contact' });
            } else {
              var cRowEls = el.content.querySelectorAll('[data-contact-idx]');
              var targetRow = cRowEls[contactFocusIdx];
              if (targetRow) targetRow.click();
            }
          }
          break;
        case '1':
          App.showWizard({ record_type: 'contact' });
          break;
        case 'Backspace':
          closeContactBrowser();
          break;
      }
      return;
    }
    if (linkPickerOpen) {
      var linkCount = linkPickerItems.length;
      var showLinkPills = linkPickerType === 'dispute' || linkPickerType === 'ack';
      if (showLinkPills && linkPickerZone === 'pills') {
        if (key === 'ArrowLeft')  { linkPickerPillIdx = Math.max(0, linkPickerPillIdx - 1); renderLinkPicker(); return; }
        if (key === 'ArrowRight') { linkPickerPillIdx = Math.min(2, linkPickerPillIdx + 1); renderLinkPicker(); return; }
        if (key === 'Enter') {
          var LP = ['all', 'received', 'issued'];
          linkPickerGroup = LP[linkPickerPillIdx] || 'all';
          linkPickerZone = 'list'; linkPickerFocusIdx = 0; renderLinkPicker(); return;
        }
        if (key === 'ArrowDown') { linkPickerZone = 'list'; linkPickerFocusIdx = 0; renderLinkPicker(); return; }
        if (key === 'Backspace') {
          var lt = linkPickerType;
          linkPickerOpen = false;
          linkPickerItems = [];
          linkPickerType = null;
          branchPickerType = lt;
          branchPickerOpen = true;
          renderBranchPicker();
          return;
        }
        return;
      }
      switch (key) {
        case 'ArrowUp':
          if (linkPickerFocusIdx > 0) { linkPickerFocusIdx--; renderLinkPicker(); }
          else if (showLinkPills) { linkPickerZone = 'pills'; renderLinkPicker(); }
          break;
        case 'ArrowDown':
          if (linkPickerFocusIdx < linkCount - 1) { linkPickerFocusIdx++; renderLinkPicker(); }
          break;
        case 'Enter':
          if (linkPickerItems[linkPickerFocusIdx]) selectLinkRecord(linkPickerFocusIdx);
          break;
        case 'Backspace': {
          var lt2 = linkPickerType;
          linkPickerOpen = false;
          linkPickerItems = [];
          linkPickerType = null;
          branchPickerType = lt2;
          branchPickerOpen = true;
          renderBranchPicker();
          break;
        }
      }
      return;
    }
    if (branchPickerOpen) {
      var branchRows = branchPickerRows();
      switch (key) {
        case 'ArrowUp':
          if (branchFocusIdx > 0) { branchFocusIdx--; renderBranchPicker(); }
          break;
        case 'ArrowDown':
          if (branchFocusIdx < branchRows.length - 1) { branchFocusIdx++; renderBranchPicker(); }
          break;
        case 'Enter':
          if (branchRows[branchFocusIdx]) selectBranch(branchRows[branchFocusIdx].id);
          break;
        case 'Backspace':
          closeBranchPicker();
          openTypePicker('new');
          break;
      }
      return;
    }
    if (actPickerOpen) {
      var acts = (typeof WorkActivityService !== 'undefined') ? WorkActivityService.listAll() : [];
      if (actPickerZone === 'pills') {
        var ACT_PILL_COUNT = 3;
        if (key === 'ArrowLeft')  { actPickerPillIdx = Math.max(0, actPickerPillIdx - 1); renderActPicker(); return; }
        if (key === 'ArrowRight') { actPickerPillIdx = Math.min(ACT_PILL_COUNT - 1, actPickerPillIdx + 1); renderActPicker(); return; }
        if (key === 'Enter') {
          var ACT_PILLS_V = ['all', 'own', 'other'];
          actPickerFilter = ACT_PILLS_V[actPickerPillIdx] || 'all';
          actPickerZone = 'list'; actPickerFocusIdx = 0; renderActPicker(); return;
        }
        if (key === 'ArrowDown') { actPickerZone = 'create'; renderActPicker(); return; }
        if (key === 'Backspace') { closeActPicker(); return; }
        return;
      }
      if (actPickerZone === 'create') {
        if (key === 'ArrowDown') { actPickerZone = 'list'; actPickerFocusIdx = 0; renderActPicker(); return; }
        if (key === 'Enter') { actAddFromPicker(); return; }
        if (key === 'Backspace') { closeActPicker(); return; }
        return;
      }
      var filteredActs = actPickerFilter === 'own'   ? acts.filter(function(a) { return a.type !== 'other'; }) :
                         actPickerFilter === 'other' ? acts.filter(function(a) { return a.type === 'other'; }) :
                         acts;
      var clearActIdx = filteredActs.length;
      switch (key) {
        case 'ArrowUp':
          if (actPickerFocusIdx === 0) {
            actPickerZone = 'create'; renderActPicker();
          } else if (actPickerFocusIdx > 0) {
            actPickerFocusIdx--; renderActPicker();
          }
          break;
        case 'ArrowDown':
          if (actPickerFocusIdx < clearActIdx) { actPickerFocusIdx++; renderActPicker(); }
          break;
        case 'Enter':
          if (actPickerFocusIdx === clearActIdx) selectActivity('__clear__');
          else if (filteredActs[actPickerFocusIdx]) selectActivity(filteredActs[actPickerFocusIdx].id);
          break;
        case 'Backspace':
          closeActPicker();
          break;
      }
      return;
    }
    if (sortPickerOpen) {
      switch (key) {
        case 'ArrowUp':
          if (sortFocusIdx > 0) { sortFocusIdx--; renderSortPicker(); }
          break;
        case 'ArrowDown':
          if (sortFocusIdx < SORT_MODES.length - 1) { sortFocusIdx++; renderSortPicker(); }
          break;
        case 'Enter':
          selectSort(SORT_MODES[sortFocusIdx]);
          break;
        case 'Backspace':
          closeSortPicker();
          break;
      }
      return;
    }
    if (typePickerOpen) {
      // Pills zone: ArrowLeft/Right navigate, ArrowDown → list, Enter → select pill
      if (typePickerPillFocus) {
        if (key === 'ArrowLeft')  { pillFocusIdx = Math.max(0, pillFocusIdx - 1); applyPillFocus(); return; }
        if (key === 'ArrowRight') { pillFocusIdx = Math.min(PILL_IDS.length - 1, pillFocusIdx + 1); applyPillFocus(); return; }
        if (key === 'ArrowDown')  { typePickerPillFocus = false; applyPillFocus(); typeFocusIdx = 0; applyTypePickerFocus(); return; }
        if (key === 'Enter') {
          var pEl = document.getElementById(PILL_IDS[pillFocusIdx]);
          if (pEl) pEl.click();
          typePickerPillFocus = false;
          return;
        }
        if (key === 'Backspace') { closeTypePicker(); return; }
        return;
      }
      switch (key) {
        case 'ArrowUp':
          if (typeFocusIdx > 0) {
            typeFocusIdx--; applyTypePickerFocus();
          } else if (typePickerMode === 'filter' && document.getElementById('tp-fl-all')) {
            typePickerPillFocus = true; pillFocusIdx = 0; applyPillFocus();
          } else {
            var si = document.getElementById('type-search-inp'); if (si) si.focus();
          }
          break;
        case 'ArrowDown':
          if (typeFocusIdx < typeItems.length - 1) { typeFocusIdx++; applyTypePickerFocus(); }
          break;
        case 'Enter':
          if (typePickerMode === 'template' && typeItems[typeFocusIdx]) {
            tplPickerUseItem(typeItems[typeFocusIdx]);
          } else if (typeItems[typeFocusIdx]) {
            selectType(typeItems[typeFocusIdx].value);
          }
          break;
        case 'Backspace':
          closeTypePicker();
          break;
      }
      return;
    }
    // Toolbar focus mode — intercept before main switch
    if (toolbarFocusIdx >= 0) {
      if (key === 'ArrowDown') { toolbarBlur(); focusItem(0); return; }
      if (key === 'Backspace') { toolbarBlur(); return; }
      if (key === 'ArrowLeft')  { toolbarMove(-1); return; }
      if (key === 'ArrowRight') { toolbarMove(1);  return; }
      if (key === 'Enter')      { toolbarActivate(); return; }
      return;
    }

    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) { focusItem(focusIdx - 1); }
        else              { toolbarEnter(); }
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
      case 'Backspace':
        if (contactFilter) { contactFilter = null; updateListCrumb(); focusIdx = 0; render(); break; }
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
      case '2':
        // Toggle WP+ home / classic list mode
        App.setHomeMode(App.getHomeMode() === 'wp+' ? 'list' : 'wp+');
        App.showHome();
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
      case '8':
        App.showSaleTally({ returnTo: 'list' });
        break;
      case '9':
        App.showFinanceOverview();
        break;
    }
  }

  function cycleFilter(dir) {
    var idx = SORT_MODES.indexOf(sortMode);
    if (idx < 0) idx = 0;
    var next = (idx + dir + SORT_MODES.length) % SORT_MODES.length;
    sortMode = SORT_MODES[next];
    localStorage.setItem('wp_sort_mode', sortMode);
    focusIdx = 0;
    render();
  }

  function setFilter(token) {
    panelFilter   = token || null;
    contactFilter = null;
    if (panelFilter) typeFilter = null;
    focusIdx = 0;
    render();
  }

  function toggleListGroup() {
    listGroupOn = !listGroupOn;
    localStorage.setItem('wp_list_group', listGroupOn ? '1' : '0');
    focusIdx = 0;
    render();
  }

  function recordGroupLabel(r) {
    var rt = r.record_type || r.recordType || '';
    return TYPE_PICKER_LABELS[rt] || (rt ? rt.charAt(0).toUpperCase() + rt.slice(1) : 'Job');
  }

  function renderListItemRow(r, i) {
    if (r.parentId) return renderChildCard(r, i);
    var statusPill = buildStatusPill(r);
    return '<div class="list-item" tabindex="0" data-idx="' + i + '">' +
      '<div class="list-item-title-row">' +
        '<span class="list-item-title">' + esc(r.job || '(untitled)') + '</span>' +
        (statusPill ? statusPill : '') +
      '</div>' +
      (fmt(r) ? '<div class="list-item-sub">' + esc(fmt(r)) + '</div>' : '') +
      '</div>';
  }

  function buildListBodyHtml() {
    if (!listGroupOn || panelFilter) {
      return items.map(function(r, i) { return renderListItemRow(r, i); }).join('');
    }
    var groups = {};
    var order = [];
    items.forEach(function(r, i) {
      var k = recordGroupLabel(r);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push({ r: r, i: i });
    });
    var html = '';
    order.forEach(function(k) {
      var collapsed = !!listGroupCollapsed[k];
      html += '<div class="list-group-hdr' + (collapsed ? ' collapsed' : '') + '" data-grp="' + esc(k) + '">' +
        '<span class="list-group-title">' + esc(k) + '</span>' +
        '<span class="list-group-count">' + groups[k].length + '</span>' +
        '</div>';
      if (!collapsed) {
        groups[k].forEach(function(entry) {
          html += renderListItemRow(entry.r, entry.i);
        });
      }
    });
    return html;
  }

  function setContactFilter(contactRec, recordType) {
    contactFilter  = { id: contactRec.id, name: contactRec.job || contactRec.name || '', recordType: recordType || null };
    panelFilter    = null;
    typeFilter     = null;
    activityFilter = [];
    focusIdx = 0;
    render();
    updateListCrumb();
  }

  function setActivityFilter(ids) {
    activityFilter = Array.isArray(ids) ? ids : [];
    panelFilter    = null;
    contactFilter  = null;
    focusIdx = 0;
    render();
  }

  function setTypeFilter(rt) {
    if (rt === 'contact') {
      typeFilter = 'contact';
      panelFilter = null;
      focusIdx = 0;
      openContactBrowser();
      return;
    }
    typeFilter = rt || null;
    panelFilter = null;
    focusIdx = 0;
    render();
  }

  var WORK_FILTER_LABELS = { today: 'Today', future: 'Future', past: 'Past' };
  var PADS_FILTER_LABELS = { received: 'Received', sent: 'Sent', locked: 'Locked', standard: 'Standard', custom: 'Custom', imported: 'Imported' };
  var CF_RT_LABELS = { expense: 'Expenses', payment: 'Payments', payable: 'Payables', receivable: 'Receivables', invoice: 'Invoices', quote: 'Quotes', receipt: 'Receipts' };

  function updateListCrumb() {
    var crumbEl = document.getElementById('list-crumb');
    var labelEl = document.getElementById('list-crumb-label');
    var backEl  = document.getElementById('list-crumb-back');
    if (!crumbEl) return;

    if (contactFilter) {
      var cfLabel = contactFilter.name || 'Contact';
      if (contactFilter.recordType) cfLabel += ' \u00b7 ' + (CF_RT_LABELS[contactFilter.recordType] || contactFilter.recordType);
      crumbEl.style.display = 'flex';
      if (labelEl) labelEl.textContent = cfLabel;
      if (backEl) {
        backEl.onclick = function() {
          contactFilter = null;
          crumbEl.style.display = 'none';
          render();
        };
      }
      return;
    }

    var label = null;
    if (workFilter)      label = WORK_FILTER_LABELS[workFilter] || workFilter;
    else if (padsFilter) label = PADS_FILTER_LABELS[padsFilter] || padsFilter;
    else if (dateRange)  label = dateRange.label || 'Filtered';
    if (label) {
      crumbEl.style.display = 'flex';
      if (labelEl) labelEl.textContent = label;
      if (backEl) {
        backEl.onclick = function() {
          if (listReturnTo === 'home')         App.showHome();
          else if (listReturnTo === 'calendar') App.showCalendarWP();
          else                                  App.showHome();
        };
      }
    } else {
      crumbEl.style.display = 'none';
    }
  }

  function onShow(opts) {
    summaryCache = null;
    opts = opts || {};
    var restoreNav = !!opts.restoreNav && savedNavState;
    if (!restoreNav) {
      workFilter   = null;
      padsFilter   = null;
      dateRange    = null;
      focusIdx     = 0;
    }
    listReturnTo = null;
    if (opts.workFilter  !== undefined) workFilter   = opts.workFilter;
    if (opts.padsFilter  !== undefined) padsFilter   = opts.padsFilter;
    if (opts.dateRange   !== undefined) dateRange    = opts.dateRange;
    if (opts.returnTo    !== undefined) listReturnTo = opts.returnTo;
    if (restoreNav) focusIdx = savedNavState.focusIdx;
    branchPickerOpen = false;
    linkPickerOpen   = false;
    updateListCrumb();
    render();
    if (opts.showTypePicker) {
      setTimeout(function() { openTypePicker('new'); }, 0);
    }
  }

  global.ListScreen = {
    onShow: onShow,
    onKey: onKey,
    focusedRecord: focusedRecord,
    render: render,
    saveNavState: saveNavState,
    setFilter: setFilter,
    setActivityFilter: setActivityFilter,
    setTypeFilter: setTypeFilter,
    setContactFilter: setContactFilter,
    itemAt: function(i) { return items[i] || null; },
  };

}(window));
