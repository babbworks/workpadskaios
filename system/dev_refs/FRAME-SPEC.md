# pads-v1 Frame Specification

**Status:** v1.0.1 — 2026-05-18  
**Decisions:** D1–D24 + CODEC-1/2/3; all §16 items resolved (see CODEC-EVOLUTION.md)  
**Includes:** DOMAIN=11 hybrid mode (§17); TEMPLATE-SYSTEM-DESIGN.md GPS+preamble updates; fin_control BILLED flag; CTRIG VERSION opcode SUPPORTED_FEATURES  
**Corrections (v1.0.1):** Profile A split into A-text (42B) and A-compact (33B) — prior 32B figure omitted meta2 byte. Profiles B/C/D meta2 DOMAIN field corrected: DOMAIN=01 sits at bits 3-2 (0x04), not bits 2-1 (0x02); hex values updated (0x42→0x44, 0x52→0x54). Profile D meta1 corrected: was 0xC8 (EXT_TEMPLATE=1, wrong), now 0x88 (EXT_TEMPLATE=0, Financial). Benchmark row updated: 42B→33B, saving 9B (not 10B).  
**Depends on:** STANDARD-FIELDS.md, ROLE-CODEBOOK.md  
**Replaces:** `1eg/` codec (codebook-c-kaios, current live)

---

## 1. Encoding Envelope

Every record is a binary byte sequence. The sequence is deflate-compressed, then base64url-encoded (no padding), then embedded in a URL fragment.

**URL scheme:** `workpads.me/p#<codebook-tag>/<base64url-deflated-frame>`  
**Codebook tag:** `1pa` — pads v1, package a. Resolved OQ-1.  
**Byte order:** big-endian for all multi-byte integers  
**Presence:** bytes present only if their condition is met; conditions chain (absent meta2 makes all meta2-gated bytes absent too)

---

## 2. Complete Frame Layout

```
═══ HEADER ════════════════════════════════════════════════════════

[meta1]                   1 byte — ALWAYS PRESENT

  bit 7: META2_PRESENT    1=meta2 byte follows; 0=meta2 absent
  bit 6: EXT_TEMPLATE     1=ext_template bytes follow; 0=BASE_TEMPLATE in bits 5-3
  bits 5-3: BASE_TEMPLATE (when EXT=0) or EXT_SIGNAL (when EXT=1)
  bit 2: ACK_REQUEST      1=sender requests delivery acknowledgement
  bit 1: CHAIN            1=record is chained (parent ref via &c= URL suffix)
  bit 0: RECIPIENT_TYPE   0=any receiver, 1=named recipient

BASE_TEMPLATE codes (EXT_TEMPLATE=0):
  000  Service record     (no financial block)
  001  Financial record   (single I>O transaction)
  010  Compound financial (multiple line items, COMPOUND_VALUE=1 in sf_byte)
  011  Contact/entity     (person or organisation record, vCard-equivalent)
  100  Document/media     (file reference record)
  101  State Commit       (snapshot — period summary, pay summary, job close)
  110  Amendment          (edit/revision of a prior record, carries parent UID)
  111  Generic            (DOMAIN bits in meta2 provide further context)

EXT_SIGNAL codes (EXT_TEMPLATE=1):
  001  +1 extension byte  (256 domain types per codebook package)
  010  +2 extension bytes (uint16 big-endian, 65,536 domain types)
  011  +3 extension bytes (24-bit, 16M domain types)
  100  Variant type       (3 bytes: CRC-8 namespace + CRC-16 local ID, decentralised)

───────────────────────────────────────────────────────────────────

[ext_template]            1–3 bytes — if EXT_TEMPLATE=1

  EXT_SIGNAL=001: 1 byte — domain type index within current codebook package
  EXT_SIGNAL=010: 2 bytes (uint16 big-endian)
  EXT_SIGNAL=011: 3 bytes (24-bit big-endian)
  EXT_SIGNAL=100 (variant, 3 bytes):
    byte 1: uint8 = CRC-8 of creator identity hash (256 namespace slots)
    bytes 2–3: uint16 = CRC-16 of (identity + template name + creation date)
    Collision probability: ~1 in 16M across all namespaces

───────────────────────────────────────────────────────────────────

[meta2]                   1 byte — if META2_PRESENT=1

  bit 7: SELF_DESCRIBING  0=template-dependent blocks (compact, semantic security)
                          1=self-describing blocks (1-byte field-name index per data block)
  bit 6: COMPACT_TIME     0=date/time as text ([u16 len][UTF-8 ISO string])
                          1=date as uint16 days since 2000-01-01; time as uint16 minutes since midnight
  bit 5: HAS_TRIG_BLOCK   1=TRIG bytecode block present (top-level, after participants block)
  bit 4: PARTICIPANTS     1=participants block follows data blocks
  bits 3-2: DOMAIN        00=none (no financial), 01=simple (I>O perspective), 10=standard (BitLedger Account Pair), 11=hybrid (I>O + Account Pair — same setup/transaction bytes as 01, plus account_pair_byte; see §17)
  bit 1: DRAFT            1=working draft, not finalised
  bit 0: RESTRICT_FORWARD 1=record must not be forwarded by recipient

═══ FINANCIAL CONTEXT (present when DOMAIN ≥ 01) ═════════════════

[setup_byte]              1 byte — if DOMAIN ≥ 01

  bits 7-5: DECIMAL_POS   decimal places in all amount fields
                          000=0 (whole units)  001=1  010=2 (pence/cents)
                          011=3  100=4  101=5  110=6 (crypto)
                          111=flat uint24 mode (amounts are raw smallest-unit integers; no scaling)
  bits 4-3: CURRENCY      00=sender home currency (zero overhead for local records)
                          01=first codebook common cross-currency
                          10=second codebook common cross-currency
                          11=extended (currency_ext byte follows)
  bits 2-1: TAX_CODE      00=no tax  01=tax inclusive (rate+amount in tax_block)
                          10=tax exclusive/added on top (rate+amount in tax_block)
                          11=compound tax (multiple rates, post-MVP)
                          Note: 01/10/11 all require a tax_block. No rates are assumed or codebook-defined.
  bit 0: SF_PRESENT       0=Scaling Factor=×1 (default)  1=sf_byte follows

───────────────────────────────────────────────────────────────────

[currency_ext]            1 byte — if CURRENCY=11

  uint8 currency code (0x00–0xFF): 256 currency slots
  0x01–0x1F: Major global and reserve currencies; 0x20–0x4F: Africa region; 0x50–0x6F: Asia-Pacific; 0x70–0x8F: Americas; 0x90–0xAF: Europe (non-EUR); 0xB0–0xCF: Middle East and Central Asia; 0xD0–0xEF: Digital/crypto and special; 0xF0–0xFE: reserved
  Full code table: see OQ-3 in OPEN-QUESTIONS.md. OQ-3 is authoritative.
  0xFF: reserved

───────────────────────────────────────────────────────────────────

[sf_byte]                 1 byte — if SF_PRESENT=1

  bits 7-5: SCALING_FACTOR  000=×1  001=×10  010=×100  011=×1,000
                             100=×10,000  101=×100,000  110=×1,000,000  111=×1,000,000,000
  bit 4: COMPOUND_VALUE    1=this financial block is a summation (multiple items combined)
  bit 3: QTY_COMPACT       0=separate uint24 qty+rate fields (default, 6 bytes)
                           1=packed split: qty+rate packed into customer_amount uint24 (3 bytes)
  bits 2-0: SPLIT_POINT    meaningful when QTY_COMPACT=1:
                           0=default (8 qty bits: lower 8 = qty, upper 16 = rate)
                           1–7=exactly that many bits to qty

  SPLIT_POINT table (DECIMAL_POS=2, SF=×1):
  ┌─────────────┬──────────┬─────────┬───────────┬─────────────────────────────┐
  │ Stored value│ qty bits │ qty max │ rate bits │ rate max                    │
  ├─────────────┼──────────┼─────────┼───────────┼─────────────────────────────┤
  │ 0 (default) │ 8        │ 255     │ 16        │ £655.35 (SF×10 → £6,553.50) │
  │ 1           │ 1        │ 1       │ 23        │ £83,886.07                  │
  │ 2           │ 2        │ 3       │ 22        │ £41,943.03                  │
  │ 3           │ 3        │ 7       │ 21        │ £20,971.51                  │
  │ 4           │ 4        │ 15      │ 20        │ £10,485.75                  │
  │ 5           │ 5        │ 31      │ 19        │ £5,242.87                   │
  │ 6           │ 6        │ 63      │ 18        │ £2,621.43                   │
  │ 7           │ 7        │ 127     │ 17        │ £1,310.71                   │
  └─────────────┴──────────┴─────────┴───────────┴─────────────────────────────┘

  Value formula (all amounts): Real Value = (stored_uint24 × SF) / 10^DECIMAL_POS
  Packed qty formula (QTY_COMPACT=1): Real Value = (rate × qty × SF) / 10^DECIMAL_POS
    where rate = customer_amount >> SPLIT_POINT_bits
          qty  = customer_amount & ((1 << SPLIT_POINT_bits) - 1)
    (SPLIT_POINT_bits = 8 when stored=0; = stored value otherwise)

**QTY_TIME encoding (time-unit quantities):**
When qty_unit (FLAGS3 bit 2) indicates a time unit (hours, labour-hours, etc.), qty is encoded as 2 bytes instead of via QTY_COMPACT:
```
  Byte 1: hours         uint8 (0–255)
  Byte 2: minutes_index uint8 (0–11; multiply × 5 for actual minutes: 0, 5, 10 … 55)
