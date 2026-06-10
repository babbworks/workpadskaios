# Minimal code audit — KaiOS shrink posture

**Mantra:** minimal code, maximum capability.  
**Baseline:** ~26k LOC under `js/` (2026-05-21), single-threaded ES5, no bundler — every byte in `index.html` loads on cold start.  
**Owner:** living backlog + wave schedule; update after each shrink session.

Cross-reference: [`project-process.md`](../project-process.md), [`JS-RUNTIME-MAP.md`](JS-RUNTIME-MAP.md) § Two template systems, [`WIRING-PATTERNS.md`](WIRING-PATTERNS.md), [`PLATFORM.md`](PLATFORM.md).

**Glossary:** **My Templates** = `RecordTemplateService` (Personal / Imported / awaiting import); **presentation template** = `TemplateRegistry`. Do not use “template” alone in new docs.

---

## Pending capability gaps (tracked)

These are **not** bloat — they are incomplete wiring. Do not delete the libs until callers exist or we explicitly defer the feature.

| ID | Task | Primary files | Notes |
|----|------|---------------|-------|
| P1 | `changedMask` at share time | `RecordService.encodeUrl` | **Done** — diff `_originalSnap` vs final fields; BASE_TEMPLATE=6 + parentUid |
| P2 | Outbound `_ratifiedFrame` on share | `RecordService.encodeUrl`, `codec.js` `&r=` | **Done** — deflate ratified bytes as URL suffix |
| P3 | C-TRIG auto-schedule | `RecordService.js`, `ctrig.js`, `app.js` | **Done** — `afterPersist` → `runCtrigSchedule`; `ctrigProgram` hex on record |
| P4 | Full TRIG receptive shell (`1pb`/`1pf`) | `RecordService.applyTrigPresentation`, `app.js`, `view.js` | **Done** — `trig.js` in shell; decode + display banner |

**Template system (T-INTEG):** `js/lib/template-registry.js` removed from shell 2026-05-21. Single app surface = `TemplateRegistry.js` + `template-creator.js` + `#t`/`#te` decode handlers — fold canonical serialise / fingerprint / `storeTemplate` into `TemplateRegistry` when wiring installs (do not revive duplicate `WPTemplateRegistry` global on device).

---

## Deferred from shell (on disk, not in `index.html`)

| File | Global | Kept for | Re-enter shell when |
|------|--------|----------|------------------------|
| `lib/template-registry.js` | `WPTemplateRegistry` | tests; T-INTEG merge | Never separate — use `TemplateRegistry.js` |
| `lib/roles.js` | `WPRoles` | tests; wizard still `PART_ROLE_*` | UI uses codebook lookup |
| `lib/formula.js` | `WPFormula` | tests; `FinancialModel` inline | Template line formulas |
| `lib/agreements.js` | `WPAgreements` | tests; `markers.js` on commit | [`AGREEMENTS-RESHELL.md`](../dev_daily/shrink/AGREEMENTS-RESHELL.md) |
| `lib/trig.js` | `WPTrig` | tests; share encodes `trigCode` | [`TRIG-RESHELL.md`](../dev_daily/shrink/TRIG-RESHELL.md) |
| `lib/ctrig.js` | `WPCtrig` | tests; `App.prefillRecord` stub | [`CTRIG-RESHELL.md`](../dev_daily/shrink/CTRIG-RESHELL.md) |

**Shell protocol libs (post Wave 0–1):** `anon.js`, `markers.js` only — after `codec.js`.

**Scorecards:** [`AUDIT-WAVE-1-lib.md`](../dev_daily/shrink/AUDIT-WAVE-1-lib.md), [`AUDIT-WAVE-2-services.md`](../dev_daily/shrink/AUDIT-WAVE-2-services.md), [`AUDIT-WAVE-3-list-rows.md`](../dev_daily/shrink/AUDIT-WAVE-3-list-rows.md), [`AUDIT-WAVE-4-cross-cutting.md`](../dev_daily/shrink/AUDIT-WAVE-4-cross-cutting.md).

---

## Metrics (run at audit start and after each wave)

```bash
# From workpadskaios/
wc -l js/lib/*.js js/*.js js/screens/*.js js/panels/*.js | sort -n
npm run pack 2>/dev/null || zip -r /tmp/wp.zip index.html css js img manifest.webapp -x '*browser-dev*'
# Optional: count script tags
grep -c '<script src' index.html
```

| Metric | 2026-05-21 baseline | Target posture |
|--------|---------------------|----------------|
| Total `js/` LOC | ~26,048 | Down per release; no growth without deletion |
| Largest files | `WorkpadsPanel.js` 2170, `list.js` 1701, `wizard.js` 1577, `codec.js` 1646 | Split only if it **reduces** duplicate HTML/DOM |
| `<script>` in `index.html` | 51 (+trig, +ctrig for P3/P4) | Every tag must justify cold-start cost |
| Packaged zip | measure each audit | Primary ship metric |

