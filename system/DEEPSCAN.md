# WORKPADS KAIOS — DEEP SCAN ASSESSMENT
_Updated: 2026-05-14_

---

## 1. FOLDER & FILE STRUCTURE

```
workpadskaios/
├── index.html                          Main app shell (303 lines)
├── homescreen.html                     (empty)
├── manifest.webmanifest                KaiOS app manifest
├── package.json                        v0.1.0
├── softkeys.yaml                       Soft key configuration
├── PRODUCTION-READINESS.md             Build planning & feature gaps
├── README.md                           Full architecture documentation
├── css/
│   └── app.css                         Dark theme, KaiOS 240×320
├── js/
│   ├── app.js                          Router, D-pad dispatcher, app boot
│   ├── StorageAdapter.js               localStorage wrapper (Promise interface)
│   ├── ActivityService.js              Business profile (name, phone, locale)
│   ├── RecordService.js                Record CRUD + URL encode/decode
│   ├── PersonalService.js              Quick note capture service
│   ├── BlockRegistry.js                Contact store (name + phone)
│   ├── TemplateRegistry.js             Template manifest + render engine
│   ├── NoteCodec.js                    Note share URL codec
│   ├── FinancialModel.js               Financial calculations & COGS resolution
│   ├── WorkActivityService.js          Named work activities grouping
│   ├── NewEntTemplate.js               Business entity creation template
│   ├── lib/
│   │   ├── codec.js                    WPCodec — codebook-c-kaios (1eg/)
│   │   ├── fflate.js                   fflate 0.8.2 compression library
│   │   ├── countries.js                Country/locale data
│   │   ├── demo.js                     Demo seed data
│   │   └── browser-dev.js              D-pad emulator for desktop testing
│   ├── panels/
│   │   ├── WorkpadsPanel.js            LSK overlay — browse/record/management modes
│   │   └── PersonalPanel.js            RSK overlay — quick notes
│   └── screens/
│       ├── list.js                     Record list (main dashboard)
│       ├── wizard.js                   PADS creation/edit (4-5 steps)
│       ├── view.js                     Record detail (read-only + options)
│       ├── share.js                    Share URL display + copy
│       ├── management.js               Settings & stats (4 tabs)
│       ├── note-share.js               Share personal capture
│       ├── country.js                  Country selector (onboarding)
│       ├── newent-wizard.js            Business entity creation
│       └── ledger.js                   Expense/COGS/payment entry
├── test/
│   ├── flow.test.js                    Codec round-trip tests (Node.js)
│   └── codec-c.test.js                 Codec validation tests
├── workpads-templates/
│   ├── newpad.md                       (empty)
│   ├── newpad.xml                      Template manifest
│   └── newent-business.md              Business template
└── system/
    ├── PLATFORM.md                     KaiOS constraints & nav model
    ├── CODEC-SYNC.md                   Codec sync requirements
    ├── DEEPSCAN.md                     (this file)
    ├── DEVIATIONS.md                   Known divergences from standard
    ├── ECOSYSTEM.md                    Related repos & dependencies
    ├── ROADMAP.md                      Feature roadmap
    ├── VISION.md                       Product vision
    ├── README.md                       System guide
    └── panel-browse-prototype.html     Prototype mockup
```

---

## 2. ARCHITECTURE

### Two-Engine Design

1. **Exchange Engine** — Job records and sharing
   - `RecordService` — CRUD, archive, URL encode/decode
   - `ActivityService` — Business profile (name + phone + locale + currency + tax)
   - `BlockRegistry` — Contact store from customer+phone fields

2. **Learning Engine** — Personal context and quick capture
   - `PersonalService` — Quick note capture with tags and linked-record references
   - `PersonalPanel` — RSK overlay for browsing captures

### Runtime Boot Flow

```
index.html (single file, no build step)
    ↓
[Dependency load order via <script> tags]
  1. fflate.js          (compression)
  2. codec.js           (WPCodec - codebook-c-kaios 1eg/)
  3. TemplateRegistry.js, NoteCodec.js
  4. StorageAdapter.js
  5. ActivityService.js, WorkActivityService.js
  6. RecordService.js, FinancialModel.js
  7. PersonalService.js, BlockRegistry.js
  8. [all screens]
  9. [all panels]
  10. app.js (router + boot)
  11. browser-dev.js (dev only)
    ↓
app.js checks ActivityService.hasAny()
    ↓ YES → showList()
    ↓ NO  → showOnboarding()
    ↓
App.checkIncomingUrl() decodes hash if present
```

### Module Dependency Graph

