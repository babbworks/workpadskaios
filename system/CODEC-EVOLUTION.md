# Codec Evolution Subproject

**Status:** Active — Round 1 in progress  
**Created:** 2026-05-15  
**Purpose:** Persistent session-to-session record of all codec design work. Each session logs its questions, answers, and settled decisions here. New sessions load this doc to resume without re-research.

---

## 1. Subproject Purpose

The workpads codec is currently implemented as `1eg/` (codebook-c-kaios, live in the KaiOS app). It was built incrementally and diverges from the more complete `pads-v2-encoding-spec.md` architecture. This subproject designs the evolved codec — working title `pads-v1` per the spec — and records every decision made along the way.

**What this produces:**
- A settled bit-level frame specification for the evolved workpads codec
- Updated `workpads-standard/codec.md` once design is stable
- Implementation tasks for `workpadskaios/js/codec.js`

**How sessions use this doc:**
1. Read this file at the start of any codec-related session
2. Check the Decision Log and Round Log for what has been settled
3. Continue from the Open Questions list
4. Append new rounds to the Round Log before ending the session

---

## 2. Reference Documents

### Ref A — `workpadskaios` `1eg/` (current live codec)

The codec running in the KaiOS app today. Source: `js/codec.js`.

- Template byte `0x02` (1 byte, raw — no meta byte architecture)
- 3-byte (24-bit) flat presence flags
- UTF-8 strings for amounts via `[uint16 length][UTF-8 bytes]`
- `record_type` as enum byte (quote=0, invoice=1, expense=2, payment=3)
- `vat` and `currency` as enum bytes
- Financial block gated by bit 12 with a `fin_flags` sub-byte
- Extended fields at bits 16–23 (subtype, locale, chainRef, participants, geo, serviceRef, expiry, verification)
- Chain reference encoded inline in frame (3 raw bytes at bit 18)
- URL scheme: `workpads.me/p#1eg/<base64url-deflated-frame>`

**Problems:** No meta byte architecture. No setup byte. No transaction byte. No uint24 amounts. No compact time. No proper DOMAIN signalling. Built without following the pads-v1 spec.

---

### Ref B — `workpads-standard/codec.md` + `bitpad-record-encoding.md` (1bg/)

The older standard codec, predating `1eg/`. Documents `codebook-b`.

- Template byte `0x01`
- 2-byte (16-bit) flags
- Same scalar field layout as `1eg/` bits 0–11
- Bit 12 = FIN block with `fin_flags` sub-byte
- UTF-8 string amounts (fin_flags bit 3 = amount as `[uint16 len][UTF-8]`)
- No 24-bit extended fields

**Status:** Superseded by `1eg/` in production. Standard doc is stale.

---

### Ref C — `workpads-standard/pads-v2-encoding-spec.md` (THE YARDSTICK)

**The most complete design document in the ecosystem.** Status: v0.1 draft 2026-04-27. Describes the target `pads-v1` architecture. Treated as equal in authority to the upstream protocol specs.

Key advances over `1eg/` and `1bg/`:

- **Meta Byte 1** (always present): 4-bit template ID, ACK_REQUEST, CHAIN, RECIPIENT_TYPE
- **Meta Byte 2** (optional, when meta1 bit 7 set): COMPACT_TIME, EXTENDED_FIELDS, PARTICIPANTS, DOMAIN bits (2), DRAFT, RESTRICT_FORWARD
- **Setup Byte** (when DOMAIN≥01): DECIMAL_POS (3 bits), CURRENCY (2 bits), TAX_CODE (2 bits), COMPOUND_VALUE (1 bit)
- **Transaction Byte** (when setup byte present): DIRECTION+TIME+EFFECT (I>O 8-state, 3 bits), SUBTYPE (2 bits), QTY_SPLIT (1 bit), ROUNDING (2 bits)
- **Field flags**: 2 bytes standard (bits 0–15); optional byte 3 via FLAGS3_PRESENT (bit 15)
- **uint24 amounts** — 3 bytes each, not UTF-8 strings
- **COMPACT_TIME**: binary time fields (uint16 days from epoch + uint16 minutes) instead of ISO strings
- **Participants block**: structured identity with role types, phone/email fields
- **State Commit** (template 0xD) and **Amendment** (template 0xE) record types

Cross-references: `workpads-standard/transaction-classification.md`, `financial-block.md`, `template-system.md`

---

### Ref D — BitPads Protocol v2 + BitLedger Protocol v3

Upstream protocols. Located in `bitpads-standard/protocol docs/markdown/`.

**BitPads v2:**
- Meta byte 1: Mode, ACK, Continuation, Treatment bits + Role A/B/C content flags
- Codebook packages (scheme tag char 1) version all codebooks simultaneously

**BitLedger v3:**
- Layer 1 (64-bit): Session init, sender identity, CRC-15
- Layer 2 (48-bit): Batch header — 6-bit currency (64 codes), 3-bit decimal position, 7-bit scaling factor, rounding balance, compound prefix
- Layer 3 (40-bit): Value block (bits 1–32, 25-bit value via N=A×2^S+r) + Accounting block (bits 33–40)
- Accounting block = 8 bits total: **Account Pair** (bits 33–36, 4-bit field, 16 codes, 14 active pairs), Direction (bit 37), Status (bit 38), Completeness (bit 39), Extension flag (bit 40)
- 1110=correction/netting, 1111=compound continuation

**Value encoding:** N = A × 2^S + r where S = Optimal Split from Layer 2 (default 8). Max single-record value at D=2, SF=x1: £335,544.31. Compound continuation records recover sub-step precision at any scale.

---

## 3. Design Tensions

### T1 — Frame Architecture: pads-v2 meta bytes vs evolve 1eg/ flat header

**Current `1eg/`:** raw template byte + flat 24-bit flags. No meta byte. No DOMAIN signalling. Simple to implement.

**pads-v2 target:** meta1 always present (template ID 4-bit, ACK, CHAIN, RECIPIENT_TYPE), optional meta2 (DOMAIN bits, COMPACT_TIME, PARTICIPANTS flags). More expressive per byte. Enables proper domain signalling and structured extensibility.

**Why it matters:** COMPACT_TIME alone saves 10–14 bytes per record (replaces ISO date strings). DOMAIN bits enable simple vs standard financial mode switching. Without meta bytes, none of this is cleanly encodable.

**Status:** OPEN — Q1 in Round 1.

---

### T2 — Transaction Classification: I>O 8-state vs BitLedger Account Pair

**Correction (2026-05-15):** BitLedger uses a **4-bit Account Pair** field (bits 33–36), not 16 bits. 16 possible codes, 14 active pairs.

**Workpads I>O system** — 3-bit DIRECTION+TIME+EFFECT, 8 primary states:

| Notation | Worker label | Current `1eg/` |
|----------|-------------|----------------|
| `I < I` | Payment received | payment (type=3) |
| `I > I` | Invoice sent | invoice (type=1) |
| `I < O` | Refund given | — not in `1eg/` |
| `I > O` | Credit note | quote (type=0) approx |
| `O < O` | Expense paid | expense (type=2) |
| `O > O` | Bill received | — not in `1eg/` |
| `O < I` | Reimbursed | — not in `1eg/` |
| `O > I` | Reimbursement pending | — not in `1eg/` |

Each state × 4 subtypes = 32 combinations in the pads-v2 transaction byte (8 bits total).

**BitLedger Account Pair** — 4 bits, encodes both accounts (double-entry):

| Code | Account Pair | I>O equivalent |
|------|-------------|---------------|
| 0000 | Op Expense / Asset | `O<O` (cash expense) |
| 0001 | Op Expense / Liability | `O>O` (bill received) |
| 0010 | Non-Op Expense / Asset | no direct I>O |
| 0011 | Non-Op Expense / Liability | no direct I>O |
| 0100 | Op Income / Asset | `I<I` / `I<O` |
| 0101 | Op Income / Liability | `I>I` / `I>O` |
| 0110 | Non-Op Income / Asset | no direct I>O |
| 0111 | Non-Op Income / Liability | no direct I>O |
| 1000 | Asset / Liability | no direct I>O |
| 1001 | Asset / Equity | no direct I>O |
| 1010 | Liability / Equity | no direct I>O |
| 1011 | Asset / Asset | no direct I>O |
| 1100 | Liability / Liability | no direct I>O |
| 1101 | Equity / Equity | no direct I>O |
| 1110 | Correction/Netting | special |
| 1111 | Compound Continuation | special |

**Key distinction:** I>O states are **perspective-based** (who is the sender, which direction, settled or pending). BitLedger Account Pair is **category-based** (which two accounts are affected). They are complementary. I>O deliberately omits Op/COGS/Non-Op accounting distinctions to serve low-literacy users. A field worker's `O<O` can be COGS, Opex, or a billed pass-through — the I>O state alone does not specify.

**Three-category expense problem:**

Field workers incur three distinct types of outlay that require different UI and encoding treatment:

| Category | Worker language | Billed? | Job ref? | Accounting |
|----------|----------------|---------|----------|------------|
| Job charge | "Charged to job" | YES — appears on invoice | YES | COGS linked to revenue |
| Job cost | "Job cost" | NO — absorbed in margin | YES | COGS, internal only |
| Running cost | "Running cost" | NO | NO | Operating Expense |

Current `1eg/` conflates all three as `record_type=expense` or `record_type=cogs`. The wizard UI has "Add Expense" and "Add COGS" buttons — opaque to non-accountants.

A `BILLED` flag (1 bit) in the financial block formally distinguishes job charges from job costs. Location undecided — see Q2b.

**Two financial entry modes:**
- **Simple mode** (default): I>O 8-state + expense category. Worker-language labels. No accounting jargon. Intended for low-literacy field workers.
- **Standard mode** (opt-in per Activity): Full BitLedger Account Pair classification. For activities needing accounting reconciliation.

Signalling mechanism (DOMAIN bits in meta2 or other) undecided — see Q2c.

**Status:** OPEN — Q2a, Q2b, Q2c in Round 1.

---

### T3 — Field Flag Scalability for Domain Templates

**Current:** flat fixed-width flags (24 bits in `1eg/`, 16 bits in `1bg/`). Each bit = one field slot. Works for the base svc-basic 12 fields.

