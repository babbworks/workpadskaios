// print-record.js — CT-3 human summary for print / copy (not a hosted service)
// Exposes: window.WPPrintRecord

(function(global) {
  'use strict';

  function lines(rec) {
    if (!rec) return [];
    var out = [];
    var rt = (rec.record_type || rec.record_class || 'record').toLowerCase();
    out.push('WORKPADS · ' + rt.toUpperCase());
    if (rec.job) out.push(rec.job);
    if (rec.customer) out.push('Customer: ' + rec.customer);
    if (rec.worker) out.push('Worker: ' + rec.worker);
    if (rec.date) out.push('Date: ' + rec.date);
    if (rec.amount) {
      out.push('Amount: ' + (rec.currency ? rec.currency + ' ' : '') + rec.amount);
    }
    if (rec.location) out.push('Location: ' + rec.location);
    if (rec.due_date) out.push('Due: ' + rec.due_date);
    if (rec.chainRef) out.push('Chain: ' + rec.chainRef);
    if (rec.uid) out.push('ID: ' + rec.uid);
    if (Array.isArray(rec._programmablePlain) && rec._programmablePlain.length) {
      out.push('Obligations:');
      var i;
      for (i = 0; i < rec._programmablePlain.length; i++) {
        out.push('  · ' + rec._programmablePlain[i]);
      }
    }
    out.push('—');
    out.push('Scan QR or open workpads.me/p link for full record.');
    return out;
  }

  function formatText(rec) {
    return lines(rec).join('\n');
  }

  function options() {
    return [
      { id: 'full_qr', label: 'Full QR', hint: 'Use Share screen URL' },
      { id: 'short_code', label: 'Short code', hint: 'Register @alias in Written code (lab)' },
      { id: 'human', label: 'Human summary', hint: 'This text block for print / SMS intro' },
    ];
  }

  global.WPPrintRecord = {
    lines: lines,
    formatText: formatText,
    options: options,
  };

}(typeof window !== 'undefined' ? window : global));
