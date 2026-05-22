// ProgressiveForm — indicator-driven wizard fields (R7)
// Exposes: window.ProgressiveForm

(function(global) {
  'use strict';

  var DEFAULT_ON = { progressive_form: true };

  function enabled() {
    if (!global.UIPhase) return !!DEFAULT_ON.progressive_form;
    var v = localStorage.getItem('wp_ui_phase_progressive_form');
    if (v === null) return !!DEFAULT_ON.progressive_form;
    return v === '1';
  }

  function outcomeLabel() {
    if (global.GlobalSynonymsService) {
      return GlobalSynonymsService.resolve('job', null) || 'Outcome';
    }
    return 'Outcome';
  }

  /** 0 = outcome only, 1 = + party/date, 2 = full wizard */
  function tierFor(rec) {
    if (!rec) return 0;
    var job = (rec.job || '').trim();
    if (!job) return 0;
    var cust = (rec.customer || '').trim();
    var date = (rec.date || '').trim();
    if (!cust || !date) return 1;
    return 2;
  }

  function indicatorHtml(tier, expanded) {
    var steps = ['State need', 'Who & when', 'Full record'];
    var html = '<div class="prog-form-indicator">';
    for (var i = 0; i < steps.length; i++) {
      var cls = 'prog-form-step';
      if (i < tier) cls += ' prog-form-done';
      else if (i === tier && !expanded) cls += ' prog-form-active';
      else if (i === tier && expanded) cls += ' prog-form-active';
      html += '<span class="' + cls + '">' + esc(steps[i]) + '</span>';
      if (i < steps.length - 1) html += '<span class="prog-form-sep">\u203a</span>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Build process-step HTML for wizard screen 0.
   * fieldGroup(id, label, value, type) — wizard helper
   */
  function renderProcessPanel(rec, expanded, fieldGroup) {
    var tier = tierFor(rec);
    var lbl = outcomeLabel();
    var html = indicatorHtml(tier, expanded);

    html += fieldGroup('job', lbl + ' *', rec.job || '');

    if (tier >= 1 || expanded) {
      html += fieldGroup('customer', 'Customer', rec.customer || '');
      html += fieldGroup('date', 'Date', rec.date || '', 'date');
    }
    if (tier >= 2 || expanded) {
      html += fieldGroup('date_end', 'End date', rec.date_end || '', 'date');
    }

    if (tier < 2 && !expanded) {
      html += '<div class="prog-form-more" id="prog-form-more">+ More fields (actions, details, money)</div>';
    } else if (tier < 2 && expanded) {
      html += '<div class="prog-form-hint">Use Next for actions, details, and financials.</div>';
    }

    return html;
  }

  function shouldLimitScreens(rec, expanded) {
    return enabled() && tierFor(rec) < 2 && !expanded;
  }

  global.ProgressiveForm = {
    enabled: enabled,
    outcomeLabel: outcomeLabel,
    tierFor: tierFor,
    indicatorHtml: indicatorHtml,
    renderProcessPanel: renderProcessPanel,
    shouldLimitScreens: shouldLimitScreens,
  };

}(window));
