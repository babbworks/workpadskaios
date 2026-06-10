# App build phase — screens & linked functionality

**Opened:** 2026-05-24  
**Predecessor:** Native / v0.4 codec train — closed in KaiOS (`NATIVE-CODEC-ACTION-LOG.md`, `V04-IMPLEMENTATION-STATUS.md`). **workpadsdotme** `1pv` decode explicitly out of scope.  
**Purpose:** Canonical inventory and build order for screen depth and UX wired to codec features — not new wire format unless SUI.

**Session start (app work):** this file → [`UI-ROADMAP-STATUS.md`](UI-ROADMAP-STATUS.md) (checkboxes) → [`APP-SCREENS-IMPLIED.md`](APP-SCREENS-IMPLIED.md) (codec-driven requirements) → [`dev_refs/JS-RUNTIME-MAP.md`](../dev_refs/JS-RUNTIME-MAP.md) (file owners).

**Chat handoff:** Cursor transcript [KaiOS screen inventory](28399a37-29eb-4b04-81cd-70452fcb96b1) — narrative duplicate of §2–§4 below.

---

## 1. Platform baseline (do not re-litigate)

| Layer | State |
|-------|--------|
| Share default | Native `#1pv/` (G0–G6 slices, `group_local` phase 3) |
| Programmable | On wire + decode; **read-only** Obligations on `view.js` |
| Template QR | `#1dt/` default when record has presentation/schema |
| Relational | `relational_encode` default on; symbol export script exists |
| Chain / NOC CE | `action-receive`, obligations filter/badge, `io-create` / `io-record` / `connections` |
| UI rounds R1–R8 | ~92% per `UI-ROADMAP-STATUS.md` |
| Display Phase 6 | **Done** — `glyph-registry.js`, `workpads-ui.css`, Management toggles |
| UI v2 theme (P0) | **Done** — `UITheme`, `workpads-ui-v2.css` bridge; P1+ per `UI-V2-ROLLOUT-PLAN.md` |

---

## 2. Current screens (shipped, routed)

**Router:** `js/app.js`. **Modules:** `js/screens/` (27 files; 25+ routes).

| Group | Screens | Primary files |
|-------|---------|----------------|
| **PADS spine** | List, Wizard, View, Share | `list.js`, `wizard.js`, `view.js`, `share.js` |
| **Money** | Financial, Finance overview, Sale tally, Ledger, Liabilities | `financial.js`, `finance-overview.js`, `sale-tally.js`, `ledger.js`, `liabilities.js` |
| **IO / NOC** | IO create, IO record, Connections, Action receive | `io-create.js`, `io-record.js`, `connections.js`, `action-receive.js` |
| **Chain / governance** | Chain, Dispute | `chain.js`, `dispute.js` |
| **Templates / settings** | Management, Template creator, Archive, Help, Home, Country | `management.js`, `template-creator.js`, `archive.js`, `help.js`, `home.js`, `country.js` |
| **Secondary** | User switcher, Calendar WP, Note share, NewEnt, Timeline, Tasks | respective `js/screens/*.js` |
| **Panels (not routes)** | Workpads overlay, Personal quick capture | `WorkpadsPanel.js`, `workpads-panel-*.js`, `PersonalPanel.js` |

**Two template systems (do not conflate):** My Templates (`RecordTemplateService`, `template-creator.js`) vs presentation packs (`TemplateRegistry.js`, `#t/` / `#te/` / `#1dt/`). See `JS-RUNTIME-MAP.md` § Two template systems.

---

## 3. Planned work — priority queue

Most items **extend existing screens**; new routes unlikely except optional `relations_home` lens.

| ID | Work | Screens / modules | Status |
|----|------|-------------------|--------|
| **A1** | Programmable rules — **compose** on send | `wizard.js`, `share.js`, `programmable-compose.js` | **Done** |
| **A2** | Programmable — receive hints / fired state | `programmable-receive.js`, `view.js`, `list.js` | **Done** |
| **A3** | Template QR production UX | `share.js`, `app.js`, `template-qr.js` | **Done** |
| **A4** | Relational / symbol table UI | `symbols.js`, `symbol-table.js`, `relational-ui.js` | **Done** |
| **A5** | NOC gatekeeper (NOC-06) | `gatekeeper-receive.js`, `noc-gatekeeper.js`, IO/share/view/connections | **Done** |
| **A6** | Display Phase 6 full port | `glyph-registry.js`, `glyph-card.js`, `workpads-ui.css` | **Done** |
| **A7** | NFC closing flows | `share.js`, `nfc-handoff.js`, `app.js` receive listen | **Done** |
| **B1** | Social ledger (C9) | `view.js`, `connections.js`, `social-ledger.js` | **Done** |
| **B2** | Rel-volume advanced (C11) | `rel-volume.js`, `connections.js`, list Net filter | **Done** |
| **B3** | `relations_home` lens (C16) | `home.js`, `ui-phase.js` | **Done** |
| **B4** | Activity taxonomy (C14) | `activity-taxonomy.js`, `management.js`, list picker, wizard | **Done** |
| **B5** | External template receive → import | `template-receive.js`, `app.js`, `management.js` | **Done** |
| **B6** | Presentation template library (Phase K) | `management.js`, notes | **Done** |
| **B8** | Timeline / tasks first-class | `daily-hub.js`, `timeline.js`, `tasks.js`, `home.js` | **Done** |

### Explicitly deferred (this phase)

| Item | Ref |
|------|-----|
| Soft balance hint on encode (C6) | IO-DECISIONS |
| B→C obligation redirect (C10) | Phase 3+ |
| Progressive empty create (C12) | Wizard sufficient |
| workpadsdotme `1pv` | `workpadsdotme/system/SYNC.md` |
| Binary QR, written code, print summary (CT-1–CT-3) | `CLOSING-TASKS-LOCKED.md` — scaffold **Done** |
| 50% compression stretch | 33% gate shipped |

---

## 4. Suggested build order

```
A1 (programmable compose) → A3 (template QR UX) → A4 (relational UI)
  → A5 (NOC gatekeeper) → A6 (display phase 6) → A7 (NFC)
  → B1 (social ledger) → B3 (relations home)
```

**First sprint recommendation:** **A1 + A3** — send-path rules + template QR flows that feel production-ready.

**Normative refs for A1:** `PROGRAMMABLE-RECORDS-LOCKED.md`, `PRODUCTION-LANES-LOCKED.md`.

---

## 5. Scorecard (quick)

| Area | Done | Partial | Not started |
|------|------|---------|-------------|
| Core PADS screens | 12+ | 2 | 0 |
| IO / NOC screens | 4 | 1 | 0 |
| Codec-linked UI depth | decode/share/view | programmable edit, template install, relational UI | relations home |
| R1–R8 + IO philosophy | ~46 items | ~2 | C9, C10, C12, C14, C16 |

---

## 6. Maintenance

| When | Update |
|------|--------|
| Ship an A/B item | Status column §3; optional row in `CODING-LOG.md` |
| New screen route | `app.js`, `index.html`, `JS-RUNTIME-MAP.md`, `FEATURES.md` |
| Checkbox-level UI | `UI-ROADMAP-STATUS.md` |
| Codec-only change | `NATIVE-CODEC-ACTION-LOG.md` / `V04-IMPLEMENTATION-STATUS.md` — not this file |

---

_End._
