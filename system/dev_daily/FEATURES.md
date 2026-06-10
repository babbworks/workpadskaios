# Feature Status Register

**Purpose:** Track every named feature by its current status — Active (live in UI), Latent (designed and specced but not activated), Pending (decided, not yet designed/built), Backlog (ideas not yet decided).  
**Cross-reference:** [`DEVELOPMENT-PLAN.md`](DEVELOPMENT-PLAN.md) (phase audit), [`dev_refs/JS-RUNTIME-MAP.md`](../dev_refs/JS-RUNTIME-MAP.md) (file ↔ runtime), [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md), [`dev_refs/FRAME-SPEC.md`](../dev_refs/FRAME-SPEC.md)  
**As of:** 2026-05-21 (js/ folder audit)

---

## How to use this doc

| Status | Meaning |
|--------|---------|
| **Active** | Live in the KaiOS app shell (`index.html` scripts) |
| **Active (codec)** | Encode/decode in `js/lib/codec.js`; may lack full UI |
| **Active (lib)** | Loaded in `index.html`; UI may still be partial — see JS-RUNTIME-MAP |
| **Partial** | Subset shipped; spec remainder pending |
| **Latent** | Designed/specced; minimal or no UI |
| **Pending** | Not implemented in app |
| **Backlog** | Idea only |

Each entry: name, one-line description, relevant OQ/decision refs, notes.

---

## KaiOS application (v0.2.0)

*Shipped UI and services — audit 2026-05-21. Screens match `app.js` `SCREENS`.*

### Core PADS workflow
**Status: Active**  
List, wizard (PADS + financial step), view (options, financial card, chain, ACK, state commit, amendment, dispute), share (`1pa`/`1pb`/`1ps`), management (records/personal/settings/templates), archive, onboarding, country/locale.

### Panels and capture
**Status: Active**  
WorkpadsPanel (browse/record/wizard modes, COGS tiers), PersonalPanel, quick note overlay.

### Financial
**Status: Active**  
`financial.js` (per-record), `finance-overview.js` (portfolio; All/Month/Week), `ledger.js`, `liabilities.js`, list summary bar → finance overview.

### Chain and agreements (app layer)
**Status: Active**  
`chain.js`, state_commit + ACK + amendment/dispute in `view.js`. Ratified frame: `view.js` stamps `_ratifiedFrame`; share emits `&r=` suffix via `RecordService.encodeUrl` + `WPCodec`.

### My Templates and NewEnt
**Status: Active (partial library)**  
**My Templates:** `RecordTemplateService` — **Personal** (created on device), **Imported** (`importedAt`), **awaiting import** (`receivedAt` only; review list from Imported tab). Management **My Templates** tab; list picker Personal / Imported.  
**Presentation templates:** `TemplateRegistry.js` (notes, `#t/` — not My Templates).  
External template URL → `receiveExternal()`: **Pending** wire. Bundled presentation library: **Pending** (Phase K).

### Extended surfaces (beyond original v0.1)
**Status: Active**  
`home`, `help`, `user-switcher`, `timeline`, `tasks`, `calendar-wp`, `note-share`.

### List dashboard (time windows)
**Status: Partial**  
Summary bar on `list.js`; full 14-window `wp_dash_window` spec not implemented (Phase J).

### Store packaging
**Status: Partial**  
Manifest v0.2, SVG icons, clipboard permissions. PNG store icons + device verification: **Pending** (Phase L).

### Work activities (record grouping)
**Status: Active**  
`WorkActivityService.js`; filter on `list.js` and `WorkpadsPanel.js`; `activityId` on records in `wizard.js`.

### User / activity profile switcher
**Status: Active**  
`user-switcher.js` — multiple `ActivityService` profiles.

### Contact browser (list)
**Status: Active**  
`list.js` contact sub-screen — categories, search, new contact.

### Ledger and liabilities (per contact)
**Status: Active**  
`ledger.js`, `liabilities.js` from contact panel quick actions.

### Focus mode (list)
**Status: Active**  
`list.js` — `wp_focus_mode` hides chain derivative types in main list.

