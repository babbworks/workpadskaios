// anon.js — Anonymous mode helpers (DATA_SOURCE=11)
// Spec: draft_specs/ANON-MODE-DESIGN.md §2, §4
// Depends on: nothing (pure logic)
// Exposes: global.WPAnon

'use strict';

(function(global) {

  // ── validateAnonMode ─────────────────────────────────────────────────────────
  // Checks encoding opts for DATA_SOURCE=11 constraint violations.
  // Pass the same opts you intend to pass to WPCodec.encode().
  // Returns { valid: bool, errors: [] }.

  function validateAnonMode(opts) {
    if (!opts) return { valid: true, errors: [] };
    var ds = opts.displaySchema;
    if (!ds || ((ds.dataSource || 0) & 0x3) !== 3) return { valid: true, errors: [] };

    var errors = [];

    // CHAIN must not be set — anon records cannot participate in named chains
    if (opts.chain) errors.push('anon: CHAIN must not be set (DATA_SOURCE=11)');

    // No IS_SENDER participants allowed
    var parts = opts.participants || [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].isSender) {
        errors.push('anon: IS_SENDER participant at index ' + i + ' must be removed');
      }
    }

    // If form is present, SUBMIT_ACTION must be 3 (blind pickup)
    var fs = opts.formSchema;
    if (fs && ds.displayType >= 2) {
      if ((fs.submitAction & 0x3) !== 3) {
        errors.push('anon: form schema SUBMIT_ACTION must be 3 (blind pickup) when DATA_SOURCE=11');
      }
    }

    return { valid: errors.length === 0, errors: errors };
  }

  // ── isAnonMode ───────────────────────────────────────────────────────────────
  // Returns true if a decoded record was encoded in anonymous mode.

  function isAnonMode(record) {
    return !!(record && record._anonMode);
  }

  // ── stripSenderIdentity ──────────────────────────────────────────────────────
  // Returns a shallow copy of opts with anon mode constraints applied:
  // - IS_SENDER participants removed
  // - chain forced to false
  // - formSchema.submitAction forced to 3 (if form present)

  function stripSenderIdentity(opts) {
    if (!opts) return {};
    var result = {};
    for (var k in opts) {
      if (Object.prototype.hasOwnProperty.call(opts, k)) result[k] = opts[k];
    }
    if (opts.participants) {
      result.participants = opts.participants.filter(function(p) { return !p.isSender; });
    }
    result.chain = false;
    if (opts.formSchema) {
      var fs = {};
      for (var fk in opts.formSchema) {
        if (Object.prototype.hasOwnProperty.call(opts.formSchema, fk)) fs[fk] = opts.formSchema[fk];
      }
      fs.submitAction = 3;
      result.formSchema = fs;
    }
    return result;
  }

  // ── export ────────────────────────────────────────────────────────────────────

  global.WPAnon = {
    validateAnonMode:    validateAnonMode,
    isAnonMode:          isAnonMode,
    stripSenderIdentity: stripSenderIdentity
  };

}(typeof window !== 'undefined' ? window : global));
