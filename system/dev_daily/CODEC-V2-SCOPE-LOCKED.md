# Codec v2 scope — locked (Round A2)
_2026-05-24. Path C + `#1pv/` + NOC types. Sources: [`ROUND-A2-PATH-C-INTEGRATION.md`](ROUND-A2-PATH-C-INTEGRATION.md), [`PRODUCT-SURFACE-LOCKED.md`](PRODUCT-SURFACE-LOCKED.md), Path C Full Adoption spec._

---

## Summary

| Item | Lock |
|---|---|
| Scheme tag | **`#1pv/`** — pads-v2 wire (Path C header + Doc 3 flag byte + CRC) |
| `#1pa/` | **Decode indefinitely**; new shares use `1pv/` for Path C + NOC |
| Path C | C1–C6 adopted as specified |
| Port order | `workpads-codec` + vectors → `workpadskaios/js/lib/codec.js` same release week |
| NOC wire types | `need`, `offer`, `connection` in **same** `1pv/` release |
| BitPads relational leg | **Deferred** (Phase 4) |
| A3 chain | Full 3-bit `chain_mode` + `relationship` on `chainRef` — see [`CHAIN-EXECUTION-LOCKED.md`](CHAIN-EXECUTION-LOCKED.md) |

---

## Frame entry (`1pv/`)

After URL tag strip and deflate:

```
[optional: flag byte per Doc 3 §8]
[Path C header per Full Adoption spec — standard | shortcut | solo]
[optional-flags blocks per groups]
[payload]
[CRC-16-CCITT when flag byte demands — Doc 3 §8.4]
```

Exact flag-byte placement relative to Path C byte 0 is specified in SUI-021 draft to `codec.md` (flag precedes or wraps header — follow Doc 3 §8 when writing standard text).

---

## Path C v0.3 scope

| Proposal | In v0.3 |
|---|---|
| C1 D1 in byte 1 | Yes |
| C2 D-byte byte 2 | Yes |
| C3b type @ byte 0 | Yes (standard path) |
| C4 shortcut `0x00` | Yes — subset only (PC-07) |
| C5 mandatory elision | Yes — core types + NOC rows |
| C6 solo path | Yes — automatic when conditions met |

### Shortcut v1 types

`invoice`, `payment`, `note`, `log`, `work_record` — defer `quote`, `schedule`, `task` shortcut until traffic justifies.

### `chain_mode` in invoice/quote byte 1 (A3 locked)

3-bit field — all in v0.3:

| 3-bit | Mode |
|---|---|
| 0 | INITIATING |
| 1 | LIVE |
| 2 | INFORMATIONAL |
| 3 | CLOSING |
| 4 | DISPUTING |
| 5 | WITNESSING |
| 6–7 | reserved |

`relationship` enum remains on **`chainRef`** payload (not encoded only here).

### EXT second activation byte

**Deferred** unless variable groups exceed byte 1 capacity.

---

## Record type bytes (standard path) — planning table

_Core types: align with Path C spec nibble map where shortcut exists. NOC additions:_

| KaiOS `record_type` | Byte 0 (draft) | Mandatory groups (draft) | Shortcut v1 |
|---|---|---|---|
| invoice | per Path C spec | G0 G1 G6 | yes |
| quote | per Path C spec | G0 G1 G6 | no |
| work_record | per Path C spec | G0 G4 | yes |
| payment | per Path C spec | G0 G1 | yes |
| note / log | per Path C spec | G0 G5 | yes |
| task | per Path C spec | G0 G4 | no |
| schedule | per Path C spec | G0 G2 | no |
| broadcast | per Path C spec | G0 G5 | solo only |
| **need** | `0x16` | G0 G4 | nibble `0xE` when shortcut added |
| **offer** | `0x17` | G0 G4 | nibble `0xF` when shortcut added |
| **connection** | `0x18` | G0 G5 | standard path only v1 |

_Byte values are **draft** until cross-checked against existing pads type enum and FRAME-SPEC amendment — must not collide._

---

## C-Q resolutions (locked)

| ID | Answer |
|---|---|
| C-Q01 | Byte 0 required on frame — tag selects parser family only |
| C-Q02 | Core mandatory table in `codec.md`; Doc 13 domain overlays only |
| C-Q03 | New types use standard path until nibble map amended |
| C-Q04 | Domain-mandatory in profiles only |
| C-Q05 | Solo automatic when G0 defaults satisfied |

---

## Compatibility & UX

| Item | Lock |
|---|---|
| Dual decoder in kaios | `1pa/` + `1pv/` |
| Share UI tag label | Diagnostic/advanced step only |
| Conformance vectors | Ship with npm port |
| Encode default for new shares | `1pv/` when encoder supports it |

---

## SUI register (pending standard write)

| SUI | Doc | Status |
|---|---|---|
| SUI-021 | `codec.md` + TAG table | `done` — 2026-05-24 |
| SUI-022 | `codec.md` type enum + mandatory groups | `done` |
| SUI-023 | `codec.md` flag byte + CRC-16 | `done` |
| SUI-024 | `codec-sync.md` + `TAG-REFERENCE.md` | `done` |

---

## Implementation order (when gates met)

1. Draft `FRAME-SPEC.md` amendment (kaios `dev_refs/`)  
2. Write standard text (SUI-021–024)  
3. `workpads-codec` encode/decode + vectors  
4. Port `workpadskaios/js/lib/codec.js`  
5. Share sheet tag selection (`1pv/` encode path)

**Gate:** A2 + A3 locked (G2 ✓). Start item 1 (FRAME-SPEC amendment) when ready to code.

---

_End._
