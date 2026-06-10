# Round A2 — Path C integration (questionnaire)
_Status: **locked** — consolidated in [`CODEC-V2-SCOPE-LOCKED.md`](CODEC-V2-SCOPE-LOCKED.md). Tag **`#1pv/`** confirmed._  
_Spec: [`Workpads — Path C · Full Adoption Format Spec.md`](../../../../research/Main%20Glyph%20&%20Group%20Ref%20Docs/Workpads%20—%20Path%20C%20·%20Full%20Adoption%20Format%20Spec.md)._

---

## Adoption confirmed (not in question)

- C1: D1 priority in byte 1  
- C2: D-byte at byte 2  
- C3b: `record_type` at byte 0 (standard path)  
- C4: `0x00` shortcut escape  
- C5: Mandatory group elision per type  
- C6: Solo path (G0-only note/log/broadcast)

---

## Integration timing — decision matrix

| ID | Question | Options | **Answer** |
|---|---|---|---|
| PC-01 | **When** to land Path C on wire? | (a) Next scheme tag only (b) Dual-decode (c) Big-bang | **(a)+(b):** new tag only for encode; kaios **dual-decode** `#1pa/` read indefinitely |
| PC-02 | New scheme tag id? | `1pb/` `1pe/` other | **`#1pv/`** (pads **v**2 / Path C wire) — **`#1pb/` is Public billboard** per TAG-REFERENCE; do not reuse |
| PC-03 | Port order? | npm / kaios / atomic | **npm + tests first**, kaios `codec.js` same release week |
| PC-04 | Do NOC types ship **in same tag** as Path C? | NOC-19 | **Yes** — `need` / `offer` / `connection` in same `1pv/` type table as Path C port |
| PC-05 | Flag byte + CRC-16 (Doc 3 §8) — same release as Path C or on `#1pa/`? | | **Same release as `1pv/`** — one parser entry per tag |

---

## Scope filter (what enters v0.3 codec port)

| ID | Question | Spec default | **Answer** |
|---|---|---|---|
| PC-06 | Adopt C5 mandatory table **as written** for core types? | Yes | **Yes** for invoice, quote, work_record, task, note, log, broadcast, payment, schedule — **plus** NOC rows (draft below) |
| PC-07 | Shortcut path (`0x00`) — which types in **v1** of new tag? | Spec list | **invoice, payment, note, log, work_record** first; defer schedule/task/quote shortcut |
| PC-08 | Solo path — automatic when G0 defaults met, or encoder flag? | C-Q05 open | **Automatic** when solo conditions met (encoder may force standard path if ambiguous) |
| PC-09 | `chain_mode(3)` in byte 1 for invoice/quote — all six modes day one? | Doc 8 alignment | **INITIATING + LIVE + CLOSING** day one; DISPUTING/WITNESSING/INFORMATIONAL with fallback until A3 enum lock |
| PC-10 | EXT byte 2 activation — required for any v0.3 record, or defer rare groups? | | **Defer** — EXT only when variable groups exceed byte 1 capacity |

---

## NOC types on Path C (work item — finalize in CODEC-V2-SCOPE-LOCKED)

Assign **standard-path byte 0** values (draft — must not collide with existing pads type enum):

| Type | Byte 0 (draft) | Mandatory groups (draft) | Shortcut nibble (draft) |
|---|---|---|---|
| `need` | `0x16` | G0 + G4 (identity/narrative) | `0xE` in shortcut nibble map |
| `offer` | `0x17` | G0 + G4 | `0xF` |
| `connection` | `0x18` | G0 + G5 | defer shortcut v1 |

_Exact group rows to match FRAME-SPEC field groups when porting — this table is planning only._

**C-Q03 note:** shortcut nibble has 16 slots; adding NOC uses last slots — growth beyond 16 types requires standard-path only or spec amendment.

---

## Open spec questions (from Path C doc)

| ID | Path C ref | Question | **Answer** |
|---|---|---|---|
| PC-11 | C-Q01 | Transport already prefixes type/length — is byte 0 redundant? | **No for `1pv/`** — fragment tag selects parser; byte 0 still required for frame self-description and offline blobs |
| PC-12 | C-Q02 | Who owns mandatory-group table updates — core spec vs domain profiles? | **`codec.md` + FRAME-SPEC** own core table; Doc 13 adds domain-mandatory **overlays** only (PC-14) |
| PC-13 | C-Q03 | Shortcut 4-bit type nibble — growth strategy? | **Stable subset** uses shortcut; new types (incl. NOC) use standard path until nibble map amended |
| PC-14 | C-Q04 | Domain-mandatory groups beyond spec table — document in Doc 13 only? | **Yes** — profiles declare extra activation bits; core table unchanged |
| PC-15 | C-Q05 | Solo path opt-in vs automatic | **Automatic** (see PC-08) |

---

## Decoder and compatibility

| ID | Question | **Answer** |
|---|---|---|
| PC-16 | KaiOS must read `#1pa/` indefinitely? | **Yes** — no sunset in v0.3 |
| PC-17 | Share UI labels — show scheme tag per record or hide? | **Show on advanced/diagnostic** share step only; default user copy is record type name |
| PC-18 | Conformance test vectors — publish before or with kaios port? | **With npm port** — kaios follows passing vectors |
| PC-19 | BitPads financial leg (Doc 12 §8) — same release or defer? | **Defer** to Phase 4 / relational track |

---

## Dependency on other rounds

| Dependency | Rule |
|---|---|
| A1 NOC hybrid | NOC types in `1pv/` table per NOC-19 — locked in draft above |
| A3 chain | Finish `chain_mode` + relationship enum before claiming all six modes (PC-09) |
| Phase 0 Doc 3 §8 | Flag byte + CRC at start of `1pv/` frame after tag strip |

---

## Deliverables when complete

1. `CODEC-V2-SCOPE-LOCKED.md` — **next file after you confirm `1pv/` or pick another tag**
2. SUI rows in `workpads-standard/STANDARD-UPDATES.md`
3. OQ-44, OQ-45 → resolved when tag + scope confirmed
4. `FRAME-SPEC.md` amendment draft
5. Optional: `research-notes/A2-sms-qr.md`

---

## Confirm or override (minimum)

| Item | Draft |
|---|---|
| Tag | `#1pv/` |
| Dual-decode `#1pa/` | yes |
| NOC on same tag | yes |
| Flag+CRC with Path C | yes |

---

_End._
