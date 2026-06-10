# Programmable receive — locked (A2)

**Status:** Done (receive-side read-only obligations)

## Behaviour

| Surface | Module | Notes |
|---------|--------|-------|
| List row | `WPProgrammableReceive.listPill` | ◐ N wait / Oblig ✓ |
| Record view | `renderViewSection` | Banner (received only) + Fired / Waiting per rule |
| Action bar | `needsActionFromRules` | Pending `when_confirmed` / `when_declined` → needs action |

Evaluator input: `WPProgrammableRules.evaluate` over chain + ack masks (`buildContext`).

## Code

- `js/lib/programmable-receive.js`
- Wired: `list.js`, `view.js` (`#view-pr-obligations`)
- `test/programmable-receive.test.js`

## QA

1. Receive record with `programmable_rules` → list shows wait pill.
2. Add payment child on chain → pill updates; view shows Fired on `when_paid`.
3. All rules satisfied → green banner + Oblig ✓ pill.

---

_End._
