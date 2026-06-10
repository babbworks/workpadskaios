# Codec Evolution Subproject

**Created:** 2026-05-17
**Status:** Active — decisions logged; implementation not yet started
**Purpose:** Anchor document for all codec architecture decisions as kaios evolves toward the pads-v2 standard. Each design session logs decisions here. When codec.js work begins, this document is the implementation brief.

---

## 1. Reference Documents

| Document | Location | Role |
|----------|----------|------|
| pads-v2-encoding-spec.md | workpads-standard/ | **THE YARDSTICK** — most complete design; target architecture |
| FRAME-SPEC.md | system/dev_refs/ | Authoritative wire format spec (updated as decisions land) |
| STANDARD-FIELDS.md | system/dev_refs/ | Field registry and encoding rules |
| codec.js (1eg/) | workpadskaios/BASICS-cli/bin/ | Current live implementation — to be replaced |
| bitpads-standard/ | external | BitPads meta byte and codebook package model |
| bitledger-standard/ | external | BitLedger Layer 2/3 value encoding and account classification |

**Deprecation notice:** `1eg/` (kaios current) and `1bg/` (workpads-standard documented) are both deprecated. workpads-standard, workpads-cli, and all sibling repos will remove prior references and adopt the kaios-evolved pads-v2 implementation as the single standard.

---

## 2. Five Core Tensions — Resolved

### T1 — pads-v2 as Evolution Target ✓ RESOLVED

**Decision:** pads-v2 is the sole architecture target. kaios codec IS the reference implementation. All other repos (workpads-standard, workpads-cli, etc.) follow. No dual-decoder, no migration path from 1eg/.

**Implication:** The meta byte architecture (meta1 + meta2 + setup + transaction bytes) replaces the flat 3-byte flags approach of 1eg/. All design work in FRAME-SPEC.md assumes pads-v2 structure.

---

### T2 — Transaction Classification: I>O + Balance Sheet ✓ RESOLVED

**Decision:** I>O 8-state transaction byte covers P&L from the worker's perspective. Balance sheet events (asset purchases on finance, equity contributions, loan repayments, internal transfers) require a transaction extension byte. Extension is provided by **DOMAIN=11's `account_pair_byte`** — already designed in FRAME-SPEC §17. No new signalling mechanism needed.

**Wire impact:** Records needing balance sheet encoding set DOMAIN=11 in meta2. The `account_pair_byte` follows the transaction byte and encodes the BitLedger Account Pair (4-bit) + signal bits. Field workers see I>O; accountants see Account Pair. Same frame, two interpretive layers.

**See:** FRAME-SPEC.md §17 — DOMAIN=11 Hybrid Mode.

---

### T3 — Field Flag Scalability for Domain Templates ✓ RESOLVED

**Decision:** Domain-specific templates (electrician, medical, construction, market trader, etc.) are **relabelling and formula variations on the same underlying wire fields**, not new wire fields. Wire field flags (FLAGS1–4) encode field presence — stable and lean. Template definitions encode field labels + tally formulas — scale to hundreds or thousands in the template registry independently of the codec.

**Architecture:**
- FLAGS1–FLAGS4 chain: field presence signals, codec-level, stable
- Template definition: labels + formulas + display order + required fields, registry-level, unlimited scale
- 4-bit template ID in meta1: routes decoder to the right template for field interpretation
- EXT_TEMPLATE domain byte: handles rare cases needing genuinely new field semantics (regulated medical fields, legal clause structures)

**Key insight:** An electrician template doesn't need new FLAGS bits. It labels `customer_amount` as "Labour charge", `qty` as "Hours", defines formula `total = (hours × rate) + parts + call_out`. Wire bytes are identical to any other financial record.

---

### T4 — Amount Encoding ✓ RESOLVED

**Decision:** **BitLedger `N = A×2^S+r` scaled value encoding** as default for all amounts. Flat uint24 available as backup.

**BitLedger encoding:**
```
N = A × 2^S + r
  A = amplitude/significand
  S = scale/shift exponent
  r = remainder (fine precision)
25 bits total — same physical footprint as uint24 (3 bytes + 1 bit, rounded to 4 bytes in context)
```

