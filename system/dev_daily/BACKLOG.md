# Workpads KaiOS — Backlog
_Items not yet scheduled but with design intent recorded._

---

## DEMO-001: Demo Data Onboarding UX

**Status:** Pending design
**Depends on:** Archive screen (Priority 2 in roadmap)

### Context
`js/lib/demo.js` seeds sample records on first install for orientation. These demo records
include financial amounts which skew the user's global totals (revenue, COGS, outstanding)
from day one. A new user who hasn't seen the archive yet will see confusing numbers.

### Design intent
On first launch after onboarding, detect that demo records exist and show a prompt:

> "Your app includes a few sample records to help you explore. Ready to start fresh?
> Archive them now — they'll stay safe in Archive."

**Flow:**
1. Onboarding completes → `ActivityService.create()` called
2. Before showing list, check `RecordService.list()` for records with `isDemo: true`
3. If any exist, show a dismissable banner or overlay:
   - CSK / RSK: "Archive demo records" → archives all demo records → show list
   - LSK: "Keep them" → dismiss, never prompt again (store flag `wp_demo_dismissed`)
4. On list screen, demo records show a "Demo" badge until archived
5. Management > Records tab links to Archive for first-time users

**Demo record format addition needed:**
- Add `isDemo: true` field to records created by `demo.js`
- RecordService.archiveDemo() helper to batch-archive all demo records

**Archive screen dependency:**
This prompt references Archive. The Archive screen (Priority 2) must exist before this
UX can be completed. The prompt can say "they'll stay safe in Archive" only once the user
can actually reach Archive.

### Notes
- Do NOT remove demo.js from the shipped package
- Keep demo data financially realistic for the target market (GB, NG, KE locales)
- Demo records should cover at least: one job, one quote, one invoice, one payment

---

## QUOTA-001: Storage Quota Warning

**Status:** Pending implementation
**Threshold:** 80% of estimated localStorage quota (~5MB per origin on KaiOS)

Show a persistent warning in Management > Records tab when storage exceeds ~4MB.
Offer "Archive old records" as the primary resolution action.

---

## EXPORT-001: Personal Captures Export

**Status:** Placeholder in Management > Personal tab ("Coming in v0.2")
**Format options:** Plain text (one capture per line) or JSON
**Destination:** Clipboard (KaiOS limitation — no file system write without permissions)

---

## ARCHIVE-UI-001: Archive Screen

**Status:** Service implemented, UI missing
**See:** Priority 2 in ROADMAP.md

---

## ICONS-001: App Store Icons

**Status:** `manifest.webmanifest` icons array is empty
**Required:** 56×56px, 112×112px, 128×128px PNG
**Blocks:** KaiOS Store submission
