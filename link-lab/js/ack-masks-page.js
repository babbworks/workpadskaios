(function() {
  'use strict';

  var LC = window.WPLabCommon;
  var parent = null;
  var actions = [];
  var toggles = [];
  var lastHash = '';

  function $(id) { return document.getElementById(id); }

  function maskBits(toggles) {
    var confirmed = 0;
    var declined = 0;
    var i;
    for (i = 0; i < toggles.length; i++) {
      if (toggles[i] === 'accept') confirmed |= (1 << i);
      if (toggles[i] === 'decline') declined |= (1 << i);
    }
    return { confirmed_mask: confirmed, declined_mask: declined };
  }

  function renderToggles() {
    var el = $('toggles');
    var html = '';
    var i;
    for (i = 0; i < actions.length; i++) {
      var t = toggles[i] || 'none';
      html += '<div class="lab-toggle-row">' +
        '<span>' + LC.esc(actions[i].title) + '</span> ' +
        '<button type="button" data-idx="' + i + '">' + LC.esc(t) + '</button></div>';
    }
    el.innerHTML = html || '<p class="hint">No actions</p>';
    var btns = el.querySelectorAll('button[data-idx]');
    for (i = 0; i < btns.length; i++) {
      btns[i].onclick = (function(idx) {
        return function() {
          var cur = toggles[idx] || 'none';
          toggles[idx] = cur === 'none' ? 'accept' : (cur === 'accept' ? 'decline' : 'none');
          renderToggles();
        };
      })(parseInt(btns[i].getAttribute('data-idx'), 10));
    }
  }

  function encodeAck() {
    if (!window.WPChainExecution) throw new Error('WPChainExecution missing');
    var masks = maskBits(toggles);
    var ack = {
      job: 'Lab ack',
      customer: parent.customer || 'Acme',
      record_type: 'ack',
      date: '2026-05-24',
      relationship: 'acknowledges',
      confirmed_mask: masks.confirmed_mask,
      declined_mask: masks.declined_mask,
      chainRef: parent.chainRef || 'LABACK01'
    };
    var url = window.WPCodec.encode(ack, {
      padsV2: true,
      chain: true,
      chainRef: ack.chainRef
    });
    lastHash = url.indexOf('#') >= 0 ? url.slice(url.indexOf('#') + 1) : url;
    $('paste').value = lastHash;
    $('status').innerHTML = '<div class="status-ok">Encoded — paste field filled</div>';
    $('out').innerHTML =
      '<div class="card"><h2>Expected masks</h2><table class="field-grid"><tbody>' +
      '<tr><th>confirmed</th><td>0x' + masks.confirmed_mask.toString(16) + ' (' + masks.confirmed_mask + ')</td></tr>' +
      '<tr><th>declined</th><td>0x' + masks.declined_mask.toString(16) + ' (' + masks.declined_mask + ')</td></tr>' +
      '</tbody></table><input type="text" readonly value="' + LC.esc(lastHash) + '"></div>';
  }

  function verify() {
    var hash = LC.normalizeHash($('paste').value);
    var dec = window.WPCodec.decode(LC.canonicalUrl(hash));
    var expect = maskBits(toggles);
    var ok = dec.relationship === 'acknowledges' &&
      dec.confirmed_mask === expect.confirmed_mask &&
      dec.declined_mask === expect.declined_mask;
    $('status').innerHTML = '<div class="' + (ok ? 'status-ok' : 'status-err') + '">' +
      (ok ? 'Masks match toggles' : 'Mask mismatch') + '</div>';
    $('out').innerHTML = '<div class="card"><h2>Decoded</h2><pre class="json">' +
      LC.esc(JSON.stringify({
        relationship: dec.relationship,
        confirmed_mask: dec.confirmed_mask,
        declined_mask: dec.declined_mask
      }, null, 2)) + '</pre></div>';
  }

  document.addEventListener('DOMContentLoaded', function() {
    fetch('fixtures/scenarios.json')
      .then(function(r) { return r.json(); })
      .then(function(s) {
        parent = s.ack_parent;
        actions = window.WPChainExecution.parseActionList(parent);
        toggles = [];
        var i;
        for (i = 0; i < actions.length; i++) toggles.push('none');
        if (s.ack_toggles) {
          for (i = 0; i < s.ack_toggles.length && i < toggles.length; i++) {
            toggles[i] = s.ack_toggles[i] ? 'accept' : 'none';
          }
        }
        renderToggles();
      })
      .catch(function(e) {
        $('status').innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      });

    $('btn-encode').onclick = function() {
      try { encodeAck(); } catch (e) {
        $('status').innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      }
    };
    $('btn-verify').onclick = verify;
  });
})();