### Protocol libs (shell)
**Status: Active (lib)**  
`anon.js`, `trig.js`, `ctrig.js`, `markers.js` — in shell after `codec.js`. **Deferred off shell:** `agreements.js`, `roles.js`, `formula.js`, `template-registry.js`. Anon share via `WPAnon`. C-TRIG: `ctrigProgram` on record + `runCtrigSchedule` after save. TRIG: `applyTrigPresentation` on decode.

### Implementation gaps (codec/UI, not separate features)
**Status: Pending**  
[`IMPLEMENTATION.md`](../../IMPLEMENTATION.md) for remaining agreement UI. **`changedMask` at share:** done in `RecordService.encodeUrl` (`_originalSnap` diff).

---

## Security & Scrambling

### URL key hint
**Status: Latent**  
A 6-character suffix appended to scrambled URLs (`1ps`/`1ph`/`1pt`), derived from the key. Helps receiver identify which code to use without revealing the code. Cryptographically unlinkable to the passphrase — safe to display.  
**Ref:** OQ-14b  
**Wire:** `workpads.me/p#1ph/<salt>.<hint>.<payload>` — hint = first 4 chars of `base64url(HMAC-SHA256(master_key, "hint"))`  
**Note:** Spec is complete. Not surfaced in the share sheet or code-entry UI until UX is designed for it. Activate when share sheet UI iteration begins.

---

### Derived passphrase system (master secret + PIN)
**Status: Pending**  
Per-contact scramble codes are derived from a single master secret, never stored directly. PIN encrypts/decrypts the master secret at rest. Changing the PIN re-encrypts the master secret without affecting any derived codes. Historical records always decodeable by re-deriving with the correct period counter.

**Design:**
```
master_secret = 32 random bytes, generated once on install
PIN           = encrypts master_secret at rest (AES-256)

passphrase_for(contact_id, period) =
    base36(HMAC-SHA256(master_secret, contact_id || uint8(period)))[0:6]
    → 6-char human-readable code ("plum42")

"Change code"   = increment period counter for that contact (stored locally, unencrypted)
Historical decode = try period=current, current-1, ... 0; commitment check confirms match
PIN change      = decrypt master_secret with old PIN, re-encrypt with new PIN; all derivations intact
```

**Recovery kit:** On first setup, app generates master_secret and prompts user to export a recovery QR (encrypted under PIN). Scanning on a new device restores all derived codes. Recovery QR is the "non-scrubbable" artifact — user owns it, app cannot regenerate it without it.

**Storage:** `master_secret_encrypted` stored in a dedicated IndexedDB store outside the main app data. App warns prominently before any data clear that this store will be affected. Recovery QR export is the primary protection against data loss.

**Global vs per-contact:** Both supported from the same system. A "global default code" = `passphrase_for("__global__", period)`. Per-contact codes override the global default for that contact. Worker sets the global code once; can set per-contact codes for high-value contacts.

**Ref:** OQ-14d  
**Note:** Requires UI for: PIN setup, recovery QR export, code display per contact, "change code" action, code-entry prompt for new scrambled records.

---

### Partial encryption (`1ph` tag)
**Status: Pending**  
Header bytes (meta1, meta2, setup_byte, transaction_byte) left unencrypted; field data and financial block scrambled + encrypted. Receiver sees record type and direction before entering the code.  
**Ref:** OQ-14a  
**Note:** Requires share sheet toggle: "Protect" (1ps full) vs "Protect lightly" (1ph partial).

---

### Full encryption (`1ps` tag)
**Status: Active (share path)** / **Pending (auto-enforce rules)**  
Share screen supports `#1ps/` with passphrase (`share.js`, `RecordService.encodeUrl`). Automatic enforce by recipient/expense category: **Pending**.  
**Ref:** OQ-14

---

### Template-keyed records (`1pt` tag)
**Status: Pending**  
Shared template content is the encryption key — template hash replaces passphrase. Template ID advertised plainly in URL; meaningless without the template content. Two-factor variant adds a passphrase on top.  
**Ref:** OQ-14g, OQ-15, OQ-19

---

### Chain ratchet
**Status: Backlog**  
For chained record sequences (quote → invoice → payment), each record's key derives from the previous. Intercepting record N is useless without having decoded N-1. Opt-in per chain.  
**Ref:** OQ-14i  
**Note:** Useful for confidential job progressions; adds decoding dependency. Deferred post-MVP.

---

