# Workpads KaiOS — Claude Code

Read this before planning or coding in this repo or sibling Workpads repos.

## Start here (mandatory)

1. **[`system/project-process.md`](system/project-process.md)** — cross-repo bottleneck: authority matrix, session checklist, State of Total Project, verification commands.
2. [`system/dev_daily/DEVELOPMENT-PLAN.md`](system/dev_daily/DEVELOPMENT-PLAN.md) — current phase and priorities.
3. Task-specific docs per `project-process.md` §4 (e.g. `dev_refs/PLATFORM.md` for screens, `DEVIATIONS.md` for codec/records).

## Ecosystem (four repos)

| Repo | Role |
|------|------|
| `workpadskaios/` (here) | KaiOS app — primary implementation |
| `workpads-standard/` | Normative spec |
| `workpads-codec/` | `@workpads/codec` npm package |
| `workpads-cli/` | CLI harness |

**Wire format:** pads-v1 `#1pa/`. Normative: `workpads-standard/codec.md`.

## Before you change codec or share URLs

Follow `project-process.md` §5–§8 and `system/dev_daily/CODEC-SYNC.md`. Run `npm test` when done.

## Do not use as current truth

- `PRODUCTION-READINESS.md` — historical dotme gap list; see `FEATURES.md` and `project-process.md` §7.
- `system/dev_daily/Archive/` — superseded codec rounds (`1eg/` era).
