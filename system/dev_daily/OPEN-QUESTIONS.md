# pads-v1 Open Questions

**As of:** 2026-05-15  
**Context:** Decisions D1–D24 are settled. These are the remaining gaps before codec.js implementation can begin. Grouped by type: constants that need specific values locked in, ambiguities in the spec that need clarification, small design gaps not yet decided, and the security/scrambling layer (OQ-14) which is a full design spec awaiting implementation decisions.

---

## Group 1 — Constants (specific values needed)

These need a number or string chosen. No design work required — just a decision.

---

### OQ-1 — Codebook tag string ✓ RESOLVED

**Decision:** `1pa` — pads v1, package a.

**Note:** No legacy compatibility constraints apply. App has not been publicly released (private demo only). The `1eg` codec can be replaced entirely; no dual-decoder or migration path is needed. Format decisions throughout should be made for what is optimal, not for backward compatibility.

---

### OQ-2 — COMPACT_TIME epoch date ✓ RESOLVED

**Decision:** `2000-01-01`. Covers historical job dates back to 2000 at zero byte cost (epoch is a codec constant, not stored in frame). uint16 range extends to ~2179.

---

### OQ-3 — currency_ext code table ✓ RESOLVED

**Decision:** Full 254-slot table below. All ISO 4217 active currencies included. Organized by region with reserved slots for expansion. 0x00 = error/unset, 0xFF = reserved.

#### currency_ext code table

**0x01–0x0F — Major global / reserve currencies**

| Code | ISO | Currency |
|------|-----|----------|
| 0x01 | USD | US Dollar |
| 0x02 | EUR | Euro |
| 0x03 | GBP | British Pound Sterling |
| 0x04 | JPY | Japanese Yen |
| 0x05 | CHF | Swiss Franc |
| 0x06 | CAD | Canadian Dollar |
| 0x07 | AUD | Australian Dollar |
| 0x08 | NZD | New Zealand Dollar |
| 0x09 | SEK | Swedish Krona |
| 0x0A | NOK | Norwegian Krone |
| 0x0B | DKK | Danish Krone |
| 0x0C | SGD | Singapore Dollar |
| 0x0D | HKD | Hong Kong Dollar |
| 0x0E | CNY | Chinese Yuan Renminbi |
| 0x0F | KRW | South Korean Won |

**0x10–0x1F — East Asia & Pacific**

| Code | ISO | Currency |
|------|-----|----------|
| 0x10 | TWD | New Taiwan Dollar |
| 0x11 | THB | Thai Baht |
| 0x12 | MYR | Malaysian Ringgit |
| 0x13 | IDR | Indonesian Rupiah |
| 0x14 | PHP | Philippine Peso |
| 0x15 | VND | Vietnamese Đồng |
| 0x16 | MMK | Myanmar Kyat |
| 0x17 | KHR | Cambodian Riel |
| 0x18 | LAK | Lao Kip |
| 0x19 | BND | Brunei Dollar |
| 0x1A | PGK | Papua New Guinean Kina |
| 0x1B | FJD | Fijian Dollar |
| 0x1C | TOP | Tongan Paʻanga |
| 0x1D | WST | Samoan Tālā |
| 0x1E | SBD | Solomon Islands Dollar |
| 0x1F | VUV | Vanuatu Vatu |

**0x20–0x4F — Africa (48 slots)**

