# Codec Evolution — Status Summary

**As of:** 2026-05-15 — Rounds 1–9 complete (D1–D24 settled)  
**Full session log:** `CODEC-EVOLUTION.md`  
**Role codebook:** `ROLE-CODEBOOK.md`  
**Standard fields:** `STANDARD-FIELDS.md`  
**Frame spec:** `FRAME-SPEC.md`  
**Open questions:** `OPEN-QUESTIONS.md`  
**Next:** Resolve OQ-1/OQ-2/OQ-5 (hard blockers), then codec.js implementation

---

## What We Are Building

An evolved workpads codec — working name `pads-v1` — that:
- Replaces the current `1eg/` kaios codec (built incrementally, without following the pads-v1 spec)
- Uses pads-v2-encoding-spec.md as the yardstick, extended by BitPads v2 and BitLedger v3 insights
- Serves low-literacy field workers in simple mode and traditional accounting systems in standard mode
- Supports a decentralised template ecosystem scaling to domain-specific sectoral templates
- Works for global markets including African currencies and billing scales

---

## Reference Points

| Ref | What | Status |
|-----|------|--------|
| A | `1eg/` — kaios live codec | Current implementation; being superseded |
| B | `1bg/` — workpads-standard/codec.md | Older; stale; will be selectively updated |
| C | `pads-v2-encoding-spec.md` | Primary yardstick; treated as equal authority to upstream protocols |
| D | BitPads Protocol v2 + BitLedger v3 | Upstream protocols; selectively adopted |

**Adoption decision:** BitPads meta byte philosophy adopted (meta1/meta2 structure). BitPads Layer 1 session overhead (64-bit) NOT adopted — workpads URLs are standalone records with no session context. BitLedger Account Pair (4-bit, 14 active pairs) adopted for standard mode. kaios codec standard leads all decisions; workpads-standard updated selectively.

---

## Settled Decisions (D1–D22)

### D1 — Transaction scope
Full BitLedger Account Pair range (14 active pairs, including balance sheet events) is in scope. UI channels users through simplified rubric — expense, income, COGS — without exposing accounting terminology. Advanced users access balance sheet pairs through a cleaner UI path.

### D2 — Template scalability
Thousands of templates = domain-specific **data field schemas** (option b), not presentation templates. Field flags scalability is a real wire-format problem. FLAGS3_PRESENT infrastructure (7 reserved slots + chaining) is the mechanism. Slot assignment is the standard fields session deliverable.

### D3 — Standard update strategy
kaios codec standard leads. `workpads-standard/codec.md` updated selectively and manually as decisions settle.

### D4 — Template ID architecture

4-bit meta1 template field restructured with EXT_TEMPLATE flag:

```
meta1 bit 6 = EXT_TEMPLATE
  0: bits 5-3 = BASE_TEMPLATE (3 bits, 8 standard structural types)
     000 Service record (no financial)
     001 Financial record (I>O type via transaction byte)
     010 Compound financial (multiple line items)
     011 Contact/entity record
     100 Document/media record
     101 State Commit
     110 Amendment
     111 Generic (meta2 clarifies)

  1: bits 5-3 = EXT_SIGNAL
     001 = +1 byte  (256 domain types per codebook package)
     010 = +2 bytes (65,536 domain types)
     011 = +3 bytes (16M domain types)
     100 = +3 bytes variant (CRC-8 namespace + CRC-16 local ID — decentralised)
```

**Variant template ID (3 bytes, decentralised):**
- Byte 1: CRC-8 of creator identity (phone/sender ID hash) = 256-namespace slots
- Bytes 2–3: CRC-16 of (identity + template name + creation date) = 65,536 local IDs
- Collision probability: 1 in 16M across all namespaces — negligible for infrequent template creation
- Unknown variant: graceful degradation (D10)

**Key principle:** Template = STRUCTURE (which fields). Transaction byte = FINANCIAL TYPE (I>O state). These are separate concerns.

Extended template bytes follow immediately after meta bytes, before field flags.

### D5 — BILLED flag location
Lives in `fin_control` byte (see D14). Signals whether an expense is passed through directly to the customer as an invoice line item.

### D6 — Simple vs Standard financial mode
Two modes, signalled by DOMAIN bits in meta2:
- `DOMAIN=01` Simple: I>O 8-state classification, worker-language labels, default
- `DOMAIN=10` Standard: BitLedger Account Pair classification, full double-entry, opt-in

UI: per-Activity mode selection in management screen stamps DOMAIN bits on created records. Wire signal and UI are decoupled — standalone URLs carry DOMAIN bits for unambiguous decoding by any receiver.

The same transaction byte byte is interpreted differently by DOMAIN:
- DOMAIN=01: `DIRECTION(1)+TIME(1)+EFFECT(1)+SUBTYPE(2)+QTY_SPLIT(1)+ROUNDING(2)`
- DOMAIN=10: `ACCOUNT_PAIR(4)+DIRECTION(1)+STATUS(1)+QTY_SPLIT(1)+ROUNDING(1)`

### D7 — Amount encoding (superseded by D15)
Originally: four value tiers, VALUE_TIER bits in fin_control. Superseded by D15 — see below.

### D8 — Meta1 restructure

```
Bit 7: META2_PRESENT
Bit 6: EXT_TEMPLATE
Bits 5-3: BASE_TEMPLATE or EXT_SIGNAL (per D4)
Bit 2: ACK_REQUEST
Bit 1: CHAIN
Bit 0: RECIPIENT_TYPE
```

ACK_REQUEST, CHAIN, and RECIPIENT_TYPE preserved from pads-v2. META2_PRESENT at bit 7 unchanged.

### D9 — Child records (standalone + chainable)
Each financial entry (expense, COGS, payment) is its own record. Child records:
- Carry their own financial data, transaction byte, and optional CONTEXT_LABEL field
- Link to parent via CHAIN bit + `&c=XXXX` URL suffix
- Do NOT duplicate parent's service fields, client info, or job description
- Stripping `&c=` from URL = privacy-safe standalone record (no parent reference)
- CONTEXT_LABEL (short optional text, one field flag bit, max ~30 chars) carries a human-readable job reference ("Boiler repair, 42 High St") for standalone intelligibility without exposing parent data

