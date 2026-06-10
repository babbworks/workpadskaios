# workpadskaios/system/

Strategic foundation for the Workpads KaiOS application. Updated as the project evolves.

---

## Read first

**[`project-process.md`](project-process.md)** — single bottleneck for human and agent work across workpadskaios, workpads-standard, workpads-codec, and workpads-cli. Session checklist, authority matrix, State of Total Project snapshot, and verification commands.

**Agent entrypoints (repo root):** [`../CLAUDE.md`](../CLAUDE.md) (Claude Code), [`../AGENTS.md`](../AGENTS.md) (all agents), [`.claude/CLAUDE.md`](../.claude/CLAUDE.md), [`.kiro/steering/workpads-process.md`](../.kiro/steering/workpads-process.md).

---

## Document Maturity Pipeline

```
notes  →  design  →  draft-spec  →  spec  →  standard-doc
```

- **draft-spec** — candidate spec under active review (`dev_daily/draft_specs/`)
- **spec** — frozen, codec-authoritative (`dev_refs/`)
- **standard-doc** — published to workpads-standard repo

---

## Folder Structure

```
system/
├── README.md                  ← this file
├── project-process.md         ← read first: cross-repo process + project state
├── dev_refs/                  ← active coding references (read before writing code)
│   └── archive/               ← retired refs (not needed for current coding)
├── dev_daily/                 ← active planning and decisions
│   ├── draft_specs/           ← post-MVP candidate specs (TRIG, templates, security)
│   └── Archive/               ← completed codec work, superseded docs
│       ├── codec-rounds/      ← round-01 through round-14 session docs
│       └── draft_specs/       ← post-v0.3 draft specs (agreements, markers, anon, etc.)
└── archive/                   ← system-level historical docs
```

---

## dev_refs/ — Active Coding References

Read these before writing any app code.

| File | Purpose |
|------|---------|
| `FRAME-SPEC.md` | pads-v1 wire format — the codec authority (1,275 lines) |
| `STANDARD-FIELDS.md` | All named fields, bit positions, types, sizes |
| `ROLE-CODEBOOK.md` | Participant role codes and flags |
| `TAG-REFERENCE.md` | URL tag dispatch table (#1pa, #1pb, #1pf, #1ps, …) |
| `TECH-REFERENCE.md` | Service contracts: RecordService, StorageAdapter, ActivityService |
| `PLATFORM.md` | KaiOS constraints — ES5 rules, localStorage, 240×320, D-pad |
| `WIRING-PATTERNS.md` | Screen wiring cheat sheet — setContext, top bars, sub-records, new screen checklist |
| `JS-RUNTIME-MAP.md` | Every `js/` file; load set; § Two template systems (record preset vs presentation) |
| `MINIMAL-CODE-AUDIT.md` | Shrink mantra, P1–P4 backlog, audit waves |
| `dev_daily/shrink/AUDIT-WAVE-*.md` | Wave 1–3 scorecards (lib, services, list rows) |

---

## dev_daily/ — Active Planning

| File | Purpose |
|------|---------|
| `DEVELOPMENT-PLAN.md` | Phases A–M + **phase audit table** (2026-05-21) |
| `ROADMAP.md` | Version targets with phase completion status |
| `FEATURES.md` | Feature catalogue with implementation status |
| `ROADMAP.md` | v0.2 → v1.0 versioned targets |
| `BACKLOG.md` | Prioritised build backlog |
| `DEVIATIONS.md` | Open deviations from workpads-standard |
| `OPEN-QUESTIONS.md` | OQ registry — 3 open items, all others resolved |
| `CODEC-SYNC.md` | Protocol for keeping codec.js in sync across repos |
| `JUNCTION-WORKPLAN.md` | **2026-05 junction** — research ↔ standard ↔ kaios; co-planning rounds before Track A coding |
| `JUNCTION-DECISIONS-LOCKED.md` | Round 0 charter — Track A full roadmap, IO/glyph reconcile, Path C adopt, NOC review-first |
| `ARCHITECTURE-ALIGNMENT-ROADMAP.md` | Doc A phases 0–6 execution map for Track A |
| `ROUND-A1-IO-GLYPH-RECONCILIATION.md` | A1 questionnaire — neither IO nor glyph wins by default |
| `ROUND-A1-NOC-REVIEW.md` | A1 Need/Offer/Connection review before expand |
| `ROUND-A2-PATH-C-INTEGRATION.md` | A2 Path C timing and scope (draft lock — confirm `#1pv/`) |
| `PRODUCT-SURFACE-LOCKED.md` | A1 product surface (locked) |
| `CODEC-V2-SCOPE-LOCKED.md` | A2 Path C + `#1pv/` scope (locked) |
| `ROUND-A3-CHAIN-EXECUTION.md` | A3 questionnaire (locked) |
| `CHAIN-EXECUTION-LOCKED.md` | A3 chain + conservation + action list (locked) |
| `COMPRESSION-ROADMAP-LOCKED.md` | A4 v0.3 vs v0.4 compression split (signed off) |
| `PHASE-0-CONFIRMATION-TRACKER.md` | Phase 0 § confirmation checklist (active) |
| `CODEC-PORT-CHECKLIST.md` | `1pv/` port phases A–D |
| `dev_refs/FRAME-SPEC-1pv-ADDENDUM.md` | pads-v2 wire draft for implementors |
| `link-lab/` | Local `#1pa/` link decode shell — `npm run link-lab` |

### dev_daily/draft_specs/ — Post-MVP Specs

| File | Needed for |
|------|-----------|
| `TRIG-DESIGN.md` | `#1pb/` / `#1pf/` conditional rendering (v0.3+) |
| `TEMPLATE-SYSTEM-DESIGN.md` | Phase K — template authoring and bundling |
| `SECURITY-DESIGN.md` | `#1ps/` / `#1ph/` security wrapper implementation |

### dev_daily/Archive/ — Completed Codec Work

All 14 codec rounds (frame core through standard sync) are complete and implemented in `js/lib/codec.js`. Design docs are archived here:
- `codec-rounds/` — round-01 through round-14 session pads
- `CODEC-EVOLUTION.md`, `CODEC-STATUS.md`, `CODEC-WORKPLAN.md`, `ROUND-1-WORKPLAN.md`, `BLOCK-DECISIONS.md`
- `draft_specs/` — post-v0.3 specs (agreements, markers, anon mode, C-TRIG, attachments, project association)
