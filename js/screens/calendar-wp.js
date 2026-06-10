// Screen: Calendar (WP) — time-scope navigator, no month grid
// Exposes: window.CalendarWPScreen

(function(global) {
  'use strict';

  // Three scopes: day | week | month
  // Each scope has an offset from "current" (0 = current, -1 = last, +1 = next)

  var SCOPES = ['day', 'week', 'month'];
  var SCOPE_LABELS = ['Today', 'This Week', 'This Month'];

  var offsets = { day: 0, week: 0, month: 0 };
  var focusScopeIdx = 0;  // 0-2 (row)
  var focusPart     = 1;  // 0 = left arrow, 1 = label, 2 = right arrow

  // ── Date helpers ───────────────────────────────────────────────────────────

  function todayIso() { return new Date().toISOString().slice(0, 10); }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function isoDate(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }

  function scopeRange(scope, offset) {
    var today = new Date();
    var start, end;

    if (scope === 'day') {
      var d = new Date(today);
      d.setDate(d.getDate() + offset);
      var iso = d.toISOString().slice(0, 10);
      return { start: iso, end: iso };
    }

    if (scope === 'week') {
      // Week starts Monday
      var dow = today.getDay(); // 0=Sun
      var diffToMon = (dow === 0 ? -6 : 1 - dow);
      var mon = new Date(today);
      mon.setDate(today.getDate() + diffToMon + offset * 7);
      var sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return {
        start: mon.toISOString().slice(0, 10),
        end:   sun.toISOString().slice(0, 10),
      };
    }

    if (scope === 'month') {
      var y = today.getFullYear();
      var m = today.getMonth() + 1 + offset;
      while (m > 12) { m -= 12; y++; }
      while (m < 1)  { m += 12; y--; }
      var lastDay = new Date(y, m, 0).getDate();
      return {
        start: isoDate(y, m, 1),
        end:   isoDate(y, m, lastDay),
      };
    }
    return null;
  }

  function scopeDisplayLabel(scope, offset) {
    var range = scopeRange(scope, offset);
    if (!range) return '';

    if (scope === 'day') {
      if (offset === 0) return 'Today · ' + range.start.slice(5);
      if (offset === -1) return 'Yesterday · ' + range.start.slice(5);
      if (offset === 1)  return 'Tomorrow · ' + range.start.slice(5);
      return (offset < 0 ? offset + 'd' : '+' + offset + 'd') + ' · ' + range.start.slice(5);
    }
    if (scope === 'week') {
      if (offset === 0) return 'This Week · ' + range.start.slice(5) + '→' + range.end.slice(5);
      if (offset === -1) return 'Last Week · ' + range.start.slice(5) + '→' + range.end.slice(5);
      if (offset === 1)  return 'Next Week · ' + range.start.slice(5) + '→' + range.end.slice(5);
      return 'Wk ' + (offset < 0 ? offset : '+' + offset) + ' · ' + range.start.slice(5);
    }
    if (scope === 'month') {
      var d = new Date(range.start + 'T00:00:00');
      var MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var lbl = MONS[d.getMonth()] + ' ' + d.getFullYear();
      if (offset === 0) return 'This Month · ' + lbl;
      if (offset === -1) return 'Last Month · ' + lbl;
      if (offset === 1)  return 'Next Month · ' + lbl;
      return lbl;
    }
    return '';
  }

  function activateScope(scopeIdx) {
    var scope = SCOPES[scopeIdx];
    var offset = offsets[scope];
    var range = scopeRange(scope, offset);
    if (!range) return;
    App.showList({ dateRange: { start: range.start, end: range.end, label: scopeDisplayLabel(scope, offset) }, returnTo: 'calendar' });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function render() {
    var el = document.getElementById('calwp-content');
    if (!el) return;
    var html = '';

    for (var i = 0; i < SCOPES.length; i++) {
      var scope  = SCOPES[i];
      var offset = offsets[scope];
      var label  = scopeDisplayLabel(scope, offset);
      var rowFocused = focusScopeIdx === i;

      html += '<div class="calwp-row' + (rowFocused ? ' focused' : '') + '" data-scope="' + i + '">' +
        '<div class="calwp-arrow' + (rowFocused && focusPart === 0 ? ' part-focused' : '') + '" data-scope="' + i + '" data-part="0">&#9664;</div>' +
        '<div class="calwp-label' + (rowFocused && focusPart === 1 ? ' part-focused' : '') + '" data-scope="' + i + '" data-part="1">' + esc(label) + '</div>' +
        '<div class="calwp-arrow' + (rowFocused && focusPart === 2 ? ' part-focused' : '') + '" data-scope="' + i + '" data-part="2">&#9654;</div>' +
      '</div>';
    }

    el.innerHTML = html;

    // Click bindings
    var parts = el.querySelectorAll('[data-part]');
    for (var j = 0; j < parts.length; j++) {
      (function(p) {
        p.addEventListener('click', function() {
          var si   = parseInt(p.getAttribute('data-scope'), 10);
          var part = parseInt(p.getAttribute('data-part'), 10);
          focusScopeIdx = si;
          focusPart     = part;
          if (part === 0) {
            offsets[SCOPES[si]]--;
            render();
          } else if (part === 2) {
            offsets[SCOPES[si]]++;
            render();
          } else {
            activateScope(si);
          }
        });
      })(parts[j]);
    }
  }

  // ── D-pad ──────────────────────────────────────────────────────────────────

  function onKey(key) {
    switch (key) {
      case 'ArrowUp':
        if (focusScopeIdx > 0) { focusScopeIdx--; focusPart = 1; render(); }
        break;
      case 'ArrowDown':
        if (focusScopeIdx < SCOPES.length - 1) { focusScopeIdx++; focusPart = 1; render(); }
        break;
      case 'ArrowLeft':
        if (focusPart > 0) { focusPart--; render(); }
        else { offsets[SCOPES[focusScopeIdx]]--; render(); }
        break;
      case 'ArrowRight':
        if (focusPart < 2) { focusPart++; render(); }
        else { offsets[SCOPES[focusScopeIdx]]++; render(); }
        break;
      case 'Enter':
        if (focusPart === 0) { offsets[SCOPES[focusScopeIdx]]--; render(); }
        else if (focusPart === 2) { offsets[SCOPES[focusScopeIdx]]++; render(); }
        else { activateScope(focusScopeIdx); }
        break;
      case 'Backspace':
      case 'SoftRight':
        App.showHome();
        break;
      case '0':
        // reset current scope to 0
        offsets[SCOPES[focusScopeIdx]] = 0;
        render();
        break;
    }
  }

  // ── onShow ─────────────────────────────────────────────────────────────────

  function onShow() {
    offsets       = { day: 0, week: 0, month: 0 };
    focusScopeIdx = 0;
    focusPart     = 1;
    render();
  }

  global.CalendarWPScreen = { onShow: onShow, onKey: onKey };

}(window));
