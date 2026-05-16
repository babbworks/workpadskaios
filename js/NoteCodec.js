// NoteCodec — encode/decode personal notes as shareable URLs
// Format: workpads.me/n#n1/{fflate-deflated base64url JSON}
// Depends on: TemplateRegistry (compress/decompress)
// Exposes: window.NoteCodec

(function(global) {
  'use strict';

  var CODEC_PREFIX = 'n1/';
  var URL_HOST     = 'workpads.me/n#';

  // Encode a PersonalService capture into a share URL.
  // opts: { templateUri?, includeRecord?, record? }
  function encode(capture, opts) {
    opts = opts || {};
    var obj = {
      v:    1,
      text: capture.text,
      ts:   capture.timestamp,
    };
    // Omit tpl when it's the built-in — receiver always has it
    if (opts.templateUri && opts.templateUri !== TemplateRegistry.BUILTIN_URI) {
      obj.tpl = opts.templateUri;
    }
    if (opts.includeRecord && opts.record) {
      var r = opts.record;
      var rec = {};
      if (r.job)      rec.job      = r.job;
      if (r.customer) rec.customer = r.customer;
      if (r.date)     rec.date     = r.date;
      if (Object.keys(rec).length) obj.rec = rec;
    }
    var b64 = TemplateRegistry.compress(JSON.stringify(obj));
    return URL_HOST + CODEC_PREFIX + b64;
  }

  // Decode a share URL or bare fragment back to the note object.
  // Returns { v, text, ts, tpl?, rec? } or null on failure.
  function decode(raw) {
    var frag = raw || '';
    var hashIdx = frag.indexOf('#');
    if (hashIdx !== -1) frag = frag.slice(hashIdx + 1);
    if (frag.slice(0, CODEC_PREFIX.length) !== CODEC_PREFIX) return null;
    try {
      var json = TemplateRegistry.decompress(frag.slice(CODEC_PREFIX.length));
      return JSON.parse(json);
    } catch (_) { return null; }
  }

  global.NoteCodec = {
    encode:       encode,
    decode:       decode,
    CODEC_PREFIX: CODEC_PREFIX,
    URL_HOST:     URL_HOST,
  };

}(window));