### Honey record (decoy payload)
**Status: Backlog**  
A pre-authored decoy record appended inside the encrypted payload. Brute-force attackers find the decoy first and have no signal they found the wrong thing. Adds ~30 bytes.  
**Ref:** OQ-14j  
**Note:** Opt-in for high-sensitivity records. Post-MVP.

---

## Records & Codec

### pads-v1 codec (`1pa` tag)
**Status: Active**  
`js/lib/codec.js` encode `#1pa/`; legacy decode; 646 tests in `codec-pads-v1.test.js`; npm interop via `flow.test.js`.  
**Ref:** FRAME-SPEC.md, `project-process.md` §7

---

### Compound records (multi-line)
**Status: Active (codec)** / **Partial (UI)**  
Encoder/decoder in `codec.js`; wizard/financial UI coverage varies by record type.  
**Ref:** FRAME-SPEC.md §8, D25

---

### Amendment records (`BASE_TEMPLATE=110`)
**Status: Active**  
Amendment clone from `view.js`; `RecordService.encodeUrl` diffs `_originalSnap` and encodes BASE_TEMPLATE=6 with sparse fields + `parentUid`.  
**Ref:** FRAME-SPEC.md §10, IMPLEMENTATION.md

---

### State Commit records (`BASE_TEMPLATE=101`)
**Status: Active**  
`view.js` confirmCommit; `markers.buildRatifiedFrame`; stored on record; outbound `&r=` on share when present.  
**Ref:** FRAME-SPEC.md §9

---

### COMPACT_TIME date encoding
**Status: Active**  
Wire encoding in pads-v1 codec; round-trip tests pass.  
**Ref:** OQ-2 (resolved)

---

### DOMAIN=11 hybrid mode
**Status: Active (codec + RecordService)** / **Latent (full UI)**  
`encodeUrl` passes domain/IO direction; not all wizard entry types expose full DOMAIN=11 UX.  
**Ref:** OQ-7, FRAME-SPEC §17

---

## Templates & Presentation

### TRIG — display trigger bytecode
**Status: Active**  
`share.js` encodes `trigCode`; `decodeUrl` runs `WPTrig.evaluate` → `trigDisplay` on record; `view.js` banner; `#1pb/` form TRIG mode routes to wizard.  
A 1–20 byte bytecode language embedded in the TRIG block of `1pb` and `1pf` frames. Programs the receptive shell's rendering behaviour: who sees what, in which display mode, with which CSS/theme/JS module loaded. Bots and scrapers see a blank page; qualifying viewers see the full card, form, or menu.

**Architecture:** Stack machine (Forth/PostScript model). Nibble-encoded opcodes (high nibble = op, low nibble = inline immediate). Two modes: 1-byte pattern token (12 pre-compiled common programs) or 2–20 byte full bytecode with header byte.

**Pattern tokens (1 byte):** The 12 most common programs as single bytes:
- `0x00` SHOW_ALWAYS · `0x01` KNOWN_CONTACT_SHOW · `0x02` HAS_APP_SHOW · `0x03` CODE_VERIFIED_SHOW
- `0x04` HUMAN_SHOW · `0x05` KNOWN_OR_APP_SHOW · `0x06` KNOWN_AND_APP_SHOW · `0x07` ALWAYS_BLANK
- `0x08` FORM_ALWAYS · `0x09` FORM_IF_HUMAN · `0x0A` SERVICE_MENU_ALWAYS · `0x0B` SERVICE_MENU_KNOWN

**Key instructions:** PUSH_COND (push condition bool), SHOW (conditional render), SHOW_ALWAYS, AND/OR/NOT, JZ (conditional skip), TERNARY (4-byte "show X to A, Y to B"), LOAD_CSS (1-byte CSS codebook), SET_THEME, LOAD_JS (1-byte JS codebook), BLOOM (anti-bot Bloom filter)

**Condition registry (12 conditions):** HAS_APP, KNOWN_CONTACT, CODE_VERIFIED, IS_HUMAN, HAS_SAVED_RECORD, ORG_MATCH, HAS_TEMPLATE, DAYLIGHT_HOURS, RECENT_CONTACT, APP_VERSION_OK, REPLY_PENDING, LOCATION_NEAR

**Display modes (8):** CARD, LIST, FORM, MINIMAL, TICKER, BLANK, NATIVE, RESERVED