```
Max: 255h 55min. UI presents 15-min and 10-min increment shortcuts; wire always stores to 5-min precision.
Decoder selects QTY_TIME when qty_unit is a time unit; QTY_COMPACT applies for all other unit types.
ROUNDING bit 1-0 in transaction_byte: 10=round up to next 5-min, 11=round down; 00=exact.

───────────────────────────────────────────────────────────────────

[transaction_byte]        1 byte — if setup_byte present

  DOMAIN=01 (simple mode — I>O):
    bit 7: DIRECTION      0=I (income, inflow)   1=O (outgoing, outflow)
    bit 6: TIME           0=Past/settled          1=Future/pending
    bit 5: EFFECT         0=I (net positive)      1=O (net negative)
    bits 4-3: SUBTYPE     00–11 per I>O state (see §4 for full subtype table)
    bit 2: QTY_SPLIT      1=quantity+rate encoding active (T&M billing)
    bits 1-0: ROUNDING    00=exact  10=down  11=up  01=error/invalid (never set)

  DOMAIN=10 (standard mode — BitLedger Account Pair):
    bits 7-4: ACCOUNT_PAIR  0000–1101 active (14 pairs); 1110/1111 reserved
    bit 3: DIRECTION        0=plus/in  1=minus/out
    bit 2: STATUS           0=past/paid  1=future/debt
    bit 1: QTY_SPLIT        1=quantity+rate active
    bit 0: ROUNDING         0=exact or down  1=up

═══ FIELD FLAGS ═══════════════════════════════════════════════════

[field_flags]             2 bytes — ALWAYS PRESENT

  bit 0:  job             job title / service description      [u16 len][UTF-8]
  bit 1:  customer        customer name                        [u16 len][UTF-8]
  bit 2:  date            service/work date                    u16 days* or [u16][UTF-8 ISO]
  bit 3:  location        address / location string            [u16 len][UTF-8]
  bit 4:  meeting_time    appointment time                     u16 minutes* or [u16][UTF-8]
  bit 5:  start_time      job start time                       u16 minutes* or [u16][UTF-8]
  bit 6:  end_time        job end time                         u16 minutes* or [u16][UTF-8]
  bit 7:  customer_phone  customer contact phone               [u16 len][UTF-8]
  bit 8:  worker          worker / technician name             [u16 len][UTF-8]
  bit 9:  actions         work done / action items             [u16 len][UTF-8]
  bit 10: details         additional notes                     [u16 len][UTF-8]
  bit 11: story           narrative / long description         [u16 len][UTF-8]
  bit 12: financial_block financial block present              (triggers fin_control block)
  bit 13: ref_number      invoice/job/quote reference          [u8 len][UTF-8, max 255 B]
  bit 14: due_date        payment/action due date              u16 days* or [u16][UTF-8]
  bit 15: FLAGS3_PRESENT  field_flags3 byte follows

  * when COMPACT_TIME=1; otherwise text encoding

───────────────────────────────────────────────────────────────────

[field_flags3]            1 byte — if FLAGS3_PRESENT=1

  bit 0: context_label    standalone job context summary       [u8 len][UTF-8, max 255 B]
  bit 1: tag              category / classification tag        [u8 len][UTF-8]
  bit 2: qty_unit         unit label (hrs, km, kg, units...)   [u8 len][UTF-8]
  bit 3: date_end         period end date (for reports/summaries) u16 days* or [u16][UTF-8]
  bit 4: attachment       attachment reference                 [u16 len][UTF-8] (URL or hash)
  bit 5: uid              record/contact UID                   [u16 len][UTF-8]
  bit 6: url              associated URL                       [u16 len][UTF-8]
  bit 7: FLAGS4_PRESENT   flags4 follows (domain/template extension; template-defined)

═══ DATA BLOCKS ════════════════════════════════════════════════════

Data blocks follow field_flags (and field_flags3 if present), in ascending bit-order of their field flag.

Encoding by field type:
  text (standard):  [uint16 length BE][UTF-8 bytes]  — bits 0-3, 7-11, FLAGS3 bits 4-6
  text (compact):   [uint8 length][UTF-8 bytes]       — bits 13, FLAGS3 bits 0-2
  date:             uint16 (COMPACT_TIME=1: days since 2000-01-01; COMPACT_TIME=0: see text)
  time:             uint16 (COMPACT_TIME=1: minutes since midnight; COMPACT_TIME=0: see text)
  amount:           uint24 (financial block — see below)

SELF_DESCRIBING=0: blocks carry data only (receiver needs template to label fields)
SELF_DESCRIBING=1: each block prefixed with 1-byte canonical field-name index
  0x00–0x0E = field_flags bits 0–14 in order
  0x10–0x16 = field_flags3 bits 0–6 in order
  0x80–0xFE = custom / template-defined label index

═══ FINANCIAL BLOCK (if field_flags bit 12) ═══════════════════════

[fin_control]             1 byte — always, when financial block present

  DOMAIN=01 (simple mode):
    bit 7: BILLED           1=charge passed to customer (appears as invoice line item)
    bit 6: 0                must be 0 — mode indicator; integrity check 1
    bit 5: QTY_TYPE         0=units/items  1=time/hours (display context for qty)
    bit 4: PARITY           even parity of bits 7, 5, 3, 2, 1, 0; integrity check 2
    bits 3-2: EXPENSE_CAT   00=job charge (billed)  01=job cost (COGS, absorbed)
                            10=running cost (activity overhead)  11=RESERVED (check 3)
    bit 1: CUSTOMER_AMT     1=customer_amount uint24 follows
    bit 0: WORKER_AMT       1=worker_amount uint24 follows

  DOMAIN=10 (standard mode):
    bit 7: BILLED           1=charge passed to customer
    bit 6: 1                must be 1 — mode indicator; integrity check
    bits 5-2: ACCOUNT_PAIR  4-bit BitLedger Account Pair (0000–1101 active; 1110/1111 reserved)
    bit 1: CUSTOMER_AMT     1=customer_amount uint24 follows
    bit 0: WORKER_AMT       1=worker_amount uint24 follows

  Simple mode parity formula:
    PARITY = BILLED XOR QTY_TYPE XOR EC[1] XOR EC[0] XOR CUSTOMER_AMT XOR WORKER_AMT

  Four integrity checks (simple mode):
    1. bit6=0 (mode; mismatch = DOMAIN mismatch or corruption)
    2. bit4=PARITY (detects any single-bit flip across 6 content bits)
    3. EXPENSE_CAT ≠ 11 (reserved code; future-version or corruption signal)
    4. QTY_TYPE=1 requires QTY_SPLIT=1 in transaction_byte (cross-field consistency)

───────────────────────────────────────────────────────────────────

[customer_amount]         3 bytes — if CUSTOMER_AMT=1

  uint24, big-endian.

  When QTY_COMPACT=0 (or QTY_SPLIT=0):
    Real Value = (uint24 × SF) / 10^DECIMAL_POS

  When QTY_COMPACT=1 AND QTY_SPLIT=1:
    SP = 8 if SPLIT_POINT=0, else SPLIT_POINT value
    qty  = customer_amount & ((1 << SP) - 1)
    rate = customer_amount >> SP
    Real Value = (rate × qty × SF) / 10^DECIMAL_POS
    Display: "qty [unit] @ [rate] = [Real Value]"

───────────────────────────────────────────────────────────────────

[worker_amount]           3 bytes — if WORKER_AMT=1

  uint24. Internal cost / worker rate.
  Real Value = (uint24 × SF) / 10^DECIMAL_POS
  Not included in customer-facing URL rendering (progressive disclosure).

───────────────────────────────────────────────────────────────────

[tax_block]               3 bytes — if TAX_CODE=11

  byte 1: uint8 — tax rate in permille (e.g. 200 = 20.0%)
  bytes 2-3: uint16 — tax amount; SF and DECIMAL_POS apply

───────────────────────────────────────────────────────────────────

[qty_rate_block]          6 bytes — if QTY_SPLIT=1 AND QTY_COMPACT=0

  bytes 1-3: uint24 — quantity (SF and DECIMAL_POS apply)
  bytes 4-6: uint24 — rate per unit (SF and DECIMAL_POS apply)
  customer_amount is the authoritative total; qty × rate ≈ customer_amount.
  Display: "qty [unit] @ [rate] = [customer_amount]"

═══ PARTICIPANTS BLOCK (if PARTICIPANTS=1) ════════════════════════

[block_header]            1 byte

  bits 7-5: count         number of participants (1–7); 000=protocol error
  bits 4-0: reserved      must be 0

Per participant (repeated count times):

[part_flags]              1 byte

  bit 7: IS_SENDER        1=this participant is the record sender
  bits 6-5: ROLE_TYPE     00=Customer  01=Worker  10=Supplier/Vendor  11=role_code present
                          (Subcontractor, Employee, Agent, Authority all via role_code path)
  bit 4: HAS_ALT_ID       1=alt_id block follows (for no-phone users)
  bit 3: HAS_PHONE        1=phone field follows
  bit 2: HAS_EMAIL        1=email field follows
  bit 1: HAS_ROLE_TEXT / HAS_TRADING_NAME
                          When ROLE_TYPE=11: 1=free-text role label follows (no role_code byte)
                          When ROLE_TYPE≠11: 1=trading_name field follows (sole trader or org name distinct from personal name)
  bit 0: IS_ORG           1=company/organisation  0=individual

[name]                    [uint16 len][UTF-8] — always present (personal name, or primary display name)

[trading_name]            [uint16 len][UTF-8] — if HAS_TRADING_NAME=1 (ROLE_TYPE≠11)
                          Trading name for sole traders; registered name for companies when different from common name.
                          Shell display: template controls which name leads; default = trading_name when present.

[phone]                   [uint16 len][UTF-8] — if HAS_PHONE=1

[email]                   [uint16 len][UTF-8] — if HAS_EMAIL=1

[role_code]               1 or 2 bytes — if ROLE_TYPE=111 AND HAS_ROLE_TEXT=0
  0x00–0xFE: 1-byte code (240 named roles; see ROLE-CODEBOOK.md §3)
  0xFF: escape → 1 additional byte (224 specialist roles; see ROLE-CODEBOOK.md §4)

[role_text]               [uint16 len][UTF-8] — if ROLE_TYPE=111 AND HAS_ROLE_TEXT=1
```

