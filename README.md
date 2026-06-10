# Workpads KaiOS

Workpads mobile application for KaiOS 3.x devices. Creates, views, and shares portable job records from a feature phone using the PADS model and **pads-v1** binary codec.

**Version:** v0.2.0  
**Target platform:** KaiOS 3.x (240×320px, 5-way D-pad, packaged app)  
**Codec:** pads-v1 (`#1pa/`) + fflate deflate + base64url; legacy decode for older URLs  
**Share format:** `https://workpads.me/p#1pa/<payload>`

**Cross-repo process:** [`system/project-process.md`](system/project-process.md) — read before planning or coding across workpads-standard, workpads-codec, workpads-cli, and this app.

**Development-only:** `node_modules/` holds `@workpads/codec` for `npm test` — not packaged on device. The phone uses `js/lib/codec.js`. See [`system/dev_refs/JS-RUNTIME-MAP.md`](system/dev_refs/JS-RUNTIME-MAP.md).

---

## What It Does

Workpads KaiOS lets a field worker — on a KaiOS feature phone with no touch screen — create a structured job record, fill in process details and actions step-by-step, and share the record as a compact URL. The URL can be opened on any device running a Workpads client (browser, CLI, or another phone).

Records use the **PADS model** (Process / Actions / Details / Story), a four-section structure for field service work. A record encodes to under 300 characters for a typical job — short enough to share via SMS.

---

## Architecture

The app runs entirely in a single HTML file with no build step. All logic is plain JavaScript (ES5-compatible for KaiOS 2.x forward-compatibility), loaded via `<script>` tags in dependency order.

### Two-Engine Design

The app is split into two conceptual engines:

**Exchange Engine** — handles job records and sharing:
- `RecordService` — CRUD, archive, URL encode/decode for workpad records
- `ActivityService` — business profile (sender identity: name + phone)
- `BlockRegistry` — contact store, auto-populated from customer+phone fields

**Learning Engine** — handles personal capture and context:
- `PersonalService` — quick notes and personal captures
- `PersonalPanel` — ArrowRight overlay for browsing captures

### Service Layer (`js/`)

| File | Exposes | Purpose |
|------|---------|---------|
| `StorageAdapter.js` | `StorageAdapter(prefix)` | Prefix-scoped localStorage wrapper with Promise interface |
| `ActivityService.js` | `window.ActivityService` | Business profile: create, update, get active sender identity |
| `RecordService.js` | `window.RecordService` | Record CRUD, archive, URL encode/decode via WPCodec |
| `PersonalService.js` | `window.PersonalService` | Quick note capture and retrieval |
| `BlockRegistry.js` | `window.BlockRegistry` | Contact lookup and storage (wp_block_ prefix) |

### Screen Layer (`js/screens/`)

Core screens (see `app.js` `SCREENS` for the full set of 22+):

| Screen | Purpose |
|--------|---------|
| `list.js` / `home.js` | Record list or WP+ home |
| `wizard.js` | PADS + financial wizard |
| `view.js` | Record detail, options, chain, ACK, state commit |
| `share.js` / `note-share.js` | Encode URL, QR, presentation/security tags |
| `management.js` | Profile, settings, storage |
| `archive.js` | Archived records — restore / delete |
| `financial.js` / `finance-overview.js` | Per-record and cross-record financial views |
| `ledger.js` / `liabilities.js` | Ledger and liabilities |
| `chain.js` / `dispute.js` | Chain view and dispute flow |
| `newent-wizard.js` / `template-creator.js` | NewEnt and template authoring |
| `timeline.js` / `tasks.js` / `calendar-wp.js` | Scheduling surfaces |

### Panel Layer (`js/panels/`)

| Panel | Trigger | Purpose |
|-------|---------|---------|
| `WorkpadsPanel.js` | ArrowLeft | Slide-in overlay listing recent records in context |
| `PersonalPanel.js` | ArrowRight | Slide-in overlay listing recent quick notes |

### Codec Layer (`js/lib/`)

| File | Purpose |
|------|---------|
| `fflate.js` | fflate 0.8.2 (MIT) — deflate/inflate, UMD bundle |
| `codec.js` | `window.WPCodec` — pads-v1 `#1pa/` encode/decode; legacy schemes decode-only |
| `security.js` / `anon.js` / `agreements.js` / `markers.js` / `ctrig.js` | Extended pads-v1 features |
| `browser-dev.js` | D-pad keyboard emulator for browser testing (not for device) |