### D10 — Variant template resolution
Graceful degradation. Unknown variant templates decode their known standard fields normally; domain-specific unknown fields are skipped or shown as raw data. Template definitions shared out-of-band (QR, link, Activity setup). No in-frame URI needed.

### D11 — Field label encoding (self-describing vs template-dependent)
`SELF_DESCRIBING` flag in meta2 bit 7 (repurposed from reserved CONTINUATION bit):
- `0` = Template-dependent: data blocks carry values only, in field-flag bit-position order. Receiver needs the template to label fields. Compact. Adds a semantic security layer — without the template, field semantics are not directly readable.
- `1` = Self-describing: each data block prefixed with a 1-byte canonical field-name index. Any receiver labels fields without the template. For archival, auditors, new receivers.

**Templates not anchored to canonical index:** Templates may define custom field labels entirely outside the canonical registry. The canonical index covers standard and common fields; domain templates with genuinely new field concepts define their own label mappings in the template definition. The field-name index byte in self-describing mode can signal "custom label" via a reserved code range, with the label resolved from the template definition.

Field-name index registry (canonical field set) is the standard fields planning session deliverable.

### D12 — Currency encoding
Setup byte CURRENCY (2 bits) is country-relative:
- `00` = sender's home currency (implicit from country selector — zero bytes overhead for local transactions)
- `01` = first common cross-currency for this codebook package
- `10` = second common cross-currency
- `11` = explicit extended code (1 extension byte follows)

Currency extension byte (when CURRENCY=11): full **8-bit currency code = 256 currencies**, covering all active ISO 4217 codes + crypto + regional currencies. VALUE_TIER (previously planned here) has moved to fin_control, freeing the full byte for currency.

### D13 — Participants: IS_ORG flag
`IS_ORG` added to part_flags bit 0 (previously reserved). Distinguishes company/organisation participants from individuals. No other structural change to participants block.

**Participants role codebook:** Will be extended to 1–3 bytes to exhaustively cover all business roles globally with groupings. Design deferred to end-of-session deliverable.

### D14 — fin_control byte
New first byte of the financial block (always present when field_flags bit 12 set). Consolidates scattered financial block controls:

```
fin_control byte:
  bit 7: BILLED          — 1=charge passed to customer (invoice line item)
  bit 6: ACCOUNT_PAIR_EXT — 1=bits 5-2 carry BitLedger Account Pair (standard mode)
  bits 5-2: dual-role
    DOMAIN=01 (simple):  additional financial flags (EXPENSE_CATEGORY, QTY_TYPE, etc.)
    DOMAIN=10 (standard): 4-bit BitLedger Account Pair
  bit 1: CUSTOMER_AMT    — customer-facing amount present
  bit 0: WORKER_AMT      — worker/cost amount present
```

Replaces field_flags3 bit 7 (WORKER_AMOUNT). Final bit layout per D17 + D21:
```
  DOMAIN=01: bit7=BILLED | bit6=0 | bit5=QTY_TYPE | bit4=PARITY | bits3-2=EXPENSE_CATEGORY | bit1=CUSTOMER_AMT | bit0=WORKER_AMT
             PARITY = even parity of bits (7, 3, 2, 1, 0)
             bit6=0 and bit4=0 are additional implicit integrity checks (must be 0 in simple mode)
             EXPENSE_CATEGORY=11 is reserved (another integrity signal)
             EXPENSE_CATEGORY: 00=job charge (billed), 01=job cost (COGS), 10=running cost, 11=reserved
  DOMAIN=10: bit7=BILLED | bit6=1 | bits5-2=ACCOUNT_PAIR(4-bit) | bit1=CUSTOMER_AMT | bit0=WORKER_AMT
             ACCOUNT_PAIR codes 1110 and 1111 are reserved in non-compound context — restricted code space provides integrity check
```
Four integrity dimensions in simple mode: bit6 must be 0, bit4 must be 0, PARITY(bit5) over 5 content bits, EXPENSE_CATEGORY≠11.

### D15 — Formula-based value encoding (replaces D7 tiers)
VALUE_TIER eliminated. All amounts are fixed **3-byte uint24**. Real value = `(uint24 × SF) / 10^D` where SF is the scaling factor and D is DECIMAL_POS from setup_byte.

- Default SF=1: uint24 covers 0–16,777,215 units. At DECIMAL_POS=2 (penny precision): max £167,772.15.
- With SF=10: max £1,677,721.50. SF=1000: max £16.7B — covers all African market scales.
- SF declared in optional `sf_byte` (present when setup_byte bit 0 SF_PRESENT=1).
- QTY and RATE (when QTY_SPLIT=1) use the same uint24 + SF formula.

**Real-world benchmarks (NGN at DECIMAL_POS=0):**
- NGN 500 smallholder invoice: uint24=500, SF=1 — fits trivially
- NGN 1,500,000 contractor: uint24=150, SF=10000 — fits in 3 bytes
- NGN 1,670,000,000 enterprise: uint24=167, SF=10000000 — fits

### D16 — Setup byte restructured for SF_PRESENT
setup_byte bit 0 changed from COMPOUND_VALUE to **SF_PRESENT**. COMPOUND_VALUE moved to sf_byte.

```
setup_byte:
  bits 7-5: DECIMAL_POS (0-7 decimal places)
  bits 4-3: CURRENCY (00=home, 01/10=codebook common, 11=extended)
  bits 2-1: TAX_CODE
  bit 0:    SF_PRESENT (was COMPOUND_VALUE)

sf_byte (present when SF_PRESENT=1):
  bits 7-5: SCALING_FACTOR (3-bit: 0=×1, 1=×10, 2=×100, 3=×1K, 4=×10K, 5=×100K, 6=×1M, 7=×1B)
  bit 4:    COMPOUND_VALUE (moved from setup_byte)
  bit 3:    QTY_COMPACT — 0=three separate uint24s (default), 1=packed split block
  bits 2-0: SPLIT_POINT — when QTY_COMPACT=1: bits allocated to qty (0-7); default 0b100=4 (→8 qty bits)
```

### D17 — fin_control simple mode final layout
VALUE_TIER bits eliminated from simple mode fin_control. Final layout confirmed, no overlaps:

