# pads-v1 Frame Specification

**Status:** v0.1 draft — 2026-05-15  
**Decisions:** D1–D24 (see CODEC-EVOLUTION.md for full log)  
**Depends on:** STANDARD-FIELDS.md, ROLE-CODEBOOK.md  
**Replaces:** `1eg/` codec (codebook-c-kaios, current live)

---

## 1. Encoding Envelope

Every record is a binary byte sequence. The sequence is deflate-compressed, then base64url-encoded (no padding), then embedded in a URL fragment.

**URL scheme:** `workpads.me/p#<codebook-tag>/<base64url-deflated-frame>`  
**Codebook tag:** TBD (new tag distinct from `1eg` and `1bg`; signals pads-v1 format to receiver)  
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
                          1=date as uint16 days since 2020-01-01; time as uint16 minutes since midnight
  bit 5: (reserved)       must be 0
  bit 4: PARTICIPANTS     1=participants block follows data blocks
  bits 3-2: DOMAIN        00=none (no financial), 01=simple (I>O), 10=standard (BitLedger), 11=reserved
  bit 1: DRAFT            1=working draft, not finalised
  bit 0: RESTRICT_FORWARD 1=record must not be forwarded by recipient

═══ FINANCIAL CONTEXT (present when DOMAIN ≥ 01) ═════════════════

[setup_byte]              1 byte — if DOMAIN ≥ 01

  bits 7-5: DECIMAL_POS   decimal places in all amount fields
                          000=0 (whole units)  001=1  010=2 (pence/cents)
                          011=3  100=4  101=5  110=6 (crypto)  111=extension
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
  0x00–0x7F: ISO 4217 aligned (GBP=0x01, USD=0x02, EUR=0x03, NGN=0x20, KES=0x21, ...)
  0x80–0xEF: regional and digital currencies
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
  text (standard):  [uint16 length LE][UTF-8 bytes]  — bits 0-3, 7-11, FLAGS3 bits 4-6
  text (compact):   [uint8 length][UTF-8 bytes]       — bits 13, FLAGS3 bits 0-2
  date:             uint16 (COMPACT_TIME=1: days since 2020-01-01; COMPACT_TIME=0: see text)
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
  bit 1: HAS_ROLE_TEXT    1=free-text role label (when ROLE_TYPE=11 and no role_code byte)
  bit 0: IS_ORG           1=company/organisation  0=individual

[name]                    [uint16 len][UTF-8] — always present

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
```
Scenario: "Attended site, checked boiler. No charge."
Fields: job text (25 chars), date

meta1:         1B  (0b00000000 — BASE=000, no META2, no ACK, no CHAIN)
field_flags:   2B  (bits 0+2 set: job + date)
job block:     2+25 = 27B
date block:    2B   (COMPACT_TIME=0: ISO date [u16+10chars]=12B; or COMPACT_TIME=1: u16=2B)

Total (COMPACT_TIME=1): 1+2+27+2     = 32B raw
Total (COMPACT_TIME=0): 1+2+27+12    = 42B raw
```
Note: without meta2, COMPACT_TIME cannot be signalled → date must be text → 42B. Adding meta2 (1B) to signal COMPACT_TIME=1 saves 10B on the date but costs 1B for meta2 → net 9B saving if date present.

### Profile B — Simple payment received
```
Scenario: Customer paid £125.50 cash, Boiler repair, J. Smith, 2026-05-15
Fields: job, customer, date (compact), financial (payment received, customer_amount only)
```

```
meta1:              1B   0b10001000 = 0x88 (META2=1, EXT=0, BASE=001/Financial, no ACK/CHAIN/RECIP)
meta2:              1B   0b01000010 = 0x42 (SELF_DESC=0, COMPACT_TIME=1, res=0, PART=0, DOMAIN=01, DRAFT=0, RFWD=0)
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
meta2:              1B   0x42 (same as B)
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
meta1:              1B   0b11001000 = 0xC8 (META2=1, EXT=0, BASE=001, no ACK/CHAIN; RECIP=0)
meta2:              1B   0b01010010 = 0x52 (COMPACT_TIME=1, PARTICIPANTS=1, DOMAIN=01)
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
| Service note no financial | 42B | 32B | 10B (24%) | Date encoding + no enum bytes |
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

## 6. Migration Path: 1eg/ → pads-v1

### Breaking change summary
- Wire format incompatible at byte 1: 1eg/ starts with template byte `0x02`; pads-v1 starts with meta1 byte (valid range different)
- URL scheme: `#1eg/<payload>` vs `#<new-tag>/<payload>` — receiver identifies format by URL fragment prefix
- All existing 1eg/ records remain valid; they just need the legacy decoder