### App Router (`js/app.js`)

Central screen router and key dispatcher. Responsibilities:
- Screen transitions (`showList`, `showWizard`, `showView`, `showShare`, `showManagement`)
- D-pad key routing to active screen handler
- Panel open/close gates (suppressed on management screen, when input is focused, or when any overlay is open)
- Quick Note overlay (`*` key or CSK long-press ~800ms)
- Onboarding gate (first-launch name+phone prompt if no Activity Profile exists)
- Incoming URL handling (decodes workpad from URL hash on load)

---

## PADS Wizard

The 4-step creation wizard maps directly to the PADS sections:

| Step | Tab | Fields |
|------|-----|--------|
| 0 — Process | P | `job` (required), `customer`, `date` |
| 1 — Actions | A | `actions[]` — add/list step items |
| 2 — Details | D | `worker`, `location`, `customer_phone`, `start_time`, `end_time`, `meeting_time` |
| 3 — Story | S | `story`, `details` |

Navigation: Enter/CSK advances through steps. RSK=Save at any step. LSK=Back (or Cancel on step 0). Auto-save runs between steps.

The `worker` field pre-fills from the Activity Profile (sender identity) if not already set on the record.

---

## bitpad-v1 Codec

The binary encoding format used for all share links.

### Frame Structure

```
[template_byte][flag_byte_1][flag_byte_2][field_blobs...]
```

- **Byte 0:** Template identifier. `0x01` = `svc-basic`.
- **Bytes 1-2:** Presence flags — one bit per field in a fixed field order. A field blob is only written if its bit is set.
- **Remaining bytes:** Length-prefixed UTF-8 blobs, one per present field, in fixed order.

### Field Order (svc-basic, bitpad-v1)

```
job | customer | date | location | start_time | end_time |
meeting_time | customer_phone | worker | details | story | actions
```

Actions are encoded as a length-prefixed sequence: `[count_byte][title_blob][notes_blob]...`

### Compression and URL Encoding

1. Assemble binary frame
2. Compress with fflate `deflateRaw`
3. Encode as base64url (URL-safe alphabet, no padding)
4. Append as URL hash: `https://workpads.me/p#alg=bitpad-v1&v=1&d=<base64url>`

The `alg=bitpad-v1` query param in the hash fragment is used by the receiver to detect and route incoming workpad URLs.

### Validation

`WPCodec.validate(record)` checks:
- `job` field is present and non-empty
- All field values are strings (or undefined)
- Actions array items have a `title` string

---

## Storage

All data is stored in `localStorage` using prefix-scoped keys via `StorageAdapter`:

| Prefix | Content |
|--------|---------|
| `wp_rec_` | Active workpad records (JSON) |
| `wp_arc_` | Archived records (JSON) |
| `wp_act_` | Activity profiles (business identity) |
| `wp_per_` | Personal notes/captures |
| `wp_block_` | Block Registry contacts |

`StorageAdapter` provides: `get`, `set`, `remove`, `list`, `count` — all returning Promises for consistent async interface even though localStorage is synchronous.

---

## Navigation Model

The app is entirely D-pad driven. No touch events are used.

| Key | Context | Action |
|-----|---------|--------|
| ArrowUp/Down | List screens | Move focus between items |
| ArrowLeft | Any screen (not input, not overlay) | Open Workpads Panel |
| ArrowRight | Any screen (not input, not overlay) | Open Personal Panel |
| Enter / CSK | Varies | Confirm, advance, open record |
| SoftLeft | Varies | Back, Cancel, Close panel |
| SoftRight | Varies | Save, Options, tab-specific action |
| Backspace | Varies | Back (same as SoftLeft in most screens) |
| `*` | Any (no overlay open) | Open Quick Note |
| Enter (hold ~800ms) | Not in input, no overlay | Open Quick Note |

Panels are suppressed on the management screen. When any overlay (options menu, quick note) is open, panel triggers and quick note shortcuts are disabled.

---

## Screens in Detail