**Clarification:** "thousands of templates" refers to **presentation templates** (Schema A/B/P/C in the Template Registry — visual rendering). These do NOT affect wire encoding. The 4-bit template ID in meta1 (16 per codebook) identifies the wire-level schema variant.

**Real scalability question:** domain-specific **data fields** beyond the base 12. An electrician record might need certificate number, test date, fixture count. A medical record needs procedure codes, patient ref. These are additional DATA fields that need flag bits and data blocks in the wire format.

**Options:**
- a) FLAGS3_PRESENT (bit 15 of field_flags2) chains to a third flags byte — 8 more field slots
- b) Codebook package change (scheme tag char 1) redefines all field slot assignments — unlimited but breaking
- c) Template ID signals a domain schema with its own fixed field set (no extra flags byte needed)

**Status:** OPEN — Q3 in Round 1.

---

### T4 — Amount Encoding: UTF-8 Strings vs uint24

**Current `1eg/`:** amount as UTF-8 string via `[uint16 len][UTF-8 bytes]`. E.g. "125.50" = 6 bytes + 2-byte prefix = 8 bytes per amount. Readable in raw bytes but wasteful.

**pads-v2 target:** uint24 (3 bytes) + DECIMAL_POS from setup byte. Any amount up to £167,772.15 at penny precision in 3 bytes. Saving: ~5 bytes per amount field. A typical invoice with 4 amounts saves ~20 bytes before compression.

**BitLedger approach:** 25-bit value via N=A×2^S+r with batch-level Scaling Factor and Decimal Position. More complex but covers any scale. Workpads uint24 is a simplified variant of the same philosophy.

**Breaking change:** yes, requires new codebook package letter and decoder version bump. Old `1eg/` URLs remain decodable via the existing decoder.

**Status:** OPEN — Q4 in Round 1.

---

### T5 — Standard Alignment: Which Repo Leads?

`workpads-standard/codec.md` documents `1bg/`. The KaiOS app runs `1eg/`. Neither matches `pads-v2-encoding-spec.md`. The pads-v2 spec is in `workpads-standard/` but not reflected in the standard codec doc.

**Options:**
- a) Standard leads: update `workpads-standard/codec.md` to pads-v1 target first, then implement in kaios
- b) Implementation leads: kaios prototypes the evolved codec, then standard is written from working code
- c) Co-evolution: spec and implementation advance together in parallel sessions

**Status:** OPEN — Q5 in Round 1.

---

## 4. Decision Log

| # | Decision | Chosen | Rationale | Date |
|---|----------|--------|-----------|------|
| D1 | Balance sheet account pairs in scope? | YES — full BitLedger Account Pair range required | Advanced users need equity/asset/liability event recording; UI routes through simplified rubric (expense, COGS, income) without exposing accounting terminology | 2026-05-15 |
| D2 | Template scalability — what kind? | Option b — domain-specific data field schemas | Thousands of domain templates (electrician, medical, construction) each need unique DATA fields in the wire format, not just presentation variants. Field flag scalability is a real codec problem. | 2026-05-15 |
| D3 | Standard update strategy | kaios codec standard leads; workpads-standard updated selectively | kaios is the implementation proving ground. Main standard doc gets manual selective updates as decisions settle, not as the primary target. | 2026-05-15 |
| D4 | Template ID architecture | 4-bit meta1 field with escape codes; 3-tier extension (1/2/3 bytes); decentralised variant type via CRC-8 namespace + CRC-16 local ID; 8 standard universals | Template IDs will grow to thousands; no central registry; collision resistance via identity-derived namespace; standard types compact and codebook-agnostic | 2026-05-15 |
| D5 | BILLED flag location | fin_flags sub-byte | Scoped correctly to financial block; present only when financial record exists; costs nothing when absent | 2026-05-15 |
| D6 | Simple vs Standard mode signalling | DOMAIN bits in meta2 (wire); Activity-level UI setting stamps DOMAIN on created records (UI) | Wire signal and UI decoupled; standalone URL must carry mode for accountant app to decode unambiguously | 2026-05-15 |
| D7 | Amount encoding tier range | All 4 tiers adopted; Tier 3 (24-bit) default; Tier 4 (32-bit) for large markets; SF in setup byte extends Tier 3 to £167M+ | African and other markets regularly invoice above £150K into millions; SF×100 + Tier 3 = £16.7M in 4 bytes | 2026-05-15 |
| D8 | Meta1 restructure | EXT_TEMPLATE flag (bit 6) + 3-bit BASE_TEMPLATE (bits 5-3); 8 structural universals when EXT=0; extension signal in bits 5-3 when EXT=1 (001=+1B, 010=+2B, 011=+3B, 100=variant); ACK/CHAIN/RECIPIENT_TYPE remain at bits 2-0 | Separates structure-type from extension-type cleanly; preserves all existing flags; scales to millions of domain templates | 2026-05-15 |
| D9 | Child record design | Child records are standalone-capable via the existing CHAIN + `&c=` URL mechanism; they carry their own financial data + optional CONTEXT_LABEL field (short text, new field flag bit); parent data is NOT duplicated; stripping `&c=` from URL = privacy-safe standalone record | Each financial entry is its own record; intelligibility without parent via context label; full context via chain lookup | 2026-05-15 |
| D10 | Variant template resolution | Graceful degradation — unknown variant templates decode known fields normally; domain-specific unknown fields skipped or shown as raw; template definition shared out-of-band (QR, link, Activity setup) | Simplest approach; no in-frame URI overhead; avoids bloating records with self-description | 2026-05-15 |
| D11 | Self-describing vs template-dependent field encoding | SELF_DESCRIBING flag in meta2 (repurpose reserved bit 7 CONTINUATION); 0=template-dependent (compact, semantic protection); 1=self-describing (1-byte canonical field-name index prefixes each data block) | Same record re-encodable between modes; template-dependent adds security layer (receiver needs template to label fields); self-describing for archival/auditors/new receivers | 2026-05-15 |
| D12 | Currency encoding beyond 64 | Setup byte CURRENCY 2-bit = country-relative (00=sender home currency, 01/10=codebook common currencies, 11=extended). Extension byte when CURRENCY=11: VALUE_TIER (bits 7-6) + 6-bit code giving 64; OR full 8-bit code (256) if VALUE_TIER moved to fin_control | Sender home currency = 0 bytes overhead for local transactions; 8-bit extended covers all ISO 4217 + crypto; VALUE_TIER moving to fin_control frees extension byte for full 8-bit currency | 2026-05-15 |
| D13 | Participants block — IS_ORG flag | Add IS_ORG to part_flags bit 0 (currently reserved) to distinguish company vs individual participant | No current mechanism to flag organisational vs personal participants | 2026-05-15 |
| D14 | fin_control byte | Add fin_control as first byte of financial block (when field_flags bit 12 set): BILLED(7), ACCOUNT_PAIR_EXT(6), ACCOUNT_PAIR/fin-flags(5-2), CUSTOMER_AMT(1), WORKER_AMT(0). Replaces field_flags3 bit 7 (WORKER_AMOUNT). In simple mode bits 5-2 carry additional fin flags; in standard mode they carry the 4-bit BitLedger Account Pair | Consolidates scattered financial block controls; gives BILLED its clean home; enables dual-mode interpretation of same byte via DOMAIN flag | 2026-05-15 |
| D15 | Value encoding: tiers replaced by formula + SF | VALUE_TIER eliminated. All amounts fixed 3-byte uint24. Real value = (uint24 × SF) / 10^D. SF declared in optional sf_byte (when setup_byte SF_PRESENT=1). 8 SF levels (×1 to ×1B) cover retail to sovereign scale. COMPOUND_VALUE moves from setup_byte to sf_byte bit 4. Common case (SF×1): SF_PRESENT=0, zero overhead. | Formula-based covers all real-world scales including African high-denomination currencies; eliminates decoder branching; cleaner than fixed-width tiers; BitLedger-aligned | 2026-05-15 |
| D16 | Setup byte restructure for SF_PRESENT | setup_byte bit 0 = SF_PRESENT (was COMPOUND_VALUE). sf_byte follows when SF_PRESENT=1: bits 7-5=SCALING_FACTOR(3-bit, 8 levels), bit 4=COMPOUND_VALUE, bits 3-0=reserved. | Preserves 8-bit setup_byte width for common case; SF+COMPOUND costs 1 extra byte only when needed | 2026-05-15 |
| D17 | fin_control simple-mode bit assignments (final) | DOMAIN=01: BILLED(7), 0(6), QTY_TYPE(5), unused(4), EXPENSE_CATEGORY(3-2), CUSTOMER_AMT(1), WORKER_AMT(0). DOMAIN=10: BILLED(7), 1(6), ACCOUNT_PAIR(5-2), CUSTOMER_AMT(1), WORKER_AMT(0). EXPENSE_CATEGORY: 00=job charge, 01=job cost, 10=running cost, 11=reserved. | VALUE_TIER removed (→ D15); 3 expense categories fit in 2 bits; QTY_TYPE supplements QTY_SPLIT for unit-based vs lump-sum display | 2026-05-15 |
| D18 | ROUNDING bits — retain 2 bits both modes | Keep 2-bit ROUNDING (00=exact, 10=down, 11=up, 01=error/invalid) in transaction byte for both DOMAIN=01 and DOMAIN=10. The 01=error code is a BitLedger error-detection feature. Down/up distinction maps to accounting-type rounding rules derived at encode time from transaction type — not user-chosen. | Error detection value justifies the cost; consistent across modes simplifies decoder | 2026-05-15 |
| D19 | Field flags density principle | Canonical field registry allocation: bits 0-11 = fields present in >50% of records (maximum density, always in base 2-byte field_flags). Bits 12-14 = globally common fields that extend the top 12 (bit 12 stays as financial block gate). Bit 15 = FLAGS3_PRESENT. FLAGS3 bits 0-6 = fields in 5-50% of records or common domain categories. FLAGS4+ = domain-specific and rare. | Maximises base field_flags utility; FLAGS3 remains genuine extension not overflow | 2026-05-15 |
| D20 | Participants role codebook — 1–2 byte extended codes | ROLE_TYPE 3-bit quick-select (0–6: Customer, Worker, Supplier, Subcontractor, Employee, Agent, Authority) retained for zero-overhead common roles. ROLE_TYPE=7 + HAS_ROLE_TEXT=0: 1-byte code (0x00-0xFE, 16 groups × 15 roles = 240 specific roles); 0xFF = 2-byte extension (16 extended groups, ~224 specialist roles). ROLE_TYPE=7 + HAS_ROLE_TEXT=1: free UTF-8 text (unchanged). Full codebook: ROLE-CODEBOOK.md. ISCO-08 aligned; includes African informal economy, gig economy, global south roles. | 7 quick-select codes cover 80%+ of records at zero byte cost; 240 named roles in 1 byte cover 99%+ of all global transaction participants; 2-byte extension for specialist/regional roles; free-text always available | 2026-05-15 |
| D21 | fin_control parity — bit 4 as PARITY, QTY_TYPE retained in bit 5 | Moving QTY_TYPE to standard fields penalises simple-mode workers (FLAGS3 byte + data block overhead per record). Instead: bit 4 (previously "must be zero") = PARITY over bits 7,5,3,2,1,0. Covers QTY_TYPE in the parity check. Four integrity checks: bit6=0 (mode indicator), bit4=PARITY(7,5,3,2,1,0) (single-bit detection), EXPENSE_CATEGORY≠11 (reserved code), QTY_TYPE=1 requires QTY_SPLIT=1 (cross-field check). All 8 bits fully utilised. Standard mode: bit6=1 (symmetrical), ACCOUNT_PAIR restricted codes 1110/1111. BitPads v2-aligned: self-validating byte through overlapping validity constraints, zero CRC overhead. | Keeps QTY_TYPE where simple-mode workers need it; parity now covers more bits (6 vs 5); all 8 bits carry meaning; decimal uint24+SF superior to BitLedger binary value formula for workpads use case | 2026-05-15 |
| D24 | FLAGS3_PRESENT location | field_flags bit 15 only; meta2 bit 5 freed (reserved) | FLAGS3_PRESENT in both meta2 and field_flags was redundant; field_flags bit 15 is structurally correct (register extends itself); freeing meta2 bit 5 without immediate reassignment | 2026-05-15 |
| D23 | BitLedger value encoding: QTY_COMPACT compact qty path | sf_byte bit3=QTY_COMPACT, bits2-0=SPLIT_POINT (0=default 8 qty bits, 1-7=explicit). QTY_COMPACT=1 packs rate+qty into customer_amount uint24, saving 6 bytes. SPLIT_POINT=0 mirrors BitLedger S=8 default. QTY_COMPACT=0 (three uint24s) stays default. Fallback to QTY_COMPACT=0 when values exceed split capacity. N=A×2^S+r is an identity; flat values need no special formula; SF alone covers high millions. | Incorporates the one genuine BitLedger advantage (qty+rate packing) while retaining uint24 simplicity for common cases | 2026-05-15 |
| D22 | Standard fields planning: canonical registry, synonyms, Contact template, subtypes | bits 0-11: existing pads-v2 fields unchanged. bit 13=ref_number (u8 compact), bit 14=due_date (compact date). FLAGS3 bits 0-6: context_label, tag, qty_unit, expiry_date, attachment, uid, url. FLAGS4+: template-defined. Synonym system: label_map in template definition, canonical names always in wire. Contact/entity template: job=FN, customer=ORG, location=ADR, customer_phone=TEL, worker=TITLE, details=NOTE, ref_number=ROLE, uid(F3)=vCard UID, url(F3)=URL. Subtypes completed for I<O/I>O/O<I/O>I. SELF_DESCRIBING index 0x00-0x16 canonical, 0x80-0xFE custom. BitLedger wholesale value adoption rejected — uint24+SF retained. Full spec: STANDARD-FIELDS.md. | Completes all standard fields open items; preserves pads-v2 backwards compatibility; enables vCard import/export; closes Q14, Q15, Q16 | 2026-05-15 |
| D23 | BitLedger value encoding deep analysis; compact qty path added | N=A×2^S+r is an algebraic identity providing no mathematical advantage over uint24 for flat values. "High millions" already achieved via SF alone. The ONE material advantage of BitLedger's Optimal Split applies only to qty/rate records: packing price+qty into a single block. Workpads adopts this as optional QTY_COMPACT mode. sf_byte bits 3-0 reallocated: bit3=QTY_COMPACT (0=three uint24s default, 1=packed); bits2-0=SPLIT_POINT (qty bit width 0-7; stored 0b100=8 qty bits recommended as default). When QTY_COMPACT=1: customer_amount uint24 carries packed rate (upper 24-SPLIT_POINT bits) + qty (lower SPLIT_POINT bits); Real Value=(rate×qty×SF)/10^D. Saves 6 bytes per time-and-materials line. Fallback to QTY_COMPACT=0 when values exceed split capacity. Compound continuation via COMPOUND_VALUE (D16) already handles arbitrarily large flat values. | Incorporates the one genuine advantage of BitLedger variable-split for qty/rate records; adds zero overhead when not used; covers >95% field service patterns at default SPLIT_POINT | 2026-05-15 |

