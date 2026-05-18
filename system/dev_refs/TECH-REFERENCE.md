# TECH-REFERENCE — pads-v1 Codebook and Option Matrix Reference

**As of:** 2026-05-17  
**Status:** Permanent reference — update whenever spec decisions are made  
**Depends on:** FRAME-SPEC.md, STANDARD-FIELDS.md, OPEN-QUESTIONS.md, ROLE-CODEBOOK.md  
**Future location:** `dev_refs/TECH-REFERENCE.md`

No prose. Tables only. Look up valid values for any field here.

---

## 1. BASE_TEMPLATE Codes

Encoded in meta1 bits 5–3 when EXT_TEMPLATE=0.

| Code (bits 5-3) | Name | Description | transaction_byte present? |
|-----------------|------|-------------|--------------------------|
| `000` | Service record | Service note, no financial block | No |
| `001` | Financial record | Single I>O transaction | Yes |
| `010` | Compound financial | Multiple line items; COMPOUND_VALUE=1 in sf_byte | Yes |
| `011` | Contact/entity | Person or organisation record, vCard-equivalent | No |
| `100` | Document/media | File reference record | No |
| `101` | State Commit | Snapshot: period summary, pay summary, job close | No (setup_byte present, transaction_byte absent) |
| `110` | Amendment | Edit/revision of a prior record; carries parent UID | No |
| `111` | Generic | DOMAIN bits in meta2 provide further context | Conditional on DOMAIN |

---

## 2. DOMAIN Modes

Encoded in meta2 bits 3–2.

| Bits 3-2 | Name | transaction_byte layout | fin_control layout |
|----------|------|-------------------------|--------------------|
| `00` | None | Absent (no financial) | Absent |
| `01` | Simple (I>O) | DIRECTION:1 / TIME:1 / EFFECT:1 / SUBTYPE:2 / QTY_SPLIT:1 / ROUNDING:2 | BILLED:1 / 0:1 / QTY_TYPE:1 / PARITY:1 / EXPENSE_CAT:2 / CUSTOMER_AMT:1 / WORKER_AMT:1 |
| `10` | Standard (BitLedger) | ACCOUNT_PAIR:4 / DIRECTION:1 / STATUS:1 / QTY_SPLIT:1 / ROUNDING:1 | BILLED:1 / 1:1 / ACCOUNT_PAIR:4 / CUSTOMER_AMT:1 / WORKER_AMT:1 |
| `11` | Active design (hybrid) | Not yet implemented — decoder must treat as unknown | Not yet implemented |

---

## 3. I>O State Matrix (DOMAIN=01)

Transaction byte formula:
```
byte = (DIRECTION << 7) | (TIME << 6) | (EFFECT << 5) | (SUBTYPE << 3) | (QTY_SPLIT << 2) | ROUNDING
```

Values below: QTY_SPLIT=0, ROUNDING=00 (exact, no quantity encoding).