```
  DOMAIN=01: bit7=BILLED | bit6=0 | bit5=QTY_TYPE | bit4=unused | bits3-2=EXPENSE_CATEGORY | bit1=CUSTOMER_AMT | bit0=WORKER_AMT
  DOMAIN=10: bit7=BILLED | bit6=1 | bits5-2=ACCOUNT_PAIR(4-bit) | bit1=CUSTOMER_AMT | bit0=WORKER_AMT
```

EXPENSE_CATEGORY (bits 3-2, simple mode): `00`=job charge (billed to customer), `01`=job cost (COGS, absorbed), `10`=running cost (activity overhead), `11`=reserved.

### D18 — ROUNDING bits: keep 2 bits, creator-controlled
Two ROUNDING bits kept in both simple and standard mode. **Rounding is creator-controlled, not mandated.**

- `00` = exact (no rounding applied) — always valid, record creator's choice
- `10` = round down — income/recovery records (conservative)
- `11` = round up — expense/liability records (conservative)
- `01` = error/invalid — never set intentionally; detects corruption if decoded

**Default encoder behaviour:** applies conservative rules (down for income, up for expenses) as a suggestion only. Creator can override to `00` (exact) at any time. In amendment/edit sequences, the editor proposes rounding for the new revision — `00` = "I am proposing no rounding" is a common edit action. Decoders treat `01` as a structural error signal.

### D20 — Participants role codebook (1–2 byte extended codes)
ROLE_TYPE 3-bit quick-select (0–6) retained for zero-byte common roles. ROLE_TYPE=7 signals extended code.

When ROLE_TYPE=7:
- `HAS_ROLE_TEXT=0`: role_code bytes follow (no length prefix). Byte 1 `0x00`–`0xFE` = 1-byte code from 16-group codebook; `0xFF` = 2-byte extension.
- `HAS_ROLE_TEXT=1`: `[uint16 len][UTF-8]` free-text role label (unchanged).

**1-byte groups (bits 7-4 = group, bits 3-0 = role):**
Group 0=Leadership, 1=Finance, 2=Legal, 3=Professional Svcs, 4=Healthcare, 5=Construction/Trades, 6=Agriculture, 7=Transport, 8=Retail/Commerce, 9=Personal Svcs, A=Technology, B=Manufacturing, C=Government, D=Education, E=Community/Dev, F=Specialized/Other (0xFF=escape).

Full codebook: `workpadskaios/system/ROLE-CODEBOOK.md`

### D22 — Standard fields planning: canonical registry, synonyms, subtypes, Contact template
Full spec in `workpadskaios/system/STANDARD-FIELDS.md`. Key decisions:

**Field flags registry (final):**
- bits 0-11: existing pads-v2 fields (`job`, `customer`, `date`, `location`, `meeting_time`, `start_time`, `end_time`, `customer_phone`, `worker`, `actions`, `details`, `story`) — unchanged from pads-v2-encoding-spec.md
- bit 12: `financial_block` gate (unchanged)
- bit 13: `ref_number` — invoice/job/quote reference (`[u8 len]` compact text, max 64 B)
- bit 14: `due_date` — payment/action due date (COMPACT_TIME: u16 days)
- bit 15: `FLAGS3_PRESENT` gate

**FLAGS3 (bits 0-6):** `context_label`(0), `tag`(1), `qty_unit`(2), `expiry_date`(3), `attachment`(4), `uid`(5), `url`(6)

**Synonym/relabelling:** templates define a `label_map` JSON object mapping canonical field names to sector labels. Canonical index always used in wire format; labels applied at render time only. Sectors defined: healthcare, legal, construction (default), agriculture, retail.

**Contact/entity template (BASE_TEMPLATE=011):** `job`=FN, `customer`=ORG, `location`=ADR, `customer_phone`=TEL, `worker`=TITLE, `details`=NOTE, `ref_number`=ROLE, `uid`(FLAGS3)=UID, `url`(FLAGS3)=URL.

**Transaction subtypes for 4 reserved states (fully defined):**
- I<O: 00=full refund, 01=partial refund, 10=warranty/goodwill, 11=overpayment return
- I>O: 00=credit note, 01=return auth, 10=discount, 11=credit balance
- O<I: 00=general reimbursement, 01=travel reimbursed, 10=materials recovered, 11=advance returned
- O>I: 00=claim submitted, 01=travel claim, 10=materials claim, 11=advance requested

**SELF_DESCRIBING index:** 0x00-0x0E = bits 0-14 in order; 0x10-0x16 = FLAGS3 bits 0-6; 0x80-0xFE = custom/template-defined.

**BitLedger wholesale value adoption:** NOT adopted. Binary N=A×2^S+r is byte-equivalent or worse vs decimal uint24+SF for common invoice amounts. uint24+SF retained (D15). Selective BitLedger adoptions: Account Pair (D6), rounding rules (D18), restricted code integrity (D21).

### D21 — fin_control parity: bit 4 as integrity check, QTY_TYPE retained in bit 5

QTY_TYPE stays in bit 5 — moving it to standard fields penalises simple-mode workers (costs a FLAGS3 byte + data block for every QTY_SPLIT record). Bit 4 (previously "must be zero") becomes PARITY over bits 7, 5, 3, 2, 1, 0, covering QTY_TYPE itself in the protection.

**Final simple mode (DOMAIN=01) fin_control — all 8 bits utilised:**
```
bit 7: BILLED      — charge passed to customer
bit 6: 0           — mode indicator (always 0; integrity check 1)
bit 5: QTY_TYPE    — 0=units/items  1=time/hours
bit 4: PARITY      — even parity of bits 7,5,3,2,1,0  (integrity check 2)
bit 3: EXPENSE_CATEGORY[1]
bit 2: EXPENSE_CATEGORY[0]  — 00=job charge  01=job cost  10=running  11=reserved (check 3)
bit 1: CUSTOMER_AMT
bit 0: WORKER_AMT
```

**Parity:** `P = BILLED XOR QTY_TYPE XOR EC1 XOR EC0 XOR CUSTOMER_AMT XOR WORKER_AMT` (6 bits covered)