---

## 3. I>O Subtype Table (DOMAIN=01)

Full subtype codes for all 8 I>O states:

| State | Notation | DIRECTION TIME EFFECT | Sub 00 | Sub 01 | Sub 10 | Sub 11 |
|-------|----------|-----------------------|--------|--------|--------|--------|
| Settled income | `I < I` | 0 0 0 | Standard payment | Deposit/partial | Final payment | Tip/gratuity |
| Future income | `I > I` | 0 1 0 | Invoice | Quote/estimate | Retainer | Recurring |
| Refund/credit out | `I < O` | 0 0 1 | Full refund | Partial refund | Warranty/goodwill | Overpayment return |
| Credit note | `I > O` | 0 1 1 | Credit note | Return auth | Discount | Credit balance |
| Settled expense | `O < O` | 1 0 1 | General expense | Travel/mileage | Materials/supplies | Subcontractor |
| Future expense | `O > O` | 1 1 1 | Bill received | Scheduled payment | Supplier order | Future subcon cost |
| Reimbursed | `O < I` | 1 0 0 | General reimb. | Travel reimbursed | Materials recovered | Advance returned |
| Reimb. pending | `O > I` | 1 1 0 | Claim submitted | Travel claim | Materials claim | Advance requested |

**Transaction byte construction (DOMAIN=01):**
```
byte = (DIRECTION << 7) | (TIME << 6) | (EFFECT << 5) | (SUBTYPE << 3) | (QTY_SPLIT << 2) | ROUNDING
```

**Common records:**

| Worker action | State | DIRECTION TIME EFFECT | Sub | transaction_byte (no qty, exact) |
|---|---|---|---|---|
| Customer paid at completion | `I < I` | 0 0 0 | 00 | 0x00 |
| Invoice sent (net 30) | `I > I` | 0 1 0 | 00 | 0x40 |
| Quote sent | `I > I` | 0 1 0 | 01 | 0x48 |
| Refund issued | `I < O` | 0 0 1 | 00 | 0x20 |
| Parts paid for on job | `O < O` | 1 0 1 | 10 | 0xB0 |
| Supplier invoice received | `O > O` | 1 1 1 | 00 | 0xE0 |
| Travel reimbursed | `O < I` | 1 0 0 | 01 | 0x88 |

---

## 4. Frame Profiles

Named configurations for common record types, with exact byte counts before compression.

### Profile A — Minimal service note (no financial)

Two valid encodings — text (no meta2, smaller frame when only one date field) vs compact (meta2 required):

**Profile A-text (42B raw, COMPACT_TIME=0):**
```
Scenario: "Attended site, checked boiler. No charge."
Fields: job text (25 chars), date

meta1:         1B  (0b00000000 — BASE=000, META2_PRESENT=0, no ACK, no CHAIN)
field_flags:   2B  (bits 0+2 set: job + date)
job block:     2+25 = 27B
date block:    2+10 = 12B  (ISO date string "2026-05-17")

Total: 1+2+27+12 = 42B raw
```

**Profile A-compact (33B raw, COMPACT_TIME=1 — implementation target):**
```
meta1:         1B  (0b10000000 = 0x80 — META2_PRESENT=1, BASE=000)
meta2:         1B  (0b01000000 = 0x40 — COMPACT_TIME=1)
field_flags:   2B  (bits 0+2 set: job + date)
job block:     2+25 = 27B
date block:    2B   (uint16 days since 2000-01-01)

Total: 1+1+2+27+2 = 33B raw
```

Note: Adding meta2 (1B) to signal COMPACT_TIME=1 saves 10B on the date field but costs 1B for meta2 → net 9B saving per date field. For records with multiple dates the saving compounds. Profile A-compact (33B) is the standard implementation target.

### Profile B — Simple payment received
```
Scenario: Customer paid £125.50 cash, Boiler repair, J. Smith, 2026-05-15
Fields: job, customer, date (compact), financial (payment received, customer_amount only)
```

```
meta1:              1B   0b10001000 = 0x88 (META2=1, EXT=0, BASE=001/Financial, no ACK/CHAIN/RECIP)
meta2:              1B   0b01000100 = 0x44 (SELF_DESC=0, COMPACT_TIME=1, HAS_TRIG=0, PART=0, DOMAIN=01 bits3-2=01, DRAFT=0, RFWD=0)
setup_byte:         1B   0b01000000 = 0x40 (DECIMAL_POS=010/2, CURRENCY=00/home, TAX=00, SF=0)
transaction_byte:   1B   0b00000000 = 0x00 (I<I settled, sub=00 payment, QTY=0, ROUNDING=00 exact)
field_flags:        2B   0x1007      (bits 0,1,2,12: job+customer+date+financial)
job block:          2+13 = 15B      "Boiler repair" (13 chars)
customer block:     2+7  = 9B       "J. Smith"  (7 chars)
date block:         2B              uint16 days (COMPACT_TIME=1)
fin_control:        1B   0b00010010 = 0x12 (BILLED=0, bit6=0, QTY_TYPE=0, PARITY=1, EC=00, CUST=1, WORK=0)
customer_amount:    3B              uint24 = 12550 (£125.50 at DECIMAL_POS=2)

Total raw:          1+1+1+1+2+15+9+2+1+3 = 36B
After deflate+b64url: ~48–52 chars
```

### Profile C — Invoice sent, T&M, QTY_COMPACT
```
Scenario: Invoice for 3.5 hours @ £45/hr = £157.50, compact qty mode
Fields: job, customer, date, financial (I>I future, qty split compact)
```

```
meta1:              1B   0x88 (same as B)
meta2:              1B   0x44 (same as B)
setup_byte:         1B   0b01000001 = 0x41 (DECIMAL_POS=2, CURRENCY=home, TAX=none, SF_PRESENT=1)
sf_byte:            1B   0b00001000 = 0x08 (SF=000/×1, COMPOUND=0, QTY_COMPACT=1, SPLIT_POINT=000/default-8-qty-bits)
transaction_byte:   1B   0b01000100 = 0x44 (I>I future: DIR=0,TIME=1,EFF=0, sub=00, QTY_SPLIT=1, ROUNDING=00)
field_flags:        2B   0x1007
job block:          2+11 = 13B     "Roof repair" (11 chars)
customer block:     2+8  = 10B     "T. Wilson" (8 chars)
date block:         2B
fin_control:        1B   0b01010100 (BILLED=0, bit6=0, QTY_TYPE=1/time, PARITY=?, EC=00, CUST=1, WORK=0)
                         PARITY = 0 XOR 1 XOR 0 XOR 0 XOR 1 XOR 0 = 0
                         fin_control = 0b00100010 = 0x22 wait, let me recalculate:
                         bit7=BILLED=0, bit6=0, bit5=QTY_TYPE=1, bit4=PARITY, bits3-2=EXPENSE_CAT=00, bit1=CUST=1, bit0=WORK=0
                         Parity covers bits 7,5,3,2,1,0 = 0,1,0,0,1,0 → XOR = 0
                         bit4=0
                         fin_control = 0b00100010 = 0x22
customer_amount:    3B   packed: rate=4500 (upper 16 bits), qty=35 (lower 8 bits, 3.5h×10 at D=1? No...)
                         At DECIMAL_POS=2 and QTY_TYPE=1 (time/hours): qty unit = 0.01h?
                         Better: use qty_unit field (FLAGS3 bit 2) to show "h" and encode qty=350 (3.50 h)
                         With SPLIT_POINT=0 (8 qty bits): qty max 255, rate max 65535
                         rate = 4500 (£45.00 at D=2), qty = 35 (3.5 at D=1? ambiguous...)
                         Design note: qty uses same DECIMAL_POS as amounts. So qty=350 = 3.50 hours.
                         350 > 255 → SPLIT_POINT=0 won't fit! Use SPLIT_POINT=2 (2 qty bits, max 3, insufficient)
                         or QTY_COMPACT=0 (separate fields) for fractional hours > 2.55
                         → fall back to QTY_COMPACT=0 for this case
                         OR: use qty=35 with display convention "35 × 0.1h @ £45/h" — but messy
                         In practice: qty_unit "h" + qty=35 with D=1 for qty only? Mixed DECIMAL_POS is ambiguous.
                         CONCLUSION: QTY_COMPACT=1 best suited for integer-qty records (parts, visits, km).
                         Time billing (fractional hours) should use QTY_COMPACT=0 unless qty is integer hours.

Total raw (QTY_COMPACT=0 fallback for this scenario):
  = 1+1+1+1+1+2+13+10+2+1+3+3+3 = 42B  (separate qty+rate = 6B extra vs compact)
Total raw (QTY_COMPACT=1, e.g. 3 hours exact at £52.50/h = £157.50):
  = 1+1+1+1+1+2+13+10+2+1+3     = 37B  (packed qty+rate in customer_amount)
```

