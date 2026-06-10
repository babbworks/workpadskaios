# spec-tests — workpadskaios

Conformance and scenario tests **beyond** fast unit tests in `test/`.

| Folder | Purpose |
|--------|---------|
| `vectors/` | Symlinks or copies of canonical JSON from `workpads-standard` / `test/fixtures/` |
| `scenarios/` | Multi-step scripts (encode → decode → assert) run in CI or link-lab |

**Run unit tests:** `npm test` from repo root.

**Steward vectors:** [`workpads.org`](https://workpads.org) (institution) — cross-impl source of truth in `workpads-standard`.

---

_End._
