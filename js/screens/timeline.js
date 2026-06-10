// Screen: Timeline — daily log + schedule/task/sale time axis (B8)
// Exposes: window.TimelineScreen

(function(global) {
  'use strict';

  var esc = global.esc || function(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  var currentDate = '';
  var increment   = 30;
  var INCREMENTS  = [15, 30, 60];
  var INC_LABELS  = ['15m', '30m', '1h'];
  var focusSlot   = -1;
  var entries     = [];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function todayIso() {
    return global.WPDailyHub ? WPDailyHub.todayIso() : new Date().toISOString().slice(0, 10);
  }

  function formatDateLabel(iso) {
    var d = new Date(iso + 'T00:00:00');
    var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var isToday = iso === todayIso();
    return (isToday ? 'Today · ' : '') + DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONS[d.getMonth()];
  }

  function shiftDate(days) {
    var d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function getSlots() {
    var slots = [];
    for (var h = 6; h < 22; h++) {
      for (var m = 0; m < 60; m += increment) {
        slots.push({ h: h, m: m });
      }
    }
    return slots;
  }

  function slotLabel(s) { return pad2(s.h) + ':' + pad2(s.m); }

  function slotEntriesFor(s) {
    var from = s.h * 60 + s.m;
    var to   = from + increment;
    return entries.filter(function(e) {
      return e.mins >= from && e.mins < to;
    });
  }

  function render() {
    var el = document.getElementById('timeline-content');
    if (!el) return;
    var slots = getSlots();

    var lbl = document.getElementById('tl-date-label');
    if (lbl) lbl.textContent = formatDateLabel(currentDate);

    var html = '<div class="tl-hint">Logs, schedules, tasks, and sales for this day</div>';

    html += '<div class="tl-inc-bar">';
    for (var ii = 0; ii < INCREMENTS.length; ii++) {
      var iActive = increment === INCREMENTS[ii];
      var iFocused = focusSlot === -1 && iActive;
      html += '<span class="tl-inc-btn' + (iActive ? ' active' : '') + (iFocused ? ' focused' : '') + '" data-inc="' + ii + '">' + INC_LABELS[ii] + '</span>';
    }
    html += '</div>';

    html += '<div class="tl-slots">';
    for (var si = 0; si < slots.length; si++) {
      var slot = slots[si];
      var slotEnt = slotEntriesFor(slot);
      var focused = focusSlot === si;
      var isHour  = slot.m === 0;
      html += '<div class="tl-slot' + (focused ? ' focused' : '') + (isHour ? ' tl-hour' : '') + '" data-si="' + si + '">' +
        '<span class="tl-time">' + slotLabel(slot) + '</span>' +
        '<div class="tl-slot-body">';
      if (slotEnt.length) {
        for (var ei = 0; ei < slotEnt.length; ei++) {
          var e = slotEnt[ei];
          html += '<div class="tl-entry">' +
            '<span class="tl-entry-badge">' + esc(e.badge) + '</span> ' +
            esc(e.title) + '</div>';
        }
      }
      html += '</div></div>';
    }
    html += '</div>';

    el.innerHTML = html;

    setTimeout(function() {
      var f = el.querySelector('.tl-slot.focused');
      if (f) f.scrollIntoView({ block: 'center' });
      else {
        var eightsIdx = 2 * (60 / increment);
        var slots8 = el.querySelectorAll('.tl-slot');
        if (slots8[eightsIdx]) slots8[eightsIdx].scrollIntoView({ block: 'start' });
      }
    }, 0);

    bindTlClicks(el);
  }

  function bindTlClicks(el) {
    var incBtns = el.querySelectorAll('.tl-inc-btn');
    for (var i = 0; i < incBtns.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          increment = INCREMENTS[parseInt(btn.getAttribute('data-inc'), 10)];
          focusSlot = 0;
          render();
        });
      })(incBtns[i]);
    }

    var slotEls = el.querySelectorAll('.tl-slot');
    for (var j = 0; j < slotEls.length; j++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          openSlot(parseInt(btn.getAttribute('data-si'), 10));
        });
      })(slotEls[j]);
    }

    var prevBtn = document.getElementById('tl-prev-btn');
    var nextBtn = document.getElementById('tl-next-btn');
    if (prevBtn) prevBtn.onclick = function() { currentDate = shiftDate(-1); load(); };
    if (nextBtn) nextBtn.onclick = function() { currentDate = shiftDate(1);  load(); };
  }

  function openSlot(si) {
    var slots = getSlots();
    var slot  = slots[si];
    if (!slot) return;
    var slotEnt = slotEntriesFor(slot);
    if (slotEnt.length === 1 && slotEnt[0].rec) {
      App.showView(slotEnt[0].rec);
      return;
    }
    App.showWizard(null, {
      defaultType: 'log',
      defaultDate: currentDate,
      defaultTime: slotLabel(slot),
    });
  }

  function load() {
    var lbl = document.getElementById('tl-date-label');
    if (lbl) lbl.textContent = formatDateLabel(currentDate);

    RecordService.list().then(function(all) {
      entries = global.WPDailyHub
        ? WPDailyHub.timelineEntries(all, currentDate)
        : all.filter(function(r) {
            return !r.parentId && (r.date || '').slice(0, 10) === currentDate;
          }).map(function(r) {
            return { rec: r, mins: 480, title: r.job || 'Log', badge: 'Log' };
          });
      render();
    });
  }

  function onKey(key) {
    var slots = getSlots();
    var incIdx = INCREMENTS.indexOf(increment);

    switch (key) {
      case 'ArrowUp':
        if (focusSlot > 0) { focusSlot--; render(); }
        else if (focusSlot === 0) { focusSlot = -1; render(); }
        break;
      case 'ArrowDown':
        if (focusSlot === -1) { focusSlot = 0; render(); }
        else if (focusSlot < slots.length - 1) { focusSlot++; render(); }
        break;
      case 'ArrowLeft':
        if (focusSlot === -1) {
          if (incIdx > 0) { increment = INCREMENTS[incIdx - 1]; render(); }
        } else {
          currentDate = shiftDate(-1);
          load();
        }
        break;
      case 'ArrowRight':
        if (focusSlot === -1) {
          if (incIdx < INCREMENTS.length - 1) { increment = INCREMENTS[incIdx + 1]; render(); }
        } else {
          currentDate = shiftDate(1);
          load();
        }
        break;
      case 'Enter':
        if (focusSlot === -1) {
          focusSlot = 0;
          render();
        } else {
          openSlot(focusSlot);
        }
        break;
      case 'Backspace':
      case 'SoftRight':
        App.showHome();
        break;
    }
  }

  function onShow() {
    currentDate = todayIso();
    increment   = 30;
    focusSlot   = -1;
    entries     = [];
    load();
  }

  global.TimelineScreen = { onShow: onShow, onKey: onKey };

}(window));
