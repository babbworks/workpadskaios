# Timeline / Tasks hub (B8) — locked

**Status:** Done (v1)

## `WPDailyHub`

| API | Purpose |
|-----|---------|
| `timelineEntries(records, iso)` | Day bucket: log, schedule, task, sale, work_record (not invoice-only noise) |
| `taskItems(records)` | `due_date`, task `date`, action `due_date` lines |
| `filterTasks(tasks, mode)` | today / overdue / all |
| `homeBadges(records)` | Counts for WP+ home Timeline / Tasks chips |

## UI

- **Timeline** — type badge per slot entry; single entry → View; empty slot → new log.
- **Tasks** — scope pills Open / Today / Late / All; person filter; open → View.
- **Home** — numeric badges on Timeline and Tasks when counts &gt; 0 (warn tint if overdue).

## Code

- `js/lib/daily-hub.js`
- `js/screens/timeline.js`, `tasks.js`, `home.js`
- `test/daily-hub.test.js`