### List Screen
- Shows all active records, newest first
- Subtitle shows customer + date, with `Received` tag if the record arrived via URL
- LSK=Manage (opens management screen), RSK=New (opens PADS wizard)
- Enter opens the focused record in view screen

### View Screen
- Displays all non-empty fields in `view-field` rows
- RSK=Options opens the overlay menu (Share / Edit / Archive)
- Enter opens wizard to edit the record
- SoftLeft/Backspace returns to list

### Options Menu
- Rendered as an overlay (z-index 200) on top of the view screen
- Items: Share record / Edit record / Archive record
- Archive uses `confirm()` then calls `RecordService.archive()` and returns to list
- ArrowUp/Down navigate, Enter selects, SoftLeft/Backspace closes

### Share Screen
- Displays the encoded URL (without the `https://` prefix in the display, with it in the clipboard copy)
- Shows encoded length in characters
- Enter / CSK copies the full URL to clipboard
- Shows `Copied!` feedback for 2 seconds
- Displays codec attribution: `Workpads v0.1.0 · bitpad-v1 codec`

### Management Screen (3 tabs)
- **Records:** Active count (sent/received), archived count, Block Registry contact count, storage usage, codec version
- **Personal:** Quick note count; export coming in v0.2
- **Settings:** Editable name + phone fields from Activity Profile; RSK=Save persists changes
- Tab navigation: ArrowLeft/ArrowRight

### Onboarding Screen
- Shown on first launch (when no Activity Profile exists)
- Name (required) + Phone/WhatsApp (optional)
- CSK or Enter submits; creates Activity Profile and shows list

---

## Receiving Workpads

When the app loads with a URL hash containing `alg=`, it attempts to decode it as a workpad. On success it stores the record with a `receivedAt` timestamp and opens it in the view screen. The record appears in the list tagged as `Received`.

---

## Block Registry

When a record is saved with both `customer` and `customer_phone` fields set, the customer is automatically saved to the Block Registry. This creates a local contact store keyed by normalised customer name (lowercase, spaces-to-underscores). Used for future autocomplete and contact lookup features.

---

## Branch Strategy

This repo houses all KaiOS versions of the Workpads app:

| Branch | Content |
|--------|---------|
| `main` | Latest development |
| `v0.1` | Workpads KaiOS v0.1.0 — initial release |

Each major version gets its own branch so older versions remain accessible and the app files for each generation are preserved.

---

## File Structure

```
workpadskaios/
  index.html                  App shell + all screens + overlays
  manifest.webmanifest        KaiOS app manifest
  css/
    app.css                   All styles (dark theme, KaiOS 240x320)
  js/
    StorageAdapter.js         localStorage wrapper
    ActivityService.js        Business profile service
    RecordService.js          Record CRUD + URL encode/decode
    PersonalService.js        Quick note capture
    BlockRegistry.js          Contact store
    screens/
      list.js                 Record list screen
      wizard.js               PADS creation/edit wizard
      view.js                 Record view + options menu
      share.js                Share URL display + copy
      management.js           Records/Personal/Settings tabs
    panels/
      WorkpadsPanel.js        ArrowLeft overlay
      PersonalPanel.js        ArrowRight overlay
    app.js                    Router + D-pad dispatcher + boot
    lib/
      fflate.js               Compression library (fflate 0.8.2)
      codec.js                WPCodec — pads-v1 browser codec
  system/
    project-process.md        Cross-repo process (read first)
      browser-dev.js          D-pad emulator for browser testing
  test/
    flow.test.js              Node.js round-trip codec tests
  package.json                Dev dependencies (codec test runner)
```

---

## Testing

Run codec round-trip tests (Node.js):

```bash
npm install
npm test
```

For UI testing on desktop: open `index.html` in a browser. `browser-dev.js` maps arrow keys and provides on-screen D-pad buttons. This file is excluded from device builds.

---

## Related Repos

| Repo | Description |
|------|-------------|
| `workpads-standard/` | Normative spec — pads-v1 `codec.md` |
| `workpads-codec/` | `@workpads/codec` — npm pads-v1 encoder (CLI dependency) |
| `workpads-cli/` | CLI v0.2 — create/share via `@workpads/codec` |
| `system/project-process.md` | Cross-repo workflow and project state |
