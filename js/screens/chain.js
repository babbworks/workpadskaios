// Screen: Chain — shows all records sharing the same chainRef as a timeline
// Exposes: window.ChainScreen

(function(global) {
  'use strict';

  // opts received by onShow
  var chainRef   = '';
  var sourceId   = '';
  var returnTo   = null;  // record object to go back to, resolved on back-press

  var chainRows  = [];    // filtered + sorted records
  var chainAll   = [];    // full store for obligation checks
  var focusIdx   = 0;

  // Badge labels by record_type / record_class
  var TYPE_BADGES = {
    invoice:      'INV',
    quote:        'QUO',
    receipt:      'REC',
    job:          'JOB',
    expense:      'EXP',
    payment:      'PAY',
    state_commit: 'CLSD',
    amendment:    'AMND',
    dispute:      'DISP',
    ack:          'ACK',
  };

  function badgeFor(rec) {
    if (rec.record_type === 'state_commit') return 'CLSD';
    if (rec.record_type === 'amendment')   return 'AMND';
    var b = TYPE_BADGES[rec.record_type] || TYPE_BADGES[rec.record_class] || '';
    if (!b) {
      // Fall back to first 3 chars of type uppercased
      b = ((rec.record_type || rec.record_class || 'REC').slice(0, 3)).toUpperCase();
    }
    return b;
  }

  function connectorFor(idx, total, rec, pending) {
    if (global.GlyphCard && GlyphCard.chainConnector) {
      return GlyphCard.chainConnector(rec, idx, total, pending);
    }
    if (idx === 0) return '\u25c9';
    if (rec.record_type === 'state_commit') return '\u25ce';
    return '\u2500';
  }

  function fmtDate(d) {
    if (!d) return '';
    // Keep only YYYY-MM-DD portion if ISO string
    return String(d).slice(0, 10);
  }

  function render() {
    var el = document.getElementById('chain-content');
    if (!el) return;

    if (!chainRows.length) {
      el.innerHTML = '<div class="chain-empty">No records found in this chain.</div>';
      return;
    }

    var total = chainRows.length;
    el.innerHTML = chainRows.map(function(rec, i) {
      var isCommit = rec.record_type === 'state_commit';
      var title     = esc(rec.job || '(untitled)');
      var date      = esc(fmtDate(rec.date));
      var isSource  = rec.id === sourceId;
      var pending   = global.WPChainExecution && WPChainExecution.hasOpenObligation(rec, chainAll);
      var connector = connectorFor(i, total, rec, pending);
      var badge     = badgeFor(rec);
      var rowGlyph  = (global.GlyphCard && GlyphCard.chainRowGlyph)
        ? GlyphCard.chainRowGlyph(rec) : '';
      var connCls   = (global.GlyphCard && GlyphCard.chainGlyphsOn && GlyphCard.chainGlyphsOn())
        ? ' wp-chain-glyph' : '';
      var needAck   = global.WPChainExecution && WPChainExecution.parseActionList(rec).length &&
        WPChainExecution.needsActionReceive(rec, chainAll);

      return '<div class="chain-row' +
        (i === focusIdx ? ' focused' : '') +
        (isCommit ? ' chain-commit' : '') +
        (pending ? ' chain-row-pending' : '') +
        '" data-chain-idx="' + i + '">' +
        '<span class="chain-connector' + connCls + '">' + connector + '</span>' +
        (rowGlyph ? '<span class="chain-badge-glyph">' + esc(rowGlyph) + '</span>' : '') +
        '<span class="chain-badge">' + esc(badge) + '</span>' +
        '<span class="chain-title">' + title + '</span>' +
        (isSource ? '<span class="chain-here">(here)</span>' : '') +
        (pending ? '<span class="chain-pending">\u25d0 Open</span>' : '') +
        (needAck ? '<span class="chain-pending">Actions</span>' : '') +
        '<span class="chain-date">' + date + '</span>' +
        '</div>';
    }).join('');

    // Attach click handlers
    var rows = el.querySelectorAll('[data-chain-idx]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', (function(idx) {
        return function() {
          focusIdx = idx;
          openFocused();
        };
      })(i));
    }

    // Scroll focused row into view
    var focused = el.querySelector('.chain-row.focused');
    if (focused) focused.scrollIntoView({ block: 'nearest' });
  }

  function openFocused() {
    var rec = chainRows[focusIdx];
    if (rec) App.showView(rec);
  }

  function goBack() {
    if (sourceId) {
      RecordService.get(sourceId).then(function(rec) {
        if (rec) App.showView(rec);
        else App.showList();
      });
    } else {
      App.showList();
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function onShow(opts) {
    opts      = opts || {};
    chainRef  = opts.chainRef  || '';
    sourceId  = opts.sourceId  || '';
    returnTo  = opts.returnTo  || null;
    focusIdx  = 0;
    chainRows = [];

    // Update crumb label
    var crumbLabel = document.getElementById('chain-crumb-label');
    if (crumbLabel) crumbLabel.textContent = 'Chain: ' + chainRef;

    // Back button
    var crumbBack = document.getElementById('chain-crumb-back');
    if (crumbBack) {
      crumbBack.onclick = function() { goBack(); };
    }

    RecordService.list().then(function(all) {
      chainAll = all || [];
      return RecordService.listByChainRef(chainRef);
    }).then(function(filtered) {

      filtered.sort(function(a, b) {
        var da = a.date || '';
        var db = b.date || '';
        if (da < db) return -1;
        if (da > db) return 1;
        var ca = a.createdAt || 0;
        var cb = b.createdAt || 0;
        return ca - cb;
      });

      chainRows = filtered;

      // Set focusIdx to the sourceId record if present
      for (var j = 0; j < chainRows.length; j++) {
        if (chainRows[j].id === sourceId) {
          focusIdx = j;
          break;
        }
      }

      render();
    });
  }

  function onKey(key) {
    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) { focusIdx--; render(); }
        break;
      case 'ArrowDown':
        if (focusIdx < chainRows.length - 1) { focusIdx++; render(); }
        break;
      case 'Enter':
        openFocused();
        break;
      case 'Backspace':
        goBack();
        break;
    }
  }

  global.ChainScreen = {
    onShow: onShow,
    onKey:  onKey,
  };

}(window));
