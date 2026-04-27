// ActivityService — Activity Profile management
// Spec: workpads-standard/activity-profile.md (ARC-011)
// Exposes: window.ActivityService (singleton)

(function(global) {
  'use strict';

  var ACTIVE_KEY    = 'wp_activity_active';
  var PREFIX        = 'wp_activity_';

  function genId() {
    return 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // Get the active Activity object. Returns null if none set.
  function getActive() {
    var activeId = localStorage.getItem(ACTIVE_KEY);
    if (!activeId) return null;
    var raw = localStorage.getItem(PREFIX + activeId);
    return raw ? JSON.parse(raw) : null;
  }

  // Get all activities.
  function listAll() {
    var results = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(PREFIX) === 0 && key !== ACTIVE_KEY) {
        try { results.push(JSON.parse(localStorage.getItem(key))); } catch (_) {}
      }
    }
    return results;
  }

  // Create a new activity. Sets it as active if none exists.
  function create(fields) {
    var id = genId();
    var activity = Object.assign({
      id:                 id,
      name:               '',
      type:               'freelance',
      isBusiness:         false,
      phone:              '',
      whatsapp_confirmed: false,
      vatRegistered:      false,
      vatNumber:          '',
      currency:           'GBP',
    }, fields, { id: id });

    localStorage.setItem(PREFIX + id, JSON.stringify(activity));

    if (!localStorage.getItem(ACTIVE_KEY)) {
      localStorage.setItem(ACTIVE_KEY, id);
    }

    return activity;
  }

  // Update fields on the active activity.
  function update(fields) {
    var activeId = localStorage.getItem(ACTIVE_KEY);
    if (!activeId) return;
    var raw = localStorage.getItem(PREFIX + activeId);
    if (!raw) return;
    var activity = Object.assign(JSON.parse(raw), fields);
    localStorage.setItem(PREFIX + activeId, JSON.stringify(activity));
    return activity;
  }

  // Set active activity by ID.
  function setActive(id) {
    localStorage.setItem(ACTIVE_KEY, id);
  }

  // Check if any activity exists (used for onboarding gate).
  function hasAny() {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(PREFIX) === 0 && key !== ACTIVE_KEY) return true;
    }
    return false;
  }

  // Get IS_SENDER identity for use in encoding: { name, phone }
  function getSenderIdentity() {
    var act = getActive();
    if (!act) return { name: '', phone: '' };
    return { name: act.name || '', phone: act.phone || '' };
  }

  global.ActivityService = {
    getActive:         getActive,
    listAll:           listAll,
    create:            create,
    update:            update,
    setActive:         setActive,
    hasAny:            hasAny,
    getSenderIdentity: getSenderIdentity,
  };

}(window));