**Four integrity checks in one byte:**
| Check | Condition | Detects |
|-------|-----------|---------|
| 1 | bit 6 must be 0 | Mode mismatch / corruption |
| 2 | bit 4 = PARITY of (7,5,3,2,1,0) | Any single-bit flip across 6 content bits |
| 3 | EXPENSE_CATEGORY != 11 | Reserved code (corruption or future version) |
| 4 | QTY_TYPE=1 requires QTY_SPLIT=1 in transaction byte | Cross-field semantic consistency |

**Standard mode (DOMAIN=10):** bit 6 = always 1 (symmetrical check). ACCOUNT_PAIR restricted codes 1110/1111 provide 12.5% random-corruption detection without a parity bit.

**BitPads v2 alignment:** self-validating byte through overlapping validity constraints, zero CRC overhead. All 8 bits utilised: BILLED + mode indicator + QTY_TYPE + parity + 2-bit expense category + 2 amount-presence flags.

### D23 — BitLedger value encoding: compact qty path added; flat values confirmed adequate

**Full BitLedger Layer 3 analysis (2026-05-15):**

1. **N = A × 2^S + r is an algebraic identity** — `A = floor(N/2^S)`, `r = N mod 2^S`, therefore `N = A×2^S+r` for every integer. It is how bits are physically allocated, not a special compression formula. For flat values (QTY_SPLIT=0), workpads uint24 is functionally equivalent to BitLedger's 25-bit block.

2. **"High millions" is already solved by SF.** With SF=×100 and DECIMAL_POS=2: max = 16,777,215 × 100 / 100 = ₦16.7M at ₦0.01 precision. With SF=×1K: ₦167M. With SF=×1M: ₦167B. Covers every real-world field service transaction globally.

3. **Optimal Split is only meaningful for qty/rate records.** BitLedger packs price + qty into one 25-bit block using a configurable split S. Workpads currently uses three separate uint24 fields (qty + rate + customer_amount = 9 bytes). Adding `QTY_COMPACT` mode reduces qty/rate records to 3 bytes — a 6-byte saving per time-and-materials line.

4. **Compound continuation** already adopted via COMPOUND_VALUE in sf_byte (D16).

**sf_byte bits 3-0 reallocated (previously reserved):**
```
bit 3: QTY_COMPACT  — 0=three separate uint24s (default), 1=packed split block
bits 2-0: SPLIT_POINT — when QTY_COMPACT=1:
  0 = default (8 qty bits — lower 8 bits=qty, upper 16=rate; mirrors BitLedger S=8)
  1–7 = exactly that many bits allocated to qty (1 to 7)
```

**QTY_COMPACT=1 split table:**
| Stored value | qty bits | qty max | rate bits | rate max (DECIMAL_POS=2, SF=×1) |
|---|---|---|---|---|
| 0 (default) | 8 | 255 | 16 | £655.35 (SF×10: £6,553.50) |
| 1 | 1 | 1 | 23 | £83,886.07 |
| 2 | 2 | 3 | 22 | £41,943.03 |
| 3 | 3 | 7 | 21 | £20,971.51 |
| 4 | 4 | 15 | 20 | £10,485.75 |
| 5 | 5 | 31 | 19 | £5,242.87 |
| 6 | 6 | 63 | 18 | £2,621.43 |
| 7 | 7 | 127 | 17 | £1,310.71 |

**Default (SPLIT_POINT=0 → 8 qty bits):** Covers qty ≤ 255, rate ≤ £655/unit at D=2; or ≤ £6,553 with SF=×10. Mirrors BitLedger's default Optimal Split of 8. Adequate for >95% of field service T&M records.

**Fallback rule:** Encoder uses QTY_COMPACT=1 only when qty and rate both fit within their allocated bit widths. Otherwise falls back to QTY_COMPACT=0 (three uint24s, 6 bytes). No loss of precision — the compact path is an optimisation, not a constraint.

### D24 — FLAGS3_PRESENT: field_flags bit 15 only; meta2 bit 5 freed

FLAGS3_PRESENT appeared in both meta2 bit 5 (from original pads-v2 spec) and field_flags bit 15 (from D22 standard fields session). Having it in both is redundant and wastes a meta2 bit.

**Resolution:** FLAGS3_PRESENT lives exclusively at **field_flags bit 15**. This is structurally correct — the flags register extends its own presence. meta2 bit 5 becomes **reserved** (must be 0; available for future assignment).

**Updated meta2:**
```
bit 7: SELF_DESCRIBING    — 1=self-describing blocks (field-name index prefix per data block)
bit 6: COMPACT_TIME       — 1=date/time as binary (uint16 days / uint16 minutes); 0=ISO strings
bit 5: (reserved)         — was FLAGS3_PRESENT; must be 0
bit 4: PARTICIPANTS       — 1=participants block follows data blocks
bits 3-2: DOMAIN          — 00=none, 01=simple (I>O), 10=standard (BitLedger), 11=reserved
bit 1: DRAFT              — 1=working draft, not finalised
bit 0: RESTRICT_FORWARD   — 1=recipient must not forward
```

### D19 — Field flags density principle
Bit assignment ordering for field_flags and extension bytes:
- **bits 0–11** (field_flags, 12 slots): fields present in >50% of records
- **FLAGS3 bits 0–6** (7 slots): fields present in 5–50% of records
- **FLAGS4+ bits**: domain-specific, template-defined, or rare fields (<5%)

Canonical field registry (standard fields planning session) must apply this principle aggressively — only truly universal fields get low bits.

---

## Current Target Frame (Draft)