Record deltas in [`dev_daily/CODING-LOG.md`](../dev_daily/CODING-LOG.md).

---

## How to comb the codebase (recommended order)

Do **not** random walk 55 files. Use **waves** — each wave produces a scorecard and at most one class of change (delete duplicate, merge helper, defer script).

### Wave 0 — Load budget (shell)

**Question:** What must run before first paint?

| Check | Action if fail |
|-------|----------------|
| Script order matches deps (`codec` → protocol libs → services → screens) | Fix order only; no new files |
| `browser-dev.js`, `demo.js` excluded from device pack | Document in pack script |
| Lib loaded but zero app references (grep `global.X` / `X.` in `js/` excluding `test/`) | Candidate to drop from shell or merge |
| Duplicate systems (e.g. `WPTemplateRegistry` + `TemplateRegistry`) | Pick one; other becomes thin adapter or removed |

### Wave 1 — `js/lib/` (bytes per capability)

Priority by size and duplication:

1. `codec.js` — align with npm where possible; kaios-only paths listed in `IMPLEMENTATION.md`
2. `fflate.js`, `crypto.js`, `security.js` — no second DEFLATE/AES path
3. `qr.js` (~917 LOC) — used only on share? defer or replace if oversized
4. Protocol libs — keep if P1–P4 or tests require; else defer load (dynamic script not available on KaiOS — **omit from shell** instead)

### Wave 2 — Services (single choke points)

Files: `RecordService.js`, `StorageAdapter.js`, `BlockRegistry.js`, `ActivityService.js`, …

| Rule | Rationale |
|------|-----------|
| Screens call **services**, not each other's internals | Avoid duplicate CRUD / encode |
| All encode/decode URLs go through `RecordService.encodeUrl` / `receive` | One validation path |
| No `Promise` chains where sync `StorageAdapter` suffices | Memory + scheduling cost on weak devices |
| Optional globals checked **once** at service boundary | Not in every screen |

### Wave 3 — UI hotspots (batched by pattern)

**Batch** (same smell across files):

- List row / card HTML builders (`list.js`, `home.js`, `chain.js`)
- Financial line editors (`ledger.js`, `liabilities.js`, `financial.js`)
- Overlay / D-pad patterns (`view.js`, `wizard.js`, `share.js`)

**Individual** (too large or too central for blind batch):

- `WorkpadsPanel.js`, `wizard.js`, `list.js`, `app.js`, `codec.js`

Per batch: extract **one** shared helper in `utils.js` only if net LOC decreases.

### Wave 4 — Cross-cutting smells

| Smell | Grep / signal | Shrink move |
|-------|---------------|-------------|
| Duplicate `toB64` / compress | `btoa`, `deflateSync` outside `TemplateRegistry` / `codec` | Centralise |
| Inline `innerHTML` + string concat | large `html +=` blocks | Shared `esc()` + one row template |
| `Object.assign` / array HOFs | count per file | ES5 loops where hot path |
| Parallel constants | `PART_ROLE_*` vs `WPRoles` | Single codebook |
| Dead screens / stub surfaces | `timeline.js`, `tasks.js` usage from `home.js` | Remove from shell or implement minimally |

---

## Per-file scorecard (template)

Copy one block per file per audit session:

```markdown
### path/to/file.js (NNN LOC)
- **Shell:** loaded | dev-only | test-only
- **Globals in / out:** …
- **Callers:** (grep list)
- **Duplicates:** …
- **Hot path:** yes/no (list scroll, encode, wizard step)
- **Verdict:** keep | thin | merge into X | defer from shell | delete
- **LOC delta target:** -N (or 0 with P1–P4 wiring)
```

---

## Intra-app reference rules (audit enforcement)

1. **Globals are the module system** — prefer `RecordService`, `WPCodec`, `esc`; no new namespace objects without deleting an old one.
2. **Screens export `XScreen.onShow` only** — router in `app.js`; no `ViewScreen` calling `WizardScreen` internals.
3. **No feature logic in `index.html`** — scripts only.
4. **Codec vs UI** — presentation/agreement/marker **bytes** in lib; **when** to encode in services/screens.
5. **Add capability = delete or defer something** — default challenge for every PR.

---

## Agent / human session protocol

1. Read [`project-process.md`](../project-process.md) §7 + this file.
2. Pick **one wave** (or one scorecard file).
3. Grep before edit: callers, duplicates, shell inclusion.
4. Change class: **shrink only** | **wire P1–P4** | **docs only** — do not mix wire + mass delete in one session.
5. `npm test` + note LOC/pack delta in `CODING-LOG.md`.

