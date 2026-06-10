// NoteShareScreen — scope → template → copy URL
// Exposes: window.NoteShareScreen

(function(global) {
  'use strict';

  var el = {
    content: document.getElementById('note-share-content'),
    title:   document.getElementById('note-share-title'),
    csk:     document.getElementById('note-share-csk'),
    lsk:     document.getElementById('note-share-lsk'),
  };

  var capture   = null;
  var record    = null;
  var step      = 0;    // 0=scope, 1=template, 2=url
  var scope     = 'note';
  var scopeIdx  = 0;
  var tplIdx    = 0;
  var templates = [];
  var currentUrl = null;

  var SCOPES = ['note', 'record'];

  // ── Entry point ────────────────────────────────────────────────────────────

  function onShow(cap) {
    capture    = cap;
    record     = null;
    step       = 0;
    scope      = 'note';
    scopeIdx   = 0;
    tplIdx     = 0;
    currentUrl = null;

    if (global.WPPresentationLibrary) {
      WPPresentationLibrary.ensureBundled();
      templates = WPPresentationLibrary.noteTemplates();
    } else {
      templates = TemplateRegistry.query({ type: 'note', cached: true });
    }
    if (!templates.length) templates = [TemplateRegistry.getEntry(TemplateRegistry.BUILTIN_URI)];

    if (cap._preferredTpl) {
      for (var ti = 0; ti < templates.length; ti++) {
        if (templates[ti].uri === cap._preferredTpl) { tplIdx = ti; break; }
      }
    }

    if (cap.linkedRecordId) {
      RecordService.get(cap.linkedRecordId).then(function(rec) {
        record = rec || null;
        goStep(record ? 0 : 1);
      });
    } else {
      goStep(1);
    }
  }

  // ── Step navigation ────────────────────────────────────────────────────────

  function goStep(s) {
    step = s;
    if (step === 0) renderScope();
    else if (step === 1) renderTemplate();
    else renderUrl();
  }

  function advance() {
    if (step === 0) { goStep(1); return; }
    if (step === 1) {
      var tpl = templates[tplIdx];
      currentUrl = NoteCodec.encode(capture, {
        templateUri:   tpl ? tpl.uri : TemplateRegistry.BUILTIN_URI,
        includeRecord: scope === 'record',
        record:        record,
      });
      goStep(2);
      return;
    }
    if (step === 2) doCopy();
  }

  function goBack() {
    if (step === 2) { goStep(1); return; }
    if (step === 1 && record) { goStep(0); return; }
    App.showList();
  }

  // ── Step 0: Scope ──────────────────────────────────────────────────────────

  function renderScope() {
    el.title.textContent = 'Share Note';
    el.csk.textContent   = 'Next';
    el.lsk.textContent   = 'Back';
    var recTitle = record
      ? esc((record.job || record.description || '(record)').slice(0, 30))
      : '';
    el.content.innerHTML =
      '<div class="ns-step-label">What to share?</div>' +
      '<div class="ns-option' + (scopeIdx === 0 ? ' focused' : '') + '" data-ns-scope="0">' +
        '<div class="ns-opt-title">Note only</div>' +
        '<div class="ns-opt-sub">Just the note text and date</div>' +
      '</div>' +
      '<div class="ns-option' + (scopeIdx === 1 ? ' focused' : '') + '" data-ns-scope="1">' +
        '<div class="ns-opt-title">Note \u002b Record</div>' +
        '<div class="ns-opt-sub">' + recTitle + '</div>' +
      '</div>';
  }

  function navigateScope(dir) {
    scopeIdx = Math.max(0, Math.min(1, scopeIdx + dir));
    var items = el.content.querySelectorAll('.ns-option');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('focused', i === scopeIdx);
    }
  }

  function confirmScope() {
    scope = SCOPES[scopeIdx];
    advance();
  }

  // ── Step 1: Template ───────────────────────────────────────────────────────

  function renderTemplate() {
    el.title.textContent = 'Presentation';
    el.csk.textContent   = 'Select';
    el.lsk.textContent   = record ? 'Back' : 'Cancel';

    var itemsHtml = templates.map(function(t, i) {
      if (!t) return '';
      var badge = t.trust === 'built-in'
        ? ' <span class="ns-tpl-badge">built-in</span>'
        : t.trust === 'official'
          ? ' <span class="ns-tpl-badge ns-badge-off">official</span>'
          : '';
      var plats = (t.platforms && t.platforms.length && t.platforms[0] !== 'all')
        ? '<div class="ns-tpl-meta">' + esc(t.platforms.join(' \u00b7 ')) + '</div>'
        : '';
      return '<div class="ns-tpl-item' + (i === tplIdx ? ' focused' : '') + '" data-ns-tpl="' + i + '">' +
        '<div class="ns-tpl-name">' + esc(t.name) + badge + '</div>' +
        plats +
      '</div>';
    }).join('');

    el.content.innerHTML = '<div class="ns-step-label">Choose a template</div>' + itemsHtml;
  }

  function navigateTemplate(dir) {
    tplIdx = Math.max(0, Math.min(templates.length - 1, tplIdx + dir));
    var items = el.content.querySelectorAll('.ns-tpl-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('focused', i === tplIdx);
    }
    var focused = el.content.querySelector('.ns-tpl-item.focused');
    if (focused) {
      var cr = focused.getBoundingClientRect();
      var pr = el.content.getBoundingClientRect();
      if (cr.bottom > pr.bottom) el.content.scrollTop += cr.bottom - pr.bottom + 4;
      else if (cr.top < pr.top)  el.content.scrollTop -= pr.top - cr.top + 4;
    }
  }

  // ── Step 2: URL + copy ─────────────────────────────────────────────────────

  function renderUrl() {
    el.title.textContent = 'Share Note';
    el.csk.textContent   = 'Copy';
    el.lsk.textContent   = 'Back';

    var tpl = templates[tplIdx];
    var tplName = tpl ? tpl.name : 'Default Note';
    var preview = capture.text ? capture.text.slice(0, 60) + (capture.text.length > 60 ? '\u2026' : '') : '';
    var displayUrl = currentUrl ? 'https://' + currentUrl : '';

    el.content.innerHTML =
      '<div class="view-field">' +
        '<div class="view-field-label">Note</div>' +
        '<div class="view-field-value">' + esc(preview) + '</div>' +
      '</div>' +
      (scope === 'record' && record
        ? '<div class="view-field">' +
            '<div class="view-field-label">Record</div>' +
            '<div class="view-field-value">' + esc(record.job || '(untitled)') + '</div>' +
          '</div>'
        : '') +
      '<div class="view-field">' +
        '<div class="view-field-label">Template</div>' +
        '<div class="view-field-value">' + esc(tplName) + '</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Link</div>' +
        '<div class="share-url">' + esc(displayUrl) + '</div>' +
      '</div>' +
      '<div class="share-status" id="ns-copy-status" style="display:none;">Copied!</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Length</div>' +
        '<div class="view-field-value">' + (currentUrl ? currentUrl.length : 0) + ' chars</div>' +
      '</div>';
  }

  function doCopy() {
    if (!currentUrl) return;
    var fullUrl = 'https://' + currentUrl;
    var p;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      p = navigator.clipboard.writeText(fullUrl);
    } else {
      var ta = document.createElement('textarea');
      ta.value = fullUrl;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      p = Promise.resolve();
    }
    p.then(function() {
      var st = document.getElementById('ns-copy-status');
      if (st) {
        st.style.display = 'block';
        setTimeout(function() { st.style.display = 'none'; }, 2000);
      }
    }).catch(function(e) { alert('Copy failed: ' + e.message); });
  }

  // ── Key handler ────────────────────────────────────────────────────────────

  function onKey(key) {
    switch (key) {
      case 'Backspace': goBack(); break;
      case 'ArrowUp':
        if (step === 0) navigateScope(-1);
        else if (step === 1) navigateTemplate(-1);
        break;
      case 'ArrowDown':
        if (step === 0) navigateScope(1);
        else if (step === 1) navigateTemplate(1);
        break;
      case 'Enter':
        if (step === 0) confirmScope();
        else advance();
        break;
    }
  }

  // Softkey click bindings
  (function() {
    var panel = document.getElementById('screen-note-share');
    if (!panel) return;
    var lskEl = panel.querySelector('.sk-lsk');
    var cskEl = panel.querySelector('.sk-csk');
    if (lskEl) lskEl.addEventListener('click', function() { goBack(); });
    if (cskEl) cskEl.addEventListener('click', function() {
      if (step === 0) confirmScope();
      else advance();
    });
  }());

  global.NoteShareScreen = {
    onShow: onShow,
    onKey:  onKey,
  };

}(window));