```
[ meta1 ]                    1 byte — always
  7 META2_PRESENT | 6 EXT_TEMPLATE | 5-3 BASE/EXT | 2 ACK_REQUEST | 1 CHAIN | 0 RECIPIENT_TYPE

[ ext_template ]             1–3 bytes — if EXT=1 (domain or variant type)

[ meta2 ]                    1 byte — if META2_PRESENT
  7 SELF_DESCRIBING | 6 COMPACT_TIME | 5 (reserved,0) | 4 PARTICIPANTS
  3-2 DOMAIN (00=none 01=simple 10=standard 11=reserved) | 1 DRAFT | 0 RESTRICT_FORWARD

[ setup_byte ]               1 byte — if DOMAIN ≥ 01
  7-5 DECIMAL_POS | 4-3 CURRENCY (00=home 01/10=common 11=ext) | 2-1 TAX_CODE | 0 SF_PRESENT

[ currency_ext ]             1 byte — if CURRENCY=11
  8-bit currency code (256 currencies, ISO 4217 aligned)

[ sf_byte ]                  1 byte — if SF_PRESENT=1
  7-5 SCALING_FACTOR (×1/×10/×100/×1K/×10K/×100K/×1M/×1B) | 4 COMPOUND_VALUE | 3 QTY_COMPACT | 2-0 SPLIT_POINT

[ transaction_byte ]         1 byte — if setup_byte present
  DOMAIN=01: 7 DIRECTION | 6 TIME | 5 EFFECT | 4-3 SUBTYPE | 2 QTY_SPLIT | 1-0 ROUNDING
  DOMAIN=10: 7-4 ACCOUNT_PAIR | 3 DIRECTION | 2 STATUS | 1 QTY_SPLIT | 0 ROUNDING

[ field_flags ]              2 bytes — always
  bits 0–14: standard field presence | bit 15: FLAGS3_PRESENT

[ field_flags3 ]             1 byte — if FLAGS3_PRESENT
  bit 7: FLAGS4_PRESENT (chainable) | bits 6-0: 7 domain/extended field slots

[ data blocks ]              per set flag, ascending bit-order
  SELF_DESCRIBING=0: [uint16 len][UTF-8] for text; [uint24] for amounts (Tier 3 default)
  SELF_DESCRIBING=1: [uint8 field-name-index][uint16 len][UTF-8] for text; same for amounts

[ financial block ]          if field_flags bit 12
  [1B] fin_control           BILLED | ACCOUNT_PAIR_EXT | dual-role bits | CUSTOMER_AMT | WORKER_AMT
  [3B] customer_amount       uint24 — if CUSTOMER_AMT
  [3B] worker_amount         uint24 — if WORKER_AMT
  [tax_block]                if TAX_CODE=11: [1B permille rate][2B tax amount]
  [qty+rate block]           if QTY_SPLIT=1:
                               QTY_COMPACT=0: [3B qty][3B rate]   (two independent uint24s, 6 bytes)
                               QTY_COMPACT=1: packed in customer_amount uint24 already present
                                              lower SPLIT_POINT bits = qty, upper (24-SPLIT_POINT) bits = rate
                                              Real Value = (rate × qty × SF) / 10^D

[ participants ]             if PARTICIPANTS=1
  [1B] block_header          bits 7-5: count (1-7) | bits 4-0: reserved
  per participant:
    [1B] part_flags          IS_SENDER(7) | ROLE_TYPE(6-4, 3-bit) | HAS_PHONE(3) | HAS_EMAIL(2) | HAS_ROLE_TEXT(1) | IS_ORG(0)
    [2+N] name               uint16 + UTF-8
    [2+M] phone              if HAS_PHONE
    [2+P] email              if HAS_EMAIL
    [role_code]              if ROLE_TYPE=111 and HAS_ROLE_TEXT=0: 1B (0x00-0xFE) or 2B (0xFF + 1B)
    [2+Q] role_text          if ROLE_TYPE=111 and HAS_ROLE_TEXT=1: uint16 + UTF-8 free text

[ context_label ]            if field flag bit set (TBD which bit)
  [1B len][UTF-8, max ~30 chars]
```

---

## Three-Category Expense Model

| Category | Worker language | Billed? | Parent job? | fin_control | I>O state |
|----------|----------------|---------|-------------|-------------|-----------|
| Job charge | "Charged to job" | YES | YES | BILLED=1 | `O<O` or `O>O` |
| Job cost (COGS) | "Job cost" | NO | YES | BILLED=0 | `O<O` or `O>O` |
| Running cost | "Running cost" | NO | NO | BILLED=0 | `O<O` or `O>O` |

UI entry flow: "Job cost?" → YES → "Billed to customer?" → YES/NO. Running costs entered from Activity level with no parent job.

---

## Open Items for Upcoming Sessions

### Standard Fields Planning Session — **COMPLETE (D22)**
Full registry in `workpadskaios/system/STANDARD-FIELDS.md`.
- Canonical field registry (bits 0-14 + FLAGS3 bits 0-6): complete
- Synonym/relabelling system (`label_map` in template definition): complete
- FLAGS3 slot assignments (context_label, tag, qty_unit, expiry_date, attachment, uid, url): complete
- Subtypes for all 4 reserved I>O states (I<O, I>O, O<I, O>I): complete
- CONTEXT_LABEL → FLAGS3 bit 0: complete
- Contact/entity template vCard mapping: complete
- SELF_DESCRIBING index (0x00-0x16 canonical, 0x80-0xFE custom): complete

### vCard / VCF Contact Integration (Q19)
Architecture settled — two-layer approach:

**Layer 1 — Participants block (compact, transaction-time):** Current block already covers vCard FN (name), TEL (phone), EMAIL (email), ROLE (role_code/text), ORG (IS_ORG + name). No structural changes needed.

**Layer 2 — Contact/entity template (BASE_TEMPLATE=011):** Full vCard-equivalent workpads record. Standard fields session will define the canonical field set including:
- `UID` — unique contact identifier (maps to vCard UID; enables stable cross-record linking)
- `ADR` — structured address (vCard ADR: pobox/ext/street/city/region/postal/country)
- `URL` — website or social profile
- `ORG` — organisation affiliation (for person participants who belong to an org)
- `NOTE` — contact notes

**vCard field mapping:**
| vCard 4.0 | Workpads | Location |
|-----------|----------|----------|
| FN / N | name | participants block |
| TEL | phone | participants block |
| EMAIL | email | participants block |
| ROLE / TITLE | role_code / role_text | participants block |
| ORG | name (when IS_ORG=1) | participants block |
| UID | uid field | Contact/entity template |
| ADR | address field | Contact/entity template + main record fields |
| URL | url field | Contact/entity template |
| NOTE | note field | Contact/entity template |
| PHOTO | out of scope | — |

**App-level features (not codec changes):**
- Import participant from KaiOS device contacts (`navigator.mozContacts.find()`)
- Export participants to vCard string for sharing via SMS/WhatsApp
- "Add participant" picker can draw from stored Contact/entity records
- Phone/email match links transaction-time participant snapshot to full Contact record for UI enrichment