---

## 5. Round Log

### Round 11 — 2026-05-15 — Template System Design (OQ-15–19)

**Trigger:** The `1pt` template-keyed tag (OQ-14g) implies that users can both protect existing templates and create new ones via a form builder. These are the same underlying need: producing a template definition artifact that doubles as a shared secret.

**Template definition schema (OQ-15):** JSON structure with `base_template`, `domain`, `codebook`, `version`, `label_map`, `fields` (required/optional), `custom_fields` (FLAGS4 slot assignments + types), `block_order`, `protected`. Canonical form for hashing: alphabetically sorted keys, no whitespace, UTF-8, excluding `id`/`name`/`protected`. The `block_order` array serves double duty as the `1pt` scramble permutation — no separate key-derived permutation needed for template-keyed records.

**Template sharing (OQ-16):** `workpads.me/t/<b64url-deflated-template-json>` — separate `/t/` path from record URLs. One-time share per bilateral relationship. Optional encrypted share for bootstrap security (template JSON encrypted under passphrase before URL generation).

**Form builder field types (OQ-17):** 10 types proposed — text, text_compact, date, time, amount, integer, boolean, select, phone, url. Custom fields live in FLAGS4 slots; `select` choices stored in template definition. Type set covers all standard codec wire encodings.

**Protected template immutability (OQ-18):** Immutable once shared — modifications create new template (new ID, new hash). UI: lock icon, "Duplicate and edit" replaces "Edit". Metadata-only changes (`name`) exempt because `name` excluded from canonical hash.

**Content-addressed template versioning (OQ-19):** Templates stored by content hash. Multiple versions share a human-readable `name` but have distinct hashes and IDs. App resolves correct version for historical decode by trying each stored hash for a given template ID until the commitment check (OQ-14k) passes.

**Relationship to existing decisions:** D4 template ID architecture (CRC-8 namespace + CRC-16 local ID) handles the decentralised ID scheme. D22 label_map is the label system the form builder writes to. OQ-11 FLAGS4 is the extension slot pool the form builder assigns custom fields from.

**OQ-16 revised (server visibility + previewer problem):** The original `/t/` path proposal sends the template payload in the HTTP request — server receives it. Dropped. Template shares use `#t/` and `#te/` fragments instead (consistent with all record URLs; server sees only `GET /p`). JS-rendered URL previewers in messaging apps can read fragments but get only ciphertext for `#te/` encrypted shares. Unencrypted `#t/` shares are safe from server-side previewers (HTTP); mitigated against JS-rendered previewers by the app serving generic static meta tags and deferring all JS codec execution to genuine user interaction. QR/NFC established as the canonical sharing mechanism for protected templates — no URL, no network, no preview surface.

### Round 10 — 2026-05-15 — Security and Scrambling Layer (OQ-14)

**Design motivation:** workpads URLs travel via SMS, WhatsApp, QR codes. Casual interception (shared chat history, third-party account access, URL preview logging, shoulder-surfing) is the real threat. A short human-typeable passphrase (6–8 chars, shared verbally or out-of-band) is the right tradeoff — adequate against casual interception, typeable on a KaiOS D-pad.

**Core decision: three-layer protection model**
- Layer 1: Template type stays visible in `1ph` (partial mode) — receiver sees "financial record" without amounts or names
- Layer 2: Semantic scramble — field_flags bit assignments AND data block write order both permuted by key-derived seed. Without the key: values are encrypted AND assigned to wrong fields AND field presence is opaque. "Format confusion" — the codec structure itself is scrambled, not just values.
- Layer 3: AES-CTR stream cipher (WebCrypto / RC4 fallback) over the scrambled payload

**New tags:** `1ps` = full encrypt+scramble; `1ph` = partial encrypt+scramble (meta header visible, data scrambled+encrypted)

**Key hierarchy:** `master = SHA-256(passphrase || 4-byte-salt)`. Split: `cipher_key = master[0:16]`, `scramble_seed = master[16:32]`. Both layers from one passphrase, independent key material.

**Field-order scrambling detail:** Fisher-Yates shuffle seeded by `scramble_seed` produces two permutations: (a) the 14 field_flags bit position assignments; (b) the data block write order. Both sender and receiver derive identical permutations independently — no extra communication needed.

**Additional noise:** field_flags3 unused bits set to random values when scrambling active. A standard decoder (no key) encounters apparent FLAGS3 extension fields with no valid content. Zero payload cost.

**SELF_DESCRIBING forced off:** Field-name index prefixes on data blocks would reveal field identity and defeat block-order scrambling. Scrambled tags always imply SELF_DESCRIBING=0.

**Per-contact standing passphrases:** App stores per-contact code (encrypted at rest). Sender applies code automatically on record creation. Receiver prompted once on first record from a new sender, stores the association, auto-decodes thereafter. Zero per-record UI friction after setup.

**Codec architecture unchanged:** Scramble+encrypt is a wrapper module (`scrambleWrap` / `scrambleUnwrap`) operating on the deflated binary frame as an opaque byte array. FRAME-SPEC.md and codec.js internals unchanged.

**Template-keyed records (`1pt`, OQ-14g):** A private shared template existing on only two devices is itself a high-entropy shared secret — its content (~500–2000 bytes) hashes to 32 bytes of key material. `master = SHA-256(SHA-256(template_content) || salt)`. The template ID (`XY3`) is advertised plainly in the URL — safe because the ID is a routing hint; the key is the template content, which the interceptor does not have. Structurally: public key ID is public; private key content is not. The template's field ordering also directly supplies the block-order permutation — scramble and template definition become the same artifact.

