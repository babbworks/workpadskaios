# Workpads KaiOS — Implementation Map

This document maps each workpads-standard spec to its implementation in the KaiOS app.
The standard itself lives in `workpads-standard/` and is not modified here.
Use this as the comparison layer: **standard says X → app does Y**.

---

## Codec (`workpads-standard/codec.md`)

**Standard**: URI-based frame encoding, BASE_TEMPLATE 1–6, field bitmask, zlib+base64 outer encoding.

**Implementation**: `js/lib/codec.js`
- `encodeFrame(rec)` / `decodeFrame(uri)` — full URI codec
- `encodeBinary(rec)` / `decodeBinary(buf)` — `.wpf` binary codec for file sharing
- BASE_TEMPLATE values supported: 1 (job/invoice), 2 (expense), 3 (payment), 4 (contact), 5 (state_commit), 6 (amendment)
- Chain param `&c=` encoded when `rec.chainRef` present
- KaiOS constraint: no `TextEncoder` — codec uses manual UTF-8 byte building

---

## Record Schema (`workpads-standard/record-schema.md`)

**Standard**: Core fields (id, date, currency, amount, record_type, record_class, chainRef, worker, participants, flags).

**Implementation**: `js/RecordService.js`, `js/StorageAdapter.js`
- Records stored in localStorage under `wp_rec_<actId>_<uuid>`
- `record_class`: `'financial'` | `'contact'`
- `record_type`: `'invoice'` | `'quote'` | `'receipt'` | `'job'` | `'expense'` | `'payment'` | `'state_commit'` | `'amendment'` | `'dispute'` | `'ack'`
- `chainRef`: 3-char base64url random ID, stamped at record creation in wizard
- `participants`: array of `{uid, role, share}` objects
- `flags`: bitmask (FLAGS1–FLAGS4 exposed in wizard)

---

## Financial Block (`workpads-standard/financial-block.md`)

**Standard**: Billed / COGS / paid / outstanding / gross margin / net margin aggregation.

**Implementation**: `js/lib/formula.js` (FinancialModel), `js/screens/finance-overview.js`
- `FinancialModel.summarize(rec, children)` → `{ total, cogsTotal, paidTotal, outstanding, grossMargin, netMargin }`
- Finance overview aggregates per-currency: never adds GBP + BTC; displays with `CurrencyUtil.fmtFlat()`
- Filters: time window (All / Month / Week), currency picker (cycles available), type dropdown (All / Invoices / Quotes / Receipts / Jobs)

---

## Participants Block (`workpads-standard/participants-block.md`)

**Standard**: Roles array (see `roles.js`), share percentages, worker identity.

**Implementation**: `js/lib/roles.js`, wizard participants step
- Roles 1–9 defined (client, supplier, worker, contractor, agent, sub, partner, debtor, creditor)
- Share field: percentage; wizard enforces total ≤ 100
- Worker field: free text (name / ID)

---

## Chain Protocol (`workpads-standard/chain-protocol.md`)

**Standard**: Records sharing same chainRef form a chain; state_commit closes a chain; ACK confirms receipt.

**Implementation**: `js/screens/chain.js`, `js/screens/view.js`
- `ChainScreen`: loads all records, filters by `chainRef`, sorts by date then `createdAt`
- Accessed via Options overlay → "View chain", or key `5` in view screen
- Connector glyphs: `◉` first / `─` intermediate / `◎` state_commit
- **State Commit** (Close / commit): creates `record_type: 'state_commit'` inheriting `chainRef`; commit types: 0 = Job complete, 1 = Payment confirmed, 2 = Terms accepted, 3 = Disputed
- **ACK**: view screen shows ACK bar when `ackRequest` is true on the record; "Generate ACK" creates `record_type: 'ack'` with `ackConfirmed: true`, same chainRef, then opens share

---

## Record Service (`workpads-standard/record-service.md`)

**Standard**: CRUD + list + children lookup; parent/child via `parentId`.

**Implementation**: `js/RecordService.js`
- `list()`, `get(id)`, `put(rec)`, `remove(id)`, `listChildren(parentId)`
- Activity namespace: `wp_activity_active` holds active `actId`; all records prefixed `wp_rec_<actId>_`
- StorageAdapter: `js/StorageAdapter.js` — localStorage wrapper, Promise-based

---

## Codec Sync / Share (`workpads-standard/codec-sync.md`)

**Standard**: QR / URI share; ACK request flag; binary `.wpf` format.

