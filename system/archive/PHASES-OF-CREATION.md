# Phases of Creation

**Status:** active planning doc — 2026-05-17  
**Purpose:** Divides all implementation work into ordered coding rounds. Each round is a coherent unit of work that ends with something demonstrable. Rounds build on each other — do not skip ahead.  
**Companion docs:** FRAME-SPEC.md (encoding brief), ROADMAP.md (version targets), PRODUCTION-READINESS.md (file-level tasks), OPEN-QUESTIONS.md (blockers), STANDARD-UPDATES.md (standard obligations)

---

## How to Use This Document

Each round has:
- **Purpose** — what capability this round unlocks
- **Key questions** — what must be answered / demonstrable to call the round complete
- **Spec refs** — which design docs govern this round
- **Deliverables** — what gets written, changed, or created
- **CLI check** — what to run to verify

Rounds are not calendar sprints. A round is done when its key questions are all answered. Some rounds will take an afternoon; some will take a week.

**Current position:** All spec work is at draft-spec or above. Codec.js has not yet been rewritten for pads-v1. Round 1 is the starting point.

---

## Round 1 — Codec Core: Header + Field Flags + Text Fields

**Purpose:** Replace the `1eg/` (codebook-c-kaios) codec with pads-v1 (`1pa`) encoder/decoder. Establish the foundational binary pipeline that every subsequent round builds on. After this round a simple service note can be encoded and decoded correctly.

**Key questions:**
- Can we encode a `meta1` byte for each BASE_TEMPLATE type (000–111) correctly?
- Can we encode/decode `meta2` with all 8 flag bits?
- Do `field_flags` (16-bit) + `field_flags3` (8-bit) + `field_flags4` (8-bit) encode and decode in correct bit order?
- Do all text data blocks encode as `[uint16 BE len][UTF-8]` or `[uint8 len][UTF-8]` per their field type?
- Do `COMPACT_TIME` dates encode as `uint16 days since 2000-01-01` and times as `uint16 minutes`?
- Does the full encode→deflate→base64url→`#1pa/<fragment>` pipeline produce valid URLs?
- Does the inverse decode pipeline reconstruct the original record object?
- Do the three codebook copies (kaios codec.js, dotme codec.js, npm package) all pass the same round-trip test?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §1 (Encoding Envelope), §2 (meta1, meta2, field_flags, field_flags3, field_flags4, data blocks)
- `dev_refs/TECH-REFERENCE.md` (BASE_TEMPLATE codes, COMPACT_TIME epoch, field_flags bit assignments)
- `dev_refs/STANDARD-FIELDS.md` (canonical field names, encoding type per field)
- `dev_daily/CODEC-SYNC.md` (three-repo obligation)

**Deliverables:**
- `js/lib/codec.js` — new pads-v1 encoder/decoder (ES5, replaces 1eg/ entirely)
- `workpads-standard/codec.md` — updated to pads-v1 / `1pa` codebook (SUI-001)
- `dev_daily/DEVIATIONS.md` — close DEV-WP-URL-001; confirm no new deviations

**CLI check:**
```
workpads-cli encode --template service --job "Boiler repair" --date 2026-05-17
  → produces #1pa/ URL
workpads-cli decode <url>
  → reconstructs record with correct fields
workpads-cli roundtrip --profile A   (Profile A from FRAME-SPEC §4)
workpads-cli roundtrip --profile E   (Profile E — minimal viable record)
```

---

## Round 2 — Financial Block: Amounts, Tax, Scaling, DOMAIN Modes

**Purpose:** Add the money layer. After this round a real invoice, expense, or payment can be encoded with correct amounts, currency, tax, and I>O classification. This is the core value proposition of the format.