**Link mechanism:** participants block phone or email matches Contact/entity record phone or email. No explicit foreign key in the wire format needed for most use cases.

### Participants Role Codebook — **COMPLETE (D20)**
Full codebook saved to `workpadskaios/system/ROLE-CODEBOOK.md`.
- 7 zero-byte ROLE_TYPE quick-select codes (Customer, Worker, Supplier, Subcontractor, Employee, Agent, Authority)
- 240 specific named roles in 1-byte range (16 groups × 15 roles, 0x00–0xFE)
- 224 specialist/regional roles in 2-byte range (0xFF prefix)
- Free-text fallback always available (HAS_ROLE_TEXT=1)
- Coverage: ISCO-08, African informal economy, global south, gig economy

### Target Frame Complete Sketch Session — **COMPLETE (D24)**
Full spec in `workpadskaios/system/FRAME-SPEC.md`.
- Complete byte-by-byte frame layout (all conditions, all variants)
- I>O subtype table (all 8 states × 4 subtypes = 32 codes)
- 5 named frame profiles with exact byte counts (Profile A–E)
- Benchmark: pads-v1 vs 1eg/ (28–33% raw byte reduction; 50–60 char URLs vs 70–80)
- Migration path: dual-codec phase, gradual re-encoding, legacy sunset (12+ months)
- 1eg/ → pads-v1 field mapping table
- Open implementation-time design points

### Remaining Open Questions
| Q | Topic | Notes |
|---|-------|-------|
| Q14 | Subtypes for I<O / I>O / O<I / O>I | **Resolved → D22** — see STANDARD-FIELDS.md §7 |
| Q15 | Full canonical field registry | **Resolved → D22** — see STANDARD-FIELDS.md §2-4 |
| Q16 | SELF_DESCRIBING: per-block index vs remapping table | **Resolved → D22** — per-block index (1 byte per block); see STANDARD-FIELDS.md §8 |
| Q17 | fin_control bit overlap — VALUE_TIER vs EXPENSE_CATEGORY | **Resolved → D17** VALUE_TIER eliminated by D15; no conflict |
| Q18 | Participants role codebook design | **Resolved → D20** — see ROLE-CODEBOOK.md |
| Q19 | vCard/VCF contact standard integration | **Architecture settled** — see vCard section above. Standard fields session defines Contact/entity template field set. App features: KaiOS mozContacts import/export |

---

## Security Layer (OQ-14 — design complete, implementation deferred)

Full spec in `OPEN-QUESTIONS.md §OQ-14`. Summary:

**URL tags:**
- `1ps` — full encryption + full scramble (everything after tag encrypted)
- `1ph` — partial encryption + scramble (meta header visible, field data scrambled+encrypted)
- `1pt` — template-keyed (template content hash = key; template ID advertised plainly in URL)

**Five-layer protection model:**
```
Layer 1  Template type visible (1ph only) — no field/amount leakage
Layer 2  Deflate seed poisoning — key-derived prefix before compression; rewrites entire compressed bitstream
Layer 3  Semantic scramble — field_flags bit assignments + data block order permuted by key
Layer 4  AES-CTR cipher (WebCrypto) / RC4 fallback
Layer 5  Receiver commitment — HMAC(key, sender||receiver) appended; identity-binds the record
```

**Key sources:**
- Passphrase: `master = SHA-256(passphrase || salt)` — split into cipher_key + scramble_seed
- Template (`1pt`): `master = SHA-256(SHA-256(template_content) || salt)` — template IS the shared secret; ID in URL is routing hint only; safe to advertise publicly when template exists on only two devices

**Additional mechanisms:**
- Honey record (opt-in): decoy frame with trivial key appended inside encrypted payload; breaks brute-force feedback loop
- Chain ratchet (opt-in): `key_N = SHA-256(key_{N-1} || salt_N)` for chained records; cannot enter chain mid-sequence

**Forced constraints:** SELF_DESCRIBING=0; field_flags3 unused bits randomised.

**Codec impact:** None. All layers are a wrapper module. FRAME-SPEC.md unchanged.

**UX:** Per-contact standing codes (passphrase or template association) stored encrypted in app. Zero per-record friction after initial setup.

**Open sub-decisions:** OQ-14a through OQ-14k — see OPEN-QUESTIONS.md.

### Template System (OQ-15–19 — design in progress)

Two connected product needs: (a) converting any system template into a protected template (`1pt` key source), and (b) open form building — creating templates from scratch. Both produce a **template definition** artifact. Codec mechanics already support this (D4 template ID scheme, D22 label_map, OQ-14g `1pt`). New design work covers:

- **OQ-15** — Template definition JSON schema + canonical serialisation for SHA-256 hashing. `block_order` array IS the scramble permutation for `1pt` records — no separate key derivation needed.
- **OQ-16 RESOLVED** — `/t/` path dropped (server receives payload — violates no-server-observation principle). Template shares use fragments: `#t/<payload>` (unencrypted) and `#te/<encrypted-payload>` (passphrase-encrypted). QR/NFC is the canonical mechanism for protected templates; fragment URLs are the fallback for remote sharing. JS-rendered previewers mitigated by scrambling (ciphertext only) + app serving generic static meta tags.
- **OQ-17** — Form builder field types: text, text_compact, date, time, amount, integer, boolean, select, phone, url. Custom fields use FLAGS4 slots; choices for `select` type stored in template definition.
- **OQ-18** — Protected templates are immutable once shared. Modifications produce new template (new ID, new hash). UI: lock icon + "Duplicate and edit" only. Metadata-only changes (name) exempt since `name` excluded from canonical hash.
- **OQ-19** — Templates stored content-addressed (by hash). Multiple versions with same human name stored as separate hash entries. App tries each hash for a given ID until commitment check (OQ-14k) passes — correct version auto-selected for historical decode.

### Presentation Records (OQ-20–26 — design in progress)

Micro-billboard use case: a `#1pb/` URL payload rendering as a self-contained page experience. Full spec in `OPEN-QUESTIONS.md §OQ-20–26`. Summary:

**URL tag:** `1pb` — pads v1, billboard/presentation. No transaction byte; carries display schema + optional form schema.