### Profile D — Full record with two participants
```
Scenario: Invoice £85.00, customer + worker named, with participant block
Fields: job, customer, date, financial, participants (2 people)
```

```
meta1:              1B   0b10001000 = 0x88 (META2=1, EXT=0, BASE=001/Financial, no ACK/CHAIN/RECIP)
meta2:              1B   0b01010100 = 0x54 (COMPACT_TIME=1, PARTICIPANTS=1, DOMAIN=01 bits3-2=01)
setup_byte:         1B   0x40
transaction_byte:   1B   0x00 (payment received, exact)
field_flags:        2B   0x1007
job block:          2+14 = 16B   "Fence repair" (12 chars? let's say 14)
customer block:     2+9  = 11B   "A. Johnson"
date block:         2B
fin_control:        1B   0x02 (BILLED=0,bit6=0,QTY_TYPE=0,PARITY=1,EC=00,CUST=1,WORK=0 → wait)
                         PARITY = 0 XOR 0 XOR 0 XOR 0 XOR 1 XOR 0 = 1 → bit4=1
                         fin_control = 0b00010010 = 0x12
customer_amount:    3B
participants header:1B  (count=2 in bits 7-5: 0b01000000 = 0x40)
  participant 1 (customer):
    part_flags:     1B  IS_SENDER=0, ROLE=000/Customer, HAS_PHONE=1, HAS_EMAIL=0, HAS_ROLE_TEXT=0, IS_ORG=0
                        = 0b00001000 = 0x08
    name:           2+9 = 11B  "A. Johnson"
    phone:          2+11 = 13B "+44 7700 900000"
  participant 2 (worker):
    part_flags:     1B  IS_SENDER=1, ROLE=001/Worker, HAS_PHONE=0, HAS_EMAIL=0, HAS_ROLE_TEXT=0, IS_ORG=0
                        = 0b10010000 = 0x90
    name:           2+8 = 10B  "D. Garcia"

Total participants:  1 + (1+11+13) + (1+10) = 37B
Total raw: 1+1+1+1+2+16+11+2+1+3+37 = 76B
```

### Profile E — Minimal viable record (absolute minimum)

```
meta1:     1B (0x00 — SERVICE, no META2, no ACK, no CHAIN)
field_flags: 2B (bit 0 only: job)
job block: 2+5 = 7B  "Visit" (5 chars)
Total: 10B raw
```

---

## 5. Benchmark: pads-v1 vs 1eg/

Benchmark records compared raw (before deflate+base64url):

| Record | 1eg/ raw | pads-v1 raw | Saving | Notes |
|--------|----------|-------------|--------|-------|
| Simple payment (Profile B) | 50B | 36B | 14B (28%) | Date: ISO string→uint16 saves 10B; amount: UTF-8→uint24 saves 5B |
| Service note no financial | 42B | 33B | 9B (21%) | Date: ISO→uint16 saves 10B; meta2 costs 1B (net 9B). Profile A-compact. |
| T&M invoice, integer qty, compact | 55B | 37B | 18B (33%) | QTY_COMPACT packs price+qty in 3B vs 1eg/ total-only encoding |
| Record with 2 participants | 85B | 76B | 9B (11%) | Participants overhead similar; header savings still apply |

### Source of savings

| Change | Saving per record |
|--------|-------------------|
| Date encoding (ISO string → uint16) | 10B |
| Amount encoding (UTF-8 → uint24) | 4–6B per amount |
| Header (template+flags+enums → meta bytes) | 1–2B |
| QTY_COMPACT=1 (compact qty/rate) | 6B when applicable |
| COMPACT_TIME=1 enabling | Requires 1B meta2 — net 9B for records with date |

**URL length:** pads-v1 frames compress ~15-25% better than 1eg/ frames due to more predictable structure and binary integer encoding. After deflate+base64url, a typical invoice record: 1eg/ ≈ 70–80 chars, pads-v1 ≈ 50–60 chars.

---

## 6. No Migration Required

The app has not been publicly released (private demo only). The `1eg/` codec is superseded entirely by pads-v1 (`1pa`). No dual-decoder, no backward-compatibility path, no migration. All pre-existing records are test data.

---

## 8. Compound Block Detail (COMPOUND_VALUE=1)

When `sf_byte` COMPOUND_VALUE=1, the financial block contains a compound header followed by per-line entries.

### 8.1 Compound Header

```
[compound_header]         2 bytes — when COMPOUND_VALUE=1

  byte 1:
    bits 7-3: LINE_COUNT    number of data lines (1–31)
    bits 2-1: reserved      must be 0
    bit 0: LINE_FLAGS_PRESENT  1=each line has a compound_line_flags byte

  byte 2: SUMMARY_FLAGS
    bit 7: HAS_TOTAL_SUMMARY  1=a summary line (LINE_TYPE=11) follows all data lines
    bit 6: HAS_SUBTOTALS      1=subtotal summary lines (LINE_TYPE=11) present within data lines
    bits 5-0: reserved        must be 0
```

### 8.2 Compound Line Structure

Each of the LINE_COUNT lines is encoded in order:

```
[compound_line_flags]     1 byte — if LINE_FLAGS_PRESENT=1

  bits 7-6: LINE_TYPE     00=standard line (income/expense item)
                          01=deduction (negative, e.g. employee deduction)
                          10=employer-add (positive cost addition, e.g. NI)
                          11=summary (aggregate or total line; no qty)

  bits 5-4: TAX_MODE      00=-- (not applicable; column hidden if all lines are --)
                          01=standard rate (rate from setup_byte TAX_CODE)
                          10=reduced rate (reduced rate defined in codebook)
                          11=zero / exempt

  bit 3: QTY_LINE         1=qty and rate fields follow line_amount for this line

  bits 2-0: reserved      must be 0
```

```
[line_name]               [uint8 len][UTF-8] — always per line
                          Compact text encoding (max 255 bytes)

[line_amount]             3 bytes — uint24, SF and DECIMAL_POS apply
                          For LINE_TYPE=01 (deduction): value is the deduction magnitude
                          (positive uint24; sign is implicit from LINE_TYPE)

[line_qty]                3 bytes — if QTY_LINE=1
  uint24, qty value. SF and DECIMAL_POS apply.

[line_rate]               3 bytes — if QTY_LINE=1
  uint24, rate per unit. SF and DECIMAL_POS apply.
  Display: "qty [unit] @ [rate] = [line_amount]"
```

**LINE_TYPE semantics for payroll compound records:**
- `00` = gross pay line (standard, positive)
- `01` = deduction line (e.g. income tax, employee NI, pension contribution)
- `10` = employer-add line (e.g. employer NI — adds to worker cost but not worker take-home)
- `11` = summary line (net pay total, or sub-total by category)

**TAX_MODE defaults:**
- Default (TAX_MODE=00) means "not applicable" — renders as `--` in tax column
- UI: tax column is hidden entirely when all lines have TAX_MODE=00
- setup_byte TAX_CODE is a rate definition only; it is not silently applied to any line
- A line with TAX_MODE=01 uses the rate defined by setup_byte TAX_CODE

---

## 9. State Commit Block (BASE_TEMPLATE=101)

State Commit records are point-in-time snapshots. They carry no transaction byte (no directional flow). The financial block may carry cumulative amounts.

```
[state_commit]            1 byte — always present when BASE_TEMPLATE=101

  bits 7-6: COMMIT_TYPE   00=job close (job finalised; balance outstanding shown)
                          01=payment confirmed (settlement of a specific amount received/made)
                          10=terms agreed (bilateral acceptance of a quoted/proposed record)
                          11=reserved (must be 0; disputes handled via Amendment + DISPUTE_FLAG)

  bits 5-4: PERIOD_TYPE   (meaningful for COMMIT_TYPE=10/11)
                          00=calendar month    01=tax week
                          10=tax month         11=custom (date_end field required)

  bit 3: CHAIN_COMPLETE   1=all chained child records are settled; no outstanding
  bit 2: DISPUTE_FLAG     1=at least one chained record is in dispute / uncorrected
  bits 1-0: reserved      must be 0
```

**Financial block in State Commit records:**
- `setup_byte` present (currency/decimal context)
- `transaction_byte` absent (no I>O direction on a snapshot)
- State Commits carry a **summary-only** financial block — key confirmation data, not full line detail

**State Commit financial summary block (when financial context present):**
```
[sc_fin_summary]          variable

  total_amount    uint24          — the confirmed total (mandatory when financial)
  line_count      uint8           — number of line items being confirmed (for display: "3 items")

  [optional — if FLAGS indicate present:]
  tax_total       uint24          — confirmed tax amount
  compound_summary  per-line:     — compact display summary (not full compound block)
    [description]   [u8 len][UTF-8]  max 40B
    [amount]        uint24
    (repeated line_count times)
  fingerprint     6 bytes         — SHA-256(original_financial_bytes)[0:6]; tamper-evident seal
                                    verifiable offline against the original record
```

