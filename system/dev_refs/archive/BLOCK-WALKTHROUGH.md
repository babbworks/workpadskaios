# pads-v1 Frame Block Walkthrough

**Purpose:** Narrative guide through every block in a pads-v1 frame, in wire order.  
**Audience:** Implementers building the codec; designers extending the format.  
**Companion docs:** FRAME-SPEC.md (precise wire layout), BLOCK-DECISIONS.md (design rationale)  
**Status:** Current as of design Rounds 1–27 (D1–D37 settled)

---

## How to Read This

A pads-v1 frame is a binary byte sequence. Every block is either:
- **Always present** — every frame has it
- **Conditionally present** — present when a flag in an earlier block says so
- **Never present** — certain block types never carry it (e.g. State Commit never has a transaction byte)

Read the frame left to right. Each block you encounter tells you whether the next one is coming.

---

## 1. meta1 — The Entry Point

**Always present. Always the first byte.**

meta1 is the frame's front door. The receiver reads this single byte first to learn: what kind of record is this, and what's coming next?

**What it tells you:**
- `META2_PRESENT` (bit 7) — is there a second metadata byte?
- `EXT_TEMPLATE` (bit 6) — is the template type a standard one (fits in 3 bits) or an extended domain type?
- `BASE_TEMPLATE` (bits 5–3) — the structural type of the record (financial, contact, amendment, etc.)
- `ACK_REQUEST` (bit 2) — does the sender want a delivery acknowledgement?
- `CHAIN` (bit 1) — is this record linked to a parent (job chain, amendment chain)?
- `RECIPIENT_TYPE` (bit 0) — is this for a specific named recipient (1) or any receiver (0)?

**BASE_TEMPLATE tells you the fundamental shape of the record:**
- `000` Service — work description, no money
- `001` Financial — a single I>O transaction
- `011` Contact — a person or organisation record
- `101` State Commit — a snapshot (period summary, pay close)
- `110` Amendment — a correction to a prior record

If `EXT_TEMPLATE=1`, the base template bits hold a signal for how many extension bytes follow — this is how domain-specific templates (electrician, medical, agricultural) are encoded without reserving slots in the base codebook.

---

## 2. ext_template — Domain Type Extension

**Present only when EXT_TEMPLATE=1 in meta1.**

When a record belongs to a domain-specific schema (e.g. an electrician job record with certification fields), the base 3-bit template space is too small. `ext_template` adds 1–3 bytes giving up to 16 million domain types per codebook package.

A special case: `EXT_SIGNAL=100` (Variant type) uses a CRC-8 namespace byte + CRC-16 local ID — allowing decentralised template creation without a central registry, at the cost of a small collision probability.

For most records you'll see in the wild, `EXT_TEMPLATE=0` and this block is absent.

---

## 3. meta2 — Secondary Metadata

**Present when META2_PRESENT=1 in meta1.**

meta2 carries flags that affect how the rest of the frame is decoded. It exists as a second byte (rather than being packed into meta1) to keep the common case — a plain record with no special flags — at just 1 header byte.

**What it controls:**
- `SELF_DESCRIBING` (bit 7) — when set, every data block carries a 1-byte field-name index. This makes the record self-labelling (useful for debugging, interoperability) at the cost of 1 byte per field.
- `COMPACT_TIME` (bit 6) — when set, dates are stored as `uint16` days since the epoch, and times as `uint16` minutes since midnight. Without this flag, dates are UTF-8 ISO strings. This single flag saves ~10 bytes on any record with a date.
- `PARTICIPANTS` (bit 4) — a participants block follows the data blocks.
- `DOMAIN` (bits 3–2) — signals the financial context:
  - `00` = no financial data (service records, contacts)
  - `01` = simple mode (I>O 8-state transaction classification, for field workers)
  - `10` = standard mode (BitLedger Account Pair double-entry, for accountants)
- `DRAFT` (bit 1) — working draft, not final.
- `RESTRICT_FORWARD` (bit 0) — receiver must not forward this record.

