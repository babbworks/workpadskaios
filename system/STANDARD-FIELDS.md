# Canonical Field Registry — Standard Fields

**Version:** 1.0 — 2026-05-15  
**Decision source:** Standard fields planning session, D22  
**Companion docs:** CODEC-STATUS.md, ROLE-CODEBOOK.md  
**Status:** Complete for base registry and FLAGS3; FLAGS4+ domain-specific (by template)  

---

## 1. Design Principles

1. **Density by frequency (D19):** Bits 0-11 = fields present in >50% of all records. FLAGS3 bits 0-6 = fields present in 5-50%. FLAGS4+ = domain-specific or rare.
2. **Canonical names, template labels:** The canonical name is the wire-format identity. Templates apply a `label_map` at render time — synonyms never alter the bit position or data encoding.
3. **Flag-only booleans:** Fields that carry no data beyond presence/absence use the flag bit itself as the value. No data block follows.
4. **Compact text:** Short-by-design fields (`CONTEXT_LABEL`, `REF_NUMBER`, `TAG`) use 1-byte length prefix (`[u8 len][UTF-8]`, max 255 bytes) instead of the standard 2-byte prefix — saving 1 byte per occurrence.
5. **Backwards compatibility:** Bits 0-11 match the pads-v2-encoding-spec.md field assignments exactly. Existing encoders/decoders need no changes for the base field set.

---

## 2. Base Field Flags — bits 0-15

### 2.1 bits 0-11: High-frequency fields (>50% of records)

| Bit | Canonical name | Data block | Max UTF-8 | Compact time | Notes |
|-----|---------------|------------|-----------|--------------|-------|
| 0 | `job` | `[u16 len][UTF-8]` | 120 B | — | Job title / service subject line |
| 1 | `customer` | `[u16 len][UTF-8]` | 120 B | — | Customer / client name |
| 2 | `date` | `[u16 days]` (COMPACT) or `[u16 len][UTF-8]` | 10 B / 2 B | ✓ days since 2025-01-01 | Date of service or transaction |
| 3 | `location` | `[u16 len][UTF-8]` | 160 B | — | Service address / site |
| 4 | `meeting_time` | `[u16 min]` (COMPACT) or `[u16 len][UTF-8]` | 40 B / 2 B | ✓ minutes since midnight | Appointment / meeting time |
| 5 | `start_time` | `[u16 min]` (COMPACT) or `[u16 len][UTF-8]` | 40 B / 2 B | ✓ minutes since midnight | Job start time |
| 6 | `end_time` | `[u16 min]` (COMPACT) or `[u16 len][UTF-8]` | 40 B / 2 B | ✓ minutes since midnight | Job end time |
| 7 | `customer_phone` | `[u16 len][UTF-8]` | 40 B | — | Customer phone (compact alternative to participants) |
| 8 | `worker` | `[u16 len][UTF-8]` | 80 B | — | Worker name (legacy; prefer participants block for new records) |
| 9 | `actions` | array (see §2.3) | variable | — | Checklist / task list |
| 10 | `details` | `[u16 len][UTF-8]` | 500 B | — | Secondary description / scope detail |
| 11 | `story` | `[u16 len][UTF-8]` | 2000 B | — | Full job notes / long-form content |

### 2.2 bits 12-15: Gates and semi-frequent fields

| Bit | Canonical name | Type | Notes |
|-----|---------------|------|-------|
| 12 | `financial_block` | gate | Financial block present (fin_control byte follows — see CODEC-STATUS.md D14) |
| 13 | `ref_number` | `[u8 len][UTF-8]`, max 64 B | Invoice / quote / job reference number |
| 14 | `due_date` | `[u16 days]` (COMPACT) or `[u16 len][UTF-8]` | Payment due or action deadline |
| 15 | `FLAGS3_PRESENT` | gate | Third field flags byte follows |

**Frequency rationale for bits 13-14:**
- `ref_number`: ~60% — all invoices, quotes, job sheets carry a reference
- `due_date`: ~50% — invoices and outstanding bills always have due dates

---

### 2.3 actions array format (bit 9)

```
[1B]  count       — number of action items (0-255)
per item:
  [u16 len][UTF-8]  text
  [1B] status     — 0=open  1=done  2=blocked  3=deferred
```

---

