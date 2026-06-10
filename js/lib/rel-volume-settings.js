// RelVolumeSettings — rhythm tuning + explanation (IO C11)
// Exposes: window.RelVolumeSettings

(function(global) {
  'use strict';

  var SIMPLE_DIALS = [
    { key: 'windowDays',        label: 'Lookback (days)',     type: 'number', min: 7, max: 365, step: 1 },
    { key: 'minInteractions', label: 'Min score (band)',    type: 'number', min: 0, max: 20, step: 0.5 },
    { key: 'rhythmThreshold',   label: 'In rhythm at',      type: 'number', min: 1, max: 20, step: 0.5 },
    { key: 'warmThreshold',     label: 'Warming at',        type: 'number', min: 0, max: 15, step: 0.5 },
  ];

  var ADVANCED_DIALS = [
    { key: 'weightSale',        label: 'Weight: Sale',        type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightReceipt',     label: 'Weight: Receipt',     type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightInvoice',     label: 'Weight: Invoice',     type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightPayment',     label: 'Weight: Payment',     type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightNeed',        label: 'Weight: Need',        type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightOffer',       label: 'Weight: Offer',       type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightConnection',  label: 'Weight: Connection',  type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightExpense',     label: 'Weight: Expense',     type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightJob',         label: 'Weight: Job',         type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'decayPerDay',       label: 'Decay / day',       type: 'number', min: 0, max: 0.5, step: 0.005 },
  ];

  function dialInputId(key) { return 'rv-dial-' + key; }

  function fieldHtml(dial, value) {
    var id = dialInputId(dial.key);
    var attrs = ' id="' + id + '" class="field-input" type="' + dial.type + '" value="' +
      esc(String(value != null ? value : '')) + '"';
    if (dial.min != null) attrs += ' min="' + dial.min + '"';
    if (dial.max != null) attrs += ' max="' + dial.max + '"';
    if (dial.step != null) attrs += ' step="' + dial.step + '"';
    return '<div class="field-group">' +
      '<div class="field-label">' + esc(dial.label) + '</div>' +
      '<input' + attrs + ' autocomplete="off">' +
    '</div>';
  }

  function explainBlurb() {
    return '<div class="rv-explain">' +
      '<div class="rv-explain-title">What is rhythm?</div>' +
      '<div class="rv-explain-body">' +
        'Rel-volume scores how often you trade or interact with each contact in the lookback window. ' +
        'Sales and receipts weigh highest; needs, offers, and connection relays add social glue. ' +
        'Older activity fades by <em>decay/day</em>. Connections screen sorts contacts into ' +
        '<strong>In rhythm</strong>, <strong>Warming</strong>, and <strong>Quiet</strong> — not A\u2192Z.' +
      '</div>' +
      '<div class="rv-explain-body" style="margin-top:6px;">' +
        'This is not money owed (see Social trail). Tune weights if your work is sale-heavy vs job-heavy.' +
      '</div></div>';
  }

  function presetRow() {
    if (!global.RelVolume || !RelVolume.PRESETS) return '';
    var html = '<div class="view-sec-hdr" style="margin-top:8px;">Presets</div>';
    var keys = Object.keys(RelVolume.PRESETS);
    for (var i = 0; i < keys.length; i++) {
      var p = RelVolume.PRESETS[keys[i]];
      html += '<div class="view-field rv-preset-row" data-rv-preset="' + esc(keys[i]) + '" style="cursor:pointer;">' +
        '<div class="view-field-label">' + esc(p.label) + '</div>' +
        '<div class="view-field-value"><span class="badge">Apply</span></div></div>';
    }
    html += '<div class="view-field rv-reset-row" id="rv-reset-dials" style="cursor:pointer;">' +
      '<div class="view-field-label">Reset defaults</div>' +
      '<div class="view-field-value"><span class="badge">Reset</span></div></div>';
    return html;
  }

  function renderSection() {
    if (!global.RelVolume) return '';
    var d = RelVolume.getDials();
    var adv = !!d.advancedOpen;
    var html = explainBlurb() +
      '<div class="view-field rv-adv-toggle" id="rv-adv-toggle" style="cursor:pointer;">' +
      '<div class="view-field-label">Rhythm tuning</div>' +
      '<div class="view-field-value">' + (adv ? 'Advanced \u25be' : 'Simple \u203a Advanced') + '</div>' +
    '</div>';
    var i;
    for (i = 0; i < SIMPLE_DIALS.length; i++) {
      html += fieldHtml(SIMPLE_DIALS[i], d[SIMPLE_DIALS[i].key]);
    }
    html += '<div id="rv-adv-block" style="' + (adv ? '' : 'display:none;') + '">';
    for (i = 0; i < ADVANCED_DIALS.length; i++) {
      html += fieldHtml(ADVANCED_DIALS[i], d[ADVANCED_DIALS[i].key]);
    }
    html += '</div>';
    html += presetRow();
    html += '<div id="rv-preview" class="rv-preview"></div>';
    return html;
  }

  function refreshPreview() {
    var el = document.getElementById('rv-preview');
    if (!el || !global.RelVolume || typeof RecordService === 'undefined') return;
    RecordService.list().then(function(records) {
      var sum = RelVolume.networkSummary(records);
      el.innerHTML =
        '<div class="rv-preview-inner">' +
          'Preview: ' + (sum.bands.rhythm || 0) + ' in rhythm \u00b7 ' +
          (sum.bands.warm || 0) + ' warming \u00b7 ' +
          (sum.bands.quiet || 0) + ' quiet \u00b7 ' +
          sum.needs + ' needs \u00b7 ' + sum.offers + ' offers' +
        '</div>';
    }).catch(function() {});
  }

  function readFromDom() {
    if (!global.RelVolume) return;
    var d = RelVolume.getDials();
    var all = SIMPLE_DIALS.concat(ADVANCED_DIALS);
    var partial = { advancedOpen: d.advancedOpen };
    for (var i = 0; i < all.length; i++) {
      var inp = document.getElementById(dialInputId(all[i].key));
      if (!inp || inp.value === '') continue;
      var n = parseFloat(inp.value);
      partial[all[i].key] = isNaN(n) ? inp.value : n;
    }
    RelVolume.setDials(partial);
    refreshPreview();
  }

  function wire(root) {
    if (!root || !global.RelVolume) return;
    var toggle = document.getElementById('rv-adv-toggle');
    if (toggle && !toggle._rvBound) {
      toggle._rvBound = true;
      toggle.addEventListener('click', function() {
        var d = RelVolume.getDials();
        RelVolume.setDials({ advancedOpen: !d.advancedOpen });
        var d2 = RelVolume.getDials();
        var block = document.getElementById('rv-adv-block');
        var val = toggle.querySelector('.view-field-value');
        if (block) block.style.display = d2.advancedOpen ? '' : 'none';
        if (val) val.textContent = d2.advancedOpen ? 'Advanced \u25be' : 'Simple \u203a Advanced';
      });
    }
    var presets = document.querySelectorAll('.rv-preset-row');
    for (var pi = 0; pi < presets.length; pi++) {
      if (presets[pi]._rvBound) continue;
      presets[pi]._rvBound = true;
      presets[pi].addEventListener('click', function() {
        var id = this.getAttribute('data-rv-preset');
        if (id) RelVolume.applyPreset(id);
        if (typeof ManagementScreen !== 'undefined' && ManagementScreen.renderSettings) {
          ManagementScreen.renderSettings();
        }
      });
    }
    var reset = document.getElementById('rv-reset-dials');
    if (reset && !reset._rvBound) {
      reset._rvBound = true;
      reset.addEventListener('click', function() {
        RelVolume.resetDials();
        if (typeof ManagementScreen !== 'undefined' && ManagementScreen.renderSettings) {
          ManagementScreen.renderSettings();
        }
      });
    }
    refreshPreview();
  }

  function renderExplainHtml(explain) {
    if (!explain) return '';
    var html = '<div class="rv-explain-panel">' +
      '<div class="rv-explain-title">' + esc(explain.label || 'Rhythm') + '</div>' +
      '<div class="rv-explain-score">' + esc(explain.bandLabel) + ' \u00b7 score ' + explain.score + '</div>' +
      '<div class="rv-explain-body">' + esc(explain.summary) + '</div>';
    var i;
    for (i = 0; i < (explain.lines || []).length; i++) {
      var ln = explain.lines[i];
      html += '<div class="rv-explain-line">' +
        esc(ln.label) + ': ' + ln.count + ' \u00b7 +' + ln.points + ' pts</div>';
    }
    var t = explain.totals || {};
    html += '<div class="rv-explain-totals">' +
      'Counts — sales ' + (t.sale || 0) + ', buys ' + (t.buy || 0) +
      ', needs ' + (t.need || 0) + ', offers ' + (t.offer || 0) +
      ', relays ' + (t.connection || 0) + '</div></div>';
    return html;
  }

  global.RelVolumeSettings = {
    renderSection: renderSection,
    renderExplainHtml: renderExplainHtml,
    readFromDom: readFromDom,
    wire: wire,
    refreshPreview: refreshPreview,
  };

}(window));
