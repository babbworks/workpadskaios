# Production lanes — locked
_Signed off 2026-05-24 from stakeholder direction._

---

## Train

| Train | Scope | Status |
|-------|--------|--------|
| **v0.3** | `#1pv/` bridge, CE, NOC, dual decode, share default `1pv` | Shipped in tree |
| **v0.4** | Native G0–G6 payload, relational ext, programmable rules, template QR production | **Active** |
| **Beyond** | Drop bridge (V4-6), symbol export, compression CI gate | After native stable |

**Group mandatory table:** steward updates in `workpads-standard` / `codec.md`; kaios implements against [`CODEC-V2-SCOPE-LOCKED.md`](CODEC-V2-SCOPE-LOCKED.md) table until sync.

---

## Locked this session

| Topic | Decision |
|-------|----------|
| Native codec | **Shipped 2b** — default native G0–G6 field slices; `bridgeV1: true` legacy only |
| Programmable records | **Six primitives on wire** — see [`PROGRAMMABLE-RECORDS-LOCKED.md`](PROGRAMMABLE-RECORDS-LOCKED.md) |
| Template QR | **Production** — `#1dt/` + `#1pb/` in app share; template/billboard default `1dt` when presentation on |
| NFC KaiOS | **Closing** — [`CLOSING-TASKS.md`](CLOSING-TASKS.md); Web NFC lab hooks remain |
| Questions | Ask only when a dependency blocks implementation |

---

## Post-MVP promotion (unchanged rule)

**P** parked → **L** lab → **T** train → **S** standard. Pulls into v0.4 train require explicit **T** promotion.

---

_End._
