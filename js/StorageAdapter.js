// StorageAdapter — prefix-scoped localStorage wrapper
// Spec: workpads-standard/storage-adapter-contract.md (ARC-001)
// All methods return Promises. Interface is identical to the future IndexedDBAdapter.
// Exposes: window.StorageAdapter

(function(global) {
  'use strict';

  function StorageAdapter(prefix) {
    this.prefix = prefix;
  }

  StorageAdapter.prototype.put = function(id, data) {
    try {
      localStorage.setItem(this.prefix + id, JSON.stringify(data));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(new Error('StorageError: put failed — ' + e.message));
    }
  };

  StorageAdapter.prototype.get = function(id) {
    try {
      var raw = localStorage.getItem(this.prefix + id);
      if (raw === null) return Promise.resolve(null);
      return Promise.resolve(JSON.parse(raw));
    } catch (e) {
      return Promise.reject(new Error('StorageError: get failed — ' + e.message));
    }
  };

  StorageAdapter.prototype.list = function() {
    try {
      var results = [];
      var prefix = this.prefix;
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0) {
          var id = key.slice(prefix.length);
          var raw = localStorage.getItem(key);
          if (raw !== null) {
            try {
              results.push({ id: id, data: JSON.parse(raw) });
            } catch (_) { /* skip corrupt entries */ }
          }
        }
      }
      return Promise.resolve(results);
    } catch (e) {
      return Promise.reject(new Error('StorageError: list failed — ' + e.message));
    }
  };

  StorageAdapter.prototype.remove = function(id) {
    try {
      localStorage.removeItem(this.prefix + id);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(new Error('StorageError: remove failed — ' + e.message));
    }
  };

  StorageAdapter.prototype.clear = function() {
    try {
      var prefix = this.prefix;
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0) toRemove.push(key);
      }
      toRemove.forEach(function(k) { localStorage.removeItem(k); });
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(new Error('StorageError: clear failed — ' + e.message));
    }
  };

  StorageAdapter.prototype.count = function() {
    try {
      var prefix = this.prefix;
      var n = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0) n++;
      }
      return Promise.resolve(n);
    } catch (e) {
      return Promise.reject(new Error('StorageError: count failed — ' + e.message));
    }
  };

  global.StorageAdapter = StorageAdapter;

}(window));