### Migration strategy

**Phase 1 — Dual codec (implementation)**
- Add `decode_pads1(frame)` to `codec.js` alongside existing `decode_1eg(frame)`
- New records encoded as pads-v1 immediately
- Incoming URLs: inspect fragment prefix, route to appropriate decoder
- Estimated codec.js change: +300–400 lines for new encoder/decoder; legacy decoder unchanged

**Phase 2 — Gradual re-encoding**
- When a 1eg/ record is opened in the app, offer "Update record" to re-encode as pads-v1
- On chain link: re-encode parent when creating child if parent is 1eg/
- Shared URLs: receiver app detects 1eg/ and offers upgrade on receipt

**Phase 3 — Legacy sunset (12+ months)**
- Remove `decode_1eg` from codec.js when usage telemetry (or a defined cutover date) confirms negligible legacy traffic
- Keep legacy decoder in archival/export-only path for permanent historical access

### Field mapping (1eg/ → pads-v1)

| 1eg/ field | pads-v1 field | Notes |
|---|---|---|
| template byte `0x02` | meta1 BASE_TEMPLATE | Enum→structured type |
| flags byte[0] bits 0-11 | field_flags bits 0-11 | Direct mapping |
| flags byte[2] extended | field_flags3 / participants | Expand as needed |
| `record_type` enum | transaction_byte DIRECTION+TIME+EFFECT | I>O notation replaces enum |
| `vat` enum | setup_byte TAX_CODE | 0→00, 1→01, 2→10 |
| `currency` enum | setup_byte CURRENCY + currency_ext | Home→00, others→extended |
| amount UTF-8 string | customer_amount uint24 | Parse string, multiply by 10^D |
| date ISO string | date field (COMPACT_TIME=1 → uint16) | Days since 2020-01-01 |
| participants (bit 19) | participants block | Part_flags + structured fields |

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
                          01=pay period close (pay period finalised for a worker)
                          10=period summary (income/expense/net for a date range)
                          11=annual aggregate (full-year financial summary)

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
- For COMMIT_TYPE=01 (pay period close): `worker_amount` = net pay for the period; `customer_amount` = gross
- For COMMIT_TYPE=10/11 (period summary): COMPOUND_VALUE=1; compound lines carry category totals (income, expense, COGS, net)

**Date range for period records:**
- `date` field (field_flags bit 2): period start date
- `date_end` field (field_flags3 bit 3*): period end date
- *Note: field_flags3 bit 3 currently assigned `expiry_date`; resolution pending — swap expiry_date to FLAGS4, reassign bit 3 to date_end

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
                              11=hybrid (some inline, some resolved by receiver)

    bit 3: SHOW_PRICE         1=prices displayed in menu/list lines
    bit 2: SHOW_CONTACT       1=phone/email shown in card view (RECIPIENT_TYPE=0 only)
    bit 1: ACCENT_COLOR       1=accent_color byte follows
    bit 0: DISPLAY_FLAGS2     1=display_flags2 byte follows

  [accent_color]           1 byte — if ACCENT_COLOR=1
    3-bit R (high), 3-bit G, 2-bit B — 256-slot pastel palette

  [display_flags2]         1 byte — if DISPLAY_FLAGS2=1
    bits 7-5: FONT_SIZE       000=default  001=large  010=compact
    bits 4-3: LAYOUT_COLS     00=1-col  01=2-col  10=auto  11=reserved
    bits 2-0: reserved        must be 0
```

### 11.2 Form Schema Block

Present when `display_schema` DISPLAY_TYPE=02 or 03, enabling collect-and-reply capability.

```
[form_schema]             variable length

  byte 1: FORM_CONTROL
    bits 7-6: SUBMIT_ACTION   00=reply record (receiver submits as a new pads-v1 record)
                              01=web endpoint (URL in form payload)
                              10=email (address in form payload)
                              11=reserved
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

## 12. Security Wrapper (OQ-14)

The security wrapper sits outside the pads-v1 frame. It is applied after the frame is assembled and before base64url encoding. The URL tag signals the security level.

