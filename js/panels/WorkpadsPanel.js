// WorkpadsPanel — ArrowLeft overlay, Exchange Engine context layer
// Spec: workpads-standard/panel-access-model.md (ARC-016)
// Split: workpads-panel-shared.js, -browse.js, -contact.js, -record.js
// Exposes: window.WorkpadsPanel

(function(global) {
  'use strict';

  var S = {
    el: {
      panel:   document.getElementById('panel-workpads'),
      content: document.getElementById('panel-workpads-content'),
    },
    isOpen:  false,
    context: {},
    lastContext: null,
    finActionIdx:    0,
    mgmtPanelFocusIdx: 0,
    logSortMode: 'newest',
    contactPanelRoleFilter: null,
    jobPanelChildren:  [],
    browseActivities:  [],
    browseChipsOn:     false,
    actOvOpen:           false,
    actOvFilter:         'all',
    actOvZone:           'list',
    actOvFocusIdx:       0,
    actOvFilterFocusIdx: 0,
    actOvAddMode:        false,
    actOvNewType:        'own',
    browseDateStart:   '',
    browseDateEnd:     '',
    browseFocusables:  [],
    browseFocusIdx:    0,
    browseNavMode:     'line',
    browseAgg:         null,
    datePickerOpen:    false,
    datePickerTarget:  'start',
    datePickerYear:    0,
    datePickerMonth:   0,
    datePickerDay:     1,
    neState: {
      sectionIdx: 0,
      collapseState: 0,
      searchTerm: '',
      biz: null,
    },
  };

  function setContext(ctx) {
    S.context = ctx || {};
    S.finActionIdx = 0;
    if (S.context.screen !== 'list' && S.context.screen !== 'home') {
      S.browseFocusIdx = 0;
      S.browseNavMode = 'line';
    }
    if (S.isOpen) render();
  }

  function showBackdrop(side) {
    var backdrop = document.getElementById('panel-backdrop');
    if (!backdrop) return;
    backdrop.className = 'side-' + (side || 'left');
    backdrop.innerHTML = '<div class="backdrop-fill"></div>';
    backdrop.classList.add('active');
  }

  function hideBackdrop() {
    var backdrop = document.getElementById('panel-backdrop');
    if (backdrop) { backdrop.className = ''; backdrop.innerHTML = ''; }
  }

  function close() {
    S.isOpen = false;
    if (S.el.panel) S.el.panel.classList.remove('open');
    document.body.classList.remove('wp-panel-open');
    if (S.closeActOverlay) S.closeActOverlay();
    hideBackdrop();
  }

  function open() {
    if (typeof PersonalPanel !== 'undefined') PersonalPanel.close();
    var curScreen = (typeof App !== 'undefined' && App.getCurrentScreen)
      ? App.getCurrentScreen() : S.context.screen;
    if (curScreen === 'home' || curScreen === 'list') {
      S.context.screen = curScreen;
    }
    S.lastContext = S.context;
    S.isOpen = true;
    S.el.panel.classList.add('open');
    document.body.classList.add('wp-panel-open');
    showBackdrop('left');
    if (S.context.screen === 'list' || S.context.screen === 'home') {
      S.browseFocusIdx = 0;
      S.browseAgg = null;
    }
    S.jobPanelChildren = [];
    render();
  }

  function toggle() {
    if (S.isOpen) close(); else open();
  }

  S.close = close;

  global.WorkpadsPanelShared.install(S);
  global.WorkpadsPanelBrowse.install(S);
  global.WorkpadsPanelContact.install(S);
  global.WorkpadsPanelRecord.install(S);

  function render() {
    var screen = S.context.screen;
    var rec    = S.context.record;
    S.updateActCircle();

    if (screen === 'list' || screen === 'home') {
      S.renderListPanel();
    } else if (screen === 'view') {
      S.renderRecordPreview(rec);
    } else if (screen === 'wizard') {
      S.renderWizardContext();
    } else if (screen === 'newent-wizard') {
      S.renderNewEntWizardPanel();
    } else if (screen === 'share') {
      S.renderShareContext();
    } else if (screen === 'management') {
      S.renderManagementContext();
    } else {
      S.el.content.innerHTML = '<div class="panel-label">No context.</div>';
    }
  }

  function navigateList(dir) {
    if (S.navigateListBrowse(dir)) return true;
    if (S.navigateListRecord(dir)) return true;
    return false;
  }

  function cycleListTab(dir) {
    if (S.cycleListTabBrowse(dir)) return true;
    if (S.cycleListTabRecord(dir)) return true;
    return false;
  }

  function toggleNavMode() {
    return S.toggleNavModeBrowse();
  }

  function handleEnter() {
    if (S.handleEnterBrowse()) return true;
    if (S.handleEnterRecord()) return true;
    return false;
  }

  (function() {
    var lsk = S.el.panel.querySelector('.sk-lsk');
    var csk = S.el.panel.querySelector('.sk-csk');
    var rsk = S.el.panel.querySelector('.sk-rsk');
    if (lsk) lsk.addEventListener('click', function() { close(); });
    if (csk) csk.addEventListener('click', function() {
      if (!handleEnter()) {
        var rec = S.focusedRecord();
        close();
        if (rec && typeof App !== 'undefined') App.showView(rec);
      }
    });
    if (rsk) rsk.addEventListener('click', function() {
      close();
      if (typeof App !== 'undefined') App.showManagement();
    });
  }());

  global.WorkpadsPanel = {
    open: open,
    close: close,
    toggle: toggle,
    setContext: setContext,
    scrollContent: S.scrollContent,
    navigateFinancialAction: S.navigateFinancialAction,
    navigateList: navigateList,
    cycleListTab: cycleListTab,
    toggleNavMode: toggleNavMode,
    handleEnter: handleEnter,
    handleBackKey: S.handleBackKey,
    focusedRecord: S.focusedRecord,
    isOpen: function() { return S.isOpen; },
    render: render,
    lastContext: function() { return S.lastContext; },
    showBackdrop: showBackdrop,
    hideBackdrop: hideBackdrop,
  };

}(window));
