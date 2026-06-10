// Screen: Tasks — due dates + task records + action due lines (B8)
// Exposes: window.TasksScreen

(function(global) {
  'use strict';

  var esc = global.esc || function(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  var allTasks     = [];
  var filtered     = [];
  var focusIdx     = 0;
  var personFilter = '';
  var filterFocus  = false;
  var taskScope    = 'open'; // today | overdue | all | open (today+overdue)

  var SCOPE_OPTS = [
    { id: 'open', label: 'Open' },
    { id: 'today', label: 'Today' },
    { id: 'overdue', label: 'Late' },
    { id: 'all', label: 'All' },
  ];

  function todayIso() {
    return global.WPDailyHub ? WPDailyHub.todayIso() : new Date().toISOString().slice(0, 10);
  }

  function applyFilter() {
    var q = personFilter.trim().toLowerCase();
    var base = global.WPDailyHub
      ? WPDailyHub.filterTasks(allTasks, taskScope === 'open' ? 'all' : taskScope)
      : allTasks.slice();
    if (taskScope === 'open') {
      var today = todayIso();
      base = base.filter(function(t) { return t.overdue || t.due === today; });
    }
    filtered = q
      ? base.filter(function(t) {
          return t.persons.some(function(n) { return n.toLowerCase().indexOf(q) !== -1; }) ||
                 t.customer.toLowerCase().indexOf(q) !== -1;
        })
      : base;
  }

  function render() {
    var el = document.getElementById('tasks-content');
    if (!el) return;
    var html = '';

    html += '<div class="task-scope-row">';
    for (var si = 0; si < SCOPE_OPTS.length; si++) {
      var opt = SCOPE_OPTS[si];
      html += '<span class="task-scope-btn' + (taskScope === opt.id ? ' active' : '') +
        '" data-task-scope="' + opt.id + '">' + esc(opt.label) + '</span>';
    }
    html += '</div>';

    html += '<div class="task-filter-bar">' +
      '<input class="task-filter-input" id="task-filter-inp" type="text" ' +
        'placeholder="Filter by person\u2026" value="' + esc(personFilter) + '" ' +
        'autocomplete="off" autocorrect="off" spellcheck="false">' +
    '</div>';

    html += '<div class="task-count">' +
      (filtered.length === 0 ? 'No tasks' : filtered.length + ' task' + (filtered.length !== 1 ? 's' : '')) +
      (personFilter ? ' \u00b7 filtered' : '') +
    '</div>';

    if (filtered.length === 0) {
      html += '<div class="task-empty">No tasks in this view.<br>Records with a due date, task type, or dated actions appear here.</div>';
    } else {
      html += '<div class="task-list">';
      for (var i = 0; i < filtered.length; i++) {
        var t = filtered[i];
        var focused = !filterFocus && focusIdx === i;
        var src = t.source === 'action' ? ' <span class="task-src">action</span>' : '';
        html += '<div class="task-item' + (focused ? ' focused' : '') + (t.overdue ? ' overdue' : '') + '" data-ti="' + i + '">' +
          '<div class="task-title">' + esc(t.title.slice(0, 32)) + src + '</div>' +
          '<div class="task-meta">' +
            (t.overdue ? '<span class="task-due-badge">OVERDUE</span> ' : '') +
            esc(t.due) +
            (t.customer ? ' \u00b7 ' + esc(t.customer.slice(0, 16)) : '') +
          '</div>' +
          (t.persons.length ? '<div class="task-persons">' + esc(t.persons.join(', ').slice(0, 28)) + '</div>' : '') +
        '</div>';
      }
      html += '</div>';
    }

    el.innerHTML = html;

    var scopeBtns = el.querySelectorAll('[data-task-scope]');
    for (var sb = 0; sb < scopeBtns.length; sb++) {
      scopeBtns[sb].addEventListener('click', (function(btn) {
        return function() {
          taskScope = btn.getAttribute('data-task-scope');
          focusIdx = 0;
          applyFilter();
          render();
        };
      })(scopeBtns[sb]));
    }

    var inp = document.getElementById('task-filter-inp');
    if (inp) {
      inp.addEventListener('input', function() {
        personFilter = inp.value;
        applyFilter();
        focusIdx = 0;
        render();
      });
      inp.addEventListener('focus', function() { filterFocus = true; });
      inp.addEventListener('blur',  function() { filterFocus = false; });
      if (filterFocus) inp.focus();
    }

    var rows = el.querySelectorAll('.task-item');
    for (var j = 0; j < rows.length; j++) {
      (function(row) {
        row.addEventListener('click', function() {
          openTask(parseInt(row.getAttribute('data-ti'), 10));
        });
      })(rows[j]);
    }

    if (!filterFocus) {
      var fRow = el.querySelector('.task-item.focused');
      if (fRow) fRow.scrollIntoView({ block: 'nearest' });
    }
  }

  function openTask(ti) {
    var t = filtered[ti];
    if (t && t.record) App.showView(t.record);
  }

  function load() {
    RecordService.list().then(function(all) {
      allTasks = global.WPDailyHub ? WPDailyHub.taskItems(all) : [];
      applyFilter();
      render();
    });
  }

  function onKey(key) {
    if (filterFocus) {
      if (key === 'Enter' || key === 'ArrowDown') {
        filterFocus = false;
        focusIdx = 0;
        render();
      }
      return;
    }
    switch (key) {
      case 'ArrowUp':
        if (focusIdx > 0) { focusIdx--; render(); }
        else { filterFocus = true; render(); var inp = document.getElementById('task-filter-inp'); if (inp) inp.focus(); }
        break;
      case 'ArrowDown':
        if (focusIdx < filtered.length - 1) { focusIdx++; render(); }
        break;
      case 'Enter':
        openTask(focusIdx);
        break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        var idx = -1;
        for (var i = 0; i < SCOPE_OPTS.length; i++) {
          if (SCOPE_OPTS[i].id === taskScope) { idx = i; break; }
        }
        if (idx < 0) break;
        if (key === 'ArrowLeft' && idx > 0) taskScope = SCOPE_OPTS[idx - 1].id;
        if (key === 'ArrowRight' && idx < SCOPE_OPTS.length - 1) taskScope = SCOPE_OPTS[idx + 1].id;
        applyFilter();
        focusIdx = 0;
        render();
        break;
      }
      case 'Backspace':
      case 'SoftRight':
        App.showHome();
        break;
    }
  }

  function onShow() {
    personFilter = '';
    filterFocus  = false;
    focusIdx     = 0;
    taskScope    = 'open';
    allTasks     = [];
    filtered     = [];
    load();
  }

  global.TasksScreen = { onShow: onShow, onKey: onKey };

}(window));
