# Link-lab — testing board plan
_2026-05-24. Local only until deploy slug. **Not** a showcase site._

**Run:** `npm run link-lab` → http://localhost:8765/link-lab/

---

## Principles

1. **One job per page** — decode, encode, transform, or a short checklist  
2. **Paste-friendly** — URL/fragment input always visible  
3. **Honest labels** — what passed/failed, byte size, tag detected  
4. **No marketing chrome** — no feature grids or animation  

---

## Current

| Page | Job |
|------|-----|
| Hub | Paste link → open shell |
| `encode.html` | JSON → tag (`1pa`/`1pb`/`1pv`) + optional v0.4 ext |
| `p/` shell | Decode + field table + `#1pv/` bridge panel |
| `round-trip.html` | **L1** — paste → decode → re-encode → diff |
| `template.html` | **L5** — 1pb billboard/form, draft `1dt`, `#t/` install |
| `obligations.html` | **L2** — invoice → partial pay → paid (CE-11) |
| `ack-masks.html` | **L3** — toggles → encode → verify masks |
| `relational.html` | **L4** — deflate comparison + encode |
| `written-code.html` | **L6** — alias registry (lab scaffold) |

Fixtures: `link-lab/fixtures/scenarios.json`

---

## Next pages (incremental)

| # | Page | Type | Steps |
|---|------|------|-------|
| — | Wire written-code codec | spec | CT-2 in `CLOSING-TASKS.md` |

---

## Fixtures

- Reuse `test/fixtures/1pv-vectors.json`  
- Add `link-lab/fixtures/` only for **UI-only** samples (not duplicate codec truth)  

---

## Out of scope for lab

- Store deploy, auth, accounts  
- “Power demo” dashboards  
- Full NFC hardware (stub + spec link until device API)  

---

_End._
