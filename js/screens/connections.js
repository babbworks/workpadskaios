// Screen: Connections — rel-volume grouped network (not plain A–Z)
// Exposes: window.ConnectionsScreen

(function(global) {
  'use strict';

  var el = { content: null };
  var search = '';
  var focusIdx = 0;
  var zone = 'list';
  var sections = [];
  var flatItems = [];

  function bandLabel(score) {
    if (score >= 4) return 'In rhythm';
    if (score >= 2) return 'Warming';
    return 'Quiet';
  }

  function buildSections(records) {
    var dials = global.RelVolume ? RelVolume.getDials() : { minInteractions: 1 };
    var scored = global.RelVolume ? RelVolume.scoreRecords(records, dials) : [];
    var scoreMap = {};
    for (var i = 0; i < scored.length; i++) scoreMap[scored[i].key] = scored[i];

    var contacts = records.filter(function(r) {
      return (r.record_type || r.recordType) === 'contact' && !r.parentId;
    });

    var sVal = search.toLowerCase();
    var buckets = { rhythm: [], warm: [], quiet: [], other: [] };

    contacts.forEach(function(c) {
      var name = (c.customer || c.job || c.name || '').trim();
      if (!name) return;
      if (sVal) {
        var hay = (name + ' ' + (c.phone || '') + ' ' + (c.email || '')).toLowerCase();
        if (hay.indexOf(sVal) === -1) return;
      }
      var key = name.toLowerCase();
      var sc = scoreMap[key] ? scoreMap[key].score : 0;
      var item = { rec: c, name: name, score: sc };
      if (sc >= 4) buckets.rhythm.push(item);
      else if (sc >= 2) buckets.warm.push(item);
      else if (sc >= dials.minInteractions) buckets.quiet.push(item);
      else buckets.other.push(item);
    });

    function sortBucket(arr) {
      arr.sort(function(a, b) { return b.score - a.score || a.name.localeCompare(b.name); });
    }
    sortBucket(buckets.rhythm);
    sortBucket(buckets.warm);
    sortBucket(buckets.quiet);
    sortBucket(buckets.other);

    var out = [];
    if (buckets.rhythm.length) out.push({ title: 'In rhythm', items: buckets.rhythm });
    if (buckets.warm.length) out.push({ title: 'Warming', items: buckets.warm });
    if (buckets.quiet.length) out.push({ title: 'Quiet ties', items: buckets.quiet });
    if (buckets.other.length) out.push({ title: 'Directory', items: buckets.other });
    return out;
  }

  function flattenSections(sects) {
    var flat = [];
    for (var s = 0; s < sects.length; s++) {
      for (var i = 0; i < sects[s].items.length; i++) {
        flat.push({ section: sects[s].title, item: sects[s].items[i] });
      }
    }
    return flat;
  }

  function render() {
    RecordService.list().then(function(records) {
      sections = buildSections(records);
      flatItems = flattenSections(sections);
      if (focusIdx >= flatItems.length) focusIdx = Math.max(0, flatItems.length - 1);

      var html =
        '<div class="conn-hero">' +
          '<div class="conn-hero-title">Connections</div>' +
          '<div class="conn-hero-sub">Rhythm with your people — not just A\u2192Z</div>' +
        '</div>' +
        '<div class="cb-search-row' + (zone === 'search' ? ' focused' : '') + '">' +
          '<input class="cb-search-inp" id="conn-search-inp" type="text" placeholder="Search\u2026" value="' + esc(search) + '">' +
        '</div>';

      var idx = 0;
      for (var si = 0; si < sections.length; si++) {
        var sec = sections[si];
        html += '<div class="conn-sec-hdr">' + esc(sec.title) + '</div>';
        for (var ii = 0; ii < sec.items.length; ii++) {
          var it = sec.items[ii];
          var foc = zone === 'list' && focusIdx === idx;
          html += '<div class="list-item conn-row' + (foc ? ' focused' : '') + '" data-conn-idx="' + idx + '">' +
            '<div class="list-item-title">' + esc(it.name) +
              (it.score > 0 ? '<span class="conn-score">' + it.score.toFixed(1) + '</span>' : '') +
            '</div>' +
            '<div class="list-item-sub">' + esc(bandLabel(it.score)) +
              (it.rec.phone ? ' \u00b7 ' + esc(it.rec.phone) : '') +
            '</div></div>';
          idx++;
        }
      }

      if (!flatItems.length) {
        html += global.EmptyState
          ? EmptyState.render('No connections yet', { hint: 'Add contacts or log jobs to build rhythm.' })
          : '<div class="empty-state">No connections yet.</div>';
      }

      html += '<div class="list-new-btn' + (zone === 'list' && focusIdx === flatItems.length ? ' focused' : '') + '" id="conn-new-btn">+ New contact</div>';

      el.content.innerHTML = html;

      var inp = document.getElementById('conn-search-inp');
      if (inp) {
        inp.addEventListener('input', function() { search = inp.value; focusIdx = 0; render(); });
        inp.addEventListener('keydown', function(e) {
          e.stopPropagation();
          if (e.key === 'ArrowDown') { e.preventDefault(); zone = 'list'; focusIdx = 0; render(); }
        });
      }

      var newBtn = document.getElementById('conn-new-btn');
      if (newBtn) newBtn.addEventListener('click', function() { App.showWizard({ record_type: 'contact' }); });

      var rows = el.content.querySelectorAll('[data-conn-idx]');
      for (var ri = 0; ri < rows.length; ri++) {
        rows[ri].addEventListener('click', (function(ix) {
          return function() {
            var f = flatItems[ix];
            if (f && f.item.rec) App.showView(f.item.rec);
          };
        })(parseInt(rows[ri].getAttribute('data-conn-idx'), 10)));
      }
    });
  }

  function onShow() {
    el.content = document.getElementById('connections-content');
    search = '';
    focusIdx = 0;
    zone = 'list';
    render();
  }

  function onKey(key) {
    if (key === 'Backspace' || key === 'SoftLeft') { App.showList(); return; }
    if (key === 'SoftRight') { App.showWizard({ record_type: 'contact' }); return; }
    if (key === 'ArrowUp' && focusIdx > 0) { focusIdx--; render(); }
    if (key === 'ArrowDown' && focusIdx < flatItems.length) { focusIdx++; render(); }
    if (key === 'Enter' && flatItems[focusIdx]) App.showView(flatItems[focusIdx].item.rec);
  }

  global.ConnectionsScreen = { onShow: onShow, onKey: onKey };

}(window));
