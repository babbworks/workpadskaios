(function() {
  'use strict';

  var LC = window.WPLabCommon;
  var SAMPLE = {
    job: 'River Cafe — menu board',
    customer: 'River Cafe',
    date: '2026-05-24',
    record_type: 'note',
    details: 'Scan to book or enquire'
  };

  var INSTALL_SAMPLE = {
    id: 'svc-basic',
    name: 'Basic service template',
    version: 1,
    fields: ['job', 'customer', 'date']
  };

  function $(id) { return document.getElementById(id); }

  function toBase64Url(bytes) {
    var s = '';
    var i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function utf8(s) {
    return new TextEncoder().encode(s);
  }

  function runMode(mode) {
    var errEl = $('err');
    var outEl = $('out');
    errEl.innerHTML = '';
    outEl.innerHTML = '';
    try {
      var record = JSON.parse($('json').value);
      var v = window.WPCodec.validate(record);
      if (!v.valid) throw new Error(v.errors.join('; '));

      var url;
      var note = '';

      if (mode === 'install') {
        var payload = toBase64Url(utf8(JSON.stringify(INSTALL_SAMPLE)));
        url = 'workpads.me/p#t/' + payload;
        note = 'Template install route — opens TemplateRegistry in app.';
      } else {
        var ds = { displayType: 0, dataSource: 1, showPrice: false, showContact: true };
        var fs = null;
        if (mode === 'billboard') {
          ds.displayType = 1;
          ds.dataSource = 1;
        } else if (mode === 'form') {
          ds.displayType = 2;
          ds.dataSource = 1;
          fs = { submitAction: 3, requireName: true, requirePhone: false, allowEdit: false };
        } else if (mode === '1dt') {
          ds.displayType = 1;
          ds.dataSource = 1;
        }
        url = window.WPCodec.encode(record, {
          presentationTag: '1pb',
          displaySchema: ds,
          formSchema: fs
        });
        if (mode === '1dt') {
          url = url.replace('#1pb/', '#1dt/');
          note = '1dt/ uses 1pb presentation frame until dedicated template-QR body ships (see TEMPLATE-QR-SPEC).';
        }
      }

      var base = LC.getLinkBase();
      var hash = url.indexOf('#') >= 0 ? url.slice(url.indexOf('#') + 1) : url;
      var local = base + (base.indexOf('#') >= 0 ? '' : '#') + hash;

      outEl.innerHTML =
        '<div class="card"><h2>Result</h2>' +
        (note ? '<p class="hint">' + LC.esc(note) + '</p>' : '') +
        '<input type="text" readonly value="' + LC.esc(local) + '">' +
        '<div class="btn-row">' +
        '<button type="button" class="primary" id="btn-open">Open in shell</button>' +
        '<button type="button" id="btn-rt">Round-trip</button>' +
        '</div></div>';

      $('btn-open').addEventListener('click', function() { window.location.href = local; });
      $('btn-rt').addEventListener('click', function() {
        window.location.href = 'round-trip.html#' + hash;
      });
    } catch (e) {
      errEl.innerHTML = '<div class="status-err">' + LC.esc(e.message || String(e)) + '</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    $('json').value = JSON.stringify(SAMPLE, null, 2);
    var btns = document.querySelectorAll('[data-mode]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', (function(m) {
        return function() { runMode(m); };
      })(btns[i].getAttribute('data-mode')));
    }
  });
})();
