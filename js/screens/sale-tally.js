// Screen: Sale tally — market calculator + catalogue (R3–R6)
// Exposes: window.SaleTallyScreen

(function(global) {
  'use strict';

  var el = {
    content: null,
    csk: null,
    lsk: null,
    rsk: null,
    title: null,
    lockOverlay: null,
  };

  var phase = 'catalogue';
  var activityId = '';
  var catalogue = [];
  var focusIdx = 0;
  var selectedItem = null;
  var qty = '1';
  var lastQty = '1';
  var price = '';
  var fullMode = false;
  var buyer = '';
  var editName = '';
  var editPrice = '';
  var editId = null;
  var fieldFocus = 0;
  var returnTo = 'list';
  var saving = false;
  var screenLocked = false;

  function screenLockEnabled() {
    return !global.UIPhase || UIPhase.isOn('sale_screen_lock');
  }
  var sessionTotal = 0;
  var sessionCount = 0;

  function sessionKey() {
    return 'wp_sale_session_' + todayStr() + '_' + (activityId || '_default');
  }

  function loadSession() {
    try {
      var raw = JSON.parse(localStorage.getItem(sessionKey()) || '{}');
      sessionTotal = parseFloat(raw.total || 0) || 0;
      sessionCount = parseInt(raw.count || 0, 10) || 0;
    } catch (_) {
      sessionTotal = 0;
      sessionCount = 0;
    }
  }

  function addSession(amount) {
    sessionTotal += amount;
    sessionCount += 1;
    localStorage.setItem(sessionKey(), JSON.stringify({
      total: sessionTotal,
      count: sessionCount,
    }));
  }

  function todayStr() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' +
      (m < 10 ? '0' : '') + m + '-' +
      (day < 10 ? '0' : '') + day;
  }

  function parseNum(s) {
    var n = parseFloat(String(s).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function lineTotal() {
    return parseNum(qty) * parseNum(price);
  }

  function loadCatalogue() {
    catalogue = SaleCatalogue.list(activityId);
  }

  function setLockUI() {
    if (el.lockOverlay) {
      el.lockOverlay.style.display = screenLocked ? 'flex' : 'none';
      el.lockOverlay.setAttribute('aria-hidden', screenLocked ? 'false' : 'true');
    }
  }

  function toggleLock() {
    if (!screenLockEnabled()) return;
    screenLocked = !screenLocked;
    localStorage.setItem('wp_sale_screen_lock', screenLocked ? '1' : '');
    setLockUI();
  }

  function setSoftkeys() {
    if (screenLocked) {
      if (el.lsk) el.lsk.textContent = '';
      if (el.csk) el.csk.textContent = '';
      if (el.rsk) el.rsk.textContent = '';
      return;
    }
    if (phase === 'catalogue') {
      if (el.lsk) el.lsk.textContent = 'Back';
      if (el.csk) el.csk.textContent = 'Add';
      if (el.rsk) el.rsk.textContent = focusIdx < catalogue.length && catalogue[focusIdx] ? 'Edit' : '';
    } else if (phase === 'tally') {
      if (el.lsk) el.lsk.textContent = 'Back';
      if (el.csk) el.csk.textContent = 'Record';
      if (el.rsk) el.rsk.textContent = fullMode ? 'Cash' : 'Full';
    } else {
      if (el.lsk) el.lsk.textContent = 'Cancel';
      if (el.csk) el.csk.textContent = 'Save';
      if (el.rsk) el.rsk.textContent = editId ? 'Delete' : '';
    }
  }

  function sessionBarHtml() {
    if (sessionCount < 1) return '';
    var cur = ActivityService.getLocale().currency;
    return '<div class="sale-session-bar">' +
      'Today: ' + esc(CurrencyUtil.fmt(sessionTotal, cur)) +
      ' \u00b7 ' + sessionCount + ' sale' + (sessionCount === 1 ? '' : 's') +
    '</div>';
  }

  function renderCatalogue() {
    phase = 'catalogue';
    setSoftkeys();
    if (el.title) el.title.textContent = 'Sell';

    var rows = '';
    if (!catalogue.length) {
      rows = global.EmptyState
        ? EmptyState.render('No items yet', { hint: 'Add what you sell at this stall.', action: 'CSK — add first product' })
        : '<div class="empty-state" style="padding:12px;">No items yet.<br>CSK to add first product.</div>';
    } else {
      for (var i = 0; i < catalogue.length; i++) {
        var it = catalogue[i];
        var foc = focusIdx === i;
        rows += '<div class="sale-cat-row' + (foc ? ' focused' : '') + '" data-idx="' + i + '">' +
          '<span class="sale-cat-name">' + esc(it.name) + '</span>' +
          '<span class="sale-cat-price">' + esc(CurrencyUtil.fmt(parseNum(it.price), ActivityService.getLocale().currency)) + '</span>' +
        '</div>';
      }
    }

    el.content.innerHTML =
      sessionBarHtml() +
      '<div class="sale-hdr">What do you sell?</div>' +
      '<div class="sale-hint">* lock stall \u00b7 RSK edit item</div>' +
      rows +
      '<div class="sale-cat-row sale-cat-add' + (focusIdx === catalogue.length ? ' focused' : '') + '" data-idx="' + catalogue.length + '">' +
        '<span class="sale-cat-name">+ Add item</span>' +
      '</div>';

    bindCatalogueRows();
  }

  function bindCatalogueRows() {
    var rows = el.content.querySelectorAll('[data-idx]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener('click', (function(idx) {
        return function() {
          focusIdx = idx;
          openCatalogueRow();
        };
      })(parseInt(rows[i].getAttribute('data-idx'), 10)));
    }
  }

  function openCatalogueRow() {
    if (focusIdx === catalogue.length) {
      phase = 'edit';
      editId = null;
      editName = '';
      editPrice = '';
      fieldFocus = 0;
      renderEdit();
      return;
    }
    selectedItem = catalogue[focusIdx];
    qty = lastQty || '1';
    price = selectedItem.price || '0';
    buyer = '';
    phase = 'tally';
    fieldFocus = 0;
    focusIdx = -1;
    renderTally();
  }

  function renderTally() {
    setSoftkeys();
    if (el.title) el.title.textContent = selectedItem ? selectedItem.name : 'Sale';

    var total = lineTotal();
    var cur = ActivityService.getLocale().currency;
    var buyerRow = fullMode
      ? '<div class="field-group' + (fieldFocus === 2 ? ' field-focused' : '') + '">' +
          '<div class="field-label">Buyer (optional)</div>' +
          '<input class="field-input" id="sale-buyer" type="text" value="' + esc(buyer) + '" autocomplete="off">' +
        '</div>'
      : '';

    el.content.innerHTML =
      sessionBarHtml() +
      '<div class="sale-tally-total">' + esc(CurrencyUtil.fmt(total, cur)) + '</div>' +
      '<div class="field-group' + (fieldFocus === 0 ? ' field-focused' : '') + '">' +
        '<div class="field-label">Qty</div>' +
        '<input class="field-input" id="sale-qty" type="tel" inputmode="numeric" value="' + esc(qty) + '">' +
      '</div>' +
      '<div class="field-group' + (fieldFocus === 1 ? ' field-focused' : '') + '">' +
        '<div class="field-label">Price each</div>' +
        '<input class="field-input" id="sale-price" type="tel" inputmode="decimal" value="' + esc(price) + '">' +
      '</div>' +
      buyerRow +
      '<div class="sale-action-row">' +
        '<span class="sale-act-btn' + (focusIdx === 0 ? ' focused' : '') + '" data-act="another">Another</span>' +
        '<span class="sale-act-btn' + (focusIdx === 1 ? ' focused' : '') + '" data-act="newqty">New qty</span>' +
      '</div>' +
      '<div class="sale-hint">1 same qty \u00b7 2 new qty \u00b7 * lock</div>';

    var q = document.getElementById('sale-qty');
    var p = document.getElementById('sale-price');
    var b = document.getElementById('sale-buyer');
    if (q) q.addEventListener('input', function() { qty = q.value; refreshTallyTotal(); });
    if (p) p.addEventListener('input', function() { price = p.value; refreshTallyTotal(); });
    if (b) b.addEventListener('input', function() { buyer = b.value; });

    var acts = el.content.querySelectorAll('[data-act]');
    for (var i = 0; i < acts.length; i++) {
      acts[i].addEventListener('click', function() {
        var a = this.getAttribute('data-act');
        if (a === 'another') recordSale(true);
        else if (a === 'newqty') {
          fieldFocus = 0;
          focusIdx = -1;
          var inp = document.getElementById('sale-qty');
          if (inp) inp.focus();
        }
      });
    }
  }

  function refreshTallyTotal() {
    var node = el.content.querySelector('.sale-tally-total');
    if (node) {
      node.textContent = CurrencyUtil.fmt(lineTotal(), ActivityService.getLocale().currency);
    }
  }

  function renderEdit() {
    setSoftkeys();
    if (el.title) el.title.textContent = editId ? 'Edit item' : 'New item';
    el.content.innerHTML =
      '<div class="field-group' + (fieldFocus === 0 ? ' field-focused' : '') + '">' +
        '<div class="field-label">Name</div>' +
        '<input class="field-input" id="sale-edit-name" type="text" value="' + esc(editName) + '">' +
      '</div>' +
      '<div class="field-group' + (fieldFocus === 1 ? ' field-focused' : '') + '">' +
        '<div class="field-label">Default price</div>' +
        '<input class="field-input" id="sale-edit-price" type="tel" value="' + esc(editPrice) + '">' +
      '</div>' +
      (editId ? '<div class="sale-hint">RSK deletes this catalogue item</div>' : '');
    var n = document.getElementById('sale-edit-name');
    var p = document.getElementById('sale-edit-price');
    if (n) n.addEventListener('input', function() { editName = n.value; });
    if (p) p.addEventListener('input', function() { editPrice = p.value; });
  }

  function saveCatalogueItem() {
    var n = document.getElementById('sale-edit-name');
    var p = document.getElementById('sale-edit-price');
    if (n) editName = n.value;
    if (p) editPrice = p.value;
    if (!editName.trim()) return;
    SaleCatalogue.saveItem(activityId, {
      id: editId,
      name: editName.trim(),
      price: editPrice.trim() || '0',
    });
    loadCatalogue();
    phase = 'catalogue';
    focusIdx = Math.max(0, catalogue.length - 1);
    renderCatalogue();
  }

  function deleteCatalogueItem() {
    if (!editId) return;
    SaleCatalogue.removeItem(activityId, editId);
    loadCatalogue();
    phase = 'catalogue';
    focusIdx = Math.min(focusIdx, Math.max(0, catalogue.length - 1));
    renderCatalogue();
  }

  function recordSale(stayOnTally) {
    if (saving || !selectedItem) return;
    var qInp = document.getElementById('sale-qty');
    var pInp = document.getElementById('sale-price');
    if (qInp) qty = qInp.value;
    if (pInp) price = pInp.value;
    var bInp = document.getElementById('sale-buyer');
    if (bInp) buyer = bInp.value;

    var total = lineTotal();
    if (total <= 0) return;

    saving = true;
    lastQty = qty;
    var locale = ActivityService.getLocale();
    var fields = {
      record_type: 'sale',
      job: selectedItem.name,
      amount: String(total),
      sale_qty: qty,
      sale_unit_price: price,
      sale_item_id: selectedItem.id,
      date: todayStr(),
      currency: locale.currency,
      draft: false,
    };
    if (activityId) fields.activityId = activityId;
    if (fullMode && buyer.trim()) fields.customer = buyer.trim();

    RecordService.create(fields).then(function(rec) {
      saving = false;
      if (global.SocialLedger) SocialLedger.onSaleConfirmed(rec);
      addSession(total);
      if (stayOnTally) {
        renderTally();
        return;
      }
      App.showView(rec);
    }).catch(function() {
      saving = false;
    });
  }

  function onShow(opts) {
    opts = opts || {};
    returnTo = opts.returnTo || 'list';
    var act = ActivityService.getActive ? ActivityService.getActive() : null;
    activityId = opts.activityId || (act ? act.id : '');
    phase = opts.itemId ? 'tally' : 'catalogue';
    fullMode = !!localStorage.getItem('wp_sale_full_mode');
    screenLocked = screenLockEnabled() && !!localStorage.getItem('wp_sale_screen_lock');
    loadCatalogue();
    loadSession();
    focusIdx = 0;
    selectedItem = null;
    setLockUI();

    if (opts.itemId) {
      selectedItem = SaleCatalogue.getItem(activityId, opts.itemId);
      if (selectedItem) {
        qty = lastQty || '1';
        price = selectedItem.price || '0';
        phase = 'tally';
        renderTally();
        return;
      }
    }
    if (opts.prefillName) {
      var pn = String(opts.prefillName).trim();
      var ci, found = null;
      for (ci = 0; ci < catalogue.length; ci++) {
        if ((catalogue[ci].name || '').toLowerCase() === pn.toLowerCase()) {
          found = catalogue[ci];
          break;
        }
      }
      selectedItem = found || { id: '_rollup', name: pn, price: '' };
      qty = lastQty || '1';
      price = selectedItem.price || '';
      phase = 'tally';
      renderTally();
      return;
    }
    renderCatalogue();
  }

  function goBack() {
    if (screenLocked) return;
    if (phase === 'tally') {
      phase = 'catalogue';
      focusIdx = 0;
      renderCatalogue();
      return;
    }
    if (phase === 'edit') {
      phase = 'catalogue';
      renderCatalogue();
      return;
    }
    if (App.goBack && App.goBack()) return;
    if (returnTo === 'home') App.showHome();
    else App.showList();
  }

  function openEditFocusedItem() {
    if (focusIdx >= catalogue.length || focusIdx < 0) return;
    phase = 'edit';
    editId = catalogue[focusIdx].id;
    editName = catalogue[focusIdx].name;
    editPrice = catalogue[focusIdx].price;
    fieldFocus = 0;
    renderEdit();
  }

  function onStarKey() {
    toggleLock();
  }

  function onKey(key) {
    if (key === '*') {
      if (screenLockEnabled()) toggleLock();
      return;
    }
    if (screenLocked) return;

    if (phase === 'catalogue') {
      var max = catalogue.length;
      switch (key) {
        case 'ArrowUp':
          if (focusIdx > 0) { focusIdx--; renderCatalogue(); }
          break;
        case 'ArrowDown':
          if (focusIdx < max) { focusIdx++; renderCatalogue(); }
          break;
        case 'Enter':
          openCatalogueRow();
          break;
        case 'SoftLeft':
        case 'Backspace':
          goBack();
          break;
        case 'SoftRight':
          openEditFocusedItem();
          break;
        case '3':
          if (focusIdx < catalogue.length) {
            SaleCatalogue.removeItem(activityId, catalogue[focusIdx].id);
            loadCatalogue();
            focusIdx = Math.min(focusIdx, catalogue.length);
            renderCatalogue();
          }
          break;
      }
      return;
    }

    if (phase === 'edit') {
      switch (key) {
        case 'ArrowUp':
          fieldFocus = Math.max(0, fieldFocus - 1);
          renderEdit();
          break;
        case 'ArrowDown':
          fieldFocus = Math.min(1, fieldFocus + 1);
          renderEdit();
          break;
        case 'Enter':
        case 'SoftRight':
          if (key === 'SoftRight' && editId) deleteCatalogueItem();
          else saveCatalogueItem();
          break;
        case 'SoftLeft':
        case 'Backspace':
          phase = 'catalogue';
          renderCatalogue();
          break;
        case '3':
          if (editId) deleteCatalogueItem();
          break;
      }
      return;
    }

    if (phase === 'tally') {
      switch (key) {
        case 'ArrowUp':
          if (fieldFocus > 0) fieldFocus--;
          else if (focusIdx > 0) focusIdx--;
          renderTally();
          break;
        case 'ArrowDown':
          if (fieldFocus < (fullMode ? 2 : 1)) fieldFocus++;
          else if (focusIdx < 1) focusIdx++;
          renderTally();
          break;
        case 'SoftRight':
          fullMode = !fullMode;
          localStorage.setItem('wp_sale_full_mode', fullMode ? '1' : '');
          renderTally();
          break;
        case 'SoftLeft':
        case 'Backspace':
          goBack();
          break;
        case 'Enter':
          if (focusIdx === 0) recordSale(true);
          else if (focusIdx === 1) {
            fieldFocus = 0;
            focusIdx = -1;
            renderTally();
            setTimeout(function() {
              var inp = document.getElementById('sale-qty');
              if (inp) inp.focus();
            }, 40);
          } else recordSale(false);
          break;
        case '1':
          recordSale(true);
          break;
        case '2':
          fieldFocus = 0;
          focusIdx = -1;
          renderTally();
          setTimeout(function() {
            var inp = document.getElementById('sale-qty');
            if (inp) inp.focus();
          }, 40);
          break;
      }
    }
  }

  function onCsk() {
    if (screenLocked) return;
    if (phase === 'catalogue') {
      phase = 'edit';
      editId = null;
      editName = '';
      editPrice = '';
      fieldFocus = 0;
      renderEdit();
      return;
    }
    if (phase === 'edit') {
      saveCatalogueItem();
      return;
    }
    if (phase === 'tally') recordSale(false);
  }

  function init() {
    el.content = document.getElementById('sale-tally-content');
    el.csk = document.getElementById('sale-tally-csk');
    el.rsk = document.getElementById('sale-tally-rsk');
    el.lsk = document.querySelector('#screen-sale-tally .sk-lsk');
    el.title = document.getElementById('sale-tally-title');
    el.lockOverlay = document.getElementById('sale-lock-overlay');
  }

  global.SaleTallyScreen = {
    onShow: onShow,
    onKey: onKey,
    onCsk: onCsk,
    onStarKey: onStarKey,
    init: init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));
