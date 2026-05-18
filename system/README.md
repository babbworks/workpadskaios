# workpadskaios/system/

Strategic foundation for the Workpads KaiOS application. Evergreen — updated as the project evolves. Every planning session for this repo should begin here.

For the v0.2 implementation brief see `../PRODUCTION-READINESS.md` at the repo root.

---

## Document Maturity Pipeline

```
-notes  →  -design  →  -draft-spec  →  -spec  →  standard-doc
```

- **notes** — raw thinking, exploratory, throwaway
- **design** — structured exploration with open questions (e.g. TRIG-DESIGN.md)
- **draft-spec** — candidate spec under active review (lives in `dev_daily/draft_specs/`)
- **spec** — frozen, versioned, codec-authoritative (lives in `dev_refs/`)
- **standard-doc** — published to workpads-standard repo

---

## Folder Structure

```
system/
├── README.md               ← this file
├── dev_refs/               ← stable reference specs (read before coding)
└── dev_daily/              ← active work: decisions, backlog, design docs
    ├── draft_specs/        ← candidate specs under review
    └── Archive/            ← completed reviews, early-dev, superseded docs
```

---

## dev_refs/ — Stable Reference

| File | Purpose |
|------|---------|
| `FRAME-SPEC.md` | pads-v1 wire format — the codec authority |
| `STANDARD-FIELDS.md` | All named fields, indices, types, sizes |
| `ROLE-CODEBOOK.md` | Participant role codes and flags |
| `TAG-REFERENCE.md` | URL tag dispatch table (#1pa, #1pb, #1pf, …) |
| `TECH-REFERENCE.md` | Quick-lookup tables for all codec option matrices |
| `TEMPLATE-CATALOGUE.md` | BASE_TEMPLATE registry |
| `BLOCK-WALKTHROUGH.md` | Annotated byte-by-byte decode example |
| `ECOSYSTEM.md` | Cross-repo map — kaios, dotme, standard, npm |
| `VISION.md` | Product philosophy and global ambition |
| `PLATFORM.md` | KaiOS constraints and confirmed design principles |

---

## dev_daily/ — Active Work

| File | Purpose |
|------|---------|
| `OPEN-QUESTIONS.md` | OQ registry — open and resolved design questions |
| `FEATURES.md` | Feature catalogue with spec status |
| `BACKLOG.md` | Prioritised build backlog |
| `BLOCK-DECISIONS.md` | Decision log for codec block design |
| `CODEC-STATUS.md` | Current codec implementation status |
| `CODEC-EVOLUTION.md` | Codec evolution subproject anchor |
| `CODEC-SYNC.md` | Protocol for keeping codec.js in sync across repos |
| `DEVELOPMENT-PLAN.md` | Phased build order and milestones |
| `ROADMAP.md` | Versioned feature roadmap v0.2 → v1.0 |
| `DEVIATIONS.md` | Registered deviations from workpads-standard |
| `TRIG-DESIGN.md` | TRIG display trigger bytecode — deep design doc |

### dev_daily/draft_specs/

Candidate specs under active review. Promoted to `dev_refs/` when frozen.

### dev_daily/Archive/

Completed reviews, superseded docs, early-dev material.
