// FinancialModel — shared financial resolver for parent record + child lines.
// Exposes: window.FinancialModel

(function(global) {
  'use strict';

  var CHARGE_LABELS = {
    '': 'Labour',
    '1': 'Urgency / emergency',
    '2': 'After-hours',
    '3': 'Travel / mileage',
    '4': 'Delivery / courier',
    '5': 'Equipment hire',
    '6': 'Materials',
    '7': 'Subcontractor',
    '8': 'Cancellation fee',
    '9': 'Deposit / retainer',
    '10': 'Credit / discount',
    '11': 'Warranty',
    '12': 'Regulatory levy',
    '13': 'FX adjustment',
    '14': 'Payment handling fee',
  };

  function n(v) { return parseFloat(v || 0) || 0; }

  function splitChildren(children) {
    var expenses = [];
    var payments = [];
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      var rt = c.record_type || c.recordType;
      if (rt === 'payment') payments.push(c);
      else if (rt === 'expense') expenses.push(c);
    }
    return { expenses: expenses, payments: payments };
  }

  function groupByCategory(items) {
    var map = {};
    for (var i = 0; i < items.length; i++) {
      var key = items[i].charge_type != null ? String(items[i].charge_type) : '';
      var label = CHARGE_LABELS[key] || 'Other';
      if (!map[label]) map[label] = 0;
      map[label] += n(items[i].amount);
    }
    return map;
  }

  function groupByAction(items, actions) {
    var out = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var k = it.actionIdx != null ? String(it.actionIdx) : '';
      if (!out[k]) out[k] = { title: '', amount: 0, count: 0 };
      out[k].amount += n(it.amount);
      out[k].count += 1;
    }
    var keys = Object.keys(out);
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      var idx = parseInt(key, 10);
      if (key !== '' && actions && actions[idx]) out[key].title = actions[idx].title || '';
    }
    return out;
  }

  // Mirrors dotme four-tier COGS resolution:
  // 1) linkedExpenseId, 2) actionIdx (sum billed expenses on same action),
  // 3) action_quoted, 4) unlinked.
  function resolveCogs(billedExp, cogsExp) {
    var cogsOverrun = 0;
    var cogsWithinBudget = 0;
    var cogsUnlinked = 0;
    var lines = [];

    for (var i = 0; i < cogsExp.length; i++) {
      var c = cogsExp[i];
      var cAmt = n(c.amount);
      var refAmt = null;
      var refType = 'unlinked';

      if (c.linkedExpenseId) {
        refType = 'linkedExpense';
        for (var bi = 0; bi < billedExp.length; bi++) {
          if (billedExp[bi].id === c.linkedExpenseId) { refAmt = n(billedExp[bi].amount); break; }
        }
      } else if (c.actionIdx != null && c.actionIdx !== '') {
        var actionRef = 0;
        for (var bj = 0; bj < billedExp.length; bj++) {
          if (String(billedExp[bj].actionIdx) === String(c.actionIdx)) actionRef += n(billedExp[bj].amount);
        }
        if (actionRef > 0) { refAmt = actionRef; refType = 'action'; }
      } else if (c.action_quoted != null && c.action_quoted !== '') {
        refAmt = n(c.action_quoted);
        refType = 'quoted';
      }

      var within = 0;
      var overrun = 0;
      if (refAmt != null) {
        within = Math.min(cAmt, refAmt);
        overrun = Math.max(0, cAmt - refAmt);
        cogsWithinBudget += within;
        cogsOverrun += overrun;
      } else {
        cogsUnlinked += cAmt;
      }

      lines.push({
        record: c,
        refType: refType,
        refAmt: refAmt,
        within: within,
        overrun: overrun,
        status: refAmt == null ? 'unlinked' : (overrun > 0 ? 'overrun' : 'within'),
      });
    }

    return {
      lines: lines,
      overrun: cogsOverrun,
      withinBudget: cogsWithinBudget,
      unlinked: cogsUnlinked,
      effectiveCostHit: cogsOverrun + cogsUnlinked,
    };
  }

  function summarize(parentRecord, children) {
    var split = splitChildren(children || []);
    var expenses = split.expenses;
    var payments = split.payments;
    var billedExp = expenses.filter(function(e) { return e.expense_billing !== 'cogs'; });
    var cogsExp   = expenses.filter(function(e) { return e.expense_billing === 'cogs'; });

    var price = n(parentRecord.amount);
    var vatRate = n(parentRecord.vat);
    var tax = price > 0 && vatRate > 0 ? price * vatRate / 100 : 0;
    var total = price + tax;
    var billedTotal = 0, cogsTotal = 0, paidTotal = 0;
    var i;
    for (i = 0; i < billedExp.length; i++) billedTotal += n(billedExp[i].amount);
    for (i = 0; i < cogsExp.length; i++) cogsTotal += n(cogsExp[i].amount);
    for (i = 0; i < payments.length; i++) paidTotal += n(payments[i].amount);

    var cogs = resolveCogs(billedExp, cogsExp);
    var outstanding = total - paidTotal;
    var grossMargin = price - billedTotal;
    var netMargin = price - (billedTotal + cogs.effectiveCostHit);

    return {
      price: price,
      tax: tax,
      total: total,
      paidTotal: paidTotal,
      outstanding: outstanding,
      billedTotal: billedTotal,
      cogsTotal: cogsTotal,
      grossMargin: grossMargin,
      netMargin: netMargin,
      expenses: expenses,
      payments: payments,
      billedExp: billedExp,
      cogsExp: cogsExp,
      cogs: cogs,
      expenseByCategory: groupByCategory(billedExp),
      cogsByCategory: groupByCategory(cogsExp),
      expenseByAction: groupByAction(billedExp, parentRecord.actions || []),
      cogsByAction: groupByAction(cogsExp, parentRecord.actions || []),
    };
  }

  global.FinancialModel = {
    CHARGE_LABELS: CHARGE_LABELS,
    splitChildren: splitChildren,
    resolveCogs: resolveCogs,
    summarize: summarize,
  };

}(window));
