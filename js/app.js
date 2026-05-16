// app.js — screen router, D-pad handler, entry point
// Nav model v0.2: LSK=WorkpadsPanel, RSK=PersonalPanel, Back=go-back,
//                 CSK=primary action, 0=QuickNote, *=shortcut map, 1-9=shortcuts
// Exposes: window.App

(function(global) {
  'use strict';

  var SCREENS = {
    onboarding: document.getElementById('screen-onboarding'),
    country:    document.getElementById('screen-country'),
    list:       document.getElementById('screen-list'),
    wizard:     document.getElementById('screen-wizard'),
    view:       document.getElementById('screen-view'),
    'note-share': document.getElementById('screen-note-share'),
    share:      document.getElementById('screen-share'),
    management: document.getElementById('screen-management'),
    ledger:     document.getElementById('screen-ledger'),
    'newent-wizard': document.getElementById('screen-newent-wizard'),
    archive:         document.getElementById('screen-archive'),
  };

  var currentScreen = 'list';

  // ── Shortcut maps (per screen) ─────────────────────────────────────────────

  var SHORTCUT_MAPS = {
    list: [
      { key: '1', label: 'New record' },
      { key: '3', label: 'Filter by type' },
      { key: '4', label: 'New Exp/COGS/Inc' },
      { key: '5', label: 'Manage' },
      { key: '6', label: 'New Business' },
      { key: '0', label: 'Quick note' },
    ],
    view: [
      { key: 'CSK', label: 'Edit / Open (collapsed)' },
      { key: '1',   label: 'Edit record' },
      { key: '2',   label: 'Share' },
      { key: '3',   label: 'Archive' },
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
      { key: '4', label: 'Settings tab' },
      { key: '0', label: 'Quick note' },
    ],
  };

  // ── Overlay state ──────────────────────────────────────────────────────────

  var quickNoteEl    = document.getElementById('overlay-quicknote');
  var quickNoteInput = document.getElementById('quicknote-input');
  var shortcutEl     = document.getElementById('overlay-shortcuts');
  var shortcutsEl    = document.getElementById('shortcuts-content');
  var quickNoteOpen  = false;
  var shortcutOpen   = false;

  // ── Screen transitions ─────────────────────────────────────────────────────

  function showScreen(name) {
    closeAllPanels();
    var keys = Object.keys(SCREENS);
    for (var i = 0; i < keys.length; i++) {
      SCREENS[keys[i]].classList.toggle('active', keys[i] === name);
    }
    currentScreen = name;
  }

  function showList() {
    showScreen('list');
    ListScreen.onShow();
  }

  function showWizard(record, opts) {
    showScreen('wizard');
    WizardScreen.onShow(record || null, opts || null);
  }

  function showView(record) {
    showScreen('view');
    ViewScreen.onShow(record);
  }

  function showShare(record) {
    showScreen('share');
    ShareScreen.onShow(record);
  }

  function showNoteShare(capture) {
    showScreen('note-share');
    NoteShareScreen.onShow(capture);
  }

  function showManagement() {
    showScreen('management');
    ManagementScreen.onShow();
  }

  function showActivities() {
    showScreen('management');
    ManagementScreen.showTab('activities');
  }

  function showLedger(opts) {
    showScreen('ledger');
    LedgerScreen.onShow(opts || {});
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

  // ── Panel helpers ──────────────────────────────────────────────────────────

  function closeAllPanels() {
    WorkpadsPanel.close();
    PersonalPanel.close();
  }

  function anyPanelOpen() {
    return WorkpadsPanel.isOpen() || PersonalPanel.isOpen();
  }

  function isFocusInInput() {
    var el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  function isAnyOverlayOpen() {
    return quickNoteOpen || shortcutOpen ||
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
    var looksLike = /^[0-9][a-z][a-z]\//.test(hash) || hash.indexOf('alg=') !== -1;
    if (!looksLike) return;
    try {
      var rec = RecordService.decodeUrl(hash);
      RecordService.storeReceived(rec).then(function(stored) { showView(stored); });
    } catch (e) {}
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
  var SCREEN_HANDLERS = {
    list:            ListScreen,
    country:         CountryScreen,
    wizard:          WizardScreen,
    view:            ViewScreen,
    share:           ShareScreen,
    'note-share':    NoteShareScreen,
    management:      ManagementScreen,
    ledger:          LedgerScreen,
    'newent-wizard': NewEntWizardScreen,
    archive:         ArchiveScreen,
  };

  // ── Layer 1: Overlay key trap ─────────────────────────────────────────────
  //
  //   When an overlay is open, no key should reach panels or screens.
  //   Quick-note: LSK = cancel, RSK/Enter = save, all other keys absorbed.
  //   Shortcut map: any key dismisses it.
  //
  function handleOverlayKeys(key, e) {
    if (quickNoteOpen) {
      if (key === 'SoftLeft')                           { closeQuickNote(); e.preventDefault(); }
      else if (key === 'SoftRight')                     { saveQuickNote();  e.preventDefault(); }
      else if (key === 'Enter' && !isFocusInInput())    { saveQuickNote();  e.preventDefault(); }
      return true; // absorb even keys not matched above
    }
    if (shortcutOpen) {
      closeShortcutMap();
      e.preventDefault();
      return true;
    }
    return false;
  }

  // ── Layer 2: Softkey panel toggles ────────────────────────────────────────
  //
  //   LSK and RSK always open/close their respective panels. This fires before
  //   any panel navigation or screen logic so that the user can open a panel
  //   from any screen at any time (except onboarding).
  //
  function handleSoftkeyPanels(key, e) {
    if (currentScreen === 'onboarding') return false;
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
      // Do NOT preventDefault or return true here — the keyup listener resolves
      // whether this was a short-press (delegate to screen) or hold (quick note).
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

  // Ledger CSK (Save) button
  var ledgerCsk = document.getElementById('ledger-csk');
  if (ledgerCsk) {
    ledgerCsk.addEventListener('click', function() {
      if (currentScreen === 'ledger' && LedgerScreen && LedgerScreen.save) LedgerScreen.save();
    });
  }

  global.App = {
    showList:          showList,
    showWizard:        showWizard,
    showView:          showView,
    showShare:         showShare,
    showNoteShare:     showNoteShare,
    showManagement:    showManagement,
    showActivities:    showActivities,
    showCountry:       showCountry,
    showLedger:        showLedger,
    showNewEntWizard:  showNewEntWizard,
    showArchive:       showArchive,
    openQuickNote:     openQuickNote,
    SHORTCUT_MAPS:     SHORTCUT_MAPS,
    getCurrentScreen:  function() { return currentScreen; },
  };

  checkIncomingUrl();

  if (!ActivityService.hasAny()) {
    showOnboarding();
  } else {
    showList();
  }

}(window));