Level A (default): total_amount + line_count only (4 bytes). Level B: adds fingerprint (10 bytes total). Extensions C/D reserved.

**Guest viewer confirmation signature (when receiver has no Workpads account):**
```
  device_fingerprint  6 bytes     — SHA-256(user_agent + screen + timezone + language)[0:6]
  confirm_timestamp   uint16      — COMPACT_TIME (2 bytes, minutes precision)
  confirm_flag        1 bit       — set when receiver taps explicit "I confirm" action
  identity_anchor     9 bytes     — optional: [1B type: 01=phone 02=email] + SHA-256(value)[0:8]
                                    receiver may leave blank; included only if provided
```

Total guest sig: 8B mandatory + 9B optional.

**Per-period records (COMMIT_TYPE=00/01):** `setup_byte` present; amounts in summary block.
**Period summary records (not a COMMIT_TYPE — use date_start + date_end with compound lines):** COMPOUND_VALUE=1; compound lines carry category totals (income, expense, COGS, net).

**Date range for period records:**
- `date` field (field_flags bit 2): period start date
- `date_end` field (field_flags3 bit 3): period end date
- Note: `expiry_date` moved to field_flags4 bit 1 (financial template). field_flags3 bit 3 = `date_end`. Resolved.

---

## 10. Amendment Block (BASE_TEMPLATE=110)

Amendment records carry only the changed fields of a prior record, plus a mask identifying which fields changed.

```
[amendment_header]        2 bytes — always present when BASE_TEMPLATE=110

  byte 1: CHANGED_MASK_1  bit-for-bit match of field_flags byte 1
                          1=field was changed; 0=field unchanged (not present in amendment)

  byte 2: CHANGED_MASK_2  bit-for-bit match of field_flags byte 2
                          bit 15: CHANGED_MASK_3_PRESENT (1=third mask byte follows for FLAGS3 fields)
```

```
[changed_mask_3]          1 byte — if CHANGED_MASK_3_PRESENT=1
  Bits match field_flags3 layout (bits 0–6); bit 7 reserved.
```

```
[line_index]              1 byte — if the parent record has COMPOUND_VALUE=1
  uint8: 0-based index of the compound line being amended.
  0xFF = amendment applies to the compound header / overall record, not a specific line.
```

**Changed field values** follow in ascending flag-bit order, same encoding as original record.  
Unchanged fields are absent. The receiver reconstructs the amended record by overlay.

**Financial amendment:**
- If `financial_block` bit is set in CHANGED_MASK, the amended `fin_control` + amounts follow
- Receiver recalculates totals after applying changed amounts

**Amendment chain convention:**
- Amendment record carries CHAIN=1; parent ref via `&c=` URL suffix points to the original record UID
- `ACK_REQUEST=1` in the parent record signals that the sender expects either confirmation or an amendment in reply
- Multiple amendments on the same parent are ordered by chain depth; each subsequent amendment chains from the previous

**Parent UID embedding (optional inline, mandatory for Markers):**
```
[parent_uid]              8 bytes — embedded parent reference in frame body
                          = SHA-256(parent_frame_bytes)[0:8]
                          Mandatory when: writing to a Marker (#1pm/), or BASE_TEMPLATE=110 + DOMAIN≥01 (financial amendment)
                          Optional otherwise: CHAIN=1 + &c= URL suffix is sufficient for web-shared amendments
                          Flag: HAS_PARENT_UID in amendment_flags byte (extension of amendment_header — see below)
```

```
[amendment_flags]         1 byte — extension byte, present when CHANGED_MASK_3_PRESENT=0 and byte 2 bit 14=1
  bit 7: HAS_PARENT_UID   1=8-byte parent_uid follows after changed masks
  bit 6: DISPUTE_LINK     1=this amendment is a dispute record; links into agreement trail via parent_uid
  bits 5-0: reserved
```

**Disputes:** Disputes are Amendment records with DISPUTE_LINK=1 + HAS_PARENT_UID=1. They link into the agreement creation trail without polluting the State Commit sequence. Shell shows dispute badge on the parent record when a DISPUTE_LINK amendment is detected in the chain. See AGREEMENTS-DESIGN.md §3.

---

## 11. Presentation Record Blocks (BASE_TEMPLATE=any, #1pb/ URLs)

Presentation records are designed for display, not transaction. They use a display schema block to control rendering, and optionally a form schema block to collect a reply.

### 11.1 Display Schema Block

Present when the record is shared as a `#1pb/` presentation URL.

```
[display_schema]          variable length

  byte 1: DISPLAY_CONTROL
    bits 7-6: DISPLAY_TYPE    00=card (single block, avatar-style)
                              01=list (vertically stacked line items)
                              02=menu (service catalog with prices)
                              03=form-only (no display body; form schema drives layout)

    bits 5-4: DATA_SOURCE     00=inline (all data in this record)
                              01=contact-resident (payload is contact ID; receiver fills from contacts)
                              10=activity profile (data from sender's activity profile)
                              11=anonymous/stealth — no sender identity in payload; no reply routing address; SUBMIT_ACTION=11 required if form present; shell shows placeholder text only (OQ-24; see ANON-MODE-DESIGN.md)

    bit 3: SHOW_PRICE         1=prices displayed in menu/list lines
    bit 2: SHOW_CONTACT       1=phone/email shown in card view (RECIPIENT_TYPE=0 only)
    bit 1: ACCENT_COLOR       1=accent_color byte follows
    bit 0: DISPLAY_FLAGS2     1=display_flags2 byte follows

  [accent_color]           1 byte — if ACCENT_COLOR=1
    3-bit R (high), 3-bit G, 2-bit B — 256-slot pastel palette

  [display_flags2]         1 byte — if DISPLAY_FLAGS2=1
    bits 7-5: FONT_SIZE       000=default  001=large  010=compact
    bits 4-3: LAYOUT_COLS     00=1-col  01=2-col  10=auto  11=reserved
    bit 2: (reserved)         must be 0 — was HAS_TRIG; TRIG moved to meta2 bit 5 (OQ-32c)
    bits 1-0: reserved        must be 0
```

### 11.3 TRIG Block (moved — see §13)

### 11.2 Form Schema Block

Present when `display_schema` DISPLAY_TYPE=02 or 03, enabling collect-and-reply capability.

```
[form_schema]             variable length

  byte 1: FORM_CONTROL
    bits 7-6: SUBMIT_ACTION   00=reply record (receiver submits as a new pads-v1 record)
                              01=web endpoint (URL in form payload)
                              10=email (address in form payload)
                              11=anonymous pickup — submission held server-side; sender retrieves via blind pickup code derived from master_secret + form UID; no routing address in payload; requires DATA_SOURCE=11 (OQ-24)
    bits 5-4: REPLY_TEMPLATE  BASE_TEMPLATE of the expected reply record
                              00=contact card  01=financial  10=service note  11=custom
    bit 3: ALLOW_EDIT         1=receiver may edit their own submitted fields post-submit
    bit 2: REQUIRE_NAME       1=name field required
    bit 1: REQUIRE_PHONE      1=phone field required
    bit 0: FORM_FIELDS_FOLLOW 1=form field definitions follow (see below)

  [field_count]            1 byte — if FORM_FIELDS_FOLLOW=1
    uint8: number of form field definitions that follow

  Per form field:
    [field_def]            2 bytes
      byte 1:
        bits 7-4: FIELD_TYPE  0000=text  0001=number  0010=date  0011=select
                               0100=boolean  0101=phone  0110=email  0111=textarea
        bit 3: REQUIRED
        bits 2-0: reserved

      byte 2:
        uint8: field label index (0x00–0xFE = canonical field codebook; 0xFF = custom label follows)

    [custom_label]         [uint8 len][UTF-8] — if field label index = 0xFF
```

---

### 11.4 Financial Presentation Records (`#1pf/` tag)

Financial presentation records use the `#1pf/` URL tag rather than `#1pb/`. They carry a display_schema block (and optionally a TRIG block and form_schema) oriented toward financial views — invoice display, account statements, pay period summaries.

Differences from `#1pb/` public billboard:
- Share sheet requires explicit user confirmation before generating a `#1pf/` URL
- App warns when sharing to general-purpose channels (WhatsApp groups, SMS broadcasts)
- `#1pf/` URLs should be combined with `#1ps/` or `#1pt/` security for any record containing actual financial amounts
- Not for public circulation — intended for named recipients (customer invoice link, worker pay summary)

The wire frame for `#1pf/` records is identical to `#1pb/` — same display_schema, same form_schema, same TRIG block. The tag itself is the signal to the shell and the share sheet that extra safety measures apply.

---

## 13. TRIG Block (meta2 HAS_TRIG_BLOCK=1)

Present when meta2 bit 5 (`HAS_TRIG_BLOCK`) = 1. Top-level block, appears after the participants block (or after the financial block if no participants block present), before the security wrapper.

TRIG is a 1–20 byte stack machine program controlling conditional rendering — who sees what, in which display mode, with which CSS/JS module loaded. Evaluated client-side only. The fragment is never sent to the server; TRIG evaluation is entirely local.

```
[trig_block]           variable — if HAS_TRIG_BLOCK=1

  [trig_len]           1 byte — uint8, length of TRIG program in bytes (0–20)
  [trig_bytes]         N bytes — TRIG v1 bytecode program (N = trig_len)

  trig_len=0: block present but program is empty; shell defaults to SHOW_ALWAYS NATIVE
  trig_len=1: single pattern token (high nibble = 0x0; see OQ-32 pattern token table)
  trig_len 2–20: full bytecode program; byte 0 is TRIG header byte
  trig_len > 20: spec violation; shell renders BLANK
```

