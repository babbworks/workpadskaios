// Lifecycle — quote → invoice → receipt → close (R3)
// Exposes: window.Lifecycle

(function(global) {
  'use strict';

  var STEPS = [
    { type: '',        label: 'Job',     short: 'J' },
    { type: 'quote',   label: 'Quote',   short: 'Q' },
    { type: 'invoice', label: 'Invoice', short: 'I' },
    { type: 'receipt', label: 'Receipt', short: 'R' },
    { type: 'close',   label: 'Close',   short: '\u2713' },
  ];

  var PROGRESSION_NEXT = {
    '':       [{ type: 'quote',   label: 'Create Quote' },
               { type: 'invoice', label: 'Create Invoice' }],
    'quote':  [{ type: 'invoice', label: 'Create Invoice' },
               { type: 'receipt', label: 'Create Receipt' }],
    'invoice':[{ type: 'receipt', label: 'Create Receipt' }],
  };

  function stepIndex(rt) {
    var t = rt || '';
    for (var i = 0; i < STEPS.length; i++) {
      if (STEPS[i].type === t) return i;
    }
    return 0;
  }

  function nextActions(rt) {
    return PROGRESSION_NEXT[rt || ''] || null;
  }

  function stripHtml(rt, chainComplete) {
    var cur = stepIndex(rt);
    var html = '<div class="view-lifecycle-strip">';
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      if (s.type === 'close') {
        var closed = !!chainComplete;
        html += '<span class="view-lc-step' + (closed ? ' view-lc-done' : (i === cur + 1 ? ' view-lc-next' : '')) + '">' +
          esc(s.short) + '<span class="view-lc-lbl">' + esc(s.label) + '</span></span>';
        continue;
      }
      var cls = 'view-lc-step';
      if (i < cur) cls += ' view-lc-done';
      else if (i === cur) cls += ' view-lc-active';
      html += '<span class="' + cls + '">' + esc(s.short) +
        '<span class="view-lc-lbl">' + esc(s.label) + '</span></span>';
      if (i < STEPS.length - 2) html += '<span class="view-lc-arrow">\u203a</span>';
    }
    html += '</div>';
    return html;
  }

  function chainDocsHtml(docs, currentId) {
    if (!docs || !docs.length) return '';
    var html = '<div class="view-chain-docs"><div class="view-sec-hdr">In this chain</div>';
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      if (d.id === currentId) continue;
      var rt = d.record_type || '';
      var lbl = TYPE_LABEL(rt);
      html += '<div class="view-chain-doc-row" data-chain-id="' + esc(d.id) + '">' +
        '<span class="view-chain-doc-type">' + esc(lbl) + '</span>' +
        '<span class="view-chain-doc-title">' + esc(d.job || '(untitled)') + '</span>' +
        (d.draft ? '<span class="ls-pill ls-pill-draft">Draft</span>' : '') +
      '</div>';
    }
    html += '</div>';
    return html;
  }

  function TYPE_LABEL(rt) {
    var map = { '': 'Job', quote: 'Quote', invoice: 'Invoice', receipt: 'Receipt', sale: 'Sale' };
    return map[rt] || (rt ? rt.charAt(0).toUpperCase() + rt.slice(1) : 'Record');
  }

  function collectChainDocs(chainRecords, rootId) {
    var out = [];
    var progTypes = { quote: 1, invoice: 1, receipt: 1, '': 1 };
    for (var i = 0; i < chainRecords.length; i++) {
      var r = chainRecords[i];
      var rt = r.record_type || '';
      if (progTypes[rt] || r.parentId === rootId) out.push(r);
    }
    out.sort(function(a, b) {
      var oa = stepIndex(a.record_type);
      var ob = stepIndex(b.record_type);
      if (oa !== ob) return oa - ob;
      return (a.updatedAt || 0) - (b.updatedAt || 0);
    });
    return out;
  }

  global.Lifecycle = {
    STEPS: STEPS,
    PROGRESSION_NEXT: PROGRESSION_NEXT,
    stepIndex: stepIndex,
    nextActions: nextActions,
    stripHtml: stripHtml,
    chainDocsHtml: chainDocsHtml,
    collectChainDocs: collectChainDocs,
    TYPE_LABEL: TYPE_LABEL,
  };

}(window));
