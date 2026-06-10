# UI v2 rollout plan — slate header + white body (KaiOS)

**Opened:** 2026-05-24  
**Design source:** `research/card-screen-types/workpads-ui.css`, `record-lists.html`, `job-overview.html`  
**Colour spec:** `research/Main Glyph & Group Ref Docs/Workpads — Card & Screen Types Colour.md`  
**In-repo:** `css/workpads-ui-v2.css`, `js/lib/ui-theme.js`, `js/lib/ui-v2-shell.js`, `link-lab/ui-v2-mocks.html`

---

## 1. Master switch (one knob today, theme list tomorrow)

| Control | Module | Storage |
|---------|--------|---------|
| **Master switch** | `UITheme.set('legacy' \| 'v2')` | `localStorage.wp_ui_theme_id` |
| DOM marker | `html[data-ui-theme="…"]` | applied on boot |
| Stylesheet | `#wp-theme-stylesheet` → `css/workpads-ui-v2.css` | disabled when legacy |
| Monospace | `html[data-ui-mono="1"]` | when v2 active |

**Settings UI:** Manage → Settings → **Theme** (tap cycles registered themes).

**Future themes:** `UITheme.registerTheme({ id, label, href, mono })` — no architecture change.

**Default (decided):** `legacy` on fresh install — safe rollback for field devices.

**When v2 enabled:** auto-enables Phase 6 glyph flags (`UIPhase.enablePhase6()`) so list/view glyphs match research rows.

---

## 2. Two-layer implementation (momentum, not rewrite-per-screen)

### Layer 1 — Token bridge (P0 **Done**)

`workpads-ui-v2.css` remaps legacy `--bg`, `--text`, `--accent`, etc. and restyles `.header`, `.softkeys`, `.list-item`, `.view-paper` **without** JS changes.

**Every routed screen** gets immediate light shell + slate chrome when master switch is v2.

### Layer 2 — Structural adapters (P1+)

`UIV2Shell` emits research markup (`.zh`, `.lrow`, `.field`, `.filter-bar`). Screen modules branch:

```javascript
if (UIV2Shell.enabled() && UIPhase.isOn('list_v2')) { … UIV2Shell.lrowFromRecord … }
else { … legacy list-item … }
```

Sub-flags (`list_v2`, `view_v2`, …) land in `ui-phase.js` as phases complete — **not** required for master switch.

### Layer 3 — Research sync (optional)

`node scripts/sync-ui-v2-css.js` → `css/workpads-ui-v2-struct.css` (bulk scoped import from research). Merge when stabilised.

---

## 3. Out of scope (v1)

| Item | Reason |
|------|--------|
| `job-brief-slides.html` | Proto-literate brief lane — separate theme |
| `glyph-configurations.html` | SC lab editors |
| `.case-tablet` | Reference only per CSS |
| Research files marked ○ without app screen | Mock in `link-lab/ui-v2-mocks.html` first |

---

## 4. Screen × surface matrix

**Legend:** L1 = token bridge only · L2 = UIV2Shell · Mock = `ui-v2-mocks` or research HTML · Face: C=creator, U=customer, M=machine

### 4.1 Routed screens (`index.html`)

| Screen | Module | Research | Zones | Face | Layer | Status |
|--------|--------|----------|-------|------|-------|--------|
| list | list.js | RL-01–09 | Z1+filter+rows | C | L2 | L1 ✓ |
| view | view.js | RF/RW + PL | Z1–Z3 (+Z4 prog) | C/U | L2 | L1 ✓ |
| wizard | wizard.js | ED-* | PADS / In-Out | C | L2 | L1 ✓ |
| share | share.js | ED preview | Z2 | C | L1 | L1 ✓ |
| home | home.js | DA-01 / PL-02 | summary | U | L2 | L1 ✓ |
| chain | chain.js | CH-* | thread | C | L2 | L1 ✓ |
| tasks | tasks.js | TK-01 | tasks | C | L2 | L1 ✓ |
| timeline | timeline.js | CH + log | thread | C | L2 | L1 ✓ |
| financial | financial.js | RF-01 | Z2+fin | U | L2 | L1 ✓ |
| finance-overview | finance-overview.js | RF + PL fin | rows | C | L2 | L1 ✓ |
| sale-tally | sale-tally.js | RL + custom | **custom grid** | C | L1 | L1 ✓ exception |
| ledger | ledger.js | RF | list | C | L2 | L1 ✓ |
| liabilities | liabilities.js | RF | list | C | L2 | L1 ✓ |
| io-create | io-create.js | IO-01 | bilateral | C | L2 | L1 ✓ |
| io-record | io-record.js | ED + IO | wizard | C | L2 | L1 ✓ |
| connections | connections.js | RL + CP | list | C | L2 | L1 ✓ |
| action-receive | action-receive.js | TK-01 | task list | C | L2 | L1 ✓ |
| gatekeeper-receive | gatekeeper-receive.js | MO | confirm | C | L1 | L1 ✓ |
| management | management.js | DS-* | settings fields | C | L1 | L1 ✓ |
| template-creator | template-creator.js | ED | form | C | L2 | L1 ✓ |
| archive | archive.js | RL-07 | list | C | L2 | L1 ✓ |
| symbols | symbols.js | DS | table | C | L1 | L1 ✓ |
| help | help.js | DS | static | U | L1 | L1 ✓ |
| country | country.js | ON | list | U | L2 | L1 ✓ |
| onboarding | onboarding.js | ON-* | form | U | L1 | L1 ✓ |
| note-share | note-share.js | RN | Z2 | C | L1 | L1 ✓ |
| newent-wizard | newent-wizard.js | ED | form | C | L1 | L1 ✓ |
| user-switcher | user-switcher.js | DS | list | C | L2 | L1 ✓ |
| calendar-wp | calendar-wp.js | — | calendar | C | L1 | L1 ✓ |
| dispute | dispute.js | MO | form | C | L1 | L1 ✓ |

