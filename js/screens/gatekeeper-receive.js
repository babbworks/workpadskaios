// Screen: Gatekeeper receive — NOC-06 light ack for connection relays
// Exposes: window.GatekeeperReceiveScreen

(function(global) {
  'use strict';

  var parentRecord = null;
  var returnTo = null;
  var focusIdx = 0;
  var confirmOpen = false;
  var busy = false;

  var CHOICES = [
    { id: 'light_ack', title: 'Send light acknowledgement', sub: 'Creates ack on chain and opens share' },
    { id: 'relay_ok', title: 'Relay noted (local only)', sub: 'Mark relay received — no wire ack' },
    { id: 'later', title: 'Not now', sub: 'Return to record view' },
  ];

  function setCsk(label) {
    var btn = document.getElementById('gatekeeper-receive-csk');
    if (btn) btn.textContent = label || '';
  }

  function render() {
    var el = document.getElementById('gatekeeper-receive-content');
    if (!el || !parentRecord) return;
    var GK = global.WPNocGatekeeper;

    if (confirmOpen) {
      el.innerHTML =
        '<div class="gk-confirm">' +
          '<div class="gk-confirm-title">Send light ack?</div>' +
          '<div class="gk-confirm-hint">Recipient sees informational acknowledgement — not a payment confirm.</div>' +
          '<div class="gk-confirm-row' + (focusIdx === 0 ? ' focused' : '') + '" data-gk-btn="0">Cancel</div>' +
          '<div class="gk-confirm-row' + (focusIdx === 1 ? ' focused' : '') + '" data-gk-btn="1">Send</div>' +
        '</div>';
      setCsk('Send');
      wireConfirm(el);
      return;
    }

    var gt = GK ? GK.getGateType(parentRecord) : 'light_ack';
    var html =
      '<div class="gk-intro">Connection relay — gatekeeper</div>' +
      '<div class="gk-card">' +
        '<div class="gk-card-title">' + esc(parentRecord.job || 'Connection') + '</div>' +
        (parentRecord.relay_to ? '<div class="gk-card-sub">Toward: ' + esc(parentRecord.relay_to) + '</div>' : '') +
        (parentRecord.relay_note ? '<div class="gk-card-note">' + esc(parentRecord.relay_note) + '</div>' : '') +
        '<div class="gk-card-sub">Policy: ' + esc(GK ? GK.policyLabel(gt) : 'Light ack') + '</div>' +
      '</div>';

    var i;
    for (i = 0; i < CHOICES.length; i++) {
      var c = CHOICES[i];
      html += '<div class="gk-choice' + (focusIdx === i ? ' focused' : '') + '" data-gk-choice="' + i + '">' +
        '<span class="gk-choice-title">' + esc(c.title) + '</span>' +
        '<span class="gk-choice-sub">' + esc(c.sub) + '</span></div>';
    }
    el.innerHTML = html;
    setCsk('Select');

    var rows = el.querySelectorAll('[data-gk-choice]');
    for (i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', (function(idx) {
        return function() {
          focusIdx = idx;
          selectChoice();
        };
      })(i));
    }
  }

  function wireConfirm(el) {
    var btns = el.querySelectorAll('[data-gk-btn]');
    var i;
    for (i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', (function(idx) {
        return function() {
          focusIdx = idx;
          if (idx === 0) { confirmOpen = false; focusIdx = 0; render(); }
          else doLightAck();
        };
      })(i));
    }
  }

  function selectChoice() {
    var id = CHOICES[focusIdx] ? CHOICES[focusIdx].id : 'later';
    if (id === 'light_ack') {
      confirmOpen = true;
      focusIdx = 1;
      render();
      return;
    }
    if (id === 'relay_ok' && global.WPNocGatekeeper) {
      WPNocGatekeeper.confirmRelayLocal(parentRecord).then(function(updated) {
        if (global.SocialLedger) {
          SocialLedger.logEvent('relay_noted_local', {
            ackType: 'relay_note',
            connectionId: parentRecord.id,
            contactId: parentRecord.linkedContactId || null,
            confirmed: true,
          });
          SocialLedger.resolvePendingForConnection(parentRecord.id);
        }
        App.showView(updated || parentRecord);
      });
      return;
    }
    App.showView(parentRecord);
  }

  function doLightAck() {
    if (busy || !global.WPNocGatekeeper) return;
    busy = true;
    WPNocGatekeeper.createLightAckRecord(parentRecord).then(function(ackRec) {
      busy = false;
      confirmOpen = false;
      if (global.SocialLedger) {
        SocialLedger.logEvent('light_ack_sent', {
          ackType: 'light_ack',
          connectionId: parentRecord.id,
          contactId: parentRecord.linkedContactId || null,
          targetId: ackRec.id,
          confirmed: true,
        });
      }
      App.showShare(ackRec, { nfcScenario: 'ack_return' });
    }).catch(function(err) {
      busy = false;
      var el = document.getElementById('gatekeeper-receive-content');
      if (el) el.innerHTML = '<div class="gk-error">' + esc(err.message || String(err)) + '</div>';
    });
  }

  function goBack() {
    if (confirmOpen) {
      confirmOpen = false;
      focusIdx = 0;
      render();
      return;
    }
    if (returnTo === 'share' && parentRecord) {
      App.showShare(parentRecord);
      return;
    }
    if (parentRecord) App.showView(parentRecord);
    else App.showList();
  }

  function onShow(opts) {
    opts = opts || {};
    parentRecord = opts.parentRecord || opts.record || null;
    returnTo = opts.returnTo || null;
    confirmOpen = false;
    focusIdx = 0;
    busy = false;
    var crumb = document.getElementById('gatekeeper-receive-crumb-label');
    if (crumb) crumb.textContent = 'Gatekeeper';
    render();
  }

  function onKey(key) {
    if (confirmOpen) {
      if (key === 'Backspace') goBack();
      if (key === 'Enter' || key === 'SoftRight') {
        if (focusIdx === 1) doLightAck();
        else goBack();
      }
      if (key === 'ArrowUp') { focusIdx = Math.max(0, focusIdx - 1); render(); }
      if (key === 'ArrowDown') { focusIdx = Math.min(1, focusIdx + 1); render(); }
      return;
    }
    if (key === 'Backspace') goBack();
    if (key === 'ArrowUp' && focusIdx > 0) { focusIdx--; render(); }
    if (key === 'ArrowDown' && focusIdx < CHOICES.length - 1) { focusIdx++; render(); }
    if (key === 'Enter' || key === 'SoftRight') selectChoice();
  }

  global.GatekeeperReceiveScreen = { onShow: onShow, onKey: onKey };

}(window));
