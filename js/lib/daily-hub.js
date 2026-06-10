// daily-hub.js — timeline + tasks aggregation (B8)
// Exposes: window.WPDailyHub

(function(global) {
  'use strict';

  var TIMELINE_TYPES = { '': 1, log: 1, schedule: 1, task: 1, sale: 1, work_record: 1 };
  var TYPE_BADGE = {
    log: 'Log', schedule: 'Sched', task: 'Task', sale: 'Sale', work_record: 'Work',
  };

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function recordDayIso(r) {
    var d = r.date || r.meeting_time || r.due_date || '';
    return String(d).slice(0, 10);
  }

  function timeToMins(t) {
    t = String(t || '').slice(0, 5);
    if (t.length < 4) return null;
    var h = parseInt(t.slice(0, 2), 10);
    var m = parseInt(t.slice(3, 5), 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  function recordTimeMins(r) {
    var t = r.start_time || r.meeting_time || r.time || '';
    var mins = timeToMins(t);
    if (mins != null) return mins;
    if ((r.record_type || '') === 'log') return 8 * 60;
    return 12 * 60;
  }

  function isTimelineEligible(r) {
    if (!r || r.parentId) return false;
    var rt = r.record_type || '';
    return !!TIMELINE_TYPES[rt];
  }

  function timelineEntries(records, iso) {
    var out = [];
    var i, r, mins;
    for (i = 0; i < records.length; i++) {
      r = records[i];
      if (!isTimelineEligible(r)) continue;
      if (recordDayIso(r) !== iso) continue;
      mins = recordTimeMins(r);
      out.push({
        rec: r,
        mins: mins,
        title: r.job || r.description || r.customer || 'Entry',
        badge: TYPE_BADGE[r.record_type || ''] || (r.record_type || 'Record'),
      });
    }
    out.sort(function(a, b) { return a.mins - b.mins; });
    return out;
  }

  function dueForRecord(r) {
    if (r.due_date) return String(r.due_date).slice(0, 10);
    if ((r.record_type || '') === 'task' && r.date) return String(r.date).slice(0, 10);
    return '';
  }

  function taskItems(records) {
    var tasks = [];
    var today = todayIso();
    var i, r, due, j, a;

    for (i = 0; i < records.length; i++) {
      r = records[i];
      if (r.parentId) continue;
      due = dueForRecord(r);
      if (due) {
        tasks.push({
          id: r.id,
          title: r.job || r.description || 'Untitled',
          due: due,
          customer: r.customer || '',
          persons: participantNames(r),
          record: r,
          overdue: due < today,
          source: 'record',
        });
      }
      if (Array.isArray(r.actions)) {
        for (j = 0; j < r.actions.length; j++) {
          a = r.actions[j];
          if (!a || !a.due_date) continue;
          due = String(a.due_date).slice(0, 10);
          tasks.push({
            id: r.id + ':act:' + j,
            title: (a.title || 'Action').slice(0, 48),
            due: due,
            customer: r.customer || '',
            persons: participantNames(r),
            record: r,
            overdue: due < today,
            source: 'action',
          });
        }
      }
    }

    tasks.sort(function(a, b) {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return (a.due || '').localeCompare(b.due || '');
    });
    return tasks;
  }

  function participantNames(r) {
    if (!Array.isArray(r.participants)) return [];
    return r.participants.map(function(p) { return p.name || ''; }).filter(Boolean);
  }

  function filterTasks(tasks, mode) {
    var today = todayIso();
    if (mode === 'overdue') {
      return tasks.filter(function(t) { return t.overdue; });
    }
    if (mode === 'today') {
      return tasks.filter(function(t) { return t.due === today; });
    }
    return tasks.slice();
  }

  function homeBadges(records) {
    var today = todayIso();
    var tasks = taskItems(records);
    var overdue = 0;
    var dueToday = 0;
    var i;
    for (i = 0; i < tasks.length; i++) {
      if (tasks[i].overdue) overdue++;
      else if (tasks[i].due === today) dueToday++;
    }
    return {
      timelineToday: timelineEntries(records, today).length,
      tasksToday: dueToday,
      tasksOverdue: overdue,
      tasksOpen: dueToday + overdue,
    };
  }

  global.WPDailyHub = {
    todayIso: todayIso,
    timelineEntries: timelineEntries,
    taskItems: taskItems,
    filterTasks: filterTasks,
    homeBadges: homeBadges,
  };

}(typeof window !== 'undefined' ? window : global));