**Deflate seed poisoning (OQ-14h):** Prepend a key-derived prefix to the raw frame before deflating. Compress `(prefix || frame)` together. LZ77 back-references span the whole input, so the prefix rewrites the entire compressed bitstream — compression layer key-dependence at zero decompressed overhead. Attacker inspecting the ciphertext sees no recognisable deflate header structure.

**Chain ratchet (OQ-14i):** For chained records: `key_N = SHA-256(key_{N-1} || salt_N)`. Cannot decode record N without having decoded N-1. Job chains (quote → invoice → payment) become a ratchet sequence — mid-chain interception is useless.

**Honey record (OQ-14j):** A pre-authored decoy frame encrypted under a trivially-derived key appended inside the main encrypted payload. Brute-force attackers reach the decoy first and see a plausible-looking but fabricated record. No feedback signal that decoding failed. Breaks automated cracking loops.

**Receiver commitment (OQ-14k):** `HMAC-SHA256(master_key, sender_phone || receiver_phone)` appended as last 8 bytes of encrypted payload. Verifies that the record was encrypted for this specific sender→receiver pair. Prevents key reuse across contacts. Cryptographic rejection of false-positive decodes.

**Updated encode/decode pipeline:**
```
encode: frame → deflateWithSeed → fieldScramble → appendCommitment → aesCtr → b64url
decode: b64url → aesCtrDecrypt → verifyCommitment → fieldUnscramble → deflateUnwrap → decode
```

**Eleven open sub-decisions (OQ-14a–k):** see OPEN-QUESTIONS.md §OQ-14.

**Full spec:** `OPEN-QUESTIONS.md §OQ-14`

### Round 9 — 2026-05-15 — Frame Sketch Session (D24 + FRAME-SPEC.md)

**D23 SPLIT_POINT correction:** The initial D23 SPLIT_POINT table had an internal contradiction — "0b100 stored → 8 qty bits" but 0b100=4 which would mean 4 qty bits. Corrected to: SPLIT_POINT=0 is the default sentinel meaning 8 qty bits (mirrors BitLedger S=8); SPLIT_POINT=1–7 mean exactly that many bits to qty. Practical range: SPLIT_POINT=0 (8 qty bits, qty max 255, rate max 65,535) covers >95% of field service T&M records.

**QTY_COMPACT applicability note:** QTY_COMPACT=1 is best suited for integer-qty records (parts, visits, km). Time billing with fractional hours (e.g. 3.5h) requires qty=350 at DECIMAL_POS=2, which exceeds 8-bit qty max (255). For fractional hours: either use QTY_COMPACT=0 (separate uint24s), or bill in integer 0.1h units with a qty_unit label.

**D24 — FLAGS3_PRESENT location:** FLAGS3_PRESENT appeared in both meta2 bit 5 (from pads-v2 spec) and field_flags bit 15 (from D22). Resolved: field_flags bit 15 is the sole home. meta2 bit 5 freed (reserved, must be 0). Structurally correct — the flags register extends its own presence.

**FRAME-SPEC.md created:** `workpadskaios/system/FRAME-SPEC.md`. Contents:
- Complete byte-by-byte frame layout (all 17+ byte types, all presence conditions)
- I>O subtype table: all 32 combinations (8 states × 4 subtypes)
- Five named frame profiles (A=minimal service, B=simple payment, C=T&M invoice, D=with participants, E=absolute minimum) with exact byte counts
- Benchmark: pads-v1 saves 28–33% raw bytes vs 1eg/; URL length ~50–60 chars vs 70–80
- Migration path: dual-codec → gradual re-encoding → legacy sunset; full field mapping table
- Open implementation-time design points (codebook tag, epoch date, endianness)

**transaction-classification.md updated:** Added D22 subtypes for all 4 previously-reserved I>O states (I<O, I>O, O<I, O>I — 4 subtypes each = 16 new codes). Sync obligation closed.

### Round 8 — 2026-05-15 — BitLedger Value Encoding Deep Analysis (D23)

**Question:** BitLedger's full 40-bit block value encoding — Optimal Split, N=A×2^S+r formula, Scaling Factor, remainder — was believed to have unrealised advantages for simultaneously achieving high amounts AND high-precision quantities.

**Finding 1 — N=A×2^S+r is an identity, not a compression formula.** For any integer N and any S: A=floor(N/2^S), r=N mod 2^S, N=A×2^S+r exactly. Every value 0..33,554,431 is reachable without gaps. This is just how BitLedger's two-field structure (Multiplicand + Multiplier) stores the integer across the boundary set by Optimal Split. For flat values, there is no mathematical advantage over a plain uint24. Workpads uint24+SF is equivalent.

**Finding 2 — "High millions" is already solved by SF.** With SF=×1K and DECIMAL_POS=2: max value = 16,777,215 × 1,000 / 100 = ₦167.7M. With SF=×1M: ₦16.7B. Covers every real-world field service transaction globally. The range concern was already addressed by D15/D16.

**Finding 3 — The ONE real advantage: Optimal Split for qty/rate packing.** When bit 32=1 (Quantity Present), BitLedger packs price-per-unit (A field) and quantity (r field) into a single 25-bit block using the Optimal Split S as the boundary. Workpads' current design uses THREE separate uint24 fields (qty + rate + customer_amount = 9 bytes). BitLedger-style packing: ~3 bytes for both price and qty combined.

**Resolution (D23):** Add optional QTY_COMPACT mode to sf_byte. When QTY_COMPACT=1: customer_amount uint24 carries packed rate (upper 24−SPLIT_POINT bits) + qty (lower SPLIT_POINT bits). sf_byte bits 3-0 reallocated: bit3=QTY_COMPACT, bits2-0=SPLIT_POINT. Default SPLIT_POINT=0b100 → 8 qty bits + 16 rate bits (mirrors BitLedger default S=8). Saves 6 bytes per time-and-materials line. QTY_COMPACT=0 (three uint24s) remains the default — no regression.

**sf_byte final layout:**
```
bits 7-5: SCALING_FACTOR (×1/×10/×100/×1K/×10K/×100K/×1M/×1B)
bit 4:    COMPOUND_VALUE
bit 3:    QTY_COMPACT (0=three uint24s, 1=packed split)
bits 2-0: SPLIT_POINT (qty bit width; 0b100=8 qty bits recommended default)
```

### Round 7 — 2026-05-15 — Standard Fields Planning Session

**QTY_TYPE stays in fin_control (D21 revised):** Moving QTY_TYPE to standard fields would penalise simple-mode workers. Bit 4 is the parity bit instead. Now covers 6 bits (including QTY_TYPE). Four integrity checks established.

**BitLedger wholesale value adoption declined:** Binary N=A×2^S+r value formula is byte-equivalent or worse for decimal invoice amounts vs uint24+SF. Decimal-centric approach retained (D15). Selective BitLedger adoptions only: Account Pair (D6), rounding rules (D18), restricted code integrity (D21).

**Standard fields session (D22):**
- Canonical registry complete: bits 0-11 unchanged from pads-v2, bits 13-14 added (ref_number, due_date), FLAGS3 bits 0-6 defined
- Synonym/relabelling via template label_map — sector-specific labels for healthcare, legal, agriculture, retail
- Contact/entity template (BASE_TEMPLATE=011) fully mapped to vCard 4.0 (FN, ORG, ADR, TEL, TITLE, NOTE, ROLE, UID, URL)
- I<O / I>O / O<I / O>I subtypes all defined (4 states × 4 subtypes = 16 new codes)
- SELF_DESCRIBING index assigned (0x00-0x16 canonical, 0x80-0xFE custom/template)
- All standard fields open questions (Q14, Q15, Q16) resolved

**Full spec:** `workpadskaios/system/STANDARD-FIELDS.md`

---

### Round 6 — 2026-05-15 — Parity in fin_control, Rounding Model, vCard Integration

**fin_control bit 5 as parity (D21):** User observed that QTY_TYPE (bit 5 in simple mode) is redundant to template context and can instead serve as an even parity bit over the 5 content bits (BILLED, EC1, EC0, CUSTOMER_AMT, WORKER_AMT). This gives single-bit error detection in fin_control. Four simultaneous integrity checks in simple mode: bit6=0 (mode indicator), bit4=0 (unused must be clear), bit5=PARITY (computed), EXPENSE_CATEGORY≠11 (reserved code). Standard mode achieves equivalent via ACCOUNT_PAIR restricted code space (1110/1111 reserved). QTY_TYPE moves to canonical standard fields. BitPads v2 alignment confirmed.

**Rounding model corrected (D18 update):** Rounding is creator-controlled. Conservative defaults (down=income, up=expense) are encoder suggestions only. Creator can always set ROUNDING=00 (exact). In amendment/edit sequences, editor proposes rounding for the revision — `00` is a normal edit choice ("no rounding proposed"). `01` = error/invalid, never intentionally set.

**vCard/VCF architecture (Q19):** Two-layer design settled. Participants block (compact snapshot) already maps to core vCard fields (FN, TEL, EMAIL, ROLE, ORG). Full vCard equivalent = Contact/entity template (BASE_TEMPLATE=011, D4) — field set including UID, ADR, URL, ORG-affiliation defined in standard fields session. App features: KaiOS mozContacts API import/export. No structural codec change needed for participants block. Standard fields session adds QTY_TYPE + Contact/entity template field set.

---

### Round 5 — 2026-05-15 — Value Encoding Revisited, fin_control Final, Role Codebook

**Observations addressed:** User raised formula-based value encoding (vs tiers), field flags density, fin_control bit-packing, ROUNDING bits necessity.

**Formula-based value encoding (D15):** VALUE_TIER eliminated. All amounts = fixed 3-byte uint24. Real value = (uint24 × SF) / 10^D. SF declared in optional sf_byte when setup_byte SF_PRESENT=1. 8 SF levels (×1 to ×1B) cover smallholder to sovereign scale. Real-world benchmarks confirmed:
- NGN 500 (smallholder): uint24=500, SF×1 — trivial
- NGN 1.5M (contractor): uint24=15000, SF×100 — fits easily
- NGN 1.67B (enterprise): uint24=167, SF×10M — still 3 bytes

