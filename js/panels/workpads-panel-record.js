// WorkpadsPanelRecord — WorkpadsPanel split module
(function(global) {
  'use strict';

  var MGMT_TABS = ['user', 'records', 'personal', 'activities', 'templates'];
  var MGMT_TAB_LABELS = { user: 'User', records: 'Records', activities: 'Activities', personal: 'Personal', templates: 'My Templates' };

  function install(S) {
  function renderRecordPreview(rec) {
    if (!rec) { S.el.content.innerHTML = '<div class="panel-label">No record.</div>'; return; }
    // NewEnt business records get the plan section browser
    if ((rec.record_class || rec.recordClass || '') === 'newent' && rec.newent_slug) {
      S.renderNewEntPanel(rec);
      return;
    }
    // Log records get the activity-filtered log sidebar
    if ((rec.record_type || rec.recordType || '') === 'log') {
      S.renderLogPanel(rec);
      return;
    }
    // Contact records get a dedicated contact panel
    var recType = (rec.record_type || rec.recordType || '').toLowerCase();
    var recClass = (rec.record_class || rec.recordClass || '').toLowerCase();
    if (recType === 'contact' || recClass === 'contact') {
      S.renderContactPanel(rec);
      return;
    }
    if (rec.parentId) {
      S.renderChildPanel(rec);
    } else {
      S.renderJobPanel(rec);
    }
  }
  // ── Log sidebar ────────────────────────────────────────────────────────────

  var LOG_SORT_LABELS = { newest: 'Newest', oldest: 'Oldest', activity: 'Activity', type: 'Type' };
  var LOG_SORTS = ['newest', 'oldest', 'activity', 'type'];

  function renderLogPanel(rec) {
    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

    var sortBtns = LOG_SORTS.map(function(s) {
      return '<span class="log-sort-btn' + (S.logSortMode === s ? ' active' : '') + '" data-log-sort="' + s + '">' + LOG_SORT_LABELS[s] + '</span>';
    }).join('');

    S.el.content.innerHTML =
      '<div class="log-panel-title">' + esc((rec.job || rec.description || 'Log').slice(0, 22)) + '</div>' +
      '<div class="log-sort-bar">' + sortBtns + '</div>' +
      '<div id="log-panel-list" class="log-panel-list"><div style="padding:6px;font-size:10px;color:var(--text-muted);">Loading\u2026</div></div>';

    // Wire sort buttons
    var sortEls = S.el.content.querySelectorAll('[data-log-sort]');
    for (var i = 0; i < sortEls.length; i++) {
      sortEls[i].addEventListener('click', (function(btn) {
        return function() {
          S.logSortMode = btn.getAttribute('data-log-sort');
          S.renderLogPanel(rec);
        };
      })(sortEls[i]));
    }

    // Load related logs
    RecordService.list().then(function(all) {
      var actId = rec.activityId || null;
      var logs = all.filter(function(r) {
        return !r.parentId &&
          (r.record_type || r.recordType || '') === 'log' &&
          r.id !== rec.id;
      });

      // Filter by same activity if set
      if (actId) {
        var sameAct = logs.filter(function(r) { return r.activityId === actId; });
        if (sameAct.length) logs = sameAct;
      }

      // Sort
      if (S.logSortMode === 'newest') {
        logs.sort(function(a, b) { return (b.date || '') > (a.date || '') ? 1 : -1; });
      } else if (S.logSortMode === 'oldest') {
        logs.sort(function(a, b) { return (a.date || '') > (b.date || '') ? 1 : -1; });
      } else if (S.logSortMode === 'activity') {
        logs.sort(function(a, b) { return (a.activityId || '') < (b.activityId || '') ? -1 : 1; });
      } else if (S.logSortMode === 'type') {
        logs.sort(function(a, b) { return (a.record_type || '') < (b.record_type || '') ? -1 : 1; });
      }

      var listEl = document.getElementById('log-panel-list');
      if (!listEl) return;
      if (!logs.length) {
        listEl.innerHTML = '<div style="padding:8px;font-size:10px;color:var(--text-muted);">No related logs.</div>';
        return;
      }
      listEl.innerHTML = logs.slice(0, 12).map(function(r) {
        return '<div class="log-panel-row" data-log-id="' + esc(r.id) + '">' +
          '<div class="log-panel-row-title">' + esc((r.job || r.description || 'Log').slice(0, 20)) + '</div>' +
          '<div class="log-panel-row-meta">' + esc(r.date || '') + (r.time ? ' ' + esc(r.time.slice(0, 5)) : '') + '</div>' +
        '</div>';
      }).join('');

      var rowEls = listEl.querySelectorAll('[data-log-id]');
      for (var j = 0; j < rowEls.length; j++) {
        rowEls[j].addEventListener('click', (function(rowEl) {
          return function() {
            var logId = rowEl.getAttribute('data-log-id');
            RecordService.get(logId).then(function(logRec) {
              if (logRec) { S.close(); App.showView(logRec); }
            });
          };
        })(rowEls[j]));
      }
    });
  }

  // ── NewEnt Wizard Panel (left panel when template #6 is active) ──────────
  // Shows the plan section browser with dots, dropdown, collapse, search.
  // This is the primary panel for the newent template experience.

  function renderNewEntWizardPanel() {
    var fd = S.context.formData || {};
    var editSlug = S.context.editingSlug;

    // Sync section index from main wizard if provided
    if (S.context.planSectionIdx !== undefined) {
      S.neState.sectionIdx = S.context.planSectionIdx;
    }

    // Build a virtual business object from form data for rendering
    var frameworkId = fd.industry_framework || 'generic';
    var sections = NewEntTemplate.FRAMEWORK_SECTIONS[frameworkId] || NewEntTemplate.FRAMEWORK_SECTIONS['generic'];
    if (!sections || !sections.length) sections = [{ slug: 'overview', title: 'Overview' }];
    if (S.neState.sectionIdx >= sections.length) S.neState.sectionIdx = 0;

    var currentSection = sections[S.neState.sectionIdx];

    // Build a virtual biz for content rendering
    var virtualBiz = {
      name: fd.name || '(New Business)',
      slug: fd.slug || '',
      stage: fd.stage || 'idea',
      industry_hint: fd.industry_hint || '',
      sections: sections,
      ent: {
        purpose: fd.ent_purpose || '',
        value: fd.ent_value || '',
        customer: fd.ent_customer || '',
        diff: fd.ent_diff || '',
        edge: fd.ent_edge || '',
        moat: fd.ent_moat || '',
        proof: fd.ent_proof || '',
        blocker: fd.ent_blocker || '',
      },
      profile: {
        vision: fd.vision || '',
        mission: fd.mission || '',
        founding_story: fd.founding_story || '',
      },
      plan: {
        title: fd.plan_title || 'Startup Plan',
        type: fd.plan_type || 'startup',
        industry_framework: frameworkId,
        audience_framework: fd.audience_framework || '',
      },
    };

    // If editing an existing business, merge stored ent data
    if (editSlug) {
      var stored = NewEntTemplate.get(editSlug);
      if (stored && stored.ent) {
        var entKeys = Object.keys(stored.ent);
        for (var ek = 0; ek < entKeys.length; ek++) {
          if (!virtualBiz.ent[entKeys[ek]]) {
            virtualBiz.ent[entKeys[ek]] = stored.ent[entKeys[ek]];
          }
        }
      }
    }

    S.neState.biz = virtualBiz;

    // Build dots
    var dotsHtml = sections.map(function(s, i) {
      var active = i === S.neState.sectionIdx ? ' ne-dot-active' : '';
      var filled = S.neEntSectionHasContent(virtualBiz, s.slug) ? ' ne-dot-filled' : '';
      return '<div class="ne-dot' + active + filled + '" data-ne-dot="' + i + '"></div>';
    }).join('');

    // Build section dropdown
    var selOpts = sections.map(function(s, i) {
      return '<option value="' + i + '"' + (i === S.neState.sectionIdx ? ' selected' : '') + '>' + esc(s.title) + '</option>';
    }).join('');

    // Build section content
    var bodyHtml = S.renderNewEntSectionBody(virtualBiz, currentSection);

    // Framework + audience labels
    var fwLabel = frameworkId;
    for (var fi = 0; fi < NewEntTemplate.INDUSTRY_FRAMEWORKS.length; fi++) {
      if (NewEntTemplate.INDUSTRY_FRAMEWORKS[fi].value === frameworkId) {
        fwLabel = NewEntTemplate.INDUSTRY_FRAMEWORKS[fi].label;
        break;
      }
    }

    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    S.el.content.innerHTML =
      // Top bar with Plan button centered
      '<div class="ne-panel-topbar">' +
        '<div class="ne-panel-plan-btn" id="ne-plan-btn">' + esc(fwLabel) + '</div>' +
      '</div>' +
      // Toolbar: dropdown + toggle + search
      '<div class="ne-panel-toolbar">' +
        '<select class="ne-panel-sel" id="ne-panel-sel">' + selOpts + '</select>' +
        '<div class="ne-panel-toggle" id="ne-panel-toggle"></div>' +
        '<input class="ne-panel-search" id="ne-panel-search" type="text" placeholder="Search\u2026" value="' + esc(S.neState.searchTerm) + '">' +
      '</div>' +
      // Dots row
      '<div class="ne-panel-dots" id="ne-panel-dots">' + dotsHtml + '</div>' +
      // Section body
      '<div class="ne-panel-body' +
        (S.neState.collapseState === 1 ? ' ne-compact-1' : '') +
        (S.neState.collapseState === 2 ? ' ne-compact-2' : '') +
        '" id="ne-panel-body">' + bodyHtml + '</div>';

    // Bind: Plan button (shows framework name, clicking does nothing extra in wizard mode)
    var planBtn = document.getElementById('ne-plan-btn');
    if (planBtn) planBtn.addEventListener('click', function() {
      // Already in the wizard — just close the panel
      S.close();
    });

    // Bind: Section dropdown
    var selEl = document.getElementById('ne-panel-sel');
    if (selEl) selEl.addEventListener('change', function() {
      S.neState.sectionIdx = parseInt(this.value, 10) || 0;
      // Sync to main wizard screen
      if (typeof NewEntWizardScreen !== 'undefined' && NewEntWizardScreen.setSectionIdx) {
        NewEntWizardScreen.setSectionIdx(S.neState.sectionIdx);
      }
      S.renderNewEntWizardPanel();
    });

    // Bind: Toggle (3-state collapse)
    var togEl = document.getElementById('ne-panel-toggle');
    if (togEl) togEl.addEventListener('click', function() {
      S.neState.collapseState = (S.neState.collapseState + 1) % 3;
      S.renderNewEntWizardPanel();
    });

    // Bind: Search
    var searchEl = document.getElementById('ne-panel-search');
    if (searchEl) searchEl.addEventListener('input', function() {
      S.neState.searchTerm = this.value.trim().toLowerCase();
      S.filterNewEntBody();
    });

    // Bind: Dots click
    var dotEls = S.el.content.querySelectorAll('[data-ne-dot]');
    for (var di = 0; di < dotEls.length; di++) {
      dotEls[di].addEventListener('click', (function(idx) {
        return function() {
          S.neState.sectionIdx = idx;
          // Sync to main wizard screen
          if (typeof NewEntWizardScreen !== 'undefined' && NewEntWizardScreen.setSectionIdx) {
            NewEntWizardScreen.setSectionIdx(S.neState.sectionIdx);
          }
          S.renderNewEntWizardPanel();
        };
      })(parseInt(dotEls[di].getAttribute('data-ne-dot'), 10)));
    }

    // Bind: Click-to-expand in collapsed modes
    var bodyEl = document.getElementById('ne-panel-body');
    if (bodyEl) bodyEl.addEventListener('click', function(e) {
      if (S.neState.collapseState === 0) return;
      var field = e.target.closest ? e.target.closest('.ne-pf') : null;
      if (field) {
        S.neState.collapseState = 0;
        S.renderNewEntWizardPanel();
        setTimeout(function() {
          var fid = field.getAttribute('data-ne-fid');
          if (fid) {
            var target = document.querySelector('[data-ne-fid="' + fid + '"]');
            if (target) {
              target.scrollIntoView({ block: 'nearest' });
              target.classList.add('ne-flash');
              setTimeout(function() { target.classList.remove('ne-flash'); }, 1000);
            }
          }
        }, 50);
      }
    });
  }

  // ── NewEnt Business Plan Panel (for saved records viewed from list) ─────
  // Mirrors the view screen's toolbar: sections dropdown, 3-state collapse,
  // search bar, dots anchored to sections, Plan button in top bar.

  S.neState = {
    sectionIdx: 0,
    collapseState: 0,  // 0=full, 1=partial-compact, 2=section-headers-only
    searchTerm: '',
    biz: null,
  };

  function renderNewEntPanel(rec) {
    var biz = NewEntTemplate.get(rec.newent_slug);
    if (!biz) {
      S.el.content.innerHTML = '<div class="panel-label">Business not found.</div>';
      return;
    }
    S.neState.biz = biz;
    var sections = biz.sections || [];
    if (!sections.length) sections = [{ slug: 'overview', title: 'Overview' }];
    if (S.neState.sectionIdx >= sections.length) S.neState.sectionIdx = 0;

    var currentSection = sections[S.neState.sectionIdx];

    // Build dots
    var dotsHtml = sections.map(function(s, i) {
      var active = i === S.neState.sectionIdx ? ' ne-dot-active' : '';
      var filled = S.neEntSectionHasContent(biz, s.slug) ? ' ne-dot-filled' : '';
      return '<div class="ne-dot' + active + filled + '" data-ne-dot="' + i + '"></div>';
    }).join('');

    // Build section dropdown options
    var selOpts = sections.map(function(s, i) {
      return '<option value="' + i + '"' + (i === S.neState.sectionIdx ? ' selected' : '') + '>' + esc(s.title) + '</option>';
    }).join('');

    // Build section content
    var bodyHtml = S.renderNewEntSectionBody(biz, currentSection);

    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    S.el.content.innerHTML =
      // Top bar with Plan button centered
      '<div class="ne-panel-topbar">' +
        '<div class="ne-panel-plan-btn" id="ne-plan-btn">Plan</div>' +
      '</div>' +
      // Toolbar: dropdown + toggle + search
      '<div class="ne-panel-toolbar">' +
        '<select class="ne-panel-sel" id="ne-panel-sel">' + selOpts + '</select>' +
        '<div class="ne-panel-toggle" id="ne-panel-toggle"></div>' +
        '<input class="ne-panel-search" id="ne-panel-search" type="text" placeholder="Search\u2026" value="' + esc(S.neState.searchTerm) + '">' +
      '</div>' +
      // Dots row
      '<div class="ne-panel-dots" id="ne-panel-dots">' + dotsHtml + '</div>' +
      // Section body
      '<div class="ne-panel-body' +
        (S.neState.collapseState === 1 ? ' ne-compact-1' : '') +
        (S.neState.collapseState === 2 ? ' ne-compact-2' : '') +
        '" id="ne-panel-body">' + bodyHtml + '</div>';

    // Bind: Plan button
    var planBtn = document.getElementById('ne-plan-btn');
    if (planBtn) planBtn.addEventListener('click', function() {
      S.close();
      App.showNewEntWizard(biz.slug);
    });

    // Bind: Section dropdown
    var selEl = document.getElementById('ne-panel-sel');
    if (selEl) selEl.addEventListener('change', function() {
      S.neState.sectionIdx = parseInt(this.value, 10) || 0;
      S.renderNewEntPanel(rec);
    });

    // Bind: Toggle (3-state collapse)
    var togEl = document.getElementById('ne-panel-toggle');
    if (togEl) togEl.addEventListener('click', function() {
      S.neState.collapseState = (S.neState.collapseState + 1) % 3;
      S.renderNewEntPanel(rec);
    });

    // Bind: Search
    var searchEl = document.getElementById('ne-panel-search');
    if (searchEl) searchEl.addEventListener('input', function() {
      S.neState.searchTerm = this.value.trim().toLowerCase();
      S.filterNewEntBody();
    });

    // Bind: Dots click
    var dotEls = S.el.content.querySelectorAll('[data-ne-dot]');
    for (var di = 0; di < dotEls.length; di++) {
      dotEls[di].addEventListener('click', (function(idx) {
        return function() {
          S.neState.sectionIdx = idx;
          S.renderNewEntPanel(rec);
        };
      })(parseInt(dotEls[di].getAttribute('data-ne-dot'), 10)));
    }

    // Bind: Click-to-expand in collapsed modes
    var bodyEl = document.getElementById('ne-panel-body');
    if (bodyEl) bodyEl.addEventListener('click', function(e) {
      if (S.neState.collapseState === 0) return;
      var field = e.target.closest ? e.target.closest('.ne-pf') : null;
      if (field) {
        S.neState.collapseState = 0;
        S.renderNewEntPanel(rec);
        // Scroll to the clicked field after re-render
        setTimeout(function() {
          var fid = field.getAttribute('data-ne-fid');
          if (fid) {
            var target = document.querySelector('[data-ne-fid="' + fid + '"]');
            if (target) {
              target.scrollIntoView({ block: 'nearest' });
              target.classList.add('ne-flash');
              setTimeout(function() { target.classList.remove('ne-flash'); }, 1000);
            }
          }
        }, 50);
      }
    });
  }

  function neEntSectionHasContent(biz, slug) {
    // Check if any ent fields or profile data relate to this section
    if (!biz.ent) return false;
    var sectionEntMap = {
      'executive-summary': ['purpose', 'value', 'pitch', 'thesis'],
      'problem': ['pain', 'customer', 'switch'],
      'solution': ['diff', 'core', 'wedge'],
      'market': ['market', 'niche', 'category', 'trend'],
      'business-model': ['revenue', 'unit', 'margin', 'model'],
      'go-to-market': ['channel', 'cac', 'ltv', 'viral'],
      'competition': ['rival', 'threat', 'moat', 'edge'],
      'team': ['founder', 'team', 'hire'],
      'financials': ['runway', 'raise', 'unit'],
      'risk': ['risks', 'blocker', 'anchor', 'scenario'],
      'operations': ['constraint', 'speed', 'flow', 'depend'],
      'overview': ['purpose', 'value', 'customer', 'diff'],
    };
    var fields = sectionEntMap[slug] || [];
    for (var i = 0; i < fields.length; i++) {
      if (biz.ent[fields[i]]) return true;
    }
    return false;
  }

  function renderNewEntSectionBody(biz, section) {
    var slug = section.slug;
    var html = '';

    // Section header
    html += '<div class="ne-pf ne-pf-hdr" data-ne-fid="hdr-' + esc(slug) + '">' +
      '<div class="ne-pf-title">' + esc(section.title) + '</div>' +
      '</div>';

    // Map section to relevant ent fields
    var sectionEntMap = {
      'executive-summary': ['purpose', 'value', 'pitch', 'thesis', 'model'],
      'problem': ['pain', 'customer', 'switch', 'core'],
      'solution': ['diff', 'core', 'wedge'],
      'consumer-problem': ['pain', 'customer', 'switch'],
      'product': ['diff', 'core'],
      'market': ['market', 'niche', 'category', 'trend', 'window'],
      'business-model': ['revenue', 'unit', 'margin', 'model'],
      'go-to-market': ['channel', 'cac', 'ltv', 'wedge'],
      'channels': ['channel', 'cac'],
      'competition': ['rival', 'threat', 'moat', 'edge', 'myth'],
      'team': ['founder', 'team', 'hire'],
      'financials': ['runway', 'raise', 'unit', 'margin'],
      'risk': ['risks', 'blocker', 'anchor', 'scenario', 'hedge'],
      'operations': ['constraint', 'speed', 'flow', 'depend', 'tech'],
      'supply-chain': ['depend', 'constraint'],
      'quality-compliance': ['constraint'],
      'production': ['speed', 'constraint', 'tech'],
      'client-problem': ['pain', 'customer', 'switch'],
      'service-offering': ['diff', 'core', 'wedge'],
      'delivery-model': ['speed', 'flow'],
      'pricing': ['revenue', 'unit', 'margin'],
      'mission-problem': ['purpose', 'pain'],
      'programs': ['core', 'diff'],
      'beneficiaries': ['customer'],
      'impact': ['star', 'proof'],
      'overview': ['purpose', 'value', 'customer', 'diff', 'revenue', 'star', 'focus'],
    };

    var fields = sectionEntMap[slug] || ['purpose', 'value', 'diff'];

    // Find field metadata from ENT_GROUPS
    var allEntFields = {};
    var groups = Object.keys(NewEntTemplate.ENT_GROUPS);
    for (var g = 0; g < groups.length; g++) {
      var gFields = NewEntTemplate.ENT_GROUPS[groups[g]];
      for (var f = 0; f < gFields.length; f++) {
        allEntFields[gFields[f].id] = gFields[f];
      }
    }

    for (var i = 0; i < fields.length; i++) {
      var fid = fields[i];
      var meta = allEntFields[fid];
      var val = biz.ent ? biz.ent[fid] || '' : '';
      var label = meta ? meta.label : fid;
      var prompt = meta ? meta.prompt : '';

      html += '<div class="ne-pf" data-ne-fid="' + esc(fid) + '">' +
        '<div class="ne-pf-label">' + esc(label) + '</div>' +
        '<div class="ne-pf-val' + (val ? '' : ' ne-pf-empty') + '">' +
          (val ? esc(val) : '<span class="ne-pf-prompt">' + esc(prompt) + '</span>') +
        '</div>' +
      '</div>';
    }

    // Profile fields for relevant sections
    if (slug === 'executive-summary' || slug === 'overview') {
      if (biz.profile) {
        if (biz.profile.vision) {
          html += '<div class="ne-pf" data-ne-fid="vision"><div class="ne-pf-label">Vision</div><div class="ne-pf-val">' + esc(biz.profile.vision) + '</div></div>';
        }
        if (biz.profile.mission) {
          html += '<div class="ne-pf" data-ne-fid="mission"><div class="ne-pf-label">Mission</div><div class="ne-pf-val">' + esc(biz.profile.mission) + '</div></div>';
        }
      }
    }

    return html;
  }

  function filterNewEntBody() {
    var term = S.neState.searchTerm;
    var bodyEl = document.getElementById('ne-panel-body');
    if (!bodyEl) return;
    var fields = bodyEl.querySelectorAll('.ne-pf');
    for (var i = 0; i < fields.length; i++) {
      if (!term) {
        fields[i].style.display = '';
      } else {
        var text = fields[i].textContent.toLowerCase();
        fields[i].style.display = text.indexOf(term) !== -1 ? '' : 'none';
      }
    }
  }

  function renderJobPanel(rec) {
    var currency = rec.currency || '';
    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';

    function qcCls(idx) { return 'pb-qc' + (S.finActionIdx === idx ? ' focused' : ''); }

    S.el.content.innerHTML =
      '<div class="pb-rec-identity">' +
        '<div class="pb-rec-title">' + esc((rec.job || '(untitled)').slice(0, 26)) + '</div>' +
        '<div class="pb-rec-meta">' +
          (rec.date ? esc(rec.date.slice(5)) : '') +
          (rec.customer ? ' \u00b7 ' + esc(rec.customer.slice(0, 16)) : '') +
        '</div>' +
      '</div>' +
      '<div id="pb-job-fin" class="pb-rec-fin">' +
        '<div style="padding:4px 8px;color:var(--text-muted);font-size:10px;">Loading\u2026</div>' +
      '</div>' +
      '<div class="pb-qc-row">' +
        '<div class="' + qcCls(0) + ' pb-qc-exp"  data-qc="out">+ Exp</div>' +
        '<div class="' + qcCls(1) + ' pb-qc-cogs" data-qc="cogs">+ COGS</div>' +
        '<div class="' + qcCls(2) + ' pb-qc-inc"  data-qc="in">+ Pmt</div>' +
      '</div>' +
      '<div id="pb-job-children" class="pb-rec-children" style="overflow-y:auto;flex:1;"></div>';

    var qcEls = S.el.content.querySelectorAll('.pb-qc[data-qc]');
    for (var qi = 0; qi < qcEls.length; qi++) {
      qcEls[qi].addEventListener('click', (function(kind) {
        return function() { S.createFromPanel(kind); };
      })(qcEls[qi].getAttribute('data-qc')));
    }

    RecordService.listChildren(rec.id).then(function(children) {
      S.jobPanelChildren = children;

      function mv(v, cls) { return '<span class="pb-slv ' + (cls || '') + '">' + S.money(currency, v) + '</span>'; }
      var summary = FinancialModel.summarize(rec, children);

      var finEl = document.getElementById('pb-job-fin');
      if (finEl) {
        finEl.innerHTML =
          '<div class="pb-sl"><span class="pb-sll">Billed</span>'    + mv(summary.price,    summary.price    ? 'pos'  : '') + '</div>' +
          '<div class="pb-sl"><span class="pb-sll">Received</span>'  + mv(summary.paidTotal, summary.paidTotal? 'pos'  : '') + '</div>' +
          (summary.outstanding > 0
            ? '<div class="pb-sl"><span class="pb-sll">Outstanding</span>' + mv(summary.outstanding, 'warn') + '</div>'
            : '') +
          (summary.tax
            ? '<div class="pb-sl"><span class="pb-sll mute">Tax</span>' + mv(summary.tax, '') + '</div>'
            : '');
      }

      var childEl = document.getElementById('pb-job-children');
      if (!childEl) return;
      if (!children.length) {
        childEl.innerHTML = '<div style="padding:6px 8px;font-size:10px;color:var(--text-muted);">No items yet.</div>';
        return;
      }

      var childRows = children.map(function(ch, idx) {
        var chRt      = (ch.record_type || ch.recordType || '').toLowerCase();
        var chBilling = (ch.expense_billing || '').toLowerCase();
        var chBadge   = chRt === 'expense'
          ? (chBilling === 'cogs' ? '<span class="rt-badge rt-cogs">COGS</span>' : '<span class="rt-badge rt-exp">EXP</span>')
          : (chRt === 'payment'   ? '<span class="rt-badge rt-pmt">PMT</span>'   : '<span class="rt-badge rt-inc">INC</span>');
        var isFocused = (S.finActionIdx === idx + 3);
        return '<div class="pb-child-row' + (isFocused ? ' focused' : '') + '" data-sub-id="' + esc(ch.id) + '">' +
          chBadge +
          '<span class="pb-child-name">' + esc((ch.job || ch.description || ch.story || 'Entry').slice(0, 15)) + '</span>' +
          '<span class="pb-child-amt">' + S.money(currency, ch.amount || 0) + '</span>' +
          '</div>';
      }).join('');

      childEl.innerHTML = '<div class="pb-children-hdr">Items (' + children.length + ')</div>' + childRows;

      // Scroll focused child row into view
      if (S.finActionIdx >= 3) {
        var focusedRow = childEl.querySelector('.pb-child-row.focused');
        if (focusedRow) focusedRow.scrollIntoView({ block: 'nearest' });
      }

      var subEls = childEl.querySelectorAll('[data-sub-id]');
      for (var i = 0; i < subEls.length; i++) {
        subEls[i].addEventListener('click', (function(sid) {
          return function() {
            RecordService.get(sid).then(function(sub) { if (sub) { S.close(); App.showView(sub); } });
          };
        })(subEls[i].getAttribute('data-sub-id')));
      }
    });
  }

  function renderChildPanel(rec) {
    var rt = (rec.record_type || rec.recordType || '').toLowerCase();
    var billing = (rec.expense_billing || '').toLowerCase();
    var badge = rt === 'expense'
      ? (billing === 'cogs' ? '<span class="rt-badge rt-cogs">COGS</span>' : '<span class="rt-badge rt-exp">EXP</span>')
      : (rt === 'payment' ? '<span class="rt-badge rt-pmt">PMT</span>' : '<span class="rt-badge rt-inc">INC</span>');
    var billingLabel = billing === 'cogs' ? 'Job cost' : (billing === 'customer' ? 'Billable' : (billing || '\u2014'));
    var currency = rec.currency || '';

    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    S.el.content.innerHTML =
      '<div class="pb-child-identity">' +
        '<div class="pb-child-id-row">' + badge +
          '<span class="pb-child-id-title">' + esc((rec.description || rec.job || '(untitled)').slice(0, 22)) + '</span>' +
        '</div>' +
        '<div class="pb-child-id-amt">' + S.money(currency, rec.amount || 0) + '</div>' +
      '</div>' +
      '<div class="pb-parent-crumb" id="pb-parent-crumb">' +
        '<span class="pb-parent-arrow">\u2191</span>' +
        '<span id="pb-parent-title">Loading\u2026</span>' +
      '</div>' +
      '<div class="pb-rec-fin">' +
        (rec.date ? '<div class="pb-sl"><span class="pb-sll mute">Date</span><span class="pb-slv">' + esc(rec.date.slice(5)) + '</span></div>' : '') +
        (billing ? '<div class="pb-sl"><span class="pb-sll mute">Billing</span><span class="pb-slv">' + esc(billingLabel) + '</span></div>' : '') +
        (rec.vendor ? '<div class="pb-sl"><span class="pb-sll mute">Vendor</span><span class="pb-slv">' + esc(rec.vendor.slice(0, 14)) + '</span></div>' : '') +
      '</div>' +
      '<div class="pb-qc-row" style="margin-top:auto;">' +
        '<div class="pb-qc pb-qc-edit" id="pb-child-edit">\u270e Edit</div>' +
        '<div class="pb-qc pb-qc-share" id="pb-child-share">&#8599; Share</div>' +
      '</div>';

    var editBtn = document.getElementById('pb-child-edit');
    if (editBtn) editBtn.addEventListener('click', function() { S.close(); App.showWizard(rec); });
    var shareBtn = document.getElementById('pb-child-share');
    if (shareBtn) shareBtn.addEventListener('click', function() { S.close(); App.showShare(rec); });

    if (rec.parentId) {
      RecordService.get(rec.parentId).then(function(parent) {
        var titleEl = document.getElementById('pb-parent-title');
        var crumbEl = document.getElementById('pb-parent-crumb');
        if (!titleEl) return;
        if (parent) {
          titleEl.textContent = parent.job || '(untitled)';
          if (crumbEl) crumbEl.addEventListener('click', function() { S.close(); App.showView(parent); });
        } else {
          titleEl.textContent = '(not found)';
        }
      });
    }
  }

  function renderWizardContext() {
    var rec = S.context.record;
    var ws  = S.context.wizardScreen || 0;
    if (!rec) {
      S.el.content.innerHTML = '<div class="panel-label">No draft S.context.</div>';
      return;
    }

    var isPads = String((rec && (rec.record_class || rec.recordClass || rec.record_type || rec.recordType)) || '').toLowerCase() === 'pads';
    var stepNames = isPads
      ? ['Process', 'Actions', 'Details', 'Story']
      : ['Process', 'Actions', 'Details', 'Story', 'Finance'];
    var stepName = stepNames[ws] || 'Process';
    RecordService.listChildren(rec.id).then(function(children) {
      var summary = FinancialModel.summarize(rec, children);
      var filledP = isPads ? (rec.pads_process ? 1 : 0) : ((rec.job ? 1 : 0) + (rec.customer ? 1 : 0) + (rec.date ? 1 : 0));
      var actionsCount = isPads ? (rec.pads_actions ? 1 : 0) : (rec.actions || []).length;
      var notesCount = isPads ? 0 : (rec.actions || []).filter(function(a) { return a && a.notes; }).length;
      var detailsFilled = isPads ? (rec.pads_details ? 1 : 0) : ((rec.worker ? 1 : 0) + (rec.location ? 1 : 0) + (rec.customer_phone ? 1 : 0) + (rec.start_time ? 1 : 0) + (rec.end_time ? 1 : 0));
      var storyFilled = isPads ? (rec.pads_story ? 1 : 0) : ((rec.story ? 1 : 0) + (rec.details ? 1 : 0));
      var warnings = [];
      if (isPads) {
        if (!rec.pads_process) warnings.push('Missing Process text');
        if (!rec.pads_actions) warnings.push('Missing Actions text');
        if (!rec.pads_details) warnings.push('Missing Details text');
      } else {
        if (!rec.job) warnings.push('Missing job title');
        if (!rec.customer) warnings.push('Missing customer');
        if (summary.cogs.unlinked > 0) warnings.push('Unlinked COGS: ' + S.money(rec.currency, summary.cogs.unlinked));
        if (summary.total && summary.paidTotal <= 0) warnings.push('No payments recorded');
        if (actionsCount && notesCount < actionsCount) warnings.push('Some actions have no note');
      }
      var warnHtml = warnings.length ? warnings.slice(0, 3).map(function(w) {
        return '<div class="panel-value panel-mini" style="color:var(--warn);">• ' + esc(w) + '</div>';
      }).join('') : '<div class="panel-value panel-mini" style="color:var(--green);">No immediate warnings</div>';

      S.el.content.innerHTML =
        '<div class="panel-section">' +
          '<div class="panel-label">Step</div>' +
          '<div class="panel-value" style="font-weight:bold;">' + esc(stepName) + ' (' + (ws + 1) + '/' + stepNames.length + ')</div>' +
          '<div class="panel-value panel-mini">' +
            (isPads
              ? ('P ' + filledP + '/1 · A ' + actionsCount + '/1 · D ' + detailsFilled + '/1 · S ' + storyFilled + '/1')
              : ('P ' + filledP + '/3 · A ' + actionsCount + ' · D ' + detailsFilled + '/5 · S ' + storyFilled + '/2')) +
          '</div>' +
        '</div>' +
        (isPads ? '' : '<div class="panel-section panel-moneybar-actions">' +
          '<div class="panel-label">Quick Lines</div>' +
          '<div class="moneybar-btn-row">' +
            '<div class="moneybar-btn moneybar-out' + (S.finActionIdx === 0 ? ' focused' : '') + '"><span class="moneybar-arrow">&#8599;</span> Out</div>' +
            '<div class="moneybar-btn moneybar-cogs' + (S.finActionIdx === 1 ? ' focused' : '') + '"><span class="moneybar-arrow">&#8613;</span> COGS</div>' +
            '<div class="moneybar-btn moneybar-in' + (S.finActionIdx === 2 ? ' focused' : '') + '"><span class="moneybar-arrow">&#8601;</span> In</div>' +
          '</div>' +
          '<div class="panel-value panel-mini">&#8593;/&#8595; Select · Enter Add ' + panelActionLabel(S.finActionIdx) + '</div>' +
        '</div>') +
        (isPads ? '' : '<div class="panel-section">' +
          '<div class="panel-label">Money Snapshot</div>' +
          '<div class="panel-value">Out: ' + S.money(rec.currency, summary.billedTotal) + '</div>' +
          '<div class="panel-value">COGS: ' + S.money(rec.currency, summary.cogsTotal) + '</div>' +
          '<div class="panel-value">In: ' + S.money(rec.currency, summary.paidTotal) + '</div>' +
          (summary.total ? '<div class="panel-value panel-mini">Due: ' + S.money(rec.currency, Math.max(0, summary.outstanding)) + '</div>' : '') +
        '</div>') +
        '<div class="panel-section">' +
          '<div class="panel-label">Warnings</div>' + warnHtml +
        '</div>';
    });
  }

  function renderShareContext() {
    var rec = S.context.record;
    var url = S.context.url || '';
    if (!rec) { S.el.content.innerHTML = '<div class="panel-label">No record.</div>'; return; }
    var rt = (rec.record_type || rec.recordType || '').toLowerCase();
    var badge = rt === 'expense' ? '<span class="rt-badge rt-exp">EXP</span>' :
                rt === 'payment' ? '<span class="rt-badge rt-pmt">PMT</span>' : '';
    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    S.el.content.innerHTML =
      '<div class="pb-rec-identity">' +
        '<div class="pb-rec-title">' + badge + esc((rec.job || '(untitled)').slice(0, 24)) + '</div>' +
        '<div class="pb-rec-meta">Ready to share</div>' +
      '</div>' +
      '<div class="pb-rec-fin">' +
        '<div class="pb-sl"><span class="pb-sll mute">Format</span><span class="pb-slv">URL \u00b7 bitpad-c</span></div>' +
        (url ? '<div class="pb-sl"><span class="pb-sll mute">Size</span><span class="pb-slv">' + url.length + ' chars</span></div>' : '') +
        (rec.chainRef ? '<div class="pb-sl"><span class="pb-sll mute">Chain</span><span class="pb-slv" style="font-family:monospace;">' + esc(rec.chainRef.slice(0, 6)) + '</span></div>' : '') +
        (rec.customer ? '<div class="pb-sl"><span class="pb-sll mute">To</span><span class="pb-slv">' + esc(rec.customer.slice(0, 16)) + '</span></div>' : '') +
      '</div>' +
      '<div style="padding:8px 10px;font-size:10px;color:var(--text-muted);">CSK \u2192 Copy to clipboard</div>';
  }

  function renderManagementContext() {
    var currentTab = S.context.tab || 'records';
    var focusIdx = MGMT_TABS.indexOf(currentTab);
    if (focusIdx < 0) focusIdx = 0;
    S.mgmtPanelFocusIdx = focusIdx;
    S.el.content.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;';
    S.el.content.innerHTML =
      '<div class="pb-mgmt-hdr">Navigate</div>' +
      MGMT_TABS.map(function(tab, i) {
        var isActive = tab === currentTab;
        return '<div class="pb-mgmt-row' + (isActive ? ' pb-mgmt-active' : '') + (S.mgmtPanelFocusIdx === i ? ' dpfocus' : '') +
          '" data-mgmt-tab="' + tab + '">' +
          '<span class="pb-mgmt-dot">' + (isActive ? '\u25cf' : '\u25cb') + '</span>' +
          '<span class="pb-mgmt-name">' + esc(MGMT_TAB_LABELS[tab]) + '</span>' +
          '</div>';
      }).join('');

    var rows = S.el.content.querySelectorAll('[data-mgmt-tab]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', (function(tab, idx) {
        return function() {
          S.mgmtPanelFocusIdx = idx;
          S.context.tab = tab;
          if (typeof ManagementScreen !== 'undefined') ManagementScreen.showTab(tab);
          S.renderManagementContext();
        };
      })(rows[i].getAttribute('data-mgmt-tab'), i));
    }
  }

  function applyMgmtPanelFocus() {
    var rows = S.el.content.querySelectorAll('[data-mgmt-tab]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('dpfocus', i === S.mgmtPanelFocusIdx);
    }
  }
  function scrollContent(dir) {
    S.el.content.scrollTop += dir * 30;
  }

  function navigateFinancialAction(dir) {
    var rec = S.context.record;
    if (!S.isOpen || !rec || (S.context.screen !== 'view' && S.context.screen !== 'wizard')) return false;
    if (rec.parentId) return false;
    var isPads = String((rec.record_class || rec.recordClass || rec.record_type || rec.recordType) || '').toLowerCase() === 'pads';
    if (isPads && S.context.screen === 'wizard') return false;
    // On view screen, D-pad continues from buttons (0-2) into the children list (3+)
    var maxIdx = (S.context.screen === 'view') ? 2 + S.jobPanelChildren.length : 2;
    S.finActionIdx = Math.max(0, Math.min(maxIdx, S.finActionIdx + dir));
    if (S.context.screen === 'wizard') S.renderWizardContext();
    else S.renderRecordPreview(rec);
    return true;
  }
  function focusedRecord() {
    return S.context.record || null;
  }

  function navigateListRecord(dir) {
    if (S.context.screen === 'management') {
      S.mgmtPanelFocusIdx = Math.max(0, Math.min(MGMT_TABS.length - 1, S.mgmtPanelFocusIdx + dir));
      S.applyMgmtPanelFocus();
      return true;
    }
    return false;
  }

  function cycleListTabRecord(dir) {
    var rec = S.context.record;
    if (rec && (rec.record_type || rec.recordType || '') === 'log' &&
        (S.context.screen === 'view' || S.context.screen === 'wizard')) {
      var si = LOG_SORTS.indexOf(S.logSortMode);
      if (si < 0) si = 0;
      S.logSortMode = LOG_SORTS[(si + dir + LOG_SORTS.length) % LOG_SORTS.length];
      S.renderLogPanel(rec);
      return true;
    }
    // NewEnt panel (wizard or view): left/right moves through section dots
    if ((S.context.screen === 'newent-wizard') ||
        (S.context.screen === 'view' && S.context.record &&
         (S.context.record.record_class || S.context.record.recordClass) === 'newent' &&
         S.context.record.newent_slug)) {
      var biz = S.neState.biz;
      if (biz && biz.sections && biz.sections.length > 1) {
        S.neState.sectionIdx = (S.neState.sectionIdx + dir + biz.sections.length) % biz.sections.length;
        if (S.context.screen === 'newent-wizard') {
          S.renderNewEntWizardPanel();
        } else {
          S.renderNewEntPanel(S.context.record);
        }
        return true;
      }
      return false;
    }
    return false;
  }

  function handleEnterRecord() {
    var rec = S.S.context.record;
    if (!S.isOpen) return false;
    if (S.context.screen === 'management') {
      var tab = MGMT_TABS[S.mgmtPanelFocusIdx];
      if (tab) {
        S.context.tab = tab;
        if (typeof ManagementScreen !== 'undefined') ManagementScreen.showTab(tab);
        S.renderManagementContext();
      }
      return true;
    }
    if (!rec || (S.context.screen !== 'view' && S.context.screen !== 'wizard')) return false;
    // Enter on a focused child item → open that record
    if (S.context.screen === 'view' && S.finActionIdx >= 3) {
      var child = S.jobPanelChildren[S.finActionIdx - 3];
      if (child) { S.close(); App.showView(child); }
      return true;
    }
    if (S.finActionIdx === 0) return S.createFromPanel('out');
    if (S.finActionIdx === 1) return S.createFromPanel('cogs');
    return S.createFromPanel('in');
    return false;
  }

    S.renderRecordPreview = renderRecordPreview;
    S.renderLogPanel = renderLogPanel;
    S.renderNewEntWizardPanel = renderNewEntWizardPanel;
    S.renderNewEntPanel = renderNewEntPanel;
    S.neEntSectionHasContent = neEntSectionHasContent;
    S.renderNewEntSectionBody = renderNewEntSectionBody;
    S.filterNewEntBody = filterNewEntBody;
    S.renderJobPanel = renderJobPanel;
    S.renderChildPanel = renderChildPanel;
    S.renderWizardContext = renderWizardContext;
    S.renderShareContext = renderShareContext;
    S.renderManagementContext = renderManagementContext;
    S.applyMgmtPanelFocus = applyMgmtPanelFocus;
    S.scrollContent = scrollContent;
    S.navigateFinancialAction = navigateFinancialAction;
    S.navigateListRecord = navigateListRecord;
    S.cycleListTabRecord = cycleListTabRecord;
    S.handleEnterRecord = handleEnterRecord;
    S.focusedRecord = focusedRecord;
  }

  global.WorkpadsPanelRecord = { install: install };
}(window));
