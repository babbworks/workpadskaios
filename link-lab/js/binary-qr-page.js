(function() {
  'use strict';

  var LC = window.WPLabCommon;
  var BQ = window.WPBinaryQr;

  function $(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', function() {
    if (!BQ) {
      $('status').innerHTML = '<div class="status-err">WPBinaryQr not loaded</div>';
      return;
    }

    $('btn-pack').onclick = function() {
      try {
        var frag = LC.normalizeHash($('frag').value);
        if (!frag) throw new Error('Enter 1pa/ or 1pv/ fragment');
        var bq1 = BQ.encodeBq1Hash(frag);
        $('status').innerHTML = '<div class="status-ok">Packed ' + (BQ.packFromHash(frag).length) + ' bytes</div>';
        $('out').innerHTML = '<div class="card"><pre style="word-break:break-all;font-size:10px;">' +
          LC.esc(bq1) + '</pre></div>';
        $('bq1').value = bq1;
      } catch (e) {
        $('status').innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      }
    };

    $('btn-open').onclick = function() {
      try {
        var h = LC.normalizeHash($('bq1').value);
        if (!BQ.isBq1Hash(h)) throw new Error('Not a bq1/ hash');
        var inner = BQ.decodeBq1Hash(h);
        if (!inner) throw new Error('Decode failed');
        $('status').innerHTML = '<div class="status-ok">Inner: ' + LC.esc(inner.slice(0, 48)) + '…</div>';
        var base = LC.getLinkBase();
        window.location.href = base + (base.indexOf('#') >= 0 ? '' : '#') + inner;
      } catch (e) {
        $('status').innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      }
    };
  });
})();
