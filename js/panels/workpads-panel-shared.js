// WorkpadsPanelShared — WorkpadsPanel split module
(function(global) {
  'use strict';

  function install(S) {
  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function fmtDate(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr + 'T00:00:00');
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var day = d.getDate();
    var suf = day === 1 ? 'st' : (day === 2 ? 'nd' : (day === 3 ? 'rd' : 'th'));
    return M[d.getMonth()] + ' ' + day + suf + ', ' + d.getFullYear();
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function pct(v) {
    return (Math.round(v * 10) / 10).toFixed(1) + '%';
  }

  function panelActionLabel(idx) {
    return idx === 0 ? 'Out' : (idx === 1 ? 'COGS' : 'In');
  }

  function toNum(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function money(currency, v) {
    return esc(CurrencyUtil.fmt(v, currency));
  }

  function panelActivityId() {
    if (S.browseActivities && S.browseActivities.length === 1) return S.browseActivities[0];
    return '';
  }

  function createFromPanel(kind) {
    var rec = S.context.record;
    var actId = panelActivityId();
    S.close();
    if (kind === 'sell') {
      App.showSaleTally({
        returnTo: (typeof App !== 'undefined' && App.getCurrentScreen) ? App.getCurrentScreen() : 'list',
        activityId: actId,
      });
      return true;
    }
    if (kind === 'payable' || kind === 'receivable' || kind === 'loan') {
      App.showLiabilities({
        type:         kind,
        linkedRecord: rec && rec.id ? rec : null,
        activityId:   actId,
        returnTo:     'list',
      });
    } else {
      var typeMap = { 'out': 'expense', 'cogs': 'cogs', 'in': 'payment' };
      App.showLedger({
        type:         typeMap[kind] || 'expense',
        linkedRecord: rec && rec.id ? rec : null,
        linkMode:     rec && rec.id ? 'record' : 'none',
        activityId:   actId,
      });
    }
    return true;
  }
  // ── Content rendering ──────────────────────────────────────────────────

  function updateActCircle() {
    var btnAct = document.getElementById('pb-btn-activity');
    if (!btnAct) return;
    btnAct.textContent       = 'A';
    btnAct.style.color       = '';
    btnAct.style.borderColor = '';
    btnAct.style.fontSize    = '';
    var filterOn = S.browseActivities.length > 0;
    if (filterOn) btnAct.classList.add('act-filter-on');
    else btnAct.classList.remove('act-filter-on');
  }
    S.todayIso = todayIso;
    S.fmtDate = fmtDate;
    S.pad2 = pad2;
    S.pct = pct;
    S.panelActionLabel = panelActionLabel;
    S.toNum = toNum;
    S.money = money;
    S.createFromPanel = createFromPanel;
    S.updateActCircle = updateActCircle;
  }

  global.WorkpadsPanelShared = { install: install };
}(window));