**CSS codebook (15 slots):** BASE, CARD_LIGHT, CARD_DARK, FORM_STD, SERVICE_LIST, BILLBOARD, MINIMAL + 8 reserved  
**Theme codebook (15 slots):** NEUTRAL, WARM, COOL, DARK + 11 reserved  
**JS codebook (15 slots):** CONTACT_FORM, BOOKING_FORM, REPLY_ROUTER + 12 reserved

**BLOOM filter:** `0xC0 <hi> <lo>` — 16-bit capability bitmask tests (rAF timing, touch events, clipboard, IntersectionObserver, CSS supports). Bots fail; real browsers pass. Result pushed as bool.

**TERNARY shortcut:** `0x90 cond_id mode_true mode_false` (4 bytes) — most expressive single construct. "Show card to known contacts, form to everyone else" = 5 bytes including header.

**Byte counts in practice:**
- 1 byte: all common single-audience programs (pattern tokens)
- 2 bytes: pattern + CSS theme
- 5 bytes: conditional render (TERNARY)
- 6–9 bytes: compound conditions (known + app, bloom + known)
- 10–20 bytes: complex multi-branch programs

**Wire location:** TRIG block within display_schema block (FRAME-SPEC.md §11). `[TRIG_LEN: u8][TRIG_BYTES: N]`. Max 20 bytes. Present when HAS_TRIG=1 in display_schema flags.

**Version path:** VER bits 7–6 in header byte; 3 future versions available. Unknown VER = BLANK gracefully.

**Key property:** Fragment is never sent to server. Bots can't execute JS. Page is blank to casual inspection, scrapers, and link-preview bots. Only a qualifying viewer in a real browser with the right conditions sees the content.

**Ref:** OQ-32 (full spec, including instruction set tables, condition registry, codebooks, example programs, BLOOM detail)  
**Note:** TRIG handles conditions and layout; OQ-26 (structured JS) handles arbitrary logic. TRIG evaluates first — if result is BLANK, JS never runs. JS can invoke TRIG opcodes at runtime via postMessage `trigger` type.

---

### Financial presentation records (`1pf` tag)
**Status: Pending**  
Presentation wrapper for financial records — customer invoice views, statements, pay summaries. Extra safety measures: UI confirmation before URL generation, app warns when sharing to general channels. Not for public circulation. Separate from `1pb` (public billboard) to prevent accidental financial data exposure.  
**Ref:** OQ-20

---

### Public billboard records (`1pb` tag)
**Status: Active (share tag + UI sections)** / **Pending (receiver shell)**  
Share sheet tag `1pb`, presentation/TRIG/routing sections; receive path evaluates TRIG and shows presentation banner (full billboard renderer still minimal).  
**Ref:** OQ-20–OQ-25, FRAME-SPEC.md §11

---

### Presentation templates (`1pt`, `#t/`, `#te/`) — not record presets
**Status: Partial**  
**Active:** `TemplateRegistry.js` (`ingest`, `installFromUrlHash`, fingerprints); `note-share.js`; `#t/` URL receive.  
**Record presets (separate):** `template-creator.js`, `RecordTemplateService`, Management Presets tab, list pinned types.  
**Pending:** `#te/` decrypt; bundled presentation library; CSV paste for presentation templates.  
**Ref:** OQ-15–OQ-19, Phase K; naming: [`JS-RUNTIME-MAP.md`](../dev_refs/JS-RUNTIME-MAP.md) § Two template systems

---

### Anonymous / stealth presentation mode (data_source=11)
**Status: Active (codec)** / **Partial (UI)**  
`codec.js` anon encode paths; `share.js` data source selector includes anon. `js/lib/anon.js` not in shell. Receiver shell: **Pending**.  
A deliberate identity-suppression mode for `#1pb/` records. No sender identity in payload, no reply routing address, no traceable submission destination. Shell shows placeholder text only ("Contact" or TRIG-configured string). Contact forms use `SUBMIT_ACTION=11` (anonymous pickup) — submissions held server-side for retrieval via a blind pickup code the sender controls out-of-band.

**Properties:**
- URL reveals nothing about the sender
- Shell has no forwarding address — cannot be subpoenaed for sender identity
- Sender retrieves submissions by presenting their pickup code (derived from master secret + form UID)
- Receiver has no indication the sender is anonymous vs. just not in their contacts