**Setup byte restructured (D16):** bit 0 = SF_PRESENT (was COMPOUND_VALUE). COMPOUND_VALUE moved to sf_byte bit 4.

**fin_control final (D17):** VALUE_TIER bits freed. Simple mode (DOMAIN=01): BILLED(7), 0(6), QTY_TYPE(5), unused(4), EXPENSE_CATEGORY(3-2), CUSTOMER_AMT(1), WORKER_AMT(0). No conflict confirmed.

**ROUNDING bits (D18):** Kept as 2 bits in both modes. `01` = error detection code (BitLedger feature). Down/up set at encode time from transaction type — not a user choice.

**Field flags density (D19):** bits 0-11 = >50% frequency; FLAGS3 = 5-50%; FLAGS4+ = domain/rare. Standard fields session must apply this aggressively.

**Role codebook (D20):** Exhaustive 1–2 byte extended role code system built out. ROLE_TYPE 3-bit (0–6) quick-select retained for zero-byte common roles. ROLE_TYPE=7 + HAS_ROLE_TEXT=0 = 1-byte code (240 named roles, 16 groups) or 2-byte extension (224 specialist roles). Web research confirmed ISCO-08 alignment + African informal economy coverage. Full codebook saved to ROLE-CODEBOOK.md.

**Q17 resolved:** VALUE_TIER elimination removes the fin_control overlap concern entirely.
**Q18 resolved → D20.**

---

### Round 4 — 2026-05-15 — Field Labels, Currency, fin_control, Participants

**Subtypes confirmed:** I<I / I>I / O<O / O>O fully specced in transaction-classification.md. I<O / I>O / O<I / O>I subtypes all reserved — to be designed in standard fields session.

**Extended domain field slots:** FLAGS3_PRESENT infrastructure already exists (bits 6-0 of field_flags3 reserved = 7 domain slots available now; chaining via FLAGS4_PRESENT gives unlimited extension). Slot assignment is the standard fields session's deliverable.

**SELF_DESCRIBING flag (D11):** meta2 bit 7 (previously CONTINUATION, reserved) repurposed. 0=template-dependent encoding (compact, receiver needs template for field semantics — adds security layer). 1=self-describing (each data block prefixed with 1-byte canonical field-name index). Same record re-encodable between modes. Field-name index registry is the canonical standard field set — to be designed in standard fields session.

**Currency (D12):** Setup byte CURRENCY=00 now means sender's home currency (implicit from country selector — zero bytes overhead for local transactions). CURRENCY=11 triggers extension byte. Extension byte: VALUE_TIER (bits 7-6) + 6-bit extended code (64). To reach 256 currencies (covering all ISO 4217), VALUE_TIER moves to fin_control byte (D14), freeing the full extension byte for 8-bit currency code.

**Participants (D13):** IS_ORG flag added to part_flags bit 0 (was reserved). No other structural changes needed — role_text for non-codebook roles, max 7 participants adequate for field service, 111=Extended role handles accounting roles (accountant, auditor) via text.

**fin_control byte (D14):** New first byte of financial block (when field_flags bit 12 set). BILLED(7) + ACCOUNT_PAIR_EXT(6) + ACCOUNT_PAIR-or-fin-flags(5-2) + CUSTOMER_AMT(1) + WORKER_AMT(0). In simple mode (DOMAIN=01) bits 5-2 carry additional financial flags. In standard mode (DOMAIN=10) bits 5-2 carry 4-bit BitLedger Account Pair. Replaces field_flags3 bit 7 (WORKER_AMOUNT now here).

**Standard fields session flagged** as a dedicated planning deliverable (Q14, Q15).

---

### Round 3 — 2026-05-15 — Meta1 Restructure, Child Records, Variant Resolution

**Questions addressed:** Q7 (meta1), Q8 (child records), Q9 (variant template resolution)

---

**Meta1 Restructure (D8):**

The 4-bit template field in pads-v2 meta1 has a conflict: using 1000–1010 and 1110 as escape codes leaves the remaining flags (ACK/CHAIN/RECIPIENT_TYPE) and META2_PRESENT competing for the same 4 bits. The fix is to split the template field:

**Proposed meta1 layout:**

```
Bit 7: META2_PRESENT      — meta2 follows
Bit 6: EXT_TEMPLATE       — 0=standard type (3-bit in bits 5-3), 1=extension follows
Bits 5-3: BASE_TEMPLATE or EXT_SIGNAL
  When EXT=0 (standard):
    000: Service record    — basic job/service, no financial block
    001: Financial record  — service + financial block (I>O type via transaction byte)
    010: Compound financial — financial with multiple line items
    011: Contact/entity    — participant/business record
    100: Document/media    — file reference or attachment record
    101: State Commit      — snapshot, no transaction
    110: Amendment         — changed-fields record
    111: Generic           — meta2 provides further classification
  When EXT=1 (extended):
    001: +1 byte follows   — 256 domain types per codebook package
    010: +2 bytes follow   — 65,536 domain types per codebook package
    011: +3 bytes follow   — 16M domain types
    100: +3 bytes variant  — CRC-8 namespace + CRC-16 local ID (decentralised)
    000, 101-111: reserved
Bit 2: ACK_REQUEST        — sender requests recipient ACK URL
Bit 1: CHAIN              — chain ref present in URL (&c=XXXX)
Bit 0: RECIPIENT_TYPE     — 0=customer-facing, 1=colleague-facing
```

**Key design principle:** Template = STRUCTURE (which fields exist). Transaction byte = FINANCIAL TYPE (I>O state — invoice, expense, payment etc.). These are separate concerns. A "Financial record" template (001) with transaction byte `I>I` = invoice. Same template with `O<O` = expense paid. Template ID no longer encodes the transaction direction — the transaction byte owns that.

**The extended template bytes follow immediately after any meta bytes, before field flags.** The decoder reads meta1, sees EXT=1, reads the extension bytes, then continues with field flags.

---

**Child Records — Standalone + Chainable (D9):**

Clarification received: each financial value IS its own record. A job record has child records for expenses, COGS entries, payments. The design goal is:

- **Standalone mode:** child record is intelligible without its parent (can be shared, printed, forwarded)
- **In-context mode:** chain ref links child to parent; receiver assembles full picture via lookup
- **Privacy mode:** strip `&c=` from URL → child has no parent reference, fully independent

**What a child record carries (its own content):**
- Template type: Financial record (001) or similar
- Transaction byte: I>O state (O<O for expense, I<I for payment, etc.)
- Financial block: amount, currency, BILLED flag, fin_flags
- Optional: COMPACT_TIME for date
- Optional: CONTEXT_LABEL — new field (short text, 1 field flag bit, max ~30 chars) carrying a human-readable reference to the parent context (e.g. "Boiler repair, 42 High St") for standalone intelligibility WITHOUT transmitting parent data

**What a child record does NOT carry:**
- Parent's client name, address, contact details
- Parent's full job description and service fields
- Parent's chain — only its own chain ref back to parent

**The CONTEXT_LABEL field** is the key addition: a short optional string that makes a standalone child record intelligible ("£45.00 materials — Boiler repair, 42 High St") without requiring parent lookup. Its content is chosen by the sender at creation time. When CHAIN is present, the label is supplementary; when CHAIN is absent, it's the only context available.

BitPads alignment: this mirrors BitPads' Note block (narrative content) used to add human-readable context to a record. The CONTEXT_LABEL is essentially a constrained Note — short, single-purpose, optional.

---

**Variant Template Resolution (D10):**

Graceful degradation is the correct approach. An unknown variant template:
1. Decodes its standard fields (amount, date, participants — these are always in known positions)
2. Skips or labels-as-unknown any domain-specific fields it cannot interpret
3. Displays what it has — the financial data and basic identity are always recoverable

Template definitions are shared out-of-band: via QR code when an Activity is set up, via a template package URL embedded in an Activity's codebook reference, or via future template exchange mechanisms. No in-frame URI is needed. This keeps records compact and puts the template resolution problem at the Activity configuration layer, not the record encoding layer.

---

### Round 2 — 2026-05-15 — Template ID Architecture, Settled Flags, Amount Scale

**Questions asked:**
- Q1 — BitPads adoption scope + template ID architecture
- Q2b — BILLED flag location
- Q2c — Simple vs Standard mode signalling
- Q4/Q6 — Amount encoding + large-scale (African market) requirements

**Answers received:**

**Q1 — Template ID:** Template IDs will grow greatly. Need: (a) standard universals, (b) extended 1-3 byte optional range for thousands of domain types, (c) variant/custom designation that is decentralised — uniqueness established by mashup of sender/receiver ID so central registry not required, collision avoided by probability. Value block is distinct — many records have multiple value types. BitPads-style Time/Task/Note blocks are a future consideration. **SETTLED in part — see Decision D4. Template ID architecture below.**

**Q2b — BILLED flag:** Agree fin_flags. **SETTLED → D5.**

**Q2c — Simple vs Standard:** DOMAIN bits in meta2 for wire signal. UI (Activity-level mode selection in management screen) is a separate concern that stamps DOMAIN bits on created records. Decoupled. **SETTLED → D6.**

**Q4/Q6 — Amount encoding:** Simple uint24 may not suffice — African and other markets regularly invoice above £150K into millions. Tier 1/2 noted as a variable-length optimisation (leading zero bits = shorter encoding, denser transmission for small amounts). Need full tier range. **SETTLED in part → D7. Analysis below.**

---

**Template ID Architecture (fleshed out — 2026-05-15):**

Design goals: compact universals, extensible domain range, decentralised custom IDs, no central registry requirement.

**4-bit template field in meta1 — proposed allocation:**

| Code | Meaning | Extra bytes |
|------|---------|-------------|
| 0000–0111 | 8 standard universal types | 0 |
| 1000 | Extended type follows | +1 byte (256 types per codebook package) |
| 1001 | Extended+ type follows | +2 bytes (65,536 types per codebook package) |
| 1010 | Extended++ type follows | +3 bytes (16M types — for future scale) |
| 1011–1101 | Reserved | — |
| 1110 | Variant type follows | +3 bytes (decentralised — see below) |
| 1111 | Special records (State Commit, Amendment) | per spec |

