# Workpads KaiOS — Roadmap

**Current as of:** 2026-05-21  
**Planning authority:** [`project-process.md`](../project-process.md), [`DEVELOPMENT-PLAN.md`](DEVELOPMENT-PLAN.md) (phase audit table), [`FEATURES.md`](FEATURES.md) (shipped vs pending)

Historical file-level brief: [`PRODUCTION-READINESS.md`](../../PRODUCTION-READINESS.md) (2026-05-11; many items now shipped).

---

## v0.1.0 — Shipped

Full PADS workflow on KaiOS 3.x: list, wizard, view, share, management; panels; bitpad-era codec; D-pad nav; onboarding; quick notes; BlockRegistry; URL receive.

---

## v0.2.0 — Production ready (app store target)

**App version:** 0.2.0 (`package.json`, `manifest.webmanifest`)  
**Wire format:** pads-v1 `#1pa/`

### Phase completion (code audit 2026-05-21)

| Phase | Theme | Status |
|-------|--------|--------|
| A | Codec pads-v1 | ✅ Complete |
| B | Activity locale | ✅ Complete |
| C | Service layer | ✅ Complete |
| D | Navigation v0.2 | ✅ Complete |
| E | WorkpadsPanel | ✅ Complete |
| F | Archive | ✅ Complete |
| G | Wizard financials | ✅ Complete |
| H | View financial card | ✅ Complete |
| I | Financial screens | ✅ Complete |
| J | List dashboard | ⚠️ Partial — summary bar; not full 14-window selector |
| K | Template system | ⚠️ Partial — creator + NewEnt; bundled library TBD |
| L | Store packaging | 🔄 In progress — SVG manifest; PNG + device verify pending |
| M | Polish | ⬜ Not started |

### Shipped beyond original v0.2 brief

Also live in `app.js`: `chain`, `dispute`, `ledger`, `liabilities`, `home`, `help`, `country`, `user-switcher`, `newent-wizard`, `template-creator`, `timeline`, `tasks`, `calendar-wp`, `note-share`.

Share sheet: tags `1pa` / `1pb` / `1ps`; presentation/TRIG sections (UI); QR for public tag.

### v0.2 remaining (store path)

1. **Phase L:** PNG icons if required by store; package zip; device/simulator smoke test
2. **Phase J (optional):** `wp_dash_window` + extended time windows on list dashboard
3. **Phase K (optional):** Bundled template pack + CSV paste authoring
4. **Implementation gaps:** `changedMask` at share, `_ratifiedFrame` on outbound share (`IMPLEMENTATION.md`)

---

## v0.3.0 — Chain protocol + participants (enhancement)

Wire bits and UX depth beyond current chain/ACK screens:

- Linked record lifecycle polish; multi-party participants UI
- Geo field UX (bit 20)
- Full chain ratchet / verification flows per standard

*Note: Basic `chainRef`, `chain.js`, state_commit, ACK, amendment, dispute are already in v0.2.*

---

## v0.4.0 — SIMBA services layer

- `service_ref`, expiry, verification bits
- On-device service registry; `workpads://` handler

---

## v1.0.0 — Global readiness

- KaiOS 2.5 build target
- Multi-currency aggregation polish
- Contacts screen (BlockRegistry UI)
- PDF/CSV export
- Regional template packs (NG, KE, ZA, GB, …)
- Full conformance test suite in CI

---

## Post-v1 — Platform expansion

Per `workpads-standard/build-strategy.md`: shared service layer; native shells on Android/iOS; same `#1pa/` wire across platforms.
