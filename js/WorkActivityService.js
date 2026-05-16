// WorkActivityService — named work activities for grouping records
// Distinct from ActivityService (user profile). Exposes: window.WorkActivityService

(function(global) {
  'use strict';

  var PREFIX = 'wp_wact_';

  function genId() {
    return 'wact_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function _key(id) { return PREFIX + id; }

  function listAll() {
    var results = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        try { results.push(JSON.parse(localStorage.getItem(k))); } catch (_) {}
      }
    }
    results.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
    return results;
  }

  function getById(id) {
    var raw = localStorage.getItem(_key(id));
    return raw ? JSON.parse(raw) : null;
  }

  function create(name) {
    var id = genId();
    var act = { id: id, name: String(name || '').trim(), createdAt: Date.now() };
    localStorage.setItem(_key(id), JSON.stringify(act));
    return act;
  }

  function rename(id, name) {
    var act = getById(id);
    if (!act) return;
    act.name = String(name || '').trim();
    localStorage.setItem(_key(id), JSON.stringify(act));
    return act;
  }

  // Remove an activity. Caller is responsible for re-assigning records first.
  function remove(id) {
    localStorage.removeItem(_key(id));
  }

  // Re-assign all records with activityId === fromId to toId (or null to unassign).
  // Returns a Promise that resolves when all records are updated.
  function reassignRecords(fromId, toId) {
    return RecordService.list().then(function(records) {
      var targets = records.filter(function(r) { return r.activityId === fromId; });
      var promises = targets.map(function(r) {
        return RecordService.update(r.id, { activityId: toId || null });
      });
      return Promise.all(promises);
    });
  }

  // Count records associated with a given activityId.
  function countRecords(id) {
    return RecordService.list().then(function(records) {
      return records.filter(function(r) { return r.activityId === id; }).length;
    });
  }

  global.WorkActivityService = {
    listAll:         listAll,
    getById:         getById,
    create:          create,
    rename:          rename,
    remove:          remove,
    reassignRecords: reassignRecords,
    countRecords:    countRecords,
  };

}(window));