**Key questions:**
- Does `setup_byte` encode DECIMAL_POS, CURRENCY, TAX_CODE, SF_PRESENT correctly?
- Does `sf_byte` encode SCALING_FACTOR, COMPOUND_VALUE, QTY_COMPACT, SPLIT_POINT?
- Does `transaction_byte` encode DOMAIN=01 (I>O: DIRECTION, TIME, EFFECT, SUBTYPE, QTY_SPLIT, ROUNDING) correctly for all 8 I>O states?
- Does `DOMAIN=10` transaction_byte encode ACCOUNT_PAIR + DIRECTION + STATUS + QTY_SPLIT + ROUNDING?
- Does `fin_control` (DOMAIN=01) encode BILLED, QTY_TYPE, PARITY, EXPENSE_CAT, CUSTOMER_AMT, WORKER_AMT? Does the parity bit calculate correctly? Do all 4 integrity checks pass on decode?
- Do `customer_amount` and `worker_amount` encode as `uint24 BE`? Does QTY_COMPACT packing (qty+rate in 3 bytes) work for the common cases?
- Does QTY_TIME encoding (hours + minutes_index) encode/decode correctly?
- Does `tax_block` encode tax rate in permille + uint16 tax amount?
- Does `qty_rate_block` (separate 6-byte qty+rate) encode correctly for QTY_COMPACT=0?
- Does DECIMAL_POS=111 (flat uint24 backup mode) encode/decode as smallest-currency-unit integers?
- Can we roundtrip Profiles B, C, D from FRAME-SPEC §4?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §2 (setup_byte through fin_control, amounts, tax, qty_rate)
- `dev_refs/FRAME-SPEC.md` §3 (I>O subtype table, all 32 combinations)
- `dev_refs/FRAME-SPEC.md` §4 (Profiles B, C, D)
- `dev_refs/TECH-REFERENCE.md` (DOMAIN modes, I>O matrix, Account Pair codes, DECIMAL_POS, SCALING_FACTOR, SPLIT_POINT table)
- `CODEC-EVOLUTION.md` CODEC-1/2 (BitLedger amount encoding, flat uint24 signal)
- `workpads-standard/financial-block.md`, `workpads-standard/transaction-classification.md`

**Deliverables:**
- `js/lib/codec.js` — financial block encode/decode complete
- `workpads-standard/financial-block.md` — updated for pads-v1 fin_control layout (SUI-005)
- `workpads-standard/transaction-classification.md` — entry type matching table added (SUI-008)
- CODEC-SYNC.md run; dotme codec.js synced for financial block

**CLI check:**
```
workpads-cli roundtrip --profile B   (payment received £125.50)
workpads-cli roundtrip --profile C   (T&M invoice 3h @ £45)
workpads-cli roundtrip --profile D   (invoice + 2 participants)
workpads-cli encode --type expense --amount 45.00 --expense-cat running-cost
workpads-cli decode <url> --show-financial
```

---

## Round 3 — DOMAIN=11 Hybrid Mode + Financial UI Screens

**Purpose:** Attach the BitLedger accounting layer to every financial record without burdening the worker. After this round the app can display accounting detail for any record, and the entry wizard enforces the deterministic Account Pair matching table.

**Key questions:**
- Does `account_pair_byte` encode ACCOUNT_PAIR (4-bit), AP_DIRECTION, AP_STATUS, AP_COMPLETENESS, AP_EXTENSION?
- Does the Entry Type Matching Table from FRAME-SPEC §17.5 map all 24 wizard entry types to the correct Account Pair + AP_DIRECTION deterministically?
- Does type-change reconciliation (§17.6, 4-step cascade) preserve worker amounts through all direction/settlement/category changes?
- Does the "Show accounting detail" toggle derive correct plain-English Debit/Credit labels from the §17.7 lookup table?
- Can the wizard present: Invoice / Cash sale / Payment received / Refund / Running cost / Job cost / Job charge — as distinct entry flows with correct fin_control EXPENSE_CAT and BILLED flag?
- Does switching entry type mid-wizard trigger the right reconciliation step without silently discarding amounts?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §17 (DOMAIN=11, account_pair_byte, §17.1–17.7)
- `dev_refs/TECH-REFERENCE.md` (Account Pair codes, AP_DIRECTION)
- `CODEC-EVOLUTION.md` T2 (three-category expense problem)

**Deliverables:**
- `js/lib/codec.js` — DOMAIN=11 account_pair_byte encode/decode
- `js/screens/financial.js` and wizard entry flow — DOMAIN=11 UI (accounting detail toggle, entry type matching, type-change reconciliation)
- `workpads-standard/transaction-classification.md` — entry type matching table + type-change rules (SUI-008, part 2)
- `workpads-standard/STANDARD-UPDATES.md` — SUI-004 and SUI-005 marked done

**CLI check:**
```
workpads-cli encode --entry-type invoice --amount 200.00
  → account_pair_byte = 0x50 (0101 + AP_DIR=0)
workpads-cli decode <url> --show-accounting
  → "Debit: Assets (Receivable) / Credit: Income (Operating)"
workpads-cli roundtrip --entry-type running-cost-cash
workpads-cli roundtrip --entry-type job-charge
```

---

## Round 4 — Participants Block + Role Codebook

