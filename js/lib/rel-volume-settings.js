// RelVolumeSettings — rhythm tuning UI helpers (IO C11)
// Exposes: window.RelVolumeSettings

(function(global) {
  'use strict';

  var SIMPLE_DIALS = [
    { key: 'windowDays',      label: 'Lookback (days)',  type: 'number', min: 7, max: 365, step: 1 },
    { key: 'minInteractions', label: 'Min rhythm score', type: 'number', min: 0, max: 20, step: 0.5 },
  ];

  var ADVANCED_DIALS = [
    { key: 'weightSale',        label: 'Weight: Sale',        type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightReceipt',     label: 'Weight: Receipt',     type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightInvoice',     label: 'Weight: Invoice',     type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightPayment',     label: 'Weight: Payment',     type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightNeed',        label: 'Weight: Need',        type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightOffer',       label: 'Weight: Offer',       type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'weightConnection',  label: 'Weight: Connection', type: 'number', min: 0, max: 10, step: 0.25 },
    { key: 'decayPerDay',       label: 'Decay / day',         type: 'number', min: 0, max: 0.5, step: 0.005 },
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

  function renderSection() {
    if (!global.RelVolume) return '';
    var d = RelVolume.getDials();
    var adv = !!d.advancedOpen;
    var html = '<div class="view-field rv-adv-toggle" id="rv-adv-toggle" style="cursor:pointer;">' +
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
    return html;
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
  }

  function wire(root) {
    if (!root || !global.RelVolume) return;
    var toggle = root.querySelector ? root.getElementById('rv-adv-toggle') : document.getElementById('rv-adv-toggle');
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
  }

  global.RelVolumeSettings = {
    renderSection: renderSection,
    readFromDom: readFromDom,
    wire: wire,
  };

}(window));
