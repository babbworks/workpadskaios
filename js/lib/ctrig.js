// ctrig.js — C-TRIG obligation bytecode evaluator
// Spec: CTRIG-EVALUATOR-DESIGN.md, AGREEMENTS-DESIGN.md §3
// Max program: 32 bytes. Max stack depth: 8. Stateless between runs.
// Returns: { status: 'resolved'|'halted'|'error', value?: bool, reason?: string }
// Exposes: global.WPCtrig

'use strict';

(function(global) {

  var EVALUATOR_VERSION  = 1;
  var SUPPORTED_FEATURES = 0x07;  // bits 0-2 always 1 in v1

  // ── Direct condition IDs (0x00–0x0E) ─────────────────────────────────────────

  var COND_HAS_PHONE             = 0x00;
  var COND_IS_ORG                = 0x01;
  var COND_ROLE_TYPE_CUSTOMER    = 0x02;
  var COND_ROLE_TYPE_WORKER      = 0x03;
  var COND_HAS_FINANCIAL_BLOCK   = 0x04;
  var COND_DATE_REACHED          = 0x05;
  var COND_HAS_LOCATION          = 0x06;
  var COND_IS_CHAIN              = 0x07;
  var COND_ACK_RECEIVED          = 0x08;
  var COND_PAYMENT_CONFIRMED     = 0x09;
  var COND_MILESTONE_MET         = 0x0A;
  var COND_RATIFICATION_COMPLETE = 0x0B;
  var COND_HAS_COMPOUND          = 0x0C;
  var COND_DISPUTED              = 0x0D;
  var COND_HAS_TRIG              = 0x0E;

  // ── COMPARE_AMT operator table (array of functions, not eval()) ───────────────

  var cmpTable = [
    function(a, b) { return a >= b; },
    function(a, b) { return a > b;  },
    function(a, b) { return a === b; },
    function(a, b) { return a < b;  },
    function(a, b) { return a <= b; },
    function(a, b) { return a !== b; }
  ];

  // ── Direct condition resolver ─────────────────────────────────────────────────

  function resolveDirect(id, context) {
    var r  = context.record    || {};
    var c  = context.chain     || {};
    var ts = context.timestamp || 0;
    switch (id) {
      case COND_HAS_PHONE:
        return (r.participants || []).some(function(p) { return !!p.has_phone; });
      case COND_IS_ORG:
        return (r.participants || []).some(function(p) { return !!p.is_org; });
      case COND_ROLE_TYPE_CUSTOMER:
        return (r.participants || []).some(function(p) { return p.role_type === 0; });
      case COND_ROLE_TYPE_WORKER:
        return (r.participants || []).some(function(p) { return p.role_type === 1; });
      case COND_HAS_FINANCIAL_BLOCK:
        return !!(r.has_financial_block);
      case COND_DATE_REACHED:
        return ts >= (r.date || 0);
      case COND_HAS_LOCATION:
        return r.location != null && r.location !== '';
      case COND_IS_CHAIN:
        return !!(r.meta1 && r.meta1.chain);
      case COND_ACK_RECEIVED:
        return (c.ack_count || 0) > 0;
      case COND_PAYMENT_CONFIRMED:
        return (c.records || []).some(function(r2) { return r2.template === 5 && r2.commit_type === 1; });
      case COND_MILESTONE_MET:
        return !!(c.milestone_states && c.milestone_states[0]);
      case COND_RATIFICATION_COMPLETE:
        return !!(c.ratified);
      case COND_HAS_COMPOUND:
        return !!(r.setup_byte && r.setup_byte.compound_value === 1);
      case COND_DISPUTED:
        return !!(c.disputed);
      case COND_HAS_TRIG:
        return !!(r.meta2 && r.meta2.has_trig_block);
      default:
        return false;
    }
  }

  // ── Extended condition resolver (CAT:4 ID:4 escape byte) ─────────────────────

  function resolveExtended(escByte, context) {
    var cat = (escByte >> 4) & 0xF;
    var id  = escByte & 0xF;
    var r   = context.record  || {};
    var c   = context.chain   || {};
    var ts  = context.timestamp || 0;
    switch (cat) {
      case 0x0: // Time/date
        switch (id) {
          case 0x0: return ts >= (r.date || 0);
          case 0x1: return ts >= (c.timelockDate || 0);
          case 0x2: return ts >= (r.date_start || 0) && ts <= (r.date_end != null ? r.date_end : Infinity);
          case 0x3: return r.due_date != null && ts > (r.due_date || 0);
          default:  return false;
        }
      case 0x1: // Payment
        switch (id) {
          case 0x0: return !!(c.deposit_confirmed);
          case 0x1: return !!(c.amount_threshold_met);
          case 0x2: {
            var fin = c.financial || {}; var paid = fin.paid || 0; var total = fin.total || 0;
            return total > 0 && paid >= total;
          }
          case 0x3: {
            var fin2 = c.financial || {}; var paid2 = fin2.paid || 0; var total2 = fin2.total || 0;
            return total2 > 0 && paid2 > 0 && paid2 < total2;
          }
          default: return false;
        }
      case 0x2: // Identity/role
        switch (id) {
          case 0x0: return !!(c.role_verified);
          case 0x1: return !!(c.cert_held);
          case 0x2: return !!(c.quorum_met);
          case 0x3: return !!(c.lead_party_confirmed);
          default:  return false;
        }
      case 0x3: // Chain/state
        switch (id) {
          case 0x0: { var ms = c.milestone_states || []; return ms.length > 0 && ms.every(Boolean); }
          case 0x1: return !!(c.chain_complete);
          case 0x2: return (c.records || []).some(function(rec) { return rec.template === 6; });
          case 0x3: return (c.records || []).length >= (c.depth_threshold || 2);
          default:  return false;
        }
      case 0x4: // Document/ACK
        switch (id) {
          case 0x0: return (c.records || []).some(function(r3) { return r3.template === 5 && r3.commit_type === 1; });
          case 0x1: return !!(c.satisfaction_confirmed);
          case 0x2: return !!(c.signature_present);
          case 0x3: return (c.records || []).some(function(r4) { return r4.template === 5 && r4.commit_type === 2; });
          default:  return false;
        }
      case 0x6: // Server/async
        if (id === 0x0) return !!(context.serverResults && context.serverResults['server_evaluation']);
        return false;
      default:
        return null;  // unknown category → HALT
    }
  }

  // ── TIME_LOCK milestone date resolution ───────────────────────────────────────

  function milestoneDate(imm, context) {
    if (imm === 0xF) {
      var rec = context.record || {};
      return rec.due_date != null ? rec.due_date : null;
    }
    var ms = (context.chain && context.chain.milestone_states) || [];
    var m  = ms[imm];
    if (m == null || m === false) return null;
    if (typeof m === 'object' && m.date != null) return m.date;
    if (typeof m === 'number') return m;
    return null;
  }

  // ── Main evaluator ────────────────────────────────────────────────────────────

  function evaluate(program, context) {
    context = context || {};
    if (!program || program.length === 0) return { status: 'resolved', value: true };

    var bytes = program instanceof Uint8Array ? program : new Uint8Array(program);
    if (bytes.length > 32) return { status: 'error', reason: 'program_too_long' };

    var stack   = [];
    var pc      = 0;

    while (pc < bytes.length) {
      if (stack.length > 8) return { status: 'error', reason: 'stack_overflow' };

      var b       = bytes[pc];
      var opcode  = (b >> 4) & 0xF;
      var imm     = b & 0xF;
      var advance = true;

      switch (opcode) {

        case 0x0: { // COMPARE_AMT — pop b then a, compare, push bool
          var bv = stack.length > 0 ? stack.pop() : 0;
          var av = stack.length > 0 ? stack.pop() : 0;
          if (imm === 0xF) {
            pc++;
            if (pc >= bytes.length) return { status: 'error', reason: 'unexpected_end' };
            var pct = bytes[pc];
            stack.push(av >= Math.round(bv * pct / 200));
          } else if (imm < cmpTable.length) {
            stack.push(cmpTable[imm](av, bv));
          } else {
            return { status: 'error', reason: 'invalid_operator' };
          }
          break;
        }

        case 0x1: { // PUSH_COND
          var cond;
          if (imm === 0xF) {
            pc++;
            if (pc >= bytes.length) return { status: 'error', reason: 'unexpected_end' };
            cond = resolveExtended(bytes[pc], context);
            if (cond === null) return { status: 'halted', reason: 'unknown_condition' };
          } else {
            cond = resolveDirect(imm, context);
          }
          stack.push(!!cond);
          break;
        }

        case 0x2: // RELEASE_AMT — pre-fill payment request; push true
          if (context.app) context.app.prefillRecord('payment_request', { milestone: imm });
          stack.push(true);
          break;

        case 0x3: // TRIGGER_OBL — pre-fill obligation; push true
          if (context.app) context.app.prefillRecord('obligation', { clause: imm });
          stack.push(true);
          break;

        case 0x4: // ASSERT_STATE — pre-fill state commit; push true
          if (context.app) context.app.prefillRecord('state_commit', { state: imm });
          stack.push(true);
          break;

        case 0x5: // REQUIRE_ACK
          stack.push((context.chain && (context.chain.ack_count || 0) > 0) || false);
          break;

        case 0x6: { // TIME_LOCK
          var lockDate = milestoneDate(imm, context);
          if (lockDate === null) return { status: 'halted', reason: 'timelock_date_missing' };
          if ((context.timestamp || 0) < lockDate) return { status: 'halted', reason: 'timelock' };
          stack.push(true);
          break;
        }

        case 0x7: // MARKER_WRITE — pre-fill marker write; push true
          if (context.app) context.app.prefillRecord('marker_write', { party: imm });
          stack.push(true);
          break;

        case 0x8: { // AND
          var b8 = stack.length > 0 ? stack.pop() : false;
          var a8 = stack.length > 0 ? stack.pop() : false;
          stack.push(!!(a8 && b8));
          break;
        }

        case 0x9: { // OR
          var b9 = stack.length > 0 ? stack.pop() : false;
          var a9 = stack.length > 0 ? stack.pop() : false;
          stack.push(!!(a9 || b9));
          break;
        }

        case 0xA: { // NOT
          var aA = stack.length > 0 ? stack.pop() : false;
          stack.push(!aA);
          break;
        }

        case 0xB: { // IF_THEN — if !cond, skip next instruction
          var condB = stack.length > 0 ? stack.pop() : false;
          if (!condB) pc++;
          break;
        }

        case 0xC: { // BRANCH (3-byte): pop cond; jump to pc_after + (cond ? true_off : false_off)
          var condC       = stack.length > 0 ? stack.pop() : false;
          var trueOffset  = bytes[pc + 1] || 0;
          var falseOffset = bytes[pc + 2] || 0;
          var pcAfter     = pc + 3;
          var offset      = condC ? trueOffset : falseOffset;
          var targetPc    = pcAfter + offset;
          if (targetPc >= bytes.length || targetPc >= 32) {
            return { status: 'error', reason: 'branch_out_of_bounds' };
          }
          pc      = targetPc;
          advance = false;
          break;
        }

        case 0xD: // COMPLETE — agreement fulfilled
          if (context.app) context.app.prefillRecord('completion');
          return { status: 'resolved', value: true };

        case 0xE: // DISPUTE — agreement disputed
          if (context.app) context.app.prefillRecord('dispute', { clause: imm });
          return { status: 'resolved', value: false };

        case 0xF: { // VERSION (3-byte: opcode + min_version + feature_flags)
          pc++;
          if (pc >= bytes.length) return { status: 'error', reason: 'unexpected_end' };
          var minVer    = bytes[pc];
          pc++;
          if (pc >= bytes.length) return { status: 'error', reason: 'unexpected_end' };
          var featFlags = bytes[pc];
          if (minVer > EVALUATOR_VERSION) return { status: 'halted', reason: 'version_unsupported' };
          if (featFlags & ~SUPPORTED_FEATURES) return { status: 'halted', reason: 'unsupported_features' };
          break;
        }

        default:
          return { status: 'error', reason: 'unknown_opcode' };
      }

      if (advance) pc++;
    }

    var result = stack.reduce(function(acc, v) { return acc && !!v; }, true);
    return { status: 'resolved', value: result };
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  global.WPCtrig = {
    evaluate:      evaluate,
    resolveDirect: resolveDirect,
    COND_HAS_PHONE:             COND_HAS_PHONE,
    COND_IS_ORG:                COND_IS_ORG,
    COND_ROLE_TYPE_CUSTOMER:    COND_ROLE_TYPE_CUSTOMER,
    COND_ROLE_TYPE_WORKER:      COND_ROLE_TYPE_WORKER,
    COND_HAS_FINANCIAL_BLOCK:   COND_HAS_FINANCIAL_BLOCK,
    COND_DATE_REACHED:          COND_DATE_REACHED,
    COND_HAS_LOCATION:          COND_HAS_LOCATION,
    COND_IS_CHAIN:              COND_IS_CHAIN,
    COND_ACK_RECEIVED:          COND_ACK_RECEIVED,
    COND_PAYMENT_CONFIRMED:     COND_PAYMENT_CONFIRMED,
    COND_MILESTONE_MET:         COND_MILESTONE_MET,
    COND_RATIFICATION_COMPLETE: COND_RATIFICATION_COMPLETE,
    COND_HAS_COMPOUND:          COND_HAS_COMPOUND,
    COND_DISPUTED:              COND_DISPUTED,
    COND_HAS_TRIG:              COND_HAS_TRIG,
    EVALUATOR_VERSION:          EVALUATOR_VERSION,
    SUPPORTED_FEATURES:         SUPPORTED_FEATURES
  };

}(typeof window !== 'undefined' ? window : global));
