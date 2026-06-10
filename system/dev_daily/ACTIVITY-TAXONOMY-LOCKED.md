# Activity taxonomy (C14 / B4) — locked

**Status:** Done (v1)  
**Phase:** B4 in `APP-BUILD-PHASE.md`

## Product

- **Work activities** group records (`activityId` on records). Distinct from `ActivityService` (business profile).
- **Not** top-level kinds: money | materials | social (rejected in `UI-ROADMAP-IO-PHILOSOPHY.md`, `IO-DECISIONS-LOCKED.md`).

## v1 axes

| Axis | Values | Storage (`WorkActivityService`) |
|------|--------|-------------------------------|
| Ownership | Personal (`own`), For others (`other`) | `type` |
| Setting | Field, Base, Remote | `setting` (default `field`) |

Legacy activities without `setting` normalize to `field` on read.

## UI

| Surface | Behavior |
|---------|----------|
| Manage → Activities | Explain blurb + name + ownership/setting pills + Add |
| List → Activity filter picker | Same pills on create row; rows show meta (`Mine · Field`) |
| Wizard | Activity `<select>` shows `optionLabel` (`Name — Mine · Field`) |

## Code

- `js/lib/activity-taxonomy.js` — `WPActivityTaxonomy`
- `js/WorkActivityService.js` — `create(name, opts)`, `update`, normalize on `listAll` / `getById`
- Tests: `test/activity-taxonomy.test.js`

## QA

1. Manage → Activities → create with each ownership/setting combo; confirm meta on list row.
2. List → Filters → Activity → Add with pills; filter Personal/Other still works.
3. Wizard record → Activity dropdown shows taxonomy suffix.