## 3. FLAGS3 — bits 0-6 (5-50% frequency), bit 7 = FLAGS4_PRESENT

Present when field_flags bit 15 (FLAGS3_PRESENT) = 1.

| Bit | Canonical name | Data block | Notes |
|-----|---------------|------------|-------|
| 0 | `context_label` | `[u8 len][UTF-8]`, max 40 B | Child record job reference (D9). Short identifying text for standalone intelligibility ("Boiler repair, 42 High St"). |
| 1 | `tag` | `[u8 len][UTF-8]`, max 60 B | Category / user label for the record |
| 2 | `qty_unit` | `[u8 len][UTF-8]`, max 12 B | Custom unit label overriding decoder default — e.g. "hrs", "kg", "pcs", "days" |
| 3 | `expiry_date` | `[u16 days]` (COMPACT) or `[u16 len][UTF-8]` | Quote or offer expiry date |
| 4 | `attachment` | `[u16 len][UTF-8]`, max 500 B | URL or hash of attached document / photo |
| 5 | `uid` | `[u16 len][UTF-8]`, max 80 B | Record / contact unique identifier (maps to vCard UID; enables cross-record linking) |
| 6 | `url` | `[u16 len][UTF-8]`, max 500 B | Website, social profile, or reference URL for the participant or service |
| 7 | `FLAGS4_PRESENT` | gate | Fourth field flags byte follows (domain-specific fields) |

---

## 4. FLAGS4 — domain-specific (template-defined)

FLAGS4 is present when FLAGS3 bit 7 = 1. Bit layout within FLAGS4:

```
bit 7: FLAGS5_PRESENT   (chaining, same pattern)
bits 6-0: 7 domain-specific slots
```

Slot assignments are defined per template in the template's codebook definition. No universal assignments at this level — domain templates own their FLAGS4 slots.

**Reserved domain ranges (by BASE_TEMPLATE):**
- Template 011 (Contact/entity): FLAGS4 bits 0-4 = vCard extension fields (see §6)
- Template 101 (State Commit): FLAGS4 bits 0-2 = summary type fields
- All other templates: free to define their own FLAGS4 assignments

---

## 5. Synonym / Re-labelling System

Templates remap canonical field names to sector-appropriate labels via a `label_map` in the template definition. The wire format always uses canonical bit positions. Labels are applied at render time only.

### 5.1 label_map format (in template definition)

```json
{
  "label_map": {
    "job":      "Consultation",
    "customer": "Patient",
    "location": "Clinic / Practice",
    "details":  "Symptoms / Presenting issue",
    "story":    "Clinical notes"
  }
}
```

Any field not in `label_map` falls back to the canonical label. No wire-format change.

### 5.2 Standard label_maps by sector

**Healthcare:**
| Canonical | Healthcare label |
|-----------|-----------------|
| `job` | Consultation / Procedure |
| `customer` | Patient |
| `location` | Clinic / Ward |
| `worker` | Clinician |
| `details` | Presenting issue |
| `story` | Clinical notes |
| `ref_number` | Patient / File ref |
| `due_date` | Follow-up date |

**Legal:**
| Canonical | Legal label |
|-----------|------------|
| `job` | Matter / Case |
| `customer` | Client |
| `location` | Court / Office |
| `details` | Brief |
| `story` | Full submissions |
| `ref_number` | File / Matter number |
| `due_date` | Filing deadline |
| `context_label` | Matter ref |

**Construction / Field Service (default sector — canonical labels unchanged):**
Labels as defined. No remapping needed for construction, electrical, plumbing, HVAC.

**Agriculture:**
| Canonical | Agriculture label |
|-----------|-----------------|
| `job` | Crop / Activity |
| `customer` | Farmer / Cooperative |
| `location` | Farm / Plot |
| `details` | Agronomic notes |
| `story` | Field report |
| `ref_number` | Plot / Lot number |
| `due_date` | Harvest / treatment date |

**Retail / Commerce:**
| Canonical | Retail label |
|-----------|-------------|
| `job` | Order / Transaction |
| `customer` | Buyer |
| `location` | Delivery address |
| `ref_number` | Order number |
| `due_date` | Delivery date |

---

## 6. Contact / Entity Template Field Mapping (BASE_TEMPLATE = 011)

The Contact/entity template is the workpads vCard-equivalent record. Field mapping to vCard 4.0 (RFC 6350):

