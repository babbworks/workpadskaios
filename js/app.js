// app.js — screen router, D-pad handler, entry point
// Exposes: window.App

(function(global) {
  'use strict';

  var SCREENS = {
    onboarding: document.getElementById('screen-onboarding'),
    list:       document.getElementById('screen-list'),
    wizard:     document.getElementById('screen-wizard'),
    view:       document.getElementById('screen-view'),
    share:      document.getElementById('screen-share'),
    management: document.getElementById('screen-management'),
  };

  var currentScreen = 'list';
  var quickNoteEl   = document.getElementById('overlay-quicknote');
  var quickNoteInput = document.getElementById('quicknote-input');
  var quickNoteOpen = false;

  // ── Screen transitions ─────────────────────────────────────────────────

  function showScreen(name) {
    closeAllPanels();
    Object.keys(SCREENS).forEach(function(k) {
      SCREENS[k].classList.toggle('active', k === name);
    });
    currentScreen = name;
  }

  function showList() {
    showScreen('list');
    ListScreen.onShow();
  }

  function showWizard(record) {
    showScreen('wizard');
    WizardScreen.onShow(record || null);
  }

  function showView(record) {
    showScreen('view');
    ViewScreen.onShow(record);
  }

  function showShare(record) {
    showScreen('share');
    ShareScreen.onShow(record);
  }

  function showManagement() {
    showScreen('management');
    ManagementScreen.onShow();
  }

  // ── Panel helpers ──────────────────────────────────────────────────────

  var PANEL_SUPPRESSED = ['management'];

  function panelsAllowed() {
    return PANEL_SUPPRESSED.indexOf(currentScreen) === -1 && !quickNoteOpen;
  }

  function isFocusInInput() {
    var el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  function isFocusOnHorizontalNav() {
    var el = document.activeElement;
    return el && el.dataset && el.dataset.navAxis === 'horizontal';
  }

  function isAnyOverlayOpen() {
    return quickNoteOpen ||
      (ViewScreen && ViewScreen.isOptionsOpen && ViewScreen.isOptionsOpen());
  }

  function shouldOpenPanel() {
    return panelsAllowed() && !isFocusInInput() && !isFocusOnHorizontalNav() &&
      !isAnyOverlayOpen();
  }

  function closeAllPanels() {
    WorkpadsPanel.close();
    PersonalPanel.close();
  }

  // ── Quick Note ─────────────────────────────────────────────────────────

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
      PersonalService.capture({ text: text, source: 'quick-note' });
    }
    closeQuickNote();
  }

  // ── Onboarding ─────────────────────────────────────────────────────────

  function showOnboarding() {
    showScreen('onboarding');
    setTimeout(function() {
      var inp = document.getElementById('onboard-name');
      if (inp) inp.focus();
    }, 50);
  }

  function completeOnboarding() {
    var nameInp  = document.getElementById('onboard-name');
    var phoneInp = document.getElementById('onboard-phone');
    var name  = nameInp  ? nameInp.value.trim()  : '';
    var phone = phoneInp ? phoneInp.value.trim() : '';
    if (!name) { if (nameInp) nameInp.focus(); return; }
    ActivityService.create({ name: name, phone: phone, type: 'freelance' });
    showList();
  }

  document.getElementById('screen-onboarding').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !isFocusInInput()) {
      completeOnboarding();
      e.preventDefault();
    }
    if (e.key === 'SoftRight' || e.key === 'SoftLeft') {
      completeOnboarding();
      e.preventDefault();
    }
  });

  // Also handle Enter inside the name input (submit on Enter)
  var onboardInput = document.getElementById('onboard-name');
  if (onboardInput) {
    onboardInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { completeOnboarding(); e.preventDefault(); }
    });
  }

  // ── URL receive: check for incoming workpad on load ─────────────────────

  function checkIncomingUrl() {
    var hash = window.location.hash.slice(1);
    if (!hash || !hash.includes('alg=')) return;
    try {
      var rec = RecordService.decodeUrl(hash);
      RecordService.storeReceived(rec).then(function(stored) {
        showView(stored);
      });
    } catch (e) {
      // Not a valid workpad URL — ignore
    }
  }

  // ── D-pad / key dispatch ───────────────────────────────────────────────

  document.addEventListener('keydown', function(e) {
    var key = e.key;

    // Quick note overlay keys
    if (quickNoteOpen) {
      if (key === 'SoftLeft')  { closeQuickNote(); e.preventDefault(); return; }
      if (key === 'Enter' && !isFocusInInput()) { saveQuickNote(); e.preventDefault(); return; }
      // SoftRight = save
      if (key === 'SoftRight') { saveQuickNote(); e.preventDefault(); return; }
      return; // all other keys handled by textarea
    }

    // * key = Quick Note from anywhere (not when another overlay is open)
    if (key === '*' && !isAnyOverlayOpen()) {
      openQuickNote();
      e.preventDefault();
      return;
    }

    // CSK long-press = Quick Note (only when focus is NOT in an input and no overlay open)
    if (key === 'Enter' && !isFocusInInput() && !isAnyOverlayOpen()) {
      if (!cskHoldTimer) {
        cskHoldTimer = setTimeout(function() {
          cskHoldTimer = null;
          openQuickNote();
        }, 800);
        // Don't propagate yet — wait for keyup to know if it was a short or long press
        return;
      }
    }

    // ArrowLeft — Workpads Panel trigger
    if (key === 'ArrowLeft') {
      if (PersonalPanel.isOpen()) { PersonalPanel.close(); e.preventDefault(); return; }
      if (WorkpadsPanel.isOpen()) { WorkpadsPanel.close(); e.preventDefault(); return; }
      if (shouldOpenPanel()) {
        WorkpadsPanel.open();
        e.preventDefault();
        return;
      }
      // Management screen: tab navigation handled by ManagementScreen.onKey
    }

    // ArrowRight — Personal Panel trigger
    if (key === 'ArrowRight') {
      if (WorkpadsPanel.isOpen()) { WorkpadsPanel.close(); e.preventDefault(); return; }
      if (PersonalPanel.isOpen()) { PersonalPanel.close(); e.preventDefault(); return; }
      if (shouldOpenPanel()) {
        PersonalPanel.open();
        e.preventDefault();
        return;
      }
    }

    // Panel open: route keys to panel (BACK/SoftLeft closes panel)
    if (WorkpadsPanel.isOpen() || PersonalPanel.isOpen()) {
      if (key === 'SoftLeft' || key === 'Backspace') {
        closeAllPanels();
        e.preventDefault();
      }
      return;
    }

    // Route to current screen handler
    var handler = {
      list:       ListScreen,
      wizard:     WizardScreen,
      view:       ViewScreen,
      share:      ShareScreen,
      management: ManagementScreen,
    }[currentScreen];

    if (handler && handler.onKey) handler.onKey(key);
  });

  document.addEventListener('keyup', function(e) {
    if (e.key === 'Enter' && cskHoldTimer) {
      // Short press — cancel long-press timer and dispatch Enter to current screen
      clearTimeout(cskHoldTimer);
      cskHoldTimer = null;
      if (!isAnyOverlayOpen() && !WorkpadsPanel.isOpen() && !PersonalPanel.isOpen()) {
        if (currentScreen === 'onboarding') { completeOnboarding(); return; }
        var handler = {
          list:       ListScreen,
          wizard:     WizardScreen,
          view:       ViewScreen,
          share:      ShareScreen,
          management: ManagementScreen,
        }[currentScreen];
        if (handler && handler.onKey) handler.onKey('Enter');
      }
    }
  });

  // List screen: open record on Enter / CSK
  document.getElementById('list-content').addEventListener('click', function(e) {
    var item = e.target.closest('.list-item');
    if (item) {
      var idx = parseInt(item.dataset.idx, 10);
      var rec = ListScreen.focusedRecord ? ListScreen.focusedRecord() : null;
      if (rec) showView(rec);
    }
  });

  // ── Boot ───────────────────────────────────────────────────────────────

  global.App = {
    showList:       showList,
    showWizard:     showWizard,
    showView:       showView,
    showShare:      showShare,
    showManagement: showManagement,
  };

  checkIncomingUrl();

  // First-launch gate: show onboarding if no Activity Profile exists yet
  if (!ActivityService.hasAny()) {
    showOnboarding();
  } else {
    showList();
  }

}(window));
