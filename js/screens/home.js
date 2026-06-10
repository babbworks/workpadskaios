// Screen: WP+ Home — WORK/PADS launcher + shortcuts
// Exposes: window.HomeScreen

(function(global) {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────

  var workOpen    = false;
  var padsOpen    = false;
  var focusZone   = 'work';   // work | work-sub | pads | pads-sub | sc1 | sc2
  var subFocusIdx = 0;
  var sc1FocusIdx = 0;
  var sc2FocusIdx = 0;

  var relPeopleIdx = 0;
  var relFocusZone = 'actions';
  var relPeople = [];
  var hubCounts = { timelineToday: 0, tasksOpen: 0, tasksOverdue: 0 };

  function relationsLensOn() {
    return global.UIPhase && UIPhase.isOn('relations_home');
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  var WORK_SUBS = [
    { id: 'today',  label: 'Today',  icon: 'sunrise' },
    { id: 'future', label: 'Future', icon: '=>'       },
    { id: 'past',   label: 'Past',   icon: '<='       },
    { id: 'new',    label: 'New',    icon: '+'        },
  ];

  var PADS_SUBS = [
    { id: 'received', label: 'Received', icon: 'recv' },
    { id: 'sent',     label: 'Sent',     icon: 'sent' },
    { id: 'locked',   label: 'Locked',   icon: 'lock' },
    { id: 'new',      label: 'New',      icon: '+'    },
  ];

  var SC1      = ['timeline', 'tasks', 'calendar'];
  var SC1_LBL  = ['Timeline', 'Tasks', 'Calendar'];
  var SC1_ICON = ['clock', 'check', 'cal'];

  var SC2      = ['sell', 'log', 'camera', 'help'];
  var SC2_LBL  = ['Sell', 'Log', 'Camera', 'Help'];
  var SC2_ICON = ['$', 'doc', 'cam', 'H'];

  // ── Icons ──────────────────────────────────────────────────────────────────

  function icon(name) {
    if (name === 'sunrise') return (
      '<svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
        '<path d="M3 12 A7 7 0 0 1 17 12"/>' +
        '<line x1="10" y1="1" x2="10" y2="4"/>' +
        '<line x1="1"  y1="12" x2="19" y2="12"/>' +
        '<line x1="2.5" y1="5.5" x2="4.5" y2="7.5"/>' +
        '<line x1="17.5" y1="5.5" x2="15.5" y2="7.5"/>' +
      '</svg>');
    if (name === 'recv') return (
      '<svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
        '<line x1="8" y1="1" x2="8" y2="13"/>' +
        '<polyline points="3,8 8,13 13,8"/>' +
        '<line x1="1" y1="17" x2="15" y2="17"/>' +
      '</svg>');
    if (name === 'sent') return (
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
        '<line x1="2" y1="14" x2="14" y2="2"/>' +
        '<polyline points="5,2 14,2 14,11"/>' +
      '</svg>');
    if (name === 'lock') return (
      '<svg width="13" height="16" viewBox="0 0 13 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
        '<rect x="1" y="7" width="11" height="9" rx="2"/>' +
        '<path d="M3.5 7V5a3 3 0 0 1 6 0v2"/>' +
        '<circle cx="6.5" cy="11.5" r="1.2" fill="currentColor" stroke="none"/>' +
      '</svg>');
    if (name === 'clock') return (
      '<svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
        '<circle cx="8.5" cy="8.5" r="7.5"/>' +
        '<line x1="8.5" y1="4" x2="8.5" y2="9"/>' +
        '<line x1="8.5" y1="9" x2="12" y2="11.5"/>' +
      '</svg>');
    if (name === 'check') return (
      '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="1,7 6,12 17,1"/>' +
      '</svg>');
    if (name === 'cal') return (
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
        '<rect x="0.5" y="2.5" width="15" height="13" rx="2"/>' +
        '<line x1="4.5" y1="0.5" x2="4.5" y2="5"/>' +
        '<line x1="11.5" y1="0.5" x2="11.5" y2="5"/>' +
        '<line x1="0.5" y1="7" x2="15.5" y2="7"/>' +
      '</svg>');
    if (name === 'doc') return (
      '<svg width="14" height="17" viewBox="0 0 14 17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
        '<path d="M1 1h9l3 3v12H1z"/>' +
        '<line x1="10" y1="1" x2="10" y2="4"/><line x1="10" y1="4" x2="13" y2="4"/>' +
        '<line x1="3.5" y1="8" x2="10.5" y2="8"/>' +
        '<line x1="3.5" y1="11" x2="8" y2="11"/>' +
      '</svg>');
    if (name === 'cam') return (
      '<svg width="19" height="15" viewBox="0 0 19 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
        '<rect x="0.5" y="3.5" width="18" height="11" rx="2"/>' +
        '<circle cx="9.5" cy="9" r="3"/>' +
        '<path d="M6.5 3.5 L7.5 1h4l1 2.5"/>' +
      '</svg>');
    // text fallback (<=, =>, +, H)
    return '<span class="home-icon-text">' + name + '</span>';
  }

  // ── Zone ordering ──────────────────────────────────────────────────────────

  function zoneOrder() {
    var o = ['work'];
    if (workOpen) o.push('work-sub');
    o.push('pads');
    if (padsOpen) o.push('pads-sub');
    o.push('sc1', 'sc2', 'records');
    return o;
  }

  // ── Relations home lens (C16 / B3) ─────────────────────────────────────────

  function renderRelationsLens() {
    var el = document.getElementById('home-content');
    if (!el) return;
    RecordService.list().then(function(records) {
      var sum = global.RelVolume ? RelVolume.networkSummary(records) : {
        bands: {}, needs: 0, offers: 0, openConnections: 0, topRhythm: [],
      };
      relPeople = (sum.topRhythm || []).concat(
        global.RelVolume ? RelVolume.scoreByContact(records).filter(function(s) {
          return s.band === 'warm';
        }).slice(0, 3) : []
      );

      var html =
        '<div class="rel-home-hero">' +
          '<div class="rel-home-title">Relations</div>' +
          '<div class="rel-home-sub">Needs, offers, and people in rhythm</div>' +
          '<div class="rel-home-stats">' +
            esc(String(sum.needs || 0)) + ' needs \u00b7 ' +
            esc(String(sum.offers || 0)) + ' offers \u00b7 ' +
            esc(String(sum.bands.rhythm || 0)) + ' in rhythm' +
            (sum.openConnections ? ' \u00b7 ' + sum.openConnections + ' relay' : '') +
          '</div>' +
        '</div>' +
        '<div class="rel-home-actions">' +
          '<div class="rel-home-btn' + (relFocusZone === 'actions' && relPeopleIdx === 0 ? ' focused' : '') + '" data-rel-act="needs">' +
            '<span class="rel-home-btn-lbl">Needs</span><span class="rel-home-btn-key">1</span></div>' +
          '<div class="rel-home-btn' + (relFocusZone === 'actions' && relPeopleIdx === 1 ? ' focused' : '') + '" data-rel-act="offers">' +
            '<span class="rel-home-btn-lbl">Offers</span><span class="rel-home-btn-key">2</span></div>' +
          '<div class="rel-home-btn' + (relFocusZone === 'actions' && relPeopleIdx === 2 ? ' focused' : '') + '" data-rel-act="conn">' +
            '<span class="rel-home-btn-lbl">Network</span><span class="rel-home-btn-key">3</span></div>' +
        '</div>' +
        '<div class="rel-home-sec-hdr">In rhythm</div>';

      var pi;
      for (pi = 0; pi < relPeople.length; pi++) {
        var p = relPeople[pi];
        var pf = relFocusZone === 'people' && relPeopleIdx === pi;
        html += '<div class="rel-home-person' + (pf ? ' focused' : '') + '" data-rel-person="' + pi + '">' +
          '<span class="rel-home-person-name">' + esc(p.label || p.key) + '</span>' +
          '<span class="rel-home-person-score">' + (p.score ? p.score.toFixed(1) : '') + '</span>' +
          '</div>';
      }
      if (!relPeople.length) {
        html += '<div class="rel-home-empty">Log sales or jobs with customers to build rhythm.</div>';
      }

      html +=
        '<div class="rel-home-footer">' +
          '<div class="rel-home-link' + (relFocusZone === 'footer' && relPeopleIdx === 0 ? ' focused' : '') + '" data-rel-foot="new-need">+ Need (4)</div>' +
          '<div class="rel-home-link' + (relFocusZone === 'footer' && relPeopleIdx === 1 ? ' focused' : '') + '" data-rel-foot="new-offer">+ Offer (5)</div>' +
          '<div class="rel-home-link' + (relFocusZone === 'footer' && relPeopleIdx === 2 ? ' focused' : '') + '" data-rel-foot="classic">Classic WP+ home (0)</div>' +
        '</div>' +
        '<div class="rel-home-hint">Enable/disable lens in Manage \u2192 App \u2192 relations_home</div>';

      el.innerHTML = html;

      var acts = el.querySelectorAll('[data-rel-act]');
      for (pi = 0; pi < acts.length; pi++) {
        acts[pi].addEventListener('click', (function(id) {
          return function() { activateRelationsAction(id); };
        })(acts[pi].getAttribute('data-rel-act')));
      }
      var pers = el.querySelectorAll('[data-rel-person]');
      for (pi = 0; pi < pers.length; pi++) {
        pers[pi].addEventListener('click', (function(ix) {
          return function() { openRelationsPerson(parseInt(ix, 10)); };
        })(pers[pi].getAttribute('data-rel-person')));
      }
      var feet = el.querySelectorAll('[data-rel-foot]');
      for (pi = 0; pi < feet.length; pi++) {
        feet[pi].addEventListener('click', (function(id) {
          return function() { activateRelationsFooter(id); };
        })(feet[pi].getAttribute('data-rel-foot')));
      }
    });
  }

  function activateRelationsAction(id) {
    if (id === 'needs') {
      App.showList({ returnTo: 'home', typeFilter: 'need' });
      return;
    }
    if (id === 'offers') {
      App.showList({ returnTo: 'home', typeFilter: 'offer' });
      return;
    }
    if (id === 'conn' && App.showConnections) App.showConnections();
  }

  function openRelationsPerson(idx) {
    var p = relPeople[idx];
    if (!p || !p.contactId) return;
    RecordService.list().then(function(all) {
      var i, r;
      for (i = 0; i < all.length; i++) {
        r = all[i];
        if (r.id === p.contactId) {
          App.showView(r);
          return;
        }
      }
    });
  }

  function activateRelationsFooter(id) {
    if (id === 'new-need' && App.showIORecord) {
      App.showIORecord({ recordType: 'need', returnTo: 'home' });
      return;
    }
    if (id === 'new-offer' && App.showIORecord) {
      App.showIORecord({ recordType: 'offer', returnTo: 'home' });
      return;
    }
    if (id === 'classic' && global.UIPhase) {
      UIPhase.disable('relations_home');
      render();
    }
  }

  function onKeyRelations(key) {
    switch (key) {
      case '1': activateRelationsAction('needs'); break;
      case '2': activateRelationsAction('offers'); break;
      case '3': activateRelationsAction('conn'); break;
      case '4':
        if (App.showIORecord) App.showIORecord({ recordType: 'need', returnTo: 'home' });
        break;
      case '5':
        if (App.showIORecord) App.showIORecord({ recordType: 'offer', returnTo: 'home' });
        break;
      case '0':
        if (global.UIPhase) { UIPhase.disable('relations_home'); render(); }
        break;
      case 'ArrowDown':
        if (relFocusZone === 'actions') {
          if (relPeopleIdx < 2) relPeopleIdx++;
          else if (relPeople.length) { relFocusZone = 'people'; relPeopleIdx = 0; }
          else { relFocusZone = 'footer'; relPeopleIdx = 0; }
        } else if (relFocusZone === 'people') {
          if (relPeopleIdx < relPeople.length - 1) relPeopleIdx++;
          else { relFocusZone = 'footer'; relPeopleIdx = 0; }
        } else if (relFocusZone === 'footer' && relPeopleIdx < 2) relPeopleIdx++;
        renderRelationsLens();
        break;
      case 'ArrowUp':
        if (relFocusZone === 'footer') {
          if (relPeopleIdx > 0) relPeopleIdx--;
          else if (relPeople.length) { relFocusZone = 'people'; relPeopleIdx = relPeople.length - 1; }
          else { relFocusZone = 'actions'; relPeopleIdx = 2; }
        } else if (relFocusZone === 'people') {
          if (relPeopleIdx > 0) relPeopleIdx--;
          else { relFocusZone = 'actions'; relPeopleIdx = 2; }
        } else if (relFocusZone === 'actions' && relPeopleIdx > 0) relPeopleIdx--;
        renderRelationsLens();
        break;
      case 'Enter':
        if (relFocusZone === 'actions') {
          activateRelationsAction(['needs', 'offers', 'conn'][relPeopleIdx]);
        } else if (relFocusZone === 'people') {
          openRelationsPerson(relPeopleIdx);
        } else if (relFocusZone === 'footer') {
          activateRelationsFooter(['new-need', 'new-offer', 'classic'][relPeopleIdx]);
        }
        break;
      case 'SoftRight':
        App.setHomeMode('list');
        App.showList();
        break;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function render() {
    if (relationsLensOn()) {
      renderRelationsLens();
      return;
    }
    var el = document.getElementById('home-content');
    if (!el) return;
    var html = '';

    // WORK button
    var wFocused = focusZone === 'work';
    html += '<div class="home-main-btn' + (wFocused ? ' focused' : '') + (workOpen ? ' is-open' : '') + '" id="home-work-btn">' +
      '<span class="home-btn-label">WORK</span>' +
      '<span class="home-btn-arrow">' + (workOpen ? '&#9650;' : '&#9660;') + '</span>' +
    '</div>';

    // WORK sub-buttons
    if (workOpen) {
      html += '<div class="home-sub-row">';
      for (var wi = 0; wi < WORK_SUBS.length; wi++) {
        var ws = WORK_SUBS[wi];
        var wsa = focusZone === 'work-sub' && subFocusIdx === wi;
        html += '<div class="home-sub-btn' + (wsa ? ' focused' : '') + '" data-zone="work-sub" data-idx="' + wi + '">' +
          '<span class="home-sub-icon">' + icon(ws.icon) + '</span>' +
          '<span class="home-sub-label">' + ws.label + '</span>' +
        '</div>';
      }
      html += '</div>';
    }

    // PADS button
    var pFocused = focusZone === 'pads';
    html += '<div class="home-main-btn' + (pFocused ? ' focused' : '') + (padsOpen ? ' is-open' : '') + '" id="home-pads-btn">' +
      '<span class="home-btn-label">PADS</span>' +
      '<span class="home-btn-arrow">' + (padsOpen ? '&#9650;' : '&#9660;') + '</span>' +
    '</div>';

    // PADS sub-buttons
    if (padsOpen) {
      html += '<div class="home-sub-row">';
      for (var pi = 0; pi < PADS_SUBS.length; pi++) {
        var ps = PADS_SUBS[pi];
        var psa = focusZone === 'pads-sub' && subFocusIdx === pi;
        html += '<div class="home-sub-btn' + (psa ? ' focused' : '') + '" data-zone="pads-sub" data-idx="' + pi + '">' +
          '<span class="home-sub-icon">' + icon(ps.icon) + '</span>' +
          '<span class="home-sub-label">' + ps.label + '</span>' +
        '</div>';
      }
      html += '</div>';
    }

    // Separator
    html += '<div class="home-separator"></div>';

    // Shortcut row 1
    html += '<div class="home-sc-row">';
    for (var s1i = 0; s1i < SC1.length; s1i++) {
      var s1a = focusZone === 'sc1' && sc1FocusIdx === s1i;
      var badge = '';
      if (s1i === 0 && hubCounts.timelineToday > 0) {
        badge = '<span class="home-sc-badge">' + hubCounts.timelineToday + '</span>';
      }
      if (s1i === 1 && hubCounts.tasksOpen > 0) {
        badge = '<span class="home-sc-badge' + (hubCounts.tasksOverdue ? ' home-sc-badge-warn' : '') + '">' +
          hubCounts.tasksOpen + '</span>';
      }
      html += '<div class="home-sc-btn' + (s1a ? ' focused' : '') + '" data-sc1="' + s1i + '">' +
        '<span class="home-sc-icon">' + icon(SC1_ICON[s1i]) + '</span>' +
        '<span class="home-sc-label">' + SC1_LBL[s1i] + badge + '</span>' +
      '</div>';
    }
    html += '</div>';

    // Shortcut row 2
    html += '<div class="home-sc-row">';
    for (var s2i = 0; s2i < SC2.length; s2i++) {
      var s2a = focusZone === 'sc2' && sc2FocusIdx === s2i;
      html += '<div class="home-sc-btn' + (s2a ? ' focused' : '') + '" data-sc2="' + s2i + '">' +
        '<span class="home-sc-icon">' + icon(SC2_ICON[s2i]) + '</span>' +
        '<span class="home-sc-label">' + SC2_LBL[s2i] + '</span>' +
      '</div>';
    }
    html += '</div>';

    // RECORDS button
    html += '<div class="home-records-btn' + (focusZone === 'records' ? ' focused' : '') + '" id="home-records-btn">RECORDS</div>';

    el.innerHTML = html;
    bindClicks(el);
  }

  // ── Click binding ──────────────────────────────────────────────────────────

  function bindClicks(el) {
    var wb = el.querySelector('#home-work-btn');
    if (wb) wb.addEventListener('click', toggleWork);

    var pb = el.querySelector('#home-pads-btn');
    if (pb) pb.addEventListener('click', togglePads);

    var rb = el.querySelector('#home-records-btn');
    if (rb) rb.addEventListener('click', function() { App.setHomeMode('list'); App.showList(); });

    var subs = el.querySelectorAll('[data-zone]');
    for (var i = 0; i < subs.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var zone = btn.getAttribute('data-zone');
          var idx  = parseInt(btn.getAttribute('data-idx'), 10);
          if (zone === 'work-sub') activateWorkSub(WORK_SUBS[idx].id);
          else                     activatePadsSub(PADS_SUBS[idx].id);
        });
      })(subs[i]);
    }

    var sc1s = el.querySelectorAll('[data-sc1]');
    for (var j = 0; j < sc1s.length; j++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          activateSc1(SC1[parseInt(btn.getAttribute('data-sc1'), 10)]);
        });
      })(sc1s[j]);
    }

    var sc2s = el.querySelectorAll('[data-sc2]');
    for (var k = 0; k < sc2s.length; k++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          activateSc2(SC2[parseInt(btn.getAttribute('data-sc2'), 10)]);
        });
      })(sc2s[k]);
    }
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────

  function toggleWork() {
    workOpen = !workOpen;
    padsOpen = false;
    focusZone   = workOpen ? 'work-sub' : 'work';
    subFocusIdx = 0;
    render();
  }

  function togglePads() {
    padsOpen = !padsOpen;
    workOpen = false;
    focusZone   = padsOpen ? 'pads-sub' : 'pads';
    subFocusIdx = 0;
    render();
  }

  // ── Activate ───────────────────────────────────────────────────────────────

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function activateWorkSub(id) {
    if (id === 'new') {
      App.showWizard(null, { defaultType: '' });
      return;
    }
    App.showList({ workFilter: id, returnTo: 'home' });
  }

  function activatePadsSub(id) {
    if (id === 'new') {
      App.showList({ showTypePicker: true, returnTo: 'home' });
      return;
    }
    App.showList({ padsFilter: id, returnTo: 'home' });
  }

  function activateSc1(id) {
    if (id === 'timeline') App.showTimeline();
    else if (id === 'tasks')    App.showTasks();
    else if (id === 'calendar') App.showCalendarWP();
  }

  function activateSc2(id) {
    if (id === 'sell')   App.showSaleTally({ returnTo: 'home' });
    else if (id === 'log')    App.showWizard(null, { defaultType: 'log' });
    else if (id === 'camera') App.launchCamera();
    else if (id === 'help')   App.showHelp({ returnTo: 'home' });
  }

  // ── D-pad ──────────────────────────────────────────────────────────────────

  function onKey(key) {
    if (relationsLensOn()) {
      onKeyRelations(key);
      return;
    }
    var order = zoneOrder();
    var idx   = order.indexOf(focusZone);

    switch (key) {
      case 'ArrowDown':
        if (idx < order.length - 1) {
          focusZone = order[idx + 1];
          subFocusIdx = sc1FocusIdx = sc2FocusIdx = 0;
          render();
        }
        break;

      case 'ArrowUp':
        if (idx > 0) {
          focusZone = order[idx - 1];
          render();
        }
        break;

      case 'ArrowLeft':
        if (focusZone === 'work-sub') { subFocusIdx  = Math.max(0, subFocusIdx  - 1); render(); }
        else if (focusZone === 'pads-sub') { subFocusIdx  = Math.max(0, subFocusIdx  - 1); render(); }
        else if (focusZone === 'sc1')      { sc1FocusIdx = Math.max(0, sc1FocusIdx - 1); render(); }
        else if (focusZone === 'sc2')      { sc2FocusIdx = Math.max(0, sc2FocusIdx - 1); render(); }
        break;

      case 'ArrowRight':
        if (focusZone === 'work-sub') { subFocusIdx  = Math.min(WORK_SUBS.length - 1, subFocusIdx  + 1); render(); }
        else if (focusZone === 'pads-sub') { subFocusIdx  = Math.min(PADS_SUBS.length - 1, subFocusIdx  + 1); render(); }
        else if (focusZone === 'sc1')      { sc1FocusIdx = Math.min(SC1.length - 1, sc1FocusIdx + 1); render(); }
        else if (focusZone === 'sc2')      { sc2FocusIdx = Math.min(SC2.length - 1, sc2FocusIdx + 1); render(); }
        break;

      case 'Enter':
        if (focusZone === 'work')          toggleWork();
        else if (focusZone === 'pads')     togglePads();
        else if (focusZone === 'work-sub') activateWorkSub(WORK_SUBS[subFocusIdx].id);
        else if (focusZone === 'pads-sub') activatePadsSub(PADS_SUBS[subFocusIdx].id);
        else if (focusZone === 'sc1')      activateSc1(SC1[sc1FocusIdx]);
        else if (focusZone === 'sc2')      activateSc2(SC2[sc2FocusIdx]);
        else if (focusZone === 'records')  { App.setHomeMode('list'); App.showList(); }
        break;

      case 'Backspace':
        if (workOpen) { workOpen = false; focusZone = 'work'; render(); }
        else if (padsOpen) { padsOpen = false; focusZone = 'pads'; render(); }
        // on home root, Back does nothing (no parent screen)
        break;

      case 'SoftRight':
      case '2':
        App.setHomeMode('list');
        App.showList();
        break;
    }
  }

  function refreshHubCounts(done) {
    if (typeof RecordService === 'undefined' || !global.WPDailyHub) {
      if (done) done();
      return;
    }
    RecordService.list().then(function(all) {
      hubCounts = WPDailyHub.homeBadges(all);
      if (done) done();
    });
  }

  // ── onShow ─────────────────────────────────────────────────────────────────

  function onShow() {
    workOpen = false;
    padsOpen = false;
    focusZone   = 'work';
    subFocusIdx = sc1FocusIdx = sc2FocusIdx = 0;

    // Update greeting with user's first name
    var greetEl = document.getElementById('home-greeting');
    if (greetEl) {
      var act = (typeof ActivityService !== 'undefined') ? ActivityService.getActive() : null;
      var firstName = act && act.name ? act.name.split(' ')[0] : '';
      greetEl.textContent = firstName ? 'Hello, ' + firstName : 'Hello';
    }

    refreshHubCounts(function() {
      if (relationsLensOn()) {
        relFocusZone = 'actions';
        relPeopleIdx = 0;
        renderRelationsLens();
      } else {
        render();
      }
    });
    WorkpadsPanel.setContext({ screen: 'home' });
    if (WorkpadsPanel.isOpen()) WorkpadsPanel.render();
  }

  global.HomeScreen = { onShow: onShow, onKey: onKey };

}(window));
