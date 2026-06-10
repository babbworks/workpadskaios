// presentation-library.js — install & list bundled presentation templates (B6)
// Exposes: window.WPPresentationLibrary

(function(global) {
  'use strict';

  function registry() {
    return global.TemplateRegistry || null;
  }

  function starters() {
    return global.WPPresentationStarters || null;
  }

  function ensureBundled() {
    var TR = registry();
    var ST = starters();
    if (!TR || !ST) return { ok: false, installed: 0, skipped: 0 };
    var list = ST.list();
    var installed = 0;
    var skipped = 0;
    var i, s, ing;
    for (i = 0; i < list.length; i++) {
      s = list[i];
      ing = TR.ingest(s, 'starter-pack');
      if (ing.ok) installed++;
      else if (ing.error === 'already-current') skipped++;
    }
    return { ok: true, installed: installed, skipped: skipped, total: list.length };
  }

  function starterCatalog() {
    var TR = registry();
    var ST = starters();
    if (!TR || !ST) return [];
    ensureBundled();
    return ST.list().map(function(s) {
      var entry = TR.getEntry(s.uri);
      return {
        starter: s,
        uri: s.uri,
        name: s.name,
        domain: s.domain,
        blurb: s.blurb || '',
        installed: !!(entry && entry.cached),
        entry: entry,
      };
    });
  }

  function noteTemplates() {
    ensureBundled();
    var TR = registry();
    if (!TR) return [];
    return TR.query({ type: 'note', cached: true });
  }

  function installStarter(uri) {
    var TR = registry();
    var ST = starters();
    if (!TR || !ST) return { ok: false, error: 'no-registry' };
    var s = ST.get(uri);
    if (!s) return { ok: false, error: 'unknown-starter' };
    return TR.ingest(s, 'starter-pack');
  }

  function removeStarter(uri) {
    var TR = registry();
    var ST = starters();
    if (!TR || !ST || !ST.has(uri)) return false;
    if (uri === TR.BUILTIN_URI) return false;
    TR.remove(uri);
    return true;
  }

  function previewHtml(uri, data) {
    var TR = registry();
    var ST = starters();
    if (!TR) return '';
    ensureBundled();
    if (!TR.getEntry(uri)) {
      var ing = ST && ST.get(uri) ? installStarter(uri) : { ok: false };
      if (!ing.ok) return '<div class="pres-preview-empty">Not installed</div>';
    }
    data = data || (ST ? ST.SAMPLE_NOTE : {});
    return TR.render(uri, data);
  }

  function isStarterUri(uri) {
    return starters() ? starters().has(uri) : false;
  }

  global.WPPresentationLibrary = {
    ensureBundled: ensureBundled,
    starterCatalog: starterCatalog,
    noteTemplates: noteTemplates,
    installStarter: installStarter,
    removeStarter: removeStarter,
    previewHtml: previewHtml,
    isStarterUri: isStarterUri,
  };

}(typeof window !== 'undefined' ? window : global));