**Implementation**: `js/screens/share.js`, `js/screens/note-share.js`
- QR code generation via `js/lib/crypto.js` + canvas
- ACK request: `ackRequest` flag toggled in share screen before encoding
- Binary `.wpf`: `encodeBinary()` → Blob download (desktop dev mode only via `js/lib/browser-dev.js`)

---

## Agreements (`workpads-standard/agreements-spec.md`)

**Standard**: `isRatified()` = chain contains ACK with `ackConfirmed: true`; amendment / dispute workflow.

**Implementation**: `js/lib/agreements.js`
- `isRatified(chainRef, records)` → boolean — wired in view ACK bar check
- `buildDisputeAmendmentOpts(parentUid, opts)` — now called from `doDispute()` in view.js; `parentUid` derived as SHA-256[0:8] of source record id
- Amendment: clones record with `_isAmendment`, `_amendedFromId`, `_originalSnap`; BASE_TEMPLATE=6 at share time
- Dispute: clones with `_isDispute`, `_disputedId`, `_parentUid` (Uint8Array), `disputeLink:true`; options overlay ⚠ label if chain already disputed

---

## Markers (`workpads-standard/markers-spec.md`)

**Standard**: `buildRatifiedFrame()` creates a State Commit codec frame stamping agreement.

**Implementation**: `js/lib/markers.js`
- `buildRatifiedFrame(opts)` — now called from `confirmCommit()` in view.js; result stored as `_ratifiedFrame` (base64) on the state_commit record for later codec emission

---

## C-TRIG Evaluator (`workpads-standard/ctrig-evaluator-spec.md`)

**Standard**: Obligation engine — evaluates trigger conditions, fires `prefillRecord()` calls.

**Implementation**: `js/lib/ctrig.js`
- Full evaluator implemented
- Calls `App.prefillRecord('state_commit', ...)` and `App.prefillRecord('dispute', ...)` — `App.prefillRecord()` now implemented in `js/app.js` ✓

---

## Anonymous Mode (`workpads-standard/anonymous-mode.md`)

**Standard**: Strip PII fields before share; anon flag on record.

**Implementation**: `js/lib/anon.js`
- `stripPII(rec)` implemented
- Wired in share screen when anon mode enabled

---

## Transaction Classification (`workpads-standard/transaction-classification.md`)

**Standard**: Income / expense / transfer / liability classification.

**Implementation**: `js/screens/financial.js`, `js/screens/ledger.js`
- Per-record classification display in financial detail view
- Ledger screen: running balance by classification

---

## KaiOS-Specific Constraints

| Constraint | Impact |
|---|---|
| ES5 only | No arrow functions, template literals, `const`/`let`, classes |
| 240×320px | All screens designed for this viewport; font sizes 9–12px |
| 5-way D-pad | Every screen has `onKey()` handler; softkey bar for primary actions |
| No `fetch` | All data is localStorage; future sync via `XMLHttpRequest` |
| No `TextEncoder` | Codec uses manual UTF-8 byte construction |
| localStorage limit | ~5MB; large record sets could hit quota |

---

## Pending / Not Yet Implemented

All major spec gaps are now closed. Known remaining items:

- ~~**`changedMask` at share time**~~ — **Done:** `RecordService.encodeUrl` diffs `_originalSnap`, builds sparse amendment payload, sets `baseTemplate: 6` and `parentUid` from `_amendedFromId` / `_disputedId`.
- ~~**`_ratifiedFrame` emission**~~ — **Done:** `RecordService.encodeUrl` passes `ratifiedFrameBytes`; `WPCodec.encode` appends `&r=<deflated>` (decoded as `_ratifiedFrameRecord`).
- **Protocol lib callers** — shell: `anon.js`, `trig.js`, `ctrig.js`, `markers.js` after `codec.js`. Off shell: `agreements.js`, `roles.js`, `formula.js`, `template-registry.js`.
- ~~**C-TRIG scheduling**~~ — **Done:** `runCtrigSchedule` after create/save/update; optional `ctrigProgram` hex string on record (demo: Meridian invoice `180B400D`).
- ~~**TRIG receive**~~ — **Done:** `applyTrigPresentation` in `decodeUrl`; presentation receive in `app.js` + `view.js` banner.
- **Stone/DID identity** — `generateMarkerUid()` exists but the app has no UI for managing a user's DID or master secret; marker UIDs are not stamped on outbound frames.
