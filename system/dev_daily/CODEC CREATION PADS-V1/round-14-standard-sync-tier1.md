# Round 14 Summary — Standard Sync Tier 1

**Date completed:** 2026-05-18  
**Status:** Done — 646/646 tests still passing (no codec changes; documentation-only round).  
**Primary outputs:** `workpads-standard/` — 6 files updated, 1 file created

---

## What Was Built

### 1. codec.md — Full Rewrite (SUI-001 + SUI-004)

Replaced the v1.2 codebook-b (`1bg/`) description with a full pads-v1 `1pa` standard document.

**Key changes:**
- Scheme tag: `1bg` → `1pa`
- Frame header: 3-byte flat (template byte + 16-bit flags) → full meta1/meta2/setup_byte/transaction_byte/field_flags/FLAGS3/FLAGS4 layout
- Field slots: 16 bits only → 16-bit field_flags + field_flags3 + field_flags4 (template-defined)
- Date encoding: COMPACT_TIME=0 (text) vs COMPACT_TIME=1 (binary) both documented
- Security-wrapped URL variants documented (all 7 tags)
- DOMAIN=11 hybrid mode: `account_pair_byte` layout, AP_DIRECTION/STATUS/COMPLETENESS bits
- Chain reference and RECIPIENT_TYPE interaction documented
- Worked examples: Profile A (33B compact), Profile B (36B payment), updated with fin_control byte
- Backwards compatibility: `1ag/` → `1bg/` → `1pa/` routing by char[1]
- Implementations table updated to kaios codec.js + anon.js + security.js

### 2. security-wrapper.md — New File (SUI-002)

Complete security wrapper specification from FRAME-SPEC §12. Covers:
- URL tag dispatch table (7 tags with purpose and use cases)
- 5-layer security stack: deflate seed poisoning, field scramble, AES-CTR 128-bit, receiver commitment HMAC, preamble byte
- Preamble byte layout (SCRAMBLE, AES, HMAC, SEED_POISON, HKDF_KEY, KEY_HINT)
- Key derivation: `master = SHA-256(passphrase || salt)`, cipher_key + scramble_seed from master
- IV reuse justification (fresh salt per record makes IV unique despite IV=cipher_key)
- URL structure: `#1ps/<b64url(salt)>.<b64url(preamble + encrypted_inner)>`
- Encode path (6 steps) and decode path (8 steps)
- Per-contact key derivation and template-keyed derivation
- Guidance table by record content type

### 3. participants-block.md — Updated (SUI-003)

Part_flags redesigned from 3-bit ROLE_TYPE (8 codes) to 2-bit quick-select + extended path:

**Old layout (bits 6-4 = 3-bit ROLE_TYPE):**
- bit 6: ROLE_TYPE_2, bit 5: ROLE_TYPE_1, bit 4: ROLE_TYPE_0
- 8 roles: Worker/Job owner/Subcontractor/Colleague/Site contact/Referred by/Witness/Extended

**New layout (bits 6-5 = 2-bit ROLE_TYPE, bit 4 = HAS_ALT_ID):**
- `00`=Customer, `01`=Worker, `10`=Supplier/Vendor, `11`=role_code present (extended path)
- When `ROLE_TYPE=11 + HAS_ROLE_TEXT=0`: role_code byte (0x00–0xFE = 240 named roles; 0xFF escape → +1 byte for 224 specialist roles)
- When `ROLE_TYPE=11 + HAS_ROLE_TEXT=1`: free-text role label
- HAS_ALT_ID at bit 4 unlocks alt_id block: app_uid / trade_name / national_id / location_label

Also added: §2.3 Role code extended path; §2.4 alt_id block spec.

### 4. financial-block.md — Updated (SUI-005)

Added §6b: Financial Block Control Byte (`fin_control`). The fin_control byte was documented in FRAME-SPEC but absent from the standard.

**DOMAIN=01 layout:**
- bit 7: BILLED (1=charge billed to customer; EXPENSE_CAT=00 forces BILLED=1)
- bit 6: 0 (mode indicator; integrity check 1 — must be 0 in DOMAIN=01)
- bit 5: QTY_TYPE (0=units, 1=time/hours)
- bit 4: PARITY (even parity of bits 7,5,3,2,1,0 — detects any single-bit flip)
- bits 3-2: EXPENSE_CAT (00=job charge / 01=job cost COGS / 10=running cost / 11=RESERVED)
- bit 1: CUSTOMER_AMT (1=customer_amount uint24 follows)
- bit 0: WORKER_AMT (1=worker_amount uint24 follows)

**DOMAIN=10 layout:**
- bit 7: BILLED, bit 6: 1 (mode indicator), bits 5-2: ACCOUNT_PAIR, bits 1-0: CUST/WORK flags

Added parity formula and 4 integrity checks. EXPENSE_CAT semantics table with customer-visibility column. Three worked examples with full byte calculations.

