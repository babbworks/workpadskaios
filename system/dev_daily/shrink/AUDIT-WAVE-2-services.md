# Audit Wave 2 — Services choke points

**Date:** 2026-05-21

## RecordService.js (~492 LOC)

| Check | Result |
|-------|--------|
| Encode from screens | **Good** — `share.js` uses `RecordService.encodeUrl` only |
| Decode / receive | `app.js` → `decodeUrl` / `storeReceived` |
| Template URLs | Not wired → `receiveExternal()` **pending** |
| C-TRIG on `put()` | **Missing** — P3 |

**Verdict:** keep; wire P1 `changedMask`, P3 hook here.

## RecordTemplateService.js (~110 LOC)

| Check | Result |
|-------|--------|
| Personal / Imported / pending | **Active** — management + list picker |
| `receiveExternal` caller | **None yet** — need share/decode path |

**Verdict:** keep; small, correct layer.

## StorageAdapter / ActivityService / BlockRegistry

- Single-purpose, no duplicate CRUD found in screens.
- **Verdict:** keep

## FinancialModel.js

- Used by finance screens; `WPFormula` not called (formula off shell).
- **Verdict:** keep; optional future: call `WPFormula` for template line calc or delete formula.js source.

## GlobalSynonymsService / RecordTemplateService / TemplateRegistry

- Clear split: synonyms vs My Templates vs presentation templates.
- **Verdict:** keep

## Duplicate encode risk

- `share.js` builds opts then `encodeUrl` — OK
- No screen calls `WPCodec.encode` directly except via services/libs

## Wave 2 action items (code, not done)

1. P1 — `changedMask` diff in `share.js` before encode
2. P3 — `RecordService.put` → `WPCtrig.evaluate` → `App.prefillRecord`
3. External record template URL → `RecordTemplateService.receiveExternal`
