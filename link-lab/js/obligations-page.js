(function() {
  'use strict';

  var LC = window.WPLabCommon;
  var CE = window.WPChainExecution;
  var scenario = null;
  var invoice = null;
  var chain = [];
  var step = 0;

  function $(id) { return document.getElementById(id); }

  function setStep(n) {
    step = n;
    var lis = $('steps').querySelectorAll('li');
    for (var i = 0; i < lis.length; i++) {
      lis[i].className = i === n ? 'active' : (i < n ? 'done' : '');
    }
  }

  function obligationHtml(rec, all) {
    if (!CE) return '<p class="hint">WPChainExecution not loaded.</p>';
    var open = CE.hasOpenObligation(rec, all);
    var actions = CE.parseActionList(rec);
    var ackPending = rec.ackRequest && actions.length && !CE.hasAckForTarget(rec.id, all);
    return '<div class="' + (open ? 'status-err' : 'status-ok') + '" style="margin-bottom:10px">' +
      (open ? '◐ Open obligation' : '✓ No open obligation') +
      (ackPending ? ' · ack pending on actions' : '') +
      '</div>';
  }

  function render() {
    var body = $('body');
    var status = $('status');
    if (!scenario) {
      status.innerHTML = '<div class="status-err">Load scenarios.json failed</div>';
      return;
    }

    if (step === 0) {
      setStep(0);
      try {
        invoice = JSON.parse(JSON.stringify(scenario.obligation.invoice));
        invoice.id = 'lab-inv-1';
        var url = window.WPCodec.encode(invoice, { padsV2: true, chain: true, chainRef: invoice.chainRef });
        var dec = window.WPCodec.decode(url);
        invoice = dec;
        invoice.id = 'lab-inv-1';
        chain = [];
        status.innerHTML = '<div class="status-ok">Invoice encoded & decoded (#1pv)</div>';
        body.innerHTML =
          '<div class="card"><h2>Invoice</h2>' + obligationHtml(invoice, chain) +
          '<table class="field-grid"><tbody>' +
          '<tr><th>amount</th><td>' + LC.esc(invoice.amount) + '</td></tr>' +
          '<tr><th>actions</th><td>' + LC.esc((invoice.actions && invoice.actions.length) || 0) + '</td></tr>' +
          '</tbody></table>' +
          '<div class="btn-row"><button type="button" class="primary" id="btn-next">Next: partial payment</button></div></div>';
        $('btn-next').onclick = function() { step = 1; render(); };
      } catch (e) {
        status.innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      }
      return;
    }

    if (step === 1) {
      setStep(1);
      chain = [];
      status.innerHTML = '';
      body.innerHTML =
        '<div class="card"><h2>Chain empty</h2>' + obligationHtml(invoice, chain) +
        '<p class="hint">Same invoice, no payments in local chain store.</p>' +
        '<div class="btn-row">' +
        '<button type="button" id="btn-back">Back</button>' +
        '<button type="button" class="primary" id="btn-next">Add partial (£100)</button>' +
        '</div></div>';
      $('btn-back').onclick = function() { step = 0; render(); };
      $('btn-next').onclick = function() { step = 2; render(); };
      return;
    }

    if (step === 2) {
      setStep(2);
      var partial = JSON.parse(JSON.stringify(scenario.obligation.partial_payment));
      partial.id = 'lab-pay-1';
      partial.parentId = invoice.id;
      chain = [partial];
      status.innerHTML = '';
      body.innerHTML =
        '<div class="card"><h2>Partial payment on chain</h2>' + obligationHtml(invoice, chain) +
        '<table class="field-grid"><tbody><tr><th>paid</th><td>100 / 240</td></tr></tbody></table>' +
        '<div class="btn-row">' +
        '<button type="button" id="btn-back">Back</button>' +
        '<button type="button" class="primary" id="btn-next">Add full payment</button>' +
        '</div></div>';
      $('btn-back').onclick = function() { step = 1; render(); };
      $('btn-next').onclick = function() { step = 3; render(); };
      return;
    }

    if (step === 3) {
      setStep(3);
      var full = JSON.parse(JSON.stringify(scenario.obligation.full_payment));
      full.id = 'lab-pay-2';
      full.parentId = invoice.id;
      chain = [
        JSON.parse(JSON.stringify(scenario.obligation.partial_payment)),
        full
      ];
      chain[0].id = 'lab-pay-1';
      chain[1].id = 'lab-pay-2';
      chain[0].parentId = invoice.id;
      chain[1].parentId = invoice.id;
      body.innerHTML =
        '<div class="card"><h2>Paid in full</h2>' + obligationHtml(invoice, chain) +
        '<p class="hint">Matches list filter “Open obligations” = off for this chain.</p>' +
        '<div class="btn-row"><button type="button" id="btn-restart">Restart</button></div>';
      $('btn-restart').onclick = function() { step = 0; render(); };
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    fetch('fixtures/scenarios.json')
      .then(function(r) { return r.json(); })
      .then(function(j) { scenario = j; render(); })
      .catch(function(e) {
        $('status').innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      });
  });
})();