**Standard universal types (0000–0111, 8 types):** The core workpads record types that every codebook package must support. Candidates: invoice, quote/estimate, receipt/payment, expense, COGS, state commit, amendment, generic/unlabelled. These never change meaning across codebook versions.

**Extended types (1000–1010):** Domain-specific templates registered within a codebook package. An electrician's "Periodic Inspection Report" is an extended type — meaningful within codebook package `b-electrical`, unrecognised in `a-general`. The 1–3 extra bytes follow immediately after meta1. Thousands of templates accommodated without blowing the meta1 budget.

**Variant types (1110 + 3 bytes):** Decentralised custom templates. No registry. Uniqueness established as:
- Byte 1: CRC-8 of creator identity (hashed from phone number, sender ID, or similar) = 256-value namespace
- Bytes 2–3: CRC-16 of (creator identity + template name + creation date) = 65,536 local IDs

Collision probability between any two distinct variant template definitions sharing the same CRC-8 namespace: 1/65,536. Cross-namespace collision probability: 1/16,777,216 (1 in 16M). Negligible for the workpads use case where templates are created infrequently and shared in-band via template definition packets or QR codes.

A receiver encountering an unknown variant ID requests the template definition out-of-band (or ignores unknown fields gracefully). This mirrors how CSS class names work — the ID is a compact key to a definition held elsewhere, cached after first resolution.

**Multiple value types per record:** The financial block already supports compound values (fin_flags COMPOUND_VALUE bit in pads-v2). For records carrying multiple value types (e.g. labour + materials + tax as separate line items), the compound value pattern handles this. Not a template ID concern — it's a financial block concern addressed under T2/fin_flags.

---

**Amount Encoding Analysis — Large Markets (2026-05-15):**

Tier function clarified: Tiers 1–4 are variable-length amount fields. The leading bits of the first byte signal the tier, allowing compact encoding for small values and extended range for large values without a separate setup byte declaration.

| Tier | Bytes | Data bits | Max at SF×1, D=2 | Use case |
|------|-------|-----------|-----------------|---------|
| 1 | 1 | 8 | £2.55 | Micro-payments, counts, status |
| 2 | 2 | 16 | £655.35 | Small transactions |
| 3 | 3 | 24 | £167,772.15 | Standard field service invoices |
| 4 | 4 | 32 | £42,949,672.95 | Large projects, African/high-scale markets |

**African market requirement:** Invoices regularly exceed £150K into millions. At SF×1, Tier 3 only reaches £167K. Solution:
- Tier 4 (4 bytes, 32-bit) at SF×1, D=2 covers £42.9M — sufficient for most African invoicing
- Setup byte declaring SF×10 + Tier 3 covers £1.67M in 4 bytes total (1 setup + 3 value)
- Setup byte declaring SF×100 + Tier 3 covers £16.7M
- Both approaches fit within the 5-byte equivalent of a BitLedger Layer 3 record

For workpads' deflate-compressed URLs: Tier 1/2 compact encoding matters less than in raw streams because deflate already compresses leading zeros. However explicit tier signalling is still cleaner than relying on compression.

**SETTLED → D7.**

---

### Round 1 — 2026-05-15 — Foundation and Orientation

**Context:** First codec evolution session. Research phase completed. Five questions drafted to orient the design.

**Questions asked:**

- **Q1** — Frame architecture: pads-v2 meta bytes vs evolve `1eg/` flat header?
- **Q2a** — Transaction byte scope: does workpads ever need balance sheet events beyond I>O 8-state?
- **Q2b** — BILLED flag: where in the wire format does the job-charge vs job-cost distinction live?
- **Q2c** — Simple vs Standard mode: DOMAIN bits in meta2, or different mechanism?
- **Q3** — Template scalability: presentation templates (thousands, no wire impact) vs domain data fields (need flag bits)?
- **Q4** — Amount encoding: uint24 binary vs current UTF-8 strings?
- **Q5** — Standard update strategy: standard leads, kaios leads, or co-evolution?

**Corrections made this session:**
- BitLedger Account Pair is 4 bits (not 16 bits). 16 combinations, 14 active pairs.
- I>O states are perspective-based (not "operational income/expense" in the accounting sense). `O<O` covers COGS, Opex, and billable pass-throughs alike.

**Answers received — 2026-05-15:**

**Q1:** Not settled. The BitPads Protocol v2 frame architecture needs proper evaluation on its own terms before choosing between it, pads-v2 meta bytes, and evolved 1eg/ flat header. The URL prefix (scheme tag = template + version info) is already solved and stays. The question is what sits inside the frame after that prefix. Carry to Round 2.

**Q2a:** YES — advanced workpads users need access to the full BitLedger Account Pair range (balance sheet events, non-operating income/expense, equity). The UI will channel users to these through a simplified rubric (expense, COGS, income, etc.) rather than exposing accounting terminology directly. **SETTLED — see Decision D1.**

**Q2b:** Location of BILLED flag — to be explored. Open.

**Q2c:** Simple vs Standard mode signalling — the UI method and the wire format signal may differ in practice. Both need designing separately. Open.

**Q3:** Option b — domain-specific data field schemas requiring unique field flag bits in the wire format. The field flags scalability problem is real and must be solved at the codec level. **SETTLED — see Decision D2.**

**Q4:** Not settled. Simple uint24 mode may suffice for most workpads amounts, but BitLedger's full value encoding (N=A×2^S+r with SF and DECIMAL_POS) handles greater complexity. Need to analyse the compactness tradeoff. Carry to Round 2.

**Q5:** kaios codec standard leads. workpads-standard codec doc updated selectively and manually as decisions settle. **SETTLED — see Decision D3.**

---

### Round 12 — 2026-05-15 — Presentation Records: Micro-Billboard, Contact-Resident Mode, Structured JS

**Questions asked / topics raised:**
- How does a template draw from the sender's contact card or Activity profile to render a display-only page ("micro billboard")?
- Can the receiver also enter information and submit it back?
- What if only an identifier travels and the receiver's device fills the display from local contacts on match?
- What would the payload look like if we permitted structured JavaScript for custom interactive experiences?

**Decisions / design:**
- **`#1pb/` tag** — new presentation record tag. No transaction byte. Carries display schema block and optional form schema block. Same receptive shell (`workpads.me/p`).
- **Display schema block** — DISPLAY_MODE, LAYOUT, accent_color, field_order, section_labels, hide_mask.
- **Form schema block** — SUBMIT_ACTION, editable_mask, required_mask, response_template_id, response_contact. A record can carry both blocks simultaneously (display some fields, collect others).
- **data_source field** — 00=inline, 01=sender contact card (device-resident lookup), 10=Activity profile, 11=hybrid.
- **Contact-resident display mode (OQ-25)** — Only identifier travels in URL. Receiver's device fills all data from local contacts on match. ~15–20 byte payload. Ultra-private: no sender info visible to interceptor without the matching contact.
- **Structured JS in payload (OQ-26)** — Constrained JS/DSL for custom micro-app experiences. Trust-gated: `1pt` (with `allow_js: true`) or `1ps` only. Sandboxed iframe + postMessage API. Inline <1KB; larger scripts use hash-pinned fetch-target. Deferred post-MVP.
- No codec frame changes from this round. All new features are payload-level additions within the `1pb` presentation record schema.

**Logged:** OQ-20 through OQ-26 added to OPEN-QUESTIONS.md (Group 6). CODEC-STATUS.md updated with Presentation Records section.

---

### Round 13 — 2026-05-15 — Type Picker Clarification, Activity on Home Screen, Service Catalog, OQ-27

**Questions asked / topics raised:**
- What should a new user see when they first open the app — how do they quickly set up an activity and start working?
- The "A" (Activity) icon lives only in the sidebar — should it be a first-class filter on the home screen?
- Are the current type picker entries (Job/Quote/Invoice/Receipt/Business) truly different templates or field selections within one?
- What are the codec implications of a service catalog with standard prices?
- Does `activityId` need to travel in the wire format?

**Decisions / design:**

**Type picker clarification (codec-relevant):**
- Current `TEMPLATE_TYPES` conflates template type (structural) and transaction byte (financial event).
- Job/Quote/Invoice/Receipt are all Financial record (template 001) with different transaction bytes — `I>I` sub=00/01, `I<I` sub=00. Not different templates.
- `Business` / `newent` is a genuine outlier — Contact/entity template (011) — should exit the shared type picker and live in its own flow.
- The wizard's type selector should be reframed as a transaction type selector, mapping directly to the pads-v1 transaction byte.

**Activity on the home screen:**
- Activity selector moved to a persistent row at the top of the main list — `◆ Activity name ▸` — replacing sidebar-only access.
- D-pad right opens activity picker (all activities + "All activities"). If only one activity: still shown, right creates a second.
- Replaces sidebar as primary activity switcher; sidebar remains as secondary.

**Empty state / first-launch flow:**
- Blank list replaced by a guided empty state: "Add Activity" prompt → one-screen activity creator (name + optional services) → then record creation in context.
- "Add Activity" entry point on empty state and accessible from the activity row itself.

**Service catalog:**
- Services with standard prices stored at Activity level (app data only) — no codec involvement for the record-creation flow.
- Service menu shared as a `#1pb/` presentation record (OQ-20–24) for the "advertisement for new customers" use case.
- No new codec record type needed for MVP.

**OQ-27 — Activity group membership in wire format:**
- `activityId` is currently app-only.
- MVP: IS_ORG participant in participants block covers sender business identity.
- Post-MVP: Activity UID as a compact FLAGS3/FLAGS4 reference, paired with pre-shared Activity `#1pb/` contact card (aligns with OQ-25 contact-resident mode).

**Logged:** OQ-27 added to OPEN-QUESTIONS.md. CODEC-STATUS.md updated with type picker clarification and OQ-27 summary.

---

### Round 14 — 2026-05-15 — Service Units, Job Charge/Cost Labels, Service Menu Advertisement

**Topics:**
- Services need a unit (per job, per hour, per item, per day, per km, per sqft, custom)
- "Job charge" and "job cost" labels should be retained in UI
- Service menu shared as `#1pb/` advertisement