| Bit | Canonical | vCard field | Notes |
|-----|-----------|-------------|-------|
| 0 | `job` | `FN` | Formatted / full name of person or org |
| 1 | `customer` | `ORG` | Organisation name (when IS_ORG=0 but person has affiliation) |
| 3 | `location` | `ADR` | Street / postal address (full text, or structured text) |
| 7 | `customer_phone` | `TEL` | Phone number (primary) |
| 8 | `worker` | `TITLE` | Job title of the person (e.g. "Senior Electrician") |
| 10 | `details` | `NOTE` | Contact notes |
| 13 | `ref_number` | `ROLE` | Role within their organisation (distinct from TITLE) |
| (FLAGS3 bit 5) | `uid` | `UID` | Unique identifier for the contact — enables stable cross-record linking |
| (FLAGS3 bit 6) | `url` | `URL` | Website, LinkedIn, WhatsApp link |
| (FLAGS3 bit 0) | `context_label` | — | Short reference label for contact lists |
| (FLAGS3 bit 1) | `tag` | `CATEGORIES` | Contact category / group tag |

**Contact template label_map:**
```json
{
  "label_map": {
    "job":           "Full name",
    "customer":      "Organisation",
    "location":      "Address",
    "customer_phone":"Phone",
    "worker":        "Job title",
    "details":       "Notes",
    "ref_number":    "Role / position"
  }
}
```

**vCard fields NOT in wire format (app-only):**
- `PHOTO` — referenced via attachment URL (FLAGS3 bit 4), not stored in frame
- `BDAY` — out of scope for transaction records
- `GENDER` — out of scope
- `IMPP` — instant messaging address; represented as a `url` field with scheme (e.g. `whatsapp:+44...`)

---

## 7. Transaction Byte Subtypes — Completing the 4 Reserved States

The 4 previously reserved I>O states now have full subtype codebooks.

### 7.1 I<O — Income direction, Past time, Outgoing effect
**Worker label:** "Refund given" | **Customer label:** "Refunded"
Byte pattern: DIRECTION=0, TIME=0, EFFECT=1

| Subtype | Code | Meaning | Worker label |
|---------|------|---------|--------------|
| 0 | `00` | Full refund | Refund given |
| 1 | `01` | Partial refund | Part-refund |
| 2 | `10` | Warranty / goodwill return | Goodwill refund |
| 3 | `11` | Overpayment return | Overpayment back |

### 7.2 I>O — Income direction, Future time, Outgoing effect
**Worker label:** "Credit note" | **Customer label:** "Credit note"
Byte pattern: DIRECTION=0, TIME=1, EFFECT=1

| Subtype | Code | Meaning | Worker label |
|---------|------|---------|--------------|
| 0 | `00` | Credit note issued | Credit note |
| 1 | `01` | Return authorisation pending | Return pending |
| 2 | `10` | Discount / price reduction | Discount |
| 3 | `11` | Prepayment credit outstanding | Credit balance |

### 7.3 O<I — Outgoing direction, Past time, Income effect
**Worker label:** "Reimbursed" | **Customer label:** —
Byte pattern: DIRECTION=1, TIME=0, EFFECT=0

| Subtype | Code | Meaning | Worker label |
|---------|------|---------|--------------|
| 0 | `00` | General reimbursement received | Reimbursed |
| 1 | `01` | Travel / mileage reimbursed | Travel reimbursed |
| 2 | `10` | Materials cost recovered | Materials back |
| 3 | `11` | Advance / float returned | Advance returned |

### 7.4 O>I — Outgoing direction, Future time, Income effect
**Worker label:** "Reimbursement expected" | **Customer label:** —
Byte pattern: DIRECTION=1, TIME=1, EFFECT=0

| Subtype | Code | Meaning | Worker label |
|---------|------|---------|--------------|
| 0 | `00` | Reimbursement claim submitted | Claim sent |
| 1 | `01` | Travel claim pending approval | Travel claim |
| 2 | `10` | Materials claim pending | Materials claim |
| 3 | `11` | Advance / float requested | Advance req. |

---

## 8. SELF_DESCRIBING Field-Name Index

When meta2 SELF_DESCRIBING=1 (D11), each data block is prefixed with a 1-byte canonical field-name index. This allows any receiver to label fields without the template.

