# JS runtime map — workpadskaios

**Audit date:** 2026-05-21  
**Purpose:** What each file under `js/` does, whether it loads in the KaiOS app shell (`index.html`), and how it relates to `node_modules/`.

Cross-reference: [`project-process.md`](../project-process.md), [`FEATURES.md`](../dev_daily/FEATURES.md).

---

## Two template systems (naming)

| Name | Code | Purpose |
|------|------|---------|
| **My Templates** (record templates) | `RecordTemplateService`, `template-creator.js`, Management **My Templates** tab | Wizard field bundles — personal (created) or **imported** (adopted external) |
| **Presentation template** | `TemplateRegistry.js`, `NoteCodec`, `#t/` / `#te/` | HTML/CSS packs for notes / `1pb` — not My Templates |

### My Templates lifecycle

| State | Fields | UI |
|-------|--------|-----|
| **Personal** | no `receivedAt` | My Templates → Personal; list picker → Personal |
| **Awaiting import** | `receivedAt`, no `importedAt` | Imported tab subline → pending list; CSK **Import** |
| **Imported** | `importedAt` set | My Templates → Imported; deliberate adoption |

`receiveExternal()` stores awaiting-import copies; `importTemplate(id)` sets `importedAt`. Pinned list keys may be `rtpl_*` ids (My Templates) or standard type values.

**Not the same:** `template-creator.js` → `RecordTemplateService`, not `TemplateRegistry`.

---

## `node_modules/` (development only)

| Item | What it is |
|------|------------|
| **Not shipped on device** | KaiOS loads `index.html` + scripts under `js/` only. `npm run pack` zips `index.html`, `css/`, `js/`, `img/`, `manifest` — **not** `node_modules/`. |
| **Single dependency** | `@workpads/codec` → `file:../workpads-codec` (see root `package.json`). |
| **Used for** | `npm test` → `test/flow.test.js` exercises the **npm package** (CLI-interop path). `test/codec-pads-v1.test.js` reads `js/lib/codec.js` directly and does **not** need the package at runtime. |
| **Not used in browser** | The phone app uses inlined `js/lib/codec.js` (`window.WPCodec`), not `require('@workpads/codec')`. |

After `npm install`, `node_modules/@workpads/codec` is a symlink/copy of `../workpads-codec`. Deleting `node_modules` does not affect the packaged KaiOS app; it only breaks `npm test` / `flow.test.js`.

---

## Load model

```mermaid
flowchart LR
  subgraph device [KaiOS device]
    HTML[index.html script tags]
    INLINE[js/lib/codec.js WPCodec]
  end
  subgraph dev [Developer machine]
    NM[node_modules/@workpads/codec]
    TEST[test/flow.test.js]
  end
  HTML --> INLINE
  NM --> TEST
```

**2026-05-21:** Protocol libs in shell: `anon.js`, `trig.js`, `ctrig.js`, `markers.js`, **`agreements.js`**, **`roles.js`** (after `codec.js`). **Off shell:** `formula.js`, `template-registry.js`. Shared UI: `ui-fields.js`. **RecordService** session list cache + `listByChainRef`. Pack excludes `demo.js` / `browser-dev.js`. See [`IMPLEMENTATION-REPORT.md`](../dev_daily/shrink/IMPLEMENTATION-REPORT.md).

---

## Files loaded by `index.html` (runtime)

### `js/lib/` (bundled in shell)

| File | Global | Role |
|------|--------|------|
| `CurrencyUtil.js` | `CurrencyUtil` | Multi-currency formatting |
| `utils.js` | `esc`, etc. | Shared DOM/string helpers |
| `ui-phase.js` | `UIPhase` | Phase 2 feature flags (`localStorage`); see [`UI-INTEGRATION-MAP.md`](UI-INTEGRATION-MAP.md) |
| `countries.js` | — | Country/locale data |
| `fflate.js` | fflate | DEFLATE (codec dependency) |
| `crypto.js` | `WPCrypto` | AES/HMAC for `#1ps/` / `#1ph/` |
| `security.js` | `WPSecurity` | Security wrapper encode/decode |
| `codec.js` | `WPCodec` | **pads-v1** encode/decode (`#1pa/` + legacy) |
| `anon.js` | `WPAnon` | Anon mode validation / strip sender identity |
| `trig.js` | `WPTrig` | Display TRIG evaluator (`applyTrigPresentation` on receive) |
| `ctrig.js` | `WPCtrig` | C-TRIG obligations (`runCtrigSchedule` after save) |
| `markers.js` | `WPMarkers` | Marker UID, write tokens, `buildRatifiedFrame` |
| `attachment-store.js` | `WPAttachment` | Camera blob → data URL (persisted attachment) |
| `script-loader.js` | `WPScriptLoader` | Lazy-load `qr.js` on first share QR |
| `qr.js` | `MiniQR` | QR generation (lazy-loaded, not in shell) |
| `demo.js` | — | First-run demo seed (dev/demo) |
| `browser-dev.js` | — | Desktop D-pad emulator (**exclude from device builds**) |

### `js/` services

| File | Global | Role |
|------|--------|------|
| `StorageAdapter.js` | `StorageAdapter` | Prefix-scoped `localStorage` |
| `ActivityService.js` | `ActivityService` | User/business profile, locale presets |
| `WorkActivityService.js` | `WorkActivityService` | Named work activities (grouping/filter) |
| `RecordService.js` | `RecordService` | Record CRUD, encode/decode URLs, receive |
| `FinancialModel.js` | `FinancialModel` | COGS/expense/payment summarization (inlined logic) |
| `PersonalService.js` | `PersonalService` | Quick notes |
| `BlockRegistry.js` | `BlockRegistry` | Contact store (name + phone); auto-save from records |
| `RecordTemplateService.js` | `RecordTemplateService` | **My Templates** (`wp_rtpl_*`; personal / imported / pending) |
| `GlobalSynonymsService.js` | `GlobalSynonymsService` | Field label synonyms (record preset creator) |
| `TemplateRegistry.js` | `TemplateRegistry` | **Presentation templates** (manifest + HTML/CSS, Schema A/B/P) |
| `NoteCodec.js` | — | Personal note URL codec |
| `NewEntTemplate.js` | `NewEntTemplate` | NewEnt business framework storage |

