// template-receive.js — external My Template receive + import routing (B5)
// Exposes: window.WPTemplateReceive

(function(global) {
  'use strict';

  function normalizeFields(fields) {
    fields = fields || {};
    if (!fields.name) {
      fields.name = (fields.job || fields.description || 'Imported template').slice(0, 48);
    }
    return fields;
  }

  function parseRtplFields(hash) {
    if (!hash) return null;
    var body = hash;
    if (body.charAt(0) === '#') body = body.slice(1);
    if (body.indexOf('rtpl/') === 0) body = body.slice(5);
    else if (body.indexOf('rtpl/') > 0) {
      var i = body.indexOf('rtpl/');
      body = body.slice(i + 5);
    } else {
      return null;
    }
    try {
      var b64 = body.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return JSON.parse(atob(b64));
    } catch (_) {
      return null;
    }
  }

  function encodeRtplHash(fields) {
    var json = JSON.stringify(normalizeFields(fields || {}));
    var b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'rtpl/' + b64;
  }

  function receiveFromFields(fields) {
    var RTS = global.RecordTemplateService;
    if (!RTS || !RTS.receiveExternal) {
      return { ok: false, error: 'no-service' };
    }
    var tpl = RTS.receiveExternal(normalizeFields(fields));
    return { ok: true, tpl: tpl, name: tpl.name || 'Template' };
  }

  function receiveFromHash(hash) {
    var fields = parseRtplFields(hash);
    if (!fields) return { ok: false, error: 'parse' };
    return receiveFromFields(fields);
  }

  function receiveFromRecord(rec) {
    if (global.WPTemplateQr && WPTemplateQr.fieldsForRtpl) {
      return receiveFromFields(WPTemplateQr.fieldsForRtpl(rec));
    }
    return receiveFromFields({
      name: (rec && (rec.job || rec.pads_process)) || 'Imported template',
      record_type: rec && rec.record_type,
      record_class: rec && rec.record_class,
      job: rec && rec.job,
    });
  }

  function dismissPending(id) {
    var RTS = global.RecordTemplateService;
    if (!RTS) return false;
    RTS.remove(id);
    return true;
  }

  function summarize(tpl) {
    if (!tpl) return [];
    var lines = [];
    lines.push('Name: ' + (tpl.name || '(unnamed)'));
    if (tpl.record_type) lines.push('Type: ' + tpl.record_type);
    if (tpl.job) lines.push('Title: ' + tpl.job);
    if (tpl.customer) lines.push('Customer: ' + tpl.customer);
    if (tpl.worker) lines.push('Worker: ' + tpl.worker);
    if (tpl.description) lines.push(tpl.description.slice(0, 80));
    if (tpl.receivedAt) {
      lines.push('Received: ' + new Date(tpl.receivedAt).toLocaleString());
    }
    return lines;
  }

  function routeAfterReceive(result, showManagement) {
    if (!result || !result.ok || typeof showManagement !== 'function') return;
    showManagement({
      tab: 'templates',
      tplMode: 'pending-list',
      tplFlash: result.name,
      tplPreviewId: result.tpl && result.tpl.id,
    });
  }

  global.WPTemplateReceive = {
    parseRtplFields: parseRtplFields,
    encodeRtplHash: encodeRtplHash,
    receiveFromFields: receiveFromFields,
    receiveFromHash: receiveFromHash,
    receiveFromRecord: receiveFromRecord,
    dismissPending: dismissPending,
    summarize: summarize,
    routeAfterReceive: routeAfterReceive,
  };

}(typeof window !== 'undefined' ? window : global));