| Index | Canonical name | Field flags bit |
|-------|---------------|----------------|
| 0x00 | `job` | 0 |
| 0x01 | `customer` | 1 |
| 0x02 | `date` | 2 |
| 0x03 | `location` | 3 |
| 0x04 | `meeting_time` | 4 |
| 0x05 | `start_time` | 5 |
| 0x06 | `end_time` | 6 |
| 0x07 | `customer_phone` | 7 |
| 0x08 | `worker` | 8 |
| 0x09 | `actions` | 9 |
| 0x0A | `details` | 10 |
| 0x0B | `story` | 11 |
| 0x0C | *(financial_block gate — no index, never in data block)* | 12 |
| 0x0D | `ref_number` | 13 |
| 0x0E | `due_date` | 14 |
| 0x10 | `context_label` | FLAGS3 bit 0 |
| 0x11 | `tag` | FLAGS3 bit 1 |
| 0x12 | `qty_unit` | FLAGS3 bit 2 |
| 0x13 | `expiry_date` | FLAGS3 bit 3 |
| 0x14 | `attachment` | FLAGS3 bit 4 |
| 0x15 | `uid` | FLAGS3 bit 5 |
| 0x16 | `url` | FLAGS3 bit 6 |
| 0x80–0xFE | Custom field (index from template definition) | domain-specific |
| 0xFF | Unknown / reserved | — |

Index `0x0F` is intentionally skipped (financial block gate alignment). Indices `0x17`–`0x7F` reserved for future standard fields. Indices `0x80`–`0xFE` are the custom-label range: the template definition maps these to domain-specific field names not in the canonical registry.

---

## 9. Data Block Encoding Summary

| Field type | Encoding | Bytes |
|------------|----------|-------|
| Standard text (long) | `[u16 len][UTF-8]` | 2 + N |
| Compact text (short fields) | `[u8 len][UTF-8]` | 1 + N |
| Date (COMPACT_TIME=1) | `u16` days since 2025-01-01 | 2 |
| Time (COMPACT_TIME=1) | `u16` minutes since midnight | 2 |
| Amount | `u24` (uint24, big-endian) | 3 |
| Boolean flag-only | *(no data block — flag IS the value)* | 0 |
| Actions array | `[u8 count]` + per-item `[u16 len][UTF-8][u8 status]` | variable |

**Short (compact text) fields using `[u8 len]`:** `context_label`, `tag`, `qty_unit`, `ref_number`  
All others use `[u16 len]` for the length prefix.

**SELF_DESCRIBING surcharge:** +1 byte per data block (field-name index byte prepended). Zero overhead when SELF_DESCRIBING=0.

---

## 10. Minimal Record Examples

### Invoice (common case)
Fields: `job`(0), `date`(2), `customer`(1), `location`(3), `ref_number`(13), `due_date`(14), `financial_block`(12)

```
field_flags: bit0=1 bit1=1 bit2=1 bit3=1 bit12=1 bit13=1 bit14=1
           = 0b0110_0000_0000_1111 = 0x600F
           (bit15=0, FLAGS3 not needed)
```
Frame overhead: meta1(1) + meta2(1) + setup(1) + sf_byte(0) + transaction(1) + field_flags(2) = 6 bytes before data.

### Child expense record (O<O with context)
Fields: `context_label`(FLAGS3/0), `financial_block`(12)

```
field_flags: bit12=1, bit15=1 (FLAGS3_PRESENT)
           = 0b1001_0000_0000_0000 = 0x9000
FLAGS3: bit0=1 (context_label)
           = 0x01
```
Frame overhead: 6 bytes + 1 FLAGS3 byte = 7 bytes before data.

### Contact card
Fields: `job`(0=FN), `customer`(1=ORG), `location`(3=ADR), `customer_phone`(7=TEL), FLAGS3 uid(5), url(6)

```
field_flags: bit0=1 bit1=1 bit3=1 bit7=1 bit15=1
           = 0b1000_0000_1000_1011 = 0x808B
FLAGS3: bit5=1 bit6=1
           = 0b0110_0000 = 0x60
```
No financial block, no setup/transaction bytes (DOMAIN=00).
Frame overhead: meta1(1) + meta2(1) + field_flags(2) + FLAGS3(1) = 5 bytes before data.
