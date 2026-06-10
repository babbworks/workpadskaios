(function() {
  'use strict';

  var LC = window.WPLabCommon;
  var SAMPLE = {
    job: 'Boiler service annual inspection and parts replacement',
    customer: 'River Cafe Ltd',
    record_type: 'invoice',
    date: '2026-05-24',
    amount: '240.00',
    currency: 'GBP'
  };

  function $(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', function() {
    $('json').value = JSON.stringify(SAMPLE, null, 2);

    $('btn-run').onclick = function() {
      var out = $('out');
      var status = $('status');
      try {
        var record = JSON.parse($('json').value);
        if (!window.WPCompressionMetrics) throw new Error('WPCompressionMetrics not loaded');
        if ($('rel').checked && window.WPSymbolTable) {
          WPSymbolTable.addEntry('lab-rel', { tokenId: 42, label: record.customer || 'River' });
        }
        var m = WPCompressionMetrics.compareExchangeSizes(record);
        var standalone = WPCompressionMetrics.deflateInnerBytes(record, { padsV2: true });
        status.innerHTML = '<div class="status-ok">Metrics computed</div>';
        out.innerHTML =
          '<div class="card"><h2>Deflate bytes (inner)</h2><table class="field-grid"><tbody>' +
          '<tr><th>1st exchange (verbose)</th><td>' + m.first.deflate + '</td></tr>' +
          '<tr><th>10th (simulated)</th><td>' + m.tenth.deflate + '</td></tr>' +
          '<tr><th>Standalone #1pv</th><td>' + standalone + '</td></tr>' +
          '<tr><th>Reduction</th><td>' + m.reductionPct + '% (target 50%)</td></tr>' +
          '</tbody></table></div>';
      } catch (e) {
        status.innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      }
    };

    $('btn-encode').onclick = function() {
      try {
        var record = JSON.parse($('json').value);
        var opts = { padsV2: true };
        if ($('rel').checked) {
          opts.relationalMode = true;
          opts.profileId = 1;
          opts.chainRef24 = 0x42;
          opts.counterpartyKey = 'lab-rel';
          if (window.WPSymbolTable) {
            WPSymbolTable.addEntry('lab-rel', { tokenId: 42, label: String(record.customer || '').slice(0, 63) });
          }
        }
        var url = window.WPCodec.encode(record, opts);
        var hash = url.indexOf('#') >= 0 ? url.slice(url.indexOf('#') + 1) : url;
        $('out').innerHTML = '<div class="card"><h2>URL</h2><input type="text" readonly value="' +
          LC.esc(hash) + '"><div class="btn-row"><a class="btn" href="round-trip.html#' + LC.esc(hash) + '">Round-trip</a></div></div>';
        $('status').innerHTML = '<div class="status-ok">Encoded</div>';
      } catch (e) {
        $('status').innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      }
    };
  });
})();
