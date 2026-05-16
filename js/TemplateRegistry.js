// TemplateRegistry — manifest store, payload cache, render engine
// Phase 1: localStorage-backed, schema A/B/P support, built-in default
// Exposes: window.TemplateRegistry

(function(global) {
  'use strict';

  var MANIFEST_KEY    = 'wp_tpl_manifest';
  var PAYLOAD_PREFIX  = 'wp_tpl_payload_';
  var REFUSALS_KEY    = 'wp_tpl_refusals';

  // ── Codec helpers (mirrors codec.js pattern) ───────────────────────────────

  function toB64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function fromB64(str) {
    var padded = str + '=='.slice(0, (4 - str.length % 4) % 4);
    var bin = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function compress(jsonStr) {
    var bytes = new TextEncoder().encode(jsonStr);
    var compressed = global.fflate.deflateSync(bytes, { level: 9 });
    return toB64(compressed);
  }

  function decompress(b64str) {
    var bytes = fromB64(b64str);
    var raw = global.fflate.inflateSync(bytes);
    return new TextDecoder().decode(raw);
  }

  // ── Built-in default — shipped with the app, never fetched ────────────────

  var BUILTIN_URI = 'urn:workpads:tpl:note:default:v1';

  var BUILTIN_ENTRY = {
    uri:      BUILTIN_URI,
    name:     'Default Note',
    schema:   'A',
    type:     'note',
    scope:    ['note'],
    domain:   'general',
    source:   null,
    version:  1,
    cached:   true,
    trust:    'built-in',
    origin:   null,
    addedAt:  0,
    usedAt:   0,
    platforms: ['all'],   // 'all' | 'kaios' | 'mobile' | 'desktop' | 'print'
    lineage:  { derivedFrom: null, supersedes: null, components: [] },
  };

  var BUILTIN_PAYLOAD = {
    uri:    BUILTIN_URI,
    schema: 'A',
    html: '<div class="wpt-note">' +
            '<div class="wpt-hdr">' +
              '<span class="wpt-ts">{{ts}}</span>' +
              '{{#source}}<span class="wpt-src">{{source}}</span>{{/source}}' +
            '</div>' +
            '<div class="wpt-text">{{text}}</div>' +
            '{{#rec}}' +
              '<div class="wpt-rec">' +
                '<span class="wpt-rec-label">Re:</span> {{rec.title}}' +
                '{{#rec.date}}<span class="wpt-rec-date"> · {{rec.date}}</span>{{/rec.date}}' +
              '</div>' +
            '{{/rec}}' +
          '</div>',
    css:  '.wpt-note{padding:14px 16px;font-family:inherit;background:#0e1420;min-height:100%;}' +
          '.wpt-hdr{display:flex;justify-content:space-between;align-items:center;' +
            'margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1e2a3a;}' +
          '.wpt-ts{font-size:10px;color:#5a7a9a;letter-spacing:0.3px;}' +
          '.wpt-src{font-size:9px;color:#3a5a7a;padding:1px 5px;border:1px solid #1e3a5a;' +
            'border-radius:2px;text-transform:uppercase;letter-spacing:0.5px;}' +
          '.wpt-text{font-size:13px;line-height:1.55;color:#c8d8e8;word-break:break-word;}' +
          '.wpt-rec{margin-top:12px;padding-top:8px;border-top:1px solid #1e2a3a;' +
            'font-size:10px;color:#4a6a8a;}' +
          '.wpt-rec-label{color:#3a5a7a;text-transform:uppercase;font-size:9px;' +
            'letter-spacing:0.5px;margin-right:4px;}' +
          '.wpt-rec-date{color:#3a5060;}',
  };

  // ── Manifest ───────────────────────────────────────────────────────────────

  function loadManifest() {
    try {
      var raw = localStorage.getItem(MANIFEST_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function saveManifest(m) {
    try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(m)); } catch (_) {}
  }

  // ── Payload ────────────────────────────────────────────────────────────────

  function loadPayload(uri) {
    if (uri === BUILTIN_URI) return BUILTIN_PAYLOAD;
    try {
      var raw = localStorage.getItem(PAYLOAD_PREFIX + uri);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function savePayload(uri, payload) {
    try {
      localStorage.setItem(PAYLOAD_PREFIX + uri, JSON.stringify(payload));
    } catch (_) {}
  }

  function getPayload(uri) {
    return loadPayload(uri) || BUILTIN_PAYLOAD;
  }

  // ── Query ──────────────────────────────────────────────────────────────────
  // opts: { type, schema (string or array), domain, cached }
  // Built-in default always appears first in results.

  function allEntries() {
    var m = loadManifest();
    var out = [BUILTIN_ENTRY];
    var keys = Object.keys(m);
    for (var i = 0; i < keys.length; i++) out.push(m[keys[i]]);
    return out;
  }

  function query(opts) {
    opts = opts || {};
    return allEntries().filter(function(e) {
      if (opts.type && e.type !== opts.type) return false;
      if (opts.cached && !e.cached) return false;
      if (opts.domain && e.domain !== 'general' && e.domain !== opts.domain) return false;
      if (opts.schema) {
        var ss = Array.isArray(opts.schema) ? opts.schema : [opts.schema];
        if (ss.indexOf(e.schema) === -1) return false;
      }
      return true;
    });
  }

  function getEntry(uri) {
    if (uri === BUILTIN_URI) return BUILTIN_ENTRY;
    var m = loadManifest();
    return m[uri] || null;
  }

  // ── Ingest — plain object path (programmatic / Phase 1) ───────────────────

  function ingest(tplObj, origin) {
    if (!tplObj || !tplObj.uri || !tplObj.schema || !tplObj.type) {
      return { ok: false, error: 'invalid-template' };
    }
    if (tplObj.uri === BUILTIN_URI) {
      return { ok: false, error: 'cannot-overwrite-builtin' };
    }
    var m = loadManifest();
    var existing = m[tplObj.uri];
    var incomingVer = tplObj.version || 1;
    if (existing && existing.version >= incomingVer) {
      return { ok: false, error: 'already-current', entry: existing };
    }
    var isUpgrade = !!(existing && existing.version < incomingVer);

    var entry = {
      uri:     tplObj.uri,
      name:    tplObj.name    || 'Unnamed Template',
      schema:  tplObj.schema,
      type:    tplObj.type,
      scope:   tplObj.scope   || [tplObj.type],
      domain:  tplObj.domain  || 'general',
      source:  tplObj.source  || origin || null,
      version: incomingVer,
      cached:  true,
      trust:   tplObj.trust   || 'community',
      origin:  origin         || null,
      addedAt: Date.now(),
      usedAt:  Date.now(),
      lineage: tplObj.lineage || { derivedFrom: null, supersedes: null, components: [] },
    };

    var payload = buildPayload(tplObj);

    m[tplObj.uri] = entry;
    saveManifest(m);
    savePayload(tplObj.uri, payload);

    return { ok: true, entry: entry, isUpgrade: isUpgrade, isNew: !existing };
  }

  // ── Ingest — encoded path (page-embed, Phase 2+) ──────────────────────────
  // Accepts the raw base64-compressed string from <script type="application/workpads-template">

  function ingestEncoded(b64str, origin) {
    try {
      var json = decompress(b64str);
      var tplObj = JSON.parse(json);
      return ingest(tplObj, origin);
    } catch (e) {
      return { ok: false, error: 'decode-failed', detail: String(e) };
    }
  }

  // ── Payload builder — separates render fields from manifest fields ─────────

  function buildPayload(tplObj) {
    var p = {
      uri:    tplObj.uri,
      schema: tplObj.schema,
      html:   tplObj.html || '',
      css:    tplObj.css  || '',
    };
    if (tplObj.schema === 'B' && tplObj.slots)    p.slots    = tplObj.slots;
    if (tplObj.schema === 'P' && tplObj.sections) p.sections = tplObj.sections;
    return p;
  }

  // ── Page detector — scans for embedded template tags ─────────────────────
  // Returns array of { b64, header, origin } for templates not yet ingested/refused.
  // Phase 2 will call this from in-app browser; exposed now for manual triggering.

  function detectOnPage(doc) {
    doc = doc || document;
    var tags = doc.querySelectorAll('script[type="application/workpads-template"]');
    var found = [];
    for (var i = 0; i < tags.length; i++) {
      var b64 = tags[i].textContent.trim();
      if (!b64) continue;
      try {
        var json   = decompress(b64);
        var header = JSON.parse(json);
        if (!header.uri) continue;
        if (hasRefused(header.uri)) continue;
        var existing = getEntry(header.uri);
        if (existing && existing.version >= (header.version || 1)) continue;
        var origin = (doc.location && doc.location.href) || null;
        found.push({ b64: b64, header: header, origin: origin });
      } catch (_) {}
    }
    return found;
  }

  // ── Refusals ───────────────────────────────────────────────────────────────

  function hasRefused(uri) {
    try {
      var raw = localStorage.getItem(REFUSALS_KEY);
      return !!(raw && JSON.parse(raw)[uri]);
    } catch (_) { return false; }
  }

  function recordRefusal(uri) {
    try {
      var raw = localStorage.getItem(REFUSALS_KEY);
      var r = raw ? JSON.parse(raw) : {};
      r[uri] = Date.now();
      localStorage.setItem(REFUSALS_KEY, JSON.stringify(r));
    } catch (_) {}
  }

  // ── Remove ─────────────────────────────────────────────────────────────────

  function remove(uri) {
    if (uri === BUILTIN_URI) return; // permanent
    var m = loadManifest();
    delete m[uri];
    saveManifest(m);
    try { localStorage.removeItem(PAYLOAD_PREFIX + uri); } catch (_) {}
  }

  function markUsed(uri) {
    if (uri === BUILTIN_URI) return;
    var m = loadManifest();
    if (m[uri]) { m[uri].usedAt = Date.now(); saveManifest(m); }
  }

  // ── Renderer ───────────────────────────────────────────────────────────────

  function render(uri, data) {
    var payload = getPayload(uri);
    markUsed(uri);
    var html;
    switch (payload.schema) {
      case 'B': html = renderB(payload, data); break;
      case 'P': html = renderP(payload, data); break;
      default:  html = renderA(payload, data); break;
    }
    return html;
  }

  // Schema A — single HTML string with {{placeholders}} and {{#block}}…{{/block}}
  function renderA(payload, data) {
    return '<style>' + (payload.css || '') + '</style>' + applyTemplate(payload.html, data);
  }

  // Schema B — named slots, each rendered independently, sharing one CSS block
  function renderB(payload, data) {
    if (!payload.slots) return renderA(payload, data);
    var keys = Object.keys(payload.slots);
    var inner = keys.map(function(k) {
      return '<div class="wpt-slot wpt-slot-' + k + '">' +
        applyTemplate(payload.slots[k], data) +
      '</div>';
    }).join('');
    return '<style>' + (payload.css || '') + '</style>' + inner;
  }

  // Schema P — ordered sections, each with its own html + css (mini-presentation)
  function renderP(payload, data) {
    if (!payload.sections) return renderA(payload, data);
    var sections = payload.sections.map(function(sec, i) {
      return '<section class="wpt-section wpt-section-' + i + '">' +
        (sec.css ? '<style>' + sec.css + '</style>' : '') +
        applyTemplate(sec.html, data) +
      '</section>';
    }).join('');
    return '<style>' + (payload.css || '') + '</style>' + sections;
  }

  // Template engine: {{var}}, {{a.b.c}}, {{#block}}…{{/block}}, {{^block}}…{{/block}}
  function applyTemplate(html, data) {
    // Conditional blocks {{#key}}…{{/key}} — truthy check
    html = html.replace(/\{\{#(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function(_, path, inner) {
      var val = resolvePath(data, path);
      return val ? applyTemplate(inner, data) : '';
    });
    // Inverted blocks {{^key}}…{{/key}} — falsy check
    html = html.replace(/\{\{\^(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function(_, path, inner) {
      var val = resolvePath(data, path);
      return val ? '' : applyTemplate(inner, data);
    });
    // Variables {{var}} — HTML-escaped
    html = html.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, function(_, path) {
      return esc(String(resolvePath(data, path) || ''));
    });
    return html;
  }

  function resolvePath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return '';
      cur = cur[parts[i]];
    }
    return cur == null ? '' : cur;
  }

  // ── Encode helper (for template authors / dev tools) ──────────────────────
  // Takes a plain template object and returns the base64 string for embedding.

  function encode(tplObj) {
    return compress(JSON.stringify(tplObj));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  global.TemplateRegistry = {
    // Read
    query:          query,
    allEntries:     allEntries,
    getEntry:       getEntry,
    getPayload:     getPayload,
    // Write
    ingest:         ingest,
    ingestEncoded:  ingestEncoded,
    remove:         remove,
    markUsed:       markUsed,
    // Discovery
    detectOnPage:   detectOnPage,
    hasRefused:     hasRefused,
    recordRefusal:  recordRefusal,
    // Render
    render:         render,
    // Utilities
    encode:         encode,
    compress:       compress,
    decompress:     decompress,
    BUILTIN_URI:    BUILTIN_URI,
  };

}(window));
