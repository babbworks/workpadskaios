// Compression metrics — v0.4 harness (V4-7)
// Exposes: window.WPCompressionMetrics

(function(root) {
  'use strict';

  var TARGET_RATIO = 0.33;

  function requireCodec() {
    if (!root.WPCodec || !root.WPCodec._buildFrame) {
      throw new Error('WPCompressionMetrics: WPCodec._buildFrame required');
    }
    if (!root.WPPathC) {
      throw new Error('WPCompressionMetrics: WPPathC required');
    }
    if (!root.fflate || !root.fflate.deflateSync) {
      throw new Error('WPCompressionMetrics: fflate required');
    }
  }

  function pathcInnerBytes(record, opts) {
    return buildInner(record, opts).length;
  }

  function buildInner(record, opts) {
    requireCodec();
    opts = opts || {};
    var encOpts = {};
    var k;
    for (k in opts) {
      if (k !== 'padsV2' && k !== 'relationalMode' && k !== 'profileId' &&
          k !== 'chainRef24' && k !== 'counterpartyKey' && k !== 'bridgeV1') {
        encOpts[k] = opts[k];
      }
    }
    var v1 = root.WPCodec._buildFrame(record, encOpts);
    if (opts.bridgeV1 === true || !root.WPPathCNative) {
      return root.WPPathC.wrapV1Frame(v1, record, opts);
    }
    return root.WPPathCNative.wrapNative(v1, record, opts);
  }

  function deflateInnerBytes(record, opts) {
    var inner = buildInner(record, opts);
    var deflated = root.fflate.deflateSync(inner, { level: 9 });
    return deflated ? deflated.length : 0;
  }

  function urlDeflatedBytes(record, opts) {
    requireCodec();
    opts = mergeOpts(opts, { padsV2: true });
    var url = root.WPCodec.encode(record, opts);
    var hash = url.indexOf('#') >= 0 ? url.slice(url.indexOf('#') + 1) : url;
    var body = hash.indexOf('/') >= 0 ? hash.slice(hash.indexOf('/') + 1) : hash;
    var amp = body.indexOf('&');
    if (amp >= 0) body = body.slice(0, amp);
    return inflatedPayloadBytes(body);
  }

  function inflatedPayloadBytes(b64urlBody) {
    var bin = atobUrl(b64urlBody);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
    return root.fflate.inflateSync(bytes).length;
  }

  function atobUrl(s) {
    s = (s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    if (global.atob) return global.atob(s);
    return Buffer.from(s, 'base64').toString('binary');
  }

  function mergeOpts(a, b) {
    var o = {};
    var k;
    a = a || {};
    b = b || {};
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
    return o;
  }

  function copyRec(base, extra) {
    return mergeOpts(base, extra);
  }

  /**
   * Compare verbose first exchange vs simulated mature relational exchange.
   * Returns sizes and whether 10th is at least 50% smaller than 1st (deflated inner).
   */
  function compareExchangeSizes(baseRecord, opts) {
    opts = opts || {};
    var peer = opts.counterpartyKey || 'metrics-peer';

    var firstRec = copyRec(baseRecord, {
      job: baseRecord.job || 'Boiler service annual inspection and parts replacement',
      customer: baseRecord.customer || 'River Cafe Ltd',
      record_type: baseRecord.record_type || 'invoice',
      date: baseRecord.date || '2026-05-24',
      amount: baseRecord.amount || '240.00',
      currency: baseRecord.currency || 'GBP'
    });

    var firstInner = pathcInnerBytes(firstRec, { padsV2: true });
    var firstDeflate = deflateInnerBytes(firstRec, { padsV2: true });

    if (root.WPSymbolTable) {
      root.WPSymbolTable.addEntry(peer, {
        tokenId: 42,
        label: firstRec.customer || 'River Cafe Ltd'
      });
    }

    var tenthRec = copyRec(firstRec, {
      job: 'Svc @42',
      relational_mode: true,
      profile_id: 'service_work.v1',
      chain_seq_compact: opts.chainRef24 != null ? opts.chainRef24 : 0x000042
    });

    var tenthOpts = {
      padsV2: true,
      relationalMode: true,
      profileId: 1,
      chainRef24: tenthRec.chain_seq_compact,
      counterpartyKey: peer
    };

    var tenthInner = pathcInnerBytes(tenthRec, tenthOpts);
    var tenthDeflate = deflateInnerBytes(tenthRec, tenthOpts);

    var reduction = firstDeflate > 0 ? (1 - tenthDeflate / firstDeflate) : 0;

    return {
      first: { inner: firstInner, deflate: firstDeflate },
      tenth: { inner: tenthInner, deflate: tenthDeflate },
      reduction: reduction,
      reductionPct: Math.round(reduction * 1000) / 10,
      targetRatio: TARGET_RATIO,
      targetMet: reduction >= TARGET_RATIO
    };
  }

  root.WPCompressionMetrics = {
    TARGET_RATIO: TARGET_RATIO,
    pathcInnerBytes: pathcInnerBytes,
    deflateInnerBytes: deflateInnerBytes,
    urlDeflatedBytes: urlDeflatedBytes,
    compareExchangeSizes: compareExchangeSizes
  };

}(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this)));
