(function() {
  'use strict';

  var SAMPLE = {
    job: 'Boiler service — annual',
    customer: 'River Cafe',
    date: '2026-05-20',
    location: '12 High St',
    record_type: 'invoice',
    amount: '240.00',
    currency: 'GBP',
    details: 'Labour + parts as quoted'
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function getBase() {
    try {
      var b = localStorage.getItem('wp_link_base');
      if (b) return b.replace(/\/$/, '');
    } catch (e) {}
    return 'http://localhost:8765/link-lab/p';
  }

  function init() {
    $('json').value = JSON.stringify(SAMPLE, null, 2);
    $('link-base').value = getBase();

    $('btn-encode').addEventListener('click', function() {
      var errEl = $('err');
      var outEl = $('out');
      errEl.innerHTML = '';
      outEl.innerHTML = '';
      try {
        var record = JSON.parse($('json').value);
        var tag = $('tag').value;
        var v = WPCodec.validate(record);
        if (!v.valid) throw new Error(v.errors.join('; '));
        var url;
        if (tag === '1pb') {
          url = WPCodec.encode(record, { presentationTag: '1pb' });
        } else if (tag === '1pv') {
          var encOpts = { padsV2: true };
          if ($('relational') && $('relational').checked) {
            encOpts.relationalMode = true;
            record.relational_mode = true;
            var prof = $('profile') && $('profile').value;
            if (prof) {
              record.profile_id = prof;
              encOpts.profileId = prof === 'service_work.v1' ? 1 : 0;
            }
            if (record.customer) {
              window.WPSymbolTable.addEntry('link-lab', {
                tokenId: 42,
                label: String(record.customer).slice(0, 63)
              });
              encOpts.counterpartyKey = 'link-lab';
            }
          }
          url = WPCodec.encode(record, encOpts);
        } else {
          url = WPCodec.encode(record, {});
        }
        var base = $('link-base').value.replace(/\/$/, '');
        var hash = url.indexOf('#') >= 0 ? url.slice(url.indexOf('#') + 1) : url.replace(/^workpads\.me\/p#/, '');
        var local = base + (base.indexOf('#') >= 0 ? '' : '#') + hash;
        try { localStorage.setItem('wp_link_base', base); } catch (e) {}

        var sizeNote = '';
        if (tag === '1pv' && window.WPCompressionMetrics) {
          try {
            var m = WPCompressionMetrics.compareExchangeSizes(record);
            sizeNote = '<p class="hint">Size harness: 1st deflate ' + m.first.deflate +
              ' B → simulated 10th ' + m.tenth.deflate + ' B (' + m.reductionPct + '% smaller)</p>';
          } catch (ignore) {}
        }

        outEl.innerHTML =
          '<div class="card"><h2>Local test URL</h2>' +
          sizeNote +
          '<input type="text" id="local-url" readonly value="' + esc(local) + '">' +
          '<div class="btn-row"><button type="button" class="primary" id="btn-open">Open in shell</button>' +
          '<button type="button" id="btn-copy-local">Copy</button></div></div>' +
          '<div class="card"><h2>Production-shaped</h2>' +
          '<input type="text" readonly value="' + esc('https://workpads.me/p#' + hash) + '"></div>';

        $('btn-open').addEventListener('click', function() { window.location.href = local; });
        $('btn-copy-local').addEventListener('click', function() {
          if (navigator.clipboard) navigator.clipboard.writeText($('local-url').value);
        });
      } catch (e) {
        errEl.innerHTML = '<div class="status-err">' + esc(e.message || String(e)) + '</div>';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
