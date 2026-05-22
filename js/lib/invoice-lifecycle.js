// InvoiceLifecycle — R3.7 child financial beats on quote/invoice (Billed / Collected / Receivables)
// Exposes: window.InvoiceLifecycle

(function(global) {
  'use strict';

  function isLifecycleParent(rec) {
    var rt = (rec && rec.record_type) || '';
    return rt === 'quote' || rt === 'invoice' || rt === '';
  }

  function rollup(parent, children) {
    if (!global.FinancialModel) {
      return { billed: 0, collected: 0, receivables: 0, cogs: 0, jobInputs: 0 };
    }
    var summary = FinancialModel.summarize(parent, children || []);
    var jiLabel = global.IOLabels ? IOLabels.jobInputsLabel() : 'Job Inputs';
    return {
      billed:       summary.total || summary.price || 0,
      collected:    summary.paidTotal || 0,
      receivables:  summary.outstanding > 0 ? summary.outstanding : 0,
      cogs:         summary.cogsTotal || 0,
      jobInputs:    summary.cogsTotal || 0,
      jobInputsLabel: jiLabel,
      cogsLabel:    global.IOLabels ? IOLabels.cogsLabel() : 'COGS',
    };
  }

  function stripHtml(rollup, currency) {
    if (!rollup) return '';
    var cur = currency || '';
    var e = global.esc || function(s) { return String(s || ''); };
    function fmt(n) {
      if (global.CurrencyUtil) return CurrencyUtil.fmt(n, cur);
      return cur + ' ' + (parseFloat(n) || 0).toFixed(2);
    }
    return (
      '<div class="view-inv-lifecycle">' +
        '<div class="view-inv-lc-title">Document totals</div>' +
        '<div class="view-inv-lc-row"><span>Billed</span><span>' + fmt(rollup.billed) + '</span></div>' +
        '<div class="view-inv-lc-row"><span>Collected</span><span>' + fmt(rollup.collected) + '</span></div>' +
        '<div class="view-inv-lc-row"><span>Receivables</span><span>' + fmt(rollup.receivables) + '</span></div>' +
        '<div class="view-inv-lc-sub">' +
          e(rollup.cogsLabel) + ' ' + fmt(rollup.cogs) +
          ' · ' + e(rollup.jobInputsLabel) + ' (same pool)' +
        '</div>' +
      '</div>'
    );
  }

  global.InvoiceLifecycle = {
    isLifecycleParent: isLifecycleParent,
    rollup: rollup,
    stripHtml: stripHtml,
  };

}(window));
