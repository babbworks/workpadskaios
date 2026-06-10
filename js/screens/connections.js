// Screen: Connections — rel-volume grouped network (not plain A–Z)
// Exposes: window.ConnectionsScreen

(function(global) {
  'use strict';

  var el = { content: null };
  var search = '';
  var focusIdx = 0;
  var zone = 'list';
  var trailOpen = false;
  var explainOpen = false;
  var trailContactId = null;
  var trailContactName = '';
  var lastRecords = [];
  var sections = [];
  var flatItems = [];

  function bandLabel(score, band) {
    if (global.RelVolume && band) return RelVolume.bandLabel(band);
    if (score >= 4) return 'In rhythm';
    if (score >= 2) return 'Warming';
    return 'Quiet';
  }

  function buildSections(records) {
    var dials = global.RelVolume ? RelVolume.getDials() : { minInteractions: 1 };
    var scored = global.RelVolume ? RelVolume.scoreByContact(records, dials) : [];
    var scoreMap = {};
    var i;
    for (i = 0; i < scored.length; i++) scoreMap[scored[i].contactId] = scored[i];

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
      var sc = scoreMap[c.id] || { score: 0, band: 'other', count: 0 };
      var item = { rec: c, name: name, score: sc.score, band: sc.band, count: sc.count };
      if (sc.band === 'rhythm') buckets.rhythm.push(item);
      else if (sc.band === 'warm') buckets.warm.push(item);
      else if (sc.band === 'quiet') buckets.quiet.push(item);
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

  function pendingRelaysForContact(contactId, records) {
    if (!contactId || !global.WPNocGatekeeper) return 0;
    var n = 0, i;
    for (i = 0; i < records.length; i++) {
      var r = records[i];
      if ((r.record_type || '') !== 'connection') continue;
      if (r.linkedContactId !== contactId) continue;
      if (r.receivedAt && WPNocGatekeeper.needsGatekeeperReceive(r, records)) n++;
    }
    return n;
  }

  function renderHero(records) {
    var sum = global.RelVolume ? RelVolume.networkSummary(records) : null;
    var sub = 'Rhythm with your people — scored bands, not A\u2192Z';
    if (sum) {
      sub = (sum.bands.rhythm || 0) + ' rhythm \u00b7 ' + (sum.bands.warm || 0) + ' warming \u00b7 ' +
        sum.needs + ' needs \u00b7 ' + sum.offers + ' offers';
    }
    return '<div class="conn-hero">' +
      '<div class="conn-hero-title">Connections</div>' +
      '<div class="conn-hero-sub">' + esc(sub) + '</div>' +
      '<div class="conn-hero-sub" style="margin-top:4px;">Tune in Manage \u2192 Rhythm tuning</div>' +
    '</div>';
  }

  function renderTrailPanel() {
    if (!trailOpen || !trailContactId || !global.SocialLedger) return '';
    var entries = SocialLedger.entriesForContact(trailContactId, lastRecords, { limit: 20 });
    return '<div class="conn-trail-panel">' +
      '<div class="conn-trail-back" id="conn-trail-back">\u2190 Back to list</div>' +
      '<div class="conn-trail-title">' + esc(trailContactName) + '</div>' +
      SocialLedger.renderTrailHtml(entries, { title: 'Social trail', max: 15 }) +
      '<div class="conn-hint">8 = close trail</div></div>';
  }

  function renderExplainPanel() {
    if (!explainOpen || !trailContactId || !global.RelVolume) return '';
    var ex = RelVolume.explainContact(trailContactId, lastRecords);
    var html = '<div class="conn-trail-panel">' +
      '<div class="conn-trail-back" id="conn-explain-back">\u2190 Back to list</div>' +
      '<div class="conn-trail-title">Rhythm: ' + esc(trailContactName) + '</div>';
    if (global.RelVolumeSettings) {
      html += RelVolumeSettings.renderExplainHtml(ex);
    }
    html += '<div class="conn-hint">5 = close \u00b7 4 = their records</div></div>';
    return html;
  }

  function render() {
    RecordService.list().then(function(records) {
      lastRecords = records;
      if (trailOpen) {
        el.content.innerHTML = renderTrailPanel();
        var back = document.getElementById('conn-trail-back');
        if (back) back.addEventListener('click', closePanels);
        return;
      }
      if (explainOpen) {
        el.content.innerHTML = renderExplainPanel();
        var eb = document.getElementById('conn-explain-back');
        if (eb) eb.addEventListener('click', closePanels);
        return;
      }
      sections = buildSections(records);
      flatItems = flattenSections(sections);
      if (focusIdx >= flatItems.length) focusIdx = Math.max(0, flatItems.length - 1);

      var html = renderHero(records) +
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
          var pendGk = pendingRelaysForContact(it.rec.id, records);
          var slSum = global.SocialLedger ? SocialLedger.summaryForContact(it.rec.id, records) : null;
          var pendBadge = pendGk ? ' <span class="badge badge-warn">' + pendGk + ' relay</span>' : '';
          if (slSum && slSum.pending) {
            pendBadge += SocialLedger.renderSummaryBadge(slSum);
          } else if (slSum && slSum.last) {
            pendBadge += ' <span class="conn-sl-last">' + esc(SocialLedger.labelForEntry(slSum.last)) + '</span>';
          }
          var sub = bandLabel(it.score, it.band);
          if (it.count) sub += ' \u00b7 ' + it.count + ' touches';
          html += '<div class="list-item conn-row' + (foc ? ' focused' : '') + '" data-conn-idx="' + idx + '">' +
            '<div class="list-item-title">' + esc(it.name) +
              (it.score > 0 ? '<span class="conn-score">' + it.score.toFixed(1) + '</span>' : '') +
              pendBadge +
            '</div>' +
            '<div class="list-item-sub">' + esc(sub) +
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

      html += '<div class="conn-hint">Enter = contact \u00b7 4 = records \u00b7 5 = rhythm \u00b7 6 = symbols \u00b7 7 = relays \u00b7 8 = trail</div>';
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

  function closePanels() {
    trailOpen = false;
    explainOpen = false;
    trailContactId = null;
    render();
  }

  function openContactTrail() {
    var f = flatItems[focusIdx];
    if (!f || !f.item.rec || !global.SocialLedger) return;
    explainOpen = false;
    trailOpen = true;
    trailContactId = f.item.rec.id;
    trailContactName = f.item.name;
    render();
  }

  function openContactExplain() {
    var f = flatItems[focusIdx];
    if (!f || !f.item.rec || !global.RelVolume) return;
    trailOpen = false;
    explainOpen = true;
    trailContactId = f.item.rec.id;
    trailContactName = f.item.name;
    render();
  }

  function onShow() {
    el.content = document.getElementById('connections-content');
    search = '';
    focusIdx = 0;
    zone = 'list';
    closePanels();
    render();
  }

  function openContactRecords() {
    var f = flatItems[focusIdx];
    if (!f || !f.item.rec) return;
    App.showList();
    if (global.ListScreen && ListScreen.setContactFilter) {
      ListScreen.setContactFilter(f.item.rec, null);
    }
  }

  function openContactSymbols() {
    var f = flatItems[focusIdx];
    if (!f || !f.item.rec || !global.App || !App.showSymbols) return;
    App.showSymbols({
      peerKey: f.item.rec.id,
      peerLabel: f.item.name,
      returnTo: 'connections',
    });
  }

  function openContactRelays() {
    var f = flatItems[focusIdx];
    if (!f || !f.item.rec) return;
    RecordService.list().then(function(all) {
      var i, r;
      for (i = 0; i < all.length; i++) {
        r = all[i];
        if ((r.record_type || '') !== 'connection') continue;
        if (r.linkedContactId !== f.item.rec.id) continue;
        if (r.receivedAt && global.WPNocGatekeeper && WPNocGatekeeper.needsGatekeeperReceive(r, all)) {
          App.showGatekeeperReceive({ parentRecord: r });
          return;
        }
      }
      alert('No pending gatekeeper relays for this contact.');
    });
  }

  function onKey(key) {
    if (trailOpen || explainOpen) {
      if (key === 'Backspace' || key === '5' || key === '8') { closePanels(); return; }
      if (explainOpen && key === '4') {
        closePanels();
        openContactRecords();
        return;
      }
      return;
    }
    if (key === 'Backspace' || key === 'SoftLeft') { App.showList(); return; }
    if (key === 'SoftRight') { App.showWizard({ record_type: 'contact' }); return; }
    if (key === '4') { openContactRecords(); return; }
    if (key === '5') { openContactExplain(); return; }
    if (key === '6') { openContactSymbols(); return; }
    if (key === '7') { openContactRelays(); return; }
    if (key === '8') { openContactTrail(); return; }
    if (key === 'ArrowUp' && focusIdx > 0) { focusIdx--; render(); }
    if (key === 'ArrowDown' && focusIdx < flatItems.length) { focusIdx++; render(); }
    if (key === 'Enter' && flatItems[focusIdx]) App.showView(flatItems[focusIdx].item.rec);
  }

  global.ConnectionsScreen = { onShow: onShow, onKey: onKey };

}(window));
