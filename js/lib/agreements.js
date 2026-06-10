// agreements.js — Bilateral ratification detection + dispute amendment helpers
// NOT in index.html until agreements UI ships — see dev_daily/shrink/AGREEMENTS-RESHELL.md
// Tests: codec-pads-v1.test.js via readFileSync.
// Spec: AGREEMENTS-DESIGN.md §5, §9
// Exposes: global.WPAgreements

'use strict';

(function(global) {

  // ── Bilateral ratification detection ──────────────────────────────────────────
  // chain: array of chain record summaries (see AGREEMENTS-DESIGN.md §9)
  // Returns true when at least one counterparty has replied with a commit.

  function isRatified(chain) {
    if (!Array.isArray(chain) || chain.length < 2) return false;

    var offer   = null;
    var replies = [];

    for (var i = 0; i < chain.length; i++) {
      var r = chain[i];
      if (r.ack_request && !r.chain) {
        offer = r;
      } else if (r.chain && r.commit_type !== undefined && r.commit_type !== null) {
        replies.push(r);
      }
    }

    if (!offer || replies.length === 0) return false;

    var acceptors = {};
    for (var j = 0; j < replies.length; j++) {
      var rep = replies[j];
      if (rep.sender_uid && rep.sender_uid !== offer.sender_uid) {
        acceptors[rep.sender_uid] = true;
      }
    }

    var threshold    = (offer.threshold_n != null) ? offer.threshold_n : 2;
    var uniqueCount  = Object.keys(acceptors).length;
    return uniqueCount >= (threshold - 1);
  }

  // ── Ratification bitmap encode/decode ─────────────────────────────────────────
  // Wire: 1 byte — bits 0–6 = party slot acceptances, bit 7 = FULLY_RATIFIED

  function encodeRatificationBitmap(partyMask, fullyRatified) {
    return ((fullyRatified ? 1 : 0) << 7) | (partyMask & 0x7F);
  }

  function decodeRatificationBitmap(byte) {
    return {
      partyMask:     byte & 0x7F,
      fullyRatified: !!(byte & 0x80)
    };
  }

  // ── Dispute Amendment opts builder ────────────────────────────────────────────
  // Returns an opts object for WPCodec.encode() that produces a Dispute Amendment.
  // parentUid: Uint8Array(8) — SHA-256[0:8] of the original offer record bytes.

  function buildDisputeAmendmentOpts(parentUid, opts) {
    opts = opts || {};
    return {
      baseTemplate: 6,        // BASE_TEMPLATE=110 (Amendment)
      chain:        true,
      disputeLink:  true,
      parentUid:    parentUid,
      story:        opts.story || ''
    };
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  global.WPAgreements = {
    isRatified:                isRatified,
    encodeRatificationBitmap:  encodeRatificationBitmap,
    decodeRatificationBitmap:  decodeRatificationBitmap,
    buildDisputeAmendmentOpts: buildDisputeAmendmentOpts
  };

}(typeof window !== 'undefined' ? window : global));
