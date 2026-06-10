// Screen: Action receive — CE-08 full-screen action confirmation
// Exposes: window.ActionReceiveScreen

(function(global) {
  'use strict';

  var parentRecord = null;
  var actions      = [];
  var toggles      = [];   // 'none' | 'accept' | 'decline'
  var focusIdx     = 0;
  var confirmOpen  = false;

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function setCsk(label) {
    var btn = document.getElementById('action-receive-csk');
    if (btn) btn.textContent = label || '';
  }

  function cycleToggle(idx) {
    var cur = toggles[idx] || 'none';
    if (cur === 'none') toggles[idx] = 'accept';
    else if (cur === 'accept') toggles[idx] = 'decline';
    else toggles[idx] = 'none';
  }

  function toggleLabel(t) {
    if (t === 'accept') return 'Accept';
    if (t === 'decline') return 'Decline';
    return '—';
  }

  function render() {
    var el = document.getElementById('action-receive-content');
    if (!el) return;

    if (confirmOpen) {
      el.innerHTML =
        '<div class="ar-confirm">' +
          '<div class="ar-confirm-title">Send acknowledgement?</div>' +
          '<div class="ar-confirm-hint">Creates an ack record on this chain and opens share.</div>' +
          '<div class="ar-confirm-row' + (focusIdx === 0 ? ' focused' : '') + '" data-ar-btn="0">Cancel</div>' +
          '<div class="ar-confirm-row' + (focusIdx === 1 ? ' focused' : '') + '" data-ar-btn="1">Confirm</div>' +
        '</div>';
      setCsk('Confirm');
      bindConfirmClicks(el);
      return;
    }

    var html = '<div class="ar-intro">Toggle each action: Accept / Decline. CSK = confirm.</div>';
    var i;
    for (i = 0; i < actions.length; i++) {
      var a = actions[i];
      var title = (a && a.title) ? a.title : ('Action ' + (i + 1));
      var notes = (a && a.notes) ? '<div class="ar-notes">' + esc(a.notes) + '</div>' : '';
      html += '<div class="ar-row' + (focusIdx === i ? ' focused' : '') + '" data-ar-idx="' + i + '">' +
        '<span class="ar-title">' + esc(title) + '</span>' +
        '<span class="ar-toggle ar-toggle-' + (toggles[i] || 'none') + '">' + esc(toggleLabel(toggles[i])) + '</span>' +
        notes +
      '</div>';
    }
    el.innerHTML = html;
    setCsk('Confirm');

    var rows = el.querySelectorAll('[data-ar-idx]');
    for (i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', (function(idx) {
        return function() {
          focusIdx = idx;
          cycleToggle(idx);
          render();
        };
      })(i));
    }
  }

  function bindConfirmClicks(el) {
    var btns = el.querySelectorAll('[data-ar-btn]');
    var i;
    for (i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', (function(idx) {
        return function() {
          focusIdx = idx;
          if (idx === 0) { confirmOpen = false; focusIdx = 0; render(); }
          else submitAck();
        };
      })(i));
    }
  }

  function submitAck() {
    if (!parentRecord || !global.WPChainExecution) return;
    WPChainExecution.createAckRecord(parentRecord, toggles).then(function(ackRec) {
      App.showShare(ackRec, { nfcScenario: 'ack_return' });
    }).catch(function(err) {
      var el = document.getElementById('action-receive-content');
      if (el) el.innerHTML = '<div class="ar-error">' + esc(err.message || String(err)) + '</div>';
    });
  }

  function goBack() {
    if (confirmOpen) {
      confirmOpen = false;
      focusIdx = 0;
      render();
      return;
    }
    if (parentRecord) App.showView(parentRecord);
    else App.showList();
  }

  function onShow(opts) {
    opts = opts || {};
    parentRecord = opts.parentRecord || opts.record || null;
    confirmOpen = false;
    focusIdx = 0;
    actions = global.WPChainExecution
      ? WPChainExecution.parseActionList(parentRecord)
      : [];
    toggles = [];
    var i;
    for (i = 0; i < actions.length; i++) toggles.push('none');

    var crumb = document.getElementById('action-receive-crumb-label');
    if (crumb) crumb.textContent = 'Confirm actions';

    var back = document.getElementById('action-receive-crumb-back');
    if (back) back.onclick = function() { goBack(); };

    var csk = document.getElementById('action-receive-csk');
    if (csk) csk.onclick = function() {
      confirmOpen = true;
      focusIdx = 1;
      render();
    };

    if (!actions.length) {
      var el = document.getElementById('action-receive-content');
      if (el) el.innerHTML = '<div class="ar-empty">No actions on this record.</div>';
      setCsk('');
      return;
    }
    render();
  }

  function onKey(key) {
    if (confirmOpen) {
      if (key === 'ArrowUp' && focusIdx > 0) { focusIdx--; render(); return; }
      if (key === 'ArrowDown' && focusIdx < 1) { focusIdx++; render(); return; }
      if (key === 'Enter') {
        if (focusIdx === 0) { confirmOpen = false; focusIdx = 0; render(); }
        else submitAck();
        return;
      }
      if (key === 'Backspace') { goBack(); return; }
      return;
    }

    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) { focusIdx--; render(); }
        break;
      case 'ArrowDown':
        if (focusIdx < actions.length - 1) { focusIdx++; render(); }
        break;
      case 'Enter':
        if (focusIdx >= 0 && focusIdx < actions.length) {
          cycleToggle(focusIdx);
          render();
        }
        break;
      case 'SoftRight':
      case '5':
        confirmOpen = true;
        focusIdx = 1;
        render();
        break;
      case 'Backspace':
        goBack();
        break;
    }
  }

  global.ActionReceiveScreen = {
    onShow: onShow,
    onKey:  onKey,
  };

}(window));