| Code | ISO | Currency |
|------|-----|----------|
| 0x20 | NGN | Nigerian Naira |
| 0x21 | KES | Kenyan Shilling |
| 0x22 | ZAR | South African Rand |
| 0x23 | GHS | Ghanaian Cedi |
| 0x24 | UGX | Ugandan Shilling |
| 0x25 | TZS | Tanzanian Shilling |
| 0x26 | ETB | Ethiopian Birr |
| 0x27 | RWF | Rwandan Franc |
| 0x28 | XOF | West African CFA Franc (Senegal, Mali, Burkina Faso, Niger, Côte d'Ivoire, Togo, Benin, Guinea-Bissau) |
| 0x29 | XAF | Central African CFA Franc (Cameroon, CAR, Chad, Congo-B, Eq. Guinea, Gabon) |
| 0x2A | MAD | Moroccan Dirham |
| 0x2B | EGP | Egyptian Pound |
| 0x2C | DZD | Algerian Dinar |
| 0x2D | TND | Tunisian Dinar |
| 0x2E | LYD | Libyan Dinar |
| 0x2F | SDG | Sudanese Pound |
| 0x30 | ZMW | Zambian Kwacha |
| 0x31 | MWK | Malawian Kwacha |
| 0x32 | MZN | Mozambican Metical |
| 0x33 | AOA | Angolan Kwanza |
| 0x34 | BWP | Botswana Pula |
| 0x35 | NAD | Namibian Dollar |
| 0x36 | ZWG | Zimbabwean Gold (ZiG) |
| 0x37 | MGA | Malagasy Ariary |
| 0x38 | MUR | Mauritian Rupee |
| 0x39 | SCR | Seychellois Rupee |
| 0x3A | SOS | Somali Shilling |
| 0x3B | DJF | Djiboutian Franc |
| 0x3C | ERN | Eritrean Nakfa |
| 0x3D | SSP | South Sudanese Pound |
| 0x3E | CDF | Congolese Franc (DRC) |
| 0x3F | GMD | Gambian Dalasi |
| 0x40 | SLE | Sierra Leonean Leone |
| 0x41 | LRD | Liberian Dollar |
| 0x42 | GNF | Guinean Franc |
| 0x43 | CVE | Cape Verdean Escudo |
| 0x44 | STN | São Tomé and Príncipe Dobra |
| 0x45 | KMF | Comorian Franc |
| 0x46 | MRU | Mauritanian Ouguiya |
| 0x47 | LSL | Lesotho Loti |
| 0x48 | SZL | Swazi Lilangeni |
| 0x49 | BIF | Burundian Franc |
| 0x4A | XPF | CFP Franc (French Pacific territories) |
| 0x4B–0x4F | — | Reserved (Africa/AU expansion) |

**0x50–0x5F — South Asia**

| Code | ISO | Currency |
|------|-----|----------|
| 0x50 | INR | Indian Rupee |
| 0x51 | PKR | Pakistani Rupee |
| 0x52 | BDT | Bangladeshi Taka |
| 0x53 | LKR | Sri Lankan Rupee |
| 0x54 | NPR | Nepalese Rupee |
| 0x55 | MVR | Maldivian Rufiyaa |
| 0x56 | BTN | Bhutanese Ngultrum |
| 0x57 | AFN | Afghan Afghani |
| 0x58–0x5F | — | Reserved (South Asia expansion) |

**0x60–0x6F — Middle East**

| Code | ISO | Currency |
|------|-----|----------|
| 0x60 | SAR | Saudi Riyal |
| 0x61 | AED | UAE Dirham |
| 0x62 | QAR | Qatari Riyal |
| 0x63 | KWD | Kuwaiti Dinar |
| 0x64 | BHD | Bahraini Dinar |
| 0x65 | OMR | Omani Rial |
| 0x66 | JOD | Jordanian Dinar |
| 0x67 | IQD | Iraqi Dinar |
| 0x68 | IRR | Iranian Rial |
| 0x69 | ILS | Israeli New Shekel |
| 0x6A | LBP | Lebanese Pound |
| 0x6B | SYP | Syrian Pound |
| 0x6C | YER | Yemeni Rial |
| 0x6D | TRY | Turkish Lira |
| 0x6E–0x6F | — | Reserved |

**0x70–0x7F — Eastern Europe**

| Code | ISO | Currency |
|------|-----|----------|
| 0x70 | RUB | Russian Ruble |
| 0x71 | UAH | Ukrainian Hryvnia |
| 0x72 | PLN | Polish Złoty |
| 0x73 | CZK | Czech Koruna |
| 0x74 | HUF | Hungarian Forint |
| 0x75 | RON | Romanian Leu |
| 0x76 | BGN | Bulgarian Lev |
| 0x77 | RSD | Serbian Dinar |
| 0x78 | ALL | Albanian Lek |
| 0x79 | MKD | North Macedonian Denar |
| 0x7A | BAM | Bosnia-Herzegovina Convertible Mark |
| 0x7B | MDL | Moldovan Leu |
| 0x7C | ISK | Icelandic Króna |
| 0x7D | GIP | Gibraltar Pound |
| 0x7E | SHP | Saint Helena Pound |
| 0x7F | FKP | Falkland Islands Pound |

**0x80–0x8F — Central Asia & Caucasus**

| Code | ISO | Currency |
|------|-----|----------|
| 0x80 | KZT | Kazakhstani Tenge |
| 0x81 | UZS | Uzbekistani Som |
| 0x82 | AZN | Azerbaijani Manat |
| 0x83 | GEL | Georgian Lari |
| 0x84 | AMD | Armenian Dram |
| 0x85 | BYN | Belarusian Ruble |
| 0x86 | TJS | Tajikistani Somoni |
| 0x87 | TMT | Turkmenistani Manat |
| 0x88 | KGS | Kyrgyzstani Som |
| 0x89 | MNT | Mongolian Tögrög |
| 0x8A–0x8F | — | Reserved |

**0x90–0x9F — South America**

| Code | ISO | Currency |
|------|-----|----------|
| 0x90 | BRL | Brazilian Real |
| 0x91 | ARS | Argentine Peso |
| 0x92 | CLP | Chilean Peso |
| 0x93 | COP | Colombian Peso |
| 0x94 | PEN | Peruvian Sol |
| 0x95 | VES | Venezuelan Bolívar Soberano |
| 0x96 | BOB | Bolivian Boliviano |
| 0x97 | PYG | Paraguayan Guaraní |
| 0x98 | UYU | Uruguayan Peso |
| 0x99 | GYD | Guyanese Dollar |
| 0x9A | SRD | Surinamese Dollar |
| 0x9B–0x9F | — | Reserved |

**0xA0–0xAF — Central America & Caribbean**

| Code | ISO | Currency |
|------|-----|----------|
| 0xA0 | MXN | Mexican Peso |
| 0xA1 | GTQ | Guatemalan Quetzal |
| 0xA2 | HNL | Honduran Lempira |
| 0xA3 | NIO | Nicaraguan Córdoba |
| 0xA4 | CRC | Costa Rican Colón |
| 0xA5 | PAB | Panamanian Balboa |
| 0xA6 | DOP | Dominican Peso |
| 0xA7 | HTG | Haitian Gourde |
| 0xA8 | JMD | Jamaican Dollar |
| 0xA9 | TTD | Trinidad and Tobago Dollar |
| 0xAA | BBD | Barbadian Dollar |
| 0xAB | XCD | Eastern Caribbean Dollar |
| 0xAC | BSD | Bahamian Dollar |
| 0xAD | BZD | Belize Dollar |
| 0xAE | AWG | Aruban Florin |
| 0xAF | ANG | Netherlands Antillean Guilder |

**0xB0–0xBF — Remaining / special**

| Code | ISO | Currency |
|------|-----|----------|
| 0xB0 | CUP | Cuban Peso |
| 0xB1 | SVC | Salvadoran Colón |
| 0xB2 | KYD | Cayman Islands Dollar |
| 0xB3 | BMD | Bermudian Dollar |
| 0xB4 | TTD | — (duplicate, reserved) |
| 0xB5 | PYG | — (reserved) |
| 0xB6 | CUC | Cuban Convertible Peso |
| 0xB7 | MOP | Macanese Pataca |
| 0xB8 | KPW | North Korean Won |
| 0xB9 | TWD | — (reserved) |
| 0xBA | XDR | IMF Special Drawing Rights |
| 0xBB | XAU | Gold (troy oz) |
| 0xBC | XAG | Silver (troy oz) |
| 0xBD–0xBF | — | Reserved |

**0xC0–0xCF — Cryptocurrency & digital**

| Code | ISO | Currency |
|------|-----|----------|
| 0xC0 | BTC | Bitcoin |
| 0xC1 | ETH | Ethereum |
| 0xC2 | USDT | Tether |
| 0xC3 | USDC | USD Coin |
| 0xC4 | BNB | BNB (Binance) |
| 0xC5 | XRP | Ripple |
| 0xC6 | SOL | Solana |
| 0xC7 | ADA | Cardano |
| 0xC8 | DOGE | Dogecoin |
| 0xC9 | MATIC | Polygon |
| 0xCA | LTC | Litecoin |
| 0xCB | XLM | Stellar |
| 0xCC | XMR | Monero |
| 0xCD | cKES | cKES (Celo Kenyan Shilling) |
| 0xCE | cNGN | cNGN (Nigeria digital) |
| 0xCF | — | Reserved (digital expansion) |

**0xD0–0xFE — Reserved for future assignment**

| Range | Use |
|-------|-----|
| 0xD0–0xEF | Reserved — future ISO 4217 additions, CBDC, regional digital currencies |
| 0xF0–0xFE | Reserved — codebook package extension |
| 0xFF | Error / unset (never valid in a real record) |

---

### OQ-4 — TAX_CODE 01 and 10 rate values ✓ RESOLVED

**Decision:** No baked-in tax percentages for any currency or codebook package. Every taxed record must carry the explicit rate. TAX_CODE semantics revised:

| Code | Meaning | tax_block |
|------|---------|-----------|
| 00 | No tax | Absent |
| 01 | Tax inclusive — customer_amount includes tax; tax_block carries rate (permille) + tax amount for breakdown display | Always present |
| 10 | Tax exclusive — tax added on top of customer_amount; tax_block carries rate + tax amount | Always present |
| 11 | Compound tax — multiple rates (e.g. VAT + levy); full compound tax block follows (post-MVP) | Always present |

TAX_CODE=01 and 10 always require a tax_block. The rate is never assumed from the codebook. This works for any jurisdiction worldwide without a lookup table.

---

### OQ-5 — uint length-prefix byte order ✓ RESOLVED

**Decision:** Big-endian throughout, no exceptions. All multi-byte integers — amounts, dates, times, text length prefixes — are big-endian. All DataView calls must specify endianness explicitly (`getUint16(offset, false)`).

---

## Group 2 — Spec Ambiguities (need clarification)

These are places where the current design has an unresolved question about how something works.

---

### OQ-6 — TAX_CODE: is the tax amount stored or computed? ✓ RESOLVED

**Decision:** Stored amount is authoritative. The tax_block always carries both the permille rate (for display/audit) and the explicit tax amount (for accounting). The decoder trusts the stored amount; it never recomputes from the rate. Rounding makes computed values unreliable across jurisdictions. Same principle as qty × rate ≈ customer_amount.

---

### OQ-7 — DOMAIN=11 (hybrid): ✓ RESOLVED 2026-05-17

**Decision summary:**
- **When produced:** Option A — always on when DOMAIN≥01. Every financial record encoded as DOMAIN=11 with deterministic Account Pair from entry type matching table (FRAME-SPEC §17.5). `ACCOUNT_PAIR=1110` (Correction/Netting) written when entry type unknown (API/programmatic bypass).
- **Matching table:** Entry Type × I>O State × EXPENSE_CAT → Account Pair, fully deterministic. No inference ambiguity. See FRAME-SPEC §17.5.
- **Type-change reconciliation:** Built into creation screen. Direction flip, TIME bit toggle, EXPENSE_CAT change, and template switch all have defined cascade rules. Worker amounts never silently discarded. See FRAME-SPEC §17.6.
- **Amendment/annotation path:** Option A — `COMMIT_TYPE=11` State Commit carries `domain_upgrade` block (parent UID + `account_pair_byte` + classifier identity). Original record untouched. Chain reader combines both.
- **DOMAIN=10 scope:** Option B — integration-only, no wizard UI. Full codec encode/decode. App renders in read-only "accounting entry" view for journal entries, accruals, period-close adjustments.
- **Display model:** "Show accounting detail" toggle per record (persistent). When expanded shows plain-English classification + two entry destinations (debit account + credit account) derived from Account Pair code and AP_DIRECTION bit. Example: Type: Operating Expense / Debit: Expenses (Operating) / Credit: Assets (Cash).

**Full spec:** FRAME-SPEC.md §17 (layout, codes, UI model, inference table, matching table §17.5, type-change reconciliation §17.6).

---

### OQ-8 — Amendment record: CHAIN or UID for parent reference? ✓ RESOLVED

**Decision (updated 2026-05-17):** Option C — CHAIN=1 in meta1 + `&c=` URL suffix as primary (zero wire overhead). Optional `parent_uid` (8 bytes, SHA-256 of parent frame bytes truncated) embedded in frame when self-contained reference required. **Mandatory** when: writing to a Marker (`#1pm/`), or BASE_TEMPLATE=110 + DOMAIN≥01 (financial amendment). Flag: `HAS_PARENT_UID` in `amendment_flags` extension byte. Dispute amendments use `DISPUTE_LINK=1` flag — links into agreement trail without polluting State Commit sequence.

---

### OQ-9 — ROUNDING in standard mode: 1 bit vs 2 bits ✓ RESOLVED (flagged for review)

**Decision (updated 2026-05-17):** 1-bit rounding toggle retained in Simple mode — worker can explicitly set round-up (1) or round-down (0); absent = round-to-nearest. QTY_TIME encoding uses ROUNDING bits for 5-min boundary rounding (10=up, 11=down, 00=exact). Flagged for post-MVP review — rounding behaviour in Standard (Account Pair) mode may need separate treatment.

---

### OQ-10 — IS_ORG + individual's org affiliation in participants ✓ RESOLVED

**Decision (updated 2026-05-17):** Sole trader dual-name support added. `part_flags` bit 1 repurposed: when ROLE_TYPE≠11, bit 1 = `HAS_TRADING_NAME` (trading name or company name distinct from personal name follows as a second name field). When ROLE_TYPE=11, bit 1 retains its existing meaning (HAS_ROLE_TEXT). Sender controls what to include: personal name only, trading name only, or both. Shell display: template controls which name leads; default = trading_name when present, personal name as fallback.

---

## Group 3 — Small Design Gaps (not yet decided)

These require a design choice, not just a value.

---

### OQ-11 — FLAGS4 layout for Contact/entity template ✓ RESOLVED

**Decision (updated 2026-05-17):** Full FLAGS4 Contact/entity layout assigned:
- bit 0: `website` [u16 len][UTF-8]
- bit 1: `social_handle` [u8 len][UTF-8]
- bit 2: `business_hours` [u16 len][UTF-8] (structured block post-MVP)
- bit 3: `category` 1B trade enum (ROLE-CODEBOOK.md §3)
- bit 4: `alt_phone` [u16 len][UTF-8] E164
- bit 5: `meeting_location` [u16 len][UTF-8]
- bit 6: reserved
- bit 7: FLAGS5_PRESENT

**Current FLAGS4 assignment (Contact/entity template):**
- bit 0: `bday` — date of birth (uint16 days, COMPACT_TIME applies)
- bit 1: `contact_location` — contact's address/location, distinct from job `location` field ([u16 len][UTF-8])
- bit 2: `contact_note` — note about this contact ([u16 len][UTF-8])
- bits 3–6: reserved — future Contact fields; promote as needed without breaking change
- bit 7: `FLAGS5_PRESENT` — chains to FLAGS5 byte (same pattern as FLAGS3→FLAGS4)

**Pending:** Remaining reserved bits to be named in a future session when use cases are confirmed. No urgency — reserved bits are a free placeholder.

---

### OQ-12 — QTY_COMPACT for fractional hours ✓ RESOLVED

**Decision (updated 2026-05-17):** `QTY_TIME` encoding added for time-unit quantities. 2 bytes: `hours (uint8, 0–255)` + `minutes_index (uint8, 0–11; × 5 = actual minutes)`. Supports 5-minute precision; max 255h 55min. UI presents 15-min and 10-min shortcuts. QTY_COMPACT unchanged for non-time quantities. ROUNDING bits apply to 5-min boundary rounding. Triggered when `qty_unit` field indicates a time unit.

---

### OQ-13 — State Commit record: financial block structure ✓ RESOLVED

**Decision (updated 2026-05-17):** State Commit carries a **summary-only** financial block — key confirmation data, not full line detail. `setup_byte` present; no `transaction_byte`. Financial summary: `total_amount (uint24)` + `line_count (uint8)` mandatory (Level A, 4 bytes). Optional extensions: `tax_total (uint24)`, `compound_summary` (compact per-line description+amount), `fingerprint (6 bytes, SHA-256 of original financial bytes truncated)` for tamper evidence. Level B/C/D extension slots named but unspecified. Guest viewer confirmation signature: `device_fingerprint (6B)` + `timestamp (2B)` + tap confirmation (1-bit) + optional `identity_anchor (9B)` (hashed phone/email). COMMIT_TYPE updated: 00=job close, 01=payment confirmed, 10=terms agreed, 11=reserved. Disputes handled via Amendment + DISPUTE_LINK, optionally logged into agreement trail.

| COMMIT_TYPE | Financial block |
|---|---|
| 00 job close | customer_amount = outstanding balance; worker_amount = total job cost |
| 01 pay period close | customer_amount = gross pay; worker_amount = net pay |
| 10 period summary | COMPOUND_VALUE=1; summary lines (LINE_TYPE=11) per category |
| 11 annual aggregate | Same as period summary, wider date range |

---

---

## Group 4 — Security Layer (OQ-14) ✓ DESIGN COMPLETE

Full design spec for the scrambling and encryption layer. The frame codec (FRAME-SPEC.md) is unchanged — this is a wrapper applied around the encoded frame before URL embedding.

**Design document:** `dev_daily/draft_specs/SECURITY-DESIGN.md` (draft-spec status, 2026-05-17). FRAME-SPEC §12 updated to match canonical design. All 11 sub-decisions (OQ-14a through OQ-14k) resolved; open sub-questions OQ-14l through OQ-14p logged in SECURITY-DESIGN.md §10.

---

### OQ-14 — Scrambling and encryption layer design

#### Threat model

The URL travels via SMS, WhatsApp, QR codes. The threat is **casual interception**: someone reads the message in a chat history, a third party accesses a WhatsApp account, a URL preview system logs the payload, a family member sees the phone screen. Not: a determined adversary with the codec spec and compute resources running a dictionary attack.

A short human-typeable passphrase (6–8 chars) is the right tradeoff — memorable, shareable verbally, typeable on a KaiOS D-pad, adequate against casual interception.

---

#### URL structure

```
workpads.me/p#<TAG>/<4-byte-salt-b64url>.<payload-b64url>

1pa  — unscrambled (existing)
1ps  — full encryption + full scramble (everything after tag encrypted)
1ph  — partial encryption + full scramble (meta header unencrypted, field data scrambled+encrypted)
```

The tag stays visible in all cases. The salt (4 bytes, base64url = 6 chars) is visible, not secret — its role is to ensure two records with the same passphrase produce different keystreams.

---

#### Key hierarchy — one passphrase, two derived secrets

```
master = SHA-256(passphrase || 4-byte-salt)   [32 bytes]

cipher_key    = master[0:16]    →  AES-CTR encryption key
scramble_seed = master[16:32]   →  Fisher-Yates permutation seed
```

Both layers derive from the same passphrase but use independent key material. Breaking one layer gives no information about the other.

---

#### Three-layer protection model

```
Layer 1 — Template structure (always visible for 1ph; encrypted for 1ps)
  BASE_TEMPLATE type readable: "financial record", "service record" etc.
  meta1 + meta2 + setup_byte + transaction_byte unencrypted in 1ph
  No field content or amounts leak from this layer

Layer 2 — Semantic scramble (key-derived, structurally disfiguring)
  A: field_flags bit assignments permuted by scramble_seed
     Standard: bit 0=job, bit 1=customer, bit 12=financial etc.
     Scrambled: bit assignments reshuffled — interceptor can't determine which fields are present
  B: Data block write order permuted by scramble_seed
     Blocks written in key-derived order, not bit-position order
     Without key: correct values but wrong field assignments
  Both A and B derive from the same scramble_seed via Fisher-Yates seeded shuffle

Layer 3 — Stream cipher (key-derived, cryptographic)
  AES-CTR via WebCrypto (crypto.subtle, available KaiOS 2.5+, async)
  RC4 pure-ES5 fallback (~30 lines) if WebCrypto unavailable
  Applied over the scrambled payload (layers applied: scramble then encrypt)
```

Without the key an attacker faces all three simultaneously: they can't interpret field_flags, can't reassemble field order, and can't decrypt values.

---

#### Permutation derivation (Fisher-Yates seeded by scramble_seed)

```js
function seededPermutation(items, seedBytes) {
  var arr = items.slice(), i, j, tmp, byte_i;
  for (i = arr.length - 1; i > 0; i--) {
    byte_i = seedBytes[i % seedBytes.length];
    j = byte_i % (i + 1);
    tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}
// Usage:
// fieldFlagsBitPermutation = seededPermutation([0,1,2,...,14], scramble_seed)
// blockOrderPermutation    = seededPermutation(activeFieldList, scramble_seed.slice(8))
```

Both permutations are deterministic from `scramble_seed` — sender and receiver independently produce identical results from the same passphrase without any extra communication.

---

#### SELF_DESCRIBING forced off

If SELF_DESCRIBING=1, each data block carries a 1-byte field-name index that labels its field. This completely defeats block-order scrambling. Rule: **scrambled records always use SELF_DESCRIBING=0**. The `1ps`/`1ph` tags imply SELF_DESCRIBING=0 regardless of what meta2 bit 7 says. Encoder must enforce this; decoder ignores meta2 bit 7 when processing scrambled tags.

---

#### field_flags3 noise injection

When scrambling is active, unset bits in field_flags3 are populated with random values instead of zeros. A standard decoder (without the key) sees FLAGS3_PRESENT=1 and attempts to parse unexpected extension fields, failing unpredictably. A scramble-aware decoder with the key knows which FLAGS3 bits are real (from the field presence implied by the key-derived permutation) and ignores the rest. Adds structural noise with zero payload cost.

---

#### Partial encryption (`1ph`) — what is and isn't visible

| Byte | 1ph visibility | What interceptor learns |
|------|----------------|------------------------|
| meta1 | Unencrypted | Record type (financial/service/etc.), CHAIN, ACK |
| meta2 | Unencrypted | DOMAIN (simple/standard), DRAFT, COMPACT_TIME |
| setup_byte | Unencrypted | Decimal precision, home/foreign currency, tax flag |
| transaction_byte | Unencrypted | I>O direction (income vs expense), settled vs pending |
| field_flags | Scrambled (bit assignments permuted), unencrypted | A 16-bit value — semantically opaque without key |
| Data blocks | Scrambled order + AES-CTR encrypted | Nothing |
| Financial block | Scrambled + encrypted | Nothing |
| Participants | Scrambled + encrypted | Nothing |

The interceptor knows: "a financial record, in home currency, income/expense direction, settled/pending." No amounts, no names, no job descriptions, no contact details.

For the field service use case this is the right tradeoff: the customer receiving a `1ph` URL sees "Protected invoice — enter code to view" with enough context to know what it is before they type their code.

---

#### Key hint (optional, UX feature)

A short visible hint can be embedded in the URL to help the receiver remember which code applies:

```
workpads.me/p#1ph/<salt>.<hint>.<payload>
```

`hint` = first 4 chars of `base64url(HMAC-SHA256(master_key, "hint"))`. This is derived from the key but reveals nothing about it — cryptographically unlinkable to the passphrase without knowing the passphrase. The receiver uses it to confirm "yes, this is the code I think it is" before typing.

---

#### Per-contact standing passphrases (UX architecture)

```
App storage (encrypted at rest):
  contacts[contactId].scrambleCode = "plum42"

Sender flow:
  Record created → "Scramble?" toggle → ON uses stored code for this contact → no further friction

Receiver flow:
  First scrambled record from a new sender:
    → App prompts "Enter code for records from [sender name]"
    → App stores: sender_identifier → scramble_code
  All subsequent records from that sender: auto-decode, zero UI friction
```

Sender identifier: the sender's phone number from the IS_SENDER=1 participant in the participants block (or from the URL origin if participants block is absent). App matches on phone number to look up the stored code.

---

#### Codec architecture — clean separation

The frame codec (FRAME-SPEC.md) is **unchanged**. Scrambling and encryption are a wrapper module:

```
Encode path:
  frame    = encode(record)                      // standard codec → binary frame
  key      = deriveKey(passphrase|templateHash, salt)
  seeded   = deflateWithSeed(frame, key)         // deflate seed poisoning (OQ-14h)
  scrambled = fieldScramble(seeded, key)         // bit-assignment + block-order permute
  committed = appendCommitment(scrambled, key)   // HMAC sender||receiver (OQ-14k)
  encrypted = aesCtr(committed, key)             // AES-CTR or RC4 fallback
  url      = tag + '/' + b64url(salt) + '.' + b64url(encrypted)

Decode path:
  tag → select key source:
    1ps/1ph → load per-contact passphrase or prompt
    1pt     → look up template by ID → hash template content → derive key
  decrypted  = aesCtrDecrypt(payload, key)
  check      = verifyCommitment(decrypted, key)  // reject if mismatch (OQ-14k)
  unscrambled = fieldUnscramble(decrypted, key)
  frame      = deflateUnwrap(unscrambled, key)   // strip seeded prefix after inflate
  record     = decode(frame)                     // standard codec, unchanged
```

`scrambleWrap` and `scrambleUnwrap` are self-contained functions with no dependency on the codec internals. They operate on the deflated binary frame as an opaque byte array.

---

#### Template-keyed records (`1pt`)

A private shared template — existing on only two devices — is itself a high-entropy shared secret. The template's content (field definitions, sector codes, label maps, ~500–2000 bytes) hashes to 32 bytes of key material far exceeding any passphrase.

**URL structure:**
```
workpads.me/p#1pt/XY3/<salt>.<payload>
```
`1pt` = pads v1, template-keyed. `XY3` = template ID, advertised plainly. The ID is a routing hint only — it tells the receiver app which template to look up locally. The actual key derives from the template content, not the ID. An interceptor seeing `XY3` gains nothing without the template itself.

**Key derivation:**
```
template_key = SHA-256(template_content_bytes)
master       = SHA-256(template_key || salt)
```

**Two-factor variant** (template + passphrase):
```
master = SHA-256(template_key || passphrase || salt)
```
Possessing the template = first factor. Short passphrase = second factor. For routine records the template alone suffices; for high-value records add the passphrase.

**Template as permutation source:** The template's own field ordering defines the block-order permutation directly — sender and receiver already agree on it by virtue of sharing the template. Scramble and template become the same thing; no separate scramble_seed derivation needed.

**Advertising the template ID plainly is safe** when the template exists on only two devices. Structurally identical to a public key ID being public — the identifier is meaningless without the private content. The ID could appear on a business card or van livery with no loss of security.

---

#### Deflate seed poisoning

Before compressing, prepend a key-derived N-byte prefix to the raw frame bytes. Compress `(prefix || frame)` together. Receiver decompresses and strips the prefix.

The deflate output of a prefixed payload is entirely different from the non-prefixed payload even with identical plaintext — deflate's LZ77 back-references span the whole input, so the prefix rewrites the entire compressed bitstream. This creates key-dependence at the compression layer as a third independent mechanism with **zero overhead on the decompressed output** (the prefix compresses away).

An attacker who strips the outer encryption and inspects the ciphertext sees a bitstream that doesn't match any standard deflate structure, with no recognisable frame header at offset 0.

**Prefix derivation:** `prefix = HMAC-SHA256(master_key, "deflate-seed")[0:N]` where N is 8–16 bytes. Long enough to disrupt LZ77 back-reference tables; short enough to have negligible effect on compressed size.

---

#### Chain ratchet

For chained records (child records linked via `CHAIN=1`), each record's key is derived from the previous:

```
key_0 = master (from passphrase or template)
key_N = SHA-256(key_{N-1} || salt_N)
```

Intercepting URL N is useless without having already decoded URL N-1. The chain is a ratchet — you cannot enter mid-sequence. A quote → invoice → payment chain requires the full sequence; a third party receiving a forwarded invoice URL cannot decode it without the preceding quote.

Useful for job chains with confidential progression. Adds nothing to standalone records — only a property of chained sequences.

---

#### False-positive decode (honey record)

Without the key a brute-force attempt eventually produces a valid-looking but entirely fabricated record — a pre-authored decoy embedded in the encrypted payload. The decoy is a minimal valid workpads frame (~20 bytes): fake job description, plausible amount, different customer name.

**Structure:** The real frame is encrypted under `master`. The decoy is appended, encrypted under a trivially-derived key (e.g. `SHA-256("decoy" || salt)` — computationally cheap to reach). A standard brute-force decoder finds the decoy first, sees a valid-looking record, and has no signal that it has decoded the wrong thing. This breaks the brute-force feedback loop: the attacker cannot distinguish a successful crack from the decoy.

**Cost:** ~20–30 extra bytes in the encrypted payload. Negligible URL length increase. High value against automated cracking tools.

---

#### Receiver-side commitment check

Embed in the encrypted payload an HMAC over the sender and receiver identities:

```
commitment = HMAC-SHA256(master_key, sender_phone || receiver_phone)
```

The receiver app verifies the commitment after decoding. If a wrong key produces a plausible-looking decode (honey record collision, lucky brute-force), the commitment check fails — cryptographic proof that the record was encrypted for this specific sender→receiver pair.

Also prevents key reuse across contacts: a code shared with Alice cannot decode a record addressed to Bob even if Bob learns Alice's passphrase. The commitment is identity-bound.

**Placement:** last 8 bytes of the encrypted payload (before the decoy, if present). Decoder checks it before presenting the decoded record to the UI.

---

#### Open sub-decisions within OQ-14

| Sub | Topic | Recommendation |
|-----|-------|----------------|
| OQ-14a | Is `1ph` (partial) worth the complexity vs `1ps` (full) only? | Yes — partial is better UX for invoices; receiver sees type+direction before entering code |
| OQ-14b | Key hint in URL | **Latent** — spec complete; not activated in UI yet. See FEATURES.md. |
| OQ-14c | RC4 fallback vs require WebCrypto? | Include RC4 fallback — KaiOS WebCrypto availability uncertain on older devices |
| OQ-14d | Per-contact code storage | **Resolved** — derived passphrase system: one master secret, PIN-encrypted at rest. Per-contact codes derived via HMAC(master_secret, contact_id \|\| period). PIN change re-encrypts master secret only; all derivations intact. Recovery QR exported on first setup. Global default + per-contact override both supported. See FEATURES.md. |
| OQ-14e | field_flags3 noise: always on when scrambling, or optional? | Always on — adds noise at zero cost; no reason to make it optional |
| OQ-14f | Maximum passphrase length / character set? | Any printable ASCII; UI should accept 4–20 chars; longer is better |
| OQ-14g | Template-keyed tag (`1pt`): adopt as primary key mechanism? | Yes — template content hash as high-entropy key; ID advertised plainly; template IS the shared secret |
| OQ-14h | Deflate seed poisoning: include as standard layer for all scrambled tags? | Yes — zero decompressed overhead; adds compression-layer key-dependence at negligible cost |
| OQ-14i | Chain ratchet: apply automatically to all chained records, or opt-in? | Opt-in — useful for confidential job chains; adds decoding dependency that may inconvenience legitimate receivers in some flows |
| OQ-14j | Honey record: include by default, or opt-in for high-sensitivity records? | Opt-in for MVP — adds ~30 bytes and implementation complexity; revisit post-MVP |
| OQ-14k | Receiver commitment: always include when scrambling active? | Yes — 8 bytes overhead, prevents key reuse across contacts, breaks false-positive brute-force; always worth it |

---

---

## Group 5 — Template System (OQ-15 through OQ-19)

These arise from two connected product needs: (a) converting any system template into a protected template usable as `1pt` key material, and (b) open form building — creating new templates from scratch. Both produce the same artifact: a **template definition**. The codec already supports the mechanics (D4 template ID scheme, D22 label_map, OQ-11 FLAGS4, OQ-14g `1pt` tag). What is needed here is the definition schema, the form builder field vocabulary, and the lifecycle rules.

---

### OQ-15 — Template definition schema and canonical serialisation

**What:** A template definition is a stored data structure that tells the codec which fields exist, in what order, with what labels. It must be canonical — same bytes on both devices = same SHA-256 hash = same `1pt` key.

**Proposed schema:**
```json
{
  "id": "XY3",
  "name": "Site visit invoice",
  "base_template": "001",
  "domain": "01",
  "codebook": "c",
  "version": 1,
  "label_map": {
    "job": "Work description",
    "customer": "Client",
    "worker": "Engineer"
  },
  "fields": {
    "required": ["job", "customer", "date", "financial_block"],
    "optional": ["location", "details", "ref_number", "context_label"]
  },
  "custom_fields": [
    { "slot": "flags4_bit0", "name": "site_ref",    "type": "text_compact" },
    { "slot": "flags4_bit1", "name": "cert_number", "type": "text_compact" }
  ],
  "block_order": ["job", "customer", "date", "location", "financial_block", "ref_number", "details"],
  "protected": true
}
```

**`block_order` is the scramble permutation.** For `1pt` records, the template's `block_order` directly defines the data block write sequence — no separate key-derived permutation needed. Sharing the template = agreeing on the field order = establishing the scramble.

**Canonical form for hashing:** Sort all keys alphabetically, strip whitespace, encode as UTF-8, exclude mutable/local fields: `id`, `name`, `protected`. Hash the resulting bytes with SHA-256. Two devices with the same template produce the same hash regardless of storage context.

**Decision:** Canonical form confirmed as proposed. Exclude `id`, `name`, `protected` from hash. Sort keys alphabetically, strip whitespace, UTF-8 encode, SHA-256. ✓ RESOLVED

**Template System Design Session — 2026-05-17 — all sub-questions resolved:**
- **Custom template ID namespace:** EXT_TEMPLATE path; TEMPLATE_ID=1111 reserved = "custom, hash follows." CODEC-4 covers full encoding.
- **Template update delivery:** System templates bundled in app (update via app releases). Sector templates peer-to-peer via Data Sync Bundle. CDN fallback on-demand only when record is already being opened. No startup network calls.
- **`#te/` key derivation:** Both modes supported. `HKDF_KEY` flag in preamble byte bit 3 (bit 3 now `HKDF_KEY`; KEY_HINT shrinks to bits 2–0). `HKDF_KEY=1` default for new templates; `HKDF_KEY=0` for backward compatibility.
- **`#te/` security UX:** One-time disclosure per template per contact at first share. Plain-language notice. Then silent.
- **GPS location encoding:** Both modes. UTF-8 string in existing `location` field (default MVP). Compact binary `[int16 lat×100][int16 lon×100]` = 4 bytes via FLAGS4 bit 2 (`gps_binary`). ±1.1 km precision. Both can coexist in same record.
- **Signature field:** Reserved; post-MVP. Content-addressed attachment reference preferred (not inline base64).
- **Sector template distribution:** Lean app. Peer-to-peer primary; CDN fallback only.
- **Invoice wizard compound frame:** In MVP — app-generated multiple line items.
- **Form builder "line items" toggle:** Yes — declares compound frame, fixed standard schema.
- **Custom line item schema (user-defined fields in repeating section):** Post-MVP. Slot reserved.
- **Formula storage (CODEC-3):** Dual-layer — infix string in template JSON (authoring) + compiled RPN bytecode in `trig_block` (offline evaluation). Resolved.

**Full design doc:** TEMPLATE-SYSTEM-DESIGN.md in draft_specs/

---

### OQ-16 — Template sharing: mechanism hierarchy and URL format

**The server visibility problem with path-based URLs**

`workpads.me/t/<payload>` (path-based) sends the template payload in the HTTP request — the server receives it. This violates the no-server-observation principle that underpins the whole URL design. The `/t/` path scheme is **dropped**.

**The URL previewer problem**

Messaging apps (WhatsApp, iMessage, Telegram, SMS) generate link previews by fetching URLs. Two behaviours:

- *Server-side fetchers* (most common): platform server makes an HTTP request to `workpads.me/p`, receives the static HTML meta tags, never sees the fragment. Safe.
- *JavaScript-rendered previewers* (some clients): headless browser loads the full page, executes JS, reads `location.hash`. If the workpads web app renders decoded content into the DOM, the previewer sees it. Mitigation: web app returns only generic static meta tags server-side; JS codec runs only on genuine user interaction. For scrambled records (`1ps`/`1ph`/`1pt`) a JS previewer gets only ciphertext regardless.

Fragments alone are not a complete defence against JS-rendered previewers — but they eliminate server-side observation entirely, and scrambling eliminates the JS-rendered risk for protected content.

---

**Mechanism hierarchy — preferred to fallback**

| Method | Server sees | Previewer sees | Notes |
|--------|-------------|----------------|-------|
| QR code (in-app display) | Nothing | Nothing | Canonical preferred method for protected templates |
| NFC / Bluetooth | Nothing | Nothing | In-person alternative to QR |
| `#t/` fragment URL | Nothing | Generic page (server-side) or ciphertext (JS-rendered, if `#te/` used) | Convenience fallback for remote sharing |
| `#te/` encrypted fragment URL | Nothing | Ciphertext only | Use when channel is untrusted |

**QR / NFC is the canonical mechanism for protected templates.** URL sharing is the fallback for when in-person exchange is impractical.

---

**Fragment URL formats (replacing `/t/` path)**

```
workpads.me/p#t/<b64url-deflated-template-json>        — unencrypted share
workpads.me/p#te/<b64url-encrypted-template-json>      — passphrase-encrypted share
```

`#t/` and `#te/` are fragment prefixes, processed entirely client-side. The server receives only `GET /p`. Consistent with all record URLs — everything lives in the fragment.

App dispatch on `location.hash`:
```
#1pa/  →  pads-v1 record (unscrambled)
#1ps/  →  pads-v1 record (fully scrambled)
#1ph/  →  pads-v1 record (partially scrambled)
#1pt/  →  pads-v1 record (template-keyed)
#t/    →  template share (unencrypted)
#te/   →  template share (passphrase-encrypted)
```

**Encrypted share (`#te/`) mechanism:**
Template JSON is encrypted under a passphrase (same AES-CTR + SHA-256 derivation as OQ-14) before deflating and encoding. The passphrase is shared out-of-band (verbally, in person, separate message). Receiver opens the URL in the workpads app, is prompted for the passphrase, installs the template. The bootstrap problem requires one secure channel once; after that the template handles all future record security.

**One-time share principle:** Template is shared once per relationship. All subsequent `#1pt/ID/` records auto-encode/decode using the stored template. No re-sharing unless the template is superseded (OQ-19).

**Receiver install flow:**
1. Open `workpads.me/p#t/<payload>` or `#te/<payload>` in app
2. App detects template fragment prefix
3. If `#te/`: prompt for passphrase, decrypt
4. Decode template JSON, validate schema
5. Derive template ID per D4 (CRC-8 namespace + CRC-16 local ID)
6. Store content-addressed by SHA-256 hash (OQ-19)
7. Confirm: "Template '[name]' installed. Records from [contact] will now use this template."

**Decision resolved:** `/t/` path dropped in favour of `#t/` and `#te/` fragments. QR/NFC canonical for protected templates; fragment URLs as fallback.

---

### OQ-17 — Form builder field type vocabulary

**What:** The form builder presents field types as human-facing choices. Each maps to a codec wire encoding.

**Proposed type set:**

| Builder type | Wire encoding | Notes |
|---|---|---|
| `text` | `[u16 len][UTF-8]` | Names, descriptions, multi-sentence |
| `text_compact` | `[u8 len][UTF-8]` | Short refs, codes, labels (max 255 B) |
| `date` | `u16` days | Dates |
| `time` | `u16` minutes | Times |
| `amount` | `uint24` + SF | Money values (uses setup_byte context) |
| `integer` | `uint24` DECIMAL_POS=0 | Counts, whole-number quantities |
| `boolean` | Flag bit, no data block | Presence/absence toggles |
| `select` | `u8` enum | Fixed choice list (max 256 options; choices defined in template) |
| `phone` | `[u16 len][UTF-8]` | Semantic alias of text |
| `url` | `[u16 len][UTF-8]` | Semantic alias of text |

Standard fields (bits 0–14, FLAGS3 bits 0–6) are assigned types by the canonical registry (STANDARD-FIELDS.md). Custom fields in FLAGS4 use any type from the above list, assigned in the template definition.

**Decision:** Vocabulary confirmed with `multi_select` added. `geo` and `decimal` deferred to backlog. ✓ RESOLVED

**Final field type vocabulary (11 types):**

| Type | Wire | Notes |
|---|---|---|
| `text` | [u16][UTF-8] | Names, descriptions |
| `text_compact` | [u8][UTF-8] | Short codes, refs (max 255B) |
| `date` | uint16 days | COMPACT_TIME epoch |
| `time` | uint16 minutes | Since midnight |
| `amount` | uint24 | Uses record DECIMAL_POS |
| `integer` | uint24, DECIMAL_POS=0 | Counts, whole numbers |
| `boolean` | flag bit only, no data block | Presence/absence |
| `select` | uint8 enum | Single choice; options in template |
| `multi_select` | uint8 bitmask (≤8 opts) or uint16 bitmask (≤16 opts) | Multiple choice; see list_source below |
| `phone` | [u16][UTF-8] | Semantic alias of text |
| `url` | [u16][UTF-8] | Semantic alias of text |

**multi_select list_source (per field definition in template):**
- `00` = in-list — options embedded in template definition, travel in URL payload. Public/non-sensitive choices.
- `01` = in-app — options stored locally by reference ID; only bitmask + list_ref_id travel in URL. Receiver needs the app + matching list to render options. Used for sensitive/private choice sets.

**Form isolation — HARD_BLOCK flag (per field in form schema):**
- `HARD_BLOCK=1` on a field: field is collected locally but stripped from any generated URL or shared record. Never transmitted. Enforced by the encoder — not a UI toggle, a schema property.
- Primary use: multi_select fields with sensitive option sets (internal categories, pricing tiers, client classifications) that inform local decisions but must not leak via shared URLs.
- Also applicable to: `text` fields collecting private notes, `amount` fields for internal cost estimates.

**select choice list storage:** Inline in template definition for both `select` and `multi_select` (in-list source). For in-app source, a `list_ref_id` (uint8) in the field definition points to a locally-stored option list (app-managed, not in the codec).

---

### OQ-18 — Protected template immutability and UI policy

**What:** A protected template is used as key material for `1pt` records. If the template is modified after sharing, its content hash changes, and the counterparty's stored template no longer matches — all new records become undecodable for them.

**Rule: protected templates are immutable once shared.**

Any modification to a shared protected template creates a new template (new `id`, new `version`, new hash). The original remains stored for decoding historical records. The new template must be re-shared with the counterparty to enable new records.

**UI implications:**
- Protected templates display a lock icon
- Edit action → "Duplicate and edit" (creates new unprotected draft); original unchanged
- "Share" action on a new template triggers the share flow (OQ-16) and marks it as shared
- Once marked shared: read-only; only "Duplicate and edit" available
- Unprotected templates: freely editable; no hash dependency

**Decision:** Immutability rule confirmed. Rename safe (name excluded from hash). Edit = duplicate and edit. ✓ RESOLVED

**Refinement from Lists design:** Templates reference list content by hash, not by embedding option strings. This means label typos in a list can be fixed by updating the list (new hash, re-share list only) without touching the template. Reduces the surface area of breaking template changes — structural field changes break the hash; list content changes do not.

---

### OQ-19 — Template versioning and historical decode

**What:** Over time a sender may use several versions of a template with the same counterparty (XY3 v1, XY3 v2, XY3 v3). Historical records were encoded with older template hashes. The app must retain all versions for historical decode.

**Proposed: content-addressed template storage.** Templates are stored and looked up by their content hash, not their human-readable `id` or `name`. Multiple versions with the same `name` are stored as separate entries with different hashes. The `1pt` URL carries the template ID (routing hint); the app resolves the ID to the correct hash and uses that for key derivation.

**ID→hash mapping:** The app maintains a local index: `{ template_id → [hash_v1, hash_v2, hash_v3] }`. When decoding a `1pt` record, the app tries each hash for the given ID until one produces a valid commitment check (OQ-14k). The commitment check is how the app knows it found the right version.

**Decision:** Content-addressed storage. Templates stored and looked up by SHA-256 hash. App maintains index: `template_id → [hash_v1, hash_v2, ...]`. Decoder tries each hash; commitment check (OQ-14k) confirms correct version. Consistent with Lists identity model. ✓ RESOLVED

---

## Summary Table

| ID | Category | Topic | Complexity | Blocking? |
|----|----------|-------|-----------|-----------|
| OQ-1 | Constant | Codebook tag string | Low — pick a string | Yes — needed before first URL |
| OQ-2 | Constant | COMPACT_TIME epoch | Low — pick a date | Yes — affects all date encoding |
| OQ-3 | Constant | currency_ext code table | Medium — needs a 30-row table | Yes — blocks multi-currency records |
| OQ-4 | Constant | TAX_CODE 01/10 rates | Low — two percentages | Yes — blocks tax display |
| OQ-5 | Constant | uint length-prefix endianness | Low — pick LE or BE | Yes — a mismatch corrupts all frames |
| OQ-6 | Ambiguity | TAX_CODE: amount stored or computed? | Low — clarify intent | Yes — affects tax accounting |
| OQ-7 | Ambiguity | DOMAIN=11 hybrid mode | **✓ RESOLVED 2026-05-17** — always-on; deterministic matching table; type-change reconciliation; amendment path; DOMAIN=10 integration-only; accounting detail toggle | — |
| OQ-8 | Ambiguity | Amendment: CHAIN or UID for parent? | Medium — affects Amendment structure | No — Amendment implementation is later |
| OQ-9 | Ambiguity | Standard mode 1-bit ROUNDING: accept? | Low — affirm the tradeoff | No — standard mode is secondary |
| OQ-10 | Ambiguity | IS_ORG + individual's org name | Medium — participants block gap | No — uncommon use case |
| OQ-11 | Design gap | FLAGS4 layout for Contact/entity | Medium — needs 5 field definitions | No — Contact/entity template is later |
| OQ-12 | Design gap | QTY_COMPACT for fractional hours | Low — encoder rule of thumb | No — compact mode is optimisation |
| OQ-13 | Design gap | State Commit financial block structure | Medium — new sub-spec needed | No — State Commits are non-MVP |
| OQ-14 | Security layer | Scrambling + encryption wrapper design | **Design complete** — SECURITY-DESIGN.md; OQ-14l–p open | No — MVP records work without it |
| OQ-15 | Template system | Template definition schema + canonical serialisation for hashing | **✓ RESOLVED 2026-05-17** — TEMPLATE-SYSTEM-DESIGN.md; all 11 sub-decisions logged | — |
| OQ-16 | Template system | Template sharing mechanism + fragment URL format | **✓ RESOLVED** — `#t/` and `#te/` fragments; QR/NFC canonical | — |
| OQ-17 | Template system | Form builder field type vocabulary | **✓ RESOLVED 2026-05-17** — 11 types; GPS dual-mode; signature deferred | — |
| OQ-18 | Template system | Protected template immutability + UI policy | **✓ RESOLVED** — immutability rule; edit = duplicate and edit | — |
| OQ-19 | Template system | Template versioning + historical decode (content-addressed storage) | **✓ RESOLVED** — content-addressed; template_id → [hash_v1, hash_v2, …] local index | — |

**Hard blockers before any codec.js work starts:** OQ-1, OQ-2, OQ-5  
**Needed before first real record encodes correctly:** OQ-3, OQ-4, OQ-6  
**Can be deferred to later milestones:** OQ-7 through OQ-13  
**Needed before `1pt` / template features:** OQ-15, OQ-16, OQ-18, OQ-19  
**Needed before form builder:** OQ-17, OQ-18  
**Needed before presentation records (`1pb`):** OQ-20 through OQ-24  
**Needed before contact-resident mode:** OQ-25  
**Needed before JS-in-payload:** OQ-26

---

## Group 6 — Presentation Records (OQ-20 through OQ-26)

These arise from the micro-billboard use case: a `#1pb/` URL payload that renders as a self-contained page experience in a browser or the workpads app. The receptive shell at `workpads.me/p` renders the payload as a display-only or interactive mini-site. The design space covers the display schema, form schema, data source modes, contact-resident display, and structured JavaScript.

---

### OQ-20 — Presentation record tags ✓ RESOLVED

**Decision:** Two separate presentation tags:

| Tag | Name | Purpose | Financial? | Circulation |
|-----|------|---------|-----------|-------------|
| `1pb` | Billboard | Public-facing display — business card, service menu, price list, contact form | No | General public — safe to share anywhere |
| `1pf` | Financial presentation | Customer/worker record views — invoice display, statement, pay summary | Yes | Restricted — extra safety measures, confirmation step before URL generation |

`1pb` is strictly non-financial. No financial block permitted. Safe to share publicly, post as QR, put on a van.  
`1pf` wraps financial record data in a presentation layer. Extra UI confirmation before generating URL. App warns when sharing to general channels. Not for public circulation.

**Tag dispatch (receptive shell):**
```
#1pa/  →  plain pads-v1 record
#1ps/  →  scrambled record (full)
#1ph/  →  scrambled record (partial)
#1pt/  →  template-keyed record
#1pb/  →  public billboard (non-financial)
#1pf/  →  financial presentation (customer/worker)
#l/    →  list share
#t/    →  template share (unencrypted)
#te/   →  template share (encrypted)
```

---

### OQ-21 — Receptive shell architecture ✓ RESOLVED

**Decision:** Single entry point `workpads.me/p` for all tags. Server returns static generic meta tags only (`og:title`="View in Workpads", no content). All rendering is client-side JS reading the fragment. Server-side previewers see nothing sensitive. JS-rendered previewers: acceptable for `1pb` (public by design); encryption handles `1pf`/scrambled records.

---

### OQ-22 — Display schema block ✓ RESOLVED

**Decision:** accent_color optional (shell uses default when absent). DISPLAY_MODE=11 (custom) requires a `1pt` template to be present — decoder falls back to DISPLAY_MODE=00 (card) if template not found locally.

| Field | Type | Notes |
|---|---|---|
| DISPLAY_MODE | 2 bits | 00=card, 01=list, 10=page, 11=custom (requires 1pt template) |
| LAYOUT | 2 bits | 00=single col, 01=two col, 10=hero+body, 11=template-defined |
| accent_color | u24 RGB | Optional — brand colour hint; absent = shell default |
| field_order | byte[] | Ordered field index bytes |
| section_labels | text[] | Optional section heading strings |
| hide_mask | u16 | Bit per field — 1=hide from display even if populated |

---

### OQ-23 — Form schema block ✓ RESOLVED

**Decision:** Display schema and form schema blocks coexist freely in a `1pb` record — no mutual exclusion. Standard pattern: display content (service menu, profile) in upper section, form (contact request, enquiry) below. Both blocks present = show + collect on the same page.

| Field | Type | Notes |
|---|---|---|
| SUBMIT_ACTION | 2 bits | 00=reply record, 01=open URL, 10=native share, 11=in-app action |
| editable_mask | u16 | Bit per field — 1=user can edit |
| required_mask | u16 | Bit per field — 1=required before submit |
| response_template_id | 3 bytes | Template ID for the reply record |
| response_contact | participant | Minimal participant block for reply routing |

---

### OQ-24 — data_source field ✓ RESOLVED

**Decision:** Four data_source modes; fallback behaviour uses options (b) + (c) + (d) combined.

| Code | Mode | Behaviour |
|------|------|-----------|
| 00 | Inline | All values in payload — standard |
| 01 | Contact-resident | Lookup by identifier; fallback per below |
| 10 | Activity profile | Values from sender's Activity record; fallback per below |
| 11 | Anonymous / stealth | Deliberate identity suppression — no sender identity in payload or resolvable from it |

**Fallback behaviour when data_source=01/10 and no local match found:**
- **(b)** Show prompt: "Contact not found — request their details?" with reply action. Turns the miss into a connection opportunity.
- **(c)** If sender included an optional inline fallback block (name + phone, minimal), show it instead of the prompt.
- **(b) + (c)**: show fallback block if present; show prompt if not.

**data_source=11 (anonymous/stealth mode):**
- Deliberate choice — sender wants no identity disclosed.
- Shell shows placeholder text only ("Contact" or sender-configured placeholder string in TRIG bytes).
- Contact form present but `response_contact` absent — no reply routing address in payload.
- Submission handling: `SUBMIT_ACTION=11` (anonymous pickup) — submissions held for sender retrieval via a blind pickup code. Shell stores temporarily; sender retrieves out-of-band. Sender cannot be identified from the URL or the form submission routing.
- Use cases: sensitive service providers, anonymous enquiry channels, identity-suppressed advertising.
- The URL reveals nothing about the sender. Even the shell has no forwarding address.

---

### OQ-25 — Contact-resident display mode ✓ RESOLVED

**Decision:** Match order: phone → email → name. If name alone matches multiple contacts and no secondary identifier is in the payload, treat as no-match (show fallback/prompt). No UI shown for ambiguous resolution — silent exact-match-only rule.

**Payload structure:**
```
meta1 (1pb presentation variant)
display schema block — DISPLAY_MODE, LAYOUT, accent_color (optional)
identifier field    — [u8 len][UTF-8] — primary lookup key
```
Total ~15–20 bytes. Receiver fills display from local contacts on match. No match → fallback per OQ-24 (b/c/d).

---

### OQ-26 — Structured JavaScript in payload ✓ RESOLVED

**Decision:** Full adoption. All options included. Post-MVP named feature with complete spec. TRIG (OQ-32) handles conditions and layout selection; structured JS handles everything beyond that.

**Permitted constructs:**
- DOM manipulation within sandboxed iframe
- `postMessage` to shell (whitelisted message types)
- Event handlers on declared form elements
- `fetch` to pre-declared allowed endpoint list

**Forbidden:** `eval`, `Function()` constructor, `document.write`, cross-origin access outside allowed list, `localStorage`/`sessionStorage`, WebRTC/WebSockets

**Trust gating:**
| Tag | JS permitted? |
|-----|--------------|
| `1pa` plain | No |
| `1pb` public billboard | No |
| `1ph` partial scramble | No |
| `1ps` full scramble | Yes — per-contact code relationship established |
| `1pt` template-keyed | Yes — template must include `"allow_js": true` |
| `1pf` financial presentation | Yes — with `1ps`/`1pt` security applied |

**Sandboxing:**
```html
<iframe sandbox="allow-scripts allow-forms allow-same-origin">
  <!-- payload JS runs here -->
</iframe>
```

**postMessage API (shell ↔ payload):**
```js
{ type: 'submit',    data: { ... } }      // form submit
{ type: 'resize',    height: 400 }        // request height change
{ type: 'navigate',  url: '...' }         // open URL (shell decides if safe)
{ type: 'store',     key, value }         // write to shell-managed store (no direct localStorage)
{ type: 'retrieve',  key }               // read from shell-managed store
{ type: 'contact',   identifier }         // request contact lookup (shell resolves, returns match/no-match)
{ type: 'trigger',   opcode, args }       // invoke TRIG instruction from JS (bridge to trigger language)
```

**Two delivery modes:**

**Inline JS** (payload < 1KB compressed):
- JS source embedded directly in frame as a data block
- Encoded as standard text field [u16 len][UTF-8]
- Deflate compresses repetitive JS well — 500B source → ~300B compressed → ~400 URL chars

**Fetch-target** (payload ≥ 1KB compressed, or for updatable scripts):
```js
{ js_src: "https://cdn.example.com/app/v1.js", js_hash: "<sha256-hex>" }
```
- Shell fetches only if SHA-256 of fetched content matches `js_hash`
- Content integrity pinned to URL — script can be updated server-side as long as hash matches
- URL stays short regardless of script size
- Server involvement acceptable: hash pins content; server cannot inject malicious code

**CSS delivery** (same two modes):
- Inline CSS: embedded text field, deflate-compressed
- Fetch-target CSS: `{ css_src, css_hash }` — same integrity model as JS
- TRIG `LOAD_CSS` opcode references shell-side codebook IDs for zero-byte CSS loading from pre-registered styles

**Combined TRIG + JS architecture:**
```
TRIG bytes (2–20B)  →  conditions + layout selection + CSS load
Inline/fetch JS     →  custom logic, animations, complex forms, dynamic content
postMessage bridge  →  JS ↔ shell communication (contact lookup, store, navigate)
```

---

### OQ-27 — Activity group membership in wire format ✓ RESOLVED

**Decision:** Option A for MVP — IS_ORG=1 participant in participants block carries the activity/business name. User can choose to exclude it at share time (share sheet toggle: "Include business identity" on/off). Exclusion is valid for privacy or anonymous sharing contexts.

Post-MVP: Option C — Activity pre-shared as a `1pb` contact card; records carry a short UID reference only. Lightweight per record once the Activity card is distributed.

---

### OQ-32 — TRIG display trigger bytecode ✓ SPEC COMPLETE

**Status:** Active design — spec complete, implementation pending.  
**Context:** `1pb` and `1pf` records need a way to program the receptive shell's rendering behaviour so that bots and scrapers see nothing, while qualifying viewers see the full card/form/menu. TRIG is a 1–20 byte bytecode program embedded in the frame. The URL fragment is never sent to the server; bots can't trigger JS execution; the page looks blank to casual inspection.

---

#### Architecture overview

**Inspiration sources (from research):** NibbleForth nibble encoding; WASM LEB128 variable-length immediates; NDEF TNF type system; PostScript/Forth stack machine; Huffman opcode assignment (frequent ops = shorter encoding); CBOR type system; NDEF Smart Poster pre-compiled pattern tokens.

**Two modes:**
1. **Pattern token** (1 byte, high nibble = `0x0`): single-byte alias for the 16 most common programs. Stack machine never entered.
2. **Bytecode program** (2–20 bytes): header byte + instruction stream. Stack machine evaluation.

---

#### Pattern tokens — 1-byte mode

A lone byte `0x0P` (high nibble = 0, low nibble = pattern ID P) is the complete program:

| Token | Name | Behaviour |
|-------|------|-----------|
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

**Pattern + CSS theme** (2-byte extension): `0x0P 0x1T` — pattern P with CSS theme T (0–15 from theme codebook). Example: pattern 0x01 with dark theme = `0x01 0x13`.

---

#### Bytecode header byte (byte 0 for programs)

Any program where high nibble ≠ `0x0` is a bytecode program. The first byte is:

```
Byte 0: [VER:2][HAS_CSS:1][HAS_TERNARY:1][PROG_LEN:4]
```

- **VER** (bits 7–6): `00` = TRIG v1. Shells that see an unknown VER render BLANK gracefully.
- **HAS_CSS** (bit 5): 1 if the program contains a LOAD_CSS instruction (optimiser hint — shell can pre-fetch)
- **HAS_TERNARY** (bit 4): 1 if the program uses the 4-byte TERNARY shortcut
- **PROG_LEN** (bits 3–0): number of instruction bytes that follow. Values 1–14 = direct length. Value 15 = extended — next byte carries length as 15 + byte value (range 15–269, though max 20 is the frame limit)

---

#### Instruction set — nibble-encoded opcodes

Each instruction byte: `[OP:4][ARG:4]`

OP = operation (high nibble), ARG = inline immediate value 0–14. ARG = 15 means "read next byte for actual value" (allows extended ranges where needed).

| OP (hex) | Mnemonic | ARG meaning | Stack effect |
|----------|----------|-------------|-------------|
| `0x0_` | PATTERN | pattern_id (0–15) → inline full program | → |
| `0x1_` | LOAD_CSS | codebook_id (0–14) | side effect |
| `0x2_` | SET_LAYOUT | layout_id (0–14) | side effect |
| `0x3_` | SHOW | display_mode (0–7) | bool → (render if true, BLANK if false) |
| `0x4_` | SHOW_ALWAYS | display_mode (0–7) | — (unconditional render) |
| `0x5_` | AND | count (2–14, pop N bools) | N bools → 1 bool |
| `0x6_` | OR | count (2–14, pop N bools) | N bools → 1 bool |
| `0x7_` | NOT | 0 | bool → bool |
| `0x8_` | JZ | skip_bytes (0–14) | bool → (skip N bytes if false) |
| `0x9_` | TERNARY | 0; next 3 bytes = cond_id, mode_true, mode_false | — (full conditional render, 4 bytes total) |
| `0xA_` | LOAD_JS | codebook_id (0–14) | side effect |
| `0xB_` | SET_THEME | theme_id (0–14) | side effect |
| `0xC_` | BLOOM | 0; next 2 bytes = 16-bit filter operand | → bool |
| `0xD_` | PUSH_COND | condition_id (0–14) | → bool |
| `0xE_` | PUSH_LIT | literal: ARG bit 0 (0=false, 1=true) | → bool |
| `0xF_` | EXTENDED | next byte = full 8-bit opcode | varies |

**Note on `0x0_` as instruction:** Inside a bytecode program, a PATTERN instruction (`0x0P`) splices in the full equivalent of pattern P at that point — useful when a common pattern forms part of a larger program. The shell replaces the instruction with the inline equivalent program steps before evaluating.

---

#### Condition registry (PUSH_COND ARG / TERNARY cond_id)

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
| 9 | APP_VERSION_OK | Viewer app version ≥ version floor declared in record |
| 10 | REPLY_PENDING | Viewer has an unsent reply queued for this sender |
| 11 | LOCATION_NEAR | Device location within stated radius of record geo block (requires geo block present) |
| 12–14 | RESERVED | Future conditions |

---

#### Display modes (SHOW / SHOW_ALWAYS / TERNARY ARG)

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

---

#### CSS codebook (LOAD_CSS ARG 0–14)

Shell-side CSS modules loaded by 1-byte ID. CSS bytes never travel in the URL.

| ID | Module | Description |
|----|--------|-------------|
| 0 | BASE | Reset, mobile-safe spacing, base font |
| 1 | CARD_LIGHT | White card, shadow, clean typography |
| 2 | CARD_DARK | Dark card variant |
| 3 | FORM_STD | Input fields, labels, submit button |
| 4 | SERVICE_LIST | Compact service/price list layout |
| 5 | BILLBOARD | Large-format with accent colour support |
| 6 | MINIMAL | Absolute minimum — name + icon |
| 7–14 | RESERVED | Future CSS modules |

---

#### Theme codebook (SET_THEME ARG 0–14)

Applied on top of the loaded CSS module as a colour/font overlay.

| ID | Theme |
|----|-------|
| 0 | NEUTRAL (grey/white, default) |
| 1 | WARM (amber/cream) |
| 2 | COOL (blue/white) |
| 3 | DARK (dark background) |
| 4–14 | RESERVED |

---

#### JS codebook (LOAD_JS ARG 0–14)

Pre-registered JS modules the shell can load by 1-byte ID. Extends the inline/fetch-target JS from OQ-26.

| ID | Module | Function |
|----|--------|----------|
| 0 | CONTACT_FORM | Standard contact request form logic |
| 1 | BOOKING_FORM | Date/service selection + booking submit |
| 2 | REPLY_ROUTER | Routes form submission as a reply record |
| 3–14 | RESERVED | Domain-specific JS modules |

---

#### TERNARY instruction (4 bytes)

The most expressive single construct in TRIG. Handles the "show X to audience A, Y to audience B" pattern cleanly without a JZ ladder.

```
0x90  cond_id  mode_true  mode_false
```

- `0x90` — TERNARY opcode (OP=9, ARG=0)
- `cond_id` — full byte (0–255; values 0–11 are the standard registry above)
- `mode_true` — display mode to render if condition is true
- `mode_false` — display mode if false (0xFF = BLANK; 0xFE = NATIVE)

Example: Show CARD to known contacts, FORM to everyone else:
```
0x90 0x01 0x00 0x02
```
= TERNARY(KNOWN_CONTACT, CARD, FORM) — 4 bytes, no header needed if this is the whole program.

Wait — if using TERNARY as the entire program with no header, it occupies bytes 0–3. To distinguish from a pattern token, the first byte must have high nibble ≠ `0x0`. TERNARY starts with `0x90`, high nibble = `0x9` ✓ — so it IS a bytecode program, and byte 0 is the header.

Correction: if the full program is just a TERNARY, it needs a header byte:
```
[header: VER=00, HAS_TERNARY=1, LEN=4]  0x90  cond_id  mode_true  mode_false
```
Header = `0001_0100` = `0x14`. Full program = `0x14 0x90 0x01 0x00 0x02` (5 bytes).

---

#### BLOOM instruction — anti-bot Bloom filter (3 bytes)

```
0xC0  bloom_hi  bloom_lo
```

Pushes `true` onto the stack if the viewer's JS environment passes a 16-bit capability Bloom filter. The filter tests a declared subset of browser capability checks that bots typically cannot fake:

| Bit | Test |
|-----|------|
| 15 | `requestAnimationFrame` timing consistency (≥60fps) |
| 14 | `PointerEvent` or `TouchEvent` support |
| 13 | Clipboard API accessible |
| 12 | `IntersectionObserver` present |
| 11 | `CSS.supports()` returns expected value for accent-color |
| 10 | Canvas fingerprint entropy passes threshold |
| 9–0 | RESERVED (future capability checks) |

The 16-bit operand is a bitmask selecting which checks to AND together. Example: `0xF0 0x00` = test bits 15, 14, 13, 12 (rAF timing + touch + clipboard + IntersectionObserver).

**Use:** BLOOM followed by SHOW = content visible only in a real interactive browser. Scrapers and headless fetchers fail the filter and the stack remains false.

Example: Show card if human-browser + known contact (6 bytes):
```
[header: LEN=5]  BLOOM(0xF0,0x00)  PUSH_COND(KNOWN_CONTACT)  AND(2)  SHOW(CARD)
= 0x05  0xC0 0xF0 0x00  0xD1  0x52  0x30
```

---

#### Wire format in frame

TRIG bytes occupy the **TRIG block** within the display_schema block (section 11 of FRAME-SPEC.md). The block is present when `HAS_TRIG=1` in display_schema flags.

```
[TRIG_LEN: u8]  [TRIG_BYTES: N bytes, N = TRIG_LEN]
```

- **TRIG_LEN = 0**: block present but empty → shell uses SHOW_ALWAYS NATIVE default
- **TRIG_LEN = 1**: pattern token (exactly 1 byte)
- **TRIG_LEN 2–20**: bytecode program; byte 0 is header
- **Maximum**: 20 bytes. Programs longer than 20 bytes are a spec error; shell renders BLANK on overflow.

---

#### Example programs with byte counts

| Use case | TRIG bytes | Hex |
|----------|-----------|-----|
| Show card to all (default) | 1 | `0x00` |
| Show card to known contacts only | 1 | `0x01` |
| Show form to all | 1 | `0x08` |
| Show service menu, known contacts only | 1 | `0x0B` |
| Always blank (stealth) | 1 | `0x07` |
| Show card, dark theme | 2 | `0x01 0x13` |
| Show card if human (anti-bot) | 1 | `0x04` |
| Show card if known contact, form if not | 5 | `0x14 0x90 0x01 0x00 0x02` |
| Show card if has_app AND known_contact | 5 | `0x04 0xD0 0xD1 0x52 0x30` |
| Show card with BLOOM filter + dark CSS | 7 | `0x06 0xC0 0xF0 0x00 0x13 0x30 0x40` |
| Service menu + CSS BILLBOARD + warm theme | 4 | `0x03 0x15 0x11 0x41` |
| Known contact → card, human → form, else blank (JZ ladder) | 9 | `0x08 0xD1 0x83 0x40 0x00 0xD3 0x83 0x32 0x05` |

---

#### Version upgrade path

VER bits (bits 7–6 of header byte) provide 3 additional version slots (01, 10, 11). A shell receiving an unknown VER renders BLANK and does not crash. Version upgrade is non-breaking from the sender's perspective — old shells degrade gracefully.

---

#### Relationship to OQ-26 (structured JS)

TRIG and structured JS (OQ-26) are complementary, not competing:

| Layer | Tool | Use for |
|-------|------|---------|
| Conditions + gating | TRIG | Who sees what, which CSS/theme/layout |
| Custom logic | Inline JS | Complex forms, animations, dynamic content |
| Large scripts | Fetch-target JS | Full micro-apps |
| Shell bridge | postMessage | JS ↔ contacts / storage / navigation |

TRIG always evaluates first. If TRIG result = BLANK, no JS is evaluated. If TRIG result = FORM or CARD, inline/fetch JS (if present) then executes in the sandboxed iframe.

The postMessage `trigger` type from OQ-26 allows running JS to invoke TRIG opcodes at runtime (e.g. dynamically loading a CSS theme after a user preference is set).

---

#### Open sub-questions within OQ-32

- **OQ-32a**: Should BLOOM bit definitions be versioned with TRIG VER, or fixed to a separate capability codebook version? (Low priority — v1 can hardcode.)
- **OQ-32b**: Should the EXTENDED opcode space (0xF_) reserve a range for user-defined opcodes, or is it entirely reserved for future TRIG spec revisions?
- **OQ-32c**: TRIG block location in frame ✓ RESOLVED — Option B: meta2 bit 5 (`HAS_TRIG_BLOCK`). TRIG is a top-level block appearing after the participants block. display_flags2 bit 2 freed. FRAME-SPEC §2 and §13 to be updated.

---

---

### OQ-34 — Agreements and Commitment Protocol ✓ DRAFT-SPEC 2026-05-17

**Status:** Draft-spec complete — AGREEMENTS-DESIGN.md hardened 2026-05-17

Three-tier design in progress: (1) Light agreement — State Commit + ACK_REQUEST chain, Tier 1 for v1.0. (2) Structured Agreement — clause block, milestone dates, per-clause acceptance, post-MVP. (3) Commitment Protocol — evaluatable condition bytecode (TRIG-adjacent), long-term.

**Resolved sub-questions:**
- OQ-34a: EXT_TEMPLATE domain extension ✓ (BASE_TEMPLATE=111 stays Generic)
- OQ-34b: New clause block structure ✓ (defined in §3.2)
- OQ-34c: 1-byte ratification bitmap ✓ (bits 0–6 parties; bit 7 FULLY_RATIFIED)
- OQ-34d: State machine defined ✓ (PROPOSED→REVIEWED→ACCEPTED→ACTIVE→COMPLETED/DISPUTED/CANCELLED)
- OQ-34e: Separate C-TRIG evaluator, shared condition registry ✓
- OQ-34f: Acceptance granularity — Tier-dependent: whole-record (T1), per-clause bitmask (T2+) ✓
- OQ-34g: Dispute protocol — C-TRIG DISPUTE + Amendment (with Amendment-only fallback) ✓
- OQ-34h: Offline Marker writes — hardware fully offline; software queued or P2P ✓

**Key design reference:** AGREEMENTS-DESIGN.md (draft-spec), MARKERS-DESIGN.md (draft-spec)

---

### OQ-35 — Markers: Electronic Commitment Coins ✓ DRAFT-SPEC 2026-05-17

**Status:** Draft-spec complete — MARKERS-DESIGN.md hardened 2026-05-17

Markers are physical/software tokens that hold a ratified workpads commitment. Write-once by two parties; permanently read-only after ratification. Hardware target: NTAG215 NFC sticker (504B). Software fallback: server-side WORM with signed seal.

**Immediate sub-questions:**
- OQ-35a (OQ-M1): UID assignment ✓ — deterministic derivation; phone-hash proxy
- OQ-35b (OQ-M2): Write sequencing ✓ — either party writes first
- OQ-35c (OQ-M5): `#1pm/` tag ✓ — registered in TAG-REFERENCE.md
- OQ-35d (OQ-M6): Offline write ✓ — prev_stone_hash ordering; hardware fully offline; software P2P option (Option E) added
- OQ-35e (OQ-M3): Multi-party ✓ — up to 7 slots; threshold sealing
- OQ-35f: Software P2P Marker ✓ — Option E: direct device exchange, no internet, QR/NFC token swap protocol

**Key design reference:** MARKERS-DESIGN.md, AGREEMENTS-DESIGN.md §4

---

### OQ-36 — Attachment: Image Quality Tiers and Inline Thumbnails

**Status:** Active design — ATTACHMENT-DESIGN.md created 2026-05-17

Four-tier progressive image delivery: Tier 0 = inline thumbnail in frame (ThumbHash/quantized, ~40–80B); Tier 1 = 320×240 JPEG Q40 (~10–20KB, 2G-viable); Tier 2 = 800×600 JPEG Q65 (~80KB, 3G); Tier 3 = full resolution on demand.

**Immediate sub-questions:**
- OQ-36a: ThumbHash (~3KB JS library) vs quantized 8×8 grid (no library) — memory constraint tradeoff for KaiOS
- OQ-36b: Attachment field URL format — `t0:<thumbhash>:<url>?t=<tiers>` — finalise delimiter convention
- OQ-36c: Multi-image encoding — comma-separated in one attachment field vs compound block vs FLAGS4 second slot
- OQ-36d: Offline upload deferral — how to handle frame-shares before Tier 1 upload completes

**Key design reference:** ATTACHMENT-DESIGN.md

---

### OQ-37 — Project Association: Structured Multi-Project Linking

**Status:** Active design — PROJECT-ASSOCIATION-DESIGN.md created 2026-05-17

MVP uses `proj:uid` prefix in tag field (FLAGS3 bit 1). Financial items: max 1 project. Service records: multiple OK. Long-term: dedicated `project_ref` block needed for typed UID arrays.

**Immediate sub-questions:**
- OQ-37a: Tag field max 60B — enough for two `proj:uuid` entries on service records? (UUID v4 = 36 chars, `proj:` = 5 chars → 2 projects = 82B — exceeds limit; need truncated UIDs or larger field)
- OQ-37b: Project record type — BASE_TEMPLATE=000 Service + project template variant, or BASE_TEMPLATE=111 Generic + DOMAIN bits?
- OQ-37c: Project UID stability — stable `project_uid` field in FLAGS4 future slot, separate from the record's own uid?

**Key design reference:** PROJECT-ASSOCIATION-DESIGN.md

---

### OQ-38 — Chain UID Exposure in URL Suffix

**Status:** Design note — pending post-MVP decision

The `&c=<parent_uid>` chain parameter in the URL is metadata-visible even when the frame payload is encrypted. An observer can map chain topology (who chains to whom) without decrypting content.

**Options:**
- Option C (current MVP): accept topology metadata leak — low-risk for most use cases
- Option A (post-MVP): hashed chain ref `&c=H(uid, record_key)` — topology hidden from observers, resolvable only by key holders
- Option B (structural change): move parent ref inside the frame — fully private but costs 2+ bytes and breaks the URL-portable chain model

**Decision for MVP:** Option C. Flag for v1.1 review when privacy threat model is assessed against real usage patterns.

---

### OQ-39 — Data Sync Bundle

**Status:** **RESOLVED — Option C** — record-first, missing dependencies fetched and installed silently in background on first open. Cached locally after that for offline use.

A sequenced payload mechanism that hydrates the receiver's app (lists, templates, contact data) before delivering the target record. The final link is the record; prior links outfit the app so it renders correctly.

**Concept:**
```
[list_payload_1] → [template_payload] → [contact_data] → [record]
```
Each payload in the sequence installs something locally on the receiver's device. When all dependencies are loaded, the final record displays with full fidelity. Eliminates "template not found" and "list not found" degraded experiences.

**Connection to:** Template System design session (OQ-15–19), CDN architecture, `#te/` template distribution, `#l/` list sharing.

---

## Summary Table (updated)

| ID | Category | Topic | Complexity | Blocking? |
|----|----------|-------|-----------|-----------|
| OQ-1 | Constant | Codebook tag string | Low | Yes — needed before first URL |
| OQ-2 | Constant | COMPACT_TIME epoch | Low | Yes — affects all date encoding |
| OQ-3 | Constant | currency_ext code table | Medium | Yes — blocks multi-currency records |
| OQ-4 | Constant | TAX_CODE 01/10 rates | Low | Yes — blocks tax display |
| OQ-5 | Constant | uint length-prefix endianness | Low | Yes — mismatch corrupts all frames |
| OQ-6 | Ambiguity | TAX_CODE: stored or computed? | Low | Yes — affects tax accounting |
| OQ-7 | Ambiguity | DOMAIN=11 hybrid mode | **✓ RESOLVED 2026-05-17** | — |
| OQ-8 | Ambiguity | Amendment: CHAIN or UID for parent? | Medium | No |
| OQ-9 | Ambiguity | Standard mode 1-bit ROUNDING | Low | No |
| OQ-10 | Ambiguity | IS_ORG + individual's org name | Medium | No |
| OQ-11 | Design gap | FLAGS4 layout for Contact/entity | Medium | No |
| OQ-12 | Design gap | QTY_COMPACT for fractional hours | Low | No |
| OQ-13 | Design gap | State Commit financial block structure | Medium | No |
| OQ-14 | Security layer | Scrambling + encryption wrapper | **Design complete** — SECURITY-DESIGN.md | No — MVP works without it |
| OQ-15 | Template system | Template definition schema + canonical serialisation | **✓ RESOLVED 2026-05-17** | — |
| OQ-16 | Template system | Template sharing mechanism + fragment URL format | **✓ RESOLVED** | — |
| OQ-17 | Template system | Form builder field type vocabulary | **✓ RESOLVED 2026-05-17** | — |
| OQ-18 | Template system | Protected template immutability + UI policy | **✓ RESOLVED** | — |
| OQ-19 | Template system | Template versioning + historical decode | **✓ RESOLVED** | — |
| OQ-20 | Presentation | `#1pb/` tag + use case scope | Low | No — needed before `1pb` implementation |
| OQ-21 | Presentation | Receptive shell architecture | Low | No — needed before `1pb` implementation |
| OQ-22 | Presentation | Display schema block | Medium | No — needed before `1pb` implementation |
| OQ-23 | Presentation | Form schema block | Medium | No — needed before `1pb` implementation |
| OQ-24 | Presentation | data_source field modes | Medium | No — needed before `1pb` implementation |
| OQ-25 | Presentation | Contact-resident display mode | Medium | No — needed before contact-resident mode |
| OQ-26 | Presentation | Structured JavaScript in payload | High | No — deferred post-MVP |
| OQ-27 | Design gap | Activity group membership in wire format | Medium | No — MVP uses IS_ORG participant |
| OQ-28 | Design gap | `service_ref` field — FLAGS4 bit 0 for financial records ✓ RESOLVED | Low | — |
| OQ-33 | Design gap | Inline activity bundle — piggyback compact service list + business profile alongside a record | Medium | No — post-MVP |
| OQ-29 | Design gap | Compound line item type flag — 2-bit `line_type` for payroll deduction breakdown | Medium | No — needed before Full pay mode |
| OQ-30 | Design gap | Cross-device registered short IDs — deferred. app_uid + phone/email covers all current use cases. Handle registry is a product decision for later. | Medium | Deferred |
| OQ-31 | Design gap | `alt_id` in participants block ✓ RESOLVED — Option A: ROLE_TYPE packed into 2 bits (6 quick-select roles: Customer, Worker, Supplier, Subcontractor, Employee, Agent; Authority via role_code path). Bit freed for HAS_ALT_ID. | Medium | — |
| OQ-32 | Presentation | TRIG display trigger bytecode ✓ SPEC COMPLETE — 1–20 byte stack VM; nibble-encoded opcodes; 12 pattern tokens; condition registry; CSS/JS/theme codebooks; BLOOM anti-bot filter; TERNARY 4-byte shortcut; VER upgrade path | High | No — needed before `1pb`/`1pf` conditional rendering |
| OQ-33 | Design gap | Inline activity bundle — piggyback compact service list + business profile alongside a record | Medium | No — post-MVP |

| OQ-34 | Design gap | Agreements and Commitment Protocol | **✓ DRAFT-SPEC 2026-05-17** — EXT_TEMPLATE, tier-dependent acceptance, C-TRIG+Amendment dispute, wire encoding summary | — |
| OQ-35 | Design gap | Markers — electronic commitment coins | **✓ DRAFT-SPEC 2026-05-17** — all OQ-Ms resolved; P2P software Marker (Option E) added; wire encoding summary | — |
| OQ-36 | Design gap | Attachment image quality tiers — progressive delivery, inline ThumbHash, 2G-viable Tier 1 | Medium | No — needed before camera integration |
| OQ-37 | Design gap | Project association — financial items max 1 project; structured project UID linking post-MVP | Medium | No — MVP uses tag field convention |
| OQ-38 | Security | Chain UID exposure in URL suffix — Option C (accept) for MVP, hashed ref post-MVP | Low | No |
| OQ-39 | Design concept | Data Sync Bundle — sequenced dependency hydration before record delivery | **Resolved — Option C** | — |
| OQ-40 | Research session | C-TRIG extended condition registry — escape byte design, condition namespaces, enforceable agreement complexity | **Research complete** — OQ-40c resolved (Option B: halt+re-trigger); OQ-40e resolved (Option C: no gates); OQ-40f resolved (Option C: low-nibble threshold). OQ-40a, OQ-40b, OQ-40d still open. See C-TRIG-EXTENDED-CONDITIONS.md | No — C-TRIG is long-term |
| OQ-41 | Design gap | C-TRIG evaluator architecture — stack machine, opcode table, COMPARE_AMT, VERSION escape, BRANCH semantics | **✓ DRAFT-SPEC 2026-05-17** — CTRIG-EVALUATOR-DESIGN.md; all opcodes specified; §7 pseudocode complete | — |

**Hard blockers before any codec.js work starts:** OQ-1 ✓, OQ-2 ✓, OQ-5 ✓  
**Needed before first real record encodes correctly:** OQ-3 ✓, OQ-4 ✓, OQ-6 ✓  
**Resolved:** OQ-7 ✓ (DOMAIN=11 hybrid — always-on, deterministic matching table, amendment path, DOMAIN=10 integration-only)  
**Resolved non-blockers:** OQ-8 ✓, OQ-9 ✓, OQ-10 ✓, OQ-11 ✓, OQ-12 ✓, OQ-13 ✓  
**Template system fully resolved:** OQ-15 ✓, OQ-16 ✓, OQ-17 ✓, OQ-18 ✓, OQ-19 ✓ — see TEMPLATE-SYSTEM-DESIGN.md  
**Needed before presentation records:** OQ-20 ✓, OQ-21–OQ-25 (in progress)  
**TRIG spec complete:** OQ-32 ✓ — implement when `1pb`/`1pf` shell begins  
**Post-MVP / advanced:** OQ-26, OQ-27, OQ-28, OQ-30, OQ-31, OQ-33  
**Needed before Full payroll mode:** OQ-29  
**Needed before period reports:** date_end FLAGS3 slot (STANDARD-FIELDS.md update)