### `js/screens/` (22 registered in `app.js`)

| File | Screen id | Notes |
|------|-----------|--------|
| `help.js` | `help` | Help |
| `home.js` | `home` | WP+ launcher (work/pads filters → list) |
| `user-switcher.js` | `user-switcher` | Multi ActivityService profile switch |
| `timeline.js` | `timeline` | Timeline surface |
| `tasks.js` | `tasks` | Tasks surface |
| `calendar-wp.js` | `calendar-wp` | Calendar → date range on list |
| `list.js` | `list` | Main list, summary bar, contact browser, filters |
| `wizard.js` | `wizard` | PADS + contact template + financial step + participants |
| `view.js` | `view` | Detail, financial card, chain/ACK/commit/amend/dispute |
| `share.js` | `share` | Tags `1pa`/`1pb`/`1ps`, presentation + trig string |
| `note-share.js` | `note-share` | Note sharing |
| `template-creator.js` | `template-creator` | My Templates authoring wizard |
| `management.js` | `management` | Records / personal notes / **My Templates** tab |
| `newent-wizard.js` | `newent-wizard` | NewEnt onboarding |
| `ledger.js` | `ledger` | Expense/COGS/income lines (linked contact) |
| `liabilities.js` | `liabilities` | Payable/receivable/loan (linked contact) |
| `financial.js` | `financial` | Per-record financial detail |
| `finance-overview.js` | `finance-overview` | Cross-record aggregation (All/Month/Week) |
| `country.js` | `country` | Country/locale picker |
| `archive.js` | `archive` | Archived records |
| `chain.js` | `chain` | Chain by `chainRef` |
| `dispute.js` | `dispute` | Dispute flow |

### `js/panels/`

| File | Role |
|------|------|
| `WorkpadsPanel.js` | Panel shell: open/close, context router, D-pad dispatch |
| `workpads-panel-shared.js` | `todayIso`, `money`, `createFromPanel`, activity circle |
| `workpads-panel-browse.js` | List/home browse, date picker, activity overlay, summary agg |
| `workpads-panel-contact.js` | Contact panel, role chips, contact quick-create |
| `workpads-panel-record.js` | Record/job/log/newent/mgmt/share panels, financial D-pad |
| `PersonalPanel.js` | Personal captures |

### `js/app.js`

Router, D-pad layers, onboarding, URL receive, `prefillRecord` hook (for future C-TRIG).

---

## On disk, not in `index.html`

| File | Global | Role |
|------|--------|------|
| ~~`lib/template-registry.js`~~ | — | **Removed** — tests use `test/lib/wp-template-registry-shim.js`; app uses `TemplateRegistry.js` |
| `lib/roles.js` | `WPRoles` | tests only (off shell Wave 1) |
| `lib/formula.js` | `WPFormula` | tests only (off shell Wave 1) |
| `lib/agreements.js` | `WPAgreements` | `view.js` amend/dispute gating |
| `lib/roles.js` | `WPRoles` | On shell; migrate wizard codebook |
| `lib/ui-fields.js` | `UIFields` | Shared form/list HTML |

## Runtime gaps (libs loaded; callers partial)

| Area | Status |
|------|--------|
| Template install path | T-INTEG: unify on `TemplateRegistry.js`; lib registry deferred off shell |
| C-TRIG scheduling | `runCtrigSchedule` after create/save/update; `ctrigProgram` hex field on record |
| `WPFormula` | Off shell; `FinancialModel.js` does not call it yet |
| `WPRoles` | On shell; wizard still uses `PART_ROLE_*` until migrated |
| TRIG display | `decodeUrl` → `applyTrigPresentation`; view banner; `#1pb/` form mode → wizard |
| Outbound `_ratifiedFrame` on share | `RecordService.encodeUrl` → `&r=` URL suffix; decode → `_ratifiedFrameRecord` |

---

## Feature ↔ file quick index

| Feature area | Primary files |
|--------------|----------------|
| Contact multi-role | `wizard.js` (contact `roles[]`), `WorkpadsPanel.js` (`renderContactPanel`), `list.js` (contact browser) |
| Job participants | `wizard.js` (`participants[]`, `PART_ROLE_*`) |
| Work activity filter | `WorkActivityService.js`, `list.js`, `WorkpadsPanel.js`, `wizard.js` (`activityId`) |
| WP+ home | `home.js`, `app.js` (`wp_home_mode`) |
| Record presets | `RecordTemplateService.js`, `template-creator.js`, `management.js` Presets tab, `list.js` |
| Presentation templates | `TemplateRegistry.js`, `NoteCodec.js`, `note-share.js`, `NewEntTemplate.js` |
| Share presentation | `share.js`, `RecordService.encodeUrl`, `codec.js` |
| Chain / ACK / commit | `view.js`, `chain.js`, `RecordService` |

---

## Tests vs runtime

| Test | Exercises |
|------|-----------|
| `test/flow.test.js` | `node_modules/@workpads/codec` (npm / CLI path) |
| `test/codec-pads-v1.test.js` | `js/lib/codec.js` + optional load of other `js/lib/*` via `readFileSync` |

Codec tests may still load libs via `readFileSync` when not in the browser; the shell list above is the device source of truth.