**Purpose:** Records become properly multi-party documents. Named sender, named customer, named worker, subcontractors — all with typed roles, phone/email, and alt_id for no-phone users. After this round a record can carry a full party list and decode it correctly on any client.

**Key questions:**
- Does `block_header` (count bits 7-5) encode the participant count correctly?
- Does `part_flags` (IS_SENDER, ROLE_TYPE 2-bit, HAS_ALT_ID, HAS_PHONE, HAS_EMAIL, HAS_ROLE_TEXT, IS_ORG) encode all combinations?
- Do the 2-bit quick-select roles (Customer/Worker/Supplier/Extended) decode correctly? Does the ROLE_TYPE=11 path correctly branch to role_code (1 or 2 bytes) or role_text?
- Does the 1-byte role_code cover the 16 groups (Management, Finance, Legal, Services, etc.) from ROLE-CODEBOOK.md?
- Does the 2-byte extended role_code path work for specialist roles?
- Does HAS_TRADING_NAME encode the trading_name field separately from the personal name?
- Does `alt_id_type` (app_uid / trade_name / national_id / location_label) encode/decode correctly?
- Does Profile D (2-participant invoice) roundtrip correctly at the target byte count?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §2 (participants block), §13 (alt_id)
- `dev_refs/ROLE-CODEBOOK.md` v1.1 (all groups, signal flags, 2-byte extended)
- `workpads-standard/participants-block.md` (older design — note ROLE_TYPE is 2-bit in kaios, 3-bit in standard; SUI-003)

**Deliverables:**
- `js/lib/codec.js` — participants block encode/decode + full role codebook
- `workpads-standard/participants-block.md` — updated to 2-bit ROLE_TYPE + 240 extended codes + alt_id (SUI-003)
- `workpads-standard/STANDARD-UPDATES.md` — SUI-003 marked done

**CLI check:**
```
workpads-cli roundtrip --profile D
workpads-cli encode --participants "sender:Worker,customer:phone+447700900000"
workpads-cli decode <url> --show-participants
workpads-cli encode --role-code 0x34  (specific 1-byte code)
workpads-cli encode --alt-id-type trade_name --alt-id "Kigali Stall 7B"
```

---

## Round 5 — Chain Protocol: State Commit + Amendment

**Purpose:** Records can reference each other. A quote chains to an invoice chains to a payment. Jobs close. Invoices are settled. Disputes are filed. After this round a full job lifecycle — quote → invoice → payment → job close — can be represented as a chain of linked pads-v1 records.

**Key questions:**
- Does ACK_REQUEST (meta1 bit 2) + CHAIN (meta1 bit 1) encode correctly?
- Does `state_commit` byte encode COMMIT_TYPE (00/01/10/11), PERIOD_TYPE, CHAIN_COMPLETE, DISPUTE_FLAG?
- Does `sc_fin_summary` (total_amount, line_count, optional fingerprint) encode correctly?
- Does the guest viewer confirmation signature block encode (device_fingerprint + confirm_timestamp + confirm_flag + identity_anchor)?
- Does `amendment_header` (CHANGED_MASK_1 + CHANGED_MASK_2) identify changed fields correctly?
- Does `changed_mask_3` work for FLAGS3 field changes?
- Does `amendment_flags` byte (HAS_PARENT_UID + DISPUTE_LINK) encode?
- Does 8-byte `parent_uid` (SHA-256(parent_frame_bytes)[0:8]) compute and embed correctly?
- Does `line_index` work for compound-record amendments?
- Can a DISPUTE_LINK amendment (DISPUTE_FLAG=1 + HAS_PARENT_UID=1) roundtrip and be identified as a dispute record?
- Does the chain URL suffix (`&c=<chainRef>`) attach correctly to share URLs?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §9 (State Commit), §10 (Amendment)
- `workpads-standard/chain-protocol.md` (24-bit composite chain ID, anchor generation, sequence)

**Deliverables:**
- `js/lib/codec.js` — state_commit block, amendment block, chain URL suffix
- `js/services/RecordService.js` — chainRef generation, chain linking, getChain()
- `workpads-standard/chain-protocol.md` — agreement chain extension + COMMIT_TYPE values added (SUI-018)

**CLI check:**
```
workpads-cli encode --type invoice --amount 200 --ack-request
workpads-cli encode --type state-commit --commit-type payment-confirmed --amount 200 --chain <parent-url>
workpads-cli decode <state-commit-url> --show-chain
workpads-cli encode --type amendment --change amount=250 --parent <original-url>
workpads-cli chain-verify <url>   (checks full chain integrity)
```