### 4.2 Non-route surfaces (must not skip)

| Surface | Owner | Research | Layer | Status |
|---------|-------|----------|-------|--------|
| FilterSheet | filter-sheet.js + list.js | SF / filter-bar | L2 | L1 ✓ |
| Type/template/branch pickers | list.js, wizard.js | MO + RL | L2 | Mock ✓ |
| View options / commit / progression | view.js | MO | L1 | L1 ✓ |
| NavStack crumb | nav-stack.js | SH-03 | L1 | L1 ✓ |
| WorkpadsPanel | panels/* | DA/RL | L1 | L1 ✓ |
| PersonalPanel | PersonalPanel.js | — | L1 | L1 ✓ |
| Receive overlays | index.html + app.js | MO | L1 | L1 ✓ |
| EmptyState | empty-state.js | wait tokens | L1 | L1 ✓ |

### 4.3 Functional × visual (must hold on L2)

| Feature | Visual encoding |
|---------|-----------------|
| Open obligations | `lrow-unread` or ◐ in `.lg` |
| Programmable receive | subtitle / `ls-pill-prog-*` |
| Priority queue | `lrow-priority` (amber 3px bar) |
| Glyph registry | `.lg` colour = status, max 2 glyphs/row |
| Lifecycle strip | stays above zones; v2 tints via bridge |
| Sale screen lock | custom layout — bridge only until mock |

---

## 5. Phase gates

| Phase | Deliverable | Gate |
|-------|-------------|------|
| **P0** | `UITheme`, bridge CSS, Management row, mocks | All screens L1; toggle restores dark instantly |
| **P1** | `list_v2` + `UIV2Shell.lrow` in list.js | RL-01 compare @ 240px; grep no regression on legacy |
| **P2** | `view_v2` zone stack | RW-02 / RF-01 analogue |
| **P3** | home, chain, tasks, timeline | summary-bar + thread-row |
| **P4** | wizard, io-*, template-creator | field + pads |
| **P5** | Long tail + picker L2 | matrix all L2 |

**Audit command (legacy HTML leak when v2+list_v2):**

```bash
rg 'class="list-item"' js/screens/list.js  # should be behind !list_v2 branch
```

---

## 6. File map

| File | Role |
|------|------|
| `js/lib/ui-theme.js` | Theme registry + master switch |
| `js/lib/ui-v2-shell.js` | Structural HTML builders |
| `css/workpads-ui-v2.css` | Bridge + core components |
| `css/app.css` | **Frozen** legacy baseline |
| `css/workpads-ui.css` | Phase 6 dark glyph card (legacy theme) |
| `link-lab/ui-v2-mocks.html` | In-repo gap mocks (picker, fields, PL slice) |
| `scripts/sync-ui-v2-css.js` | Pull research CSS bulk |
| `test/ui-theme.test.js` | Theme persistence |

---

## 7. Questions for you (minimal)

| # | Question | Default if no answer |
|---|----------|---------------------|
| Q1 | Fresh-install default theme? | **legacy** |
| Q2 | Auto-enable Phase 6 glyphs when v2 on? | **yes** (implemented) |
| Q3 | Sale tally: accept bridge-only until custom mock? | **yes** |
| Q4 | Next phase after P0: list only or list+view together? | **list first** (highest traffic) |

Everything else (token names, mocks, registry API, matrix) is decided in this doc.

---

## 8. QA tour (manual)

1. Manage → Settings → Theme → **Workpads v2** — shell goes light, header slate.  
2. List / View / Management — readable, focus ring blue.  
3. Theme → **Legacy dark** — instant revert.  
4. Open `link-lab/ui-v2-mocks.html` beside device — RL / PL / MO / ED slices.  
5. Compare list to `research/card-screen-types/record-lists.html`.

---

_End._
