(function() {
  'use strict';

  var LC = window.WPLabCommon;
  var STORE = 'wp_lab_written_codes_v1';

  function $(id) { return document.getElementById(id); }

  function readAll() {
    try {
      var raw = localStorage.getItem(STORE);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(data) {
    localStorage.setItem(STORE, JSON.stringify(data));
  }

  function normaliseAlias(s) {
    s = (s || '').trim();
    if (s.length < 4 || s.length > 30) {
      throw new Error('Alias must be 4–30 characters');
    }
    if (!/^[A-Za-z0-9._-]+$/.test(s)) {
      throw new Error('Alias: letters, digits, . _ - only');
    }
    return s;
  }

  document.addEventListener('DOMContentLoaded', function() {
    $('btn-save').onclick = function() {
      try {
        var alias = normaliseAlias($('alias').value);
        var frag = LC.normalizeHash($('frag').value);
        if (!frag) throw new Error('Paste full fragment');
        var all = readAll();
        all[alias] = frag;
        writeAll(all);
        $('status').innerHTML = '<div class="status-ok">Saved ' + LC.esc(alias) + ' (' + frag.length + ' chars)</div>';
      } catch (e) {
        $('status').innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      }
    };

    $('btn-open').onclick = function() {
      try {
        var alias = normaliseAlias($('lookup').value);
        var all = readAll();
        var frag = all[alias];
        if (!frag) throw new Error('Unknown alias: ' + alias);
        var base = LC.getLinkBase();
        window.location.href = base + (base.indexOf('#') >= 0 ? '' : '#') + frag;
      } catch (e) {
        $('status').innerHTML = '<div class="status-err">' + LC.esc(e.message) + '</div>';
      }
    };

    $('btn-list').onclick = function() {
      var all = readAll();
      var keys = Object.keys(all).sort();
      if (!keys.length) {
        $('out').innerHTML = '<p class="hint">No aliases yet.</p>';
        return;
      }
      var rows = '';
      keys.forEach(function(k) {
        rows += '<tr><th>' + LC.esc(k) + '</th><td>' + LC.esc(all[k].slice(0, 48)) +
          (all[k].length > 48 ? '…' : '') + ' (' + all[k].length + ')</td></tr>';
      });
      $('out').innerHTML = '<div class="card"><table class="field-grid"><tbody>' + rows + '</tbody></table></div>';
    };
  });
})();
