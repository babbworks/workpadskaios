// Sale catalogue — items/services for quick tally (per-activity optional)
// Exposes: window.SaleCatalogue

(function(global) {
  'use strict';

  var KEY = 'wp_sale_catalogue_v1';

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveAll(map) {
    localStorage.setItem(KEY, JSON.stringify(map));
  }

  function bucketKey(activityId) {
    return activityId || '_default';
  }

  function list(activityId) {
    var map = loadAll();
    var items = map[bucketKey(activityId)] || [];
    return items.slice();
  }

  function saveItem(activityId, item) {
    var map = loadAll();
    var bk = bucketKey(activityId);
    var items = map[bk] || [];
    var id = item.id || ('si_' + Date.now());
    var entry = {
      id: id,
      name: (item.name || '').trim(),
      price: String(item.price != null ? item.price : ''),
    };
    var found = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i] = entry;
        found = true;
        break;
      }
    }
    if (!found) items.push(entry);
    items.sort(function(a, b) { return a.name.localeCompare(b.name); });
    map[bk] = items;
    saveAll(map);
    return entry;
  }

  function removeItem(activityId, id) {
    var map = loadAll();
    var bk = bucketKey(activityId);
    var items = (map[bk] || []).filter(function(it) { return it.id !== id; });
    map[bk] = items;
    saveAll(map);
    return items;
  }

  function getItem(activityId, id) {
    var items = list(activityId);
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  global.SaleCatalogue = {
    list: list,
    saveItem: saveItem,
    removeItem: removeItem,
    getItem: getItem,
  };

}(window));
