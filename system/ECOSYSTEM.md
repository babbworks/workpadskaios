# Workpads Ecosystem Map
_Current as of 2026-05-11_

---

## Repo Inventory

| Directory | Purpose | State |
|-----------|---------|-------|
| `workpads-standard/` | Normative specification §1–§8 + extended specs | **Live v0.1** — single source of truth |
| `workpadskaios/` | KaiOS 3.x mobile app — primary v0.1 implementation | **v0.1.0 shipped** — D-pad, 5 screens, bitpad-v1 |
| `workpadsdotme/` | `workpads.me` — web app PWA | **Feature complete** — 8 screens, financial model, PWA |
| `workpads-codec/` | `@workpads/codec` npm package — bitpad-v1 encoder/decoder | **v0.1.0 complete** — publish-ready |
| `workpads-basicsconform/` | Research control plane + BASICS conformance evidence | **Active/internal** — feeds decisions to standard |
| `workpadsdev-cli/` | Build + packaging + conformance toolchain for kaios | **v0.1** — KaiOS 3.x packager + conformance tests |
| `workpads-cli/` | Node.js CLI reference implementation | **v0.x legacy** — old JSON+deflate encoding; v0.2 will upgrade to bitpad-v1 |
| `workpads-gh/` | Jekyll site — `standard.workpads.org` | **Live** |
| `workpads.org/` | Jekyll site — general public presence | **Live** |
| `workpadsapp/` | Jekyll site — `workpads.app` product landing page | **Live** |
| `workpads-pitch/` | Investor pitch deck (GitBook) | **Static** |
| `workpads/` | Original design archive, protocol specs, templates | **Archive/reference** — read-only |

---

## Maturity Tiers

**Tier 1 — Shipped & Stable**
- `workpads-standard` v0.1 (all 8 core sections + extended specs)
- `workpadskaios` v0.1.0 (full PADS workflow, all screens live)
- `@workpads/codec` v0.1.0 (bitpad-v1, test suite passing)
- `workpadsdotme` receiver at `/p` (decodes all legacy scheme tags)

**Tier 2 — Feature Complete, Polish Phase**
- `workpadsdotme` main app (8 screens done, CSS/mobile responsive in progress)
- BASICS conformance evidence (core tier claim ready, deviations registered)

**Tier 3 — Planning / v0.2 Scope**
- Codebook-c (24-bit flags, bits 16–23 — see `CODEC-SYNC.md`)
- Financial block in kaios wire format
- Chain protocol (multi-record linking, ACK mechanism)
- Participants block (typed party list)
- Template system (bundled core + extensible registry)
- Activity locale (currency, tax, template pack per business/project)

**Tier 4 — Archive / Reference**
- `workpads/` orchestrator (historical, read-only)
- `workpads-basicsconform/` (research artifact, feeds to standard)

---

## Dependency Graph

```
workpads-standard/
  ↑ normative source for all implementations
  ├── implements ← workpadskaios v0.1 (complete, some deviations — see DEVIATIONS.md)
  ├── implements ← workpadsdotme (feature complete, extended codec)
  ├── implements ← workpads-cli v0.x (legacy encoding; v0.2 will upgrade)
  └── codec spec ← @workpads/codec v0.1 (ready for npm publication)

workpads-codec/ (@workpads/codec)
  ├── depended on by ← workpadskaios (local file: dep in package.json)
  ├── local copy in ← workpadskaios/js/lib/codec.js
  ├── local copy in ← workpadsdotme/js/lib/codec.js (extended, 952 lines)
  ├── inline copy in ← workpadsdotme/p/index.html (decode-only)
  └── will be used by ← workpads-cli v0.2

workpads-basicsconform/
  └── research decisions → workpads-standard

workpadsdev-cli/
  └── builds + tests ← workpadskaios (package + conformance runner)
```

---

## Cross-Repo Facts

- **Three inline codec copies** must stay in sync: `workpadskaios/js/lib/codec.js`, `workpadsdotme/js/lib/codec.js`, `workpadsdotme/p/index.html`. See `CODEC-SYNC.md`.
- **`@workpads/codec`** is ready for independent npm publication at `github.com/babbworks/workpads-codec`. No blockers.
- **`workpads-cli`** uses the old JSON+deflate encoding (pre-bitpad-v1). v0.2 upgrade to bitpad-v1 via `@workpads/codec` is planned but not started.
- **Service layer** (StorageAdapter, ActivityService, RecordService, PersonalService, BlockRegistry) is identical across kaios and dotme. Any change to service contracts must be applied to both.
- **workpads-standard v0.2** is the next standard revision, targeting: financial block formalisation, codebook-c definition, chain protocol, participants block, URL scheme tag alignment.