**Codec connections confirmed:**
- Service unit → QTY_SPLIT (transaction byte) + qty_unit field (FLAGS3 bit 3). Unit=`job` → QTY_SPLIT=0 (lump sum), no qty_unit. Unit=`hour`/`item`/etc. → QTY_SPLIT=1, qty_unit carries the label. No new codec fields.
- `category:'charge'` → fin_control EXPENSE_CATEGORY=00, BILLED=1. `category:'cost'` → EXPENSE_CATEGORY=01, BILLED=0. "Job charge" / "job cost" retained as UI labels for these values throughout.
- Service menu advertisement → `#1pb/` with COMPOUND_VALUE=1 financial block. Each service = compound line item (name + amount + optional qty_unit). IS_ORG participant carries business name + phone. ~60–70 bytes deflated. No new block type.

**Rapid job entry flow** (≤10 key presses): Home → New → Activity pre-selected → Pick service (list) → Customer → Amount/Qty (pre-filled) → Send.

---

### Round 15 — 2026-05-15 — Service Templates with Cost Lines and qty_link Logic

**Topic:** A service template extends beyond name+price+unit to include optional pre-associated cost lines (job costs/COGS), each with their own unit, rate, and qty derivation logic.

**qty_link:** `billing` (same qty as charge, auto), `fixed` (always stored amount, auto), `enter` (worker enters qty at job time), `enter_rate` (worker enters rate, qty from billing).

**Key design point:** Billing unit and cost unit can differ independently. Example: "Electrical inspection" charged `per job` (£120 flat) but internal labour tracked `per hour` (£15/hr, qty_link=enter). Worker enters hours once; charge record (lump sum) and cost record (qty×rate) generated separately.

**Codec:** Each cost line → standard child Financial record with `O<O`/`O>O` transaction byte, BILLED=0. No new wire format constructs. Service template logic is app-side only.

**OQ-28 identified:** `service_ref` field — reference from a record back to its originating service template. Already anticipated in 1eg/ bit 18. Needs FLAGS3/FLAGS4 slot decision in pads-v1.

---

### Round 16 — 2026-05-15 — Wizard Flow for Services with Cost Lines

**Topic:** Step-by-step wizard prompt flow when a service template has associated cost lines.

**Three scenarios:**
- **Scenario A (billing-linked costs):** One qty input (e.g. hours) drives both charge and all `billing`-linked costs. Live margin preview on step 2. Worker enters hours once; everything derives. Review screen shows all lines with toggleable status.
- **Scenario B (enter costs):** Fixed charge + separate cost qty entry. Step 2 splits into "customer side" (charge + paid/invoice toggle) and "your costs" section (enter/fixed lines + per-line paid/pending). Margin shown.
- **Scenario C (no costs):** Single screen — customer + amount + paid/invoice toggle + Send. Fast path; no review step.

**Per-line status toggle → transaction byte:**
- Charge Paid now → `I<I`; Invoice → `I>I`
- Cost Paid now → `O<O`; Pending → `O>O`

**RECIPIENT_TYPE distinction:**
- Charge records: RECIPIENT_TYPE=0 (customer-facing) — shared as URL
- Cost records: RECIPIENT_TYPE=1 (colleague-facing) — local/employer only; never in customer-facing URL
- "Send invoice" button generates URL for charge record only. Cost records saved locally.

**Review screen controls:** Per-line paid/pending toggle + skip (removes from this job, not template) + ad-hoc "Add cost" for unplanned costs.

---

### Round 17 — 2026-05-15 — Multi-Worker Pay Rates

**Topic:** Multiple workers at different pay rates per activity, service, and role. Contact linkage optional — roster works with names only; contacts enrich participant blocks but gate nothing.

**Three layers:**
1. **Worker roster per activity** — names + roles + optional contactId. Stored in activity config, not wire format.
2. **Rate table** — per-worker×service override → per-worker activity default → per-role fallback. Resolution at wizard time; resolved rate pre-fills the cost line.
3. **Multi-worker wizard step** — one row per roster member relevant to this job; hours entry + paid/pending toggle + skip per row. Running margin preview. "+ Add worker" for ad-hoc workers not in roster.

**Owner time:** defaults to not logged; optional "Log my hours" creates a cost record with IS_SENDER=1 participant, RECIPIENT_TYPE=1. Gives true cost-inclusive margin without affecting customer-facing records.

**Codec:** Each worker's pay → separate child Financial record (001), `O<O`/`O>O`, BILLED=0, RECIPIENT_TYPE=1, fin_control EXPENSE_CATEGORY=01. Participant block carries worker name + role (+ phone/email if contact linked). `worker_amount` (fin_flags bit 7) still useful for sole-trader single-record pattern but multi-worker uses separate child records. No new codec fields.

---

### Round 18 — 2026-05-15 — Service Default Workers vs Fresh Record

**Topic:** Service templates can optionally pre-associate default workers. When used in a job, the multi-worker step is pre-populated with those workers and their resolved rates. Services with no defaultWorkers use "fresh" mode — activity roster shown as a pick list.

**Key rule:** Rate is never stored in the service's defaultWorkers list — always resolved from the rate table at job time. Rate changes propagate to future jobs automatically.

**Role-only defaults:** `workerId: null, role: 'Technician'` — wizard resolves to the only roster member with that role, or opens a picker if multiple qualify. Makes services portable across activities.

**Overrides at job time:** `[✕]` removes a pre-filled worker from this job only (template unchanged); rate editable inline for this job only; `[+ Add worker]` for ad-hoc additions.

**Codec impact:** None. Generated child records are identical regardless of how workers were pre-populated.

---

### Round 19 — 2026-05-15 — Taxing and Benefits per Worker, Inheritance Model

**Topic:** Pay deductions and employer costs configured globally, inherited by activity (with overrides/additions/removals), then by individual worker. Three-level inheritance: global → activity → worker.

**Deduction types:** `pct` (percentage of base), `flat_per_job`, `flat_per_unit`, `flat_per_period`, `progressive` (tax bands), `threshold` (only above a floor amount). Each item is `side: 'employee'` (reduces take-home) or `side: 'employer'` (adds to employer cost, does not reduce worker net pay). Base can be `gross`, `taxable` (post pre-tax deductions), or `net`.

**Calculation flow:** gross → pre-tax deductions (pension) → taxable → tax + NI → net (worker_amount). Employer NI + employer pension added on top → total employer cost = primary record amount.

**Three activity pay modes:**
- `Off` — no deductions; single amount only (teenager / cash-in-hand)
- `Simple` — gross + net (`worker_amount`); no itemised breakdown
- `Full` — COMPOUND_VALUE=1 with typed line items; formal payroll

**Codec — existing:** `worker_amount` (fin_flags bit 7) carries net take-home. Record primary amount = total employer cost (P&L). COMPOUND_VALUE=1 for Full mode itemisation.

**OQ-29 identified:** Compound line item type flag. Currently compound lines are name + amount only. Full payroll mode needs a 2-bit `line_type` distinguishing gross pay / employee deduction / employer addition / summary. Potential codec extension to the compound line item structure.

---

### Round 20 — 2026-05-15 — Pay Config Framing: No Upfront Tax Emphasis

**Correction to Round 19 framing:** Activity setup and worker roster setup have no pay deduction fields at all. Tax and deductions are opt-in, accessed only through a quiet secondary "Pay settings" section — not part of any setup wizard or onboarding flow.

**Default: pay mode = Off.** Worker cost records show one amount (gross). No deduction fields, no tax references anywhere in the primary flow.

**Progression:** Simple mode ("Track net pay") → worker activates in Pay settings when needed. Full mode ("Full pay breakdown") → further opt-in. UI copy avoids "tax" and "deductions" outside of Full mode context.

**Activity setup flow:** Name → Services → Workers (name + rate only) → Done. Pay settings appear as a quiet secondary item in the activity editor only after initial setup.

**Wizard for cost lines:** shows gross amounts only. "Show breakdown" softkey reveals deduction detail if Full mode is active — never the default view.

**Codec unchanged.** The three-level inheritance model and Full mode COMPOUND_VALUE=1 records remain as designed; they're just never surfaced unless opted into.

---

### Round 21 — 2026-05-15 — Per-Job Tax Mode and Per-Line Tax Treatment

**Per-worker mode type per job:** Already supported at codec level — each child cost record has independent DOMAIN bits. Wizard just needs to expose the selection per worker row. [Gross ▾] / [Net ▾] / [Full ▾] badge per worker row, overriding activity default for this job.

**Per-charged-item tax treatment:** Codec gap identified. Current TAX_CODE in setup_byte applies to the whole record — cannot handle compound records with mixed tax rates (e.g. labour exempt + materials 20%). Solution: compound line flags byte (OQ-29 expanded).

**Compound line flags byte (OQ-29 revised):**
```
bits 7–6: LINE_TYPE   00=standard, 01=deduction, 10=employer-add, 11=summary
bits 5–4: TAX_MODE    00=inherit record TAX_CODE, 01=standard, 10=reduced, 11=zero/exempt
bit 3:    QTY_LINE    1=qty×rate fields follow this line's amount
bits 2–0: reserved
```
`LINE_FLAGS_PRESENT` bit added to compound block header. Backward compatible — absent = all lines are name+amount only (current behaviour). TAX_MODE=00 (inherit) keeps common-case lines lean.

**QTY_LINE (also new):** Allows individual compound line items to carry their own qty and rate — handles mixed fixed-price + time-and-materials lines in a single compound record.

**Service template tax annotation:** Each service carries a default `tax_treatment` field. Pre-sets the line badge in the wizard. Worker rarely needs to touch it.

**Wizard:** Per-line tax badge `[Tax: 20% ▾]` cycles Inherit/Standard/Reduced/Exempt. Live tax subtotal and total shown. Hidden for single-line uniform-tax jobs.

---

### Round 22 — 2026-05-15 — Tax Default "--", No Silent Inheritance, Column Collapse

**Correction to Round 21:** TAX_MODE=00 is not "inherit record default" — it is "--" (not applicable). No line ever has tax applied silently. Every tax treatment is an explicit user choice.

**setup_byte TAX_CODE reframed:** Defines available rates (standard/reduced) for this record's context. Does not apply to any line by default. TAX_CODE=00 = no tax on this record.

**UI column collapse:** Tax column/section hidden when all lines are "--". Appears only when at least one line has an explicit treatment (01/10/11). Lines showing "--" render nothing in the tax cell. This applies to both wizard and record view.

