// ActivityService — Activity Profile management
// Spec: workpads-standard/activity-profile.md (ARC-011)
// Exposes: window.ActivityService (singleton)

(function(global) {
  'use strict';

  var ACTIVE_KEY = 'wp_activity_active';
  var PREFIX     = 'wp_activity_';

  // ── Locale registry ───────────────────────────────────────────────────────────
  // Each entry is the single source of truth for its locale —
  // used for onboarding select, management settings, and getLocale() defaults.

  var LOCALE_OPTIONS = [
    { id: 'gb-v1', label: 'United Kingdom (GBP \xb7 VAT 20%)',    currency: 'GBP', tax_label: 'VAT',      tax_rate: '20',   template_pack: 'gb' },
    { id: 'ng-v1', label: 'Nigeria (NGN \xb7 VAT 7.5%)',           currency: 'NGN', tax_label: 'VAT',      tax_rate: '7.5',  template_pack: 'ng' },
    { id: 'ke-v1', label: 'Kenya (KES \xb7 VAT 16%)',              currency: 'KES', tax_label: 'VAT',      tax_rate: '16',   template_pack: 'ke' },
    { id: 'za-v1', label: 'South Africa (ZAR \xb7 VAT 15%)',       currency: 'ZAR', tax_label: 'VAT',      tax_rate: '15',   template_pack: 'za' },
    { id: 'gh-v1', label: 'Ghana (GHS \xb7 VAT 12.5%)',            currency: 'GHS', tax_label: 'VAT',      tax_rate: '12.5', template_pack: 'gh' },
    { id: 'us-v1', label: 'United States (USD)',                    currency: 'USD', tax_label: 'Tax',      tax_rate: '0',    template_pack: 'us' },
    { id: 'eu-v1', label: 'Europe (EUR \xb7 VAT 20%)',              currency: 'EUR', tax_label: 'VAT',      tax_rate: '20',   template_pack: 'eu' },
    { id: 'in-v1', label: 'India (INR \xb7 GST 18%)',              currency: 'INR', tax_label: 'GST',      tax_rate: '18',   template_pack: 'in' },
    { id: 'ph-v1', label: 'Philippines (PHP \xb7 VAT 12%)',        currency: 'PHP', tax_label: 'VAT',      tax_rate: '12',   template_pack: 'ph' },
    { id: 'au-v1', label: 'Australia (AUD \xb7 GST 10%)',          currency: 'AUD', tax_label: 'GST',      tax_rate: '10',   template_pack: 'au' },
  ];

  function findPreset(localeId) {
    for (var i = 0; i < LOCALE_OPTIONS.length; i++) {
      if (LOCALE_OPTIONS[i].id === localeId) return LOCALE_OPTIONS[i];
    }
    return null;
  }

  // ── Storage helpers ───────────────────────────────────────────────────────────

  function genId() {
    return 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function getActive() {
    var activeId = localStorage.getItem(ACTIVE_KEY);
    if (!activeId) return null;
    var raw = localStorage.getItem(PREFIX + activeId);
    return raw ? JSON.parse(raw) : null;
  }

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

  // Create a new activity. locale fields are merged from the preset if locale id provided.
  function create(fields) {
    var id = genId();
    var localeId = (fields && fields.locale) || 'gb-v1';
    var preset   = findPreset(localeId) || LOCALE_OPTIONS[0];
    var activity = merge(
      {
        id:                 id,
        name:               '',
        type:               'freelance',
        isBusiness:         false,
        phone:              '',
        whatsapp_confirmed: false,
        vatRegistered:      false,
        vatNumber:          '',
        locale:             preset.id,
        currency:           preset.currency,
        tax_label:          preset.tax_label,
        tax_rate:           preset.tax_rate,
        template_pack:      preset.template_pack,
      },
      fields,
      { id: id }
    );
    localStorage.setItem(PREFIX + id, JSON.stringify(activity));
    if (!localStorage.getItem(ACTIVE_KEY)) {
      localStorage.setItem(ACTIVE_KEY, id);
    }
    return activity;
  }

  function update(fields) {
    var activeId = localStorage.getItem(ACTIVE_KEY);
    if (!activeId) return;
    var raw = localStorage.getItem(PREFIX + activeId);
    if (!raw) return;
    var activity = merge(JSON.parse(raw), fields);
    localStorage.setItem(PREFIX + activeId, JSON.stringify(activity));
    return activity;
  }

  // Set locale by id — updates all locale-derived fields on the active activity.
  function setLocale(localeId) {
    var preset = findPreset(localeId);
    if (!preset) return;
    return update({
      locale:        preset.id,
      currency:      preset.currency,
      tax_label:     preset.tax_label,
      tax_rate:      preset.tax_rate,
      template_pack: preset.template_pack,
    });
  }

  // Return the locale config for the active activity.
  // Falls back to gb-v1 defaults if no activity or no locale set.
  function getLocale() {
    var act    = getActive();
    var preset = findPreset(act && act.locale) || LOCALE_OPTIONS[0];
    return {
      locale:        (act && act.locale)        || preset.id,
      currency:      (act && act.currency)      || preset.currency,
      tax_label:     (act && act.tax_label)     || preset.tax_label,
      tax_rate:      (act && act.tax_rate)      || preset.tax_rate,
      template_pack: (act && act.template_pack) || preset.template_pack,
    };
  }

  function setActive(id) {
    localStorage.setItem(ACTIVE_KEY, id);
  }

  function hasAny() {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(PREFIX) === 0 && key !== ACTIVE_KEY) return true;
    }
    return false;
  }

  function getSenderIdentity() {
    var act = getActive();
    if (!act) return { name: '', phone: '' };
    return { name: act.name || '', phone: act.phone || '' };
  }

  global.ActivityService = {
    LOCALE_OPTIONS:    LOCALE_OPTIONS,
    getActive:         getActive,
    listAll:           listAll,
    create:            create,
    update:            update,
    setLocale:         setLocale,
    getLocale:         getLocale,
    setActive:         setActive,
    hasAny:            hasAny,
    getSenderIdentity: getSenderIdentity,
  };

}(window));