```
fflate.js
    ↓
codec.js (depends on fflate)
TemplateRegistry.js, NoteCodec.js (depend on fflate)
    ↓
StorageAdapter.js (no dependencies)
    ↓
ActivityService.js, RecordService.js, PersonalService.js,
BlockRegistry.js, WorkActivityService.js (all depend on StorageAdapter)
    ↓
FinancialModel.js (no storage dependency)
    ↓
[All screens & panels]
    ↓
app.js (boots last)
    ↓
browser-dev.js (dev only)
```

### Data Models

**Main Record:**
```
{ id, chainRef, recordType/record_type,
  job, customer, date, location,
  start_time, end_time, meeting_time, customer_phone,
  worker, actions[{title, notes}],
  amount, currency, vat, charge_type,
  details, story,
  draft, createdAt, updatedAt,
  receivedAt?, archivedAt?, activityId?, parentId? }
```

**Sub-Record (expense/COGS/payment):**
```
{ id, parentId, recordType:'expense'|'cogs'|'payment',
  job, amount, currency, date,
  expense_billing?, charge_type?, actionIdx?,
  linkedExpenseId?, action_quoted? }
```

**Personal Capture:**
```
{ id, text, timestamp, archived, tags[], source, linkedRecordId? }
```

**Activity Profile:**
```
{ id, name, phone, type, locale, currency, tax_label, tax_rate,
  isBusiness, vatRegistered, vatNumber, whatsapp_confirmed }
```

### Storage Namespaces

| Key Pattern | Owner | Content |
|---|---|---|
| `wp_record_*` | RecordService | Active records |
| `wp_archive_*` | RecordService | Archived records |
| `wp_wact_*` | WorkActivityService | Work activities |
| `wp_act_*` | ActivityService | Business profile |
| `wp_personal_*` | PersonalService | Quick notes |
| `wp_archive_p_*` | PersonalService | Archived notes |
| `wp_block_*` | BlockRegistry | Contacts |
| `wp_tpl_manifest` | TemplateRegistry | Template index |
| `wp_tpl_payload_*` | TemplateRegistry | Template payloads |
| `wp_tpl_refusals` | TemplateRegistry | User refusals |

---

## 3. CODEC SYSTEM

`js/lib/codec.js` implements **WPCodec** (`1eg/`, codebook-c-kaios, template 0x02, 24-bit flags).

**Binary frame structure:**
```
[0x02][flagsHigh][flagsMid][flagsLow]
Bits 0–11:  PADS scalar fields
            job | customer | date(u16) | location | meeting_time |
            start_time | end_time | customer_phone | worker | actions(seq) |
            details | story
Bit 12:     FIN block (record_type enum, currency enum, vat enum,
            amount u32, expenses[], payments[])
Bits 13–15: reserved
Bits 16–23: Extended (subtype, locale, chainRef, participants,
            geo, serviceRef, expiry, verification)
```

**Encoding pipeline:** record object → flag bytes → field blobs → fflate.deflateRaw → base64url → `workpads.me/p#1eg/{fragment}`

**Legacy decode support:** `1ag/`, `1bg/`, `1cg/`, `1dg/` (template 0x01, 16-bit flags)

**Current gap:** The FIN block encoding exists in codec.js and decodes correctly, but `RecordService.encodeUrl()` never passes financial fields to it.

**Sync obligation:** `codec.js` must stay aligned with `workpadsdotme/js/lib/codec.js`, `workpads-standard/codec.md`, and the `workpads-codec` npm package. See `system/CODEC-SYNC.md`.

### Codec Bit Layout

| Bit | Field | Status |
|---|---|---|
| 0 | job | scalar |
| 1 | customer | scalar |
| 2 | date (u16) | special encoding |
| 3 | location | scalar |
| 4 | meeting_time | scalar |
| 5 | start_time | scalar |
| 6 | end_time | scalar |
| 7 | customer_phone | scalar |
| 8 | worker | scalar |
| 9 | actions | sequence |
| 10 | details | scalar |
| 11 | story | scalar |
| 12 | FIN block | sub-frame |
| 13–15 | reserved | — |
| 16 | subtype | extended |
| 17 | locale | extended |
| 18 | chainRef | extended (3 bytes) |
| 19 | participants | extended sequence |
| 20 | geo | extended |
| 21 | serviceRef | extended |
| 22 | expiry | extended (u16) |
| 23 | verification | extended (u8) |

---

## 4. TEMPLATE SYSTEM

`TemplateRegistry.js` — template manifest store + render engine.

**Three schemas:**
- **Schema A** — single HTML string, Mustache-like `{{var}}` / `{{#block}}` / `{{^block}}`
- **Schema B** — named slots with shared CSS
- **Schema P** — ordered independent sections (presentations/formal docs)

**Built-in default:** `urn:workpads:tpl:note:default:v1` (Schema A, permanent, ships in app)

