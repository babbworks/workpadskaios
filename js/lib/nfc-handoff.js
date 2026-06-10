// NFC handoff — NDEF URI share/read (Web NFC + KaiOS mozNfc)
// Exposes: window.WPNfcHandoff

(function(global) {
  'use strict';

  var SCENARIOS = {
    INVOICE_HANDOFF: 'invoice_handoff',
    ACK_RETURN: 'ack_return',
    POS_CONFIRM: 'pos_confirm'
  };

  var URI_PREFIXES = [
    '', 'http://www.', 'https://www.', 'http://', 'https://',
    'tel:', 'mailto:', 'ftp://anonymous:anonymous@', 'ftp://ftp.',
    'ftps://', 'sftp://', 'smb://', 'nfs://', 'ftp://', 'dav://',
    'news:', 'telnet://', 'imap:', 'rtsp://', 'urn:', 'pop:',
    'sip:', 'sips:', 'tftp:', 'btspp://', 'btl2cap://', 'btgoep://',
    'tcpobex://', 'irdaobex://', 'file://', 'urn:epc:id:', 'urn:epc:tag:',
    'urn:epc:pat:', 'urn:epc:raw:', 'urn:epc:', 'urn:nfc:'
  ];

  var listenCb = null;
  var listenErr = null;
  var kaiosPendingWrite = null;
  var kaiosInstalled = false;
  var webNdefReader = null;

  function fullUrl(url) {
    url = (url || '').trim();
    if (!url) return '';
    if (url.indexOf('http') === 0) return url;
    if (url.indexOf('workpads.me') === 0) return 'https://' + url;
    return 'https://workpads.me/p' + (url.indexOf('#') === 0 ? url : '#' + url);
  }

  function hashFromIncoming(url) {
    url = (url || '').trim();
    if (!url) return '';
    var hash = '';
    var i = url.indexOf('#');
    if (i >= 0) hash = url.slice(i + 1);
    else if (/^[0-9][a-z]{2}\//.test(url)) hash = url;
    if (hash.indexOf('alg=') !== -1) return hash;
    if (/^[0-9][a-z]{2}\//.test(hash)) return hash;
    return '';
  }

  function uriNdefPayload(url) {
    url = fullUrl(url);
    var prefix = 0x04;
    var body = url;
    if (url.indexOf('https://') === 0) {
      prefix = 0x04;
      body = url.slice(8);
    } else if (url.indexOf('http://') === 0) {
      prefix = 0x03;
      body = url.slice(7);
    }
    var enc = (typeof TextEncoder !== 'undefined')
      ? new TextEncoder().encode(body)
      : stringToUtf8(body);
    var out = new Uint8Array(1 + enc.length);
    out[0] = prefix;
    out.set(enc, 1);
    return out;
  }

  function stringToUtf8(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return new Uint8Array(out);
  }

  function decodeUriPayload(payload) {
    if (!payload || !payload.length) return '';
    var arr = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    var code = arr[0];
    var rest = '';
    for (var i = 1; i < arr.length; i++) rest += String.fromCharCode(arr[i]);
    if (code < URI_PREFIXES.length) return (URI_PREFIXES[code] || '') + rest;
    return rest;
  }

  function urlFromMozRecords(records) {
    if (!records || !records.length) return '';
    var i, r, u;
    for (i = 0; i < records.length; i++) {
      r = records[i];
      if (!r || !r.type || !r.payload) continue;
      var typeFirst = r.type[0];
      if (typeFirst === 0x55 || typeFirst === 85) {
        u = decodeUriPayload(r.payload);
        if (u) return u;
      }
    }
    return '';
  }

  function makeMozUriRecord(url) {
    if (typeof global.MozNDEFRecord === 'undefined') return null;
    return new global.MozNDEFRecord({
      tnf: 1,
      type: new Uint8Array([0x55]),
      payload: uriNdefPayload(url)
    });
  }

  function mozNfc() {
    return global.navigator && global.navigator.mozNfc;
  }

  function platformId() {
    if (global.NDEFReader) return 'webnfc';
    if (mozNfc()) return 'kaios-moz';
    return 'none';
  }

  function isAvailable() {
    if (global.NDEFReader) return true;
    var nfc = mozNfc();
    if (nfc && nfc.enabled !== false) return true;
    return false;
  }

  function installKaiOSHandlers() {
    if (kaiosInstalled) return;
    var nfc = mozNfc();
    if (!nfc) return;
    kaiosInstalled = true;

    nfc.ontagfound = function(event) {
      if (event && event.preventDefault) event.preventDefault();
      var tag = event && event.tag;
      if (!tag) return;

      if (kaiosPendingWrite) {
        var rec = makeMozUriRecord(kaiosPendingWrite.url);
        if (!rec || !tag.writeNDEF) {
          var err = new Error('KaiOS NFC write not supported');
          if (kaiosPendingWrite.onErr) kaiosPendingWrite.onErr(err);
          kaiosPendingWrite = null;
          return;
        }
        tag.writeNDEF([rec])
          .then(function() {
            if (kaiosPendingWrite && kaiosPendingWrite.onOk) kaiosPendingWrite.onOk();
            kaiosPendingWrite = null;
          })
          .catch(function(e) {
            if (kaiosPendingWrite && kaiosPendingWrite.onErr) kaiosPendingWrite.onErr(e);
            kaiosPendingWrite = null;
          });
        return;
      }

      if (listenCb && tag.readNDEF) {
        tag.readNDEF()
          .then(function(records) {
            var u = urlFromMozRecords(records);
            if (u && listenCb) listenCb(u);
          })
          .catch(function(e) {
            if (listenErr) listenErr(e);
          });
      }
    };

    if (nfc.onpeerfound) {
      nfc.onpeerfound = function(event) {
        if (event && event.preventDefault && (kaiosPendingWrite || listenCb)) {
          event.preventDefault();
        }
      };
    }
  }

  function writeWebNfc(url, onOk, onErr) {
    var ndef = new global.NDEFReader();
    ndef.write({ records: [{ recordType: 'url', data: fullUrl(url) }] })
      .then(function() { if (onOk) onOk(); })
      .catch(function(e) { if (onErr) onErr(e); });
  }

  function readWebNfc(onOk, onErr) {
    var ndef = new global.NDEFReader();
    webNdefReader = ndef;
    ndef.scan()
      .then(function() {
        ndef.onreading = function(ev) {
          var recs = ev.message && ev.message.records;
          if (!recs || !recs.length) return;
          var i, u;
          for (i = 0; i < recs.length; i++) {
            if (recs[i].recordType === 'url' && recs[i].data) {
              u = '';
              if (typeof recs[i].data === 'string') u = recs[i].data;
              else if (recs[i].data instanceof URL) u = recs[i].data.href;
              if (u) {
                if (onOk) onOk(u);
                return;
              }
            }
          }
        };
      })
      .catch(function(e) { if (onErr) onErr(e); });
  }

  function writeUrl(url, opts, onOk, onErr) {
    opts = opts || {};
    url = fullUrl(url);
    if (!url) {
      if (onErr) onErr(new Error('WPNfcHandoff: empty URL'));
      return;
    }
    if (!isAvailable()) {
      if (onErr) onErr(new Error('NFC not available on this device'));
      return;
    }
    if (global.NDEFReader) {
      writeWebNfc(url, onOk, onErr);
      return;
    }
    var nfc = mozNfc();
    if (nfc) {
      installKaiOSHandlers();
      kaiosPendingWrite = { url: url, onOk: onOk, onErr: onErr };
      if (onOk) {
        setTimeout(function() {
          if (kaiosPendingWrite && kaiosPendingWrite.onOk === onOk) {
            /* still waiting for tap — UI shows "hold near device" */
          }
        }, 0);
      }
      return;
    }
    if (onErr) onErr(new Error('NFC API not implemented for this platform'));
  }

  function readUrl(onOk, onErr) {
    if (!isAvailable()) {
      if (onErr) onErr(new Error('NFC not available'));
      return;
    }
    if (global.NDEFReader) {
      readWebNfc(onOk, onErr);
      return;
    }
    installKaiOSHandlers();
    listenCb = onOk;
    listenErr = onErr;
    if (onErr) {
      setTimeout(function() {
        /* one-shot read arms tag listener until first tag */
      }, 0);
    }
  }

  function listenIncoming(onUrl, onErr) {
    stopListening();
    if (!isAvailable()) {
      if (onErr) onErr(new Error('NFC listen not available'));
      return;
    }
    listenCb = onUrl;
    listenErr = onErr;
    if (global.NDEFReader) {
      readWebNfc(onUrl, onErr);
      return;
    }
    installKaiOSHandlers();
  }

  function stopListening() {
    listenCb = null;
    listenErr = null;
    kaiosPendingWrite = null;
    webNdefReader = null;
  }

  function scenarioLabel(id) {
    if (id === SCENARIOS.INVOICE_HANDOFF) return 'Tap to send invoice/link';
    if (id === SCENARIOS.ACK_RETURN) return 'Tap to return acknowledgement';
    if (id === SCENARIOS.POS_CONFIRM) return 'Tap to confirm payment';
    return 'Tap to share';
  }

  function scenarioForRecord(rec) {
    if (!rec) return SCENARIOS.INVOICE_HANDOFF;
    var rt = (rec.record_type || rec.recordType || '').toLowerCase();
    if (rt === 'ack' || rec.ackForId) return SCENARIOS.ACK_RETURN;
    if (rt === 'invoice' || rt === 'payment' || rt === 'receipt') return SCENARIOS.POS_CONFIRM;
    if (rt === 'connection' && rec.informational_ack) return SCENARIOS.ACK_RETURN;
    return SCENARIOS.INVOICE_HANDOFF;
  }

  global.WPNfcHandoff = {
    SCENARIOS: SCENARIOS,
    isAvailable: isAvailable,
    platformId: platformId,
    fullUrl: fullUrl,
    hashFromIncoming: hashFromIncoming,
    writeUrl: writeUrl,
    readUrl: readUrl,
    listenIncoming: listenIncoming,
    stopListening: stopListening,
    scenarioLabel: scenarioLabel,
    scenarioForRecord: scenarioForRecord,
    decodeUriPayload: decodeUriPayload,
    uriNdefPayload: uriNdefPayload,
  };

}(typeof window !== 'undefined' ? window : global));