**Codec:** TAX_MODE=00 → "--" (none). LINE_FLAGS_PRESENT only set when at least one line has a non-default flag — absent = name+amount only, minimal overhead.

---

### Round 23 — 2026-05-15 — Service Tax Default Toggle

**Addition:** Service templates carry a `tax_default` field (`'--'` | `'standard'` | `'reduced'` | `'exempt'`). Default for all new services is `'--'`. When set, jobs using that service pre-populate the line's tax treatment accordingly. Worker can still override at job time. Ad-hoc lines (no service) always start `--`.

**Codec:** None. `tax_default` is service config only — pre-populates the wizard. Wire format TAX_MODE carries the final confirmed value.

---

### Round 24 — 2026-05-15 — Contact Multi-Role Model and Per-Contact Aggregation

**Principle:** Contacts are role-agnostic. Role is a per-record attribute derived from `ROLE_TYPE` in the participants block. Same person can be customer, worker, supplier, and subcontractor across different records. No contact is locked to one role. Contact picker has no role restriction.

**Contact detail screen:** Multi-role dashboard. Sections shown only when data exists: Customer (invoiced/received/outstanding), Worker (jobs/hours/gross/net pay), Supplier (spend). Each section has a "View records" drill-down. Period filter per section (this week/month/year/all time).

**Worker aggregation from records:** jobs worked (count of distinct parent IDs), hours (sum of qty from QTY_SPLIT=1 cost records where contact is participant), gross pay (sum of cost record amounts), net pay (sum of worker_amount where present), grouped by activity and period.

**Contact linking:** phone/email match from participants block to stored contact. Roster workers without contactId match on name within activity. "Link to contact" upgrades to phone/email match.

**Codec:** No new fields. All aggregation sources are already in the wire format: ROLE_TYPE (participants block), qty (QTY_SPLIT=1), worker_amount (fin_flags bit 7), BILLED, EXPENSE_CATEGORY, COMPACT_TIME.

---

### Round 25 — 2026-05-15 — Per-Job Share Sheet, Confirmation/Correction, Simple IDs, Shareable Reports

**Per-job share sheet:** One row per participant, each generates the appropriate record URL (customer → charge record; worker → their cost/pay record only). Workers don't see each other's records or the customer charge amount. "Share all" bundles links for a group message. QR alternative for in-person sharing.

**Confirmation:** ACK_REQUEST (meta1 bit 2, already in spec). Recipient sees "Confirm receipt" action; ACK URL returned to sender.

**Correction:** Amendment record (template 0xE, already in spec). Recipient taps "Correct", edits disputable fields (date/description/amount), app generates Amendment with only changed fields + flag mask. ~10–20 bytes. Sender reviews and accepts or declines.

**Simple IDs:** Short codes auto-assigned per activity (C01/W01/V01). Two uses: (1) `ref_number` field on records for human filing reference; (2) compact participant identifier for URLs (OQ-25 contact-resident mode). Cross-device registered IDs = OQ-30 (post-MVP).

**Shareable period report:** Contact + period filter → `#1pb/` presentation record. COMPOUND_VALUE=1, one compound line per record in period, summary lines (LINE_TYPE=11), QTY_LINE=1 for worker hours. Customer statement and worker pay summary both use this pattern.

**`date_end` field identified:** Period reports need a second date (period end). No current FLAGS3 slot assigned. Needs STANDARD-FIELDS.md update — add `date_end` to FLAGS3.

**OQ-30 flagged:** Cross-device registered short IDs (global resolution of worker/customer short codes across different app installations). Post-MVP.

---

### Round 26 — 2026-05-15 — Customer View Levels, Field-Level Correction, Two-Tier ID System

**Customer view levels (Simple/Standard/Detailed):** At share time, sender picks presentation level. Stored record is always complete. Shared payload is re-encoded: Simple = flattened single-line (amount + description only); Standard = compound with BILLED=1 lines only (default); Detailed = full compound with qty×rate and tax. BILLED=0 cost lines never appear in any customer payload at any level.

**Field-level correction — hours and rate:** Second tap on a field in the correction view unlocks just that field. Amendment record (template 0xE) carries `line_index` byte (which compound line was corrected) + only the changed fields (qty and/or rate). Total recalculated by receiving app from corrected qty × rate. `line_index` is a new required field on compound-record Amendments.

**Two-tier ID system:**
- Tier 1 — App-global contact ID: sequential integer (`001`, `002`...) assigned once per contact regardless of role. Used for cross-activity aggregation and contact dashboard.
- Tier 2 — Activity alias: optional per-activity reference (`AH-2023`, customer's own account number). Overrides global ID on that activity's records. Absent = global ID used.
- Cross-device: phone number remains canonical wire identifier. Short IDs are UI conveniences only (OQ-30 for future global registration).
- Wire format: `ref_number` field carries the active ID (alias if set, global ID otherwise). No new codec field.

**Codec addition: `line_index` on Amendment records.** Specifies which compound line item was corrected. Needed before Amendment + compound record correction can work.

---

### Round 27 — 2026-05-15 — Template Catalogue, KaiOS Correction Comparison, No-Phone Identifier

**Template catalogue:** Created `TEMPLATE-CATALOGUE.md` — 39 must-have templates across 10 groups, 25 nice-to-haves. Groups A–H are core (financial, compound, period reports, contact, presentation, form, state commit, amendment). Group I covers sector/domain extensions. Group J covers template infrastructure.

**KaiOS correction comparison — inline highlight view:**
Small screen + D-pad makes side-by-side impractical. Best approach: single view, changed fields marked with ● indicator:
```
● Hours:   3.0 hr  (was 3.5)
  Rate:    £45/hr
● Total:   £135.00 (was £157.50)
  Date:    14 May
```
D-pad navigates to ● rows. Centre expands to show detail. Softkeys: [Accept all] [Reject] [Counter]. Field-level accept via centre key on a ● row. Counter opens correction editor pre-filled with the proposed value (worker can adjust further before sending back).

**No-phone-number identifier — alt_id in participants block:**
Many African users lack stable phone numbers (SIM-swapping, feature phones, informal traders with trade names only). Participants block extended with `alt_id` — a flexible secondary identifier field:
- `app_uid` — device-bound app-generated UID, shared via QR/NFC during contact exchange. Stable across SIM changes.
- `trade_name` — market/trading name ("Mama Fatou's Kitchen", "Kofi Electronics"). Often more stable than personal phone.
- `national_id` — optional, opaque, user-decides-to-share. Ghana Card, NIN, etc.
- `location_label` — short freetext location ("Adjamé Market Stall 12"). Contextual identifier.

Wire format: `alt_id` is a new field in the participants block — type byte (1=app_uid, 2=trade_name, 3=national_id, 4=location_label) + text_compact value. Multiple alt_id entries allowed per participant (chained). Phone and email remain present when available; `alt_id` supplements or replaces when absent.

Match logic (contact resolution): phone → email → app_uid → trade_name+location composite. First match wins. Fuzzy matching on trade_name within a geographic context.

**Codec addition: `alt_id` in participants block.** Needs new part_flags bit + type byte + text_compact value. OQ-31 to design the encoding.

---

## 6. Open Questions

| # | Question | Round | Status |
|---|----------|-------|--------|
| Q1 | Frame architecture: properly evaluate BitPads v2 frame structure vs pads-v2 meta bytes vs evolved `1eg/` flat header — URL prefix stays, internal frame is under evaluation | 2 | Open — see Q7 below |
| Q2a | Balance sheet events in workpads records? | 1 | **Settled → D1** |
| Q2b | BILLED flag location in wire format | 2 | **Settled → D5** |
| Q2c | Simple vs Standard mode — UI method and wire signal | 2 | **Settled → D6** |
| Q3 | Template scalability — presentation vs domain data fields | 1 | **Settled → D2** |
| Q4/Q6 | Amount encoding: tiers, scale, African market requirement | 2 | **Settled → D7** |
| Q5 | Standard update strategy | 1 | **Settled → D3** |
| Q7 | Meta1 restructure — see Round 3 analysis | 3 | **Settled → D8** |
| Q8 | Child records: each financial entry is its own record. How do child records stay standalone-shareable without duplicating parent data, and without losing intelligibility when viewed without the parent? | 3 | **Settled → D9** |
| Q9 | Variant template first-use resolution — in-frame URI vs graceful degradation | 3 | **Settled → D10** |
| Q10 | Currency encoding | 4 | **Settled → D12** |
| Q11 | Field flags scalability for domain templates | 4 | Partially settled — FLAGS3 infrastructure exists (7 reserved slots + chaining); slot assignment to be designed in standard fields planning session |
| Q12 | fin_flags and BILLED flag | 4 | **Settled → D14** |
| Q13 | SELF_DESCRIBING flag and canonical field registry | 4 | **Settled in principle → D11** — field registry design deferred to standard fields planning session |
| Q14 | Transaction byte subtypes for I<O, I>O, O<I, O>I (4 states currently reserved) | 5 | Open — defer to standard fields planning session |
| Q15 | Standard fields planning | dedicated session | Open — canonical field set + synonym/relabeling system; compose-from-fields approach for domain templates |
| Q16 | IS_ORG flag in participants part_flags bit 0 | 4 | **Settled → D13** |

---

## 7. Target Codec Sketch

_Not yet started. Will be populated as decisions land from Round 1 onwards._

```
[ Evolved workpads codec frame — target architecture ]
TBD pending Round 1 decisions
```

---

## 8. Sync Obligations

When decisions land, the following repos require updates:

| Repo | What changes | Triggered by |
|------|-------------|-------------|
| `workpadskaios/js/codec.js` | Encoder/decoder implementation | T1, T4 decisions |
| `workpads-standard/codec.md` | Standard doc update | T5 decision |
| `workpads-standard/pads-v2-encoding-spec.md` | Yardstick doc update | Any deviation from current spec |
| `workpads-standard/transaction-classification.md` | If T2 extends beyond 8-state | T2a decision |
| `workpads-standard/financial-block.md` | If BILLED flag or mode bits change the fin block | T2b/T2c decision |
| `workpadskaios/js/screens/wizard.js` | UI — expense entry flow redesign | T2b decision |
| `workpadskaios/js/screens/ledger.js` | BILLED flag encoding on child records | T2b decision |