---

## Round 6 — Compound Block: Multi-Line Records + Payroll

**Purpose:** Single-transaction records grow into multi-line invoices, payslips, and period reports. After this round a full itemised invoice or a payroll record with gross/deductions/net can be encoded and displayed correctly.

**Key questions:**
- Does `compound_header` (LINE_COUNT 5-bit, LINE_FLAGS_PRESENT, HAS_TOTAL_SUMMARY, HAS_SUBTOTALS) encode correctly?
- Does `compound_line_flags` (LINE_TYPE 2-bit: standard/deduction/employer-add/summary, TAX_MODE 2-bit, QTY_LINE) encode for each line?
- Does `line_name` (compact [uint8 len][UTF-8]) encode per line?
- Does `line_amount` (uint24) encode with correct SF and DECIMAL_POS?
- Do `line_qty` + `line_rate` (uint24 each) encode for QTY_LINE=1 lines?
- Does the payroll LINE_TYPE model (00=gross, 01=deduction, 10=employer-add, 11=summary) roundtrip through encode/decode with correct display semantics?
- Does TAX_MODE=00 render as `--` (not-applicable) and the tax column hide when all lines are `--`?
- Does COMPOUND_VALUE=1 in sf_byte correctly gate the compound block?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §8 (Compound Block: §8.1 header, §8.2 line structure)

**Deliverables:**
- `js/lib/codec.js` — compound block encode/decode
- `js/screens/financial.js` — compound line item UI (add/edit/remove lines; qty×rate entry; tax mode per line)
- Payslip compound record encode/decode roundtrip

**CLI check:**
```
workpads-cli encode --type compound-invoice --lines "Parts:50.00,Labour:3h@45"
workpads-cli encode --type payslip --gross 2000 --deductions "Tax:300,NI:150" --net 1550
workpads-cli decode <url> --show-lines
workpads-cli roundtrip --type compound --line-count 5
```

---

## Round 7 — Security Wrapper: Encryption + Key Derivation

**Purpose:** Records become private. A financial record shared between colleagues is encrypted; only the named recipient can read it. Template-keyed records require the template to decrypt. After this round the `#1ps/`, `#1ph/`, and `#1pt/` URL tags are functional.

**Key questions:**
- Does key derivation produce `master = SHA-256(passphrase || salt)`, `cipher_key = master[0:16]`, `scramble_seed = master[16:32]` correctly?
- Does field scramble (byte-order permutation of field_flags using scramble_seed[4:8]) encode/decode without data loss?
- Does deflate seed poisoning (non-standard seed from scramble_seed[0:4]) produce unreadable output to a standard decompressor?
- Does AES-CTR 128-bit with `iv = master[0:16]` encrypt/decrypt the frame correctly?
- Does 8-byte HMAC-SHA256 tag (truncated, keyed on cipher_key || receiver_phone_hash) verify correctly after decryption?
- Does the `preamble_byte` (SCRAMBLE/AES/HMAC/SEED_POISON/HKDF_KEY/KEY_HINT) encode all five layer flags?
- Does KEY_HINT (lower 3 bits of cipher_key[0]) allow the receiver to reject wrong keys before attempting full decryption?
- Does per-contact key derivation (device_master_secret + contact_phone_hash → passphrase) produce stable keys across sessions?
- Does template-keyed derivation (SHA-256(template_bytes) → passphrase for `#1pt/`) work with HKDF_KEY=1 and HKDF_KEY=0?
- Does `#1ph/` partial scramble leave meta1/meta2/setup_byte/transaction_byte in clear while encrypting field data?
- Does the URL structure `#1ps/<b64url(salt_4B)>.<b64url(preamble + inner)>` parse and assemble correctly?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §12 (Security Wrapper: §12.1 five layers, §12.2 partial scramble, §12.3 private record convention)
- `dev_refs/TAG-REFERENCE.md` (tag dispatch table, preamble byte)
- `draft_specs/SECURITY-DESIGN.md` (full key derivation and wrapper design)

**Deliverables:**
- `js/lib/security.js` — new module: key derivation, AES-CTR, field scramble, seed poisoning, HMAC, preamble byte
- `js/lib/codec.js` — integrate security wrapper at encode/decode entry points
- `js/services/PersonalService.js` — device_master_secret storage + per-contact key derivation
- `workpads-standard/security-wrapper.md` — new standard doc (SUI-002)
- `workpads-standard/STANDARD-UPDATES.md` — SUI-002 marked done

