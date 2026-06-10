// Screen: Symbols — per-peer symbol tables for relational #1pv/ compression
// Exposes: window.SymbolsScreen

(function(global) {
  'use strict';

  var el = { content: null };
  var mode = 'peers';       // peers | entries | edit
  var selectedPeer = '_default';
  var peerLabel = 'General (default)';
  var focusIdx = 0;
  var flatPeers = [];
  var entries = [];
  var editTokenId = null;
  var returnTo = null;
  var returnRecord = null;
  var nameById = {};

  function ST() { return global.WPSymbolTable; }

  function loadContactNames() {
    nameById = {};
    if (typeof RecordService === 'undefined') return Promise.resolve();
    return RecordService.list().then(function(all) {
      all.forEach(function(r) {
        if ((r.record_type || '') === 'contact' && r.id) {
          nameById[r.id] = (r.job || r.customer || r.name || 'Contact').trim();
        }
      });
    });
  }

  function buildPeerList() {
    var keys = ST() ? ST().listPeerKeys() : [];
    var map = {};
    keys.forEach(function(k) { map[k] = true; });
    map._default = true;
    Object.keys(nameById).forEach(function(id) { map[id] = true; });

    flatPeers = Object.keys(map).map(function(k) {
      var st = ST().stats(k);
      return {
        key: k,
        label: ST().peerLabelForKey(k, nameById),
        entries: st.entries,
        pending: st.pending,
      };
    });
    flatPeers.sort(function(a, b) {
      if (a.key === '_default') return -1;
      if (b.key === '_default') return 1;
      return a.label.localeCompare(b.label);
    });
  }

  function renderPeers() {
    mode = 'peers';
    var encOn = global.UIPhase && UIPhase.isOn('relational_encode');
    var html =
      '<div class="sym-hero">' +
        '<div class="sym-hero-title">Symbol tables</div>' +
        '<div class="sym-hero-sub">Short names sent inline on #1pv/ shares per peer</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Relational encode</div>' +
        '<div class="view-field-value">' +
          (encOn ? '<span class="badge badge-accent">On</span>' : '<span class="badge">Off</span>') +
          ' <span style="font-size:10px;color:var(--text-muted);">Management → Settings</span>' +
        '</div>' +
      '</div>';

    for (var i = 0; i < flatPeers.length; i++) {
      var p = flatPeers[i];
      var foc = focusIdx === i ? ' focused' : '';
      var pend = p.pending ? ' <span class="badge badge-warn">' + p.pending + ' new</span>' : '';
      html += '<div class="list-item sym-peer-row' + foc + '" data-sym-peer="' + esc(p.key) + '" data-idx="' + i + '">' +
        '<div class="list-item-title">' + esc(p.label) + '</div>' +
        '<div class="list-item-sub">' + p.entries + ' symbol' + (p.entries === 1 ? '' : 's') + pend + '</div>' +
        '</div>';
    }

    html += '<div class="sym-actions">' +
      '<div class="list-new-btn' + (focusIdx === flatPeers.length ? ' focused' : '') + '" id="sym-export-default">Import contacts → General</div>' +
      '</div>' +
      '<div class="sym-hint">Enter = open table · CSK on row = edit token</div>';

    el.content.innerHTML = html;
    wirePeerRows();
    var exp = document.getElementById('sym-export-default');
    if (exp) exp.addEventListener('click', function() { doExport('_default'); });
  }

  function wirePeerRows() {
    var rows = el.content.querySelectorAll('.sym-peer-row');
    for (var ri = 0; ri < rows.length; ri++) {
      (function(row) {
        row.addEventListener('click', function() {
          openPeer(row.getAttribute('data-sym-peer'));
        });
      })(rows[ri]);
    }
  }

  function openPeer(key) {
    selectedPeer = key || '_default';
    peerLabel = ST().peerLabelForKey(selectedPeer, nameById);
    mode = 'entries';
    focusIdx = 0;
    renderEntries();
  }

  function renderEntries() {
    var table = ST().getTable(selectedPeer);
    entries = (table.entries || []).slice();
    var st = ST().stats(selectedPeer);
    var html =
      '<div class="sym-hero">' +
        '<div class="sym-hero-title">' + esc(peerLabel) + '</div>' +
        '<div class="sym-hero-sub">' + st.entries + ' symbols' +
          (st.pending ? ' · ' + st.pending + ' pending on next share' : '') +
        '</div>' +
      '</div>' +
      '<div class="sym-actions">' +
        '<span class="sym-act-btn" id="sym-back-peers">‹ All peers</span>' +
        '<span class="sym-act-btn" id="sym-export-peer">Import contacts</span>' +
        '<span class="sym-act-btn" id="sym-flush-pend">Clear pending</span>' +
      '</div>';

    var ei;
    for (ei = 0; ei < entries.length; ei++) {
      var e = entries[ei];
      var foc = focusIdx === ei ? ' focused' : '';
      var isPend = false;
      if (table.pendingInline) {
        for (var pi = 0; pi < table.pendingInline.length; pi++) {
          if (table.pendingInline[pi].tokenId === e.tokenId) { isPend = true; break; }
        }
      }
      html += '<div class="list-item sym-entry-row' + foc + '" data-sym-entry="' + ei + '">' +
        '<div class="list-item-title">#' + e.tokenId + ' · ' + esc(e.label || '(empty)') + '</div>' +
        '<div class="list-item-sub">' + (isPend ? 'Queued for next share' : 'In table') +
          ' <span class="sym-del" data-sym-del="' + e.tokenId + '">×</span></div>' +
        '</div>';
    }

    html += '<div class="list-new-btn' + (focusIdx === entries.length ? ' focused' : '') + '" id="sym-add-entry">+ Add symbol</div>';
    html += '<div class="sym-hint">Enter = edit · 3 = delete · 8 = clear all for peer</div>';

    el.content.innerHTML = html;

    document.getElementById('sym-back-peers').addEventListener('click', function() {
      mode = 'peers'; focusIdx = 0; renderPeers();
    });
    document.getElementById('sym-export-peer').addEventListener('click', function() { doExport(selectedPeer); });
    document.getElementById('sym-flush-pend').addEventListener('click', function() {
      ST().flushPending(selectedPeer);
      renderEntries();
    });
    document.getElementById('sym-add-entry').addEventListener('click', openAddForm);

    var erows = el.content.querySelectorAll('.sym-entry-row');
    for (var ri = 0; ri < erows.length; ri++) {
      (function(row, idx) {
        row.addEventListener('click', function(ev) {
          if (ev.target && ev.target.getAttribute('data-sym-del')) return;
          openEditForm(entries[idx]);
        });
      })(erows[ri], parseInt(erows[ri].getAttribute('data-sym-entry'), 10));
    }

    var dels = el.content.querySelectorAll('[data-sym-del]');
    for (var di = 0; di < dels.length; di++) {
      (function(btn) {
        btn.addEventListener('click', function(ev) {
          ev.stopPropagation();
          var tid = parseInt(btn.getAttribute('data-sym-del'), 10);
          if (confirm('Remove symbol #' + tid + '?')) {
            ST().removeEntry(selectedPeer, tid);
            renderEntries();
          }
        });
      })(dels[di]);
    }
  }

  function openAddForm() {
    editTokenId = null;
    mode = 'edit';
    renderEditForm('');
  }

  function openEditForm(entry) {
    editTokenId = entry.tokenId;
    mode = 'edit';
    renderEditForm(entry.label || '');
  }

  function renderEditForm(labelVal) {
    var tid = editTokenId != null ? editTokenId : (entries.length ? Math.max.apply(null, entries.map(function(e) { return e.tokenId; })) + 1 : 1);
    el.content.innerHTML =
      '<div class="sym-hero"><div class="sym-hero-title">' +
        (editTokenId != null ? 'Edit symbol' : 'Add symbol') + '</div>' +
        '<div class="sym-hero-sub">' + esc(peerLabel) + '</div></div>' +
      '<div class="field-group"><div class="field-label">Token ID</div>' +
        '<input class="field-input" id="sym-tid" type="number" min="1" max="65535" value="' + tid + '"' +
        (editTokenId != null ? ' readonly' : '') + '></div>' +
      '<div class="field-group"><div class="field-label">Label (max 63)</div>' +
        '<input class="field-input" id="sym-lbl" type="text" value="' + esc(labelVal) + '" maxlength="63"></div>' +
      '<div class="wiz-part-form-btns" style="padding:10px;">' +
        '<span class="wiz-part-cancel-btn" id="sym-cancel">Cancel</span>' +
        '<span class="wiz-part-save-btn" id="sym-save">Save</span></div>';
    document.getElementById('sym-cancel').addEventListener('click', function() {
      mode = 'entries'; renderEntries();
    });
    document.getElementById('sym-save').addEventListener('click', saveEditForm);
    var lbl = document.getElementById('sym-lbl');
    if (lbl) lbl.focus();
  }

  function saveEditForm() {
    var tidIn = document.getElementById('sym-tid');
    var lblIn = document.getElementById('sym-lbl');
    var tid = tidIn ? parseInt(tidIn.value, 10) : 1;
    var lbl = lblIn ? lblIn.value.trim() : '';
    if (!lbl) { alert('Label is required.'); return; }
    if (isNaN(tid) || tid < 1) { alert('Token ID must be 1–65535.'); return; }
    ST().updateEntry(selectedPeer, tid, lbl);
    mode = 'entries';
    renderEntries();
  }

  function doExport(peerKey) {
    if (!global.BlockRegistry || !ST().exportFromBlockRegistry) {
      alert('Contact import not available.');
      return;
    }
    ST().exportFromBlockRegistry(function() { return BlockRegistry.list(); }, peerKey)
      .then(function(r) {
        alert('Imported ' + r.count + ' contact name(s) into this symbol table.');
        if (mode === 'peers') { buildPeerList(); renderPeers(); }
        else renderEntries();
      })
      .catch(function(e) { alert('Import failed: ' + (e && e.message ? e.message : 'error')); });
  }

  function goBack() {
    if (mode === 'edit') {
      mode = 'entries';
      renderEntries();
      return;
    }
    if (mode === 'entries') {
      mode = 'peers';
      focusIdx = 0;
      renderPeers();
      return;
    }
    if (returnTo === 'share' && returnRecord) {
      App.showShare(returnRecord);
      return;
    }
    if (returnTo === 'connections') {
      App.showConnections();
      return;
    }
    if (returnTo === 'management') {
      App.showManagement({ tab: 'user' });
      return;
    }
    if (returnTo === 'view' && returnRecord) {
      App.showView(returnRecord);
      return;
    }
    App.showManagement({ tab: 'user' });
  }

  function onShow(opts) {
    opts = opts || {};
    el.content = document.getElementById('symbols-content');
    returnTo = opts.returnTo || null;
    returnRecord = opts.record || null;
    mode = opts.peerKey ? 'entries' : 'peers';
    selectedPeer = opts.peerKey || '_default';
    peerLabel = opts.peerLabel || null;
    focusIdx = 0;

    loadContactNames().then(function() {
      if (!peerLabel) peerLabel = ST().peerLabelForKey(selectedPeer, nameById);
      buildPeerList();
      if (mode === 'entries') renderEntries();
      else renderPeers();
    });
  }

  function onKey(key) {
    if (mode === 'edit') {
      if (key === 'Backspace') goBack();
      if (key === 'Enter' || key === 'SoftRight') saveEditForm();
      return;
    }
    if (mode === 'entries') {
      if (key === 'Backspace') goBack();
      if (key === '8') {
        if (confirm('Clear all symbols for ' + peerLabel + '?')) {
          ST().clearPeer(selectedPeer);
          renderEntries();
        }
        return;
      }
      if (key === '3' && entries[focusIdx]) {
        var e = entries[focusIdx];
        if (confirm('Remove #' + e.tokenId + '?')) {
          ST().removeEntry(selectedPeer, e.tokenId);
          renderEntries();
        }
        return;
      }
      if (key === 'ArrowUp' && focusIdx > 0) { focusIdx--; renderEntries(); }
      if (key === 'ArrowDown' && focusIdx < entries.length) { focusIdx++; renderEntries(); }
      if (key === 'Enter') {
        if (focusIdx < entries.length) openEditForm(entries[focusIdx]);
        else openAddForm();
      }
      return;
    }
    if (key === 'Backspace') goBack();
    if (key === 'ArrowUp' && focusIdx > 0) { focusIdx--; renderPeers(); }
    if (key === 'ArrowDown' && focusIdx < flatPeers.length) { focusIdx++; renderPeers(); }
    if (key === 'Enter') {
      if (focusIdx < flatPeers.length) openPeer(flatPeers[focusIdx].key);
      else doExport('_default');
    }
  }

  global.SymbolsScreen = { onShow: onShow, onKey: onKey };

}(window));
