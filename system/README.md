# workpadskaios/system/

This folder is the strategic foundation for the Workpads KaiOS application. It is evergreen — updated as the project evolves, not replaced by each release. Every `/plan` session for this repo should begin by reading this folder.

For the v0.2 implementation brief (phased build order, feature gap analysis, app store requirements), see `../PRODUCTION-READINESS.md` at the repo root.

---

## Index

| File | What it is | When to read it |
|------|-----------|-----------------|
| `DEEPSCAN.md` | Full architecture scan of workpadskaios v0.1.0 — screens, services, codec, storage, known issues | Starting any build session; understanding current state |
| `ECOSYSTEM.md` | Cross-repo map of all workpads* projects — maturity, dependencies, relationships | Understanding how kaios fits the wider platform; cross-repo decisions |
| `CODEC-SYNC.md` | Protocol for keeping codec.js in sync across kaios, dotme, and the npm package | Before any codec change; after any standard update |
| `DEVIATIONS.md` | Registered deviations from workpads-standard with status and planned fix | Reviewing technical debt; planning a standard-alignment sprint |
| `ROADMAP.md` | Versioned feature roadmap v0.2 → v1.0 → post-v1 | Sprint planning; prioritisation decisions; long-term feature design |
| `PLATFORM.md` | KaiOS platform constraints and confirmed design principles (navigation model, ES5, storage) | Before writing any new screen or modifying navigation; onboarding a new contributor |
| `VISION.md` | Product philosophy — the individual business record, global ambition, BASICS + SIMBA alignment | Reminding any planning session what we are building and why |