TRIG can be carried by any record type (not only presentation records). A chain record or State Commit with HAS_TRIG_BLOCK=1 can control which party sees the chain state details.

**Full TRIG specification:** OQ-32 in OPEN-QUESTIONS.md and TRIG-DESIGN.md.

---

## 12. Security Wrapper (OQ-14)

The security wrapper sits outside the pads-v1 frame. It is applied after the frame is assembled and before base64url encoding. The URL tag signals the security level.

**URL tag dispatch table — all pads-v1 tags:**

| Tag | Name | Purpose | JS permitted? |
|-----|------|---------|---------------|
| `#1pa/` | Plain record | Standard records: financial, service, contact. No presentation wrapper. | No |
| `#1pb/` | Public billboard | Non-financial presentation: business cards, service menus, contact forms. Public circulation. Never carries financial data or executable logic. | No |
| `#1pf/` | Financial presentation | Financial views: invoice display, statements, pay summaries. Extra share-sheet safety. Not for public circulation. Combine with `#1ps/` or `#1pt/` for security. | Yes (with `#1ps/`/`#1pt/`) |
| `#1ps/` | Full scramble | AES-CTR encryption + field scramble. Private/colleague records, cost data, pay records. | Yes |
| `#1ph/` | Partial scramble | Header bytes unencrypted (meta1, meta2, setup_byte, transaction_byte); field data and financial block encrypted. Receiver sees record type before entering code. | No |
| `#1pt/` | Template-keyed | Template content is encryption key. Template ID advertised plainly; meaningless without template content. | Yes (if template has `allow_js: true`) |
| `#l/` | List share | Standalone option list for form builder multi-select fields. Not a record — list content only. | No |

**Canonical reference for this table:** See also TAG-REFERENCE.md (permanent development and standard reference).

### 12.1 Five-Layer Security Stack

Layers applied in order (outermost first in URL):

**Layer 1 — Deflate seed poisoning:**
- Deflate is applied with a deterministic non-standard seed derived from a shared key
- Receiver must know the seed to decompress; wrong seed produces garbage
- Provides lightweight obfuscation without cryptographic strength
- Layer tag: present in preamble byte

**Layer 2 — Field scramble:**
- Field_flags byte order permuted using a key-derived shuffle
- Actual field data unchanged; flag-to-offset mapping scrambled
- Receiver needs the shuffle key to identify field boundaries
- Layer tag: `SCRAMBLE=1` in preamble byte

**Layer 3 — AES-CTR payload encryption:**
- Full frame encrypted after deflate + scramble; 128-bit key
- Key = cipher_key = SHA-256(passphrase || salt)[0:16]
- IV = master[0:16] (same bytes as cipher_key; per-record freshness guaranteed by random salt)
- Layer tag: `AES=1` in preamble byte

**Layer 4 — Receiver commitment HMAC:**
- 8-byte HMAC-SHA256 truncated tag embedded INSIDE the encrypted envelope (last 8 bytes before AES-CTR is applied)
- Verified by receiver after decryption; wrong key → HMAC mismatch → reject
- Commits to receiver phone hash: only the named receiver can verify
- Layer tag: `HMAC=1` in preamble byte; requires RECIPIENT_TYPE=1 in meta1

**Layer 5 — Preamble byte** (1 byte, part of base64url payload after salt):
```
  bit 7: SCRAMBLE         1=field scramble applied
  bit 6: AES              1=AES-CTR encryption applied
  bit 5: HMAC             1=receiver commitment HMAC present (last 8B inside envelope)
  bit 4: SEED_POISON      1=deflate seed poisoning applied
  bit 3: HKDF_KEY         1=HKDF-derived key (domain-separated); 0=direct SHA-256 of template bytes
                          (meaningful for #1pt/ template-keyed records; ignored for #1ps/#1ph)
  bits 2-0: KEY_HINT      lower 3 bits of cipher_key[0] (helps receiver select passphrase from key ring)
```

**URL structure:**
```
workpads.me/p#1ps/<b64url(salt_4B)>.<b64url(preamble_byte + encrypted_inner)>
```
The salt (4 random bytes, base64url = 6 chars) precedes the `.` separator. It is a derivation nonce, not a secret.

**Key derivation:**
```
master       = SHA-256(passphrase || salt)   [32 bytes]
cipher_key   = master[0:16]
scramble_seed = master[16:32]
iv           = master[0:16]   (same as cipher_key; safe because salt is fresh per record)
```

**Wrapper format (innermost first):**
```
inner = AES-CTR(
  cipher_key, iv,
  plaintext = [field_scramble([deflate_seeded([frame])])][hmac_tag_8B?]
)
URL payload = [preamble_byte][inner]
```

**Full encode path:**
```
frame → deflate(seed=scramble_seed[0:4]) → field_scramble(seed=scramble_seed[4:8])
      → [optional: append hmac_tag_8B] → AES-CTR(cipher_key, iv)
      → prepend preamble_byte → base64url → URL fragment after salt.
```

**Decode path:**
```
1. Split URL fragment on `.` → extract salt (first segment)
2. Derive master, cipher_key, scramble_seed from passphrase + salt
3. Check KEY_HINT (preamble bits 3-0) against cipher_key[0] lower nibble — abort if mismatch
4. AES-CTR decrypt
5. If HMAC=1: extract last 8 bytes; verify HMAC-SHA256(cipher_key||receiver_phone_hash, inner)[0:8]
6. Un-field-scramble using scramble_seed[4:8]
7. Inflate with seed=scramble_seed[0:4]
8. Parse pads-v1 frame
```

### 12.2 Partial Scramble (`#1ph/`) Layout

The first bytes of the encoded fragment are in clear — only the field data is encrypted:

```
URL: workpads.me/p#1ph/<b64url(salt)>.<b64url(preamble + clear_header + encrypted_inner)>

clear_header = meta1[1B] + meta2[0-1B] + setup_byte[0-1B] + transaction_byte[0-1B]
encrypted_inner = AES-CTR(cipher_key, iv, [field_scramble([deflate_seeded([field_bytes])])])
```

Receiver sees record type (template ID) and DOMAIN before entering passphrase. `#1ph/` does not carry an HMAC layer (HMAC=0 in preamble).

### 12.3 Private Record Convention

Records with `worker_amount` or `EXPENSE_CATEGORY=01/10` (cost data, internal) should always use at minimum `#1ps/` (full wrapper) when shared. The caller (app share sheet) enforces this — the codec itself does not refuse to encode without a wrapper.

**Full security specification:** SECURITY-DESIGN.md (draft-spec status, 2026-05-17).

---

## 13. alt_id Extension (OQ-31)

The `alt_id` block provides an alternative identifier for participants without a phone number — common in low-connectivity markets (Africa, South/Southeast Asia).

**Resolved (OQ-31, Option A):** ROLE_TYPE packed into 2 bits (bits 6–5 of part_flags), freeing bit 4 for HAS_ALT_ID. The part_flags layout in §2 reflects this. See ROLE-CODEBOOK.md for the updated 2-bit quick-select table and role_code extended path.

**Modified part_flags (Option A, 2-bit ROLE_TYPE):**
```
  bit 7: IS_SENDER
  bits 6-5: ROLE_TYPE    00=Customer  01=Worker  10=Supplier/Vendor  11=role_code present
  bit 4: HAS_ALT_ID      1=alt_id block follows (after phone/email/role fields)
  bit 3: HAS_PHONE
  bit 2: HAS_EMAIL
  bit 1: HAS_ROLE_TEXT   1=free-text role label (when ROLE_TYPE=11 AND no role_code byte)
  bit 0: IS_ORG
```

**alt_id block** (follows phone/email/role_code/role_text for this participant):
```
[alt_id_type]             1 byte
  0x01 = app_uid          device-generated UID, SIM-stable, shared via QR code
  0x02 = trade_name       business trading name (often more stable than phone)
  0x03 = national_id      government-issued ID number (opaque, stored as received)
  0x04 = location_label   contextual place reference ("Kigali market stall 7B")
  0x05–0xFE = reserved

[alt_id_value]            [uint8 len][UTF-8] — compact text, max 255 bytes
```

**Receiver match order:** phone → email → app_uid → trade_name + location_label

---

## 14. field_flags4 (Template Extension)

```
[field_flags4]            1 byte — if FLAGS4_PRESENT=1 in field_flags3

  Bits 0–7 are template-defined. The decoder must know the active template to interpret them.

  Contact/entity template (BASE_TEMPLATE=011) assignments:
    bit 0: website          website URL                                     [u16 len][UTF-8]
    bit 1: social_handle    @handle or profile link                         [u8 len][UTF-8]
    bit 2: business_hours   opening hours (text; structured block post-MVP) [u16 len][UTF-8]
    bit 3: category         trade/service category                          1 byte enum (see ROLE-CODEBOOK.md §3)
    bit 4: alt_phone        second phone number                             [u16 len][UTF-8] E164
    bit 5: meeting_location preferred meeting location (address or area)    [u16 len][UTF-8]
    bit 6: reserved         must be 0
    bit 7: FLAGS5_PRESENT   1=field_flags5 byte follows (future extension)

  Financial record template assignments (BASE_TEMPLATE=001):
    bit 0: service_ref   back-reference to service template that generated this record   [u8 len][UTF-8]
    bit 1: expiry_date   record/offer expiry date (moved from FLAGS3 bit 3)              u16 days*
    bit 2: gps_binary    compact GPS coordinates (standard cross-template assignment)    [int16 lat×100][int16 lon×100] = 4 bytes
                         lat_scaled = latitude × 100 (range ±327.67°; covers ±90° ✓)
                         lon_scaled = longitude × 100 (range ±327.67°; covers ±180° ✓)
                         Precision: ±0.01° ≈ ±1.1 km. May coexist with UTF-8 `location` field (bit 3 of field_flags).
                         Post-MVP: int32 ×1000 (8 bytes, ±111 m) if sector use cases require it.
    bits 3–7: reserved for template-defined custom fields

  For EXT_TEMPLATE records: bits 0–7 defined by the ext_template domain schema.
  FLAGS4 data blocks follow field_flags4 in ascending bit order, same encoding rules as FLAGS3 blocks.
```

