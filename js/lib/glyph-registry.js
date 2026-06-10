// glyph-registry.js — Phase 6 v1 glyph + chain mode registry (display only)
// Source: research/Main Glyph & Group Ref Docs/Workpads — Glyph Taxonomy…
// Exposes: window.GlyphRegistry

(function(global) {
  'use strict';

  /** @type {Record<string, {ch:string, accent:string, label?:string, noc?:boolean}>} */
  var RECORD = {
    invoice:      { ch: '\u25fc', accent: 'wp-rt-invoice',      label: 'Invoice' },
    quote:        { ch: '\u25fb', accent: 'wp-rt-quote',        label: 'Quote' },
    task:         { ch: '\u25b6', accent: 'wp-rt-task',         label: 'Task' },
    log:          { ch: '\u25cf', accent: 'wp-rt-log',          label: 'Log' },
    note:         { ch: '\u25cb', accent: 'wp-rt-note',         label: 'Note' },
    payment:      { ch: '\u25c6', accent: 'wp-rt-payment',      label: 'Payment' },
    order:        { ch: '\u25b7', accent: 'wp-rt-order',        label: 'Order' },
    receipt:      { ch: '\u25c8', accent: 'wp-rt-receipt',      label: 'Receipt' },
    report:       { ch: '\u25ac', accent: 'wp-rt-report',       label: 'Report' },
    contract:     { ch: '\u25a0', accent: 'wp-rt-contract',     label: 'Contract' },
    work_record:  { ch: '\u25b2', accent: 'wp-rt-work_record',  label: 'Work' },
    job:          { ch: '\u25b2', accent: 'wp-rt-work_record',  label: 'Job' },
    schedule:     { ch: '\u25c7', accent: 'wp-rt-schedule',     label: 'Schedule' },
    broadcast:    { ch: '\u25c9', accent: 'wp-rt-broadcast',    label: 'Broadcast' },
    template:     { ch: '\u22a1', accent: 'wp-rt-template',     label: 'Template' },
    credit_note:  { ch: '\u25c0', accent: 'wp-rt-credit_note',  label: 'Credit note' },
    expense:      { ch: '\u25fb', accent: 'wp-rt-expense',      label: 'Expense' },
    income:       { ch: '\u25c6', accent: 'wp-rt-income',       label: 'Income' },
    need:         { ch: '\u25c9', accent: 'wp-rt-need',         label: 'Need', noc: true },
    offer:        { ch: '\u25ce', accent: 'wp-rt-offer',        label: 'Offer', noc: true },
    connection:   { ch: '\u21c4', accent: 'wp-rt-connection',   label: 'Connection', noc: true },
    state_commit: { ch: '\u25fc', accent: 'wp-rt-closing',      label: 'Closed' },
    amendment:    { ch: '\u25b7', accent: 'wp-rt-amendment',    label: 'Amendment' },
    dispute:      { ch: '\u2260', accent: 'wp-rt-dispute',      label: 'Dispute' },
    ack:          { ch: '\u2713', accent: 'wp-rt-ack',          label: 'Ack' },
  };

  var CHAIN_MODE = {
    FIRST:          '\u22b3',
    INITIATING:     '\u22b3',
    OBLIGATING:     '\u21d2',
    INFORMATIONAL:  '\u2192',
    CLOSING:        '\u25fc',
    CLOSED:         '\u25fc',
    DISPUTING:      '\u2260',
    WITNESSING:     '\u2295',
    LIVE:           '\u2192',
  };

  var CHAIN_CONNECTOR = {
    first:    '\u22b3',
    closing:  '\u25fc',
    open:     '\u21d2',
    mid:      '\u2500',
    commit:   '\u25ce',
  };

  function rt(rec) {
    return (rec && (rec.record_type || rec.recordType || '')).toLowerCase();
  }

  function recordEntry(rec) {
    var t = rt(rec);
    if (RECORD[t]) return RECORD[t];
    if (!t) return RECORD.work_record;
    return { ch: t.slice(0, 1).toUpperCase(), accent: 'wp-rt-generic', label: t };
  }

  function recordGlyph(rec) {
    return recordEntry(rec).ch;
  }

  function recordAccentClass(rec) {
    return recordEntry(rec).accent;
  }

  function recordLabel(rec) {
    var e = recordEntry(rec);
    return e.label || rt(rec);
  }

  function chainModeGlyph(mode) {
    if (!mode) return CHAIN_MODE.INFORMATIONAL;
    var k = String(mode).toUpperCase().replace(/-/g, '_');
    return CHAIN_MODE[k] || CHAIN_MODE.INFORMATIONAL;
  }

  function inferChainMode(rec, ctx) {
    if (!rec) return 'INFORMATIONAL';
    if (rec.chain_mode) return String(rec.chain_mode).toUpperCase();
    if (rec.chainComplete || rt(rec) === 'state_commit') return 'CLOSING';
    if (rec.disputeFlag || rt(rec) === 'dispute') return 'DISPUTING';
    if (ctx && ctx.pending) return 'OBLIGATING';
    if (ctx && ctx.idx === 0) return 'FIRST';
    return 'INFORMATIONAL';
  }

  function chainConnector(rec, idx, total, pending) {
    if (idx === 0) return CHAIN_CONNECTOR.first;
    if (rt(rec) === 'state_commit' || rec.chainComplete) return CHAIN_CONNECTOR.closing;
    if (pending) return CHAIN_CONNECTOR.open;
    return CHAIN_CONNECTOR.mid;
  }

  function exportJson() {
    return { version: 1, record: RECORD, chain_mode: CHAIN_MODE };
  }

  global.GlyphRegistry = {
    RECORD: RECORD,
    CHAIN_MODE: CHAIN_MODE,
    recordGlyph: recordGlyph,
    recordAccentClass: recordAccentClass,
    recordLabel: recordLabel,
    recordEntry: recordEntry,
    chainModeGlyph: chainModeGlyph,
    inferChainMode: inferChainMode,
    chainConnector: chainConnector,
    exportJson: exportJson,
    rt: rt,
  };

}(window));