| State | Notation | D | T | E | Sub | transaction_byte (hex) | Worker label | Customer label |
|-------|----------|---|---|---|-----|------------------------|--------------|----------------|
| Settled income | `I < I` | 0 | 0 | 0 | 00 | `0x00` | Standard payment | Paid |
| Settled income | `I < I` | 0 | 0 | 0 | 01 | `0x08` | Deposit/partial | Deposit paid |
| Settled income | `I < I` | 0 | 0 | 0 | 10 | `0x10` | Final payment | Final payment |
| Settled income | `I < I` | 0 | 0 | 0 | 11 | `0x18` | Tip/gratuity | Tip |
| Future income | `I > I` | 0 | 1 | 0 | 00 | `0x40` | Invoice | Invoice |
| Future income | `I > I` | 0 | 1 | 0 | 01 | `0x48` | Quote/estimate | Quote |
| Future income | `I > I` | 0 | 1 | 0 | 10 | `0x50` | Retainer | Retainer |
| Future income | `I > I` | 0 | 1 | 0 | 11 | `0x58` | Recurring | Recurring |
| Refund/credit out | `I < O` | 0 | 0 | 1 | 00 | `0x20` | Full refund | Refunded |
| Refund/credit out | `I < O` | 0 | 0 | 1 | 01 | `0x28` | Part-refund | Part-refund |
| Refund/credit out | `I < O` | 0 | 0 | 1 | 10 | `0x30` | Goodwill refund | Goodwill refund |
| Refund/credit out | `I < O` | 0 | 0 | 1 | 11 | `0x38` | Overpayment back | Overpayment returned |
| Credit note | `I > O` | 0 | 1 | 1 | 00 | `0x60` | Credit note | Credit note |
| Credit note | `I > O` | 0 | 1 | 1 | 01 | `0x68` | Return pending | Return auth |
| Credit note | `I > O` | 0 | 1 | 1 | 10 | `0x70` | Discount | Discount |
| Credit note | `I > O` | 0 | 1 | 1 | 11 | `0x78` | Credit balance | Credit balance |
| Settled expense | `O < O` | 1 | 0 | 1 | 00 | `0xA0` | General expense | — |
| Settled expense | `O < O` | 1 | 0 | 1 | 01 | `0xA8` | Travel/mileage | — |
| Settled expense | `O < O` | 1 | 0 | 1 | 10 | `0xB0` | Materials/supplies | — |
| Settled expense | `O < O` | 1 | 0 | 1 | 11 | `0xB8` | Subcontractor | — |
| Future expense | `O > O` | 1 | 1 | 1 | 00 | `0xE0` | Bill received | — |
| Future expense | `O > O` | 1 | 1 | 1 | 01 | `0xE8` | Scheduled payment | — |
| Future expense | `O > O` | 1 | 1 | 1 | 10 | `0xF0` | Supplier order | — |
| Future expense | `O > O` | 1 | 1 | 1 | 11 | `0xF8` | Future subcon cost | — |
| Reimbursed | `O < I` | 1 | 0 | 0 | 00 | `0x80` | General reimb. | — |
| Reimbursed | `O < I` | 1 | 0 | 0 | 01 | `0x88` | Travel reimbursed | — |
| Reimbursed | `O < I` | 1 | 0 | 0 | 10 | `0x90` | Materials recovered | — |
| Reimbursed | `O < I` | 1 | 0 | 0 | 11 | `0x98` | Advance returned | — |
| Reimb. pending | `O > I` | 1 | 1 | 0 | 00 | `0xC0` | Claim submitted | — |
| Reimb. pending | `O > I` | 1 | 1 | 0 | 01 | `0xC8` | Travel claim | — |
| Reimb. pending | `O > I` | 1 | 1 | 0 | 10 | `0xD0` | Materials claim | — |
| Reimb. pending | `O > I` | 1 | 1 | 0 | 11 | `0xD8` | Advance requested | — |

**D = DIRECTION, T = TIME, E = EFFECT.** Customer label shown only for income states; expense/reimbursement states do not have a customer-facing equivalent in the standard spec.

To add QTY_SPLIT=1: OR the base hex value with `0x04`.  
To add ROUNDING=down: OR with `0x02`. To add ROUNDING=up: OR with `0x03`.

---

## 4. BitLedger Account Pair Codes (DOMAIN=10)

Encoded in transaction_byte bits 7–4 (and in fin_control bits 5–2 for standard mode).

| 4-bit code | Account pair | Typical I>O equivalent | Direction meaning (bit 3) |
|------------|-------------|------------------------|--------------------------|
| `0000` | Op Expense / Asset | `O<O` (cash expense) | 0=plus/in, 1=minus/out |
| `0001` | Op Expense / Liability | `O>O` (bill received) | 0=plus/in, 1=minus/out |
| `0010` | Non-Op Expense / Asset | No direct I>O | 0=plus/in, 1=minus/out |
| `0011` | Non-Op Expense / Liability | No direct I>O | 0=plus/in, 1=minus/out |
| `0100` | Op Income / Asset | `I<I` / `I<O` | 0=plus/in, 1=minus/out |
| `0101` | Op Income / Liability | `I>I` / `I>O` | 0=plus/in, 1=minus/out |
| `0110` | Non-Op Income / Asset | No direct I>O | 0=plus/in, 1=minus/out |
| `0111` | Non-Op Income / Liability | No direct I>O | 0=plus/in, 1=minus/out |
| `1000` | Asset / Liability | No direct I>O | 0=plus/in, 1=minus/out |
| `1001` | Asset / Equity | No direct I>O | 0=plus/in, 1=minus/out |
| `1010` | Liability / Equity | No direct I>O | 0=plus/in, 1=minus/out |
| `1011` | Asset / Asset | No direct I>O | 0=plus/in, 1=minus/out |
| `1100` | Liability / Liability | No direct I>O | 0=plus/in, 1=minus/out |
| `1101` | Equity / Equity | No direct I>O | 0=plus/in, 1=minus/out |
| `1110` | Correction/Netting | Special | Reserved |
| `1111` | Compound Continuation | Special | Reserved |