---

## 15. Block Presence Summary

Which blocks are present for each BASE_TEMPLATE type:

| Block | Service (000) | Financial (001) | Contact (011) | State Commit (101) | Amendment (110) |
|-------|:---:|:---:|:---:|:---:|:---:|
| meta1 | ✓ | ✓ | ✓ | ✓ | ✓ |
| ext_template | cond | cond | cond | cond | cond |
| meta2 | cond | cond | cond | cond | cond |
| setup_byte | — | ✓ | — | ✓ | — |
| currency_ext | cond | cond | — | cond | — |
| sf_byte | cond | cond | — | cond | — |
| transaction_byte | — | ✓ | — | — | — |
| field_flags | ✓ | ✓ | ✓ | ✓ | — |
| field_flags3 | cond | cond | cond | cond | — |
| field_flags4 | cond | cond | cond | cond | — |
| data blocks | ✓ | ✓ | ✓ | ✓ | — |
| financial block | — | ✓ | — | cond | cond |
| compound block | — | cond | — | cond | — |
| participants block | cond | cond | ✓ | cond | cond |
| state_commit byte | — | — | — | ✓ | — |
| amendment_header | — | — | — | — | ✓ |
| line_index | — | — | — | — | cond |
| changed field values | — | — | — | — | ✓ |
| display_schema | cond | cond | cond | — | — |
| TRIG block (meta2 bit 5, top-level) | cond | cond | cond | cond | cond |
| form_schema | cond | cond | cond | — | — |
| security wrapper | optional | optional | optional | optional | optional |
| alt_id (per participant) | cond | cond | cond | cond | cond |

**Key:** ✓=always present when template active; cond=present when condition met; —=never present; optional=app-layer decision

**Amendment field data** is governed by the `changed_mask` bytes, not `field_flags`. Field_flags is absent in BASE_TEMPLATE=110.

---

## 16. Design Status

| Point | Status | Note |
|-------|--------|------|
| Codebook tag string | ✓ Resolved | `1pa` — pads v1, package a (OQ-1) |
| DECIMAL_POS=111 extension | ✓ Resolved | `111` = flat uint24 backup mode (no DECIMAL_POS scaling; value in smallest currency unit). See CODEC-EVOLUTION.md CODEC-2. |
| TAX_CODE 01/10 rates | ✓ Resolved | No rates baked in — always explicit. 01=inclusive requires tax_block with rate+amount; 10=exclusive same. (OQ-4) |
| DOMAIN=11 hybrid mode | ✓ Resolved | Hybrid I>O + Account Pair. Adds `account_pair_byte` after transaction_byte. Same setup/transaction bytes as DOMAIN=01. See §17. (OQ-7) |
| FLAGS4 layout | ✓ Resolved | Template-defined. Contact/entity: bits 0–4 (vCard fields). Financial: bit 0=service_ref, bit 1=expiry_date. (§14) |
| uint16 length prefix byte order | ✓ Resolved | Big-endian throughout — all uint16, uint24 (OQ-5) |
| Epoch for COMPACT_TIME dates | ✓ Resolved | 2000-01-01. uint16 range extends to ~2179. (OQ-2) |
| alt_id in participants block | ✓ Resolved | Option A confirmed (OQ-31). ROLE_TYPE 2-bit, HAS_ALT_ID at bit 4. See §13. |
| DATA_SOURCE=11 anonymous mode | Design complete | Full design: ANON-MODE-DESIGN.md. Wire: DATA_SOURCE=11 in DISPLAY_CONTROL, SUBMIT_ACTION=11 required for forms. Blind pickup via HMAC-derived pickup_slot_key. |
| TRIG block placement | ✓ Resolved | Option B: meta2 bit 5 (`HAS_TRIG_BLOCK`). Top-level block after participants, before security wrapper. Applies to all record types. display_flags2 bit 2 freed. (OQ-32c) |
| currency_ext code table | ✓ Resolved | 154 currencies in 254 slots. See OQ-3 in OPEN-QUESTIONS.md. (FRAME-SPEC omits inline codes; OQ-3 is authoritative.) |
| gps_binary FLAGS4 assignment | ✓ Resolved | FLAGS4 bit 2 = gps_binary, standard cross-template. [int16 lat×100][int16 lon×100] = 4 bytes. See §14. (OQ-15/template session) |
| HKDF_KEY preamble bit | ✓ Resolved | Preamble byte bit 3 = HKDF_KEY (was part of KEY_HINT); KEY_HINT now bits 2–0. See §12. (OQ-te/ session) |
| fin_control BILLED flag | ✓ Resolved | DOMAIN=01 fin_control bit 7 = BILLED (charge passed to customer). EXPENSE_CAT=00 forces BILLED=1. See §2. (OQ-7/DOMAIN session) |


---

## 17. DOMAIN=11 Hybrid Mode

DOMAIN=11 carries both layers simultaneously: the I>O perspective classification (for the worker and customer UI) and the BitLedger Account Pair classification (for accounting integrations and reconciliation tools). Same record, two views — no re-entry required.

### 17.1 Frame Layout for DOMAIN=11

The setup_byte and transaction_byte are identical to DOMAIN=01 (I>O simple mode). One additional byte, `account_pair_byte`, follows the transaction_byte:

```
[setup_byte]           1 byte — identical to DOMAIN=01
[transaction_byte]     1 byte — identical to DOMAIN=01 (I>O state + subtypes)
[account_pair_byte]    1 byte — DOMAIN=11 only; follows transaction_byte

  bits 7-4: ACCOUNT_PAIR   BitLedger 4-bit Account Pair code (0000–1101 active; see table below)
  bit 3: AP_DIRECTION      0=debit primary account  1=credit primary account
  bit 2: AP_STATUS         0=posted/settled  1=pending/future
  bit 1: AP_COMPLETENESS   0=complete transaction  1=partial (split or installment)
  bit 0: AP_EXTENSION      0=none  1=account_pair_ext byte follows (reserved post-MVP)
```

### 17.2 Account Pair Codes

| Code | Account Pair | Income direction | Expense direction |
|------|-------------|-----------------|-------------------|
| 0000 | Op Expense / Asset | (N/A) | Expense paid from asset (cash expense) |
| 0001 | Op Expense / Liability | (N/A) | Bill received (payable) |
| 0010 | Non-Op Expense / Asset | (N/A) | One-time cost paid |
| 0011 | Non-Op Expense / Liability | (N/A) | One-time cost on credit |
| 0100 | Op Income / Asset | Cash sale received | Refund given |
| 0101 | Op Income / Liability | Invoice sent (receivable) | Credit note issued |
| 0110 | Non-Op Income / Asset | One-time income received | (N/A) |
| 0111 | Non-Op Income / Liability | One-time income earned, not received | (N/A) |
| 1000 | Asset / Liability | Asset acquired on credit | Loan repaid |
| 1001 | Asset / Equity | Owner contribution | Owner distribution |
| 1010 | Liability / Equity | Equity → Liability | Liability → Equity |
| 1011 | Asset / Asset | Internal transfer in | Internal transfer out |
| 1100 | Liability / Liability | Liability assumed | Liability transferred |
| 1101 | Equity / Equity | Equity reallocated in | Equity reallocated out |
| 1110 | Correction / Netting | (special — inference suspended) | |
| 1111 | Compound continuation | (special — next line is continuation of compound) | |

### 17.3 UI and Entry Model

**Worker entry (Simple mode):** The worker always enters in I>O mode (DOMAIN=01 perspective). The I>O transaction_byte and fin_control are the worker-facing layer. The `account_pair_byte` is invisible to the worker during entry.

**Accounting annotation path:** The `account_pair_byte` is attached in one of two ways:
1. **App-assisted**: The app infers the Account Pair from the I>O state + EXPENSE_CAT combination and offers a confirmation: "This looks like an Operating Expense / Liability. Confirm?"
2. **Integration-attached**: An accounting integration (bookkeeping app, sync service) reads the record via API, classifies it, and writes a State Commit amendment attaching the annotated account_pair_byte. The original record is not modified — the amendment carries the additional classification.

**Decoder compatibility:**
- DOMAIN=01 decoders encountering a DOMAIN=11 record: they read setup_byte and transaction_byte correctly (both identical to DOMAIN=01), then encounter one unexpected byte (account_pair_byte). A spec-compliant DOMAIN=01 decoder must skip unknown bytes after the transaction_byte gracefully.
- DOMAIN=10 decoders encountering DOMAIN=11: the transaction_byte layout differs (DOMAIN=10 uses bits 7-4 for ACCOUNT_PAIR, DOMAIN=11 uses bits 7-3 for I>O state). These are incompatible. DOMAIN=10 decoders must check the DOMAIN bits before parsing transaction_byte.

