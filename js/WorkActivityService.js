// WorkActivityService — named work activities for grouping records
// Distinct from ActivityService (user profile). Exposes: window.WorkActivityService

(function(global) {
  'use strict';

  var PREFIX = 'wp_wact_';

  var ACT_COLORS = [
    '#4a9eff','#e05050','#50c878','#f0a030','#c878e0',
    '#00c8c0','#ff6080','#90c840','#f0d040','#8880ff',
    '#ff8040','#40d0a0','#d04080','#60ff80','#ff40c0','#60b0d8',
  ];

  function genId() {
    return 'wact_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function _key(id) { return PREFIX + id; }

  function listAll() {
    var results = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        try {
          var act = JSON.parse(localStorage.getItem(k));
          if (global.WPActivityTaxonomy) global.WPActivityTaxonomy.normalizeActivity(act);
          results.push(act);
        } catch (_) {}
      }
    }
    results.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
    return results;
  }

  function getById(id) {
    var raw = localStorage.getItem(_key(id));
    if (!raw) return null;
    var act = JSON.parse(raw);
    if (global.WPActivityTaxonomy) global.WPActivityTaxonomy.normalizeActivity(act);
    return act;
  }

  function update(id, partial) {
    var act = getById(id);
    if (!act) return null;
    var keys = Object.keys(partial || {});
    for (var i = 0; i < keys.length; i++) act[keys[i]] = partial[keys[i]];
    if (global.WPActivityTaxonomy) global.WPActivityTaxonomy.normalizeActivity(act);
    localStorage.setItem(_key(id), JSON.stringify(act));
    return act;
  }

  function create(name, typeOrOpts, settingLegacy) {
    var id = genId();
    var color = ACT_COLORS[Math.floor(Math.random() * ACT_COLORS.length)];
    var opts = (typeOrOpts && typeof typeOrOpts === 'object') ? typeOrOpts : {
      type: typeOrOpts,
      setting: settingLegacy,
    };
    var act = {
      id: id,
      name: String(name || '').trim(),
      color: color,
      type: (opts.type === 'other' ? 'other' : 'own'),
      setting: (opts.setting === 'base' || opts.setting === 'remote') ? opts.setting : 'field',
      createdAt: Date.now(),
    };
    if (global.WPActivityTaxonomy) global.WPActivityTaxonomy.normalizeActivity(act);
    localStorage.setItem(_key(id), JSON.stringify(act));
    return act;
  }

  function setType(id, type) {
    var act = getById(id);
    if (!act) return;
    act.type = (type === 'other' ? 'other' : 'own');
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
    update:          update,
    rename:          rename,
    setType:         setType,
    remove:          remove,
    reassignRecords: reassignRecords,
    countRecords:    countRecords,
  };

}(window));