**Use cases:** Sensitive service providers, whistleblower contact channels, anonymous advertising, identity-suppressed job enquiry forms.  
**Ref:** OQ-24

---

### Contact-resident display mode
**Status: Pending**  
Ultra-minimal card (~15–20 bytes): payload is an identifier only; receiver's device fills display from local contacts on match.  
**Ref:** OQ-25

---

### Form isolation + HARD_BLOCK fields
**Status: Pending**  
Form fields can be marked `HARD_BLOCK=1` in the template/form schema. Such fields are collected locally but stripped from any generated URL or shared record — never transmitted. Enforced at encoder level, not a UI toggle. Primary use: multi-select fields with sensitive option sets (internal categories, pricing tiers, client classifications), private cost estimates, internal notes.  
**Ref:** OQ-17  
**Note:** Enables a "collect privately, share selectively" pattern. Worker fills a rich internal form; the shareable URL contains only the non-blocked fields.

---

### Multi-select: in-list vs in-app option source
**Status: Pending**  
Multi-select fields have two option source modes. `in-list`: options embedded in template, travel in URL — suitable for public/non-sensitive choices. `in-app`: options stored locally by content hash; only the bitmask + list content hash travel in URL — receiver needs the app and matching list to render the options. Provides form privacy without HARD_BLOCK.  
**Wire:** uint8 bitmask (≤8 options) or uint16 bitmask (≤16 options).  
**Ref:** OQ-17

---

### Lists as a standalone service
**Status: Pending — active design**  
Lists are a first-class entity, not just a sub-feature of form fields. A list is an ordered array of option strings with optional metadata (name, category). Lists are shared, imported, and referenced independently of templates.

**Design principles:**
- **Local ID**: app-assigned on import (sequential or user-named). Local only — no global coordination needed. Two users can both have `list_3` locally with no conflict.
- **Identity**: SHA-256 of list content. Same list imported twice = deduplicated automatically. Portable across devices without ID coordination.
- **Sharing**: `#l/<b64url-deflated-list>` fragment URL. Same pattern as records and templates.
- **Import flow**: receiver opens `#l/` URL → app assigns new local ID → stores content-addressed by hash → available in form builder and multi_select fields.
- **Template reference**: form fields reference lists by content hash, not local ID. A field definition is therefore portable — the receiving device resolves the hash to its locally-stored list.
- **List updates**: updating a list produces a new hash = a new list. Templates pinned to old hash are unaffected. Template can optionally be updated to reference new hash (requires re-share).
- **Label fixes**: fix a list option label → new list → re-share the list only, not the template. Template need not change if it references by hash.

**Implication for template immutability (OQ-18):** Templates that reference lists by hash don't need to embed option strings. This reduces the surface area of "what counts as a breaking template change" — list content changes are decoupled from template structure changes.

---

### Structured JS in presentation records
**Status: Pending — full adoption, post-MVP**  
Constrained JS in `1ps`/`1pt`/`1pf` tagged records. Two delivery modes: inline (< 1KB compressed, embedded in frame) and fetch-target (JS URL + SHA-256 hash; shell fetches and verifies — script updatable server-side, URL stays short). Sandboxed iframe; whitelisted postMessage API (submit, resize, navigate, store/retrieve, contact lookup, TRIG bridge). CSS delivery follows same pattern. TRIG (OQ-32) handles conditions and layout; structured JS handles everything beyond.

**Full postMessage API:** submit, resize, navigate, store, retrieve, contact lookup, trigger (TRIG bridge from JS).  
**Trust gate:** `1ps` (per-contact code) or `1pt` (template-keyed, must have `allow_js: true`). `1pa`/`1pb`/`1ph` never carry executable logic.  
**Ref:** OQ-26

---

## Contacts & Identity

### alt_id for no-phone users
**Status: Partial**  
Contact records support extended fields (`alt_phone`, `website`, `social_handle`, …) in `wizard.js` / `RecordService.encodeUrl`. Spec **app_uid / national_id / location_label** on participants wire (OQ-31): **Pending**.  
**Ref:** OQ-31, FRAME-SPEC.md §13

---

### Contact multi-role model
**Status: Active**  
Implemented in three layers (see `wizard.js`, `WorkpadsPanel.js`, `list.js`):