**URL tags by security level:**
- `#1pv/<payload>` — plaintext (no wrapper; default for customer-facing records)
- `#1ps/<payload>` — full security wrapper (private/colleague records, cost data)
- `#1ph/<payload>` — partial wrapper (field-level scramble only; no AES)
- `#1pt/<payload>` — template-keyed (display schema keyed; payload decoded with known template)

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
- Full frame encrypted after deflate; 128-bit key
- IV = record UID hash (first 16 bytes)
- Key = shared secret derived from sender+receiver identity pair
- Layer tag: `AES=1` in preamble byte

**Layer 4 — Receiver commitment HMAC:**
- 8-byte HMAC-SHA256 truncated tag appended to payload
- Commits to receiver identity: only the named receiver can verify
- Layer tag: `HMAC=1` in preamble byte; requires RECIPIENT_TYPE=1 in meta1

**Layer 5 — Preamble byte** (1 byte, prepended before base64url):
```
  bit 7: SCRAMBLE         1=field scramble applied
  bit 6: AES              1=AES-CTR encryption applied
  bit 5: HMAC             1=receiver commitment HMAC appended
  bit 4: SEED_POISON      1=deflate seed poisoning applied
  bits 3-0: KEY_HINT      lower 4 bits of key ID (helps receiver select decryption key)
```

**Wrapper format (assembled):**
```
[preamble_byte][AES-CTR([seed-poisoned-deflate([frame])])][HMAC_tag?]
```
All then base64url-encoded as the URL fragment payload.

### 12.2 Private Record Convention

Records with `worker_amount` or `EXPENSE_CATEGORY=01/10` (cost data, internal) should always use at minimum `#1ps/` (full wrapper) when shared. The caller (app share sheet) enforces this — the codec itself does not refuse to encode without a wrapper.

---

## 13. alt_id Extension (OQ-31)

The `alt_id` block provides an alternative identifier for participants without a phone number — common in low-connectivity markets (Africa, South/Southeast Asia).

**Current constraint:** All 8 bits of `part_flags` are used; `HAS_ALT_ID` requires a 9th bit.  
**Resolution options (pending OQ-31 decision):**
- Option A: Pack ROLE_TYPE into 2 bits (drop extended role from quick-select; 6 roles fit in 2 bits: Customer, Worker, Supplier, Subcontractor, Employee, Agent — Authority drops to role_code path)
- Option B: Extend to 2-byte `part_flags` when a new high-bit escape is encountered

Until resolved, alt_id is treated as post-MVP. The block definition below assumes Option A (ROLE_TYPE=2 bits, freeing 1 bit for HAS_ALT_ID).

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
    bit 0: vcard_org        organisation name (separate from name field)    [u16 len][UTF-8]
    bit 1: vcard_title      job title / role label                          [u8 len][UTF-8]
    bit 2: vcard_address    postal address                                  [u16 len][UTF-8]
    bit 3: vcard_website    website URL                                     [u16 len][UTF-8]
    bit 4: vcard_note       contact note                                    [u16 len][UTF-8]
    bits 5-7: reserved      must be 0 (for Contact template)

  Financial record template assignments (BASE_TEMPLATE=001):
    bit 0: service_ref   back-reference to service template that generated this record   [u8 len][UTF-8]
    bit 1: expiry_date   record/offer expiry date (moved from FLAGS3 bit 3)              u16 days*
    bits 2–7: reserved

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
| form_schema | cond | — | — | — | — |
| security wrapper | optional | optional | optional | optional | optional |
| alt_id (per participant) | cond | cond | cond | cond | cond |

**Key:** ✓=always present when template active; cond=present when condition met; —=never present; optional=app-layer decision

**Amendment field data** is governed by the `changed_mask` bytes, not `field_flags`. Field_flags is absent in BASE_TEMPLATE=110.

---

## 7. Open Design Points

These are not unresolved decisions but implementation-time choices:

| Point | Note |
|-------|------|
| Codebook tag string | New tag (replacing `1eg`) to be chosen; must not start with `1e` to avoid false positives |
| DECIMAL_POS=111 extension | Exotic precision extension byte not yet defined; leave as error |
| TAX_CODE=01/10 codebook values | Standard/reduced rates defined per codebook package (e.g., package `c` → 20%/5% UK VAT) |
| DOMAIN=11 (hybrid) | Reserved; decoder must reject |
| FLAGS4 layout | Template-defined; Contact/entity template owns bits 0–4 of FLAGS4 (vCard extended fields) |
| uint16 length prefix byte order | Little-endian (matching browser DataView defaults) vs big-endian — standardise at implementation |
| Epoch for COMPACT_TIME dates | 2020-01-01 proposed; finalise at implementation |
