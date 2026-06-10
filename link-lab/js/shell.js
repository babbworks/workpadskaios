/* Workpads Link Lab — decode shell (uses window.WPCodec + optional WPSecurity) */
(function() {
  'use strict';

  var TAG_LABELS = {
    '1pa': 'Plain record',
    '1pb': 'Public billboard',
    '1pf': 'Financial presentation',
    '1ps': 'Protected (scrambled)',
    '1pv': 'pads-v2 Path C',
    '1dt': 'Template QR (presentation frame)',
    '1pm': 'Marker lookup',
    '1eg': 'Legacy kaios',
    '1cg': 'Legacy compact',
    '1dg': 'Legacy dense'
  };

  function $(id) { return document.getElementById(id); }

  function getBase() {
    try {
      var b = localStorage.getItem('wp_link_base');
      if (b) return b.replace(/\/$/, '');
    } catch (e) {}
    return 'https://workpads.me/p';
  }

  function setBase(v) {
    try { localStorage.setItem('wp_link_base', v); } catch (e) {}
  }

  function detectTag(hash) {
    if (!hash) return null;
    if (hash.indexOf('1pm/') === 0) return '1pm';
    if (hash.indexOf('1pv/') === 0) return '1pv';
    if (hash.indexOf('1dt/') === 0) return '1dt';
    var m = hash.match(/^(1p[a-z]\/|1[a-z]g\/)/);
    if (m) return m[1].slice(0, 3);
    if (hash.indexOf('alg=bitpad') !== -1 || hash.indexOf('d=') !== -1) return 'bitpad-v1';
    return null;
  }

  /** Fragment body only: 1pa/… (&c= / &r= suffixes allowed). No leading #. */
  function normalizeHash(input) {
    input = (input || '').trim();
    if (!input) return '';
    var hi = input.indexOf('#');
    if (hi >= 0) input = input.slice(hi + 1);
    input = input.replace(/^#+/, '');
    /* bare payload pasted without tag — cannot decode */
    if (input.indexOf('/') < 0 && /^[A-Za-z0-9_-]+$/.test(input)) {
      throw new Error('Paste the full fragment including tag, e.g. #1pa/' + input.slice(0, 12) + '…');
    }
    return input;
  }

  function canonicalUrl(hash) {
    hash = normalizeHash(hash);
    var base = getBase();
    if (base.indexOf('#') >= 0) return base.split('#')[0] + '#' + hash;
    return base + '#' + hash;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function formatValue(v) {
    if (v == null) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function priorityFields(record) {
    var keys = ['job', 'customer', 'worker', 'record_type', 'date', 'location', 'amount',
      'currency', 'details', 'story', 'ref_number', 'record_status', 'tag'];
    var out = [];
    var seen = {};
    var k;
    for (k = 0; k < keys.length; k++) {
      if (record[keys[k]] != null && record[keys[k]] !== '') {
        out.push(keys[k]);
        seen[keys[k]] = true;
      }
    }
    var all = Object.keys(record).sort();
    for (k = 0; k < all.length; k++) {
      if (all[k][0] === '_') continue;
      if (!seen[all[k]]) out.push(all[k]);
    }
    return out;
  }

  function renderPathcPanel(record) {
    if (!record._pathc && !record.relational_mode && !record.profile_id && record._codec !== '1pv') {
      return '';
    }
    var rows = '';
    if (record._pathc) {
      rows += '<tr><th>Path C type</th><td>' + esc(record._pathc.recordType) + '</td></tr>';
      rows += '<tr><th>Path C path</th><td>' + esc(record._pathc.path) + '</td></tr>';
    }
    if (record.relational_mode) rows += '<tr><th>relational_mode</th><td>true</td></tr>';
    if (record.profile_id) rows += '<tr><th>profile_id</th><td>' + esc(record.profile_id) + '</td></tr>';
    if (record.chain_seq_compact != null) {
      rows += '<tr><th>chain_seq_compact</th><td>' + esc(record.chain_seq_compact) + '</td></tr>';
    }
    if (record._inline_table_entry) {
      rows += '<tr><th>inline symbol</th><td>' + esc(JSON.stringify(record._inline_table_entry)) + '</td></tr>';
    }
    if (record.relationship) rows += '<tr><th>relationship</th><td>' + esc(record.relationship) + '</td></tr>';
    if (!rows) return '';
    return '<div class="card"><h2>#1pv/ bridge</h2><table class="field-grid"><tbody>' + rows + '</tbody></table></div>';
  }

  function renderFinancial(record) {
    var parts = [];
    if (record.amount != null) parts.push('<dt>Amount</dt><dd>' + esc(record.amount) + (record.currency ? ' ' + esc(record.currency) : '') + '</dd>');
    if (record.expenses && record.expenses.length) {
      parts.push('<dt>Expenses</dt><dd>' + esc(JSON.stringify(record.expenses)) + '</dd>');
    }
    if (record.payments && record.payments.length) {
      parts.push('<dt>Payments</dt><dd>' + esc(JSON.stringify(record.payments)) + '</dd>');
    }
    if (record.line_items && record.line_items.length) {
      parts.push('<dt>Line items</dt><dd>' + esc(JSON.stringify(record.line_items)) + '</dd>');
    }
    if (!parts.length) return '';
    return '<dl class="fin-block">' + parts.join('') + '</dl>';
  }

  function renderRecord(record) {
    var fields = priorityFields(record);
    var rows = '';
    var i;
    for (i = 0; i < fields.length; i++) {
      rows += '<tr><th>' + esc(fields[i]) + '</th><td>' + esc(formatValue(record[fields[i]])) + '</td></tr>';
    }
    var meta = [];
    if (record._chainRef) meta.push('chainRef: ' + record._chainRef);
    if (record._ratifiedFrameRecord) meta.push('ratified frame attached');
    if (record._meta) meta.push('meta: ' + JSON.stringify(record._meta));
    if (record._presentation) meta.push('presentation decode');
    if (record._templateQr) meta.push('template QR (1dt)');

    return (
      renderPathcPanel(record) +
      '<div class="card"><h2>Record</h2>' +
      (record.job ? '<p style="font-size:1.15rem;font-weight:700;margin-bottom:10px">' + esc(record.job) + '</p>' : '') +
      '<table class="field-grid"><tbody>' + rows + '</tbody></table>' +
      renderFinancial(record) +
      (meta.length ? '<p class="hint">' + esc(meta.join(' · ')) + '</p>' : '') +
      '</div>' +
      '<div class="card"><h2>Decoded JSON</h2><pre class="json">' + esc(JSON.stringify(record, null, 2)) + '</pre></div>'
    );
  }

  function renderSpecial(obj) {
    if (obj._installTemplate) {
      return '<div class="status-ok">Template install route: <code>#t/' + esc(obj._installTemplate) + '</code></div>';
    }
    if (obj._markerUid) {
      return '<div class="status-ok">Marker UID: <code>' + esc(obj._markerUid) + '</code> (lookup not implemented in lab)</div>';
    }
    return renderRecord(obj);
  }

  function decodeHash(hash, passphrase) {
    hash = normalizeHash(hash);
    if (!hash) throw new Error('No fragment on URL. Expected #1pa/… or paste full workpads link.');

    var tag = detectTag(hash);
    if (tag === '1ps') {
      if (!window.WPSecurity) throw new Error('#1ps/ requires security.js — reload page.');
      if (!passphrase) throw new Error('Enter passphrase for protected (#1ps/) links.');
      return WPSecurity.secureDecode(canonicalUrl(hash), { passphrase: passphrase });
    }

    if (!window.WPCodec) throw new Error('WPCodec not loaded.');
    /* WPCodec.decode accepts #1pa/… or full URL with single # */
    return WPCodec.decode(canonicalUrl(hash));
  }

  function run(passphrase) {
    var hash = location.hash ? location.hash.slice(1) : '';
    var q = new URLSearchParams(location.search);
    if (!hash && q.get('hash')) hash = q.get('hash');
    if (!hash && q.get('url')) hash = q.get('url');
    try {
      hash = hash ? normalizeHash(hash) : '';
    } catch (e) {
      $('status').innerHTML = '<div class="status-err">' + esc(e.message) + '</div>';
      return;
    }

    var tagEl = $('tag');
    var statusEl = $('status');
    var bodyEl = $('body');

    if (!hash) {
      tagEl.textContent = '—';
      statusEl.className = 'card';
      statusEl.innerHTML = '<p class="hint">Paste a link above or open <code>/p/#1pa/…</code></p>';
      bodyEl.innerHTML = '';
      return;
    }

    var tag = detectTag(hash);
    tagEl.textContent = tag || '?';
    $('tag-label').textContent = TAG_LABELS[tag] || 'Fragment';

    try {
      var record = decodeHash(hash, passphrase);
      statusEl.innerHTML = '<div class="status-ok">Decoded successfully</div>';
      bodyEl.innerHTML = renderSpecial(record);
      $('canonical').value = canonicalUrl(hash);
    } catch (err) {
      statusEl.innerHTML = '<div class="status-err">' + esc(err.message || String(err)) + '</div>';
      bodyEl.innerHTML = '';
    }
  }

  function init() {
    if (!window.WPCodec) {
      var statusEl = $('status');
      if (statusEl) {
        statusEl.innerHTML =
          '<div class="status-err">WPCodec not loaded — script 404.\n\n' +
          'Run from repo root: cd repos/workpadskaios && npm run link-lab\n' +
          'Then open: http://localhost:8765/link-lab/p/\n\n' +
          'Do not serve only the link-lab/ folder (../../js/lib/codec.js will not resolve).</div>';
      }
      return;
    }

    var baseInput = $('link-base');
    if (baseInput) {
      baseInput.value = getBase();
      baseInput.addEventListener('change', function() { setBase(baseInput.value.trim()); run($('passphrase') && $('passphrase').value); });
    }

    $('btn-decode').addEventListener('click', function() {
      var paste = $('paste').value.trim();
      if (paste) {
        try {
          location.hash = normalizeHash(paste);
        } catch (e) {
          $('status').innerHTML = '<div class="status-err">' + esc(e.message) + '</div>';
          return;
        }
      }
      run($('passphrase') && $('passphrase').value);
    });

    $('btn-copy').addEventListener('click', function() {
      var c = $('canonical').value;
      if (navigator.clipboard) navigator.clipboard.writeText(c);
    });

    window.addEventListener('hashchange', function() { run($('passphrase') && $('passphrase').value); });

    run('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