The `DOMAIN` bits are particularly important: they determine whether `setup_byte` and `transaction_byte` follow, and which interpretation applies to the financial block.

---

## 4. setup_byte — Financial Context

**Present when DOMAIN ≥ 01.**

Before any amounts can be decoded, the receiver needs to know: what currency, how many decimal places, and is there a tax component? That's what `setup_byte` answers.

**Fields:**
- `DECIMAL_POS` (bits 7–5) — how many decimal places all amounts use. `010` = 2 decimal places (pence/cents). This applies to every `uint24` amount in the record.
- `CURRENCY` (bits 4–3) — `00` = sender's home currency (zero overhead for local transactions); `11` = extended (a `currency_ext` byte follows with a full 256-slot currency code).
- `TAX_CODE` (bits 2–1) — the tax rate definition: `00` = no tax, `01` = standard rate, `10` = reduced rate, `11` = explicit (a `tax_block` follows with the exact rate and amount).
- `SF_PRESENT` (bit 0) — if set, an `sf_byte` follows with a scaling factor and compound-value flags.

**Why uint24 amounts?** Every amount in pads-v1 is a `uint24` (3-byte integer). Combined with `DECIMAL_POS=2`, this stores any value up to £167,772.15 in exactly 3 bytes. Compare this to the old format which stored amounts as UTF-8 strings ("125.50" = 6–8 bytes). The saving is ~5 bytes per amount field.

---

## 5. currency_ext — Extended Currency Code

**Present when CURRENCY=11 in setup_byte.**

A single byte giving one of 256 currency codes. `0x00–0x7F` are ISO 4217 aligned (GBP=0x01, USD=0x02, EUR=0x03, NGN=0x20, KES=0x21). `0x80–0xEF` are regional and digital currencies. `0xFF` is reserved.

Most records in the wild use `CURRENCY=00` (home currency) and this block never appears.

---

## 6. sf_byte — Scaling Factor and Compound Flags

**Present when SF_PRESENT=1 in setup_byte.**

This byte does two distinct jobs:

**Scaling factor** (bits 7–5): Multiplies all amounts before the decimal is applied. `SF=001` means ×10, so a stored value of 5000 with `DECIMAL_POS=2` and `SF=001` represents £500.00 (5000 × 10 / 100). This allows large amounts (materials, vehicles, property) to fit in `uint24` without overflow.

**Compound value flags** (bits 4–0):
- `COMPOUND_VALUE` (bit 4) — this financial block contains multiple line items (a compound record).
- `QTY_COMPACT` (bit 3) — pack quantity and rate together into the 3-byte `customer_amount` field rather than carrying them as separate `uint24` fields. Saves 6 bytes for integer-quantity records (parts, visits, whole km).
- `SPLIT_POINT` (bits 2–0) — when `QTY_COMPACT=1`, how many of the 24 bits are qty vs rate.

`QTY_COMPACT` is best suited to records where quantity is a small integer (e.g. "3 visits", "12 parts", "400 km"). For fractional hours (3.5 hours), use `QTY_COMPACT=0` with separate `qty_rate_block` fields.

---

## 7. transaction_byte — The Financial Event

**Present when setup_byte is present (i.e. DOMAIN ≥ 01). Absent in State Commit records.**

This byte classifies the financial event. In simple mode (`DOMAIN=01`) it uses I>O notation:

**Three bits define the state:**
- `DIRECTION` — I (money comes toward you) or O (money goes away from you)
- `TIME` — Past/settled (`<`) or Future/pending (`>`)
- `EFFECT` — I (your asset position improves) or O (your liability increases)

These three bits give 8 states covering everything a field worker encounters: invoices, payments, expenses, bills, reimbursements, refunds, credit notes.

**Two subtype bits** refine each state (4 subtypes per state = 32 combinations): payment received vs deposit vs final payment vs gratuity; invoice vs quote vs retainer vs recurring; etc.

**QTY_SPLIT** signals that the financial block contains a quantity and rate (T&M billing).

**ROUNDING** (2 bits) encodes the rounding direction: income rounds down (conservative), expenses and tax round up (conservative). Exact amounts use `00`.

