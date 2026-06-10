// programmable-rules.js — v0.4 obligation primitives (G6 wire)
// Spec: PROGRAMMABLE-RECORDS-LOCKED.md
(function(global) {
  'use strict';

  var TAG = 0x50;
  var VER = 0x01;
  var MAX_RULES = 8;
  var MAX_ARG = 4;

  var OP = {
    when_confirmed: 0,
    when_declined: 1,
    when_paid: 2,
    when_date_before: 3,
    when_date_reached: 4,
    when_ack_received: 5
  };

  var OP_NAME = [
    'when_confirmed', 'when_declined', 'when_paid',
    'when_date_before', 'when_date_reached', 'when_ack_received'
  ];

  var DATE_EPOCH_MS = Date.UTC(2000, 0, 1);

  function dateToDays(iso) {
    if (!iso) return 0;
    try {
      var ms = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
      return Math.max(0, Math.min(65535, Math.round((ms - DATE_EPOCH_MS) / 86400000)));
    } catch (e) { return 0; }
  }

  function daysToDate(days) {
    var d = new Date(DATE_EPOCH_MS + days * 86400000);
    return d.getUTCFullYear() + '-' +
      ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getUTCDate()).slice(-2);
  }

  function normaliseRule(r) {
    if (!r) return null;
    var op = r.op != null ? r.op : OP[r.op_name || r.opName || r.op];
    if (typeof op === 'string') op = OP[op];
    if (op == null || op < 0 || op > 5) return null;
    var out = { op: op, op_name: OP_NAME[op] };
    if (op === OP.when_confirmed || op === OP.when_declined) {
      out.mask = (r.mask != null ? Number(r.mask) : 0) & 0xffff;
    }
    if (op === OP.when_date_before || op === OP.when_date_reached) {
      out.date_days = r.date_days != null ? (r.date_days & 0xffff)
        : dateToDays(r.date || r.until || r.on);
      out.date = daysToDate(out.date_days);
    }
    if (op === OP.when_ack_received) {
      out.party_slot = (r.party_slot != null ? Number(r.party_slot) : 0) & 0xff;
    }
    return out;
  }

  function encodeRuleArgs(rule) {
    var op = rule.op;
    if (op === OP.when_confirmed || op === OP.when_declined) {
      var m = (rule.mask != null ? Number(rule.mask) : 0) & 0xffff;
      return new Uint8Array([m & 0xff, (m >> 8) & 0xff]);
    }
    if (op === OP.when_paid) return new Uint8Array(0);
    if (op === OP.when_date_before || op === OP.when_date_reached) {
      var d = rule.date_days != null ? rule.date_days : dateToDays(rule.date);
      return new Uint8Array([d & 0xff, (d >> 8) & 0xff]);
    }
    if (op === OP.when_ack_received) {
      return new Uint8Array([(rule.party_slot != null ? rule.party_slot : 0) & 0xff]);
    }
    return new Uint8Array(0);
  }

  function encodeBlock(rules) {
    if (!rules || !rules.length) return null;
    var list = [];
    var i, r, nr, args;
    for (i = 0; i < rules.length && list.length < MAX_RULES; i++) {
      nr = normaliseRule(rules[i]);
      if (!nr) continue;
      args = encodeRuleArgs(nr);
      if (args.length > MAX_ARG) throw new Error('WPProgrammableRules: arg too long');
      list.push({ op: nr.op, args: args });
    }
    if (!list.length) return null;
    var size = 3;
    for (i = 0; i < list.length; i++) size += 2 + list[i].args.length;
    var out = new Uint8Array(size);
    var pos = 0;
    out[pos++] = TAG;
    out[pos++] = VER;
    out[pos++] = list.length;
    for (i = 0; i < list.length; i++) {
      out[pos++] = list[i].op;
      out[pos++] = list[i].args.length;
      if (list[i].args.length) {
        out.set(list[i].args, pos);
        pos += list[i].args.length;
      }
    }
    return out;
  }

  function decodeBlock(bytes, pos) {
    pos = pos || 0;
    if (pos >= bytes.length || bytes[pos] !== TAG) return { rules: [], next: pos };
    if (pos + 3 > bytes.length) throw new Error('WPProgrammableRules: truncated header');
    var ver = bytes[pos + 1];
    if (ver !== VER) return { rules: [], next: pos + 2, unknownVersion: ver };
    var count = bytes[pos + 2];
    pos += 3;
    var rules = [], ri, op, alen, args;
    for (ri = 0; ri < count; ri++) {
      if (pos + 2 > bytes.length) throw new Error('WPProgrammableRules: truncated rule');
      op = bytes[pos++];
      alen = bytes[pos++];
      if (pos + alen > bytes.length) throw new Error('WPProgrammableRules: truncated args');
      args = bytes.subarray(pos, pos + alen);
      pos += alen;
      var rule = { op: op, op_name: OP_NAME[op] || ('unknown_' + op) };
      if (op === OP.when_confirmed || op === OP.when_declined) {
        rule.mask = alen >= 2 ? ((args[1] << 8) | args[0]) : 0;
      } else if (op === OP.when_date_before || op === OP.when_date_reached) {
        rule.date_days = alen >= 2 ? ((args[1] << 8) | args[0]) : 0;
        rule.date = daysToDate(rule.date_days);
      } else if (op === OP.when_ack_received) {
        rule.party_slot = alen ? args[0] : 0;
      }
      rules.push(rule);
    }
    return { rules: rules, next: pos };
  }

  function describeRule(rule) {
    rule = normaliseRule(rule);
    if (!rule) return '';
    if (rule.op === OP.when_confirmed) {
      return 'After you confirm actions 0x' + (rule.mask || 0).toString(16);
    }
    if (rule.op === OP.when_declined) {
      return 'If any action 0x' + (rule.mask || 0).toString(16) + ' is declined';
    }
    if (rule.op === OP.when_paid) return 'When payment is recorded on the chain';
    if (rule.op === OP.when_date_before) {
      return 'Valid until ' + (rule.date || daysToDate(rule.date_days));
    }
    if (rule.op === OP.when_date_reached) {
      return 'Active from ' + (rule.date || daysToDate(rule.date_days));
    }
    if (rule.op === OP.when_ack_received) {
      return rule.party_slot ? ('When party slot ' + rule.party_slot + ' acknowledges')
        : 'When acknowledgement is received';
    }
    return 'Program rule';
  }

  function describeAll(rules) {
    if (!rules || !rules.length) return [];
    var out = [], i;
    for (i = 0; i < rules.length; i++) out.push(describeRule(rules[i]));
    return out;
  }

  /** Local evaluator — chain = array of summary records, ctx = { todayDays?, actionMasks? } */
  function evaluate(rules, chain, ctx) {
    ctx = ctx || {};
    chain = chain || [];
    var today = ctx.todayDays != null ? ctx.todayDays : dateToDays(ctx.today || new Date().toISOString().slice(0, 10));
    var results = [], i, rule, ok;
    for (i = 0; i < (rules || []).length; i++) {
      rule = normaliseRule(rules[i]);
      if (!rule) { results.push({ index: i, satisfied: false, unknown: true }); continue; }
      ok = false;
      if (rule.op === OP.when_confirmed) {
        ok = (ctx.confirmed_mask != null) && ((ctx.confirmed_mask & rule.mask) === rule.mask);
      } else if (rule.op === OP.when_declined) {
        ok = (ctx.declined_mask != null) && ((ctx.declined_mask & rule.mask) !== 0);
      } else if (rule.op === OP.when_paid) {
        ok = chain.some(function(c) {
          return (c.record_type || '').toLowerCase() === 'payment' ||
            (c.relationship || '') === 'pays';
        });
      } else if (rule.op === OP.when_date_before) {
        ok = today < rule.date_days;
      } else if (rule.op === OP.when_date_reached) {
        ok = today >= rule.date_days;
      } else if (rule.op === OP.when_ack_received) {
        ok = chain.some(function(c) {
          var ack = (c.relationship || '') === 'acknowledges' ||
            (c.record_type || '').toLowerCase() === 'ack';
          if (!ack) return false;
          if (!rule.party_slot) return true;
          return c.party_slot === rule.party_slot;
        });
      }
      results.push({ index: i, op: rule.op_name, satisfied: ok });
    }
    return results;
  }

  global.WPProgrammableRules = {
    TAG: TAG,
    OP: OP,
    OP_NAME: OP_NAME,
    dateToDays: dateToDays,
    daysToDate: daysToDate,
    normaliseRule: normaliseRule,
    encodeBlock: encodeBlock,
    decodeBlock: decodeBlock,
    describeRule: describeRule,
    describeAll: describeAll,
    evaluate: evaluate
  };

}(typeof window !== 'undefined' ? window : global));