### 5. transaction-classification.md — Updated (SUI-008)

Added three new sections (§8-§10) from FRAME-SPEC §17.5-17.7:

**§8 Entry Type Matching Table:** 20 wizard entry types across three groups:
- Income-side (6): Invoice, Cash sale, Payment received, Refund, Credit note, Quote
- Expense-side (8): Running cost ×3, Job cost ×2, Job charge, Reimbursement ×2
- Balance sheet (6): Asset purchase ×2, Loan repayment, Owner contribution, Owner draw, Internal transfer

Each entry maps deterministically to: I>O State + EXPENSE_CAT + Account Pair code + AP_DIRECTION.

**§9 Type-Change Reconciliation:** 4-step cascade when worker changes entry type mid-creation (direction flip → settlement state → EXPENSE_CAT → template switch). Invariant: amounts never silently discarded.

**§10 Accounting Detail Display:** AP + AP_DIRECTION → plain-English Debit/Credit labels. Display format: "Type: Operating Expense / Debit: Expenses / Credit: Cash".

### 6. template-system.md — Updated (SUI-006)

Added "Wire Encoding Extensions" section at end of file:
- Extended template object fields: label_map, formula (infix), formula_bytecode (RPN base64url), block_order, custom_fields, template_hash
- custom_fields array spec: bit, key, label, type, encoding (FLAGS4 slot allocations)
- Custom template ID via EXT_TEMPLATE variant type: CRC-8(creator_id) + CRC-16(id+name+date), collision probability ~1 in 16M
- Formula encoding note: formula is human-readable; formula_bytecode is wire format; both required for encoder validation

### 7. STANDARD-UPDATES.md — Status Updated

- SUI-001 through SUI-006, SUI-008: `ready-to-write` → `done`
- SUI-007: remains `in-progress` (TRIG-DESIGN.md source not yet at draft-spec level)
- Version Alignment table updated: all Tier 1 deltas now show ✓
- Standard version bumped to v0.2 (Tier 1 complete, 2026-05-18)

---

## Design Decisions

### Codec.md approach: summary + cross-reference, not duplication

The standard `codec.md` is written to be self-contained enough for a third-party implementor but cross-references FRAME-SPEC.md for complete authority. On any conflict, FRAME-SPEC.md v1.0 is authoritative. This avoids dual-maintenance drift.

### fin_control parity calculation in standard

Added three worked byte examples to financial-block.md §6b to make the parity calculation unambiguous. The FRAME-SPEC has the formula; the standard adds verification examples that a new implementor can run immediately.

### Security wrapper URL structure

The `#1ps/<salt>.<encrypted>` double-segment URL was explicit in FRAME-SPEC but not documented in the standard. Now captured in security-wrapper.md §5 with the exact dot separator and segment meanings.

---

## SUI-007 Deferred

`trig-spec.md` (SUI-007) remains `in-progress`. The `TRIG-DESIGN.md` source in kaios is not yet fully promoted to `draft-spec` status — the instruction set opcodes and condition registry are partially specified. A complete standard document cannot be written until the source is finalized. Deferred to Round 15.

---

## Open Items After Round 14

- SUI-007: trig-spec.md — blocked on TRIG-DESIGN.md promotion to draft-spec
- SUI-009: markers-spec.md — Tier 2, ready-to-write (MARKERS-DESIGN.md at draft-spec)
- SUI-010: agreements-spec.md — Tier 2, ready-to-write
- SUI-011: ctrig-evaluator-spec.md — Tier 2, ready-to-write
- SUI-012: Amount encoding detail in codec.md — uint24 + DECIMAL_POS documented but BitLedger N=A×2^S+r lineage note still pending
- SUI-013: project-association.md — Tier 2, ready-to-write
- SUI-014: anonymous-mode.md — Tier 2, in-progress
- SUI-015: attachment-spec.md — Tier 2, in-progress
- Round 15: SUI-009/010/011/013 (Tier 2 core specs)

---

## Files Changed

| File | Change |
|------|--------|
| `workpads-standard/codec.md` | Full rewrite — v1.2 → v2.0, codebook-b → pads-v1 1pa |
| `workpads-standard/security-wrapper.md` | New file — 5-layer security stack spec |
| `workpads-standard/participants-block.md` | Updated v0.1 → v0.2 — 2-bit ROLE_TYPE, HAS_ALT_ID, extended codebook path |
| `workpads-standard/financial-block.md` | Updated v0.1 → v0.2 — fin_control byte §6b added |
| `workpads-standard/transaction-classification.md` | Updated v0.1 → v0.2 — §8/9/10 Entry Type Matching Table + reconciliation + accounting display |
| `workpads-standard/template-system.md` | Updated v1 → v1.1 — wire encoding extensions section added |
| `workpads-standard/STANDARD-UPDATES.md` | SUI-001/002/003/004/005/006/008 marked done; version updated to v0.2 |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 14 checklist added |
