# Compression roadmap — locked (Round A4)
_Signed off 2026-05-24. Strategic split v0.3 vs v0.4. Questionnaire: [`ROUND-A4-COMPRESSION-ROADMAP.md`](ROUND-A4-COMPRESSION-ROADMAP.md)._

**v0.3 ships semantic header compression (Path C), not relational dictionary compression.**

---

## v0.3 (`#1pv/`) — in scope

- Path C C1–C6  
- Doc 3 flag byte + CRC-16  
- NOC wire types  
- Chain `relationship` + invoice `chain_mode`  
- Action list ack with 16-bit masks  
- Existing pads-v1 field blocks inside Path C payload groups (port mapping in addendum)

## v0.3 — explicitly out of scope

- Relational mode flag  
- Symbol table sync / TABLE_ENTRY_ADD  
- Domain profiles on wire  
- Delta records  
- BitPads financial leg (Doc 12 §8) — per `CODEC-V2-SCOPE-LOCKED.md`

---

## v0.4 — compression track

| Item | Lock |
|---|---|
| Relational mode + compact chain refs | Single release |
| Symbol table local store + inline sync | Before dedicated `1ds/` |
| Domain profile | `service_work.v1` first |
| BlockRegistry migration | Export → symbol table → token encode |
| `produce.v1` | After service_work validated |
| Delta records | Evaluate after relational round-trip |
| Success metric | 50% smaller 10th vs 1st exchange (Doc A Phase 4) |

---

## Dependencies

```mermaid
flowchart LR
  V03[v0.3 1pv Path C + chain]
  V04[v0.4 relational + symbols]
  V03 --> V04
```

---

_End._