In standard mode (`DOMAIN=10`), this byte encodes the BitLedger Account Pair (14 active double-entry pairs) plus direction, status, and quantity flags — for accountants who need full double-entry classification.

---

## 8. field_flags — What Data Is Present

**Always present. 2 bytes.**

This 16-bit bitmap tells the receiver which of the 16 standard data fields follow. If a bit is 0, that field is absent and takes zero bytes. If a bit is 1, the corresponding data block is present.

**Bits 0–11:** The everyday fields — job title, customer name, date, location, meeting time, start time, end time, customer phone, worker name, actions/work-done, details, narrative.

**Bit 12:** `financial_block` — the financial block follows (fin_control byte and amounts).

**Bit 13:** `ref_number` — an invoice/job/quote reference string.

**Bit 14:** `due_date` — a payment or action due date.

**Bit 15:** `FLAGS3_PRESENT` — a third flags byte follows.

Data blocks follow field_flags (and field_flags3 if present) in ascending bit-order. The receiver reads the flags, then reads blocks in order — no field labels or delimiters needed.

---

## 9. field_flags3 — Extended Fields

**Present when FLAGS3_PRESENT=1 in field_flags.**

Seven additional field slots, plus a chain bit:

- `context_label` — a standalone job context summary (for records shared without full history)
- `tag` — category or classification tag
- `qty_unit` — unit label for quantity display ("hrs", "km", "kg", "units")
- `expiry_date` — record or offer expiry (currently bit 3; pending reassignment to date_end — see D34)
- `attachment` — an attachment reference (URL or content hash)
- `uid` — a record or contact UID
- `url` — an associated URL
- `FLAGS4_PRESENT` (bit 7) — a template-defined flags byte follows

These fields are encoded as compact text (`uint8` length prefix, max 255 bytes) to save space.

---

## 10. field_flags4 — Template Extension

**Present when FLAGS4_PRESENT=1 in field_flags3.**

A single byte whose bits are defined by the active template. The decoder must know the template to interpret them. For the Contact/entity template (BASE_TEMPLATE=011), bits 0–4 are vCard extended fields: org name, job title, postal address, website, note.

For Financial records at MVP, this byte is unused. For EXT_TEMPLATE domain records (electrician, medical), bits 0–7 are defined by the domain schema.

Fields gated by field_flags4 follow in ascending bit order, same encoding rules as field_flags3 blocks.

---

## 11. Data Blocks — The Payload

**Follow field_flags (and flags3/flags4 if present), in ascending bit order.**

Each bit set in the flags bytes corresponds to one data block. Blocks arrive in the same order as their flag bit positions — no field identifiers, no separators. The receiver reads the flags, then reads blocks one by one.

**Encoding by type:**

| Type | Encoding |
|------|----------|
| Standard text (fields 0–3, 7–11, FLAGS3 bits 4–6) | `uint16` length + UTF-8 bytes |
| Compact text (fields 13, FLAGS3 bits 0–2) | `uint8` length + UTF-8 bytes (max 255 B) |
| Date (COMPACT_TIME=1) | `uint16` days since epoch |
| Date (COMPACT_TIME=0) | `uint16` length + UTF-8 ISO date string |
| Time (COMPACT_TIME=1) | `uint16` minutes since midnight |
| Amount | `uint24` big-endian (in financial block) |

**SELF_DESCRIBING mode:** When `meta2` bit 7 is set, each data block is prefixed with a 1-byte canonical field-name index (`0x00–0x0E` = field_flags bits 0–14; `0x10–0x16` = field_flags3 bits 0–6). This makes the record self-labelling but costs 1 byte per field.

---

## 12. Financial Block — The Money

**Present when field_flags bit 12 is set.**

The financial block has a fixed entry point (`fin_control`) and a variable tail depending on what kind of financial record this is.

### 12a. fin_control — Financial Control Byte

The first byte of the financial block. In simple mode (`DOMAIN=01`):

