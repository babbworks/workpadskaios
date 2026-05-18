# Workpads KaiOS — Roadmap
_Current as of 2026-05-11. See `../PRODUCTION-READINESS.md` for the detailed v0.2 implementation brief with file-level build order._

---

## v0.1.0 — Shipped ✅

Full PADS workflow on a KaiOS 3.x feature phone:
- 5 screens: list, wizard (4-step PADS), view, share, management
- 2 panels: WorkpadsPanel (ArrowLeft), PersonalPanel (ArrowRight)
- bitpad-v1 codec: fflate deflateRaw + base64url + share via URL
- D-pad navigation: Up/Down/Enter/LSK/RSK/`*`
- Onboarding: name + phone gate on first launch
- Quick notes: `*` key or CSK hold
- Contact auto-save (BlockRegistry)
- Incoming URL decode: receives workpads shared from any client

---

## v0.2.0 — Production Ready, App Store Target

The full implementation brief is at `../PRODUCTION-READINESS.md`. Summary of phases:

**Phase A — Codec → Codebook-c**
- Upgrade `js/lib/codec.js` to codebook-c (24-bit flags, template byte `0x02`, scheme tag `1eg/`)
- Add bits 16–23: record_subtype, template_locale, chain_ref, participants, geo, service_ref, expiry, verification
- Sync all codec copies + update workpads-standard
- Run codec round-trip tests

**Phase B — Activity Locale**
- Add locale fields to ActivityService: `locale`, `currency`, `tax_label`, `tax_rate`, `template_pack`
- Onboarding step 2: country/locale selection (drives currency, tax, and template pack defaults)
- Records inherit locale from active Activity; per-record currency override remains available
- `template_locale` in wire = record's actual locale (codebook-c bit 17)

**Phase C — Service Layer Sync**
- RecordService: add `chainRef` generation on create, `restoreRecord`, `removeRecord`, `getArchived`
- RecordService: expand `encodeUrl(rec, finOpts)` to include financial wire fields + codebook-c
- RecordService: expand `decodeUrl` to persist inline sub-records; fix camelCase/snake_case (DEV-WP-SUB-001)

**Phase D — Navigation Model Upgrade**
- LSK → WorkpadsPanel always (replaces screen-contextual LSK actions)
- RSK → PersonalPanel always (replaces screen-contextual RSK actions)
- Hardware Back / Backspace → all "go back" navigation
- CSK → single primary action per screen
- Full 9-key numeric shortcut map (context-sensitive); `*` shows current map

**Phase E — WorkpadsPanel Upgrade**
- Browse mode: full scrollable record list, tabbed by type (Jobs | Quotes | Invoices); ArrowUp/Down; Enter opens
- Record mode: transforms to data breakdown (financial metrics: COGS, expenses, payments, profit/margin); ArrowUp/Down scrolls
- Four-tier COGS resolution (port from workpadsdotme WorkpadsPanel.js)

**Phase F — Archive Screen**
- `js/screens/archive.js`: ArrowUp/Down focus; Enter or RSK=Restore; confirm-dialog permanent delete
- Route from management screen > Records tab

**Phase G — Financial Sub-Records in Wizard**
- Add financial step (step 4) to wizard: expense / COGS / payment sub-record entry
- D-pad adapted: sub-tabs (E/C/P), overlay mini-form, RSK=Save sub-record, LSK=Cancel
- Fix VAT value → codec enum mapping before encode (DEV-WP-VAT-001)

**Phase H — View + Panel Financial Upgrade**
- `view.js`: add financial card (expenses, COGS, payments, outstanding balance)
- `WorkpadsPanel.js`: four-tier COGS tally in Record mode

**Phase I — Financial Screens**
- `js/screens/financial.js`: per-record financial — Basic/Advanced mode; expense category breakdown; COGS split
- `js/screens/finance-overview.js`: cross-record aggregation — date filter; per-job table; Advanced mode
- Route from view.js options menu and management screen

**Phase J — List Dashboard**
- Add financial summary block to `list.js`: Revenue / Received / Gross margin for current period

**Phase K — Template System**
- Bundled core: ~20 template types (job, quote, invoice, delivery note, inspection, survey, timesheet, purchase order, site report, etc.)
- Templates configure field labels and hidden fields within the PADS wizard
- Extensible registry: `wp_template_<id>` in localStorage
- Authoring paths: CSV paste (primary for on-device), JSON import (for developers/SIMBA), SIMBA injection
- CSV format: line 1 = `id, Label, locale`; line 2+ = `Field Label, Field:type, ...`; type defaults to `text`
- Management screen > Templates tab for browsing and adding templates

**Phase L — App Store Packaging**
- Generate icons: 56×56, 112×112, 128×128 PNG
- Update `manifest.webmanifest`: icons array, `clipboard-write` permission, version `0.2.0`
- Add `package` npm script: zip excluding `node_modules/`, `browser-dev.js`, `.git/`
- Verify packaged app in KaiOS simulator

**Phase M — Polish**
- Fix stale codec labels in share.js (DEV-WP-URL-001)
- Storage quota warning in management.js (threshold alert at ~80% of 5MB)
- Confirm all DEV-WP-* deviations resolved or formally accepted

---

## v0.3.0 — Chain Protocol + Participants

Uses codebook-c bits 18–20, specified in `workpads-standard/chain-protocol.md` and `participants-block.md`:

- **Linked records** (bit 18 `chain_ref`): chainRef ACK mechanism — quote links to invoice links to payment; full job lifecycle in a chain
- **Participants block** (bit 19 `participants`): typed party list replacing bare `worker` text — crew members, witnesses, customer representatives, subcontractors
- **Multi-worker pre-seeding**: a record can carry a participant list before the work begins; each party adds their contribution
- **Geo field** (bit 20 `geo`): geohash or lat/lon embedded in wire; receiver page can render a map pin; delivery confirmation by location

---

## v0.4.0 — SIMBA Services Layer

Uses codebook-c bits 21–23:

- **`service_ref`** (bit 21): on-device and external services enriching records; service identity in wire format so receivers know provenance
- On-device service registry: SIMBA connector model — services register capabilities; Workpads routes record events to registered services
- **Expiry** (bit 22): validity window for quotes and tenders — date after which a quote lapses
- **Verification** (bit 23): acknowledgement state (`draft → shared → acknowledged → disputed`); foundation for trust layer before full crypto signing
- workpads:// URL scheme handler for SIMBA service launches with pre-filled wizard data

---

## v1.0.0 — Global Readiness

- KaiOS 2.5 support (broader device reach — lower-spec hardware, older Gecko)
- Multi-currency financial aggregation using Activity locale
- Contacts screen (BlockRegistry UI — browse, edit, launch record from contact)
- Export: PDF / CSV from financial screens
- Regional template library: NG, KE, ZA, GB, IN, PH packs (country-specific field labels, tax schemes, template bundles)
- 100+ template types milestone
- Full codec round-trip conformance test suite

---

## Post-v1 — Platform Expansion

The two-build strategy (`workpads-standard/build-strategy.md`) means the service layer (StorageAdapter, ActivityService, RecordService, PersonalService, BlockRegistry) is already cross-platform compatible — it is pure localStorage + vanilla JS with no platform dependencies.

Android and iOS ports reuse the service layer verbatim. Each platform gets a platform-native UI shell. All platforms speak codebook-c wire format — a record created on a Nokia feature phone in Lagos carries full template identity, locale, geo, and participant data when opened on an iPhone in London.
