(function() {
  'use strict';

  var LC = window.WPLabCommon;
  var PR = window.WPPrintRecord;

  document.addEventListener('DOMContentLoaded', function() {
    var ta = document.getElementById('json');
    ta.value = JSON.stringify({
      job: 'Fence install',
      customer: 'Acme',
      record_type: 'invoice',
      date: '2026-05-20',
      amount: '120',
      currency: 'GBP',
      programmable_rules: [{ op: 'when_paid' }],
      _programmablePlain: ['When payment is recorded on the chain'],
    }, null, 2);

    document.getElementById('btn-summary').onclick = function() {
      try {
        var rec = JSON.parse(ta.value);
        var text = PR.formatText(rec);
        var opts = PR.options().map(function(o) {
          return '<li><strong>' + LC.esc(o.label) + '</strong> — ' + LC.esc(o.hint) + '</li>';
        }).join('');
        document.getElementById('out').innerHTML =
          '<div class="card"><h2>Options</h2><ul>' + opts + '</ul></div>' +
          '<div class="card"><h2>Human summary</h2><pre>' + LC.esc(text) + '</pre></div>';
      } catch (e) {
        document.getElementById('out').innerHTML =
          '<div class="status-err">' + LC.esc(e.message) + '</div>';
      }
    };
  });
})();
