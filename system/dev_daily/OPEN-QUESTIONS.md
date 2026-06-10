# Open Questions — workpadskaios / pads-v1

> Condensed 2026-05-19. Full history archived in dev_daily/Archive/.
> All OQ-1 through OQ-35 and OQ-39–OQ-41 are resolved or draft-spec complete.
> The items below are the only genuinely open design questions.

---

## Currently Open

### Junction track (Round 0 → A1/A2) — 2026-05-24

Registered from [`JUNCTION-DECISIONS-LOCKED.md`](JUNCTION-DECISIONS-LOCKED.md). Resolve via round questionnaires, not ad hoc coding.

| ID | Topic | Round | Status |
|----|-------|-------|--------|
| **OQ-42** | IO vs glyph display authority (PADS vs zones, list strip, share faces) | A1 — `ROUND-A1-IO-GLYPH-RECONCILIATION.md` G-01–G-18 | Open |
| **OQ-43** | Need/Offer/Connection ontology | A1 | ✓ **Resolved** — `PRODUCT-SURFACE-LOCKED.md` |
| **OQ-44** | Path C integration timing | A2 | ✓ **Resolved** — `CODEC-V2-SCOPE-LOCKED.md` (`#1pv/`) |
| **OQ-42** | IO vs glyph display authority | A1 | ✓ **Resolved** — `PRODUCT-SURFACE-LOCKED.md` |
| **OQ-47** | `chain_mode` + relationship enum | A3 | ✓ **Resolved** — `CHAIN-EXECUTION-LOCKED.md` |
| **OQ-45** | Path C C-Q01–C-Q05 (transport prefix, mandatory table owner, shortcut nibble, solo path) | A2 | Open |
| **OQ-46** | Documents 3–13 load-bearing § confirmation (section-by-section) | Phase 0 | ✓ **Resolved** 2026-05-24 — `P2-CONFIRMATIONS-LOCKED.md` |
| **OQ-47** | `chain_mode(3)` + relationship enum alignment (invoice byte 1 vs Doc 8) | A3 (depends A2) | Open |

**Provisional until OQ-43 locks:** `IO-DECISIONS-LOCKED.md` C7 “full” Need/Offer/Connection.

---

### OQ-36 — Attachment: Image Quality Tiers and Inline Thumbnails
**Status:** Post-MVP. Not blocking v0.2.

Four-tier progressive delivery: Tier 0 = inline thumbnail (~40–80B); Tier 1 = 320×240 JPEG Q40; Tier 2 = 800×600 JPEG Q65; Tier 3 = full resolution.

**Sub-questions still open:**
- OQ-36a: ThumbHash (~3KB JS) vs quantised 8×8 grid (no library) — KaiOS memory tradeoff
- OQ-36b: Attachment field URL format — `t0:<thumbhash>:<url>?t=<tiers>` delimiter convention
- OQ-36c: Multi-image — comma-separated vs compound block vs FLAGS4 second slot
- OQ-36d: Offline upload deferral before Tier 1 upload completes

**Design ref:** `Archive/draft_specs/ATTACHMENT-DESIGN.md`

---

### OQ-37 — Project Association
**Status:** Post-MVP. MVP uses `proj:uid` prefix in tag field (FLAGS3 bit 1).

**Sub-questions still open:**
- OQ-37a: Tag field 60B limit vs two `proj:uuid` entries (82B required)
- OQ-37b: Project record type — Service + variant, or Generic + DOMAIN bits?
- OQ-37c: Project UID stability — FLAGS4 future slot vs record's own uid?

**Design ref:** `Archive/draft_specs/PROJECT-ASSOCIATION-DESIGN.md`

---

### OQ-40 (partial) — C-TRIG Extended Condition Registry
**Status:** Post-MVP. Research complete; three sub-items remain.

- OQ-40a: Escape byte layout for extended condition namespaces
- OQ-40b: Condition namespace allocation (app vs standard vs community)
- OQ-40d: Versioned escape table — how clients signal support for extended conditions

**Design ref:** `Archive/draft_specs/C-TRIG-EXTENDED-CONDITIONS.md`

---

## Resolved Summary (all codec-blocking items)

| ID | Topic | Status |
|----|-------|--------|
| OQ-1 | Codebook tag (`1pa`) | ✓ Resolved |
| OQ-2 | COMPACT_TIME epoch (2000-01-01) | ✓ Resolved |
| OQ-3 | currency_ext code table | ✓ Resolved |
| OQ-4 | TAX_CODE 01/10 rates | ✓ Resolved |
| OQ-5 | uint big-endian byte order | ✓ Resolved |
| OQ-6 | TAX_CODE: stored not computed | ✓ Resolved |
| OQ-7 | DOMAIN=11 hybrid mode | ✓ Resolved |
| OQ-8–13 | Amendment, rounding, IS_ORG, FLAGS4, QTY_COMPACT, State Commit | ✓ Resolved |
| OQ-14 | Security wrapper (5-layer) | ✓ Design complete — SECURITY-DESIGN.md |
| OQ-15–19 | Template system (schema, sharing, fields, immutability, versioning) | ✓ Resolved |
| OQ-20–25 | Presentation records (tags, shell, display/form schema, data_source, contact-resident) | ✓ Resolved |
| OQ-27 | Activity group in wire format | ✓ Resolved |
| OQ-28 | `service_ref` FLAGS4 bit 0 | ✓ Resolved |
| OQ-29 | Compound line `line_type` 2-bit flag | ✓ Resolved (needed before full payroll mode) |
| OQ-30 | Cross-device short IDs | Deferred — app_uid covers MVP |
| OQ-31 | `alt_id` in participants | ✓ Resolved — Option A |
| OQ-32 | TRIG display trigger bytecode | ✓ Spec complete — TRIG-DESIGN.md |
| OQ-33 | Inline activity bundle | Post-MVP |
| OQ-34 | Agreements + commitment protocol | ✓ Draft-spec complete |
| OQ-35 | Markers / electronic commitment coins | ✓ Draft-spec complete |
| OQ-38 | Chain UID exposure — Option C for MVP | ✓ Decided |
| OQ-39 | Data Sync Bundle — Option C (record-first) | ✓ Resolved |
| OQ-41 | C-TRIG evaluator architecture | ✓ Draft-spec complete |