Codes `0000`–`1101` are active (14 pairs). `1110` and `1111` are reserved.

---

## 5. TAX_CODE Values

Encoded in setup_byte bits 2–1.

| Bits 2-1 | Name | tax_block required? | Meaning |
|----------|------|---------------------|---------|
| `00` | No tax | No | No tax applicable; tax_block absent |
| `01` | Tax inclusive | Yes | customer_amount includes tax; tax_block carries permille rate + tax amount for breakdown display |
| `10` | Tax exclusive | Yes | Tax added on top of customer_amount; tax_block carries permille rate + tax amount |
| `11` | Compound tax | Yes | Multiple rates (e.g. VAT + levy); full compound tax block structure — post-MVP |

No rates are assumed or codebook-defined. Every taxed record must carry an explicit rate in the tax_block.

---

## 6. CURRENCY Quick-Select (setup_byte bits 4–3)

| Bits 4-3 | Meaning |
|----------|---------|
| `00` | Sender home currency (zero overhead — no currency_ext byte) |
| `01` | First codebook common cross-currency (defined per codebook package) |
| `10` | Second codebook common cross-currency (defined per codebook package) |
| `11` | Extended — currency_ext byte follows (uint8, 0x01–0xFE; see OPEN-QUESTIONS.md §OQ-3) |

Full 254-slot currency code table: OPEN-QUESTIONS.md §OQ-3.

---

## 7. DECIMAL_POS Values

Encoded in setup_byte bits 7–5.

| Bits 7-5 | Decimal places | Example (GBP) | Notes |
|----------|---------------|---------------|-------|
| `000` | 0 | Whole pounds only | Rare; used for large round-figure amounts |
| `001` | 1 | £12.5 | Uncommon |
| `010` | 2 | £12.50 | Standard for most currencies (pence/cents) |
| `011` | 3 | £12.500 | High-precision fiat |
| `100` | 4 | £12.5000 | High-precision fiat / some crypto |
| `101` | 5 | £12.50000 | |
| `110` | 6 | £12.500000 | Crypto (e.g. USDC at 6 decimal places) |
| `111` | Extension | — | Exotic precision; extension byte not yet defined; treat as error |

---

## 8. SCALING_FACTOR Values

Encoded in sf_byte bits 7–5 (sf_byte present when SF_PRESENT=1 in setup_byte).

| Bits 7-5 | Multiplier | Use case |
|----------|------------|----------|
| `000` | ×1 | Default; no scaling |
| `001` | ×10 | Large amounts; push effective range up by 10× |
| `010` | ×100 | Very large amounts |
| `011` | ×1,000 | Large project amounts |
| `100` | ×10,000 | |
| `101` | ×100,000 | |
| `110` | ×1,000,000 | Very high-value transactions |
| `111` | ×1,000,000,000 | Extreme scale (e.g. government contracts) |

Value formula: `Real Value = (stored_uint24 × SF) / 10^DECIMAL_POS`

---

## 9. SPLIT_POINT Table (QTY_COMPACT=1)

Packed quantity+rate encoding. Applies when QTY_COMPACT=1 in sf_byte and QTY_SPLIT=1 in transaction_byte. Both packed into the 24-bit customer_amount field.

Values below for DECIMAL_POS=2 (pence/cents), SF=×1.

| Stored value (bits 2-0) | qty bits | qty max | rate bits | rate max (GBP) |
|------------------------|----------|---------|-----------|----------------|
| `0` (default) | 8 | 255 | 16 | £655.35 (SF×10 → £6,553.50) |
| `1` | 1 | 1 | 23 | £83,886.07 |
| `2` | 2 | 3 | 22 | £41,943.03 |
| `3` | 3 | 7 | 21 | £20,971.51 |
| `4` | 4 | 15 | 20 | £10,485.75 |
| `5` | 5 | 31 | 19 | £5,242.87 |
| `6` | 6 | 63 | 18 | £2,621.43 |
| `7` | 7 | 127 | 17 | £1,310.71 |

Unpack formula:
```
SP = 8 if SPLIT_POINT=0, else SPLIT_POINT value
qty  = customer_amount & ((1 << SP) - 1)
rate = customer_amount >> SP
Real Value = (rate × qty × SF) / 10^DECIMAL_POS
```

QTY_COMPACT=1 is best suited for integer-qty records (parts, visits, km). For fractional hours, use QTY_COMPACT=0 with the separate qty_rate_block (6 bytes).

---

## 10. EXT_SIGNAL Codes

