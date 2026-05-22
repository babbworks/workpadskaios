// Screen: Country selector + per-country/general settings
// Tabs: Select | Settings
// Exposes: window.CountryScreen

(function(global) {
  'use strict';

  var STORE_KEY = 'wp_selected_country';

  var el = {
    content: document.getElementById('country-content'),
  };

  var returnTo   = null;   // 'management' | null → routes back to list
  var currentTab = 'select';
  var filtered   = [];
  var focusIdx   = 0;
  var searchTerm = '';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function flagEmoji(iso) {
    try {
      var a = iso.charCodeAt(0) - 65 + 0x1F1E6;
      var b = iso.charCodeAt(1) - 65 + 0x1F1E6;
      return String.fromCodePoint(a, b);
    } catch (_) { return iso; }
  }

  function getSelected() {
    var raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function setSelected(iso, name) {
    localStorage.setItem(STORE_KEY, JSON.stringify({ iso: iso, name: name }));
  }

  // ── Tab bar ────────────────────────────────────────────────────────────────

  function tabBar() {
    return '<div class="wizard-tabs" style="margin-bottom:0;">' +
      '<span class="wizard-tab' + (currentTab === 'select' ? ' active' : '') +
        '" data-ctab="select">Country</span>' +
      '<span class="wizard-tab' + (currentTab === 'settings' ? ' active' : '') +
        '" data-ctab="settings">Settings</span>' +
    '</div>';
  }

  // ── Select tab ─────────────────────────────────────────────────────────────

  function filter(term) {
    searchTerm = term;
    var t = term.toLowerCase();
    filtered = COUNTRIES.filter(function(c) {
      return !t || c[1].toLowerCase().indexOf(t) !== -1 || c[0].toLowerCase().indexOf(t) !== -1;
    });
    focusIdx = 0;
    renderSelect();
  }

  function renderSelect() {
    var selected = getSelected();
    var html = filtered.map(function(c, i) {
      var isSel = selected && selected.iso === c[0];
      return '<div class="country-item' + (focusIdx === i ? ' focused' : '') +
        (isSel ? ' selected' : '') + '" data-cidx="' + i + '">' +
        '<span class="country-flag">' + flagEmoji(c[0]) + '</span>' +
        '<span class="country-name">' + esc(c[1]) + '</span>' +
        (isSel ? '<span class="country-check">\u2713</span>' : '') +
        '</div>';
    }).join('');

    el.content.innerHTML = tabBar() +
      '<div class="country-search-wrap">' +
        '<input class="field-input country-search" id="country-search" type="text" ' +
          'placeholder="Search\u2026" value="' + esc(searchTerm) + '" autocomplete="off">' +
      '</div>' +
      '<div class="country-list" id="country-list">' +
        (html || (global.EmptyState
          ? EmptyState.render('No matches', { hint: 'Try a shorter search.' })
          : '<div class="empty-state">No matches.</div>')) +
      '</div>';

    bindTabEvents();

    var inp = document.getElementById('country-search');
    if (inp) {
      inp.addEventListener('input', function() { filter(this.value); });
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(0); }
        if (e.key === 'Enter')     { e.preventDefault(); selectFocused(); }
      });
    }

    var items = el.content.querySelectorAll('.country-item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', (function(idx) {
        return function() { focusIdx = idx; selectFocused(); };
      })(i));
    }
  }

  function focusItem(idx) {
    var nodes = el.content.querySelectorAll('.country-item');
    nodes.forEach(function(n) { n.classList.remove('focused'); });
    if (idx >= 0 && idx < nodes.length) {
      focusIdx = idx;
      nodes[idx].classList.add('focused');
      nodes[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  function selectFocused() {
    var c = filtered[focusIdx];
    if (!c) return;
    setSelected(c[0], c[1]);
    goBack();
  }

  // ── Settings tab ───────────────────────────────────────────────────────────

  function renderSettings() {
    var sel = getSelected();
    var countryName = sel ? sel.name : 'Not set';
    var countryIso  = sel ? sel.iso  : '';
    var storedImg   = countryIso ? localStorage.getItem('wp_country_img_' + countryIso) : null;
    var locale      = ActivityService.getLocale();

    el.content.innerHTML = tabBar() +
      '<div style="padding:8px 10px 4px; font-size:10px; color:var(--text-muted);' +
        ' text-transform:uppercase; letter-spacing:0.5px;">Selected Country</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Country</div>' +
        '<div class="view-field-value">' +
          (countryIso ? flagEmoji(countryIso) + ' ' : '') + esc(countryName) +
        '</div>' +
      '</div>' +

      '<div style="padding:8px 10px 4px; font-size:10px; color:var(--text-muted);' +
        ' text-transform:uppercase; letter-spacing:0.5px; border-top:1px solid var(--border);' +
        ' margin-top:6px;">Locale</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">Currency</div>' +
        '<div class="view-field-value">' + esc(locale.currency) + '</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label">' + esc(locale.tax_label) + '</div>' +
        '<div class="view-field-value">' + esc(locale.tax_rate) + '%</div>' +
      '</div>' +
      '<div class="view-field">' +
        '<div class="view-field-label" style="color:var(--text-muted);">Change locale</div>' +
        '<div class="view-field-value" style="color:var(--text-muted); font-size:10px;">' +
          'Settings \u203a Region / Currency' +
        '</div>' +
      '</div>' +

      '<div style="padding:8px 10px 4px; font-size:10px; color:var(--text-muted);' +
        ' text-transform:uppercase; letter-spacing:0.5px; border-top:1px solid var(--border);' +
        ' margin-top:6px;">Panel Background</div>' +
      '<div class="field-group">' +
        '<div class="field-label">Image</div>' +
        '<input type="file" class="field-input" id="cs-img-file" accept="image/*" ' +
          'style="padding:2px 4px; font-size:11px;">' +
      '</div>' +
      '<div class="mgmt-img-preview" id="cs-img-preview">' +
        (storedImg
          ? '<img src="' + storedImg + '">'
          : '<span style="font-size:10px;color:var(--text-muted);">No image set</span>') +
      '</div>' +
      (storedImg ? '<div style="padding:0 10px 4px;">' +
        '<span class="badge" id="cs-img-clear" style="font-size:10px;color:var(--danger);">Clear image</span>' +
      '</div>' : '');

    bindTabEvents();
    bindImageEvents(countryIso);
  }

  function bindImageEvents(iso) {
    var fileInp = document.getElementById('cs-img-file');
    var preview = document.getElementById('cs-img-preview');
    var clearBtn = document.getElementById('cs-img-clear');

    if (fileInp && iso) {
      fileInp.addEventListener('change', function() {
        var file = this.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          localStorage.setItem('wp_country_img_' + iso, ev.target.result);
          if (preview) preview.innerHTML = '<img src="' + ev.target.result + '">';
        };
        reader.readAsDataURL(file);
      });
    }

    if (clearBtn && iso) {
      clearBtn.addEventListener('click', function() {
        localStorage.removeItem('wp_country_img_' + iso);
        renderSettings();
      });
    }
  }

  // ── Tab events ─────────────────────────────────────────────────────────────

  function bindTabEvents() {
    var tabs = el.content.querySelectorAll('[data-ctab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', (function(tab) {
        return function() { setTab(tab); };
      })(tabs[i].getAttribute('data-ctab')));
    }
  }

  function setTab(tab) {
    currentTab = tab;
    if (tab === 'settings') {
      renderSettings();
    } else {
      renderSelect();
      var inp = document.getElementById('country-search');
      if (inp) inp.focus();
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goBack() {
    if (returnTo === 'management') {
      global.App.showManagement();
    } else {
      global.App.showList();
    }
  }

  function onShow(rt) {
    returnTo   = rt || null;
    currentTab = 'select';
    searchTerm = '';
    focusIdx   = 0;
    filtered   = COUNTRIES.slice();
    renderSelect();
    var inp = document.getElementById('country-search');
    if (inp) inp.focus();
  }

  function onKey(key) {
    if (currentTab === 'settings') {
      switch (key) {
        case 'ArrowLeft':  setTab('select');   break;
        case 'Backspace':  goBack();           break;
      }
      return;
    }
    // Select tab
    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) focusItem(focusIdx - 1);
        else { var inp = document.getElementById('country-search'); if (inp) inp.focus(); }
        break;
      case 'ArrowDown':
        if (focusIdx < filtered.length - 1) focusItem(focusIdx + 1);
        break;
      case 'ArrowRight': setTab('settings'); break;
      case 'Enter':      selectFocused();    break;
      case 'Backspace':  goBack();           break;
    }
  }

  global.CountryScreen = { onShow: onShow, onKey: onKey, getSelected: getSelected, flagEmoji: flagEmoji };

}(window));
