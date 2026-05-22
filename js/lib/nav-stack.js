// NavStack — unified back navigation (R1)
// Exposes: window.NavStack

(function(global) {
  'use strict';

  var stack = [];
  var MAX_DEPTH = 24;

  // Default on for R1 ship; disable via UIPhase.disable('nav_stack')
  var DEFAULT_ON = { nav_stack: true };

  function enabled() {
    if (!global.UIPhase) return true;
    var v = localStorage.getItem('wp_ui_phase_nav_stack');
    if (v === null) return DEFAULT_ON.nav_stack;
    return v === '1';
  }

  function labelFor(screen, opts) {
    opts = opts || {};
    if (opts.navLabel) return opts.navLabel;
    if (screen === 'list') return 'Records';
    if (screen === 'home') return 'Home';
    if (screen === 'view') return 'Record';
    if (screen === 'wizard') return opts.record && opts.record.job ? opts.record.job.slice(0, 24) : 'Edit';
    if (screen === 'sale-tally') return 'Sell';
    if (screen === 'io-create') return 'New Outcome';
    if (screen === 'share') return 'Share';
    if (screen === 'financial') return 'Financials';
    if (screen === 'finance-overview') return 'Finance';
    if (screen === 'management') return 'Manage';
    if (screen === 'help') return 'Help';
    return screen;
  }

  function push(screen, opts) {
    if (!enabled() || !screen) return;
    opts = opts || {};
    var entry = {
      screen: screen,
      opts: opts,
      label: labelFor(screen, opts),
    };
    var top = stack[stack.length - 1];
    if (top && top.screen === entry.screen) {
      var a = JSON.stringify(top.opts || {});
      var b = JSON.stringify(entry.opts || {});
      if (a === b) return;
    }
    stack.push(entry);
    if (stack.length > MAX_DEPTH) stack.shift();
    updateCrumbBar();
    syncScreenTitle(screen);
  }

  function replaceRoot(screen, opts) {
    if (!enabled()) return;
    stack = [{ screen: screen, opts: opts || {}, label: labelFor(screen, opts) }];
    updateCrumbBar();
    syncScreenTitle(screen);
  }

  function pop() {
    if (!enabled() || stack.length <= 1) return null;
    stack.pop();
    updateCrumbBar();
    var ent = stack[stack.length - 1];
    if (ent) syncScreenTitle(ent.screen);
    return ent;
  }

  function peek() {
    return stack[stack.length - 1] || null;
  }

  function amendTop(extra) {
    if (!stack.length || !extra) return;
    var top = stack[stack.length - 1];
    var keys = Object.keys(extra);
    for (var i = 0; i < keys.length; i++) {
      top.opts[keys[i]] = extra[keys[i]];
    }
  }

  function depth() {
    return stack.length;
  }

  function canPop() {
    return enabled() && stack.length > 1;
  }

  var OWN_TITLE_IDS = {
    'view-title': 1,
    'wizard-title': 1,
    'list-crumb-label': 1,
    'sale-tally-title': 1,
    'io-create-title': 1,
  };

  function syncScreenTitle(screenName) {
    if (!enabled() || !screenName) return;
    var top = stack[stack.length - 1];
    if (!top || top.screen !== screenName) return;
    var screenEl = document.getElementById('screen-' + screenName);
    if (!screenEl) return;
    var lbl = screenEl.querySelector('.screen-crumb .sc-label');
    if (!lbl || (lbl.id && OWN_TITLE_IDS[lbl.id])) return;
    if (!lbl.getAttribute('data-base-label')) {
      lbl.setAttribute('data-base-label', lbl.textContent);
    }
    var base = lbl.getAttribute('data-base-label');
    if (stack.length >= 2) {
      var parent = stack[stack.length - 2];
      lbl.textContent = (parent && parent.label ? parent.label : '') + ' \u203a ' + (top.label || base);
    } else {
      lbl.textContent = top.label || base;
    }
  }

  function updateCrumbBar() {
    var bar = document.getElementById('nav-crumb-bar');
    if (!bar) return;
    if (!enabled() || stack.length < 2) {
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }
    var parts = [];
    var start = Math.max(0, stack.length - 3);
    for (var i = start; i < stack.length; i++) {
      parts.push('<span class="nav-crumb-part' + (i === stack.length - 1 ? ' nav-crumb-current' : '') + '">' +
        esc(stack[i].label) + '</span>');
      if (i < stack.length - 1) parts.push('<span class="nav-crumb-sep">\u203a</span>');
    }
    bar.style.display = 'flex';
    bar.innerHTML = parts.join('');
  }

  function initCrumbBar() {
    var screens = document.querySelectorAll('.screen .content');
    for (var i = 0; i < screens.length; i++) {
      var parent = screens[i].parentNode;
      if (!parent || parent.querySelector('#nav-crumb-bar')) continue;
      var bar = document.createElement('div');
      bar.id = 'nav-crumb-bar';
      bar.className = 'nav-crumb-bar';
      bar.style.display = 'none';
      parent.insertBefore(bar, screens[i]);
    }
  }

  global.NavStack = {
    enabled: enabled,
    push: push,
    replaceRoot: replaceRoot,
    pop: pop,
    peek: peek,
    amendTop: amendTop,
    depth: depth,
    canPop: canPop,
    updateCrumbBar: updateCrumbBar,
    initCrumbBar: initCrumbBar,
    syncScreenTitle: syncScreenTitle,
  };

}(window));