**Why:** Floating-point-like dynamic range in compact binary. Small values (£1.50) encode with full penny precision. Large values (£500,000 supply contract, property transactions) encode via scale factor S — no ceiling problem. Consistent with BitLedger's own standard. Removes DECIMAL_POS redundancy for primary encoding.

**Flat uint24 backup:** Signalled by reserved DECIMAL_POS code in setup byte (e.g. `DECIMAL_POS=111` = flat uint24 mode). Used when encoder simplicity is preferred and value range is known to be small.

**Replaces:** UTF-8 string amounts from 1eg/ (8 bytes per amount → ~4 bytes; saves ~15 bytes on a typical invoice with 3 amount fields).

---

### T5 — Standard Alignment: Which Repo Leads ✓ RESOLVED

**Decision:** **kaios leads. The standard follows.** workpads-standard is updated after kaios codec decisions are made and validated in implementation. kaios prototyping IS the spec process — FRAME-SPEC.md is the live design document.

**Sync obligation:** When a codec decision lands in FRAME-SPEC.md, the corresponding section in workpads-standard/codec.md is updated to match. workpads-cli adopts the new codec. No other repo maintains an independent codec definition.

---

## 3. Decision Log

| Decision | Chosen | Session date |
|----------|--------|-------------|
| Architecture target | pads-v2 only; kaios is reference | 2026-05-17 |
| Balance sheet events | DOMAIN=11 account_pair_byte as extension | 2026-05-17 |
| Field flag scalability | Template relabelling + formulas; FLAGS1–4 stable | 2026-05-17 |
| Amount encoding | BitLedger N=A×2^S+r default; uint24 backup | 2026-05-17 |
| Standard alignment | kaios leads; all repos adopt kaios-evolved | 2026-05-17 |
| 1eg/ / 1bg/ deprecation | Both deprecated; no migration path | 2026-05-17 |
| CODEC-1: N=A×2^S+r bit layout | A=bits 1–17, r=bits 18–25, S in Layer 2 bits 10–13; range 0–33,554,431 | 2026-05-17 |
| CODEC-2: flat uint24 signal | DECIMAL_POS=111 in setup_byte → flat uint24 mode | 2026-05-17 |
| CODEC-3: formula encoding | Dual-layer: infix in template JSON + RPN bytecode in trig_block | 2026-05-17 |

---

## 4. Target Codec Sketch

Updated as decisions land. Current known structure:

```
[meta1]           1 byte — always present
  bits 7-4: TEMPLATE_ID   (4-bit, 16 base types per codebook)
  bit 3: ACK_REQUEST
  bit 2: CHAIN
  bits 1-0: RECIPIENT_TYPE

[meta2]           0-1 bytes — if any meta2 flags needed
  bit 7: COMPACT_TIME
  bit 6: EXTENDED_FIELDS (FLAGS3 present)
  bit 5: HAS_TRIG_BLOCK
  bit 4: PARTICIPANTS
  bits 3-2: DOMAIN        00=service  01=financial  10=reserved  11=hybrid(+account_pair_byte)
  bit 1: DRAFT
  bit 0: RESTRICT_FORWARD

[setup_byte]      0-1 bytes — when DOMAIN≥01
  bits 7-5: DECIMAL_POS   (000-110=0-6 decimal places; 111=flat uint24 backup mode)
  bits 4-3: CURRENCY      (00=local default; 01/10/11=currency_ext byte follows)
  bits 2-1: TAX_CODE
  bit 0: COMPOUND_VALUE

[transaction_byte] 0-1 bytes — when setup_byte present
  bit 7: DIRECTION
  bit 6: TIME
  bit 5: EFFECT
  bits 4-3: SUBTYPE
  bit 2: QTY_SPLIT
  bits 1-0: ROUNDING      (00=exact  10=round_up  11=round_down)

[account_pair_byte] 0-1 bytes — when DOMAIN=11
  bits 7-4: ACCOUNT_PAIR  (BitLedger 4-bit pair: 14 active + 2 special)
  bit 3: DIRECTION
  bit 2: STATUS
  bit 1: COMPLETENESS
  bit 0: EXTENSION

[field_flags1]    1 byte — standard fields 0-7
[field_flags2]    1 byte — standard fields 8-15
[field_flags3]    0-1 bytes — if FLAGS3_PRESENT in field_flags2 bit 7
[field_flags4]    0-1 bytes — if FLAGS4_PRESENT in field_flags3 bit 7

[field data]      variable — fields present per flag bits, BitLedger N=A×2^S+r for amounts

[participants]    variable — if PARTICIPANTS=1 in meta2
[trig_block]      variable — if HAS_TRIG_BLOCK=1 in meta2
[security_wrapper] outside frame — applied after encoding, before base64url
```

