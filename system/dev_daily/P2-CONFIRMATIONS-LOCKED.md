# P2 research confirmations — locked
_Signed off 2026-05-24 from stakeholder answers. Updates [`PHASE-0-CONFIRMATION-TRACKER.md`](PHASE-0-CONFIRMATION-TRACKER.md)._

---

## Doc 5 — Transmission

| Topic | Decision |
|-------|----------|
| Single-SMS floor | **Accept** as aspirational design floor; **shorter is better** |
| Human-writable share | Target **~10–30 characters** a person can write on paper and another can enter (north star alongside SMS) |
| Binary QR | **Closing task** — implement after template + codec variations are in a **strong stable state** (see [`CLOSING-TASKS.md`](CLOSING-TASKS.md)) |
| Template QR (`1dt/` etc.) | **In scope now** — not limited to business cards; includes **billboard** (`1pb`) and other template surfaces |
| Printed record | **Own product lane** (“microservice”) — multiple print/presentation options over time; wire must stay complete for chosen medium |
| NFC | **Build in now** — spec + app hooks for **several high-value** tap flows (invoice handoff, in-person ack, POS-style confirm) |
| Split `1df/` (8.3) | **Accept** 8-bit fragment key for v1 unless field evidence says otherwise |
| Forwarding flag (8.4) | **Flag byte** when implemented; not required in current KaiOS build |

---

## Doc 9 — Governance

| Topic | Decision |
|-------|----------|
| Conformance CI | **Required** — `npm test` + published vectors per repo |
| Cross-impl vectors | **workpads-standard** owns canonical JSON; kaios + npm (+ CLI) must pass |
| Spec tests layout | Each product repo gets **`spec-tests/`** (vectors, interop, scenario scripts) maturing over time |
| Steward institution | **`workpads.org`** — open-source governance body (user-created) |
| Governance body / major version (§9.2–9.3) | Defer process detail to **workpads.org** charter |

---

## Doc 10 — Identity

| Topic | Decision |
|-------|----------|
| Stage 1 (name + phone) | **Ship** — current app posture |
| Stage 2 HMAC / Stage 3 Ed25519 | **Defer wire** — design accepted, implement when stable |
| Handover record | **Accept spec**, defer implementation |
| Multi-party | **Bilateral chain** of records; `participants[]` contextual |
| Minimize future breaking changes | Prefer **versioned optional extensions** + **sync-on-page-visit** for registries/profiles/identity metadata (see § Sync model) |

### Sync-on-page-visit (design direction)

Registry and profile updates (symbol tables, domain profiles, governance notices) should be deliverable as **small payloads fetched when a user opens a known page** (lab shell, workpads.me/p, template install route) — not requiring app store updates for every vocabulary tweak. Wire format stays stable; **sidecar sync** carries deltas. Details: future `SYNC-PAGE-MODEL.md`.

---

## Doc 2 — Vision §6

| Section | Decision |
|---------|----------|
| §6.1 Identity sequencing | **Accept** — identity wire follows stable record+chain |
| §6.2 Multi-party | **Accept** — bilateral chain, not single N-party wire record in v0.4 |
| §6.3 Programmable records | **Near-term candidate** — see explanation in chat / [`PROGRAMMABLE-RECORDS-NOTE.md`](PROGRAMMABLE-RECORDS-NOTE.md) |
| §6.4 Cross-system interop | **Defer** |
| §6.5 Back-propagation | **Accept** as observation, not a milestone |

---

## Docs 3, 4, 6, 8, A — light pass (2026-05-24)

| Doc | Decision |
|-----|----------|
| 3 Record | **Accept** for wire (flag byte, chainRef, modes) |
| 4 Conservation | **Accept**; soft balance warn on encode OK |
| 6 Action list | **Accept** as implemented (receive screen, 16-bit masks) |
| 8 Chain | **Accept** per `CHAIN-EXECUTION-LOCKED.md` |
| A Roadmap | **Accept** phase ordering (v0.3 done → v0.4 → display) |

---

## Link-lab posture

Sound **testing board** — single-click tools, paste-link flows, simple transforms, multi-step checklists. **Not** a marketing showcase. See [`LINK-LAB-PLAN.md`](LINK-LAB-PLAN.md).

---

_End._