**Receptive shell:** `workpads.me/p` handles all tags including `1pb`. Server serves only generic meta tags; fragment is never visible to server.

**Display schema block:**
```
DISPLAY_MODE (2 bits): 00=card | 01=list | 10=page | 11=custom
LAYOUT (2 bits): 00=single col | 01=two col | 10=hero+body | 11=template-defined
accent_color: u24 RGB
field_order: byte[] — display sequence
section_labels: text[] — optional section headings
hide_mask: u16 — 1=hide field even if populated
```

**Form schema block (when collect-and-reply needed):**
```
SUBMIT_ACTION (2 bits): 00=reply record | 01=open URL | 10=native share | 11=in-app
editable_mask: u16
required_mask: u16
response_template_id: 3 bytes
response_contact: minimal participant block
```

**data_source modes:**
- `00` Inline — all values in payload
- `01` Sender contact card — device-resident lookup by phone/email
- `10` Activity profile — sender's business identity record
- `11` Hybrid — per-field inline vs device-resident

**Contact-resident display mode (OQ-25):** Extreme-minimal payload variant. Only an identifier (name, phone, or email) travels in the URL. Receiver's device fills all remaining display data from local contacts on match. Payload ~15–20 bytes. If no match: show identifier + "Not in your contacts." Ultra-private: interceptor learns nothing about sender identity.

**Structured JS in payload (OQ-26):** Constrained JS DSL for custom micro-app experiences in `1pb` records. Trust-gated: only `1pt` (with `allow_js: true` in template) and `1ps` (established per-contact code) may carry executable logic. Sandboxed in iframe; communication via postMessage API. Inline JS targets <1KB compressed; larger scripts use fetch-target with hash-pinning. Deferred post-MVP.

---

### Type Picker → Transaction Byte Clarification (Round 13)

The current `TEMPLATE_TYPES` list in `list.js` (Job, Quote, Invoice, Receipt, Basic, Business) conflates two pads-v1 concepts that are structurally separate:

**Template type** (meta1 bits 6–3 BASE_TEMPLATE) — *what kind of record it is:*
- Financial record (001) — covers Job, Quote, Invoice, Receipt
- Contact/entity (011) — covers Business/newent
- Service record (001) — same template, different transaction state

**Transaction byte** (I>O state) — *what financial event it represents:*
| Current UI label | pads-v1 transaction byte |
|---|---|
| Job | `I>I` sub=00 (invoice pending) or omitted |
| Quote | `I>I` sub=01 (estimate) |
| Invoice | `I>I` sub=00 |
| Receipt | `I<I` sub=00 (payment received) |

These are not different templates — they are the same Financial record template with different transaction bytes. The type picker in the wizard should be reframed as a **transaction type selector**, not a template selector.

`Business` (`newent`) is a genuine structural outlier — Contact/entity template (011). It should be removed from the shared type picker and placed in its own creation flow (Activity setup or Contacts).

**UI consequence:** The type picker split: first implicit choice is "Financial record" (for 95% of uses) vs "Contact/entity" (rare, own entry point). Within Financial records, the transaction type (Quote / Invoice / Payment received / Expense etc.) is the meaningful choice — and maps directly to the transaction byte.

### Service Units and Service Catalog → Wire Format (Round 14)

Service catalog entries carry a **unit** field that maps directly to codec fields:

| Unit | QTY_SPLIT | qty_unit (FLAGS3 bit 3) |
|---|---|---|
| `job` (fixed price) | 0 — lump sum | absent |
| `hour`, `day`, `km`, `sqft`, custom | 1 — qty × rate | unit string (text_compact, ≤20 chars) |

`qty_unit` (FLAGS3 bit 3, text_compact encoding) already specified. QTY_SPLIT already in transaction byte. No new codec fields needed — service unit maps cleanly to existing design.

Service `category` field maps to fin_control:
- `charge` → EXPENSE_CATEGORY=00, BILLED=1 (job charge — billed to customer)
- `cost` → EXPENSE_CATEGORY=01, BILLED=0 (job cost — absorbed COGS)

**"Job charge" and "job cost" are retained as the canonical UI labels** for EXPENSE_CATEGORY 00/01 throughout the app.

**Service menu as `#1pb/` advertisement:** Uses COMPOUND_VALUE=1 financial block — each service is a compound line item (name + amount + optional qty_unit). IS_ORG participant carries trading name + phone. Four services ≈ ~60–70 bytes deflated, ~90 URL chars — fits SMS. COMPOUND_VALUE=1 is the correct mechanism; no new block type needed.

### Service Templates with Associated Cost Lines (Round 15)

A saved service is a **service template** — a billing line plus optional pre-defined cost lines, each independently configured. No new codec fields needed; each cost line generates a standard child record.

**Extended service data model (app-side):**
```js
{
  id, name, unit, price, category: 'charge',
  costs: [
    { name, unit, rate, category: 'cost', qty_link: 'billing'|'fixed'|'enter'|'enter_rate' }
  ]
}
```

**qty_link values:**
- `billing` — same qty as the charge line (auto, no worker input)
- `fixed` — always the stored amount (auto, no worker input)
- `enter` — worker enters qty at job time
- `enter_rate` — worker enters rate; qty from billing line

**Billing unit ≠ cost unit is supported:** charge can be `per job` (lump sum, QTY_SPLIT=0) while a cost line tracks `per hour` (QTY_SPLIT=1, qty_link='enter'). Worker enters hours once; charge and costs are recorded independently.

**Wire format:** Each cost line → separate child record. Standard Financial record (001) with transaction byte `O<O`/`O>O`, BILLED=0, QTY_SPLIT per unit. No new block types.

**OQ-28 flagged:** `service_ref` field — should records carry a reference to the service template that generated them? (analytics, edit-reload, advertisement back-link). Anticipated in 1eg/ bit 18; needs FLAGS3 or FLAGS4 slot in pads-v1.

### Multi-Worker Pay Rates (Round 17)

Roster + rate table are app-side only; each worker's pay generates a standard child record.

**Data model (app):**
- `activity.workers` — name + role + optional contactId. Contacts not required.
- `activity.rateTable` — resolution chain: per-worker×service → per-worker default → per-role fallback. Returns rate + unit at wizard time.

