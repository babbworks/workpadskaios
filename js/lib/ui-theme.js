// ui-theme.js — KaiOS theme registry + master switch (data-ui-theme on <html>)
// P0: legacy (dark app.css) | v2 (slate + white, workpads-ui-v2.css)
// Exposes: window.UITheme

(function(global) {
  'use strict';

  var STORE_KEY = 'wp_ui_theme_id';
  var LINK_ID = 'wp-theme-stylesheet';
  var ATTR = 'data-ui-theme';

  /** @type {Record<string, { id: string, label: string, href: string|null, mono: boolean }>} */
  var THEMES = {
    legacy: {
      id: 'legacy',
      label: 'Legacy dark',
      href: null,
      mono: false,
    },
    v2: {
      id: 'v2',
      label: 'Workpads v2',
      href: 'css/workpads-ui-v2.css',
      mono: true,
    },
  };

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function normalize(id) {
    id = String(id || '').trim();
    return THEMES[id] ? id : 'legacy';
  }

  function get() {
    try {
      return normalize(localStorage.getItem(STORE_KEY));
    } catch (_) {
      return 'legacy';
    }
  }

  function ensureLink() {
    var link = document.getElementById(LINK_ID);
    if (!link) {
      link = document.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    return link;
  }

  function apply(id) {
    id = normalize(id);
    var theme = THEMES[id];
    var root = document.documentElement;

    try {
      localStorage.setItem(STORE_KEY, id);
    } catch (_) {}

    root.setAttribute(ATTR, id);

    var link = ensureLink();
    if (theme.href) {
      link.href = theme.href;
      link.disabled = false;
    } else {
      if (link.removeAttribute) link.removeAttribute('href');
      else link.href = '';
      link.disabled = true;
    }

    if (theme.mono) {
      root.setAttribute('data-ui-mono', '1');
    } else {
      root.removeAttribute('data-ui-mono');
    }

    if (id === 'v2' && global.UIPhase && UIPhase.enablePhase6) {
      UIPhase.enablePhase6();
    }

    return id;
  }

  function set(id) {
    return apply(id);
  }

  function isV2() {
    return get() === 'v2';
  }

  function isActive(themeId) {
    return get() === normalize(themeId);
  }

  function list() {
    return Object.keys(THEMES).map(function(k) {
      return {
        id: THEMES[k].id,
        label: THEMES[k].label,
        active: get() === THEMES[k].id,
      };
    });
  }

  function registerTheme(spec) {
    if (!spec || !spec.id || !spec.label) return false;
    THEMES[normalize(spec.id)] = {
      id: spec.id,
      label: spec.label,
      href: spec.href || null,
      mono: !!spec.mono,
    };
    return true;
  }

  function cycle() {
    var keys = Object.keys(THEMES);
    var cur = get();
    var idx = keys.indexOf(cur);
    var next = keys[(idx + 1) % keys.length];
    return apply(next);
  }

  function onBoot() {
    apply(get());
  }

  global.UITheme = {
    STORE_KEY: STORE_KEY,
    THEMES: THEMES,
    get: get,
    set: set,
    apply: apply,
    cycle: cycle,
    list: list,
    registerTheme: registerTheme,
    isV2: isV2,
    isActive: isActive,
    onBoot: onBoot,
    esc: esc,
  };

}(typeof window !== 'undefined' ? window : global));
