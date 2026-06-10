'use strict';

var fs = require('fs');

var global = { window: {} };
function load(path) {
  new Function('window', 'global', fs.readFileSync(path, 'utf8'))(global.window, global);
}

load(__dirname + '/../js/lib/daily-hub.js');
var Hub = global.window.WPDailyHub;

var pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { console.log('  [PASS] ' + label); pass++; }
  else { console.log('  [FAIL] ' + label); fail++; }
}

var today = Hub.todayIso();
var records = [
  { id: '1', record_type: 'log', job: 'Morning log', date: today, time: '08:30' },
  { id: '2', record_type: 'task', job: 'Fix tap', due_date: today },
  { id: '3', record_type: 'sale', job: 'Stall', date: today, start_time: '10:00' },
  { id: '4', record_type: 'invoice', job: 'Hidden', date: today },
  { id: '5', record_type: 'job', job: 'Old due', due_date: '2020-01-01' },
  { id: '6', record_type: 'quote', job: 'Actions', due_date: today,
    actions: [{ title: 'Call back', due_date: today }] },
];

var tl = Hub.timelineEntries(records, today);
assert('timeline includes log task sale', tl.length === 3);
assert('timeline excludes invoice', !tl.some(function(e) { return e.title === 'Hidden'; }));

var tasks = Hub.taskItems(records);
assert('tasks include overdue', tasks.some(function(t) { return t.overdue; }));
assert('action task line', tasks.some(function(t) { return t.source === 'action'; }));

var badges = Hub.homeBadges(records);
assert('home badges timeline', badges.timelineToday === 3);
assert('home badges tasks open', badges.tasksOpen >= 2);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
