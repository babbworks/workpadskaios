# Native groups table — G0–G6 (`#1pv/`)
_Status: **implementation reference** 2026-05-24 — normative summary in `workpads-standard/codec.md` §5.3._  
_Sources: Path C Full Adoption, Group Flags Bit Analysis, `STANDARD-FIELDS.md`, `CODEC-V2-SCOPE-LOCKED.md`, kaios `codec.js`._

---

## 1. Role of groups on `#1pv/`

On native `#1pv/`, **Path C header** carries record type, priority, `chain_mode` (invoice/quote), and **D-byte** flags. **Groups G0–G6** carry pads field payloads. **Trail** (after groups) carries bridge-era chain execution bytes not yet moved into G6.

```
[flag] [path_c_header] [presence u8] [G0..G6 chunks u16+bytes]* [trail?] [crc16?]
```

| Chunk | Meaning |
|-------|---------|
| `presence` bit *n* | Group *Gn* follows (length may be 0 if mandatory-but-empty) |
| `trail` | `trail_flags` + relationship? + ack_masks? + v4_ext? |

**Not in groups today:** `meta1` / `meta2` layout from `#1pa/` — superseded by Path C header + per-group bodies.

---

## 2. Group definitions (semantic)

| Gn | Name | Mandatory meaning | Core payload (target) | Optional-flags (target, Path C) |
|----|------|-------------------|------------------------|----------------------------------|
| **G0** | Identity | Record is anchored (author/title/counterparty) | `record_author`, `record_title` | counterparty, contact_ref, anonymous, delegated, domain_declared |
| **G1** | Financial | Money leg present | `amount`, `currency` | vat, scale, discount, secondary_currency, unit_price, terms_ref, rounding |
| **G2** | Time & place | Scheduled or dated work | `date` | start/end_time, meeting_signal, location, timezone, duration, recurrence, all_day, expiry |
| **G3** | References | Classification / linking | _(optional-only group)_ | external_ref, project_code, tags, record_class, parent_ref, version_of, scope, language |
| **G4** | Work content | Tasks and structured work | _(optional-only)_ | actions, details, deliverables, materials, completion_%, work_hours, assigned_to |
| **G5** | Narrative | Free story / participants | _(optional-only)_ | story, structured_narrative, voice_memo_ref, sensitive, length_hint; **participants block** (kaios) |
| **G6** | Chain & extensions | Obligations, display, rules | _(optional-only)_ | chain_ref, obligation, rel_type, chain_closed, timeout; **TRIG**, **display_schema**, **programmable_rules** |

**D-bits** (draft, priority, read_receipt, no_forward) live in **Path C D-byte**, not G0 optional block — per Path C C2.

---

## 3. Mandatory groups — record types (C5 lock)

Implied groups are **not** repeated in Path C byte 1; `presence` must still include mandatory bits on encode (zero-length chunk allowed).

| `record_type` | Byte 0 | Mandatory | Shortcut nibble | Notes |
|---------------|--------|-----------|-----------------|-------|
| invoice | `0x01` | **G0 G1 G6** | `0x1` | `chain_mode` in header byte 1 |
| quote | `0x02` | **G0 G1 G6** | — | same as invoice |
| work_record | `0x03` | **G0 G4** | `0x3` | G6 optional |
| task | `0x04` | **G0 G4** | — | |
| note | `0x05` | **G0 G5** | `0x4` | solo path when G0 defaults |
| log | `0x06` | **G0 G5** | `0x5` | |
| payment | `0x07` | **G0 G1** | `0x6` | G6 optional |
| schedule | `0x08` | **G0 G2** | — | |
| broadcast | `0x09` | **G0 G5** | — | solo path |
| receipt | `0x0A` | **G0 G1 G6** | — | align with invoice family |
| contract | `0x0B` | **G0 G4 G6** | — | |
| order | `0x0C` | **G0 G1 G4** | — | |
| credit_note | `0x0D` | **G0 G1 G6** | — | |
| report | `0x0E` | **G0 G5** | — | period narrative |
| template | `0x0F` | **G0 G6** | — | presentation in G6 |
| **need** | `0x16` | **G0 G4** | `0xE` (when on) | NOC |
| **offer** | `0x17` | **G0 G4** | `0xF` (when on) | NOC |
| **connection** | `0x18` | **G0 G5** | — | NOC; participants + light ack |
| contact | `0x20` | **G0** | — | FLAGS4 contact template |
| job | `0x21` | **G0 G4** | — | app default type |
| expense | `0x22` | **G0 G1** | — | |
| amendment | _(meta base 6)_ | **G0** | — | sparse amendment frame; native TBD |
| state_commit | _(meta base 5)_ | **G0 G1** | — | commit + optional fin summary |
| ack | _(infer)_ | **G0 G6** | — | masks in trail until G6 absorbs |

Machine-readable copy: [`native-groups-mandatory.json`](native-groups-mandatory.json).

---

## 4. pads-v1 field → group mapping (v0.4 implementation)

Maps existing `codec.js` `FIELDS` / `FIELDS3` / `FIELDS4` / blocks to native chunks for **split encode**.

### G0 — Identity & title

| Source | field_flags / FLAGS3 / FLAGS4 | Notes |
|--------|------------------------------|-------|
| bit 0 | `job` | Record title |
| bit 1 | `customer` | Counterparty label |
| bit 7 | `customer_phone` | |
| bit 8 | `worker` | Author display |
| bit 13 | `ref_number` | |
| FLAGS3-5 | `uid` | |
| FLAGS3-0 | `context_label` | |
| meta | `ext_template` bytes | Template id signal |
| setup | `recipientType` → participant hint | Stays until participants in G5 |

