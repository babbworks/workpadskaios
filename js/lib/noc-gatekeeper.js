// noc-gatekeeper.js — NOC-06 connection gatekeeper (light ack + relay confirm)
// Spec: CHAIN-EXECUTION-LOCKED CE-09/10, ROUND-A1 NOC-06
(function(global) {
  'use strict';

  var GATE_TYPES = {
    light_ack: {
      id: 'light_ack',
      label: 'Light ack on share',
      hint: 'Sends informational acknowledgement on the wire — no action list.',
    },
    relay_note: {
      id: 'relay_note',
      label: 'Relay note only',
      hint: 'Share without automatic light ack; confirm relay locally when ready.',
    },
    sale_confirmed: {
      id: 'sale_confirmed',
      label: 'Await sale confirmed',
      hint: 'Light ack on share; mark sale confirmed when referral pays off.',
    },
  };

  function rt(rec) {
    return (rec && rec.record_type || '').toLowerCase();
  }

  function isConnection(rec) {
    return rt(rec) === 'connection';
  }

  function getGateType(rec) {
    if (!rec) return 'light_ack';
    return rec.gatekeeper_type || (rec.informational_ack ? 'light_ack' : 'relay_note');
  }

  function policyLabel(type) {
    var g = GATE_TYPES[type] || GATE_TYPES.light_ack;
    return g.label;
  }

  function policyHint(type) {
    var g = GATE_TYPES[type] || GATE_TYPES.light_ack;
    return g.hint;
  }

  function defaultsForGateType(type) {
    type = type || 'light_ack';
    if (type === 'relay_note') {
      return {
        gatekeeper_type: 'relay_note',
        informational_ack: false,
        pure_connection: true,
        connection_ack: 'pending',
      };
    }
    if (type === 'sale_confirmed') {
      return {
        gatekeeper_type: 'sale_confirmed',
        informational_ack: true,
        pure_connection: true,
        connection_ack: 'pending',
      };
    }
    return {
      gatekeeper_type: 'light_ack',
      informational_ack: true,
      pure_connection: true,
      connection_ack: 'pending',
    };
  }

  function applyPolicyToRecord(rec, type) {
    var d = defaultsForGateType(type);
    rec.gatekeeper_type = d.gatekeeper_type;
    rec.informational_ack = d.informational_ack;
    rec.pure_connection = d.pure_connection;
    if (!rec.connection_ack) rec.connection_ack = d.connection_ack;
    return rec;
  }

  function hasLightAckOnChain(targetId, all) {
    if (!targetId || !all || !global.WPChainExecution) return false;
    return WPChainExecution.hasAckForTarget(targetId, all);
  }

  function needsGatekeeperReceive(rec, all) {
    if (!isConnection(rec)) return false;
    if (!rec.receivedAt) return false;
    if (hasLightAckOnChain(rec.id, all)) return false;
    var gt = getGateType(rec);
    if (gt === 'relay_note' && !rec.informational_ack) return false;
    return !!(rec.informational_ack || gt === 'light_ack' || gt === 'sale_confirmed');
  }

  function relayPending(rec) {
    return isConnection(rec) && (rec.connection_ack || 'pending') !== 'confirmed';
  }

  function createLightAckRecord(parent) {
    if (!parent || typeof RecordService === 'undefined') {
      return Promise.reject(new Error('NOC gatekeeper: RecordService missing'));
    }
    return RecordService.create({
      record_type: 'ack',
      relationship: 'acknowledges',
      confirmed_mask: 0,
      declined_mask: 0,
      informational_ack: true,
      chainRef: parent.chainRef || null,
      ackForId: parent.id,
      job: 'Light ack: ' + (parent.job || parent.relay_to || 'connection'),
      customer: parent.customer || parent.relay_to || '',
      date: new Date().toISOString().slice(0, 10),
      draft: false,
    });
  }

  function confirmRelayLocal(rec) {
    if (!rec || !rec.id) return Promise.reject(new Error('No record id'));
    return RecordService.save(rec.id, { connection_ack: 'confirmed' });
  }

  function markSaleConfirmed(connectionRec, saleRec) {
    if (global.SocialLedger) {
      SocialLedger.onSaleConfirmed(saleRec || null, connectionRec);
    }
    if (!connectionRec || !connectionRec.id) return Promise.resolve(connectionRec);
    return RecordService.save(connectionRec.id, {
      connection_ack: 'confirmed',
      gatekeeper_sale_confirmed: true,
    });
  }

  function shareNoteHtml(rec) {
    if (!isConnection(rec)) return '';
    var gt = getGateType(rec);
    var g = GATE_TYPES[gt] || GATE_TYPES.light_ack;
    return '<div class="share-amend-note">Gatekeeper: ' + esc(g.label) + ' — ' + esc(g.hint) + '</div>';
  }

  global.WPNocGatekeeper = {
    GATE_TYPES: GATE_TYPES,
    isConnection: isConnection,
    getGateType: getGateType,
    policyLabel: policyLabel,
    policyHint: policyHint,
    defaultsForGateType: defaultsForGateType,
    applyPolicyToRecord: applyPolicyToRecord,
    needsGatekeeperReceive: needsGatekeeperReceive,
    relayPending: relayPending,
    hasLightAckOnChain: hasLightAckOnChain,
    createLightAckRecord: createLightAckRecord,
    confirmRelayLocal: confirmRelayLocal,
    markSaleConfirmed: markSaleConfirmed,
    shareNoteHtml: shareNoteHtml,
  };

}(typeof window !== 'undefined' ? window : global));