Suggested first pass: **Wave 0** (confirm `WPTemplateRegistry` unused in app → candidate to drop from shell) + **Wave 3 batch** list row HTML between `list.js` and `WorkpadsPanel.js`.

---

## Wave schedule (suggested)

| Session | Wave | Focus |
|---------|------|--------|
| 1 | 0 | Shell inventory; duplicate template systems; pack size |
| 2 | 1 | `qr.js`, `template-registry.js` vs `TemplateRegistry.js` |
| 3 | 2 | `RecordService` encode paths; P1 `changedMask` |
| 4 | 2 | P2 `_ratifiedFrame` on share |
| 5 | 3 | List + panel row HTML dedup |
| 6 | 3 | Wizard financial step vs `FinancialModel` / `WPFormula` |
| 7 | 2–3 | P3 C-TRIG hook (small, targeted) |
| 8 | 1–4 | P4 TRIG receive (only if spec-stable) |

### Post Wave 0–4 (current stage)

**Lib defer pass is done** — no more “zero caller” protocol libs to drop from shell without deleting source.

Next audit work is **not** another numbered wave; pick one **track**:

| Track | What | Primary refs |
|-------|------|----------------|
| **Wire** | P1 → P2 → P3/P4 (re-shell libs per `*-RESHELL.md` when wiring) | `AUDIT-WAVE-2-services.md`, backlog § Pending |
| **UI shrink** | Wave 3 batches: `utils.listRow` on `list.js` only; then financial row pattern | `AUDIT-WAVE-3-list-rows.md` |
| **T-INTEG** | My Templates vs presentation — steps 3–4 in § T-INTEG below | `TemplateRegistry.js`, `management.js` |
| **Hotspot files** | Per-file scorecards for `WorkpadsPanel.js`, `wizard.js`, `NewEntTemplate.js` | § Per-file scorecard template |

Revisit **Wave 4** only when adding new libs or after a large feature lands (grep `toB64`, shell count, pack size).

---

## Red flags already noted (2026-05-21)

| Item | Risk |
|------|------|
| ~~`template-registry.js` in shell~~ | **Removed** — T-INTEG merges into `TemplateRegistry.js` |
| `WorkpadsPanel.js` + `list.js` | Largest UI files; likely duplicated browse/render |
| `NewEntTemplate.js` ~599 LOC | One-shot onboarding; could defer load after first run |
| `template-creator.js` ~1413 LOC | Power feature; consider lazy load impossible on KaiOS — keep but avoid growth |
| Modern-JS habits in hot paths | `filter`/`map` in `list.js` (75 hits) — profile before rewrite |

---

## T-INTEG — `TemplateRegistry` integration plan

**Goal:** one template system on device — manifest + payload cache (`TemplateRegistry.js`), not parallel `WPTemplateRegistry` + `wp_template_*` keys.

| Step | Action |
|------|--------|
| 1 | ~~Port `canonicalSerialise`, `fingerprintSchema`~~ **Done** on `TemplateRegistry.js` |
| 2 | ~~`installFromUrlHash` + `app.js` `#t/`~~ **Done**; `#te/` returns `encrypted-template-deferred`; id-only refs return `template-ref-only` |
| 3 | `template-creator.js` + `management.js` Templates tab — one `store` / `query` API | **Done** — `RecordTemplateService` only |
| 4 | Align storage keys: document `wp_rtpl_*` vs `wp_tpl_*` (no merge) | **Done** — [`T-INTEG-KEYS.md`](../dev_daily/shrink/T-INTEG-KEYS.md) |
| 5 | After merge, delete or thin `template-registry.js` to test-only re-export (optional) |

**Do not** re-add `<script src="js/lib/template-registry.js">` to `index.html`.

---

## Where audit docs live (folder policy)

| Location | Use |
|----------|-----|
| `system/dev_refs/MINIMAL-CODE-AUDIT.md` | Charter: mantra, P1–P4, waves, defer table, T-INTEG |
| `system/dev_refs/JS-RUNTIME-MAP.md` | File ↔ load set (update when shell changes) |
| `system/dev_daily/CODING-LOG.md` | Per-session LOC/pack deltas |
| `system/dev_daily/shrink/` *(optional later)* | Per-wave scorecard markdown if volume grows |

**No separate `system/audit/` folder yet** — two living refs in `dev_refs/` are enough. Create `dev_daily/shrink/` only when scorecards exceed ~10 files.

---

## When *not* to shrink

- Test-only paths in `codec-pads-v1.test.js` that justify a lib without UI yet — mark **defer shell** not delete source.
- Spec-required decode paths in `codec.js` even if UI pending.
- `fflate` / `crypto` — required for `#1pa/`; shrink via algorithm port, not removal.
