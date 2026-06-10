// Screen: Outcome-only create — need stated, share = save (R3)
// Exposes: window.IOCreateScreen

(function(global) {
  'use strict';

  var el = { content: null, csk: null, lsk: null, rsk: null, title: null };

  var step = 0; // 0=outcome 1=worker 2=save|share
  var outcomeText = '';
  var contacts = [];
  var contactFocus = 0;
  var selectedWorker = null;
  var choiceFocus = 0; // 0=draft 1=share
  var returnTo = 'list';
  var saving = false;

  function outcomeLabel() {
    if (global.GlobalSynonymsService) {
      return GlobalSynonymsService.resolve('job', null) || 'Outcome';
    }
    return 'Outcome';
  }

  function loadContacts() {
    return RecordService.list().then(function(recs) {
      contacts = recs.filter(function(r) {
        return (r.record_type || r.recordType) === 'contact' && !r.parentId;
      });
      contacts.sort(function(a, b) {
        var na = (a.customer || a.job || '').toLowerCase();
        var nb = (b.customer || b.job || '').toLowerCase();
        return na.localeCompare(nb);
      });
    });
  }

  function setSoftkeys() {
    if (step === 0) {
      if (el.lsk) el.lsk.textContent = 'Back';
      if (el.csk) el.csk.textContent = 'Next';
      if (el.rsk) el.rsk.textContent = '';
    } else if (step === 1) {
      if (el.lsk) el.lsk.textContent = 'Back';
      if (el.csk) el.csk.textContent = 'Next';
      if (el.rsk) el.rsk.textContent = '';
    } else {
      if (el.lsk) el.lsk.textContent = 'Back';
      if (el.csk) el.csk.textContent = choiceFocus === 1 ? 'Share' : 'Save draft';
      if (el.rsk) el.rsk.textContent = choiceFocus === 0 ? 'Share' : 'Draft';
    }
  }

  function renderStep0() {
    step = 0;
    setSoftkeys();
    if (el.title) el.title.textContent = 'New ' + outcomeLabel();
    var lbl = outcomeLabel();
    el.content.innerHTML =
      '<div class="io-create-hdr">The need stated — saves as Need</div>' +
      '<div class="field-group field-focused">' +
        '<div class="field-label">' + esc(lbl) + '</div>' +
        '<textarea class="field-input io-outcome-input" id="io-outcome" rows="4" ' +
          'placeholder="What needs done">' + esc(outcomeText) + '</textarea>' +
      '</div>' +
      '<div class="io-create-hint">Worker effort is the input — no extra steps required.</div>';
    var ta = document.getElementById('io-outcome');
    if (ta) {
      ta.addEventListener('input', function() { outcomeText = ta.value; });
      setTimeout(function() { ta.focus(); }, 50);
    }
  }

  function renderStep1() {
    step = 1;
    setSoftkeys();
    if (el.title) el.title.textContent = 'Share with';
    var rows = '';
    if (!contacts.length) {
      rows = (global.EmptyState
        ? EmptyState.render('No contacts yet', { hint: 'Add a contact from the list first.', action: 'Back to add later' })
        : '<div class="empty-state" style="padding:8px 10px;">No contacts yet.</div>') +
        '<div class="type-picker-row focused" data-ci="skip">' +
        '<span class="type-picker-label">Continue without contact</span></div>';
    } else {
      for (var i = 0; i < contacts.length; i++) {
        var c = contacts[i];
        var name = c.customer || c.job || '(contact)';
        var foc = contactFocus === i;
        rows += '<div class="type-picker-row' + (foc ? ' focused' : '') + '" data-ci="' + i + '">' +
          '<span class="type-picker-label">' + esc(name) + '</span>' +
        '</div>';
      }
      rows += '<div class="type-picker-row' + (contactFocus === contacts.length ? ' focused' : '') + '" data-ci="skip">' +
        '<span class="type-picker-label">Continue without contact</span></div>';
    }
    el.content.innerHTML =
      '<div class="io-create-hdr">Who receives this?</div>' + rows;
    var rowEls = el.content.querySelectorAll('[data-ci]');
    for (var j = 0; j < rowEls.length; j++) {
      rowEls[j].addEventListener('click', (function(ci) {
        return function() {
          if (ci === 'skip') {
            selectedWorker = null;
            renderStep2();
            return;
          }
          contactFocus = parseInt(ci, 10);
          selectedWorker = contacts[contactFocus];
          renderStep2();
        };
      })(rowEls[j].getAttribute('data-ci')));
    }
  }

  function renderStep2() {
    step = 2;
    setSoftkeys();
    if (el.title) el.title.textContent = 'Save or share';
    var wname = selectedWorker ? (selectedWorker.customer || selectedWorker.job || '') : '';
    el.content.innerHTML =
      '<div class="io-create-summary">' +
        '<div class="io-sum-line"><span class="io-sum-k">' + esc(outcomeLabel()) + '</span>' +
          esc(outcomeText.trim().slice(0, 80)) + (outcomeText.length > 80 ? '\u2026' : '') + '</div>' +
        (wname ? '<div class="io-sum-line"><span class="io-sum-k">With</span> ' + esc(wname) + '</div>' : '') +
      '</div>' +
      '<div class="io-choice-row' + (choiceFocus === 0 ? ' focused' : '') + '" data-choice="0">' +
        '<span class="io-choice-title">Save draft</span>' +
        '<span class="io-choice-sub">Keep on device; share later</span>' +
      '</div>' +
      '<div class="io-choice-row' + (choiceFocus === 1 ? ' focused' : '') + '" data-choice="1">' +
        '<span class="io-choice-title">Share now</span>' +
        '<span class="io-choice-sub">Save and open share link</span>' +
      '</div>';
    var choices = el.content.querySelectorAll('[data-choice]');
    for (var i = 0; i < choices.length; i++) {
      choices[i].addEventListener('click', (function(ch) {
        return function() {
          choiceFocus = parseInt(ch, 10);
          finishCreate(choiceFocus === 1);
        };
      })(choices[i].getAttribute('data-choice')));
    }
  }

  function finishCreate(doShare) {
    if (saving) return;
    var job = outcomeText.trim();
    if (!job) return;
    saving = true;
    var workerName = selectedWorker ? (selectedWorker.customer || selectedWorker.job || '') : '';
    var fields = {
      record_type: 'need',
      job: job,
      date: new Date().toISOString().slice(0, 10),
      chain_mode: 'INITIATING',
      relationship: 'creates',
      draft: !doShare,
    };
    if (workerName) {
      fields.customer = workerName;
      fields.worker = workerName;
      fields.participants = [{ name: workerName, role: 'worker' }];
    }
    if (selectedWorker && selectedWorker.id) {
      fields.linkedContactId = selectedWorker.id;
    }
    if (doShare) fields.tag = '1pv';

    RecordService.create(fields).then(function(rec) {
      saving = false;
      if (doShare) {
        App.showShare(rec);
        return;
      }
      App.showView(rec);
    }).catch(function() {
      saving = false;
    });
  }

  function onShow(opts) {
    opts = opts || {};
    returnTo = opts.returnTo || 'list';
    step = 0;
    outcomeText = opts.job || '';
    selectedWorker = null;
    contactFocus = 0;
    choiceFocus = 0;
    saving = false;
    loadContacts().then(function() {
      renderStep0();
    });
  }

  function goBack() {
    if (step === 0) {
      if (App.goBack && App.goBack()) return;
      if (returnTo === 'home') App.showHome();
      else App.showList();
      return;
    }
    if (step === 1) { renderStep0(); return; }
    if (step === 2) { renderStep1(); return; }
  }

  function advance() {
    if (step === 0) {
      var ta = document.getElementById('io-outcome');
      if (ta) outcomeText = ta.value;
      if (!outcomeText.trim()) return;
      renderStep1();
      return;
    }
    if (step === 1) {
      if (!contacts.length || contactFocus >= contacts.length) selectedWorker = null;
      else selectedWorker = contacts[contactFocus];
      renderStep2();
      return;
    }
    finishCreate(choiceFocus === 1);
  }

  function onKey(key) {
    if (step === 0) {
      switch (key) {
        case 'SoftLeft':
        case 'Backspace':
          goBack();
          break;
        case 'Enter':
        case 'SoftRight':
          advance();
          break;
      }
      return;
    }
    if (step === 1) {
      switch (key) {
        case 'ArrowUp':
          if (contactFocus > 0) { contactFocus--; renderStep1(); }
          break;
        case 'ArrowDown':
          if (contactFocus < contacts.length) { contactFocus++; renderStep1(); }
          break;
        case 'Enter':
          if (contactFocus >= contacts.length) selectedWorker = null;
          else selectedWorker = contacts[contactFocus];
          renderStep2();
          break;
        case 'SoftLeft':
        case 'Backspace':
          renderStep0();
          break;
        case 'SoftRight':
          advance();
          break;
      }
      return;
    }
    if (step === 2) {
      switch (key) {
        case 'ArrowUp':
          choiceFocus = 0;
          renderStep2();
          break;
        case 'ArrowDown':
          choiceFocus = 1;
          renderStep2();
          break;
        case 'SoftRight':
          choiceFocus = choiceFocus === 0 ? 1 : 0;
          setSoftkeys();
          renderStep2();
          break;
        case 'Enter':
          finishCreate(choiceFocus === 1);
          break;
        case 'SoftLeft':
        case 'Backspace':
          renderStep1();
          break;
      }
    }
  }

  function onCsk() {
    advance();
  }

  function init() {
    el.content = document.getElementById('io-create-content');
    el.title = document.getElementById('io-create-title');
    el.lsk = document.querySelector('#screen-io-create .sk-lsk');
    el.rsk = document.querySelector('#screen-io-create .sk-rsk');
    el.csk = document.getElementById('io-create-csk');
  }

  global.IOCreateScreen = {
    onShow: onShow,
    onKey: onKey,
    onCsk: onCsk,
    init: init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));