Encoded in meta1 bits 5–3 when EXT_TEMPLATE=1.

| Bits 5-3 | Extra bytes | Capacity | Notes |
|----------|-------------|----------|-------|
| `001` | +1 byte | 256 domain types per codebook package | |
| `010` | +2 bytes | 65,536 domain types (uint16 big-endian) | |
| `011` | +3 bytes | 16,777,216 domain types (24-bit big-endian) | |
| `100` | +3 bytes (variant) | Decentralised: CRC-8 namespace + CRC-16 local ID | byte 1=CRC-8 of creator identity hash; bytes 2–3=CRC-16 of (identity + template name + creation date); collision ~1 in 16M |
| `000`, `101`–`111` | — | Reserved | Do not use |

---

## 11. COMPACT_TIME Encoding

Active when meta2 COMPACT_TIME=1. Requires meta2 to be present (META2_PRESENT=1 in meta1).

| Field | Encoding | Epoch | Range | Bytes |
|-------|----------|-------|-------|-------|
| date | uint16 (days since epoch) | 2000-01-01 | 2000-01-01 to ~2179-06-06 | 2 |
| meeting_time | uint16 (minutes since midnight) | midnight (00:00) | 00:00–23:59 (0–1439) | 2 |
| start_time | uint16 (minutes since midnight) | midnight (00:00) | 00:00–23:59 (0–1439) | 2 |
| end_time | uint16 (minutes since midnight) | midnight (00:00) | 00:00–23:59 (0–1439) | 2 |
| due_date | uint16 (days since epoch) | 2000-01-01 | 2000-01-01 to ~2179-06-06 | 2 |
| date_end | uint16 (days since epoch) | 2000-01-01 | 2000-01-01 to ~2179-06-06 | 2 |

When COMPACT_TIME=0, date and time fields are encoded as `[u16 len][UTF-8 ISO string]` (12 bytes typical for a date). Big-endian throughout.

---

## 12. field_flags Bit Assignments (Base, 2 bytes)

Always present. Bits 0–15. Big-endian bit order (bit 0 = LSB of first byte).

| Bit | Canonical name | Data type | Typical max size | Notes |
|-----|---------------|-----------|-----------------|-------|
| 0 | `job` | `[u16 len][UTF-8]` | 120 B | Job title / service subject line |
| 1 | `customer` | `[u16 len][UTF-8]` | 120 B | Customer / client name |
| 2 | `date` | `u16` (COMPACT) or `[u16 len][UTF-8]` | 2 B / 12 B | Service or transaction date |
| 3 | `location` | `[u16 len][UTF-8]` | 160 B | Service address / site |
| 4 | `meeting_time` | `u16` (COMPACT) or `[u16 len][UTF-8]` | 2 B / 8 B | Appointment / meeting time |
| 5 | `start_time` | `u16` (COMPACT) or `[u16 len][UTF-8]` | 2 B / 8 B | Job start time |
| 6 | `end_time` | `u16` (COMPACT) or `[u16 len][UTF-8]` | 2 B / 8 B | Job end time |
| 7 | `customer_phone` | `[u16 len][UTF-8]` | 40 B | Customer phone |
| 8 | `worker` | `[u16 len][UTF-8]` | 80 B | Worker name (prefer participants block for new records) |
| 9 | `actions` | array: `[u8 count]` + per-item `[u16 len][UTF-8][u8 status]` | variable | Checklist / task list |
| 10 | `details` | `[u16 len][UTF-8]` | 500 B | Secondary description / scope detail |
| 11 | `story` | `[u16 len][UTF-8]` | 2000 B | Full job notes / long-form content |
| 12 | `financial_block` | gate — no data block | — | 1 = financial block present; triggers fin_control |
| 13 | `ref_number` | `[u8 len][UTF-8]` | 64 B | Invoice/quote/job reference (compact encoding) |
| 14 | `due_date` | `u16` (COMPACT) or `[u16 len][UTF-8]` | 2 B / 12 B | Payment due or action deadline |
| 15 | `FLAGS3_PRESENT` | gate — no data block | — | 1 = field_flags3 byte follows |

Data blocks follow field_flags in ascending bit order. Compact text (bit 13: `ref_number`) uses `[u8 len]`; all others use `[u16 len]`.

---

## 13. field_flags3 Bit Assignments

Present when field_flags bit 15 (FLAGS3_PRESENT) = 1.