**CLI check:**
```
workpads-cli encode --type financial --amount 125 --encrypt --passphrase "test"
  → #1ps/ URL
workpads-cli decode <url> --passphrase "test"
  → decrypted record
workpads-cli decode <url> --passphrase "wrong"
  → "KEY_HINT mismatch — wrong passphrase"
workpads-cli encode --type financial --encrypt --partial
  → #1ph/ URL; meta visible before passphrase
workpads-cli decode <url> --show-header   (shows record type before passphrase required)
```

---

## Round 8 — Template System: Schema, Registry, Distribution

**Purpose:** Records become semantically typed beyond BASE_TEMPLATE. A record knows it is an "Electrical Inspection" or a "Site Delivery Note" — not just a "Financial record". Templates drive field labels, formula evaluation, sector-specific defaults, and `#1pt/` encryption keys. After this round a record can carry a template ID, resolve a template from the registry, and render with custom labels.

**Key questions:**
- Does EXT_TEMPLATE encoding (EXT_SIGNAL 001/010/011/100 + domain bytes) encode 1-, 2-, 3-byte and variant template IDs correctly?
- Does the variant CRC namespace (CRC-8 of creator identity + CRC-16 of identity+name+date) generate stable IDs for custom templates?
- Does the canonical serialisation algorithm (sorted keys, no whitespace, SHA-256) produce the same hash for the same template on all platforms?
- Does the template registry (localStorage `wp_template_<id>`) store, retrieve, and version templates correctly?
- Do bundled core templates (~20 types) load at startup without external calls?
- Does the P2P sector template exchange (Data Sync Bundle via #1pa/ URL or QR) install a template from another device?
- Does formula RPN bytecode evaluate correctly? (LOAD_FIELD + LOAD_CONST + ADD/SUB/MUL/DIV + END)
- Does #te/ template-keyed encryption use HKDF_KEY=1 by default and SHA-256 fallback for older templates?
- Does `installTemplate(fragment, { encrypted })` correctly route `#t/` and `#te/` tag fragments?
- Does the FLAGS4 custom field mechanism allocate bits 3–7 for template-defined fields correctly?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §2 (ext_template, field_flags4), §14 (field_flags4 template-defined bits)
- `dev_refs/TAG-REFERENCE.md` (#t/, #te/ routing, #1pm/ marker, preamble HKDF_KEY)
- `draft_specs/TEMPLATE-SYSTEM-DESIGN.md` (full schema spec: §1–15, all 11 decisions)
- `dev_refs/TECH-REFERENCE.md` (EXT_SIGNAL codes, formula bytecode)

**Deliverables:**
- `js/lib/template-registry.js` — template store, install, lookup, version check
- `js/lib/formula.js` — RPN bytecode evaluator
- `js/lib/codec.js` — EXT_TEMPLATE encode/decode + template ID variant type
- Bundled core template JSON files (20 types)
- `workpads-standard/template-system.md` — extended with definition schema + formula encoding + canonical serialisation (SUI-006)
- `workpads-standard/STANDARD-UPDATES.md` — SUI-006 marked done

**CLI check:**
```
workpads-cli template list
  → bundled templates with IDs
workpads-cli template install <template-url>
workpads-cli encode --template electrical-inspection --job "Panel check" --date 2026-05-17
workpads-cli decode <url> --show-template
  → template name + resolved labels
workpads-cli template hash <template.json>
  → canonical SHA-256
```

---

## Round 9 — Presentation Layer: TRIG + Display Schema + Forms

**Purpose:** Records become rich presentations. A shared record can show different content to different audiences (customer vs worker vs public), embed a reply form, or display as a service menu. After this round `#1pb/` and `#1pf/` tags are functional and TRIG bytecode evaluation works client-side.

**Key questions:**
- Does `display_schema` block encode DISPLAY_TYPE (card/list/menu/form-only), DATA_SOURCE, SHOW_PRICE, SHOW_CONTACT, ACCENT_COLOR, DISPLAY_FLAGS2?
- Does `display_flags2` encode FONT_SIZE, LAYOUT_COLS correctly?
- Does `form_schema` block encode SUBMIT_ACTION, REPLY_TEMPLATE, ALLOW_EDIT, REQUIRE_NAME, REQUIRE_PHONE, FORM_FIELDS_FOLLOW?
- Do per-form field definitions (FIELD_TYPE 4-bit + REQUIRED + field label index / custom label) encode all 8 field types?
- Does `trig_block` (trig_len + trig_bytes) encode and the evaluator correctly parse trig_len=0 (default), trig_len=1 (single pattern token), and trig_len 2–20 (full program)?
- Does the TRIG evaluator evaluate all conditions from the CAT 0x1 registry (HAS_APP, KNOWN_CONTACT, CODE_VERIFIED, etc.) against live device state?
- Does TRIG evaluate correctly client-side — never sending the fragment to a server, never executing for bots?
- Does DATA_SOURCE=11 (anonymous/stealth) suppress sender identity and route submissions to blind pickup?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §11 (Presentation Record Blocks: display_schema, form_schema), §13 (TRIG block)
- `dev_daily/TRIG-DESIGN.md` (full evaluator design, instruction set, condition registry)
- `dev_refs/TECH-REFERENCE.md` (TRIG pattern tokens, condition registry, CSS/theme codebooks, instruction set)
- `draft_specs/ANON-MODE-DESIGN.md` (DATA_SOURCE=11 anonymous mode)

**Deliverables:**
- `js/lib/trig.js` — TRIG bytecode evaluator (client-side only)
- `js/lib/codec.js` — display_schema + form_schema + trig_block encode/decode
- `js/screens/view.js` — TRIG-gated rendering for #1pb/ and #1pf/ URLs
- `workpads-standard/trig-spec.md` — new standard doc from TRIG-DESIGN.md (SUI-007)
- `workpads-standard/STANDARD-UPDATES.md` — SUI-007 marked done

**CLI check:**
```
workpads-cli encode --type billboard --display-type card --show-contact
  → #1pb/ URL
workpads-cli encode --type financial-presentation --display-type list
  → #1pf/ URL
workpads-cli trig-eval <trig-bytecode-hex> --context '{"has_app":true,"known_contact":false}'
workpads-cli decode <url> --trig-trace   (shows evaluation path)
```

---

## Round 10 — Agreements + C-TRIG Evaluator

**Purpose:** Records become binding commitments. A quote can require bilateral acceptance. An invoice can release only when payment is confirmed. A job can gate completion on milestone sign-off. After this round the C-TRIG evaluator runs against real chain state and agreements can be ratified end-to-end.

**Key questions:**
- Does an offer record (EXT_TEMPLATE path, ACK_REQUEST=1) encode correctly with the agreement subtype?
- Does an acceptance State Commit (COMMIT_TYPE=10, ratification bitmap) encode and decode the 1-byte acceptance bitmask (bits 0–6 parties, bit 7 FULLY_RATIFIED)?
- Does the bilateral ratification detection algorithm correctly identify when a chain has enough unique acceptors?
- Does the C-TRIG evaluator accept `(program, context)` and return `{ resolved, result, halted, error }`?
- Does the evaluator correctly pre-resolve ChainState before each run (never fetching records itself)?
- Do all opcodes in the instruction table execute correctly? Specifically:
  - 0x0 COMPARE_AMT: operator dispatch + percentage threshold escape (imm=0xF + next byte)?
  - 0x1 PUSH_COND: all 15 named conditions + escape byte for extended conditions?
  - 0x6 TIME_LOCK: imm 0–14 from milestone_states + imm=0xF from due_date + null date → halt?
  - 0xC BRANCH: relative forward offset semantics, out-of-bounds → error?
  - 0xF VERSION: min_version check + feature_flags + SUPPORTED_FEATURES bitmask v1?
- Does a DISPUTE_LINK amendment (from the C-TRIG or Amendment-only fallback) correctly link into the agreement trail?
- Does the app correctly surface a dispute badge on the parent record when DISPUTE_LINK detected in chain?

**Spec refs:**
- `draft_specs/AGREEMENTS-DESIGN.md` (offer wire format, acceptance wire format, bilateral ratification, dispute protocol — draft-spec)
- `draft_specs/CTRIG-EVALUATOR-DESIGN.md` (full evaluator spec — draft-spec, §2–7)
- `dev_refs/FRAME-SPEC.md` §9 (State Commit), §10 (Amendment dispute path)

**Deliverables:**
- `js/lib/ctrig.js` — C-TRIG stack machine evaluator (pure JS, ES5)
- `js/lib/agreements.js` — offer/acceptance encoding, ratification detection, dispute filing
- `js/screens/agreement.js` — agreement offer flow, acceptance screen, dispute screen
- `workpads-standard/agreements-spec.md` — new standard doc (SUI-010)
- `workpads-standard/ctrig-evaluator-spec.md` — new standard doc (SUI-011)

**CLI check:**
```
workpads-cli encode --type agreement-offer --parties 2 --clauses "Payment net 30"
workpads-cli encode --type acceptance --parent <offer-url> --party-index 1
workpads-cli agreement-status <offer-url>
  → "Ratified: 1 of 2 parties; awaiting: Party 2"
workpads-cli ctrig-eval <bytecode-hex> --chain-state '{"ack_count":1,"amounts":[12550]}'
workpads-cli ctrig-trace <bytecode-hex> --chain-state '...'  (step-by-step trace)
```

---

## Round 11 — Markers: Physical Commitment Tokens

**Purpose:** Records become persistent physical objects. A ratified agreement writes to an NFC tag or QR code. A job site has a scannable Marker that any party can add to without internet. After this round `#1pm/` URLs are functional and the P2P Option E software Marker works between two devices.

**Key questions:**
- Does `RATIFIED_FRAME` (BASE_TEMPLATE=101, meta2 with participants, story, uid, tag, financial block) encode correctly within the NTAG213 144-byte budget?
- Does the Marker UID (did:stone: DID format) generate deterministically from party DIDs + timestamp?
- Does the write token (marker_uid + slot_index + prev_stone_hash 8B + write_payload + timestamp 2B + hmac_tag 8B) encode/verify correctly?
- Does SLOT 0 (offer) → SLOT 1 (acceptance) → WRITE_LOCK flow complete the P2P Option E exchange without any server call?
- Does the QR/NFC exchange produce a valid `workpads.me/p#1pm/<b64url(marker_uid)>` URL?
- Does the offline connectivity matrix work: both-online / writer-offline / reader-offline / both-offline — all four cases handled?
- Does the minimal wire size fit: ~79B (no financial) and ~94B (with financial) within NTAG213's 144B?
- Does `decodePadsV1Marker()` correctly route #1pm/ fragments?

**Spec refs:**
- `draft_specs/MARKERS-DESIGN.md` (full spec — draft-spec, all sections including Option E P2P)
- `dev_refs/TAG-REFERENCE.md` (#1pm/ decoder routing)
- `dev_refs/FRAME-SPEC.md` §9 (State Commit for RATIFIED_FRAME)

**Deliverables:**
- `js/lib/markers.js` — Marker UID generation, write token encode/verify, RATIFIED_FRAME builder, P2P Option E protocol
- `js/screens/marker.js` — Marker scan, write, review, confirm screens
- `workpads-standard/markers-spec.md` — new standard doc (SUI-009)
- `workpads-standard/STANDARD-UPDATES.md` — SUI-009 marked done

**CLI check:**
```
workpads-cli marker create --parties 2
  → did:stone: UID + QR payload
workpads-cli marker write --slot 0 --uid <marker-uid> --record <ratified-url>
workpads-cli marker write --slot 1 --uid <marker-uid> --record <acceptance-url>
workpads-cli marker read --uid <marker-uid>
  → RATIFIED_FRAME decoded
workpads-cli marker verify-hmac --token <write-token-hex>
```

---

## Round 12 — Activity Locale + Role Codebook UI

**Purpose:** The app becomes globally deployable. Currency, tax label, tax rate, template pack, and record locale are all driven by the worker's Activity. After this round onboarding sets the locale, every record inherits correct defaults, and the full Role Codebook is accessible in the participants entry flow.

**Key questions:**
- Does ActivityService store locale, currency, tax_label, tax_rate, template_pack?
- Does onboarding step 2 (country/locale selection) correctly populate ActivityService?
- Does `setup_byte` CURRENCY field correctly inherit from ActivityService when no per-record override?
- Does `COMPACT_TIME` date display use the Activity locale's date format?
- Does the full role codebook (240 roles across 16 groups) render in a D-pad navigable picker?
- Does the ROLE_TYPE=11 extended path correctly enter via a role_code picker or free-text role_text?
- Do ROLE_SIGNALS (CERT/AUTH/LEAD) display correctly on participant cards?

**Spec refs:**
- `dev_refs/FRAME-SPEC.md` §2 (setup_byte CURRENCY, meta2 COMPACT_TIME)
- `dev_refs/ROLE-CODEBOOK.md` v1.1 (all 16 groups, ROLE_SIGNALS)
- `workpads-standard/activity-profile.md`

**Deliverables:**
- `js/services/ActivityService.js` — locale, currency, tax, template_pack fields
- `js/screens/onboarding.js` — step 2 locale selection
- `js/screens/participants.js` — full role codebook picker, ROLE_SIGNALS display
- `workpads-standard/participants-block.md` — SUI-003 final completion

---

## Round 13 — Standard Sync + CLI Test Suite

**Purpose:** The standard catches up with the implementation. After this round `workpads-standard/` is fully consistent with the pads-v1 implementation, every SUI-001 through SUI-015 item is done, and the workpads-cli and workpadsdev-cli test suites cover every round.

**Key questions:**
- Are all Tier 1 SUI items (SUI-001 through SUI-008) in STANDARD-UPDATES.md marked done?
- Are all Tier 2 SUI items (SUI-009 through SUI-015) marked done?
- Does `workpads-cli roundtrip --all-profiles` pass every profile from FRAME-SPEC §4?
- Does `workpadsdev-cli conformance` pass BASICS Core tier check?
- Does `workpadsdev-cli build` produce a clean packaged app with correct manifest icons?
- Do all open DEVIATIONS.md entries have a status of closed or formally-accepted?
- Does codec-sync.md checklist pass for all three codec copies (kaios / dotme / npm package)?

**Spec refs:**
- `workpads-standard/STANDARD-UPDATES.md` (all SUI items)
- `dev_daily/DEVIATIONS.md`
- `dev_daily/CODEC-SYNC.md`
- `workpads-standard/basics-conformance.md`

**Deliverables:**
- All Tier 1 + Tier 2 standard docs written/updated
- `workpads-cli` test suite covering Rounds 1–12 encode/decode/roundtrip scenarios
- `workpadsdev-cli` conformance script passing BASICS Core
- DEVIATIONS.md all entries resolved
- CODEC-SYNC.md run and confirmed

---

## Round 14 — App Store Packaging + Polish

**Purpose:** The app ships. After this round the packaged KaiOS app passes store validation, all UI polish items are resolved, and storage warnings are in place.

**Key questions:**
- Do icons exist at 56×56, 112×112, 128×128 PNG?
- Does `manifest.webmanifest` have icons array, clipboard-write permission, version 0.2.0?
- Does the npm `package` script produce a clean zip (no node_modules, no .git, no dev files)?
- Does the packaged app pass KaiOS simulator validation?
- Does the storage quota warning fire at ~80% of 5MB (4MB threshold)?
- Are all share.js codec label references updated to pads-v1 (`1pa`)?
- Are all open DEV-WP-* items resolved or formally accepted?

**Spec refs:**
- `dev_daily/ROADMAP.md` Phases L + M

**Deliverables:**
- App icons (3 sizes)
- Updated `manifest.webmanifest`
- `package` npm script
- Storage quota warning in `management.js`
- Packaged zip ready for KaiOS Store submission

---

## Round Summary

| Round | Name | Unlocks | Target version |
|-------|------|---------|---------------|
| 1 | Codec Core | Encode/decode any text record in pads-v1 | v0.2 Phase A |
| 2 | Financial Block | Real money records with amounts, tax, I>O | v0.2 Phase G |
| 3 | DOMAIN=11 Hybrid | Accounting layer + entry type wizard | v0.2 Phase I |
| 4 | Participants + Roles | Multi-party records, 240-role codebook | v0.3 |
| 5 | Chain + State Records | Full job lifecycle, dispute filing | v0.3 |
| 6 | Compound Block | Multi-line invoices, payroll | v0.3 |
| 7 | Security Wrapper | Encrypted records, per-contact keys | v0.2 Phase G |
| 8 | Template System | Sector templates, formula eval, #te/ | v0.2 Phase K |
| 9 | Presentation + TRIG | Rich display, forms, client-side conditions | v0.4 |
| 10 | Agreements + C-TRIG | Conditional obligations, smart commitments | v0.4 |
| 11 | Markers | Physical commitment tokens, NFC/QR | v0.4 |
| 12 | Activity Locale | Global deployment, locale-driven defaults | v0.2 Phase B |
| 13 | Standard Sync + Tests | Standard current, full test coverage | v1.0 pre |
| 14 | Packaging + Polish | App store ready | v0.2 Phase L/M |

**Minimum viable production app:** Rounds 1, 2, 7, 8, 12, 14 (codec + financial + security + templates + locale + packaging).  
**Full pads-v1 feature parity:** Rounds 1–14 complete.
