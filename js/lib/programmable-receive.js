// programmable-receive.js — receive-side obligation hints + fired state (A2)
// Exposes: window.WPProgrammableReceive

(function(global) {
  'use strict';

  function PR() {
    return global.WPProgrammableRules;
  }

  function CE() {
    return global.WPChainExecution;
  }

  function chainFor(rec, all) {
    if (!rec || !all) return [];
    if (rec.chainRef) {
      return all.filter(function(r) { return r.chainRef === rec.chainRef; });
    }
    return [rec];
  }

  function latestAckFor(rec, all) {
    var chain = chainFor(rec, all);
    var i, r, rt, best = null;
    for (i = chain.length - 1; i >= 0; i--) {
      r = chain[i];
      rt = (r.record_type || '').toLowerCase();
      if (rt !== 'ack') continue;
      if (r.ackForId === rec.id) {
        if (!best || (r.createdAt || 0) > (best.createdAt || 0)) best = r;
      }
    }
    return best;
  }

  function buildContext(rec, all) {
    var ctx = {
      today: new Date().toISOString().slice(0, 10),
    };
    var ack = latestAckFor(rec, all);
    if (ack) {
      if (ack.confirmed_mask != null) ctx.confirmed_mask = ack.confirmed_mask;
      if (ack.declined_mask != null) ctx.declined_mask = ack.declined_mask;
    } else if (rec.confirmed_mask != null || rec.declined_mask != null) {
      ctx.confirmed_mask = rec.confirmed_mask;
      ctx.declined_mask = rec.declined_mask;
    }
    return ctx;
  }

  function hasRules(rec) {
    return !!(rec && Array.isArray(rec.programmable_rules) && rec.programmable_rules.length && PR());
  }

  function analyze(rec, all) {
    if (!hasRules(rec)) return null;
    var rules = rec.programmable_rules;
    var hints = rec._programmablePlain && rec._programmablePlain.length
      ? rec._programmablePlain
      : PR().describeAll(rules);
    var chain = chainFor(rec, all);
    var ctx = buildContext(rec, all);
    var ev = PR().evaluate(rules, chain, ctx);
    var lines = [];
    var i, fired = 0, pending = 0;
    for (i = 0; i < ev.length; i++) {
      if (ev[i].satisfied) fired++;
      else pending++;
      lines.push({
        index: i,
        hint: hints[i] || PR().describeRule(rules[i]),
        fired: !!ev[i].satisfied,
        pending: !ev[i].satisfied,
        op: ev[i].op,
      });
    }
    var banner;
    if (!lines.length) return null;
    if (pending === 0) {
      banner = 'All ' + fired + ' obligation rule' + (fired === 1 ? '' : 's') + ' satisfied';
    } else if (fired === 0) {
      banner = pending + ' obligation rule' + (pending === 1 ? '' : 's') + ' waiting';
    } else {
      banner = fired + ' fired · ' + pending + ' waiting';
    }
    return {
      lines: lines,
      banner: banner,
      hasPending: pending > 0,
      allFired: pending === 0,
      countFired: fired,
      countPending: pending,
      received: !!rec.receivedAt,
    };
  }

  function listPill(rec, all) {
    var a = analyze(rec, all);
    if (!a) return '';
    if (a.allFired) {
      return '<span class="ls-pill ls-pill-prog-done" title="' + escAttr(a.banner) + '">Oblig \u2713</span>';
    }
    return '<span class="ls-pill ls-pill-prog-wait" title="' + escAttr(a.banner) + '">\u25d0 ' +
      a.countPending + ' wait</span>';
  }

  function escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function renderViewSection(rec, all) {
    var a = analyze(rec, all);
    if (!a) return '';
    var html = '';
    if (a.received) {
      html += '<div class="view-pr-banner' + (a.hasPending ? ' is-pending' : ' is-done') + '">' +
        escHtml(a.banner) + '</div>';
    }
    var i, rowCls;
    for (i = 0; i < a.lines.length; i++) {
      rowCls = a.lines[i].fired ? ' pr-line-fired' : ' pr-line-wait';
      html += '<div class="view-field pr-line' + rowCls + '">' +
        '<div class="view-field-label">Rule ' + (i + 1) + '</div>' +
        '<div class="view-field-value">' +
          (a.lines[i].fired ? '<span class="pr-state pr-ok">Fired</span> ' : '<span class="pr-state pr-wait">Waiting</span> ') +
          escHtml(a.lines[i].hint) +
        '</div></div>';
    }
    return html;
  }

  function escHtml(s) {
    if (global.esc) return global.esc(s);
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function needsActionFromRules(rec, all) {
    var a = analyze(rec, all);
    if (!a || !a.hasPending) return false;
    var i;
    for (i = 0; i < a.lines.length; i++) {
      if (!a.lines[i].pending) continue;
      if (a.lines[i].op === 'when_confirmed' || a.lines[i].op === 'when_declined') return true;
    }
    return false;
  }

  global.WPProgrammableReceive = {
    hasRules: hasRules,
    buildContext: buildContext,
    analyze: analyze,
    listPill: listPill,
    renderViewSection: renderViewSection,
    needsActionFromRules: needsActionFromRules,
  };

}(typeof window !== 'undefined' ? window : global));
