// Screen: Need / Offer / Connection record create (IO C7–C8)
// Exposes: window.IORecordScreen

(function(global) {
  'use strict';

  var el = { content: null, csk: null, lsk: null, title: null };
  var recordType = 'need';
  var returnTo = 'list';
  var step = 0;
  var fields = {};
  var contacts = [];
  var contactFocus = 0;
  var choiceFocus = 0;
  var saving = false;
  var gatekeeperType = 'light_ack';

  function labelForType(rt) {
    if (global.IOLabels) {
      if (rt === 'need') return IOLabels.needLabel();
      if (rt === 'offer') return IOLabels.offerLabel();
      if (rt === 'connection') return IOLabels.connectionLabel();
    }
    return rt.charAt(0).toUpperCase() + rt.slice(1);
  }

  function loadContacts() {
    return RecordService.list().then(function(recs) {
      contacts = recs.filter(function(r) {
        return (r.record_type || r.recordType) === 'contact' && !r.parentId;
      });
      contacts.sort(function(a, b) {
        return (a.customer || a.job || '').toLowerCase().localeCompare((b.customer || b.job || '').toLowerCase());
      });
    });
  }

  function setSoftkeys() {
    if (el.lsk) el.lsk.textContent = 'Back';
    if (el.csk) {
      el.csk.textContent = step === 2 ? 'Save' : (step === 0 ? 'Next' : 'Next');
    }
  }

  function renderNeedStep0() {
    var src = fields.input_source || 'unsourced';
    el.content.innerHTML =
      '<div class="io-create-hdr">' + esc(labelForType('need')) + ' stated</div>' +
      '<div class="field-group field-focused">' +
        '<div class="field-label">What is needed?</div>' +
        '<textarea class="field-input" id="io-need-text" rows="4">' + esc(fields.job || '') + '</textarea>' +
      '</div>' +
      '<div class="field-group">' +
        '<div class="field-label">Input source</div>' +
        '<select class="field-input" id="io-need-src">' +
          '<option value="unsourced"' + (src === 'unsourced' ? ' selected' : '') + '>' +
            esc(global.IOLabels ? IOLabels.unsourcedInputsLabel() : 'Unsourced Inputs') +
          '</option>' +
          '<option value="sourced"' + (src === 'sourced' ? ' selected' : '') + '>' +
            esc(global.IOLabels ? IOLabels.sourcedInputsLabel() : 'Sourced Inputs') +
          '</option>' +
        '</select>' +
      '</div>' +
      '<div class="field-group">' +
        '<div class="field-label">Labour — headcount</div>' +
        '<input class="field-input" id="io-labour-count" type="number" min="0" value="' + esc(fields.labour_count || '') + '">' +
      '</div>' +
      '<div class="field-group">' +
        '<div class="field-label">Labour — role (if known)</div>' +
        '<input class="field-input" id="io-labour-role" value="' + esc(fields.labour_role || '') + '">' +
      '</div>';
    bindNeedInputs();
  }

  function bindNeedInputs() {
    var ta = document.getElementById('io-need-text');
    var src = document.getElementById('io-need-src');
    var cnt = document.getElementById('io-labour-count');
    var role = document.getElementById('io-labour-role');
    if (ta) ta.addEventListener('input', function() { fields.job = ta.value; });
    if (src) src.addEventListener('change', function() { fields.input_source = src.value; });
    if (cnt) cnt.addEventListener('input', function() { fields.labour_count = cnt.value; });
    if (role) role.addEventListener('input', function() { fields.labour_role = role.value; });
  }

  function renderOfferStep0() {
    el.content.innerHTML =
      '<div class="io-create-hdr">' + esc(labelForType('offer')) + '</div>' +
      '<div class="field-group field-focused">' +
        '<div class="field-label">What can you offer?</div>' +
        '<textarea class="field-input" id="io-offer-text" rows="4">' + esc(fields.job || '') + '</textarea>' +
      '</div>' +
      '<div class="io-create-hint">Offers bind resources — not a viewer relay.</div>';
    var ta = document.getElementById('io-offer-text');
    if (ta) ta.addEventListener('input', function() { fields.job = ta.value; });
  }

  function renderConnectionStep0() {
    el.content.innerHTML =
      '<div class="io-create-hdr">Bridge — point toward someone</div>' +
      '<div class="field-group field-focused">' +
        '<div class="field-label">Connection title</div>' +
        '<input class="field-input" id="io-conn-title" value="' + esc(fields.job || '') + '">' +
      '</div>' +
      '<div class="field-group">' +
        '<div class="field-label">Point toward (name)</div>' +
        '<input class="field-input" id="io-relay-to" value="' + esc(fields.relay_to || '') + '">' +
      '</div>' +
      '<div class="field-group">' +
        '<div class="field-label">Relay note</div>' +
        '<textarea class="field-input" id="io-relay-note" rows="3">' + esc(fields.relay_note || '') + '</textarea>' +
      '</div>' +
      '<div class="field-group">' +
        '<div class="field-label">Gatekeeper policy</div>' +
        '<select class="field-input" id="io-gate-type">' +
          '<option value="light_ack"' + (gatekeeperType === 'light_ack' ? ' selected' : '') + '>Light ack on share</option>' +
          '<option value="relay_note"' + (gatekeeperType === 'relay_note' ? ' selected' : '') + '>Relay note only</option>' +
          '<option value="sale_confirmed"' + (gatekeeperType === 'sale_confirmed' ? ' selected' : '') + '>Await sale confirmed</option>' +
        '</select>' +
      '</div>' +
      '<div class="io-create-hint" id="io-gate-hint"></div>' +
      '<div class="io-create-hint">Bridge only — create an Offer from this connection in view after save.</div>';
    var t = document.getElementById('io-conn-title');
    var r = document.getElementById('io-relay-to');
    var n = document.getElementById('io-relay-note');
    if (t) t.addEventListener('input', function() { fields.job = t.value; });
    if (r) r.addEventListener('input', function() { fields.relay_to = r.value; });
    if (n) n.addEventListener('input', function() { fields.relay_note = n.value; });
    var gSel = document.getElementById('io-gate-type');
    var gHint = document.getElementById('io-gate-hint');
    function syncGateHint() {
      if (gHint && global.WPNocGatekeeper) {
        gHint.textContent = WPNocGatekeeper.policyHint(gatekeeperType);
      }
    }
    syncGateHint();
    if (gSel) {
      gSel.addEventListener('change', function() {
        gatekeeperType = gSel.value;
        syncGateHint();
      });
    }
  }

  function renderContactStep() {
    step = 1;
    setSoftkeys();
    var rows = '';
    if (!contacts.length) {
      rows = '<div class="type-picker-row focused" data-ci="skip"><span class="type-picker-label">Continue</span></div>';
    } else {
      for (var i = 0; i < contacts.length; i++) {
        var c = contacts[i];
        rows += '<div class="type-picker-row' + (contactFocus === i ? ' focused' : '') + '" data-ci="' + i + '">' +
          '<span class="type-picker-label">' + esc(c.customer || c.job || '(contact)') + '</span></div>';
      }
      rows += '<div class="type-picker-row' + (contactFocus === contacts.length ? ' focused' : '') + '" data-ci="skip">' +
        '<span class="type-picker-label">No link</span></div>';
    }
    el.content.innerHTML = '<div class="io-create-hdr">Link contact (optional)</div>' + rows;
    var rowEls = el.content.querySelectorAll('[data-ci]');
    for (var j = 0; j < rowEls.length; j++) {
      rowEls[j].addEventListener('click', (function(ci) {
        return function() {
          if (ci === 'skip') fields.linkedContactId = null;
          else {
            contactFocus = parseInt(ci, 10);
            fields.linkedContactId = contacts[contactFocus].id;
          }
          renderShareStep();
        };
      })(rowEls[j].getAttribute('data-ci')));
    }
  }

  function renderShareStep() {
    step = 2;
    setSoftkeys();
    if (el.title) el.title.textContent = 'Save or share';
    var linkName = '';
    if (fields.linkedContactId && contacts.length) {
      for (var i = 0; i < contacts.length; i++) {
        if (contacts[i].id === fields.linkedContactId) {
          linkName = contacts[i].customer || contacts[i].job || '';
          break;
        }
      }
    }
    el.content.innerHTML =
      '<div class="io-create-summary">' +
        '<div class="io-sum-line"><span class="io-sum-k">' + esc(labelForType(recordType)) + '</span> ' +
          esc(String(fields.job || '').trim().slice(0, 80)) +
          (String(fields.job || '').length > 80 ? '\u2026' : '') + '</div>' +
        (linkName ? '<div class="io-sum-line"><span class="io-sum-k">Link</span> ' + esc(linkName) + '</div>' : '') +
      '</div>' +
      '<div class="io-choice-row' + (choiceFocus === 0 ? ' focused' : '') + '" data-choice="0">' +
        '<span class="io-choice-title">Save draft</span>' +
        '<span class="io-choice-sub">Keep on device; share later</span>' +
      '</div>' +
      '<div class="io-choice-row' + (choiceFocus === 1 ? ' focused' : '') + '" data-choice="1">' +
        '<span class="io-choice-title">Share now</span>' +
        '<span class="io-choice-sub">Save and open share (#1pv)</span>' +
      '</div>';
    var choices = el.content.querySelectorAll('[data-choice]');
    for (var k = 0; k < choices.length; k++) {
      choices[k].addEventListener('click', (function(ch) {
        return function() {
          choiceFocus = parseInt(ch, 10);
          saveRecord(choiceFocus === 1);
        };
      })(choices[k].getAttribute('data-choice')));
    }
  }

  function readStep0() {
    if (recordType === 'need') bindNeedInputs();
    if (recordType === 'offer') {
      var ta = document.getElementById('io-offer-text');
      if (ta) fields.job = ta.value;
    }
    if (recordType === 'connection') {
      var t = document.getElementById('io-conn-title');
      if (t) fields.job = t.value;
    }
  }

  function saveRecord(doShare) {
    if (saving) return;
    if (!fields.job || !String(fields.job).trim()) return;
    saving = true;
    var payload = {
      record_type: recordType,
      job: String(fields.job).trim(),
      date: new Date().toISOString().slice(0, 10),
      draft: !doShare,
      relationship: 'creates',
      chain_mode: recordType === 'connection' ? 'INFORMATIONAL' : 'INITIATING',
    };
    if (recordType === 'need') {
      payload.input_source = fields.input_source || 'unsourced';
      if (fields.labour_count) payload.labour_count = fields.labour_count;
      if (fields.labour_role) payload.labour_role = fields.labour_role;
    }
    if (recordType === 'offer') {
      payload.relationship = 'creates';
    }
    if (recordType === 'connection' && global.WPNocGatekeeper) {
      WPNocGatekeeper.applyPolicyToRecord(payload, gatekeeperType);
      payload.relay_to = fields.relay_to || '';
      payload.relay_note = fields.relay_note || '';
      payload.relationship = 'responds';
    } else if (recordType === 'connection') {
      payload.relay_to = fields.relay_to || '';
      payload.relay_note = fields.relay_note || '';
      payload.pure_connection = true;
      payload.connection_ack = 'pending';
      payload.relationship = 'responds';
      payload.informational_ack = true;
    }
    if (fields.linkedContactId) payload.linkedContactId = fields.linkedContactId;
    if (doShare) payload.tag = '1pv';
    RecordService.create(payload).then(function(rec) {
      saving = false;
      if (recordType === 'connection' && global.SocialLedger) {
        SocialLedger.logEvent('relay_created', {
          connectionId: rec.id,
          contactId: rec.linkedContactId || fields.linkedContactId || null,
          ackRequired: !!rec.informational_ack,
          ackType: rec.gatekeeper_type || 'light_ack',
          note: rec.relay_note || '',
        });
      }
      if (doShare) {
        App.showShare(rec);
        return;
      }
      App.showView(rec);
    }).catch(function() { saving = false; });
  }

  function render() {
    setSoftkeys();
    if (el.title && step !== 2) el.title.textContent = 'New ' + labelForType(recordType);
    if (step === 0) {
      if (recordType === 'need') renderNeedStep0();
      else if (recordType === 'offer') renderOfferStep0();
      else renderConnectionStep0();
    } else if (step === 1) {
      renderContactStep();
    } else {
      renderShareStep();
    }
  }

  function goBack() {
    if (step === 0) {
      if (returnTo === 'list') App.showList();
      else if (App.goBack) App.goBack();
      return;
    }
    if (step === 2) {
      step = 1;
      renderContactStep();
      return;
    }
    step = 0;
    render();
  }

  function advance() {
    readStep0();
    if (!fields.job || !String(fields.job).trim()) return;
    if (step === 0) {
      renderContactStep();
      return;
    }
    if (step === 1) {
      if (!contacts.length || contactFocus >= contacts.length) fields.linkedContactId = null;
      else fields.linkedContactId = contacts[contactFocus].id;
      renderShareStep();
      return;
    }
    saveRecord(choiceFocus === 1);
  }

  function onShow(opts) {
    opts = opts || {};
    el.content = document.getElementById('io-record-content');
    el.csk = document.getElementById('io-record-csk');
    el.lsk = document.querySelector('#screen-io-record .sk-lsk');
    el.title = document.getElementById('io-record-title');
    recordType = opts.recordType || 'need';
    returnTo = opts.returnTo || 'list';
    step = 0;
    fields = { input_source: 'unsourced' };
    contactFocus = 0;
    choiceFocus = 0;
    saving = false;
    gatekeeperType = 'light_ack';
    loadContacts().then(render);
  }

  function onKey(key) {
    if (key === 'Backspace' || key === 'SoftLeft') {
      goBack();
      return;
    }
    if (key === 'Enter' || key === 'SoftRight') {
      advance();
      return;
    }
    if (step === 1 && contacts.length) {
      if (key === 'ArrowUp' && contactFocus > 0) { contactFocus--; renderContactStep(); }
      if (key === 'ArrowDown' && contactFocus < contacts.length) { contactFocus++; renderContactStep(); }
    }
    if (step === 2) {
      if (key === 'ArrowUp' && choiceFocus > 0) { choiceFocus = 0; renderShareStep(); }
      if (key === 'ArrowDown' && choiceFocus < 1) { choiceFocus = 1; renderShareStep(); }
    }
  }

  global.IORecordScreen = { onShow: onShow, onKey: onKey };

}(window));
