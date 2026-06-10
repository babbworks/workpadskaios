# pads-v2 (`#1pv/`) — FRAME-SPEC addendum (draft)
**Status:** normative for tag `1pv/` — merged into `workpads-standard/codec.md` §5.2 (2026-05-24)  
**Supersedes for tag `1pv/` only:** `FRAME-SPEC.md` §1–2 header (meta1-first layout)  
**Keeps:** field blocks, financial block, participants — mapped under Path C **groups**  
**Locks:** [`CODEC-V2-SCOPE-LOCKED.md`](../dev_daily/CODEC-V2-SCOPE-LOCKED.md), [`CHAIN-EXECUTION-LOCKED.md`](../dev_daily/CHAIN-EXECUTION-LOCKED.md), Path C Full Adoption spec

---

## 1. URL envelope (unchanged)

Same as pads-v1:

```
workpads.me/p#1pv/<base64url-deflated-inner-frame>
```

- Deflate + base64url — unchanged  
- Security wrappers (`1ps/`, `1ph/`, …) may wrap **inner frame** same as `1pa/` policy (future SUI)

---

## 2. Inner frame layout (`1pv/`)

After deflate decode, parser reads:

```
[flag_byte]           ; Doc 3 §8 — always first byte on 1pv inner frame
[path_c_header]       ; 2–N bytes — standard | shortcut | solo (see Path C spec)
[optional_flags...]   ; per active variable groups (C5)
[payload_groups...]   ; G0–G6 — pads-v1 field blocks mapped per §8
[crc16_le]            ; CRC-16-CCITT LE over bytes [0 .. end-2] when FLAG_CRC bit set
```

**P0 lock:** flag byte precedes Path C header; bit 0 `HAS_CRC` enables trailing CRC. Parser order: read flag → parse Path C → read groups → verify CRC.

**Not used on `1pv/`:** legacy `[meta1][meta2]…` first-byte layout from FRAME-SPEC §2.

---

## 3. Path C header (normative reference)

Copy parser pseudocode from **Path C · Full Adoption Format Spec** — three paths:

| Path | Byte 0 |
|---|---|
| Standard | `record_type` 0x01–0xFF |
| Shortcut | `0x00` + shortcut byte |
| Solo | `0x00` + solo shortcut + no opt-flags block |

D-byte, mandatory group elision, invoice `chain_mode(3)` in byte 1 — per locked CODEC-V2 scope.

---

## 4. Record type byte 0 (draft table)

| Type | Byte 0 | Shortcut nibble |
|---|---|---|
| invoice | per Path C spec | 0x1 |
| quote | per Path C spec | defer |
| work_record | per Path C spec | 0x3 |
| payment | per Path C spec | 0x6 |
| note | per Path C spec | 0x4 |
| log | per Path C spec | 0x5 |
| need | `0x16` | 0xE (when enabled) |
| offer | `0x17` | 0xF (when enabled) |
| connection | `0x18` | standard path only v1 |

_Confirm no collision with existing enum before implement._

---

## 5. Chain block extensions (`1pv/`)

### 5.1 `chainRef` payload

| Field | Size | Notes |
|---|---|---|
| parent_id | 8 bytes | unchanged |
| relationship | 1 byte | 4-bit core + 4-bit subtype (Doc 8); see CHAIN-EXECUTION-LOCKED |
| … | | existing chain fields per Doc 3 §2.2 |

**Unknown relationship:** decode as `responds` (0x6), subtype 0; UI flag.

### 5.2 Share-time fields (A3)

| Field | When |
|---|---|
| `changedMask` | Present on `amends` outbound share |
| `_ratifiedFrame` | Present on state commit / ratified outbound share |

---

## 6. Action list ack record (`1pv/`)

On `relationship: acknowledges`:

| Field | Width |
|---|---|
| `confirmed_mask` | 16 bits |
| `declined_mask` | 16 bits |

Max **16** indexed actions per parent record in v0.3.

**Connection light ack:** `acknowledges` + zero masks + FLAGS informational_ack (bit TBD in STANDARD-FIELDS).

---

## 7. Dual decoder requirement (kaios + npm)

| Tag | Parser |
|---|---|
| `1pa/` | Existing FRAME-SPEC §2 meta1 parser |
| `1pv/` | This addendum |

Share encoder: default **encode** `1pv/` when app version supports; always **decode** both.

---

## 8. Mapping pads-v1 blocks → Path C groups

**Normative table:** [`NATIVE-GROUPS-TABLE.md`](NATIVE-GROUPS-TABLE.md) + [`native-groups-mandatory.json`](native-groups-mandatory.json).  
**Runtime:** `js/lib/native-groups-table.js`, `js/lib/pathc-native.js`.

| Group | Role | pads-v1 fields (split target) |
|---|---|---|
| G0 | Identity | job, customer, worker, ref_number, uid, context_label, ext_template |
| G1 | Financial | financial_block, compound, FLAGS4 service_ref |
| G2 | Time & place | date, times, location, due_date, date_end, gps |
| G3 | References | tag, attachment, url, qty_unit |
| G4 | Work content | actions, details |
| G5 | Narrative & parties | story, participants, inline chainRef |
| G6 | Extensions | TRIG, display_schema, form_schema, programmable `0x50` |

**v0.4 phase 2b (2026-05-24):** per-group `field_flags` subset + field payloads in G0–G4; G1 setup+fin; G5/G6 as §5. Meta via `FLAG_HAS_HDR` (0x20). Merge to v1 for `parseFrame`. See `native-v1-split.js`.

---

## 9. Bridge v1 (legacy decode)

```
[flag_byte]
[path_c header 2–3 bytes]
[uint16_le v1_payload_length]
[pads-v1 frame from buildFrame / parseFrame]
[relationship byte?]     ; flag 0x02
[ack masks 4 bytes?]   ; flag 0x04 — u16 confirmed, u16 declined LE
[crc16_le optional]    ; flag 0x80
```

| flag bit | Meaning |
|----------|---------|
| 0x01 | BRIDGE_V1 |
| 0x02 | HAS_RELATIONSHIP |
| 0x04 | HAS_ACK_MASKS |
| 0x08 | HAS_V4_EXT (relational scaffold — see §9.1) |
| 0x80 | HAS_CRC |

Implemented in `js/lib/pathc-v2.js` for **decode** and `bridgeV1: true` encode opt-in. Default encode: `pathc-native.js` (DEV-WP-V2-001 fixed).

### 9.1 v0.4 bridge extension (scaffold 2026-05-24)

When bit **0x08** set, trailing bytes before CRC:

```
[ext_flags u8]
  0x01 — relational_mode declared
  0x02 — uint24_le chain_seq_compact follows
  0x04 — profile_id u8 follows (0=generic, 1=service_work.v1)
  0x08 — inline symbol entry: [u8 len][TABLE_ENTRY_ADD blob]
```

Encode in app only when `UIPhase.relational_encode` is on. Decode always accepted.

## 10. Open implementation items

- [x] flag_byte before Path C header — bit 0x80 = CRC  
- [x] informational_ack — trail + G0 `group_local` 0x02 (connection light ack)  
- [x] NOC type bytes 0x16–0x18 in TYPE_TO_BYTE  
- [x] Conformance test vector JSON — `test/fixtures/1pv-vectors.json`  
- [x] relationship + ack bridge bytes  
- [x] Native group payload (phase 2b field slices) — v0.4 — `native-v1-split.js`  

---

_End._
