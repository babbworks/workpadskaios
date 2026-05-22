// Screen: Help
// Exposes: window.HelpScreen

(function(global) {
  'use strict';

  var returnTo     = 'home'; // 'home' | 'list'
  var collapseState  = 0;    // 0=full 1=compact 2=headers-only
  var collapseFocusIdx = 0;
  var searchTerm   = '';

  var SECTIONS = [
    {
      title: 'Navigation',
      items: [
        'D-pad Up / Down — move between items in a list',
        'D-pad Left / Right — switch tabs, filters, or sort modes',
        'Centre key (CSK) — select or confirm the focused item',
        'Left softkey — open the Info panel (Workpads context)',
        'Right softkey — open the Me panel (personal notes)',
        'Back / Backspace — go back one screen or close overlay',
        'Hold CSK for 0.8 s — open Quick Note from anywhere',
      ],
    },
    {
      title: 'WP+ Home',
      items: [
        'WORK — filter records by Today / Future / Past, or create new',
        'PADS — view received, sent or locked records; choose a type',
        'Timeline — day view of log entries; navigate by time slot',
        'Tasks — action items from records that have a due date',
        'Calendar — browse records by day, week or month',
        'Log — create a quick new log entry',
        'RECORDS — go directly to the main record list',
        'Key 2 from the record list — switch back to WP+ home',
      ],
    },
    {
      title: 'Record List',
      items: [
        'Key 1 — new record (type picker opens if no type is set)',
        'Key 2 — toggle between WP+ home and classic list',
        'Key 3 — filter records by type',
        'A button — filter by activity (opens activity picker)',
        'Density button (⊞) — cycle: normal → compact → minimal',
        'Home button (⌂) — return to WP+ home screen',
        'Sort button (Sort ▾) — open sort picker',
        'Left / Right — change sort mode while picker is open',
        'Key 5 — Management screen',
        'Key 9 — Finance overview',
        'Key 0 — Quick note',
        'Key * — show all keyboard shortcuts',
      ],
    },
    {
      title: 'Wizard (Record Editor)',
      items: [
        'Tabs P / A / D / S / F — Process, Actions, Details, Story, Financials',
        'CSK / Next — advance to the next tab; Save on the last tab',
        'Back — go to previous tab or return to the record list',
        'Type tag (top-right corner) — tap to change the record type',
        'Process tab — Job title, Customer, Date, End date',
        'Actions tab — add / note / delete action items with keys 1 / 2 / 3',
        'Details tab — Worker, Location, Phone, times, Activity',
        'Details tab → Extended ▾ — Ref, Tag, Label, URL, Link ID (UID)',
        'Story tab — free-form Story and Details narrative fields',
        'Financials tab — Amount, Currency, Tax, Due date, Unit',
        'Financials → Expenses / Payments sub-tabs for line items',
      ],
    },
    {
      title: 'Record View',
      items: [
        'Enter or key 1 — edit the record (opens wizard)',
        'Key 2 — share the record',
        'Key 3 — archive the record',
        'Key 4 — open the financial detail screen',
        'Collapse toggle (⊞ in toolbar) — cycle: full → field-labels → sections',
        'In collapsed modes: Up / Down navigate; Enter expands to that field',
        'Sections dropdown — jump to a section instantly',
        'Search bar — filter fields by keyword; clears on leaving the screen',
        'Left panel — financial snapshot, quick add Out / COGS / Payment',
      ],
    },
    {
      title: 'Activities',
      items: [
        'Activities group records into projects or contexts',
        'Create activities via Management → Activities or the A button popup',
        'Assign an activity to a record on the Details tab (Activity field)',
        'Filter the record list by activity using the A button in the top bar',
        'The Info panel shows totals filtered to selected activities',
        'Activity chips appear in the panel when one or more are selected',
        'Clear all activity filters with the × chip or Clear all in the popup',
      ],
    },
    {
      title: 'Panels',
      items: [
        'Left softkey — open Info (Workpads) panel',
        'Right softkey — open Me (Personal) panel',
        'Info panel on list screen — financial browse, quick Exp / COGS / Inc',
        'Info panel on record view — financial snapshot, quick add lines',
        'Info panel on wizard — step indicator, warnings, quick add lines',
        'Me panel — personal notes and captures; All / Records mode tabs',
        'User switcher (⇄ icon in panel header) — switch between user profiles',
        'A icon in panel header — open activity filter popup',
        'Fin icon in panel header — open ledger entry screen',
      ],
    },
    {
      title: 'Sharing & Codec',
      items: [
        'Plain (#1pa/) — compact URL, anyone can open without a key',
        'Public (#1pb/) — optimised display format for sharing',
        'Protected (#1ps/) — AES-256 encrypted; recipient needs the passphrase',
        'Received links open automatically when the app loads with a URL',
        'Link ID (UID) — enable on the Details → Extended section to chain records',
        'Chain linking uses the UID so a recipient can verify the record thread',
        'Codec encodes all filled fields; empty fields are omitted from the URL',
      ],
    },
    {
      title: 'Finance',
      items: [
        'Financials tab: Amount, Currency, Tax (VAT), Due date, Unit',
        'Expense billing: Customer = billable out; COGS = job cost',
        'Payments tab — record money received against an invoice / quote',
        'Finance overview — billed / outstanding / margin across all records',
        'Key 9 from list — finance overview screen',
        'COGS split: within-budget, overrun, and unlinked shown separately',
        'Gross margin = Revenue − Billable expenses − COGS',
        'Net margin = Revenue − All expenses',
      ],
    },
    {
      title: 'Data & Storage',
      items: [
        'All data is stored locally in the browser (localStorage)',
        'Each user profile has its own isolated record namespace',
        'Add profiles via the user switcher (⇄); switching reloads the app',
        'Archive a record to remove it from the list without deleting it',
        'Archived records are stored separately and can be recovered',
        'Export / import via the share URL — encode a record to a link and re-import',
        'No server required — the app works fully offline',
      ],
    },
  ];

  var el = {
    content: document.getElementById('help-content'),
    toggle:  document.getElementById('help-toggle-btn'),
    search:  document.getElementById('help-search'),
    csk:     document.getElementById('help-csk'),
  };

  // ── Render ───────────────────────────────────────────────────────────────

  function render() {
    var html = '';
    for (var si = 0; si < SECTIONS.length; si++) {
      var sec = SECTIONS[si];
      html += '<div class="help-section" data-sec-idx="' + si + '">';
      html += '<div class="help-sec-hdr">' + esc(sec.title) + '</div>';
      for (var ii = 0; ii < sec.items.length; ii++) {
        html += '<div class="help-item">' + esc(sec.items[ii]) + '</div>';
      }
      html += '</div>';
    }
    el.content.innerHTML = html;
    applyCollapse();
    if (searchTerm) applySearch();
  }

  function applyCollapse() {
    el.content.classList.toggle('help-compact',   collapseState === 1);
    el.content.classList.toggle('help-hdr-only',  collapseState === 2);
    if (el.toggle) {
      el.toggle.className = 'view-tb-toggle' +
        (collapseState === 1 ? ' collapsed' : collapseState === 2 ? ' collapsed-2' : '');
    }
    updateCsk();
    if (collapseState > 0) applyFocus();
    else clearFocus();
  }

  function applySearch() {
    var term = searchTerm.toLowerCase();
    var sections = el.content.querySelectorAll('.help-section');
    for (var si = 0; si < sections.length; si++) {
      var sec = sections[si];
      var hdr  = sec.querySelector('.help-sec-hdr');
      var items = sec.querySelectorAll('.help-item');
      var hdrHit = hdr && hdr.textContent.toLowerCase().indexOf(term) !== -1;
      var anyHit = hdrHit;
      for (var ii = 0; ii < items.length; ii++) {
        var hit = items[ii].textContent.toLowerCase().indexOf(term) !== -1;
        items[ii].style.display = (hit || hdrHit) ? '' : 'none';
        if (hit) anyHit = true;
      }
      sec.style.display = anyHit ? '' : 'none';
    }
  }

  function clearSearch() {
    var sections = el.content.querySelectorAll('.help-section');
    for (var si = 0; si < sections.length; si++) {
      sections[si].style.display = '';
      var items = sections[si].querySelectorAll('.help-item');
      for (var ii = 0; ii < items.length; ii++) items[ii].style.display = '';
    }
  }

  // ── Collapse navigation ──────────────────────────────────────────────────

  function getNavItems() {
    if (collapseState === 1) return el.content.querySelectorAll('.help-item');
    if (collapseState === 2) return el.content.querySelectorAll('.help-section');
    return [];
  }

  function applyFocus() {
    var items = getNavItems();
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('nav-focused', i === collapseFocusIdx);
    }
    var f = items[collapseFocusIdx];
    if (f) f.scrollIntoView({ block: 'nearest' });
  }

  function clearFocus() {
    var items = el.content.querySelectorAll('.nav-focused');
    for (var i = 0; i < items.length; i++) items[i].classList.remove('nav-focused');
  }

  function moveFocus(dir) {
    var items = getNavItems();
    collapseFocusIdx = Math.max(0, Math.min(items.length - 1, collapseFocusIdx + dir));
    applyFocus();
  }

  function expandToFocused() {
    var items = getNavItems();
    var target = items[collapseFocusIdx] || null;
    collapseState = 0;
    collapseFocusIdx = 0;
    applyCollapse();
    clearSearch();
    if (target) {
      setTimeout(function() {
        target.scrollIntoView({ block: 'center' });
        target.classList.add('flash-highlight');
        setTimeout(function() { target.classList.remove('flash-highlight'); }, 1200);
      }, 40);
    }
  }

  function updateCsk() {
    if (el.csk) el.csk.textContent = collapseState > 0 ? 'Open' : 'Back';
  }

  // ── Toolbar wiring ───────────────────────────────────────────────────────

  function wireToolbar() {
    if (el.toggle) {
      el.toggle.onclick = function() {
        collapseState = (collapseState + 1) % 3;
        collapseFocusIdx = 0;
        applyCollapse();
        if (collapseState > 0) applyFocus();
      };
    }
    if (el.search) {
      el.search.oninput = function() {
        searchTerm = this.value.trim();
        if (searchTerm) { clearSearch(); applySearch(); }
        else { clearSearch(); }
      };
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function onShow(opts) {
    opts = opts || {};
    returnTo = opts.returnTo || 'home';
    collapseState  = opts.tour ? 2 : 0;
    collapseFocusIdx = 0;
    searchTerm   = '';
    var backEl = document.getElementById('help-back-link');
    if (backEl) backEl.style.display = returnTo ? 'inline' : 'none';
    if (el.search) el.search.value = '';
    render();
    wireToolbar();
  }

  function goBack() {
    if (returnTo === 'home') App.showHome();
    else App.showList();
  }

  function onKey(key) {
    if (collapseState > 0) {
      switch (key) {
        case 'ArrowUp':   moveFocus(-1); return;
        case 'ArrowDown': moveFocus(1);  return;
        case 'Enter':     expandToFocused(); return;
        case 'Backspace': goBack(); return;
      }
      return;
    }
    if (key === 'Backspace' || key === 'SoftRight') goBack();
  }

  global.HelpScreen = { onShow: onShow, onKey: onKey };

}(window));
