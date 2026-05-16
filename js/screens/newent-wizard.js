// Screen: NewEnt Wizard — Business plan creation with integrated toolbar
// Same toolbar pattern as record view: sections dropdown, 3-state collapse,
// search bar, dots anchored to framework sections, Plan button in top bar.
// Exposes: window.NewEntWizardScreen

(function(global) {
  'use strict';

  var SCREENS = NewEntTemplate.WIZARD_SCREENS;

  var el = {
    title:   document.getElementById('newent-wizard-title'),
    content: document.getElementById('newent-wizard-content'),
    csk:     document.getElementById('newent-wiz-csk'),
  };

  var currentScreen = 0;
  var formData = {};
  var editingSlug = null;

  // Plan section browser state (toolbar)
  var planSectionIdx = 0;
  var planCollapseState = 0; // 0=full, 1=labels-only, 2=headers-only
  var planSearchTerm = '';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function fieldGroup(id, label, value, type, placeholder) {
    type = type || 'text';
    var ph = placeholder ? ' placeholder="' + esc(placeholder) + '"' : '';
    if (type === 'textarea') {
      return '<div class="field-group">' +
        '<div class="field-label">' + label + '</div>' +
        '<textarea class="field-input" id="ne-' + id + '" rows="3" ' +
          'style="height:54px;resize:none;"' + ph + '>' + esc(value) + '</textarea>' +
        '</div>';
    }
    return '<div class="field-group">' +
      '<div class="field-label">' + label + '</div>' +
      '<input class="field-input" id="ne-' + id + '" type="' + type + '" ' +
        'value="' + esc(value) + '" autocomplete="off" autocorrect="off" spellcheck="false"' + ph + '>' +
      '</div>';
  }

  function selectGroup(id, label, options, selected) {
    var opts = options.map(function(o) {
      var sel = o.value === selected ? ' selected' : '';
      var desc = o.desc ? ' \u2014 ' + o.desc : '';
      return '<option value="' + esc(o.value) + '"' + sel + '>' + esc(o.label) + desc + '</option>';
    }).join('');
    return '<div class="field-group">' +
      '<div class="field-label">' + label + '</div>' +
      '<select class="field-input" id="ne-' + id + '">' + opts + '</select>' +
      '</div>';
  }

  // ── Framework sections helper ──────────────────────────────────────────────

  function getFrameworkSections() {
    var fwId = formData.industry_framework || 'generic';
    return NewEntTemplate.FRAMEWORK_SECTIONS[fwId] || NewEntTemplate.FRAMEWORK_SECTIONS['generic'];
  }

  function getFrameworkLabel() {
    var fwId = formData.industry_framework || 'generic';
    for (var i = 0; i < NewEntTemplate.INDUSTRY_FRAMEWORKS.length; i++) {
      if (NewEntTemplate.INDUSTRY_FRAMEWORKS[i].value === fwId) {
        return NewEntTemplate.INDUSTRY_FRAMEWORKS[i].label;
      }
    }
    return 'Generic';
  }

  // ── Progress indicators ────────────────────────────────────────────────────

  function updateProgress() {
    if (el.title) el.title.textContent = SCREENS[currentScreen].name;
  }

  function updateSoftkeys() {
    if (el.csk) {
      el.csk.textContent = currentScreen < (SCREENS.length - 1) ? 'Next' : 'Create';
    }
  }

  // ── Read form inputs ───────────────────────────────────────────────────────

  function readInputs() {
    var screen = SCREENS[currentScreen];
    if (!screen) return;
    for (var i = 0; i < screen.fields.length; i++) {
      var f = screen.fields[i];
      var inp = document.getElementById('ne-' + f.id);
      if (inp) {
        formData[f.id] = inp.value.trim();
      }
    }
    if (currentScreen === 0 && formData.name && !formData._slugManual) {
      formData.slug = NewEntTemplate.toSlug(formData.name);
    }
  }

  // ── Render: toolbar + plan section dots + form fields ──────────────────────

  function renderCurrentScreen() {
    readInputs();
    updateProgress();
    updateSoftkeys();

    var sections = getFrameworkSections();
    if (planSectionIdx >= sections.length) planSectionIdx = 0;
    var currentSection = sections[planSectionIdx];

    // Build plan section dots
    var dotsHtml = sections.map(function(s, i) {
      var active = i === planSectionIdx ? ' ne-dot-active' : '';
      return '<div class="ne-dot' + active + '" data-ne-dot="' + i + '" title="' + esc(s.title) + '"></div>';
    }).join('');

    // Build section dropdown options
    var selOpts = sections.map(function(s, i) {
      return '<option value="' + i + '"' + (i === planSectionIdx ? ' selected' : '') + '>' + esc(s.title) + '</option>';
    }).join('');

    // Build form fields for current wizard screen
    var screen = SCREENS[currentScreen];
    var fieldsHtml = '';
    for (var i = 0; i < screen.fields.length; i++) {
      var f = screen.fields[i];
      var val = formData[f.id] || '';
      if (f.type === 'select') {
        fieldsHtml += selectGroup(f.id, f.label, f.options, val);
      } else {
        fieldsHtml += fieldGroup(f.id, f.label, val, f.type, f.placeholder);
      }
    }

    // Assemble: toolbar + dots + fields
    el.content.innerHTML =
      // Top bar: Plan button (framework label) centered
      '<div class="ne-panel-topbar">' +
        '<div class="ne-panel-plan-btn" id="ne-wiz-plan-btn">' + esc(getFrameworkLabel()) + '</div>' +
      '</div>' +
      // Toolbar: section dropdown + collapse toggle + search
      '<div class="ne-panel-toolbar">' +
        '<select class="ne-panel-sel" id="ne-wiz-sec-sel">' + selOpts + '</select>' +
        '<div class="ne-panel-toggle" id="ne-wiz-toggle"></div>' +
        '<input class="ne-panel-search" id="ne-wiz-search" type="text" placeholder="Search\u2026" value="' + esc(planSearchTerm) + '">' +
      '</div>' +
      // Dots row (framework sections)
      '<div class="ne-panel-dots" id="ne-wiz-dots">' + dotsHtml + '</div>' +
      // Form fields area
      '<div class="ne-wiz-fields' +
        (planCollapseState === 1 ? ' ne-wiz-compact-1' : '') +
        (planCollapseState === 2 ? ' ne-wiz-compact-2' : '') +
        '" id="ne-wiz-fields">' + fieldsHtml + '</div>';

    // ── Bind: Plan button
    var planBtn = document.getElementById('ne-wiz-plan-btn');
    if (planBtn) planBtn.addEventListener('click', function() {
      // Jump to Plan Config screen (screen 3)
      readInputs();
      currentScreen = 3;
      renderCurrentScreen();
    });

    // ── Bind: Section dropdown
    var secSel = document.getElementById('ne-wiz-sec-sel');
    if (secSel) secSel.addEventListener('change', function() {
      planSectionIdx = parseInt(this.value, 10) || 0;
      updateDotsDisplay();
      syncSectionToPanel();
    });

    // ── Bind: Collapse toggle
    var togEl = document.getElementById('ne-wiz-toggle');
    if (togEl) togEl.addEventListener('click', function() {
      planCollapseState = (planCollapseState + 1) % 3;
      var fieldsEl = document.getElementById('ne-wiz-fields');
      if (fieldsEl) {
        fieldsEl.classList.toggle('ne-wiz-compact-1', planCollapseState === 1);
        fieldsEl.classList.toggle('ne-wiz-compact-2', planCollapseState === 2);
      }
    });

    // ── Bind: Search
    var searchEl = document.getElementById('ne-wiz-search');
    if (searchEl) searchEl.addEventListener('input', function() {
      planSearchTerm = this.value.trim().toLowerCase();
      filterWizFields();
    });

    // ── Bind: Dots click
    var dotEls = el.content.querySelectorAll('[data-ne-dot]');
    for (var di = 0; di < dotEls.length; di++) {
      dotEls[di].addEventListener('click', (function(idx) {
        return function() {
          planSectionIdx = idx;
          updateDotsDisplay();
          // Update dropdown to match
          var sel = document.getElementById('ne-wiz-sec-sel');
          if (sel) sel.value = String(idx);
          syncSectionToPanel();
        };
      })(parseInt(dotEls[di].getAttribute('data-ne-dot'), 10)));
    }

    // ── Bind: Click-to-expand in compact modes
    var fieldsEl = document.getElementById('ne-wiz-fields');
    if (fieldsEl) fieldsEl.addEventListener('click', function(e) {
      if (planCollapseState === 0) return;
      var fg = e.target.closest ? e.target.closest('.field-group') : null;
      if (fg) {
        planCollapseState = 0;
        fieldsEl.classList.remove('ne-wiz-compact-1', 'ne-wiz-compact-2');
        // Flash the clicked field
        fg.classList.add('ne-flash');
        setTimeout(function() { fg.classList.remove('ne-flash'); }, 1000);
        // Focus the input inside
        var inp = fg.querySelector('input, textarea, select');
        if (inp) inp.focus();
      }
    });

    // ── Bind: Slug auto-update
    if (currentScreen === 0) {
      var nameInput = document.getElementById('ne-name');
      var slugInput = document.getElementById('ne-slug');
      if (nameInput && slugInput) {
        nameInput.addEventListener('input', function() {
          if (!formData._slugManual) {
            slugInput.value = NewEntTemplate.toSlug(nameInput.value);
          }
        });
        slugInput.addEventListener('input', function() {
          formData._slugManual = true;
        });
      }
    }

    // ── Bind: Framework select live update
    if (currentScreen === 3) {
      var fwSelect = document.getElementById('ne-industry_framework');
      if (fwSelect) {
        fwSelect.addEventListener('change', function() {
          formData.industry_framework = fwSelect.value;
          // Re-render to update dots and plan button
          renderCurrentScreen();
        });
      }
    }

    // Focus first field input (skip toolbar inputs)
    var firstField = document.querySelector('#ne-wiz-fields input, #ne-wiz-fields textarea, #ne-wiz-fields select');
    if (firstField) firstField.focus();

    // Set panel context
    WorkpadsPanel.setContext({
      screen: 'newent-wizard',
      wizardScreen: currentScreen,
      formData: formData,
      editingSlug: editingSlug,
    });
  }

  // ── Dots display update (without full re-render) ───────────────────────────

  function updateDotsDisplay() {
    var dotEls = document.querySelectorAll('#ne-wiz-dots [data-ne-dot]');
    for (var i = 0; i < dotEls.length; i++) {
      dotEls[i].classList.toggle('ne-dot-active', i === planSectionIdx);
    }
    // Update title to show current section name
    var sections = getFrameworkSections();
    if (el.title && sections[planSectionIdx]) {
      el.title.textContent = SCREENS[currentScreen].name + ' \u2014 ' + sections[planSectionIdx].title;
    }
  }

  // ── Search filter for wizard fields ────────────────────────────────────────

  function filterWizFields() {
    var fieldsEl = document.getElementById('ne-wiz-fields');
    if (!fieldsEl) return;
    var groups = fieldsEl.querySelectorAll('.field-group');
    for (var i = 0; i < groups.length; i++) {
      if (!planSearchTerm) {
        groups[i].style.display = '';
      } else {
        var text = groups[i].textContent.toLowerCase();
        groups[i].style.display = text.indexOf(planSearchTerm) !== -1 ? '' : 'none';
      }
    }
  }

  // ── Sync section index to left panel ───────────────────────────────────────

  function syncSectionToPanel() {
    if (typeof WorkpadsPanel !== 'undefined' && WorkpadsPanel.isOpen && WorkpadsPanel.isOpen()) {
      // Panel will re-render on next setContext, but we can also force via re-render
      WorkpadsPanel.setContext({
        screen: 'newent-wizard',
        wizardScreen: currentScreen,
        formData: formData,
        editingSlug: editingSlug,
        planSectionIdx: planSectionIdx,
      });
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goNext() {
    readInputs();
    if (currentScreen < SCREENS.length - 1) {
      currentScreen++;
      renderCurrentScreen();
    } else {
      saveAndExit();
    }
  }

  function goBack() {
    readInputs();
    if (currentScreen > 0) {
      currentScreen--;
      renderCurrentScreen();
    } else {
      App.showList();
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate() {
    if (!formData.name || !formData.name.trim()) {
      return { ok: false, error: 'Business name is required.', screen: 0 };
    }
    var slug = formData.slug || NewEntTemplate.toSlug(formData.name);
    if (!NewEntTemplate.isValidSlug(slug)) {
      return { ok: false, error: 'Invalid business slug. Use 2-60 lowercase chars, hyphens allowed.', screen: 0 };
    }
    if (!editingSlug && !NewEntTemplate.isSlugUnique(slug)) {
      return { ok: false, error: 'A business with slug "' + slug + '" already exists.', screen: 0 };
    }
    return { ok: true };
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  function saveAndExit() {
    readInputs();
    var check = validate();
    if (!check.ok) {
      alert(check.error);
      if (check.screen !== undefined && check.screen !== currentScreen) {
        currentScreen = check.screen;
        renderCurrentScreen();
      }
      return;
    }

    var result;
    if (editingSlug) {
      result = NewEntTemplate.update(editingSlug, formData);
    } else {
      result = NewEntTemplate.create(formData);
    }

    if (!result.ok) {
      alert(result.detail || result.error || 'Failed to save business.');
      return;
    }

    var biz = result.business;
    var fwLabel = getFrameworkLabel();

    RecordService.create({
      job: biz.name,
      record_type: 'newent',
      record_class: 'newent',
      newent_slug: biz.slug,
      newent_id: biz.id,
      details: [
        biz.industry_hint ? 'Industry: ' + biz.industry_hint : '',
        biz.stage ? 'Stage: ' + biz.stage : '',
        fwLabel ? 'Framework: ' + fwLabel : '',
        biz.plan && biz.plan.audience_framework ? 'Audience: ' + biz.plan.audience_framework : '',
      ].filter(Boolean).join(' \u00b7 '),
      story: biz.ent && biz.ent.purpose ? biz.ent.purpose : (biz.profile && biz.profile.vision ? biz.profile.vision : ''),
      draft: false,
    }).then(function() {
      App.showList();
    });
  }

  // ── Key handler ────────────────────────────────────────────────────────────

  function onKey(key) {
    // Check if focus is in the toolbar search
    var active = document.activeElement;
    var inSearch = active && active.id === 'ne-wiz-search';

    switch (key) {
      case 'Enter':
        if (inSearch) return; // let search input handle Enter
        goNext();
        break;
      case 'Backspace':
        if (inSearch && active.value) return; // let search clear
        goBack();
        break;
      case 'ArrowLeft':
        if (inSearch) return;
        if (currentScreen > 0) {
          readInputs();
          currentScreen--;
          renderCurrentScreen();
        }
        break;
      case 'ArrowRight':
        if (inSearch) return;
        if (currentScreen < SCREENS.length - 1) {
          readInputs();
          currentScreen++;
          renderCurrentScreen();
        }
        break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function onShow(existingSlug) {
    currentScreen = 0;
    formData = {};
    editingSlug = null;
    planSectionIdx = 0;
    planCollapseState = 0;
    planSearchTerm = '';

    if (existingSlug) {
      editingSlug = existingSlug;
      var biz = NewEntTemplate.get(existingSlug);
      if (biz) {
        formData = {
          name:              biz.name,
          slug:              biz.slug,
          industry_hint:     biz.industry_hint || '',
          stage:             biz.stage || 'idea',
          website:           biz.website || '',
          contact_name:      biz.contact ? biz.contact.name || '' : '',
          contact_email:     biz.contact ? biz.contact.email || '' : '',
          contact_phone:     biz.contact ? biz.contact.phone || '' : '',
          contact_role:      biz.contact ? biz.contact.role || '' : '',
          location_country:  biz.location ? biz.location.country || '' : '',
          location_city:     biz.location ? biz.location.city || '' : '',
          location_region:   biz.location ? biz.location.region || '' : '',
          location_timezone: biz.location ? biz.location.timezone || '' : '',
          plan_title:        biz.plan ? biz.plan.title || '' : '',
          industry_framework: biz.plan ? biz.plan.industry_framework || 'generic' : 'generic',
          audience_framework: biz.plan ? biz.plan.audience_framework || '' : '',
          plan_type:         biz.plan ? biz.plan.type || 'startup' : 'startup',
          plan_status:       biz.plan ? biz.plan.status || 'early' : 'early',
          target_audience:   biz.plan ? biz.plan.target_audience || '' : '',
          ent_purpose:       biz.ent ? biz.ent.purpose || '' : '',
          ent_value:         biz.ent ? biz.ent.value || '' : '',
          ent_customer:      biz.ent ? biz.ent.customer || '' : '',
          ent_diff:          biz.ent ? biz.ent.diff || '' : '',
          ent_edge:          biz.ent ? biz.ent.edge || '' : '',
          ent_moat:          biz.ent ? biz.ent.moat || '' : '',
          ent_proof:         biz.ent ? biz.ent.proof || '' : '',
          ent_blocker:       biz.ent ? biz.ent.blocker || '' : '',
          vision:            biz.profile ? biz.profile.vision || '' : '',
          mission:           biz.profile ? biz.profile.mission || '' : '',
          founding_story:    biz.profile ? biz.profile.founding_story || '' : '',
          coach_voice:       biz.plan ? biz.plan.coach_voice || 'partial' : 'partial',
          coach_intent:      biz.plan ? biz.plan.coach_intent || 'orient' : 'orient',
          _slugManual:       true,
        };
      }
    }

    renderCurrentScreen();
  }

  global.NewEntWizardScreen = {
    onShow: onShow,
    onKey:  onKey,
    // Sync: called by WorkpadsPanel when section changes in the panel
    setSectionIdx: function(idx) {
      planSectionIdx = idx;
      updateDotsDisplay();
    },
    getSectionIdx: function() { return planSectionIdx; },
    getFormData: function() { return formData; },
  };

}(window));