### Codec ↔ Template Connection

| Layer | Codec (WPCodec / NoteCodec) | Template (TemplateRegistry) |
|---|---|---|
| Job records | Binary encoding → share URL | Not yet used for rendering |
| Notes | NoteCodec → note URL | TemplateRegistry.render() → display |
| Transport | fflate compression | fflate compression (same lib) |
| Template payloads | Template can be encoded into URL via encode()/compress() | — |

**The emerging integration:** `TemplateRegistry.encode()` + `compress()` allows a template itself to be embedded in a shared URL — records could carry their rendering template. Phase 2 of `detectOnPage()`. The path exists in `TemplateRegistry` but is not yet wired into `RecordService.decodeUrl()` or the share flow.

`NewEntTemplate.js` contains industry/audience frameworks — the beginnings of domain-specific templates. Not yet integrated with `TemplateRegistry` or the codec flow.

---

## 5. COMPLETENESS ASSESSMENT

| Feature | Status | Notes |
|---|---|---|
| App router + D-pad dispatcher | ✅ Full | |
| StorageAdapter | ✅ Full | |
| ActivityService (profile, locale) | ✅ Full | |
| PersonalService + PersonalPanel | ✅ Full | |
| BlockRegistry | ✅ Full | |
| NoteCodec | ✅ Full | |
| FinancialModel (four-tier COGS) | ✅ Logic | No UI surface |
| Wizard — PADS 4 steps | ✅ Core | No financial step |
| View, Share, List screens | ✅ Skeleton | No financial card |
| Onboarding, Country selector | ✅ Full | |
| Management screen (4 tabs) | ✅ Shell | Activities tab incomplete |
| Ledger screen | ✅ Implemented | Standalone only |
| WorkpadsPanel + PersonalPanel | ✅ Structure | No financial tally |
| RecordService.encodeUrl() financial fields | ❌ Missing | FIN block never called |
| RecordService.decodeUrl() sub-record persistence | ❌ Missing | Sub-records decoded but dropped |
| chainRef generation on create | ❌ Missing | |
| restoreRecord() / removeRecord() | ❌ Missing | |
| Archive screen | ❌ Missing | Service exists, no UI |
| Wizard financial step | ❌ Missing | |
| View financial card | ❌ Missing | |
| WorkpadsPanel financial tally | ❌ Missing | |
| List monthly summary | ❌ Missing | |
| financial.js per-record screen | ❌ Missing | |
| finance-overview.js dashboard | ❌ Missing | |
| App store icons | ❌ Missing | Icons array empty |

---

## 6. PRIORITY GAPS

**Priority 1 — Data integrity (service layer):**
- Wire financial fields into `RecordService.encodeUrl()` (amount, currency, vat, record_type)
- Persist inline expense/payment sub-records on `decodeUrl()`
- Add `chainRef` generation on record create
- Add `restoreRecord()` and `removeRecord()` (hard-delete)

**Priority 2 — Archive screen:**
- Create `js/screens/archive.js`
- Route from management Records tab
- Enter=open/restore, RSK=delete (confirm), LSK=back

**Priority 3 — Financial sub-records in wizard + display:**
- Wizard: expense/COGS/payment entry steps, VAT enum mapping
- View: financial card (price, tax, total, paid, outstanding, margin)
- WorkpadsPanel: four-tier COGS tally in record mode
- List: monthly revenue/margin summary block

**Priority 4 — Missing screens:**
- `financial.js` — per-record detail, Basic/Advanced modes
- `finance-overview.js` — cross-record date filter + per-job table

**Priority 5 — App store packaging:**
- Generate 56×112×128px PNG icons, update manifest, bump to 0.2.0, add package script

**Priority 6 — Known bugs:**
- `recordType` vs `record_type` mismatch in sub-record filters (view.js)
- VAT UI value not mapped to codec enum before encode
- Share screen shows stale codec label `1cg` (encoder emits `1eg`)
- Storage quota warning at 80% threshold missing

---

## 7. KEY ARCHITECTURAL CONSIDERATIONS

1. **Financial block wiring is the most urgent gap.** Codec, FinancialModel, and RecordService all have the logic. The screens just need to be connected.

2. **Template-codec integration is the next frontier.** Templates traveling with records (embedded in URLs) is planned for Phase 2 — `TemplateRegistry.detectOnPage()` and `ingestEncoded()` need to be wired into `decodeUrl()`.

3. **`WorkActivityService` is fully implemented but invisible** — never called from any screen. Management activities tab is a shell.

4. **ES5 constraint is real.** No arrow functions, template literals, destructuring, `const`/`let` in any new code.

5. **Codec sync is a standing obligation.** Any field order or flag bit changes must be reflected in dotme app and npm package simultaneously.
