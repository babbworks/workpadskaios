(function() {
  'use strict';

  var LC = window.WPLabCommon;
  var DIFF_KEYS = [
    'job', 'customer', 'worker', 'record_type', 'date', 'amount', 'currency',
    'relationship', 'chain_mode', 'confirmed_mask', 'declined_mask',
    'profile_id', 'relational_mode', 'chain_seq_compact'
  ];

  function $(id) { return document.getElementById(id); }

  function formatVal(v) {
    if (v == null) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function pickFields(rec) {
    var out = {};
    var i;
    for (i = 0; i < DIFF_KEYS.length; i++) {
      var k = DIFF_KEYS[i];
      if (rec[k] !== undefined && rec[k] !== null && rec[k] !== '') out[k] = rec[k];
    }
    if (rec._pathc) out._pathc_recordType = rec._pathc.recordType;
    if (rec._displaySchema) out._displaySchema = rec._displaySchema;
    return out;
  }

  function diffObjects(a, b) {
    var rows = [];
    var keys = {};
    var k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) keys[k] = true;
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) keys[k] = true;
    for (k in keys) {
      var va = formatVal(a[k]);
      var vb = formatVal(b[k]);
      if (va !== vb) rows.push({ key: k, a: va, b: vb });
    }
    return rows;
  }

  function encodeOptsForTag(tag, record) {
    if (tag === '1pv') return { padsV2: true };
    if (tag === '1pb' || tag === '1dt') {
      var opts = { presentationTag: '1pb' };
      if (record._displaySchema) opts.displaySchema = record._displaySchema;
      if (record.formSchema) opts.formSchema = record.formSchema;
      return opts;
    }
    return {};
  }

  function encodeWithTag(record, tag) {
    var url = window.WPCodec.encode(record, encodeOptsForTag(tag, record));
    if (tag === '1dt') url = url.replace('#1pb/', '#1dt/');
    return url;
  }

  function run() {
    var statusEl = $('status');
    var bodyEl = $('body');
    statusEl.innerHTML = '';
    bodyEl.innerHTML = '';
    try {
      var hash = LC.normalizeHash($('paste').value);
      if (!hash) throw new Error('Paste a fragment first.');
      var tag1 = LC.detectTag(hash);
      if (!tag1) throw new Error('Unknown tag on fragment.');
      if (tag1 === 't' || tag1 === '1pm') {
        throw new Error('Round-trip applies to record tags (1pa/1pb/1pv/1dt), not ' + tag1);
      }

      var dec1 = window.WPCodec.decode(LC.canonicalUrl(hash));
      var reTag = ($('re-tag') && $('re-tag').value) || tag1;
      var url2 = encodeWithTag(dec1, reTag);
      var hash2 = url2.indexOf('#') >= 0 ? url2.slice(url2.indexOf('#') + 1) : url2;
      var dec2 = window.WPCodec.decode(url2);

      var p1 = pickFields(dec1);
      var p2 = pickFields(dec2);
      var diffs = diffObjects(p1, p2);
      var ok = diffs.length === 0;

      statusEl.innerHTML = '<div class="' + (ok ? 'status-ok' : 'status-err') + '">' +
        (ok ? 'Round-trip OK — tracked fields match.' : diffs.length + ' field difference(s).') +
        '</div>';

      var diffRows = '';
      if (diffs.length) {
        diffRows = '<table class="field-grid"><thead><tr><th>Field</th><th>Decode 1</th><th>Decode 2</th></tr></thead><tbody>';
        diffs.forEach(function(d) {
          diffRows += '<tr><th>' + LC.esc(d.key) + '</th><td>' + LC.esc(d.a) + '</td><td>' + LC.esc(d.b) + '</td></tr>';
        });
        diffRows += '</tbody></table>';
      } else {
        diffRows = '<p class="hint">No differences on tracked scalar fields.</p>';
      }

      bodyEl.innerHTML =
        '<div class="card"><h2>Pass</h2>' +
        '<table class="field-grid"><tbody>' +
        '<tr><th>Tag in</th><td>' + LC.esc(tag1) + '</td></tr>' +
        '<tr><th>Re-encode</th><td>' + LC.esc(reTag) + '</td></tr>' +
        '<tr><th>URL length</th><td>' + hash.length + ' → ' + hash2.length + ' chars (fragment)</td></tr>' +
        '</tbody></table></div>' +
        '<div class="card"><h2>Field diff</h2>' + diffRows + '</div>' +
        '<div class="card"><h2>Decode 1 JSON</h2><pre class="json">' + LC.esc(JSON.stringify(dec1, null, 2)) + '</pre></div>' +
        '<div class="card"><h2>Decode 2 JSON</h2><pre class="json">' + LC.esc(JSON.stringify(dec2, null, 2)) + '</pre></div>';
    } catch (e) {
      statusEl.innerHTML = '<div class="status-err">' + LC.esc(e.message || String(e)) + '</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    $('btn-run').addEventListener('click', run);
    if (location.hash && location.hash.length > 2) {
      $('paste').value = location.hash;
      run();
    }
  });
})();
