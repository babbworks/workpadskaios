// Screen: PADS Wizard — 4 screens (Process / Actions / Details / Story)
// Exposes: window.WizardScreen

(function(global) {
  'use strict';

  var SCREENS = [
    { name: 'Process',  tab: 'P' },
    { name: 'Actions',  tab: 'A' },
    { name: 'Details',  tab: 'D' },
    { name: 'Story',    tab: 'S' },
  ];

  var el = {
    title:    document.getElementById('wizard-title'),
    tabs:     document.getElementById('wizard-tabs').querySelectorAll('.wizard-tab'),
    dots:     document.getElementById('wizard-dots').querySelectorAll('.wizard-dot'),
    content:  document.getElementById('wizard-content'),
    lsk:      document.getElementById('wiz-lsk'),
    csk:      document.getElementById('wiz-csk'),
    rsk:      document.getElementById('wiz-rsk'),
  };

  var currentRecord = null;   // full record object being edited
  var currentScreen = 0;      // 0-3
  var actions = [];           // working actions list

  // ── Progress indicators ──────────────────────────────────────────────────

  function updateProgress() {
    el.tabs.forEach(function(t, i) {
      t.classList.toggle('active', i === currentScreen);
    });
    el.dots.forEach(function(d, i) {
      d.classList.toggle('active', i === currentScreen);
    });
    el.title.textContent = SCREENS[currentScreen].name;
  }

  function updateSoftkeys() {
    var isFirst = currentScreen === 0;
    var isLast  = currentScreen === 3;
    el.lsk.textContent = isFirst ? 'Cancel' : 'Back';
    el.csk.textContent = isLast  ? ''       : 'Next';
    el.rsk.textContent = 'Save';
  }

  // ── Field helpers ────────────────────────────────────────────────────────

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function fieldGroup(id, label, value, type) {
    return '<div class="field-group">' +
      '<div class="field-label">' + label + '</div>' +
      '<input class="field-input" id="f-' + id + '" type="' + (type || 'text') + '" ' +
        'value="' + esc(value) + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
      '</div>';
  }

  function readInputs() {
    if (!currentRecord) return;
    var ids = ['job','customer','date','location','start_time','end_time',
               'meeting_time','customer_phone','worker','details','story'];
    ids.forEach(function(id) {
      var inp = document.getElementById('f-' + id);
      if (inp) currentRecord[id] = inp.value.trim() || undefined;
    });
    currentRecord.actions = actions.slice();
  }

  // ── Screen 0: Process ────────────────────────────────────────────────────

  function renderProcess() {
    var r = currentRecord;
    el.content.innerHTML =
      fieldGroup('job',      'Job *',     r.job      || '') +
      fieldGroup('customer', 'Customer',  r.customer || '') +
      fieldGroup('date',     'Date',      r.date     || '', 'date');

    var first = document.getElementById('f-job');
    if (first) first.focus();
  }

  // ── Screen 1: Actions ────────────────────────────────────────────────────

  function renderActions() {
    var html = actions.map(function(a, i) {
      return '<div class="action-item" tabindex="0" data-action-idx="' + i + '">' +
        '<div class="action-item-title">' + esc(a.title || '(untitled)') + '</div>' +
        '</div>';
    }).join('');
    html += '<div class="action-add-btn" tabindex="0" id="action-add">+ Add action</div>';
    el.content.innerHTML = html;

    document.getElementById('action-add').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') promptAddAction();
    });
  }

  function promptAddAction() {
    var title = window.prompt('Action title:');
    if (title && title.trim()) {
      actions.push({ title: title.trim(), notes: '' });
      renderActions();
    }
  }

  // ── Screen 2: Details ────────────────────────────────────────────────────

  function renderDetails() {
    var r = currentRecord;
    var workerDefault = r.worker || (ActivityService.getSenderIdentity().name) || '';
    el.content.innerHTML =
      fieldGroup('worker',        'Worker',          workerDefault) +
      fieldGroup('location',      'Location',        r.location       || '') +
      fieldGroup('customer_phone','Customer phone',  r.customer_phone || '', 'tel') +
      fieldGroup('start_time',    'Start time',      r.start_time     || '') +
      fieldGroup('end_time',      'End time',        r.end_time       || '') +
      fieldGroup('meeting_time',  'Meeting time',    r.meeting_time   || '');

    var first = document.getElementById('f-worker');
    if (first) first.focus();
  }

  // ── Screen 3: Story ──────────────────────────────────────────────────────

  function renderStory() {
    var r = currentRecord;
    el.content.innerHTML =
      '<div class="field-group">' +
        '<div class="field-label">Story</div>' +
        '<textarea class="field-input" id="f-story" rows="5" style="height:90px;resize:none;">' +
          esc(r.story || '') + '</textarea>' +
      '</div>' +
      '<div class="field-group">' +
        '<div class="field-label">Details</div>' +
        '<textarea class="field-input" id="f-details" rows="4" style="height:72px;resize:none;">' +
          esc(r.details || '') + '</textarea>' +
      '</div>';

    var first = document.getElementById('f-story');
    if (first) first.focus();
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function renderCurrentScreen() {
    readInputs();
    updateProgress();
    updateSoftkeys();
    switch (currentScreen) {
      case 0: renderProcess(); break;
      case 1: renderActions(); break;
      case 2: renderDetails(); break;
      case 3: renderStory();   break;
    }
    WorkpadsPanel.setContext({ screen: 'wizard', wizardScreen: currentScreen, record: currentRecord });
  }

  function goNext() {
    readInputs();
    autoSave();
    if (currentScreen < 3) { currentScreen++; renderCurrentScreen(); }
  }

  function goBack() {
    readInputs();
    autoSave();
    if (currentScreen > 0) { currentScreen--; renderCurrentScreen(); }
    else { App.showList(); }
  }

  function saveAndExit() {
    readInputs();
    if (!currentRecord.job) {
      alert('Job title is required.');
      return;
    }
    RecordService.save(currentRecord.id, currentRecord).then(function(saved) {
      // Auto-save customer to Block Registry when both name and phone are present
      if (saved.customer && saved.customer_phone) {
        BlockRegistry.save(saved.customer, saved.customer_phone);
      }
      App.showList();
    });
  }

  function autoSave() {
    if (!currentRecord || !currentRecord.id) return;
    RecordService.update(currentRecord.id, currentRecord).catch(function() {});
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function onShow(record) {
    currentScreen = 0;
    actions = (record && record.actions) ? record.actions.slice() : [];
    if (record) {
      currentRecord = Object.assign({}, record);
    } else {
      RecordService.create({}).then(function(r) {
        currentRecord = r;
        renderCurrentScreen();
      });
      return;
    }
    renderCurrentScreen();
  }

  function onKey(key) {
    switch (key) {
      case 'SoftLeft':  goBack();    break;
      case 'SoftRight': saveAndExit(); break;
      case 'Enter':
        if (currentScreen < 3) goNext();
        else saveAndExit();
        break;
    }
  }

  global.WizardScreen = { onShow: onShow, onKey: onKey };

}(window));
