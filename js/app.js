// app.js — screen router, D-pad handler, entry point
// Nav model v0.2: LSK=WorkpadsPanel, RSK=PersonalPanel, Back=go-back,
//                 CSK=primary action, 0=QuickNote, *=shortcut map, 1-9=shortcuts
// Exposes: window.App

(function(global) {
  'use strict';

  var SCREENS = {
    onboarding:        document.getElementById('screen-onboarding'),
    country:           document.getElementById('screen-country'),
    help:              document.getElementById('screen-help'),
    home:              document.getElementById('screen-home'),
    'user-switcher':   document.getElementById('screen-user-switcher'),
    'sale-tally':      document.getElementById('screen-sale-tally'),
    'io-create':       document.getElementById('screen-io-create'),
    'io-record':       document.getElementById('screen-io-record'),
    connections:       document.getElementById('screen-connections'),
    list:              document.getElementById('screen-list'),
    wizard:            document.getElementById('screen-wizard'),
    view:              document.getElementById('screen-view'),
    financial:         document.getElementById('screen-financial'),
    'finance-overview': document.getElementById('screen-finance-overview'),
    'note-share': document.getElementById('screen-note-share'),
    share:       document.getElementById('screen-share'),
    management:  document.getElementById('screen-management'),
    ledger:        document.getElementById('screen-ledger'),
    liabilities:   document.getElementById('screen-liabilities'),
    'newent-wizard':  document.getElementById('screen-newent-wizard'),
    archive:             document.getElementById('screen-archive'),
    'template-creator':  document.getElementById('screen-template-creator'),
    timeline:            document.getElementById('screen-timeline'),
    tasks:            document.getElementById('screen-tasks'),
    'calendar-wp':    document.getElementById('screen-calendar-wp'),
    chain:            document.getElementById('screen-chain'),
    dispute:          document.getElementById('screen-dispute'),
  };

  var currentScreen = 'list';

  // ── Home mode preference ───────────────────────────────────────────────────
  // 'list' | 'wp+' | 'sell' — boot target after onboarding

  var HOME_MODES = ['list', 'wp+', 'sell'];

  function getHomeMode() { return localStorage.getItem('wp_home_mode') || 'list'; }
  function setHomeMode(mode) { localStorage.setItem('wp_home_mode', mode); }

  function cycleHomeMode() {
    var cur = getHomeMode();
    var idx = HOME_MODES.indexOf(cur);
    var next = HOME_MODES[(idx + 1) % HOME_MODES.length];
    setHomeMode(next);
    return next;
  }

  function homeModeLabel(mode) {
    if (mode === 'wp+') return 'WP+ Home';
    if (mode === 'sell') return 'Sell (tally)';
    return 'Classic List';
  }

  // ── Shortcut maps (per screen) ─────────────────────────────────────────────

  var SHORTCUT_MAPS = {
    list: [
      { key: '1', label: 'New record / Outcome' },
      { key: '2', label: 'Switch to WP+ home' },
      { key: '3', label: 'Filter by type' },
      { key: '4', label: 'New Exp/COGS/Inc' },
      { key: '5', label: 'Manage' },
      { key: '6', label: 'New Business' },
      { key: '7', label: 'Share pending filter' },
      { key: '8', label: 'Sell (quick tally)' },
      { key: '9', label: 'Finance overview' },
      { key: '0', label: 'Quick note' },
    ],
    'sale-tally': [
      { key: '1', label: 'Another sale (same qty)' },
      { key: '2', label: 'New qty' },
      { key: 'RSK', label: 'Cash / Full mode' },
      { key: 'CSK', label: 'Record sale' },
    ],
    'io-create': [
      { key: 'CSK', label: 'Next / Save' },
      { key: 'Back', label: 'Previous step' },
    ],
    view: [
      { key: 'CSK', label: 'Edit / Open (collapsed)' },
      { key: '1',   label: 'Edit' },
      { key: '2',   label: 'Share' },
      { key: '3',   label: 'Financials' },
      { key: '4',   label: 'View chain' },
      { key: '5',   label: 'Archive' },
      { key: '6',   label: 'Save template' },
      { key: '7',   label: 'Close / commit' },
      { key: '8',   label: 'Amend' },
      { key: '9',   label: 'Dispute' },
      { key: '0',   label: 'Quick note' },
    ],
    wizard: [
      { key: 'Enter',  label: 'Next step / Save' },
      { key: 'Back',   label: 'Previous step' },
      { key: '\u2190/\u2192', label: 'Switch financial tabs (step 5)' },
      { key: '0',      label: 'Quick note' },
    ],
    share: [
      { key: '0', label: 'Quick note' },
    ],
    management: [
      { key: '1', label: 'Records tab' },
      { key: '2', label: 'Personal tab' },
      { key: '3', label: 'Activities tab' },
      { key: '4', label: 'My Templates' },
      { key: '5', label: 'Settings tab' },
      { key: '0', label: 'Quick note' },
    ],
    ledger: [
      { key: 'Enter', label: 'Save line' },
      { key: 'Back',  label: 'Cancel' },
    ],
    liabilities: [
      { key: 'Enter', label: 'Save' },
      { key: 'Back',  label: 'Cancel' },
    ],
    financial: [
      { key: 'Enter', label: 'Edit focused line' },
      { key: 'Back',  label: 'Back to record' },
    ],
  };

  // ── Overlay state ──────────────────────────────────────────────────────────

  var quickNoteEl    = document.getElementById('overlay-quicknote');
  var quickNoteInput = document.getElementById('quicknote-input');
  var shortcutEl     = document.getElementById('overlay-shortcuts');
  var shortcutsEl    = document.getElementById('shortcuts-content');
  var receivePpEl    = document.getElementById('overlay-receive-pp');
  var receivePpInput = document.getElementById('receive-pp-input');
  var receivePpError = document.getElementById('receive-pp-error');
  var receiveNoteEl  = document.getElementById('overlay-receive-note');
  var quickNoteOpen  = false;
  var shortcutOpen   = false;
  var receivePpOpen  = false;
  var receivePpHash  = '';     // raw URL hash held while awaiting passphrase
  var receiveNoteOpen = false;
  var receiveNoteObj  = null;

  // ── Navigation stack (R1) ───────────────────────────────────────────────────

  function navPush(screen, opts) {
    if (typeof NavStack !== 'undefined' && NavStack.enabled() && !(opts && opts._navPop)) {
      NavStack.push(screen, opts || {});
    }
  }

  function goBack() {
    if (typeof NavStack === 'undefined' || !NavStack.canPop()) return false;
    var prev = NavStack.pop();
    if (!prev) return false;
    var o = prev.opts || {};
    o._navPop = true;
    routeNavScreen(prev.screen, o);
    return true;
  }

  function routeNavScreen(screen, opts) {
    opts = opts || {};
    if (opts._navPop) delete opts._navPop;
    switch (screen) {
      case 'home':              showHome(); break;
      case 'list':              showList(opts); break;
      case 'view':              if (opts.recordId) {
        RecordService.get(opts.recordId).then(function(r) {
          if (r) showView(r, { _navPop: true }); else showList(opts);
        });
      } else showList(opts); break;
      case 'wizard':            showWizard(opts.record || null, opts); break;
      case 'sale-tally':        showSaleTally(opts); break;
      case 'io-create':         showIOCreate(opts); break;
      case 'io-record':         showIORecord(opts); break;
      case 'connections':       showConnections(opts); break;
      case 'share':             if (opts.recordId) {
        RecordService.get(opts.recordId).then(function(r) {
          if (r) { opts._navPop = true; showShare(r); } else showList(opts);
        });
      } else showList(opts); break;
      case 'financial':         if (opts.recordId) {
        RecordService.get(opts.recordId).then(function(r) {
          if (r) showFinancial(r, { _navPop: true }); else showList(opts);
        });
      } else showList(opts); break;
      case 'finance-overview':  showFinanceOverview(); break;
      case 'management':        showManagement(opts); break;
      case 'help':              showHelp(opts); break;
      case 'ledger':            showLedger(opts); break;
      case 'liabilities':       showLiabilities(opts); break;
      default:                  showList(opts); break;
    }
  }

  // ── Screen transitions ─────────────────────────────────────────────────────

  function showScreen(name) {
    closeAllPanels();
    var keys = Object.keys(SCREENS);
    for (var i = 0; i < keys.length; i++) {
      SCREENS[keys[i]].classList.toggle('active', keys[i] === name);
    }
    currentScreen = name;
    if (typeof NavStack !== 'undefined' && NavStack.syncScreenTitle) {
      NavStack.syncScreenTitle(name);
    }
  }

  function showHelp(opts) {
    opts = opts || {};
    if (!opts._navPop) navPush('help', opts);
    if (opts._navPop) delete opts._navPop;
    showScreen('help');
    HelpScreen.onShow(opts);
  }

  function showHome() {
    navPush('home', {});
    showScreen('home');
    HomeScreen.onShow();
    if (typeof WorkpadsPanel !== 'undefined') {
      WorkpadsPanel.setContext({ screen: 'home' });
    }
  }

  function showList(opts) {
    opts = opts || {};
    if (!opts._navPop && !opts.restoreNav) navPush('list', opts);
    if (opts._navPop) delete opts._navPop;
    showScreen('list');
    ListScreen.onShow(opts);
  }

  function showSaleTally(opts) {
    opts = opts || {};
    if (!opts._navPop) navPush('sale-tally', opts);
    if (opts._navPop) delete opts._navPop;
    showScreen('sale-tally');
    if (SaleTallyScreen && SaleTallyScreen.onShow) SaleTallyScreen.onShow(opts);
  }

  function showIOCreate(opts) {
    opts = opts || {};
    if (!opts._navPop) navPush('io-create', opts);
    if (opts._navPop) delete opts._navPop;
    showScreen('io-create');
    if (IOCreateScreen && IOCreateScreen.onShow) IOCreateScreen.onShow(opts);
  }

  function showIORecord(opts) {
    opts = opts || {};
    if (!opts._navPop) navPush('io-record', opts);
    if (opts._navPop) delete opts._navPop;
    showScreen('io-record');
    if (IORecordScreen && IORecordScreen.onShow) IORecordScreen.onShow(opts);
  }

  function showConnections(opts) {
    opts = opts || {};
    if (!opts._navPop) navPush('connections', opts);
    if (opts._navPop) delete opts._navPop;
    showScreen('connections');
    if (ConnectionsScreen && ConnectionsScreen.onShow) ConnectionsScreen.onShow(opts);
  }

  function showTimeline() {
    showScreen('timeline');
    TimelineScreen.onShow();
  }

  function showTasks() {
    showScreen('tasks');
    TasksScreen.onShow();
  }

  function showCalendarWP() {
    showScreen('calendar-wp');
    CalendarWPScreen.onShow();
  }

  function showWizard(record, opts) {
    opts = opts || {};
    if (!opts._navPop) {
      navPush('wizard', {
        navLabel: record && record.job ? String(record.job).slice(0, 28) : 'Edit',
        recordId: record && record.id,
        record: record,
      });
    }
    if (opts._navPop) delete opts._navPop;
    showScreen('wizard');
    WizardScreen.onShow(record || null, opts);
  }

  function showView(record, meta) {
    meta = meta || {};
    if (currentScreen === 'list' && ListScreen.saveNavState) {
      ListScreen.saveNavState();
      if (typeof NavStack !== 'undefined' && NavStack.amendTop) {
        NavStack.amendTop({ restoreNav: true });
      }
    }
    if (!meta._navPop) {
      navPush('view', {
        navLabel: record && record.job ? String(record.job).slice(0, 28) : 'Record',
        recordId: record && record.id,
      });
    }
    showScreen('view');
    ViewScreen.onShow(record);
  }

  function showFinancial(record, meta) {
    meta = meta || {};
    if (!meta._navPop) navPush('financial', { recordId: record && record.id, navLabel: 'Financials' });
    showScreen('financial');
    FinancialScreen.onShow(record);
  }

  function showFinanceOverview() {
    navPush('finance-overview', {});
    showScreen('finance-overview');
    FinanceOverviewScreen.onShow();
  }

  function showShare(record, meta) {
    meta = meta || {};
    if (!meta._navPop) navPush('share', { recordId: record && record.id, navLabel: 'Share' });
    showScreen('share');
    ShareScreen.onShow(record);
  }

  function showNoteShare(capture) {
    showScreen('note-share');
    NoteShareScreen.onShow(capture);
  }

  function showManagement(opts) {
    showScreen('management');
    ManagementScreen.onShow(opts || {});
  }

  function showActivities() {
    showScreen('management');
    ManagementScreen.showTab('activities');
  }

  function showTemplates(opts) {
    showManagement(Object.assign ? Object.assign({ tab: 'templates' }, opts || {}) : merge({ tab: 'templates' }, opts || {}));
  }

  function showTemplateCreator(opts) {
    showScreen('template-creator');
    TemplateCreatorScreen.onShow(opts || {});
  }

  function showLedger(opts) {
    showScreen('ledger');
    LedgerScreen.onShow(opts || {});
  }

  function showLiabilities(opts) {
    showScreen('liabilities');
    LiabilitiesScreen.onShow(opts || {});
  }

  function showNewEntWizard(existingSlug) {
    showScreen('newent-wizard');
    NewEntWizardScreen.onShow(existingSlug || null);
  }

  function showCountry(returnTo) {
    showScreen('country');
    CountryScreen.onShow(returnTo || null);
  }

  function showArchive() {
    showScreen('archive');
    ArchiveScreen.onShow();
  }

  function showChain(opts) {
    showScreen('chain');
    ChainScreen.onShow(opts || {});
  }

  function showDispute(opts) {
    showScreen('dispute');
    DisputeScreen.onShow(opts || {});
  }

  // prefillRecord — used by ctrig.js obligation evaluator to route triggered forms
  // type: 'state_commit' | 'dispute' | 'amendment' | any wizard-openable type
  // fields: partial record object pre-populated for the wizard
  function prefillRecord(type, fields) {
    var base = fields || {};
    if (type === 'state_commit') {
      if (ViewScreen && ViewScreen.openCommitPickerFor) {
        ViewScreen.openCommitPickerFor(base);
        return;
      }
    }
    if (type === 'dispute' && currentScreen === 'view' && currentRecord) {
      App.showDispute({ sourceRecord: currentRecord });
      return;
    }
    if (type === 'payment_request' || type === 'obligation') {
      showLedger({ type: 'payment', description: base.job || base.description || '' });
      return;
    }
    showWizard(merge({ record_type: type || 'pads' }, base));
  }

  function showUserSwitcher() {
    showScreen('user-switcher');
    UserSwitcherScreen.onShow();
  }

  // ── Panel helpers ──────────────────────────────────────────────────────────

  function closeAllPanels() {
    if (typeof WorkpadsPanel !== 'undefined' && WorkpadsPanel.close) WorkpadsPanel.close();
    if (typeof PersonalPanel !== 'undefined' && PersonalPanel.close) PersonalPanel.close();
  }

  function anyPanelOpen() {
    return WorkpadsPanel.isOpen() || PersonalPanel.isOpen();
  }

  function isFocusInInput() {
    var el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  function isAnyOverlayOpen() {
    return quickNoteOpen || shortcutOpen || receivePpOpen || receiveNoteOpen ||
      (ViewScreen && ViewScreen.isOptionsOpen && ViewScreen.isOptionsOpen());
  }

  // ── Quick Note ─────────────────────────────────────────────────────────────

  var cskHoldTimer = null;

  function openQuickNote() {
    quickNoteOpen = true;
    quickNoteEl.style.display = 'flex';
    quickNoteInput.value = '';
    quickNoteInput.focus();
  }

  function closeQuickNote() {
    quickNoteOpen = false;
    quickNoteEl.style.display = 'none';
    quickNoteInput.value = '';
  }

  function saveQuickNote() {
    var text = quickNoteInput.value.trim();
    if (text) {
      var linkedRecordId = null;
      if (currentScreen === 'list' && ListScreen && ListScreen.focusedRecord) {
        var lr = ListScreen.focusedRecord();
        linkedRecordId = lr && lr.id ? lr.id : null;
      } else if (currentScreen === 'view' && ViewScreen && ViewScreen.getCurrentRecord) {
        var vr = ViewScreen.getCurrentRecord();
        linkedRecordId = vr && vr.id ? vr.id : null;
      } else if (currentScreen === 'wizard' && WizardScreen && WizardScreen.getCurrentRecord) {
        var wr = WizardScreen.getCurrentRecord();
        linkedRecordId = wr && wr.id ? wr.id : null;
      } else if (currentScreen === 'share' && ShareScreen && ShareScreen.getCurrentRecord) {
        var sr = ShareScreen.getCurrentRecord();
        linkedRecordId = sr && sr.id ? sr.id : null;
      }
      PersonalService.capture({
        text: text,
        source: 'quick-note',
        linkedRecordId: linkedRecordId,
      });
    }
    closeQuickNote();
  }

  // ── Shortcut map overlay ───────────────────────────────────────────────────

  function showShortcutMap() {
    var map = SHORTCUT_MAPS[currentScreen] || [];
    if (!map.length) return;
    shortcutsEl.innerHTML = map.map(function(s) {
      return '<div style="display:flex; padding:5px 10px; border-bottom:1px solid var(--border);">' +
        '<span style="width:24px; font-weight:bold; color:var(--accent);">' + s.key + '</span>' +
        '<span style="color:var(--text); font-size:12px;">' + s.label + '</span>' +
        '</div>';
    }).join('');
    shortcutOpen = true;
    shortcutEl.style.display = 'flex';
  }

  function closeShortcutMap() {
    shortcutOpen = false;
    shortcutEl.style.display = 'none';
  }

  // ── Onboarding ─────────────────────────────────────────────────────────────

  function showOnboarding() {
    showScreen('onboarding');
    setTimeout(function() {
      var inp = document.getElementById('onboard-name');
      if (inp) inp.focus();
    }, 50);
  }

  function completeOnboarding() {
    var nameInp   = document.getElementById('onboard-name');
    var phoneInp  = document.getElementById('onboard-phone');
    var localeSel = document.getElementById('onboard-locale');
    var name   = nameInp   ? nameInp.value.trim()   : '';
    var phone  = phoneInp  ? phoneInp.value.trim()  : '';
    var locale = localeSel ? localeSel.value         : 'gb-v1';
    if (!name) { if (nameInp) nameInp.focus(); return; }
    ActivityService.create({ name: name, phone: phone, type: 'freelance', locale: locale });
    showList();
  }

  document.getElementById('screen-onboarding').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !isFocusInInput()) { completeOnboarding(); e.preventDefault(); }
    if (e.key === 'SoftRight') { completeOnboarding(); e.preventDefault(); }
  });

  var onboardInput = document.getElementById('onboard-name');
  if (onboardInput) {
    onboardInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { completeOnboarding(); e.preventDefault(); }
    });
  }

  // ── URL receive ────────────────────────────────────────────────────────────

  function checkIncomingUrl() {
    var hash = window.location.hash.slice(1);
    if (!hash) return;

    // External My Template payload: #rtpl/<base64url JSON>
    if (hash.slice(0, 5) === 'rtpl/') {
      try {
        var rtplB64 = hash.slice(5).replace(/-/g, '+').replace(/_/g, '/');
        while (rtplB64.length % 4) rtplB64 += '=';
        var rtplFields = JSON.parse(atob(rtplB64));
        if (typeof RecordTemplateService !== 'undefined' && RecordTemplateService.receiveExternal) {
          RecordTemplateService.receiveExternal(rtplFields);
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          showManagement();
          if (typeof ManagementScreen !== 'undefined' && ManagementScreen.showTab) {
            ManagementScreen.showTab('templates');
          }
        }
      } catch (rtplErr) {
        console.warn('[workpads] Record template receive failed:', rtplErr.message);
      }
      return;
    }

    // Presentation template install (#t/ / #te/) — TemplateRegistry, not record presets
    if (hash.slice(0, 2) === 't/' || hash.slice(0, 3) === 'te/') {
      if (typeof TemplateRegistry !== 'undefined' && TemplateRegistry.installFromUrlHash) {
        var tplResult = TemplateRegistry.installFromUrlHash(hash);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        if (tplResult.ok) {
          showManagement();
          if (typeof ManagementScreen !== 'undefined' && ManagementScreen.showTab) {
            ManagementScreen.showTab('templates');
          }
          return;
        }
        if (tplResult.error === 'encrypted-template-deferred') {
          console.warn('[workpads] Encrypted template install (#te/) not yet supported.');
        } else if (tplResult.error !== 'template-ref-only') {
          console.warn('[workpads] Template install failed:', tplResult.error);
        }
      }
      return;
    }

    // Note fragment: workpads.me/n#n1/...
    if (hash.slice(0, 3) === 'n1/') {
      try {
        var note = (typeof NoteCodec !== 'undefined') ? NoteCodec.decode(hash) : null;
        if (note && note.text) { showReceivedNote(note); return; }
      } catch (_) {}
      return;
    }

    var looksLike = /^[0-9][a-z][a-z]\//.test(hash) || hash.indexOf('alg=') !== -1;
    if (!looksLike) return;

    // Detect tag (first 4 chars: e.g. "1pa/", "1ps/", "1ph/")
    var tag = hash.slice(0, 4);

    // Scrambled tags require passphrase — show overlay
    if (tag === '1ps/' || tag === '1ph/') {
      openReceivePp(hash);
      return;
    }

    // Plain / presentation tags — decode directly
    try {
      var isPresentation = (tag === '1pb/' || tag === '1pf/');
      var rec = RecordService.decodeUrl(hash);
      RecordService.storeReceived(rec).then(function(stored) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        if (isPresentation && stored.trigDisplay && stored.trigDisplay.mode === 2 &&
            stored.formSchema && global.WPTrig) {
          App.showWizard(merge({
            record_type: 'pads',
            job: stored.job,
            customer: stored.customer,
            displaySchema: stored.displaySchema,
            formSchema: stored.formSchema,
            trigDisplay: stored.trigDisplay
          }, stored));
          return;
        }
        showView(stored);
      }).catch(function(err) {
        console.warn('[workpads] Store received failed:', err && err.message ? err.message : err);
      });
    } catch (e) {
      console.warn('[workpads] URL decode failed:', e.message);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // D-PAD MASTER DISPATCHER
  // ══════════════════════════════════════════════════════════════════════════
  //
  // All hardware key events flow through here. The dispatcher is structured
  // as an ordered chain of named handlers. Each handler either consumes the
  // event (returns true / calls preventDefault + return) or passes through.
  //
  // PRIORITY CHAIN (highest first):
  //   1. handleOverlayKeys   — traps everything while quick-note or shortcut
  //                            overlay is open
  //   2. handleSoftkeyPanels — LSK/RSK always toggle panels except onboarding
  //   3. handlePanelNav      — all Up/Down/Left/Right/Enter while panel open
  //   4. handleViewOptions   — delegated to ViewScreen when options open
  //   5. handleGlobalKeys    — 0 (quick note), * (shortcut map), CSK hold-timer
  //   6. delegateToScreen    — current screen's onKey() handler
  //
  // KEY NAME REFERENCE (KaiOS hardware → browser event.key):
  //   D-pad up/down/left/right  → ArrowUp / ArrowDown / ArrowLeft / ArrowRight
  //   Centre select (CSK)       → Enter
  //   Left softkey  (LSK)       → SoftLeft   (non-standard; emulated by F1 in browser-dev.js)
  //   Right softkey (RSK)       → SoftRight  (non-standard; emulated by F2 in browser-dev.js)
  //   Back / Backspace          → Backspace
  //   Numeric row               → '0' through '9'
  //   Star key                  → '*'
  //
  // EVOLVING THIS FILE:
  //   Adding a new screen  → register in SCREENS{} at the top + SHORTCUT_MAPS
  //                          + SCREEN_HANDLERS below
  //   Adding a new overlay → add a guard in handleOverlayKeys (keep it first)
  //   Adding a panel       → extend anyPanelOpen() and closeAllPanels()
  //   Changing softkey roles → edit handleSoftkeyPanels only; never scatter
  //                            LSK/RSK logic into individual screen handlers
  //   CSK hold threshold   → change the 800ms value in handleGlobalKeys
  //
  // ── Screen handler registry (single source of truth for delegation) ───────
  //
  //   Used by both keydown (delegateToScreen) and keyup (CSK hold release).
  //   Add new screens here and nowhere else.
  //
  // ── Camera ────────────────────────────────────────────────────────────────

  function launchCamera() {
    if (window.MozActivity) {
      var act = new window.MozActivity({ name: 'pick', data: { type: ['image/png', 'image/jpg', 'image/jpeg'] } });
      act.onsuccess = function() {
        var blob = this.result && this.result.blob;
        showWizard(null, { defaultType: 'log', pendingAttachment: blob || null });
      };
      act.onerror = function() { /* cancelled */ };
    } else {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.setAttribute('capture', 'camera');
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.addEventListener('change', function() {
        var blob = inp.files && inp.files[0] ? inp.files[0] : null;
        document.body.removeChild(inp);
        showWizard(null, { defaultType: 'log', pendingAttachment: blob });
      });
      inp.click();
    }
  }

  var SCREEN_HANDLERS = {
    help:               HelpScreen,
    home:               HomeScreen,
    'user-switcher':    UserSwitcherScreen,
    'sale-tally':       SaleTallyScreen,
    'io-create':        IOCreateScreen,
    list:               ListScreen,
    country:            CountryScreen,
    wizard:             WizardScreen,
    view:               ViewScreen,
    financial:          FinancialScreen,
    'finance-overview': FinanceOverviewScreen,
    share:              ShareScreen,
    'note-share':       NoteShareScreen,
    management:         ManagementScreen,
    ledger:             LedgerScreen,
    liabilities:        LiabilitiesScreen,
    'newent-wizard':    NewEntWizardScreen,
    archive:              ArchiveScreen,
    'template-creator':   TemplateCreatorScreen,
    timeline:             TimelineScreen,
    tasks:              TasksScreen,
    'calendar-wp':      CalendarWPScreen,
    chain:              ChainScreen,
    dispute:            DisputeScreen,
  };

  // ── Layer 1: Overlay key trap ─────────────────────────────────────────────
  //
  //   When an overlay is open, no key should reach panels or screens.
  //   Quick-note: LSK = cancel, RSK/Enter = save, all other keys absorbed.
  //   Shortcut map: any key dismisses it.
  //
  function handleOverlayKeys(key, e) {
    if (receiveNoteOpen) {
      if (key === 'SoftLeft' || key === 'Backspace') { closeReceivedNote(); e.preventDefault(); }
      else if (key === 'SoftRight' || key === 'Enter') { saveReceivedNote(); e.preventDefault(); }
      return true;
    }
    if (receivePpOpen) {
      if (key === 'SoftLeft' || key === 'Backspace')    { closeReceivePp(); e.preventDefault(); }
      else if (key === 'SoftRight')                     { confirmReceivePp(); e.preventDefault(); }
      else if (key === 'Enter' && !isFocusInInput())    { confirmReceivePp(); e.preventDefault(); }
      return true;
    }
    if (quickNoteOpen) {
      if (key === 'SoftLeft')                           { closeQuickNote(); e.preventDefault(); }
      else if (key === 'SoftRight')                     { saveQuickNote();  e.preventDefault(); }
      else if (key === 'Enter' && !isFocusInInput())    { saveQuickNote();  e.preventDefault(); }
      return true;
    }
    if (shortcutOpen) {
      closeShortcutMap();
      e.preventDefault();
      return true;
    }
    return false;
  }

  // ── Receive passphrase overlay ────────────────────────────────────────────

  function openReceivePp(hash) {
    receivePpHash  = hash;
    receivePpOpen  = true;
    receivePpError.style.display = 'none';
    receivePpInput.value = '';
    receivePpEl.style.display = 'flex';
    setTimeout(function() { receivePpInput.focus(); }, 60);
  }

  function closeReceivePp() {
    receivePpOpen = false;
    receivePpEl.style.display = 'none';
    receivePpHash = '';
    showList();
  }

  function confirmReceivePp() {
    var passphrase = receivePpInput.value.trim();
    if (!passphrase) {
      receivePpError.textContent = 'Passphrase required.';
      receivePpError.style.display = 'block';
      return;
    }
    try {
      var decoded = WPSecurity.secureDecode(receivePpHash, passphrase);
      receivePpOpen = false;
      receivePpEl.style.display = 'none';
      receivePpHash = '';
      RecordService.storeReceived(decoded).then(function(stored) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        showView(stored);
      }).catch(function(err) {
        receivePpError.textContent = 'Could not store: ' + (err && err.message ? err.message : 'unknown');
        receivePpError.style.display = 'block';
      });
    } catch (err) {
      receivePpError.textContent = err.message.indexOf('KEY_HINT') !== -1
        ? 'Wrong passphrase — please try again.'
        : 'Could not decode: ' + err.message;
      receivePpError.style.display = 'block';
      receivePpInput.select();
    }
  }

  // ── Receive Note overlay ──────────────────────────────────────────────────

  function showReceivedNote(note) {
    receiveNoteObj  = note;
    receiveNoteOpen = true;
    if (!receiveNoteEl) return;

    var bodyEl   = document.getElementById('rn-body');
    var metaEl   = document.getElementById('rn-meta');
    var recEl    = document.getElementById('rn-record');
    var saveBtn  = document.getElementById('rn-save-btn');
    var dismissBtn = document.getElementById('rn-dismiss-btn');

    if (metaEl) {
      var ts = note.ts ? new Date(note.ts).toLocaleDateString() : '';
      metaEl.textContent = ts ? 'Received \u00b7 ' + ts : 'Received note';
    }
    if (bodyEl) bodyEl.textContent = note.text || '';
    if (recEl) {
      if (note.rec && (note.rec.job || note.rec.customer)) {
        recEl.textContent = '\u21b3 ' + (note.rec.job || note.rec.customer || '');
        recEl.style.display = 'block';
      } else {
        recEl.style.display = 'none';
      }
    }
    if (saveBtn) saveBtn.onclick = function() { saveReceivedNote(); };
    if (dismissBtn) dismissBtn.onclick = function() { closeReceivedNote(); };

    receiveNoteEl.style.display = 'flex';
  }

  function closeReceivedNote() {
    receiveNoteOpen = false;
    receiveNoteObj  = null;
    if (receiveNoteEl) receiveNoteEl.style.display = 'none';
    window.location.hash = '';
  }

  function saveReceivedNote() {
    if (!receiveNoteObj) return;
    PersonalService.capture({
      text:   receiveNoteObj.text,
      source: 'received-note',
      tags:   [],
    }).then(function() { closeReceivedNote(); });
  }

  // ── Layer 2: Softkey panel toggles ────────────────────────────────────────
  //
  //   LSK and RSK always open/close their respective panels. This fires before
  //   any panel navigation or screen logic so that the user can open a panel
  //   from any screen at any time (except onboarding).
  //
  function handleSoftkeyPanels(key, e) {
    if (currentScreen === 'onboarding') return false;
    if (currentScreen === 'template-creator') return false;
    if (currentScreen === 'sale-tally' || currentScreen === 'io-create' || currentScreen === 'io-record') {
      if (key === 'SoftLeft' || key === 'SoftRight' || key === 'Enter') {
        var h = SCREEN_HANDLERS[currentScreen];
        if (key === 'Enter' || key === 'SoftRight') {
          if (h && h.onCsk) h.onCsk();
          else if (h && h.onKey) h.onKey(key === 'Enter' ? 'Enter' : 'SoftRight');
        } else if (h && h.onKey) {
          h.onKey(key);
        }
        e.preventDefault();
        return true;
      }
      return false;
    }
    if (key === 'SoftLeft')  { WorkpadsPanel.toggle(); e.preventDefault(); return true; }
    if (key === 'SoftRight') { PersonalPanel.toggle(); e.preventDefault(); return true; }
    return false;
  }

  // ── Layer 3: Panel navigation ─────────────────────────────────────────────
  //
  //   When a panel is open, directional keys navigate within the panel.
  //   Enter inside WorkpadsPanel opens the focused record.
  //   Enter inside PersonalPanel opens quick-note if no linked record action.
  //   '*' in WorkpadsPanel toggles line ↔ chunk nav mode.
  //   '0' in PersonalPanel closes panel and opens quick-note.
  //   '1'–'3' in WorkpadsPanel are reserved for panel quick-create buttons.
  //   Any unmatched key closes the panel (prevents ghost key-presses leaking).
  //
  function handlePanelNav(key, e) {
    if (key === 'ArrowUp') {
      if (WorkpadsPanel.isOpen()) {
        if (!(WorkpadsPanel.navigateList && WorkpadsPanel.navigateList(-1)) &&
            !(WorkpadsPanel.navigateFinancialAction && WorkpadsPanel.navigateFinancialAction(-1))) {
          WorkpadsPanel.scrollContent(-1);
        }
      } else if (PersonalPanel.navigateItems) { PersonalPanel.navigateItems(-1); }
      else { PersonalPanel.scrollContent(-1); }
      e.preventDefault();

    } else if (key === 'ArrowDown') {
      if (WorkpadsPanel.isOpen()) {
        if (!(WorkpadsPanel.navigateList && WorkpadsPanel.navigateList(1)) &&
            !(WorkpadsPanel.navigateFinancialAction && WorkpadsPanel.navigateFinancialAction(1))) {
          WorkpadsPanel.scrollContent(1);
        }
      } else if (PersonalPanel.navigateItems) { PersonalPanel.navigateItems(1); }
      else { PersonalPanel.scrollContent(1); }
      e.preventDefault();

    } else if (key === 'ArrowLeft') {
      if (WorkpadsPanel.isOpen()) {
        if (!(WorkpadsPanel.cycleListTab && WorkpadsPanel.cycleListTab(-1))) closeAllPanels();
      } else { closeAllPanels(); }
      e.preventDefault();

    } else if (key === 'ArrowRight') {
      if (WorkpadsPanel.isOpen()) {
        if (!(WorkpadsPanel.cycleListTab && WorkpadsPanel.cycleListTab(1))) closeAllPanels();
      } else { closeAllPanels(); }
      e.preventDefault();

    } else if (key === 'Enter') {
      if (WorkpadsPanel.isOpen()) {
        if (WorkpadsPanel.handleEnter && WorkpadsPanel.handleEnter()) { e.preventDefault(); return; }
        var rec = WorkpadsPanel.focusedRecord ? WorkpadsPanel.focusedRecord() : null;
        closeAllPanels();
        if (rec) showView(rec);
      } else {
        if (PersonalPanel.handleEnter && PersonalPanel.handleEnter()) {
          // Panel navigated internally (e.g. opened linked record)
        } else {
          closeAllPanels();
          openQuickNote();
        }
      }
      e.preventDefault();

    } else if (key === '*' && WorkpadsPanel.isOpen()) {
      // Toggle line ↔ chunk browse navigation mode within the panel
      if (WorkpadsPanel.toggleNavMode) WorkpadsPanel.toggleNavMode();
      e.preventDefault();

    } else if (key === '0' && PersonalPanel.isOpen()) {
      closeAllPanels();
      openQuickNote();
      e.preventDefault();

    } else if ((key === '1' || key === '2' || key === '3') && WorkpadsPanel.isOpen()) {
      // Panel's quick-create buttons handle 1/2/3 internally; just prevent close
      e.preventDefault();

    } else if (key === 'Backspace' && WorkpadsPanel.isOpen()) {
      if (WorkpadsPanel.handleBackKey && WorkpadsPanel.handleBackKey()) { e.preventDefault(); return; }
      closeAllPanels();
      e.preventDefault();

    } else {
      // Unknown key while panel open — close the panel cleanly
      closeAllPanels();
      e.preventDefault();
    }
  }

  // ── Layer 4: View screen options overlay ──────────────────────────────────
  //
  //   ViewScreen manages its own options overlay state. When open, all keys
  //   are delegated directly to ViewScreen without going through global logic.
  //
  function handleViewOptions(key) {
    if (ViewScreen && ViewScreen.isOptionsOpen && ViewScreen.isOptionsOpen()) {
      if (ViewScreen.onKey) ViewScreen.onKey(key);
      return true;
    }
    return false;
  }

  // ── Layer 5: Global keys (outside input focus) ────────────────────────────
  //
  //   These fire on any screen when no input is focused and no overlay is open.
  //   '0'  → open quick-note from anywhere
  //   '*'  → show shortcut map for current screen
  //   Enter (held >800ms) → open quick-note via CSK long-press
  //           The hold is started here on keydown; the keyup listener below
  //           either fires the action (if held long enough) or delegates a
  //           short-press Enter to the current screen.
  //
  function handleGlobalKeys(key, e) {
    if (key === '0') {
      openQuickNote();
      e.preventDefault();
      return true;
    }
    if (key === '*') {
      if (currentScreen === 'template-creator') return false;
      if (currentScreen === 'sale-tally' && SaleTallyScreen && SaleTallyScreen.onStarKey) {
        SaleTallyScreen.onStarKey();
        e.preventDefault();
        return true;
      }
      showShortcutMap();
      e.preventDefault();
      return true;
    }
    if (key === 'Enter' && !isAnyOverlayOpen()) {
      if (!cskHoldTimer) {
        cskHoldTimer = setTimeout(function() {
          cskHoldTimer = null;
          openQuickNote();
        }, 800);
      }
      // Return true so keydown does NOT also delegate to screen.
      // The keyup listener resolves short-press (delegate) vs hold (quick note).
      return true;
    }
    return false;
  }

  // ── Layer 6: Screen delegation ────────────────────────────────────────────
  //
  //   Passes the key to the current screen's onKey() handler.
  //   Uses SCREEN_HANDLERS registry defined above — add new screens there.
  //
  function delegateToScreen(key) {
    var handler = SCREEN_HANDLERS[currentScreen];
    if (handler && handler.onKey) handler.onKey(key);
  }

  // ── Main keydown entry point ──────────────────────────────────────────────

  document.addEventListener('keydown', function(e) {
    var key = e.key;
    if (handleOverlayKeys(key, e))  return;
    if (handleSoftkeyPanels(key, e)) return;
    if (anyPanelOpen())             { handlePanelNav(key, e); return; }
    if (handleViewOptions(key))     return;
    if (!isFocusInInput())          { if (handleGlobalKeys(key, e)) return; }
    delegateToScreen(key);
  });

  // ── CSK hold resolution (keyup) ───────────────────────────────────────────
  //
  //   If Enter is released before the 800ms threshold fires, it was a short
  //   press. Cancel the hold timer and delegate Enter to the current screen.
  //   Onboarding is special-cased: Enter completes onboarding regardless.
  //
  document.addEventListener('keyup', function(e) {
    if (e.key !== 'Enter' || !cskHoldTimer) return;
    clearTimeout(cskHoldTimer);
    cskHoldTimer = null;
    if (isAnyOverlayOpen() || anyPanelOpen()) return;
    if (currentScreen === 'onboarding') { completeOnboarding(); return; }
    delegateToScreen('Enter');
  });

  // List screen click handler
  document.getElementById('list-content').addEventListener('click', function(e) {
    var item = e.target.closest ? e.target.closest('.list-item') : null;
    if (item) {
      if (item.getAttribute('data-new-rec') || item.classList.contains('list-new-rec')) return; // handled by list.js
      var idx = item.getAttribute('data-idx');
      if (idx !== null && ListScreen.itemAt) {
        var rec = ListScreen.itemAt(parseInt(idx, 10));
        if (rec) showView(rec);
      } else {
        var rec2 = ListScreen.focusedRecord ? ListScreen.focusedRecord() : null;
        if (rec2) showView(rec2);
      }
    }
  });

  // ── Boot ───────────────────────────────────────────────────────────────────

  // Quick note Save / Cancel buttons
  var qnSaveBtn   = document.getElementById('qn-save-btn');
  var qnCancelBtn = document.getElementById('qn-cancel-btn');
  if (qnSaveBtn)   qnSaveBtn.addEventListener('click',   function() { saveQuickNote(); });
  if (qnCancelBtn) qnCancelBtn.addEventListener('click', function() { closeQuickNote(); });

  // Receive passphrase overlay buttons
  var rppCancelBtn = document.getElementById('rpp-cancel-btn');
  var rppOpenBtn   = document.getElementById('rpp-open-btn');
  if (rppCancelBtn) rppCancelBtn.addEventListener('click', function() { closeReceivePp(); });
  if (rppOpenBtn)   rppOpenBtn.addEventListener('click',   function() { confirmReceivePp(); });

  // Ledger CSK (Save) button
  var ledgerCsk = document.getElementById('ledger-csk');
  if (ledgerCsk) {
    ledgerCsk.addEventListener('click', function() {
      if (currentScreen === 'ledger' && LedgerScreen && LedgerScreen.save) LedgerScreen.save();
    });
  }

  global.App = {
    showHelp:          showHelp,
    showHome:          showHome,
    showList:          showList,
    showSaleTally:     showSaleTally,
    showIOCreate:      showIOCreate,
    showIORecord:      showIORecord,
    showConnections:   showConnections,
    showWizard:        showWizard,
    showView:          showView,
    showFinancial:     showFinancial,
    showFinanceOverview: showFinanceOverview,
    showShare:         showShare,
    showNoteShare:     showNoteShare,
    showManagement:    showManagement,
    showActivities:    showActivities,
    showTemplates:        showTemplates,
    showTemplateCreator:  showTemplateCreator,
    showCountry:          showCountry,
    showLedger:        showLedger,
    showLiabilities:   showLiabilities,
    showNewEntWizard:  showNewEntWizard,
    showArchive:       showArchive,
    showUserSwitcher:  showUserSwitcher,
    showTimeline:      showTimeline,
    showTasks:         showTasks,
    showCalendarWP:    showCalendarWP,
    showChain:         showChain,
    showDispute:       showDispute,
    prefillRecord:     prefillRecord,
    launchCamera:      launchCamera,
    getHomeMode:       getHomeMode,
    setHomeMode:       setHomeMode,
    cycleHomeMode:     cycleHomeMode,
    homeModeLabel:     homeModeLabel,
    HOME_MODES:        HOME_MODES,
    openQuickNote:     openQuickNote,
    SHORTCUT_MAPS:     SHORTCUT_MAPS,
    getCurrentScreen:  function() { return currentScreen; },
    goBack:            goBack,
  };

  if (global.UIPhase && global.UIPhase.onBoot) global.UIPhase.onBoot();
  if (typeof NavStack !== 'undefined' && NavStack.initCrumbBar) NavStack.initCrumbBar();

  checkIncomingUrl();

  if (!ActivityService.hasAny()) {
    showOnboarding();
  } else if (getHomeMode() === 'wp+') {
    if (typeof NavStack !== 'undefined' && NavStack.replaceRoot) NavStack.replaceRoot('home', {});
    showScreen('home');
    HomeScreen.onShow();
    if (typeof WorkpadsPanel !== 'undefined') WorkpadsPanel.setContext({ screen: 'home' });
  } else if (getHomeMode() === 'sell') {
    if (typeof NavStack !== 'undefined' && NavStack.replaceRoot) NavStack.replaceRoot('sale-tally', {});
    showScreen('sale-tally');
    if (SaleTallyScreen && SaleTallyScreen.onShow) SaleTallyScreen.onShow({ returnTo: 'list' });
  } else {
    if (typeof NavStack !== 'undefined' && NavStack.replaceRoot) NavStack.replaceRoot('list', {});
    showScreen('list');
    ListScreen.onShow(null);
  }

}(window));
