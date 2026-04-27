// PersonalService — Learning Engine capture service
// Spec: workpads-standard/personal-platform.md (ARC-006)
// Exposes: window.PersonalService (singleton)

(function(global) {
  'use strict';

  var store   = new StorageAdapter('wp_personal_');
  var archive = new StorageAdapter('wp_archive_p_');

  var MAX_TAGS     = 5;
  var MAX_TAG_LEN  = 20;

  function genId() {
    return 'wp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function validateTags(tags) {
    if (!Array.isArray(tags)) throw new Error('ValidationError: tags must be an array');
    if (tags.length > MAX_TAGS) throw new Error('ValidationError: max ' + MAX_TAGS + ' tags');
    tags.forEach(function(t) {
      if (String(t).length > MAX_TAG_LEN) {
        throw new Error('ValidationError: tag "' + t + '" exceeds ' + MAX_TAG_LEN + ' chars');
      }
    });
  }

  // Capture a personal observation.
  // opts: { text, tags?, source, linkedRecordId?, linkedFieldId? }
  // source: 'quick-note' | 'field-capture' | 'story-draft'
  function capture(opts) {
    try {
      var tags = opts.tags || [];
      validateTags(tags);
      var obj = {
        id:             genId(),
        text:           String(opts.text || ''),
        tags:           tags,
        source:         opts.source || 'quick-note',
        linkedRecordId: opts.linkedRecordId || null,
        linkedFieldId:  opts.linkedFieldId  || null,
        timestamp:      Date.now(),
        archived:       false,
      };
      return store.put(obj.id, obj).then(function() { return obj; });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // List all active captures, newest first.
  function list() {
    return store.list().then(function(pairs) {
      return pairs
        .map(function(p) { return p.data; })
        .filter(function(c) { return !c.archived; })
        .sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    });
  }

  // Get a single capture by ID.
  function get(id) {
    return store.get(id);
  }

  // Soft-delete a capture.
  function archive_capture(id) {
    return store.get(id).then(function(c) {
      if (!c) return;
      c.archived = true;
      return archive.put(id, c).then(function() { return store.remove(id); });
    });
  }

  // Count active captures.
  function count() {
    return store.count();
  }

  // Export captures.
  // opts: { format: 'text'|'json', since?: epoch_ms }
  function exportCaptures(opts) {
    return list().then(function(captures) {
      var filtered = opts && opts.since
        ? captures.filter(function(c) { return c.timestamp >= opts.since; })
        : captures;

      if (opts && opts.format === 'json') {
        return JSON.stringify(filtered, null, 2);
      }

      // text format: one line per capture
      return filtered.map(function(c) {
        var d = new Date(c.timestamp);
        var ts = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
                 ' ' + d.toTimeString().slice(0, 5);
        var line = '[' + ts + '] ' + c.text;
        if (c.tags && c.tags.length) line += ' ' + c.tags.map(function(t) { return '#' + t; }).join(' ');
        return line;
      }).join('\n');
    });
  }

  global.PersonalService = {
    capture:  capture,
    list:     list,
    get:      get,
    archive:  archive_capture,
    count:    count,
    export:   exportCaptures,
  };

}(window));