| Bit | Canonical name | Data type | Notes |
|-----|---------------|-----------|-------|
| 0 | `context_label` | `[u8 len][UTF-8]`, max 40 B | Short job context summary for standalone intelligibility |
| 1 | `tag` | `[u8 len][UTF-8]`, max 60 B | Category / classification tag (compact encoding) |
| 2 | `qty_unit` | `[u8 len][UTF-8]`, max 12 B | Custom unit label (e.g. "hrs", "kg", "pcs") (compact encoding) |
| 3 | `date_end` | `u16` (COMPACT) or `[u16 len][UTF-8]` | Period end date (for reports/summaries) |
| 4 | `attachment` | `[u16 len][UTF-8]`, max 500 B | URL or hash of attached document / photo |
| 5 | `uid` | `[u16 len][UTF-8]`, max 80 B | Record or contact UID; enables cross-record linking |
| 6 | `url` | `[u16 len][UTF-8]`, max 500 B | Website, social profile, or reference URL |
| 7 | `FLAGS4_PRESENT` | gate — no data block | 1 = field_flags4 byte follows |

Note: STANDARD-FIELDS.md §3 shows bit 3 as `expiry_date`; FRAME-SPEC.md §14 and §9 clarify that `expiry_date` moved to field_flags4 bit 1 (Financial template). For period reports, FLAGS3 bit 3 = `date_end`. See FRAME-SPEC.md §9.

---

## 14. field_flags4 Assignments by Template

Present when FLAGS3 bit 7 (FLAGS4_PRESENT) = 1. Bit layout is template-defined.

### Contact/entity template (BASE_TEMPLATE=011)

| Bit | Field name | Data type | vCard equivalent |
|-----|-----------|-----------|-----------------|
| 0 | `vcard_org` | `[u16 len][UTF-8]` | `ORG` |
| 1 | `vcard_title` | `[u8 len][UTF-8]` | `TITLE` |
| 2 | `vcard_address` | `[u16 len][UTF-8]` | `ADR` |
| 3 | `vcard_website` | `[u16 len][UTF-8]` | `URL` |
| 4 | `vcard_note` | `[u16 len][UTF-8]` | `NOTE` |
| 5–6 | reserved | — | Must be 0 |
| 7 | FLAGS5_PRESENT | gate | Chains to FLAGS5 |

### Financial record template (BASE_TEMPLATE=001)

| Bit | Field name | Data type | Notes |
|-----|-----------|-----------|-------|
| 0 | `service_ref` | `[u8 len][UTF-8]` | Back-reference to service template that generated this record |
| 1 | `expiry_date` | `u16` (COMPACT) or `[u16 len][UTF-8]` | Record or offer expiry date |
| 2–6 | reserved | — | Must be 0 |
| 7 | FLAGS5_PRESENT | gate | Chains to FLAGS5 |

### EXT_TEMPLATE records

Bits 0–6 defined by the ext_template domain schema. FLAGS4 data blocks follow FLAGS4 in ascending bit order, same encoding rules as FLAGS3.

---

## 15. part_flags Bit Layout

One byte per participant in the participants block.

| Bit | Name | Values |
|-----|------|--------|
| 7 | IS_SENDER | 0=not sender, 1=this participant is the record sender |
| 6–5 | ROLE_TYPE | `00`=Customer, `01`=Worker, `10`=Supplier/Vendor, `11`=role_code present |
| 4 | HAS_ALT_ID | 0=no alt_id, 1=alt_id block follows (after phone/email/role fields) |
| 3 | HAS_PHONE | 0=no phone, 1=phone field follows |
| 2 | HAS_EMAIL | 0=no email, 1=email field follows |
| 1 | HAS_ROLE_TEXT | 0=no free-text role, 1=role_text field follows (when ROLE_TYPE=11 and no role_code byte) |
| 0 | IS_ORG | 0=individual, 1=company/organisation |

When ROLE_TYPE=11 and HAS_ROLE_TEXT=0: role_code byte(s) follow. When ROLE_TYPE=11 and HAS_ROLE_TEXT=1: role_text field follows instead.

---

## 16. ROLE_TYPE Quick-Select (2-bit)

Encoded in part_flags bits 6–5.

| Bits 6-5 | Role | Note |
|----------|------|------|
| `00` | Customer | Default customer role |
| `01` | Worker | Technician, tradesperson, employee |
| `10` | Supplier/Vendor | Supplier, vendor, contractor company |
| `11` | Extended | role_code byte(s) or role_text field follows; covers Subcontractor, Employee, Agent, Authority and all named roles in ROLE-CODEBOOK.md |

Full role codebook (240+ named roles): ROLE-CODEBOOK.md §3 and §4.