### 17.4 I>O to Account Pair Mapping (Inference Table)

Common automated inferences for the annotation path:

| I>O State | EXPENSE_CAT | Inferred Account Pair | Confidence |
|-----------|------------|----------------------|-----------|
| I<I (settled income) | — | 0100 Op Income / Asset | High |
| I>I (future income) | — | 0101 Op Income / Liability | High |
| I<O (refund given) | — | 0100 Op Income / Asset (reversal) | High |
| I>O (credit note) | — | 0101 Op Income / Liability (reversal) | High |
| O<O (settled expense) | 00 (job charge billed) | 0100 Op Income / Asset (COGS offset) | Medium |
| O<O (settled expense) | 01 (COGS absorbed) | 0000 Op Expense / Asset | High |
| O<O (settled expense) | 10 (running cost) | 0000 Op Expense / Asset | High |
| O>O (future expense) | 01 (COGS) | 0001 Op Expense / Liability | High |
| O>O (future expense) | 10 (running cost) | 0001 Op Expense / Liability | High |
| O<I (reimbursed) | — | 1001 Asset / Equity (advance recovered) | Medium |
| O>I (reimb. pending) | — | 1001 Asset / Equity (advance) | Medium |

Medium-confidence inferences require a confirmation step in the UI before the account_pair_byte is attached.

---

### 17.5 Entry Type Matching Table (Deterministic)

With entry type known at creation time, every combination resolves to a single Account Pair with no inference required. Entry type is the wizard screen the worker used — the app enforces which I>O states are reachable from each entry point.

The `1110` Correction/Netting code is written only for programmatic/API-generated records that bypass the wizard, or when the entry type is unknown.

#### Income-side entry types

| Wizard Entry Type | I>O State | AP_DIR | Account Pair | AP_DIRECTION |
|-------------------|-----------|--------|--------------|--------------|
| Invoice (send bill) | I>I | Debit | 0101 Op Income / Liability | 0 (debit receivable) |
| Cash sale (paid now) | I<I | Debit | 0100 Op Income / Asset | 0 (debit cash) |
| Payment received (settling invoice) | I<I | Credit | 0101 Op Income / Liability | 1 (credit receivable — clears it) |
| Refund given | I<O | Credit | 0100 Op Income / Asset | 1 (credit cash out) |
| Credit note issued | I>O | Credit | 0101 Op Income / Liability | 1 (credit receivable reversal) |
| Quote / Estimate | I>I | Debit | 0101 Op Income / Liability | 0 (same as invoice; DRAFT=1) |

#### Expense-side entry types

| Wizard Entry Type | I>O State | EXPENSE_CAT | Account Pair | AP_DIRECTION |
|-------------------|-----------|-------------|--------------|--------------|
| Running cost — cash paid | O<O | 10 | 0000 Op Expense / Asset | 0 (debit expense, credit cash) |
| Running cost — bill received | O>O | 10 | 0001 Op Expense / Liability | 0 (debit expense, credit payable) |
| Running cost — bill paid | O<O | 10 | 0001 Op Expense / Liability | 1 (debit payable — clears it) |
| Job cost / COGS — cash paid | O<O | 01 | 0000 Op Expense / Asset | 0 (debit COGS, credit cash) |
| Job cost / COGS — bill received | O>O | 01 | 0001 Op Expense / Liability | 0 (debit COGS, credit payable) |
| Job charge — billed to customer | O<O | 00 | 0100 Op Income / Asset | 0 (COGS offset; appears on invoice) |
| Reimbursement given (advance) | O>I | — | 1001 Asset / Equity | 0 (debit asset — advance owed back) |
| Reimbursement received (recovery) | O<I | — | 1001 Asset / Equity | 1 (credit asset — advance recovered) |

#### Balance sheet entry types (DOMAIN=11 extension, post-MVP wizard)

| Wizard Entry Type | I>O State | Account Pair | AP_DIRECTION | Notes |
|-------------------|-----------|--------------|--------------|-------|
| Asset purchase — cash | O<O | 1011 Asset / Asset | 0 | Cash → fixed asset |
| Asset purchase — on finance | O>O | 1000 Asset / Liability | 0 | Asset acquired on credit |
| Loan repayment | O<O | 1000 Asset / Liability | 1 | Reduces liability |
| Owner contribution | I<I | 1001 Asset / Equity | 0 | Capital injection |
| Owner draw / distribution | O<O | 1001 Asset / Equity | 1 | Capital withdrawal |
| Internal transfer | O<O | 1011 Asset / Asset | 0 | Between own accounts |

---

### 17.6 Type-Change Reconciliation at Creation Screen

When a worker changes the entry type mid-creation, the app reconciles the frame encoding. Reconciliation rules cascade in this order:

**Step 1 — Direction change (I↔O flip):**
- `customer_amount` stays as the customer-facing amount
- `worker_amount` stays as the worker-internal amount
- DIRECTION bit in transaction_byte flips
- EXPENSE_CAT resets to 10 (running cost) as the safe default if direction flips to O
- Account Pair recalculated from new entry type

**Step 2 — Settlement state change (Past↔Future, TIME bit):**
- No field data changes — only TIME bit in transaction_byte flips
- Account Pair recalculated (e.g. O<O → O>O shifts Asset to Liability pair)
- AP_DIRECTION may change if the new state represents clearing a prior obligation

**Step 3 — EXPENSE_CAT change (within O-direction):**
- No field data changes
- fin_control EXPENSE_CAT bits update
- Account Pair recalculates (job charge ↔ COGS ↔ running cost all have different pairs)
- BILLED flag in fin_control updates (EXPENSE_CAT=00 forces BILLED=1)

**Step 4 — Entry type change requiring template switch:**
- If the new entry type maps to a different BASE_TEMPLATE (e.g. switching from Invoice to Service Record), the app prompts: "Switching to [type] will remove the financial block. Continue?"
- Field data shared between templates is preserved; template-specific fields are cleared
- Account Pair recalculates from new entry type

**Invariant:** The worker's entered amounts are never silently discarded. Direction changes swap the semantic label (income ↔ expense) but preserve the numeric values. The worker sees the amount relabelled, not erased.

---

### 17.7 Accounting Detail Display (Plain-English Account Names)

When "Show accounting detail" is toggled on, the app derives plain-English labels from `ACCOUNT_PAIR` + `AP_DIRECTION`:

| Account Pair | AP_DIRECTION=0 (debit primary) | AP_DIRECTION=1 (credit primary) |
|---|---|---|
| 0000 Op Expense / Asset | Debit: Expenses (Operating) / Credit: Assets (Cash) | Debit: Assets (Cash) / Credit: Expenses (Operating) — reversal |
| 0001 Op Expense / Liability | Debit: Expenses (Operating) / Credit: Liabilities (Payable) | Debit: Liabilities (Payable) / Credit: Expenses (Operating) — payment |
| 0010 Non-Op Expense / Asset | Debit: Expenses (Non-Operating) / Credit: Assets (Cash) | Debit: Assets (Cash) / Credit: Expenses (Non-Operating) |
| 0011 Non-Op Expense / Liability | Debit: Expenses (Non-Operating) / Credit: Liabilities (Payable) | Debit: Liabilities (Payable) / Credit: Expenses (Non-Operating) |
| 0100 Op Income / Asset | Debit: Assets (Cash) / Credit: Income (Operating) | Debit: Income (Operating) / Credit: Assets (Cash) — refund |
| 0101 Op Income / Liability | Debit: Assets (Receivable) / Credit: Income (Operating) | Debit: Income (Operating) / Credit: Assets (Receivable) — credit note |
| 0110 Non-Op Income / Asset | Debit: Assets (Cash) / Credit: Income (Non-Operating) | Debit: Income (Non-Operating) / Credit: Assets (Cash) |
| 0111 Non-Op Income / Liability | Debit: Assets (Receivable) / Credit: Income (Non-Operating) | Debit: Income (Non-Operating) / Credit: Assets (Receivable) |
| 1000 Asset / Liability | Debit: Assets (Fixed) / Credit: Liabilities (Finance) | Debit: Liabilities (Finance) / Credit: Assets (Cash) — repayment |
| 1001 Asset / Equity | Debit: Assets (Cash) / Credit: Equity (Capital) | Debit: Equity (Capital) / Credit: Assets (Cash) — distribution |
| 1010 Liability / Equity | Debit: Liabilities / Credit: Equity | Debit: Equity / Credit: Liabilities |
| 1011 Asset / Asset | Debit: Assets (Destination) / Credit: Assets (Source) | Debit: Assets (Source) / Credit: Assets (Destination) |
| 1100 Liability / Liability | Debit: Liabilities (Assumed) / Credit: Liabilities (Transferred) | reverse |
| 1101 Equity / Equity | Debit: Equity (Destination) / Credit: Equity (Source) | reverse |
| 1110 Correction / Netting | "Unclassified — review needed" | — |
| 1111 Compound continuation | (internal; not displayed) | — |

**Display format in app:**
```
▼ Accounting detail
  Type:    Operating Expense
  Debit:   Expenses (Operating)
  Credit:  Assets (Cash)
```

Type label derived from Account Pair's primary account category. Debit/Credit labels from the table above. No code numbers shown to the worker.