- `BILLED` (bit 7) — this charge is passed to the customer (appears as an invoice line). A COGS or running cost record has `BILLED=0`.
- `QTY_TYPE` (bit 5) — units (items, km, visits) or time (hours). Display context only.
- `PARITY` (bit 4) — even parity across the 6 content bits. Single-bit error detection.
- `EXPENSE_CATEGORY` (bits 3–2) — `00`=job charge, `01`=job cost/COGS, `10`=running cost.
- `CUSTOMER_AMT` (bit 1) — `customer_amount` uint24 follows.
- `WORKER_AMT` (bit 0) — `worker_amount` uint24 follows.

The parity bit and the fixed mode indicator (bit 6 = 0 in simple mode, 1 in standard mode) give four integrity checks without adding overhead.

### 12b. customer_amount — What the Customer Pays

3-byte `uint24`. Real value = `(stored × SF) / 10^DECIMAL_POS`.

When `QTY_COMPACT=1` and `QTY_SPLIT=1`: the 24 bits are split into rate (upper bits) and qty (lower bits) according to `SPLIT_POINT`. The total is `rate × qty × SF / 10^DECIMAL_POS`. Display: "qty [unit] @ [rate] = [total]".

### 12c. worker_amount — Internal Cost

3-byte `uint24`. The worker's cost, pay rate, or internal value — never included in customer-facing URL rendering. The decoder applies progressive disclosure: customer views receive a URL generated without this field.

### 12d. tax_block — Explicit Tax

3 bytes, present when `TAX_CODE=11` in setup_byte. Byte 1: tax rate in permille (200 = 20.0%). Bytes 2–3: uint16 tax amount (SF and DECIMAL_POS apply).

### 12e. qty_rate_block — Separate Quantity and Rate

6 bytes, present when `QTY_SPLIT=1` AND `QTY_COMPACT=0`. Two `uint24` fields: quantity, then rate per unit. Use this when quantity is fractional (e.g. 3.5 hours) and can't fit in the packed compact format. `customer_amount` is the authoritative total; `qty × rate` is informational.

### 12f. Compound Block — Multi-Line Records

Present when `COMPOUND_VALUE=1` in sf_byte. A compound header (2 bytes: LINE_COUNT + flags) followed by LINE_COUNT line entries.

Each line entry:
1. **compound_line_flags** (1 byte, if `LINE_FLAGS_PRESENT=1`) — LINE_TYPE (standard/deduction/employer-add/summary), TAX_MODE (--/standard/reduced/zero), QTY_LINE
2. **line_name** — compact text (`uint8` length + UTF-8)
3. **line_amount** — `uint24`
4. **line_qty + line_rate** — two `uint24` fields, only if `QTY_LINE=1` for this line

`LINE_FLAGS_PRESENT=0` means every line is a standard, no-tax, lump-sum line — no per-line flags byte, saves 1 byte per line for simple invoices.

`TAX_MODE=00` on a line means "--" (not applicable). It does NOT inherit the record's `TAX_CODE`. The UI hides the tax column when all lines are `00`.

---

## 13. Participants Block — Who's Involved

**Present when PARTICIPANTS=1 in meta2.**

A 1-byte header gives the count (1–7 participants). Then each participant is encoded in turn:

1. **part_flags** (1 byte) — IS_SENDER, ROLE_TYPE, HAS_PHONE, HAS_EMAIL, HAS_ROLE_TEXT, IS_ORG
2. **name** — standard text (`uint16` length + UTF-8)
3. **phone** — standard text, if HAS_PHONE=1
4. **email** — standard text, if HAS_EMAIL=1
5. **role_code** (1–2 bytes) — if ROLE_TYPE=111 and HAS_ROLE_TEXT=0. Selects a named role from the role codebook (240 quick-select + 224 specialist).
6. **role_text** — standard text, if ROLE_TYPE=111 and HAS_ROLE_TEXT=1. Free-text role label.
7. **alt_id block** (post-MVP) — if HAS_ALT_ID=1 (see §alt_id below). An alternative identifier for participants without a phone number.

Role is a per-record attribute, not a property of the contact. The same person can be Customer on one record and Worker on another.

