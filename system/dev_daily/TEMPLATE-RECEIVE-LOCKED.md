# External template receive (B5) — locked

**Status:** Done (v1)

## Flow

1. **URL** `#rtpl/<base64url JSON>` → `WPTemplateReceive.receiveFromHash` → `RecordTemplateService.receiveExternal` (pending).
2. **Template QR** `#1dt/` after decode → optional confirm → same pending storage.
3. **NFC / paste** — any URL whose hash is `rtpl/…` goes through `app.js` `processIncomingHash`.

## Import UX (Manage → My Templates)

| State | Keys |
|-------|------|
| Pending list | Enter = detail · SoftRight = import · CSK = View |
| Pending detail | Import / Edit first / Dismiss · Back = list |

Imported templates move to **Imported** scope (`importedAt` set). Dismiss = `remove` pending copy.

## Code

- `js/lib/template-receive.js` — `WPTemplateReceive`
- `test/template-receive.test.js`