### G1 — Financial

| Source | Notes |
|--------|-------|
| bit 12 gate | `financial_block` — setup_byte, transaction_byte, account_pair |
| fin_control + amounts | customer/worker amounts, tax, compound lines |
| FLAGS4 fin | `service_ref`, `expiry_date` (quote expiry — also G3 semantically) |
| state_commit | sc_fin_summary when baseTemplate=5 |

### G2 — Time & location

| Source | Notes |
|--------|-------|
| bit 2 | `date` |
| bit 3 | `location` |
| bit 4–6 | `meeting_time`, `start_time`, `end_time` |
| bit 14 | `due_date` |
| FLAGS3-3 | `date_end` |
| FLAGS4 contact | `meeting_location`, `gps_binary` |

### G3 — References & classification

| Source | Notes |
|--------|-------|
| FLAGS3-1 | `tag` (incl. `proj:` prefixes) |
| FLAGS3-2 | `qty_unit` |
| FLAGS3-4 | `attachment` |
| FLAGS3-6 | `url` |
| FLAGS4 fin bit 0 | `service_ref` |
| FLAGS4 fin bit 1 | `expiry_date` |

### G4 — Work content

| Source | Notes |
|--------|-------|
| bit 9 | `actions` |
| bit 10 | `details` |
| _(bit 0 job duplicated)_ | Job also in G0 — encode in **G0 only** on split |

### G5 — Narrative & parties

| Source | Notes |
|--------|-------|
| bit 11 | `story` |
| meta2 + block | `participants` |
| field bit 18 | `chainRef` 3-byte inline (until G6 owns chain_ref) |

### G6 — Extensions

| Source | Notes |
|--------|-------|
| meta2 | `hasTrigBlock` + TRIG bytes |
| opts | `display_schema`, `form_schema` |
| tail | `PROGRAM_RULES_V1` (`0x50`) programmable block |
| future | C-TRIG MODE=1 commitment bytecode |

### Trail (not a group)

| Field | Location today |
|-------|----------------|
| `relationship` + subtype | trail `TRAIL_HAS_REL` |
| `confirmed_mask` / `declined_mask` | trail `TRAIL_HAS_ACK` |
| relational_mode, chain_seq_compact, profile_id, symbol inline | trail `TRAIL_HAS_V4` |
| URL `&c=` chainRef | URL suffix (parallel to inline chainRef) |
| `&r=` ratified frame | URL suffix |

---

## 5. Group payload wire format (v0.4 kaios)

Each present group:

```
[u16_le length][group_body]
```

| Phase | `group_body` |
|-------|----------------|
| **2b** | Each group: **subset `field_flags` + FLAGS3/4 + field payloads** for that group only; **G1** = setup + fin; **G5** = story fields + participants; **G6** = TRIG / display / programmable; meta in **HAS_HDR** prefix |
| **3 (now)** | Optional **`u8 group_local_flags`** prefix per group when frame `FLAG_GROUP_LOCAL` (0x10): bit0 G6 programmable, bit1 G0 informational_ack, bit2 G6 display |

**G6 body order** (when split):

1. TRIG (`[u8 len≤20][bytes]`)
2. display_schema (+ form_schema if display type ≥ 2)
3. programmable block (`0x50` …) — see `PROGRAMMABLE-RECORDS-LOCKED.md`

---

## 6. Path C byte 1 — variable groups (reference)

When using **standard path** (not shortcut), byte 1 marks **non-mandatory** groups active (C5 elision). Mandatory groups omitted from byte 1 but required in `presence`.

| Type | Mandatory | Byte 1 variable bits (high → low after EXT, D1) |
|------|-----------|-----------------------------------------------|
| invoice / quote | G0 G1 G6 | G5 G4 G3 G2 |
| work_record / task | G0 G4 | G6 G5 G3 G2 G1 |
| note / log / broadcast | G0 G5 | G6 G4 G3 G2 G1 |
| payment | G0 G1 | G6 G5 G4 G3 G2 |
| schedule | G0 G2 | G6 G5 G4 G3 G1 |
| need / offer | G0 G4 | G6 G5 G3 G2 G1 |
| connection | G0 G5 | G6 G4 G3 G2 G1 |

---

## 7. Divergences (honest)

| Topic | Research target | Kaios v0.4 |
|-------|-----------------|------------|
| Header | Group activation bytes 1–2 | Path C 2–3 byte header only |
| `story` | G5 only | field bit 11 with job in G0/G4 |
| Participants | G0 counterparty | Dedicated block → **G5** on split |
| Chain ref | G6 | field bit 18 + URL `&c=` + trail relationship |
| Ack masks | G6 / action list | **Trail** until G6 absorbs |
| Presentation | TRIG/display | **G6** |
| Bridge | None | `bridgeV1: true` decode-only legacy (DEV-WP-V2-001 fixed) |

---

## 8. Steward checklist (`workpads-standard`)

- [x] Paste §2–§3 into `codec.md` §5.3 (2026-05-24)
- [x] Mark `DEV-WP-V2-001` closed — phase 2b native bodies (2026-05-24)
- [x] Conformance vectors — `1pv-native-2b` eight scenarios (`scripts/regen-1pv-vectors.js`)
- [x] Assign `informational_ack` — trail (`acknowledges` + zero masks) + G0 `group_local` bit 0x02 (2026-05-24)

---

## 9. Implementation pointers

| Artifact | Path |
|----------|------|
| Mandatory JSON | `native-groups-mandatory.json` |
| Runtime table | `js/lib/native-groups-table.js` |
| Native wrap | `js/lib/pathc-native.js` |
| Field registry | `STANDARD-FIELDS.md` |

---

_End._
