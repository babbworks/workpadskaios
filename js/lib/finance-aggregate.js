// FinanceAggregate — shared panel + finance overview rollups (R7.2)
// Exposes: window.FinanceAggregate

(function(global) {
  'use strict';

  function computeAggregate(summaries, liabTotals, liabByc) {
    liabTotals = liabTotals || { payables: 0, receivables: 0, loansOwing: 0, loansOwed: 0 };
    liabByc    = liabByc    || {};
    var billed = 0, collected = 0, receivables = 0, sales = 0;
    var totalCharges = 0, totalTaxes = 0;
    var totalExpenses = 0, billableExp = 0, realJobCosts = 0;
    var count = summaries.length;
    var profileCur = '';
    if (typeof ActivityService !== 'undefined') {
      profileCur = (ActivityService.getLocale().currency || '').toUpperCase();
    }
    var byc = {};
    var i, s, cur, inProfile;

    for (i = 0; i < summaries.length; i++) {
      s = summaries[i];
      cur = s._currency || 'unknown';
      inProfile = !profileCur || cur === profileCur;
      if (inProfile) {
        billed       += s.price;
        collected    += s.paidTotal;
        if (s.outstanding > 0) receivables += s.outstanding;
        if (s._recordType === 'invoice' || s._recordType === 'sale') sales += s.price;
        totalCharges += s.total;
        totalTaxes   += s.tax;
        billableExp  += s.billedTotal;
        realJobCosts += s.cogsTotal;
        totalExpenses += s.billedTotal + s.cogsTotal;
      }
      if (global.CurrencyUtil) {
        CurrencyUtil.addKeyed(byc, cur, 'billed', s.price);
        CurrencyUtil.addKeyed(byc, cur, 'collected', s.paidTotal);
        if (s.outstanding > 0) CurrencyUtil.addKeyed(byc, cur, 'receivables', s.outstanding);
        CurrencyUtil.addKeyed(byc, cur, 'expenses', s.billedTotal + s.cogsTotal);
      }
    }
    Object.keys(liabByc).forEach(function(c) {
      var lb = liabByc[c];
      if (global.CurrencyUtil) {
        if (lb.payables)    CurrencyUtil.addKeyed(byc, c, 'payables', lb.payables);
        if (lb.receivables) CurrencyUtil.addKeyed(byc, c, 'receivables', lb.receivables);
        if (lb.loansOwing)  CurrencyUtil.addKeyed(byc, c, 'loansOwing', lb.loansOwing);
        if (lb.loansOwed)   CurrencyUtil.addKeyed(byc, c, 'loansOwed', lb.loansOwed);
      }
    });

    receivables += liabTotals.receivables;
    var payables   = liabTotals.payables;
    var loansOwing = liabTotals.loansOwing;
    var loansOwed  = liabTotals.loansOwed;
    var loans      = loansOwing - loansOwed;
    var rpl        = receivables - payables - loansOwing;

    return {
      billed: billed, collected: collected, receivables: receivables, sales: sales,
      payables: payables, loans: loans, loansOwing: loansOwing, loansOwed: loansOwed,
      rpl: rpl, rp: receivables - payables,
      totalCharges: totalCharges, jobCharges: billed, totalTaxes: totalTaxes,
      totalExpenses: totalExpenses, billableExpenses: billableExp,
      realJobCosts: realJobCosts, operatingCosts: 0,
      jobCostMargin: billed > 0 ? (billed - billableExp) / billed * 100 : 0,
      totalJobMargin: billed > 0 ? (billed - totalExpenses) / billed * 100 : 0,
      estJobCosts: 0, actJobCosts: realJobCosts, jobCostSplit: realJobCosts,
      estOpCosts: 0, actOpCosts: 0, opCostSplit: 0,
      operatingMargin: 0,
      grossMarginPct: billed > 0 ? (billed - billableExp - realJobCosts) / billed * 100 : 0,
      netMarginPct: billed > 0 ? (billed - totalExpenses) / billed * 100 : 0,
      expenseRatio: billed > 0 ? totalExpenses / billed * 100 : 0,
      avgRevPerJob: count > 0 ? billed / count : 0,
      byc: byc,
    };
  }

  global.FinanceAggregate = {
    computeAggregate: computeAggregate,
  };

}(window));