---

## 17. compound_line_flags

Present per line when LINE_FLAGS_PRESENT=1 in compound_header (COMPOUND_VALUE=1 in sf_byte).

| Bits | Field | Values |
|------|-------|--------|
| 7–6 | LINE_TYPE | `00`=standard line (income/expense item), `01`=deduction (negative; e.g. employee deduction), `10`=employer-add (positive cost addition; e.g. employer NI), `11`=summary (aggregate/total; no qty) |
| 5–4 | TAX_MODE | `00`=not applicable (column hidden when all lines are 00), `01`=standard rate (from setup_byte TAX_CODE), `10`=reduced rate (codebook-defined), `11`=zero/exempt |
| 3 | QTY_LINE | 0=no qty/rate for this line, 1=line_qty (u24) and line_rate (u24) follow line_amount |
| 2–0 | reserved | Must be 0 |

---

## 18. state_commit Byte

Present when BASE_TEMPLATE=101 (State Commit records).

| Bits | Field | Values |
|------|-------|--------|
| 7–6 | COMMIT_TYPE | `00`=job close (job finalised; balance outstanding shown), `01`=pay period close (pay period finalised for a worker), `10`=period summary (income/expense/net for a date range), `11`=annual aggregate (full-year financial summary) |
| 5–4 | PERIOD_TYPE | `00`=calendar month, `01`=tax week, `10`=tax month, `11`=custom (date_end field required); meaningful for COMMIT_TYPE=10/11 |
| 3 | CHAIN_COMPLETE | 0=outstanding items exist, 1=all chained child records settled |
| 2 | DISPUTE_FLAG | 0=no disputes, 1=at least one chained record in dispute or uncorrected |
| 1–0 | reserved | Must be 0 |

---

## 19. display_schema DISPLAY_CONTROL Byte

First byte of the display_schema block; present in `#1pb/` and `#1pf/` records.