### alt_id — Alternative Identifier

For users without a stable phone number (common in African and South/Southeast Asian markets). A type byte (`app_uid` / `trade_name` / `national_id` / `location_label`) followed by compact text.

Match order when resolving to a contact: phone → email → app_uid → trade_name + location_label.

---

## 14. State Commit Block — Snapshots

**Present in BASE_TEMPLATE=101 records. No transaction_byte in these records.**

State Commit records are point-in-time snapshots — they summarise, they don't transact. A pay period close, a job completion, a year-end aggregate. Because there is no directional financial flow, the `transaction_byte` is absent.

**1-byte state_commit header:**
- `COMMIT_TYPE` (bits 7–6): job close, pay period close, period summary, annual aggregate
- `PERIOD_TYPE` (bits 5–4): calendar month, tax week, tax month, custom (needs `date_end` field)
- `CHAIN_COMPLETE` (bit 3): all chained records are settled
- `DISPUTE_FLAG` (bit 2): at least one chained record is disputed

The financial block can still follow (for cumulative totals): `setup_byte` for context, no `transaction_byte`, amounts as usual. A pay period close carries gross as `customer_amount` and net as `worker_amount`. A period summary uses `COMPOUND_VALUE=1` with compound lines by category.

---

## 15. Amendment Block — Corrections

**Present in BASE_TEMPLATE=110 records. No field_flags in these records.**

Amendment records carry only the changed fields of a prior record. The receiver overlays the changes onto the original.

**changed_mask (2 bytes):** Mirrors the field_flags layout. Each bit set means that field was changed and its new value follows. Bit 15 of byte 2 signals a third mask byte for FLAGS3 fields.

**line_index (1 byte, if parent is compound):** Which compound line was amended (0-based). `0xFF` = the amendment applies to the record header, not a specific line.

**Changed field values** follow in ascending bit order, same encoding as the original record. The receiver reads the mask, reads the changed values, and reconstructs the amended record.

**Totals:** After applying changed amounts, the receiver recalculates compound totals. The amendment carries only the changed line amount; it does not re-transmit the full compound block.

**Chain:** Amendment carries CHAIN=1. The `&c=` URL suffix points to the original record UID. Multiple amendments on the same parent are ordered by chain depth.

---

## 16. Display Schema Block — Presentation Records

**Present in #1pb/ presentation records (display intent declared by URL tag).**

Controls how the receptive shell renders the record. A single `DISPLAY_CONTROL` byte:

- `DISPLAY_TYPE` — card (single block), list (stacked lines), menu (service catalog with prices), form-only
- `DATA_SOURCE` — inline, contact-resident, activity profile, hybrid
- `SHOW_PRICE`, `SHOW_CONTACT` — display toggles
- `ACCENT_COLOR` — if set, an accent colour byte follows (256-slot palette, 3+3+2 bits RGB)

**Contact-resident mode** (`DATA_SOURCE=01`): the payload contains only a contact ID. The receiver's device fills the display from its own contact store. This is the ultra-minimal card (~15–20 bytes total) that works like a smart business card: scan the QR, your phone finds the person in your contacts and shows their profile.

---

## 17. Form Schema Block — Collect and Reply

**Present when DISPLAY_TYPE=02 (form) or DISPLAY_TYPE=03 (form-only).**

Adds collect-and-reply capability to a presentation record. The `FORM_CONTROL` byte declares:

- `SUBMIT_ACTION` — how the reply is handled: reply record (the receiver submits a new pads-v1 record), web endpoint, or email
- `REPLY_TEMPLATE` — what BASE_TEMPLATE the reply record should be (contact card, financial, service note)
- `REQUIRE_NAME`, `REQUIRE_PHONE` — mandatory fields

If `FORM_FIELDS_FOLLOW=1`, per-field definitions follow: a field count byte, then for each field a 2-byte definition (field type + label index) and an optional custom label string.

**Use cases:** Contact request form (customer fills their details and submits back as a contact card), job enquiry form, booking request.

---

