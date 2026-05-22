// PersonalPanel — ArrowRight overlay, Learning Engine surface
// Spec: workpads-standard/panel-access-model.md + personal-panel-design.md (ARC-007/016)
// Exposes: window.PersonalPanel

(function(global) {
  'use strict';

  var el = {
    panel:   document.getElementById('panel-personal'),
    content: document.getElementById('panel-personal-content'),
  };

  var isOpen       = false;
  var filterRecord = null;  // record id when opened from record context
  var mode         = 'all'; // 'all' | 'records'
  var focusIdx     = 0;
  var focusItems   = [];    // navigable .pp-item elements

  // ── Open / close ────────────────────────────────────────────────────────────

  function open() {
    WorkpadsPanel.close();
    var last = WorkpadsPanel.lastContext();
    var newRec = (last && last.record && last.record.id) ? last.record.id : null;
    if (newRec !== filterRecord) { filterRecord = newRec; mode = 'all'; }
    focusIdx = 0;
    isOpen = true;
    el.panel.classList.add('open');
    document.body.classList.add('pp-panel-open');
    WorkpadsPanel.showBackdrop('right');
    render();
  }

  function close() {
    isOpen = false;
    if (el.panel) el.panel.classList.remove('open');
    document.body.classList.remove('pp-panel-open');
    WorkpadsPanel.hideBackdrop();
  }

  function toggle() { if (isOpen) close(); else open(); }

  // ── Focus / navigation ───────────────────────────────────────────────────────

  function buildFocusItems() {
    var nodes = el.content.querySelectorAll('.pp-item');
    focusItems = [];
    for (var i = 0; i < nodes.length; i++) focusItems.push(nodes[i]);
    if (focusIdx >= focusItems.length) focusIdx = Math.max(0, focusItems.length - 1);
    applyFocus();
  }

  function applyFocus() {
    for (var i = 0; i < focusItems.length; i++) {
      focusItems[i].classList.toggle('focused', i === focusIdx);
    }
    var f = focusItems[focusIdx];
    if (!f) return;
    var body = el.content.querySelector('.pp-body');
    if (!body) return;
    if (mode === 'all') {
      // Scroll so the top edge of the focused note aligns with the top of .pp-body
      var fRect = f.getBoundingClientRect();
      var bRect = body.getBoundingClientRect();
      body.scrollTop += fRect.top - bRect.top;
    } else {
      var br = f.getBoundingClientRect();
      var pr = body.getBoundingClientRect();
      if (br.bottom > pr.bottom) body.scrollTop += br.bottom - pr.bottom + 2;
      else if (br.top < pr.top)  body.scrollTop -= pr.top  - br.top  + 2;
    }
  }

  function navigateItems(dir) {
    if (!focusItems.length) { scrollContent(dir); return; }
    focusIdx = Math.max(0, Math.min(focusItems.length - 1, focusIdx + dir));
    applyFocus();
  }

  function handleEnter() {
    var f = focusItems[focusIdx];
    if (!f) return false;
    var recId = f.getAttribute('data-rec-id');
    if (recId && typeof RecordService !== 'undefined' && typeof App !== 'undefined') {
      RecordService.get(recId).then(function(rec) {
        if (rec) { close(); App.showView(rec); }
      });
      return true;
    }
    return false;
  }

  // ── Shared HTML helpers ──────────────────────────────────────────────────────

  function crumbHtml() {
    return '<div class="pp-crumb">' +
      '<div>' +
        '<span class="pp-crumb-title">Me</span>' +
        (filterRecord ? '<span class="pp-crumb-sub">\u00b7 record</span>' : '') +
      '</div>' +
      '<div class="pp-crumb-tabs">' +
        '<span class="pp-tab' + (mode === 'all'     ? ' active' : '') + '" data-pp-mode="all">All</span>' +
        '<span class="pp-tab' + (mode === 'records' ? ' active' : '') + '" data-pp-mode="records">Records</span>' +
      '</div>' +
    '</div>';
  }

  function bindCommon() {
    bindModeToggles();
    // Event delegation for note action buttons (edit / share)
    var body = el.content.querySelector('.pp-body');
    if (body) {
      body.addEventListener('click', function(e) {
        var btn = e.target;
        var action = btn.getAttribute('data-pp-action');
        if (!action) return;
        var capId = btn.getAttribute('data-cap-id');
        var recId = btn.getAttribute('data-rec-id');
        e.stopPropagation();
        if (action === 'share-note' && capId) {
          PersonalService.get(capId).then(function(cap) {
            if (!cap) return;
            close();
            App.showNoteShare(cap);
          });
          return;
        }
        if (!recId) return;
        RecordService.get(recId).then(function(rec) {
          if (!rec) return;
          close();
          if (action === 'edit')  App.showWizard(rec);
          if (action === 'share') {
            PersonalService.get(capId).then(function(cap) {
              if (cap) App.showNoteShare(cap);
              else     App.showShare(rec);
            });
          }
        });
      });
    }
    buildFocusItems();
  }

  function bindModeToggles() {
    var els = el.content.querySelectorAll('[data-pp-mode]');
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener('click', function() {
        mode = this.getAttribute('data-pp-mode');
        focusIdx = 0;
        render();
      });
    }
  }

  // ── Render dispatch ──────────────────────────────────────────────────────────

  function render() {
    PersonalService.list().then(function(captures) {
      if (mode === 'records') renderRecordsMode(captures);
      else                    renderAllMode(captures);
    });
  }

  // ── All mode ────────────────────────────────────────────────────────────────

  function renderAllMode(captures) {
    var shown = filterRecord
      ? captures.filter(function(c) { return c.linkedRecordId === filterRecord; })
      : captures;

    var itemsHtml = shown.slice(0, 30).map(function(c) {
      var d = new Date(c.timestamp);
      var ts = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
               ' ' + d.toTimeString().slice(0, 5);
      var actionsHtml = c.linkedRecordId
        ? '<span class="pp-note-actions">' +
            '<span class="pp-nact" data-pp-action="edit" data-rec-id="' + esc(c.linkedRecordId) + '" data-cap-id="' + esc(c.id) + '">edit</span>' +
            '<span class="pp-nact" data-pp-action="share" data-rec-id="' + esc(c.linkedRecordId) + '" data-cap-id="' + esc(c.id) + '">share</span>' +
          '</span>'
        : '<span class="pp-note-actions">' +
            '<span class="pp-nact" data-pp-action="share-note" data-cap-id="' + esc(c.id) + '">share</span>' +
          '</span>';
      return '<div class="pp-item pp-note-item" data-rec-id="' + esc(c.linkedRecordId || '') + '">' +
        '<div class="pp-note-header">' +
          '<span class="pp-note-ts">' + esc(ts) +
            (c.linkedFieldId ? ' \u00b7 ' + esc(c.linkedFieldId) : '') +
          '</span>' +
          actionsHtml +
        '</div>' +
        '<div class="pp-note-text">' + esc(c.text) + '</div>' +
        (c.tags && c.tags.length
          ? '<div class="pp-note-tags">' + c.tags.map(function(t) { return '#' + esc(t); }).join(' ') + '</div>'
          : '') +
      '</div>';
    }).join('');

    var emptyHtml = shown.length ? '' :
      '<div class="pp-empty">' + (filterRecord ? 'No notes for this record.' : 'No notes yet.') + '</div>';

    el.content.innerHTML = crumbHtml() +
      '<div class="pp-body">' + itemsHtml + emptyHtml + '</div>';
    bindCommon();
  }

  // ── Records mode ─────────────────────────────────────────────────────────────

  function renderRecordsMode(captures) {
    if (filterRecord) renderRecordContext(captures, filterRecord);
    else              renderAllRecordCards(captures);
  }

  function renderAllRecordCards(captures) {
    var groups = {};
    for (var i = 0; i < captures.length; i++) {
      var c = captures[i];
      if (!c.linkedRecordId) continue;
      if (!groups[c.linkedRecordId]) groups[c.linkedRecordId] = [];
      groups[c.linkedRecordId].push(c);
    }
    var ids = Object.keys(groups);
    if (!ids.length) {
      el.content.innerHTML = crumbHtml() +
        '<div class="pp-body">' +
          '<div class="pp-empty">No record-linked notes yet.</div>' +
        '</div>';
      bindCommon();
      return;
    }
    Promise.all(ids.map(function(id) {
      return RecordService.get(id).then(function(rec) {
        return { id: id, rec: rec, caps: groups[id] };
      });
    })).then(function(results) {
      // Sort by most recent capture descending
      results.sort(function(a, b) {
        return b.caps[b.caps.length - 1].timestamp - a.caps[a.caps.length - 1].timestamp;
      });
      var cardsHtml = results.map(function(r) {
        var title = r.rec
          ? (r.rec.job || r.rec.description || r.rec.story || '(untitled)').slice(0, 24)
          : '(deleted)';
        var last = r.caps[r.caps.length - 1];
        return '<div class="pp-item pp-rec-card" data-rec-id="' + esc(r.id) + '">' +
          '<div class="pp-rec-card-title">' + esc(title) + '</div>' +
          '<div class="pp-rec-card-meta">' + r.caps.length + ' note' + (r.caps.length !== 1 ? 's' : '') + '</div>' +
          '<div class="pp-rec-card-snippet">' + esc(last.text.slice(0, 44)) + '</div>' +
        '</div>';
      }).join('');
      el.content.innerHTML = crumbHtml() +
        '<div class="pp-body">' + cardsHtml + '</div>';
      bindCommon();
    });
  }

  function renderRecordContext(captures, recId) {
    RecordService.listChildren(recId).then(function(children) {
      var childIds = {};
      for (var i = 0; i < children.length; i++) childIds[children[i].id] = children[i];

      var childGroups = {};
      for (var j = 0; j < captures.length; j++) {
        var c = captures[j];
        if (c.linkedRecordId && childIds[c.linkedRecordId]) {
          if (!childGroups[c.linkedRecordId]) childGroups[c.linkedRecordId] = [];
          childGroups[c.linkedRecordId].push(c);
        }
      }
      var childrenWithNotes = Object.keys(childGroups);

      if (!childrenWithNotes.length) {
        // No sub-record notes — fall back to All
        mode = 'all';
        render();
        return;
      }

      RecordService.get(recId).then(function(parentRec) {
        var parentTitle = parentRec
          ? (parentRec.job || parentRec.description || '(record)').slice(0, 24)
          : '(record)';
        var parentNotes = captures.filter(function(c) { return c.linkedRecordId === recId; });

        var parentCard =
          '<div class="pp-item pp-rec-card pp-rec-card-parent" data-rec-id="' + esc(recId) + '">' +
            '<div class="pp-rec-card-title">' + esc(parentTitle) + '</div>' +
            '<div class="pp-rec-card-meta">' +
              (parentNotes.length
                ? parentNotes.length + ' direct note' + (parentNotes.length !== 1 ? 's' : '')
                : 'no direct notes') +
            '</div>' +
          '</div>';

        var childCards = childrenWithNotes.map(function(cid) {
          var child = childIds[cid];
          var notes = childGroups[cid];
          var childTitle = child
            ? (child.description || child.job || '(item)').slice(0, 22)
            : '(deleted)';
          var last = notes[notes.length - 1];
          return '<div class="pp-item pp-rec-card pp-rec-card-child-entry" data-rec-id="' + esc(cid) + '">' +
            '<div class="pp-rec-card-title pp-rec-card-child-title">\u2514 ' + esc(childTitle) + '</div>' +
            '<div class="pp-rec-card-meta">' + notes.length + ' note' + (notes.length !== 1 ? 's' : '') + '</div>' +
            '<div class="pp-rec-card-snippet">' + esc(last.text.slice(0, 38)) + '</div>' +
          '</div>';
        }).join('');

        el.content.innerHTML = crumbHtml() +
          '<div class="pp-body">' + parentCard + childCards + '</div>';
        bindCommon();
      });
    });
  }

  function scrollContent(dir) {
    var body = el.content.querySelector('.pp-body');
    (body || el.content).scrollTop += dir * 30;
  }

  // ── Panel softkey bindings ────────────────────────────────────────────────

  (function() {
    var lsk = el.panel.querySelector('.sk-lsk');
    var csk = el.panel.querySelector('.sk-csk');
    var rsk = el.panel.querySelector('.sk-rsk');
    if (lsk) lsk.addEventListener('click', function() {
      close(); if (typeof App !== 'undefined') App.showManagement();
    });
    if (csk) csk.addEventListener('click', function() {
      close(); if (typeof App !== 'undefined') App.openQuickNote();
    });
    if (rsk) rsk.addEventListener('click', function() { close(); });
  }());

  global.PersonalPanel = {
    open:           open,
    close:          close,
    toggle:         toggle,
    scrollContent:  scrollContent,
    navigateItems:  navigateItems,
    handleEnter:    handleEnter,
    isOpen:         function() { return isOpen; },
  };

}(window));