---

## 5. Open Questions (codec-specific)

### CODEC-1 — BitLedger `N=A×2^S+r` exact bit allocation ✓ RESOLVED

**Source:** BitLedger_Protocol_v3.md — Layer 2/3 value encoding.

**Bit layout (25-bit value block in Layer 3 record):**

```
Bits  1–17   A (Multiplicand / amplitude / significand) — 17 bits, max 131,071
Bits 18–25   r (Remainder / fine precision) — 8 bits, max 255
Bit  32      QTY_SPLIT — 0=flat value (full 25-bit N), 1=qty×price split (A=price/unit, r=quantity)

S (Optimal Split / scale exponent) — lives in Layer 2 header:
  Layer 2 bits 10–13: S value (4-bit, 0–15, default=8)
```

**Value formula:**
```
N = A × 2^S + r
Real Value = (N × Scaling Factor) / 10^DECIMAL_POS
```

**At default S=8:**
- Full range: 0 to (131,071 × 256 + 255) = **33,554,431**
- At DECIMAL_POS=2 (penny precision): max real value = £335,544.31

**When S=0:** N = A + r — effectively a flat 25-bit integer, no exponential scaling. r=0 is valid.

**Scaling Factor** — Layer 2 bits 3–9 (0–127 = powers of 10).

**DECIMAL_POS** — Layer 2 bits 14–16: 000=integer, 001=1dp ... 110=6dp, **111=extension**.

---

### CODEC-2 — Flat uint24 backup signalling ✓ RESOLVED

**Decision:** `DECIMAL_POS=111` in the setup_byte is the signal for flat uint24 backup mode. No separate `AMT_ENCODING` bit needed.

**Rationale:** BitLedger Layer 2 already reserves `111` as extension code for DECIMAL_POS. Using it for flat uint24 backup is consistent with the upstream standard's own extension mechanism. A dedicated AMT_ENCODING bit would waste a setup_byte slot for a rare mode.

**Wire behaviour when DECIMAL_POS=111:**
```
Amounts are 3-byte big-endian integers: value in smallest unit of the declared currency.
BitLedger N=A×2^S+r decoding does not apply.
```

Use flat uint24 when: encoder simplicity is preferred and value range is known small (e.g. low-value market transactions).

---

- **CODEC-3** ✓ RESOLVED 2026-05-17 — Dual-layer: human-readable infix string in template JSON (authoring source) + compiled RPN bytecode in `trig_block` (offline evaluation). 4-bit opcode stack machine, ~10–12 bytes per formula. See TEMPLATE-SYSTEM-DESIGN.md §5.
- **CODEC-4** — EXT_TEMPLATE domain byte: exact encoding for specialist domain schemas that need new field semantics beyond FLAGS4.

---

## 6. Sync Obligations

When decisions are made and validated:

| What changes | Where to update |
|-------------|-----------------|
| Any FRAME-SPEC update | workpads-standard/codec.md — sync the relevant section |
| Amount encoding finalised | codec.js — replace UTF-8 string encoding with BitLedger N=A×2^S+r |
| meta byte architecture confirmed | codec.js — replace flat 3-byte flags with meta1/meta2/setup/transaction |
| Template formula model decided | template-registry design (separate workstream) |

---

## 7. Round Log

### Round 1 — 2026-05-17
Five tensions identified from research. All five resolved in one session. See §2 above. Key inputs: pads-v2-encoding-spec.md as yardstick; BitLedger Layer 2/3 encoding model; user confirmation that kaios is the reference and 1eg/1bg are deprecated.