## 18. Security Wrapper — Outside the Frame

**Applied post-frame, before base64url encoding. Signalled by URL tag, not a frame byte.**

The security wrapper is not part of the pads-v1 frame — it wraps the assembled, deflated frame from the outside. URL tags signal the security level:

- `#1pv/` — plaintext (no wrapper; default for customer-facing records)
- `#1ps/` — full security (private/cost records, internal pay data)
- `#1ph/` — partial (field scramble only)
- `#1pt/` — template-keyed (display schema locked to a known template)

**Five layers, outermost first:**

| Layer | What it does |
|-------|-------------|
| Deflate seed poisoning | Non-standard deflate seed; wrong seed = garbage |
| Field scramble | field_flags order permuted by key-derived shuffle |
| AES-CTR encryption | Full frame encrypted; IV = record UID hash |
| Receiver HMAC | 8-byte truncated HMAC; verifiable only by named receiver |
| Preamble byte | 1 byte prepended; flags which layers are active + 4-bit key hint |

**Wire format:** `[preamble][AES-CTR([scrambled+seed-poisoned+deflated([frame])])][HMAC?]` — then base64url-encoded.

The app share sheet decides which wrapper to apply. Records with `worker_amount` or `EXPENSE_CATEGORY=01/10` (internal cost data) always get `#1ps/`. The codec itself does not refuse to encode without a wrapper.

---

## Block Presence at a Glance

Reading the frame top to bottom, which blocks can appear for each record type:

```
                        Service  Financial  Contact  StateCommit  Amendment
meta1                     ✓        ✓          ✓         ✓           ✓
ext_template             cond     cond       cond      cond        cond
meta2                    cond     cond       cond      cond        cond
setup_byte                —        ✓          —         ✓           —
currency_ext             cond     cond        —        cond         —
sf_byte                  cond     cond        —        cond         —
transaction_byte          —        ✓          —         —           —
field_flags               ✓        ✓          ✓         ✓           —
field_flags3             cond     cond       cond      cond         —
field_flags4             cond     cond       cond      cond         —
data blocks               ✓        ✓          ✓         ✓           —
  fin_control             —        ✓          —        cond         —
  customer_amount        cond     cond        —        cond         —
  worker_amount          cond     cond        —        cond         —
  tax_block              cond     cond        —        cond         —
  qty_rate_block         cond     cond        —         —           —
  compound block          —       cond        —        cond         —
participants block        cond     cond        ✓        cond        cond
  alt_id (per part.)     cond     cond       cond      cond        cond
state_commit byte         —        —          —         ✓           —
amendment_header          —        —          —         —           ✓
line_index                —        —          —         —          cond
changed field values      —        —          —         —           ✓
display_schema           cond     cond       cond       —           —
form_schema              cond      —          —         —           —
security wrapper        optional optional  optional  optional    optional

✓ always   cond when condition met   — never   optional app-layer decision
```

---

## Minimal Viable Frame

The smallest possible pads-v1 record:

```
meta1 (0x00):   1 byte   BASE_TEMPLATE=000 (Service), no META2, no ACK, no CHAIN
field_flags:    2 bytes  bit 0 only (job title)
job block:      7 bytes  [uint16 = 5]["Visit"]

Total: 10 bytes raw
After deflate + base64url: ~16–18 characters
```

## Largest Expected Frame (non-security-wrapped)

A full payroll compound record with 8 deduction lines, 2 participants, compact time, explicit tax:

```
meta1 + meta2 + setup + sf + transaction:     5 bytes
field_flags + field_flags3:                   3 bytes
data blocks (job + customer + date + ref):   ~30 bytes
fin_control + customer_amount + worker_amount: 7 bytes
tax_block:                                    3 bytes
compound header:                              2 bytes
8 compound lines (flags + name + amount):    ~8 × 14 = 112 bytes
participants (2):                            ~45 bytes

Total raw: ~207 bytes
After deflate + base64url: ~180–220 characters
```

Deflate gains are lower on already-compact binary data; the savings come mainly from repeated patterns in compound line names and amounts.
