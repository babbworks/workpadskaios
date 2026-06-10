# Codec port checklist — `#1pv/` (Track A)
_Start after Phase 0 P0 rows confirmed. Gates: A2+A3 locked ✓, SUI-021–027 done ✓._

---

## Phase A — Spec (no code)

| # | Task | Output | Done |
|---|---|---|---|
| A1 | Confirm P0 sections | `PHASE-0-CONFIRMATION-TRACKER.md` all ☑ | ☑ |
| A0 | Local link decode lab | `link-lab/` + `npm run link-lab` | ☑ |
| A2 | Merge addendum → standard | `workpads-standard/codec.md` pads-v2 chapter | ☑ |
| A3 | TAG-REFERENCE + codec-sync | `1pv/` dispatch row | ☑ |
| A4 | SUI-021–027 → `done` | STANDARD-UPDATES | ☑ |

---

## Phase B — npm (`workpads-codec`)

| # | Task | Done |
|---|---|---|
| B1 | Path C header encode/decode unit tests | ☑ | `test/pathc-v2.test.js` |
| B2 | NOC types round-trip | ☑ | via type bytes in pathc-v2 |
| B3 | chainRef relationship + 16-bit ack masks | ☑ | bridge bytes in pathc-v2 |
| B4 | Dual-decode fixture: `1pa/` sample unchanged | ☑ | pathc-v2.test.js |
| B5 | CRC-16 + flag byte vectors | ☑ | pathc-v2.js |
| B6 | Publish test vectors JSON | ☑ | `test/fixtures/1pv-vectors.json` |

---

## Phase C — kaios (`js/lib/codec.js`)

| # | Task | Done |
|---|---|---|
| C1 | Port from npm (manual per CODEC-SYNC) | ☑ | pathc in kaios; npm index.js updated |
| C2 | Share sheet encode `1pv/` default | ☑ | share.js default 1pv |
| C3 | `changedMask` + `_ratifiedFrame` at share | ☑ | RecordService.encodeUrl |
| C4 | `npm test` green | ☑ | 718+ tests incl. pathc-v2 |

---

## Phase D — App (post-decode)

| # | Task | Done |
|---|---|---|
| D1 | Action receive screen (CE-08) | ☑ | `action-receive.js` |
| D2 | Pending conservation list badge + chain UI | ☑ | list filter + chain highlight |
| D3 | Encoder balance warn (CE-13) | ☑ | `share.js` balance banner |
| D4 | DEVIATIONS.md any interim gaps | ☑ | DEV-WP-V2-001 |

---

## Track A app follow-up (2026-05-24)

| Item | Done |
|---|---|
| NOC `io-create` → `need` + `1pv` share | ☑ |
| Connection → Create offer | ☑ |
| Connections → list drill (key 4) | ☑ |
| Phase 6 — `glyph-registry.js`, `glyph-card.js`, `workpads-ui.css` | ☑ |
| CE-09 share ack defaults + connection light ack wire | ☑ |
| `io-record.js` NOC wire fields | ☑ |
| Round A5 `DISPLAY-LAYER-LOCKED.md` scaffold | ☑ |
| Round A4 `V04-COMPRESSION-SCOPE.md` gate doc | ☑ |
| P1 Phase 0 confirmations (Docs 7, 11, 12, 13) | ☑ |
| Track S — `io-record` save/share + `1pv` | ☑ |
| v0.4 scaffold — bridge ext + symbol/profile libs | ☑ |
| V4-7 compression metrics harness + link-lab v0.4 QA | ☑ |
| Link-lab L1–L6 testing board | ☑ |
| NFC handoff spec + `nfc-handoff.js` + share key 2 | ☑ |

---

## v0.4 native (2026-05-24)

| Item | Done |
|------|------|
| Native G0–G6 field slices (phase 2b) | ☑ |
| `workpads-codec` port (`native-*`, `pathc-native`) | ☑ |
| `1pv-vectors.json` native-2b (8 scenarios) | ☑ |
| `codec.md` §5.3 + `native-groups-mandatory.json` | ☑ |

## Explicitly not in this port

- Full glyph card UI (Phase 6)  
- `workpadsdotme` native `1pv` decode (see `workpadsdotme/system/SYNC.md`)  

---

_End._
