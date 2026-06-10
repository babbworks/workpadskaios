// trig.js — TRIG display-trigger bytecode evaluator
// In index.html (P4 TRIG receive/display) — see dev_daily/shrink/TRIG-RESHELL.md
// Tests: codec-pads-v1.test.js via readFileSync.
// Spec: OQ-32 in OPEN-QUESTIONS.md, TRIG-DESIGN.md
// Evaluation is purely local (no network calls).
// Exposes: global.WPTrig

'use strict';

(function(global) {

  // ── Condition IDs ─────────────────────────────────────────────────────────────

  var COND_HAS_APP        = 0;
  var COND_KNOWN_CONTACT  = 1;
  var COND_CODE_VERIFIED  = 2;
  var COND_IS_HUMAN       = 3;
  var COND_HAS_SAVED_REC  = 4;
  var COND_ORG_MATCH      = 5;
  var COND_HAS_TEMPLATE   = 6;
  var COND_DAYLIGHT_HOURS = 7;
  var COND_RECENT_CONTACT = 8;
  var COND_APP_VERSION_OK = 9;
  var COND_REPLY_PENDING  = 10;
  var COND_LOCATION_NEAR  = 11;

  // Display mode IDs (SHOW / SHOW_ALWAYS / TERNARY ARG)
  var MODE_CARD   = 0;
  var MODE_LIST   = 1;
  var MODE_FORM   = 2;
  var MODE_MINIMAL = 3;
  var MODE_TICKER = 4;
  var MODE_BLANK  = 5;
  var MODE_NATIVE = 6;

  // ── Condition resolver ────────────────────────────────────────────────────────
  // ctx = caller-supplied device state object; all properties optional

  function evalCondition(id, ctx) {
    ctx = ctx || {};
    switch (id) {
      case COND_HAS_APP:        return !!ctx.hasApp;
      case COND_KNOWN_CONTACT:  return !!ctx.knownContact;
      case COND_CODE_VERIFIED:  return !!ctx.codeVerified;
      case COND_IS_HUMAN:       return !!ctx.isHuman;
      case COND_HAS_SAVED_REC:  return !!ctx.hasSavedRecord;
      case COND_ORG_MATCH:      return !!ctx.orgMatch;
      case COND_HAS_TEMPLATE:   return !!ctx.hasTemplate;
      case COND_DAYLIGHT_HOURS: return !!ctx.daylightHours;
      case COND_RECENT_CONTACT: return !!ctx.recentContact;
      case COND_APP_VERSION_OK: return !!ctx.appVersionOk;
      case COND_REPLY_PENDING:  return !!ctx.replyPending;
      case COND_LOCATION_NEAR:  return !!ctx.locationNear;
      default:                  return false;
    }
  }

  // ── BLOOM (bot-detection capability filter) ───────────────────────────────────
  // filter is a 16-bit bitfield of capability checks. Evaluation is device-local.
  // ctx.bloomResult: caller pre-computes and supplies; null = false (safe default).

  function evalBloom(filter, ctx) {
    return ctx && ctx.bloomResult != null ? !!ctx.bloomResult : false;
  }

  // ── Pattern tokens (1-byte programs, high nibble = 0x0) ──────────────────────
  // Returns a result object directly (no stack machine entered).

  function evaluatePattern(id, ctx) {
    switch (id) {
      case 0x0: return { mode: MODE_CARD,   show: true };
      case 0x1: return { mode: MODE_CARD,   show: evalCondition(COND_KNOWN_CONTACT, ctx) };
      case 0x2: return { mode: MODE_CARD,   show: evalCondition(COND_HAS_APP, ctx) };
      case 0x3: return { mode: MODE_CARD,   show: evalCondition(COND_CODE_VERIFIED, ctx) };
      case 0x4: return { mode: MODE_CARD,   show: evalCondition(COND_IS_HUMAN, ctx) };
      case 0x5: return { mode: MODE_CARD,   show: evalCondition(COND_KNOWN_CONTACT, ctx) || evalCondition(COND_HAS_APP, ctx) };
      case 0x6: return { mode: MODE_CARD,   show: evalCondition(COND_KNOWN_CONTACT, ctx) && evalCondition(COND_HAS_APP, ctx) };
      case 0x7: return { mode: MODE_BLANK,  show: false };
      case 0x8: return { mode: MODE_FORM,   show: true };
      case 0x9: return { mode: MODE_FORM,   show: evalCondition(COND_IS_HUMAN, ctx) };
      case 0xA: return { mode: MODE_LIST,   show: true };
      case 0xB: return { mode: MODE_LIST,   show: evalCondition(COND_KNOWN_CONTACT, ctx) };
      default:  return { mode: MODE_BLANK,  show: false };
    }
  }

  // ── Bytecode program evaluator ────────────────────────────────────────────────

  function evaluate(trigBytes, ctx) {
    // Empty or absent → default SHOW_ALWAYS NATIVE
    if (!trigBytes || trigBytes.length === 0) {
      return { mode: MODE_NATIVE, show: true, css: null, theme: null, js: null };
    }

    var bytes = trigBytes instanceof Uint8Array ? trigBytes : new Uint8Array(trigBytes);

    // Spec violation: trig_len > 20 → shell renders BLANK
    if (bytes.length > 20) {
      return { trig_violation: true, mode: MODE_BLANK, show: false, css: null, theme: null, js: null };
    }

    // Pattern token: single-byte program, high nibble = 0x0
    if (bytes.length === 1 && (bytes[0] & 0xF0) === 0x00) {
      var pr = evaluatePattern(bytes[0] & 0x0F, ctx);
      return Object.assign({ css: null, theme: null, js: null }, pr);
    }

    // Bytecode program: header byte + instruction stream
    var hdr     = bytes[0];
    var ver     = (hdr >> 6) & 0x3;
    if (ver !== 0) {
      return { mode: MODE_BLANK, show: false, css: null, theme: null, js: null };
    }

    var progLen = hdr & 0x0F;
    var ip      = 1;
    if (progLen === 0x0F) { progLen = 15 + (bytes[ip++] || 0); }

    var stack   = [];
    var effects = { css: null, theme: null, js: null };
    var end     = ip + progLen;

    while (ip < end && ip < bytes.length) {
      var b   = bytes[ip++];
      var op  = (b >> 4) & 0xF;
      var arg = b & 0xF;
      if (arg === 0xF && ip < bytes.length) { arg = bytes[ip++]; }

      switch (op) {
        case 0x0: {  // PATTERN — inline expansion
          var pr2 = evaluatePattern(arg, ctx);
          return Object.assign({}, effects, pr2);
        }
        case 0x1:  // LOAD_CSS
          effects.css = arg; break;
        case 0x2:  // SET_LAYOUT
          effects.layout = arg; break;
        case 0x3: {  // SHOW — conditional on top-of-stack
          var cv = stack.length > 0 ? stack.pop() : false;
          return Object.assign({ mode: arg, show: !!cv }, effects);
        }
        case 0x4:  // SHOW_ALWAYS — unconditional
          return Object.assign({ mode: arg, show: true }, effects);
        case 0x5: {  // AND — pop N bools, push all-true result
          var n5 = Math.max(2, Math.min(arg, stack.length));
          var b5 = stack.splice(-n5);
          stack.push(b5.every(Boolean)); break;
        }
        case 0x6: {  // OR — pop N bools, push any-true result
          var n6 = Math.max(2, Math.min(arg, stack.length));
          var b6 = stack.splice(-n6);
          stack.push(b6.some(Boolean)); break;
        }
        case 0x7:  // NOT
          stack.push(!stack.pop()); break;
        case 0x8: {  // JZ — skip bytes if false
          var jv = stack.length > 0 ? stack.pop() : false;
          if (!jv) ip += arg; break;
        }
        case 0x9: {  // TERNARY — 4 bytes: 0x90 cond_id mode_true mode_false
          var condId = bytes[ip++]; var mT = bytes[ip++]; var mF = bytes[ip++];
          var tr = evalCondition(condId, ctx);
          return Object.assign({ mode: tr ? mT : mF, show: true }, effects);
        }
        case 0xA:  // LOAD_JS
          effects.js = arg; break;
        case 0xB:  // SET_THEME
          effects.theme = arg; break;
        case 0xC: {  // BLOOM — 2-byte operand
          var hi = bytes[ip++] || 0; var lo = bytes[ip++] || 0;
          stack.push(evalBloom((hi << 8) | lo, ctx)); break;
        }
        case 0xD:  // PUSH_COND
          stack.push(evalCondition(arg, ctx)); break;
        case 0xE:  // PUSH_LIT
          stack.push(!!(arg & 1)); break;
        // 0xF: EXTENDED — skip instruction byte (forward compat)
        default: if (ip < bytes.length) ip++;
      }
    }

    return Object.assign({ mode: MODE_BLANK, show: false }, effects);
  }

  global.WPTrig = {
    evaluate:        evaluate,
    evaluatePattern: evaluatePattern,
    evalCondition:   evalCondition,
    // condition constants
    COND_HAS_APP:        COND_HAS_APP,
    COND_KNOWN_CONTACT:  COND_KNOWN_CONTACT,
    COND_CODE_VERIFIED:  COND_CODE_VERIFIED,
    COND_IS_HUMAN:       COND_IS_HUMAN,
    // mode constants
    MODE_CARD:   MODE_CARD,
    MODE_LIST:   MODE_LIST,
    MODE_FORM:   MODE_FORM,
    MODE_BLANK:  MODE_BLANK,
    MODE_NATIVE: MODE_NATIVE
  };

}(typeof window !== 'undefined' ? window : global));