**Wire format per worker cost record:**
- Financial record (001), `O<O`/`O>O`, BILLED=0, RECIPIENT_TYPE=1, EXPENSE_CATEGORY=01
- Participant: worker name + role; phone/email if contact linked
- QTY_SPLIT=1 for hourly; QTY_SPLIT=0 for per-job rate
- `worker_amount` (fin_flags bit 7): useful for sole-trader single-record pattern; multi-worker uses separate child records instead

No new codec fields. Rate resolution is entirely app-side.

### Taxing and Benefits — Inheritance Model (Round 19)

Three-level pay config inheritance: global → activity → worker. Each level inherits and can override, add, or remove items.

**Deduction item properties:** type (`pct`/`flat_per_job`/`flat_per_unit`/`flat_per_period`/`progressive`/`threshold`), rate/amount, base (`gross`/`taxable`/`net`), side (`employee` = reduces take-home / `employer` = adds to employer cost).

**Three activity pay modes:** Off (no deductions), Simple (gross + worker_amount net), Full (COMPOUND_VALUE=1 with itemised deduction lines).

**Wire format:**
- Record primary amount = total employer cost
- `worker_amount` (fin_flags bit 7) = net take-home
- Full mode: COMPOUND_VALUE=1 compound block with deduction line items

**OQ-29 (revised — compound line flags byte, tax default = "--"):**

Tax model: default is `--` (not applicable) for every line and every record. No silent inheritance. Column/section only appears in UI when at least one line has an explicit treatment.

```
bits 7–6: LINE_TYPE  00=standard | 01=deduction | 10=employer-add | 11=summary
bits 5–4: TAX_MODE   00=-- (none) | 01=standard rate | 10=reduced rate | 11=zero/exempt
bit 3:    QTY_LINE   1=qty and rate fields follow this line's amount
bits 2–0: reserved
```

`LINE_FLAGS_PRESENT` in compound block header — set only when at least one line has a non-default flag. Absent = all lines are name+amount, no tax, no type. Backward compatible.

**setup_byte TAX_CODE reframed:** rate definition only (what standard/reduced rates ARE for this context), not a default applied to any line. TAX_CODE=00 = no tax applicable to this record. Single-line records: tax only present when user explicitly sets it.

**UI rule:** tax column hidden when all lines are `--`. First line to get a treatment triggers column header + tax subtotal row to appear. `--` cells show nothing (or faint dash) in the column.

### Customer View Levels, Field Correction, Two-Tier IDs (Round 26)

**Customer view levels:** Simple (flattened single-line) / Standard (BILLED=1 lines, default) / Detailed (full compound). Chosen at share time; stored record always complete. BILLED=0 lines never reach customer payload.

**Field-level correction:** Amendment (0xE) gains `line_index` byte for compound records — specifies which line was corrected. Changed fields (qty, rate) travel; total recalculated by receiver. Second tap in correction view unlocks individual fields.

**Two-tier ID system:**
- App-global: sequential `001` per contact, cross-activity, no role prefix
- Activity alias: optional per-activity override (e.g. `AH-2023`) displayed on that activity's records
- Wire: `ref_number` field carries whichever is active. No new codec field.
- Cross-device resolution: phone number is canonical. OQ-30 for global registration.

### KaiOS Correction Comparison View (Round 27)

Inline highlight approach — single view, changed fields marked with ● indicator. D-pad navigates to ● rows; centre expands to diff detail. Softkeys: Accept all / Reject / Counter. Field-level accept via centre on a ● row. Counter opens correction editor pre-filled with proposed value.

```
● Hours:   3.0 hr  (was 3.5)
  Rate:    £45/hr
● Total:   £135.00 (was £157.50)
  Date:    14 May
```

### No-Phone-Number Identifier — alt_id (OQ-31)

Many African users lack stable phone numbers. Participants block needs `alt_id` field:
- `app_uid` (type=1) — device-bound UID, shared via QR. Stable across SIM changes.
- `trade_name` (type=2) — market/trading name. Often more stable than personal phone.
- `national_id` (type=3) — opaque, user-opted. Ghana Card, NIN, etc.
- `location_label` (type=4) — "Adjamé Market Stall 12". Contextual.

Wire encoding: new part_flags bit (HAS_ALT_ID) + type byte + text_compact value. Multiple entries chained. Match order: phone → email → app_uid → trade_name+location. Full design in OQ-31.

**Template Catalogue:** Created `TEMPLATE-CATALOGUE.md` — 39 must-have templates (Groups A–J), 25 nice-to-haves. Obsidian checkbox format for tracking.

### Activity Group Membership (OQ-27)

`activityId` is currently app-only — it does not travel in the 1eg/ wire frame. Full analysis in `OPEN-QUESTIONS.md §OQ-27`.

**MVP approach:** IS_ORG participant in the participants block carries the sender's business name, phone, and email — sufficient for receiver-side attribution without a new codec field. No wire format change for MVP.

**Post-MVP path:** Activity UID as a compact reference field (FLAGS3 or FLAGS4 slot), enabling receivers to link incoming records to a pre-shared Activity/entity record. Aligns with OQ-25 contact-resident mode — Activity is pre-shared as a `#1pb/` contact card; subsequent records just reference its UID.

## Sync Obligations (when implementation begins)

| File | Change | Triggered by |
|------|--------|-------------|
| `workpadskaios/js/codec.js` | Full encoder/decoder rewrite | All frame decisions |
| `workpadskaios/js/screens/wizard.js` | Expense entry UI — job/running cost split + BILLED toggle | D14, three-category model |
| `workpadskaios/js/screens/ledger.js` | BILLED flag, fin_control encoding | D14 |
| `workpads-standard/codec.md` | Update to evolved spec | D3 (selectively, manually) |
| `workpads-standard/pads-v2-encoding-spec.md` | Update meta1, fin_control, currency, participants | Key deviations from yardstick |
| `workpads-standard/transaction-classification.md` | ~~Add subtypes for 4 reserved states~~ **DONE** | Q14/D22 |
| `workpads-standard/financial-block.md` | fin_control byte, BILLED flag, DOMAIN dual-mode | D6, D14 |
| `workpads-standard/participants-block.md` | Role codebook reference, role_code encoding | D20 |
