# v0.4 implementation status
_2026-05-24. Scope: [`V04-COMPRESSION-SCOPE.md`](V04-COMPRESSION-SCOPE.md)._

---

## Scaffold (in repo)

| ID | Item | Status | Location |
|----|------|--------|----------|
| V4-1a | Bridge ext flag `0x08` + relational / chain_ref24 / profile | ☑ scaffold | `pathc-v2.js` |
| V4-2a | Local symbol table store | ☑ scaffold | `symbol-table.js` |
| V4-3a | Inline `TABLE_ENTRY_ADD` in bridge ext | ☑ scaffold | `symbol-table.js` + pathc |
| V4-4a | Profile id byte (`service_work.v1` = 1) | ☑ scaffold | `domain-profile.js` |
| — | Encode gated by `relational_encode` UI flag | ☑ | `relational-codec.js`, `RecordService` |
| V4-1b | Native G0–G6 field slices (phase 2b) | ☑ | `native-v1-split.js`, `pathc-native.js` |
| V4-6 | Native default (DEV-WP-V2-001 fixed) | ☑ | `bridgeV1` legacy opt-in only |
| V4-5 | BlockRegistry → symbol export | ☑ | `scripts/export-block-registry-symbols.js` + in-app **Symbols** screen |
| V4-7 | Compression gate (33% interim) | ☑ | `compression-metrics.test.js` |
| — | Phase 3 group_local prefix | ☑ | `FLAG_GROUP_LOCAL` 0x10 |
| — | Programmable UI on view | ☑ | `view.js` Obligations section |
| — | informational_ack (trail + group_local) | ☑ | CE-10 |

**Relational encode:** default on via `UIPhase`; disable in Settings if needed.

---

## Not started (beyond v0.4)

| ID | Item |
|----|------|
| — | `workpadsdotme` native `1pv` decode port |
| — | 50% compression stretch target |

---

## Bridge v4 extension layout

After optional ack masks, when flag **0x08**:

```
[ext_flags u8]
  bit0 relational_mode
  bit1 chain_ref24 (3 bytes LE)
  bit2 profile_id (1 byte)
  bit3 table_entry ([u8 len][inline TABLE_ENTRY_ADD])
```

Documented in `FRAME-SPEC-1pv-ADDENDUM.md` §9.1.

---

_End._