| Bits | Field | Values |
|------|-------|--------|
| 7–6 | DISPLAY_TYPE | `00`=card (single block, avatar-style), `01`=list (vertically stacked line items), `10`=menu (service catalog with prices), `11`=form-only (no display body; form schema drives layout) |
| 5–4 | DATA_SOURCE | `00`=inline (all data in this record), `01`=contact-resident (payload is contact ID; receiver fills from contacts), `10`=activity profile (data from sender's activity profile), `11`=anonymous/stealth (no sender identity; no reply routing address; SUBMIT_ACTION=11 required if form present) |
| 3 | SHOW_PRICE | 0=prices hidden, 1=prices displayed in menu/list lines |
| 2 | SHOW_CONTACT | 0=contact hidden, 1=phone/email shown in card view (RECIPIENT_TYPE=0 only) |
| 1 | ACCENT_COLOR | 0=no accent, 1=accent_color byte follows (3-bit R / 3-bit G / 2-bit B, 256-slot pastel palette) |
| 0 | DISPLAY_FLAGS2 | 0=absent, 1=display_flags2 byte follows |

### display_flags2

| Bits | Field | Values |
|------|-------|--------|
| 7–5 | FONT_SIZE | `000`=default, `001`=large, `010`=compact |
| 4–3 | LAYOUT_COLS | `00`=1-col, `01`=2-col, `10`=auto, `11`=reserved |
| 2 | HAS_TRIG | 0=no TRIG block, 1=TRIG bytecode block follows this display schema block |
| 1–0 | reserved | Must be 0 |

---

## 20. TRIG Pattern Tokens

1-byte programs (high nibble = `0x0`). Complete program — no header, no stack machine entered.

| Token byte | Name | Equivalent program |
|------------|------|--------------------|
| `0x00` | SHOW_ALWAYS | Show card to all visitors. Shell default if no TRIG block present. |
| `0x01` | KNOWN_CONTACT_SHOW | Show card only if sender is a known contact |
| `0x02` | HAS_APP_SHOW | Show card only if viewer has the app installed |
| `0x03` | CODE_VERIFIED_SHOW | Show card only if per-contact scramble code has been verified |
| `0x04` | HUMAN_SHOW | Show card if human visitor detected (anti-bot) |
| `0x05` | KNOWN_OR_APP_SHOW | Show card if known contact OR has app |
| `0x06` | KNOWN_AND_APP_SHOW | Show card if known contact AND has app |
| `0x07` | ALWAYS_BLANK | Show nothing (stealth / test mode) |
| `0x08` | FORM_ALWAYS | Show contact form to all visitors |
| `0x09` | FORM_IF_HUMAN | Show form only if human visitor |
| `0x0A` | SERVICE_MENU_ALWAYS | Show service menu to all visitors |
| `0x0B` | SERVICE_MENU_KNOWN | Show service menu to known contacts only |
| `0x0C`–`0x0F` | RESERVED | Future common patterns |

**2-byte pattern + theme extension:** `0x0P 0x1T` — pattern P with CSS theme T (0–15 from theme codebook).

---

## 21. TRIG Condition Registry

Used by PUSH_COND (opcode `0xD_`) and TERNARY (opcode `0x9_`, cond_id byte).

| ID | Mnemonic | True when |
|----|----------|-----------|
| 0 | HAS_APP | Viewer has the app installed |
| 1 | KNOWN_CONTACT | Sender appears in viewer's local contacts |
| 2 | CODE_VERIFIED | Per-contact scramble code has been entered for this sender |
| 3 | IS_HUMAN | JS execution context detected + interaction signal (not a bot/crawler) |
| 4 | HAS_SAVED_RECORD | Viewer has previously saved a record from this sender |
| 5 | ORG_MATCH | Sender's org name matches a saved business contact on device |
| 6 | HAS_TEMPLATE | Viewer's app has the referenced template installed |
| 7 | DAYLIGHT_HOURS | Current local time is 06:00–20:00 |
| 8 | RECENT_CONTACT | Known contact with recorded interaction within 90 days |
| 9 | APP_VERSION_OK | Viewer app version >= version floor declared in record |
| 10 | REPLY_PENDING | Viewer has an unsent reply queued for this sender |
| 11 | LOCATION_NEAR | Device location within stated radius of record geo block (requires geo block present) |
| 12–14 | RESERVED | Future conditions |

All conditions are answered synchronously from local device state. No network requests during TRIG evaluation.

---

## 22. TRIG Display Modes

Used by SHOW (`0x3_`), SHOW_ALWAYS (`0x4_`), and TERNARY (`0x9_`) ARG values.

| ID | Name | Renders |
|----|------|---------|
| 0 | CARD | Full business card / record card view |
| 1 | LIST | Service list or compact line-item view |
| 2 | FORM | Interactive form (requires form schema block) |
| 3 | MINIMAL | Name + contact button only |
| 4 | TICKER | Single-line scrolling banner |
| 5 | BLANK | Empty page (record parsed, nothing shown) |
| 6 | NATIVE | Shell decides based on record type |
| 7 | RESERVED | — |

In TERNARY: `mode_false = 0xFF` means BLANK; `mode_false = 0xFE` means NATIVE.

---

## 23. TRIG CSS Codebook

Loaded by LOAD_CSS instruction (`0x1_` ARG). CSS bytes never travel in the URL.

| ID | Module | Description |
|----|--------|-------------|
| 0 | BASE | Reset, mobile-safe spacing, base font — loaded implicitly by shell |
| 1 | CARD_LIGHT | White card, shadow, clean typography |
| 2 | CARD_DARK | Dark card variant |
| 3 | FORM_STD | Input fields, labels, validation states, submit button |
| 4 | SERVICE_LIST | Compact service/price list layout (name + price rows) |
| 5 | BILLBOARD | Large-format with accent colour support, CTA button |
| 6 | MINIMAL | Absolute minimum — name + contact icon |
| 7–14 | RESERVED | Future CSS modules |

---

## 24. TRIG Theme Codebook

Applied by SET_THEME instruction (`0xB_` ARG) as a colour/font overlay on top of the loaded CSS module.

| ID | Theme | Palette |
|----|-------|---------|
| 0 | NEUTRAL | Grey / white (default) |
| 1 | WARM | Amber / cream |
| 2 | COOL | Blue / white |
| 3 | DARK | Dark background |
| 4–14 | RESERVED | Future themes |

---

## 25. TRIG JS Codebook

Loaded by LOAD_JS instruction (`0xA_` ARG). Pre-registered shell-bundled JS modules. Distinct from OQ-26 inline/fetch-target JS (which is sender-provided and restricted to `#1ps/`/`#1pt/`).

| ID | Module | Function |
|----|--------|----------|
| 0 | CONTACT_FORM | Standard contact request form logic; submit creates contact record on viewer's device |
| 1 | BOOKING_FORM | Date/service selection + booking submit; sends booking request record back to sender |
| 2 | REPLY_ROUTER | Routes form submission as a reply pads-v1 record via app share mechanism |
| 3–14 | RESERVED | Domain-specific JS modules |

---

## 26. TRIG Instruction Set

Each instruction byte: `[OP:4][ARG:4]`. ARG=15 = "read next byte for actual value."

| OP (hex) | Mnemonic | ARG meaning | Stack effect |
|----------|----------|-------------|-------------|
| `0x0_` | PATTERN | pattern_id (0–15) — splices in full equivalent of pattern token | — |
| `0x1_` | LOAD_CSS | codebook_id (0–14) | side effect only |
| `0x2_` | SET_LAYOUT | layout_id (0–14) | side effect only |
| `0x3_` | SHOW | display_mode (0–7) | bool → (render if true, BLANK if false) |
| `0x4_` | SHOW_ALWAYS | display_mode (0–7) | — (unconditional render) |
| `0x5_` | AND | count (2–14, pop N bools) | N bools → 1 bool |
| `0x6_` | OR | count (2–14, pop N bools) | N bools → 1 bool |
| `0x7_` | NOT | 0 | bool → bool |
| `0x8_` | JZ | skip_bytes (0–14) | bool → (skip N bytes if false) |
| `0x9_` | TERNARY | 0; next 3 bytes = cond_id, mode_true, mode_false | — (4-byte conditional render shortcut) |
| `0xA_` | LOAD_JS | codebook_id (0–14) | side effect only |
| `0xB_` | SET_THEME | theme_id (0–14) | side effect only |
| `0xC_` | BLOOM | 0; next 2 bytes = 16-bit capability filter operand | → bool |
| `0xD_` | PUSH_COND | condition_id (0–14) | → bool |
| `0xE_` | PUSH_LIT | ARG bit 0 (0=false, 1=true) | → bool |
| `0xF_` | EXTENDED | next byte = full 8-bit secondary opcode | varies |

### Bytecode header byte (byte 0 of programs with high nibble != 0x0)

| Bits | Field | Values |
|------|-------|--------|
| 7–6 | VER | `00`=TRIG v1; unknown VER → shell renders BLANK |
| 5 | HAS_CSS | 1=LOAD_CSS instruction present (optimiser hint; shell can pre-fetch CSS module) |
| 4 | HAS_TERNARY | 1=TERNARY instruction present (optimiser hint; evaluator fast-path) |
| 3–0 | PROG_LEN | Instruction bytes that follow: 1–14 = direct; 15 = extended (next byte carries length as 15+N, max 20) |

### BLOOM capability filter bits

16-bit operand selecting which capability checks to AND together.

| Bit | Test |
|-----|------|
| 15 | `requestAnimationFrame` timing consistency (>=60fps) |
| 14 | `PointerEvent` or `TouchEvent` support |
| 13 | Clipboard API accessible |
| 12 | `IntersectionObserver` present |
| 11 | `CSS.supports()` returns expected value for accent-color |
| 10 | Canvas fingerprint entropy passes threshold |
| 9–0 | RESERVED (future capability checks) |

---

## 27. Security Preamble Byte

First byte in `#1ps/` and `#1pt/` fragments. Prepended before base64url encoding.

| Bit | Field | Meaning |
|-----|-------|---------|
| 7 | SCRAMBLE | 1 = field scramble applied (flag byte order permuted using key-derived shuffle) |
| 6 | AES | 1 = AES-CTR encryption applied (128-bit key; IV = first 16 bytes of record UID hash) |
| 5 | HMAC | 1 = 8-byte HMAC-SHA256 truncated receiver commitment tag appended after cipher text |
| 4 | SEED_POISON | 1 = deflate seed poisoning applied (non-standard seed derived from shared key) |
| 3–0 | KEY_HINT | Lower 4 bits of key ID; helps receiver select the correct decryption key |

---

## 28. Tag Dispatch Summary

Abbreviated. Full detail in TAG-REFERENCE.md.

| Tag | Name | Security | Public? |
|-----|------|----------|---------|
| `#1pa/` | Plain record | None | Restricted — named recipients |
| `#1pb/` | Public billboard | None (TRIG gates rendering) | Yes |
| `#1pf/` | Financial presentation | None alone; combine with `#1ps/`/`#1pt/` | No |
| `#1ps/` | Full scramble | AES-CTR + field scramble + optional HMAC | No |
| `#1ph/` | Partial scramble | Header plain; field data + financial block encrypted | No |
| `#1pt/` | Template-keyed | AES-CTR; key = SHA-256 of template content | Conditional |
| `#l/` | List share | None | Yes |
| `#1eg/` | Legacy (decode only) | Legacy format; no new encoding | — |