1. **Contact records** (`record_class: 'contact'`): multi-select **role chips** on Identity screen (`roles[]` — Customer, Worker, Vendor, Sub-contractor, Contractor, …).
2. **Job records**: **participants** block with per-line role (Customer / Worker / Supplier / Other) and optional custom `role_text`; contact picker from `BlockRegistry`.
3. **Contact dashboard**: `WorkpadsPanel.renderContactPanel` — role filter bar, lists related jobs/expenses filtered by participant role or `linkedContactId`.

Note: FEATURES spec text said “role is per-record only” — the app **also** stores roles on the contact record itself for tagging; job-level participants remain per-record.  
**Ref:** D36, JS-RUNTIME-MAP § Contact multi-role

---

### Two-tier contact ID (global + activity alias)
**Status: Partial**  
- **Activity alias:** `ref_number` on records in wizard (can hold activity-scoped reference).  
- **Stable link:** `linkedContactId` on child records / ledger / liabilities / contact panel matching.  
- **Global sequential ID (001, 002…):** not implemented in `BlockRegistry` (keys are normalized name strings).  
**Ref:** D35

---

### BlockRegistry (contacts store)
**Status: Active**  
`BlockRegistry.js` — name + phone; auto-save from wizard; lookup for customer phone fill; participant picker.

---

## Activity & Services

### Activity home screen navigation
**Status: Partial**  
- **Active:** `home.js` WP+ launcher (work/pads → filtered `list.js`); `WorkActivityService` + activity filter on list and WorkpadsPanel; inline activity picker on list.  
- **Pending:** Activity selector as **primary** home navigation per Round 13 spec (sidebar-only today).  
**Ref:** `home.js`, `WorkActivityService.js`, `list.js`

---

### Service catalog with cost lines
**Status: Partial**  
`NewEntTemplate.js` + `newent-wizard.js` — business framework sections, not full SIMBA service catalog (name, unit, price, `costs[]`, `defaultWorkers[]`).  
**Ref:** CODEC-STATUS.md Rounds 14–16

---

### Multi-worker rate table
**Status: Pending**  
3-level rate resolution not in app.  
**Ref:** CODEC-STATUS.md Round 17

---

### Pay config inheritance
**Status: Pending**  
Global → activity → per-worker pay config not in app.  
**Ref:** CODEC-STATUS.md Round 19–20

---

## Sharing & Reports

### Per-job share sheet
**Status: Pending**  
Share final records to customer and workers with customer view level selection (Record only / Simple / Standard / Detailed). Confirmation and field correction reply flow.  
**Ref:** D37, CODEC-STATUS.md Round 24

---

### Shareable period reports
**Status: Pending**  
Contact + date range filter → shareable `#1pb/` URL. Compound record, one line per job, summary lines. Worker hours via QTY_LINE=1.  
**Ref:** CODEC-STATUS.md Round 24

---

### Inline activity bundle (piggyback profile with record)
**Status: Pending — post-MVP**  
When sharing any record, the sender can optionally attach a compact activity profile alongside it — business name, full or partial service list (names + prices), and optionally vCard-style contact info. The receiver, on saving the record, is prompted to save the sender's business as a contact with the service list pre-populated.

**User control:** Share sheet toggle — "Include business profile" (on/off). If on: sub-options for full vs partial service list, and whether to include vCard info (address, website etc).

**Wire:** A compact inline profile block appended to the frame. Contents: IS_ORG participant (name + phone/email) + service list (compact compound block — service names + prices only, no full codec records) + optional FLAGS4 vCard fields.

**Receiver experience:** "Save [Business Name] to contacts? They offer: Car Wash · Full Valet · £25 | Basic Wash · £12" with accept/decline. Accepted: contact created with services pre-loaded. Declined: record saved, profile discarded.

**Use case:** Regular customer relationship — first invoice from a new worker arrives with their full service menu attached. One tap and the customer has the worker's business card + service catalog in their app.

**Ref:** OQ-33, OQ-27

---

### KaiOS inline correction comparison
**Status: Pending**  
Single-view diff: changed fields marked `●`, D-pad navigates between changed rows, centre key expands to field detail. No side-by-side.  
**Ref:** D29, CODEC-STATUS.md Round 26

---
