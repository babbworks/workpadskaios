# TAG-REFERENCE — pads-v1 URL Tag Reference

**As of:** 2026-05-17  
**Status:** Permanent reference — update when new tags are added  
**Depends on:** FRAME-SPEC.md, OPEN-QUESTIONS.md §OQ-32  
**Future location:** `dev_refs/TAG-REFERENCE.md`

---

## 1. URL Structure

```
https://workpads.me/p#<tag>/<base64url-deflated-frame>
```

For list shares:

```
https://workpads.me/p#l/<base64url-deflated-list>
```

The fragment (`#...`) is never sent to the server. All decoding happens client-side in the shell. Link-preview bots and search engine crawlers never see the payload. This is a fundamental privacy property — not a workaround.

**Encoding pipeline (encode direction):**

```
[pads-v1 frame bytes]
  → deflate-compress
  → base64url-encode (no padding)
  → embed as URL fragment: workpads.me/p#<tag>/<encoded>
```

**Decoding pipeline (decode direction):**

```
URL fragment
  → strip tag prefix (e.g. "1pa/")
  → base64url-decode
  → deflate-decompress
  → parse pads-v1 frame bytes
```

For scrambled tags (`#1ps/`, `#1ph/`, `#1pt/`), a security wrapper is applied after the frame and before base64url. See §5 below.

---

## 2. Tag Dispatch Table

| Tag | Full name | Wire content | Security level | JS permitted | Public circulation? | Notes |
|-----|-----------|-------------|----------------|--------------|---------------------|-------|
| `#1pa/` | Plain record | pads-v1 frame, no wrapper | None | No | Only to named recipients | Standard financial, service, and contact records |
| `#1pb/` | Public billboard | pads-v1 frame with display_schema | None | No | Yes — safe for public URLs, QR codes, broadcast | Non-financial only. Never carries executable logic. |
| `#1pf/` | Financial presentation | pads-v1 frame with display_schema | None (combine with `#1ps/` or `#1pt/`) | Yes (with `#1ps/` or `#1pt/`) | No — named recipients only | Invoice views, statements, pay summaries. Share-sheet warns before generating. |
| `#1ps/` | Full scramble | pads-v1 frame inside AES-CTR + field scramble wrapper | Strong — per-contact passphrase | Yes | No | Private/colleague records, cost data, pay records. Required for `worker_amount` and EXPENSE_CAT=01/10. |
| `#1ph/` | Partial scramble | Header bytes plain (meta1–transaction_byte); field data + financial block encrypted | Medium | No | No | Receiver sees record type before entering code. |
| `#1pt/` | Template-keyed | pads-v1 frame encrypted; template content is the key | Strong — template-keyed | Yes (if template has `allow_js: true`) | Conditionally — depends on template sensitivity | Template ID visible in URL; meaningless without template content. |
| `#l/` | List share | Deflated list content (not a pads-v1 record frame) | None | No | Yes | Standalone option list for form builder multi-select fields. Receiver app assigns local ID on import. |
| `#1pm/` | Marker record | pads-v1 RATIFIED_FRAME (State Commit, bilateral) — served from Marker UID lookup | Strong — Marker UID + optional PIN | No | No — named parties + verifiers | Read-only after ratification. Marker UID may be NFC chip UID or server-registered UUID. See MARKERS-DESIGN.md. |

---

## 3. Security Level Detail

What an interceptor sees at each security level.

### `#1pa/` — No security

Record structure and all field data visible to anyone who decodes the fragment. Appropriate for customer-facing records where the sender does not mind the receiver forwarding or screenshot-sharing.

An interceptor with the URL can extract: job title, customer name, date, location, reference number, financial amounts, participant names and phone numbers — anything present in the record.

### `#1pb/` — No security (public by design)

Same raw visibility as `#1pa/`. Designed for public display — business cards, service menus, contact forms. Link-preview bots see nothing because they do not execute JavaScript and do not process URL fragments. TRIG bytecode (if present) gates rendering client-side, so a human without the app also sees nothing without the shell. Direct fragment decoding by a determined recipient reveals all display content — this is intentional for public billboard use.

### `#1pf/` — No security (presentation friction only)

Same raw visibility as `#1pa/`. The `#1pf/` tag is a signal to the share sheet and the app UI only — it triggers extra friction (user confirmation, channel warning) to reduce accidental exposure. It does not encrypt anything. For financial records with actual amounts, `#1pf/` must be combined with `#1ps/` or `#1pt/` for real protection.

An interceptor who has the URL can decode the same fields as `#1pa/`.

### `#1ps/` — AES-CTR full scramble

An interceptor who has the URL sees (after decoding the fragment):

- **Preamble byte**: SCRAMBLE, AES, HMAC, SEED_POISON flags and KEY_HINT
- **meta1**: template type (BASE_TEMPLATE bits), chain flag, recipient flag — these header bits are not encrypted
- **meta2**: DOMAIN, COMPACT_TIME, PARTICIPANTS, DRAFT, RESTRICT_FORWARD flags
- **setup_byte**: DECIMAL_POS, CURRENCY type (not the amount), TAX_CODE, SF_PRESENT
- **transaction_byte**: DIRECTION, TIME, EFFECT, QTY_SPLIT, ROUNDING — the I>O state is visible

Everything after the transaction_byte is AES-CTR encrypted with a seed-poisoned deflate wrapper. Field names, amounts, dates, customer names, participant names, reference numbers — all encrypted. Without the shared key, the interceptor knows the record is a `O<O` settled expense in GBP with 2 decimal places, but nothing more.

### `#1ph/` — Partial scramble

An interceptor sees everything `#1ps/` exposes above (the unencrypted header bytes), PLUS all field data is also visible. Only the financial block (customer_amount, worker_amount, tax_block) and the participants block are encrypted.

The receiver sees record type, date, job title, and customer name before entering a code. This is the design intent: partial reveal to help the receiver identify what the record is before committing to decryption.

### `#1pt/` — Template-keyed

Same encrypted visibility as `#1ps/`. The encryption key is derived from the template content via SHA-256 — anyone with the template can decode; anyone without it cannot. The template ID is visible in the URL payload as a plaintext prefix. An interceptor knows which template was used; they cannot read the record without the template.

---

## 4. Tag Auto-Selection Rules

The share sheet auto-selects a tag based on record content. Rules apply in priority order.

| Condition | Auto-selected tag | Can user override? |
|-----------|------------------|--------------------|
| EXPENSE_CATEGORY=01 (job cost / COGS) | `#1ps/` | No — enforced |
| EXPENSE_CATEGORY=10 (running cost / overhead) | `#1ps/` | No — enforced |
| `worker_amount` field present | `#1ps/` | No — enforced |
| RECIPIENT_TYPE=1 in meta1 (named recipient) | `#1ps/` | Yes — can downgrade to `#1pa/` |
| Financial data, customer-facing invoice | `#1pa/` | Yes — can upgrade to `#1ps/` or `#1pt/` |
| Presentation record, non-financial | `#1pb/` | Yes |
| Financial presentation record | `#1pf/` | Yes — must combine with `#1ps/` or `#1pt/` for security |
| Template-keyed content | `#1pt/` | Yes |

**Enforcement note:** The codec itself does not enforce the no-override rules. The app share sheet enforces them. A developer writing a custom encoder could bypass them — this is a known design choice. The spec document hierarchy is: codec is correct → share sheet is safe → enforcement lives in the UX layer.

---

## 5. Fragment Structure by Tag

What the decoded fragment contains for each tag, at the binary level.

### `#1pa/` — Plain record

```
[pads-v1 frame]
```

No wrapper. The frame begins with `meta1` at byte 0.

### `#1pb/` — Public billboard

```
[pads-v1 frame with display_schema block]
  + optional [TRIG block]       (inside display_schema, if HAS_TRIG=1 in display_flags2)
  + optional [form_schema block]
```

The display_schema block is part of the frame (FRAME-SPEC.md §11). TRIG bytes live inside it.

### `#1pf/` — Financial presentation

```
[pads-v1 frame with display_schema block]  (financial record type)
```

Wire format identical to `#1pb/`. The tag signals presentation intent to the shell and the share sheet. For security, the `#1ps/` or `#1pt/` wrapper is applied first; the `#1pf/` tag then signals to the shell that financial safety measures apply. In practice: share sheet generates a `#1ps/` URL; the tag in the fragment is `1pf/`.

### `#1ps/` — Full scramble

```
[preamble_byte][AES-CTR(seed-poisoned-deflate([pads-v1 frame]))][HMAC_tag?]
```

- `preamble_byte` (1 byte): SCRAMBLE, AES, HMAC, SEED_POISON flags + KEY_HINT nibble. See §7 for preamble byte detail.
- AES-CTR cipher text: the deflated and seed-poisoned frame, encrypted in place
- `HMAC_tag` (8 bytes, optional): present if HMAC=1 in preamble; commits to receiver identity

### `#1ph/` — Partial scramble

```
[preamble_byte][meta1..transaction_byte plain (4 bytes)][AES-CTR([field_flags..end of frame])]
```

- Bytes 0–4 (meta1, meta2, setup_byte, transaction_byte) are transmitted in plain
- Everything from field_flags onward is AES-CTR encrypted

### `#1pt/` — Template-keyed

```
[template_id: u8][preamble_byte][AES-CTR([pads-v1 frame])]
```

- `template_id` (1 byte): identifies which template provides the key
- `preamble_byte` (1 byte): same structure as `#1ps/`
- AES-CTR cipher text: frame encrypted with key = SHA-256 of template content

### `#l/` — List share

```
[deflated list content]
```

Not a pads-v1 record frame. List wire format:

```
[u8 count]                                  — number of items (0–255)
per item:
  [u8 len][UTF-8 bytes]                     — item text (compact encoding, max 255 bytes)
optional:
  [u8 len][UTF-8 bytes]                     — list name (follows all items; 0=absent)
```

The receiver app decodes the list and assigns a local ID on import. No global UID — list identity lives in the URL.

---

## 6. Decoder Routing (Pseudocode)

```javascript
function routeFragment(fragment) {
  // fragment = everything after 'workpads.me/p#'
  // The '#' character itself is stripped by the browser before passing to JS

  if (fragment.startsWith('1pa/')) return decodePadsV1Plain(fragment.slice(4));
  if (fragment.startsWith('1pb/')) return decodePadsV1Presentation(fragment.slice(4));
  if (fragment.startsWith('1pf/')) return decodePadsV1FinancialPresentation(fragment.slice(4));
  if (fragment.startsWith('1ps/')) return decodePadsV1Scrambled(fragment.slice(4));
  if (fragment.startsWith('1ph/')) return decodePadsV1PartialScrambled(fragment.slice(4));
  if (fragment.startsWith('1pt/')) return decodePadsV1TemplateKeyed(fragment.slice(4));
  if (fragment.startsWith('l/'))   return decodeListShare(fragment.slice(2));
  if (fragment.startsWith('1pm/')) return decodePadsV1Marker(fragment.slice(4));
  if (fragment.startsWith('t/'))   return installTemplate(fragment.slice(2), { encrypted: false });
  if (fragment.startsWith('te/'))  return installTemplate(fragment.slice(3), { encrypted: true });

  // Legacy decode support — decode-only, no new encoding
  if (fragment.startsWith('1eg/')) return decodeLegacy1eg(fragment.slice(4));

  return { error: 'unknown_tag' };
}
```

**Slice lengths:**
- `1pa/`, `1pb/`, `1pf/`, `1ps/`, `1ph/`, `1pt/` — 4-character prefix → `.slice(4)`
- `l/` — 2-character prefix → `.slice(2)`
- `1eg/` — 4-character prefix → `.slice(4)`

**After slicing**, the remaining string is base64url-encoded data. Decode with `base64urlDecode()` before passing to the frame parser or security layer.

---

## 7. Preamble Byte (Security Tags)

Present as the first byte in `#1ps/` and `#1pt/` fragments (before the cipher text).

| Bit | Field | Meaning |
|-----|-------|---------|
| 7 | SCRAMBLE | 1 = field scramble applied (flag byte order permuted) |
| 6 | AES | 1 = AES-CTR encryption applied |
| 5 | HMAC | 1 = 8-byte HMAC-SHA256 receiver commitment tag appended after cipher text |
| 4 | SEED_POISON | 1 = deflate seed poisoning applied (non-standard seed derived from shared key) |
| 3–0 | KEY_HINT | Lower 4 bits of key ID; helps receiver select the correct decryption key from their key ring |

**Full wrapper assembly order (inner to outer):**

```
1. Assemble pads-v1 frame bytes
2. Apply seed-poisoned deflate (if SEED_POISON=1)
3. Apply field scramble to flag bytes (if SCRAMBLE=1)
4. Apply AES-CTR encryption (if AES=1) — IV = first 16 bytes of record UID hash
5. Append HMAC_tag (if HMAC=1) — 8 bytes, HMAC-SHA256 truncated, keyed to receiver identity
6. Prepend preamble_byte
7. base64url-encode the whole thing
```

---

## 8. Cross-References

| Topic | Document | Section |
|-------|----------|---------|
| Full pads-v1 frame specification | `FRAME-SPEC.md` | All |
| Security wrapper layers | `FRAME-SPEC.md` | §12 |
| Preamble byte detail | `FRAME-SPEC.md` | §12.1 Five-Layer Security Stack |
| TRIG bytecode design | `OPEN-QUESTIONS.md` | §OQ-32 |
| TRIG deep design notes | `TRIG-DESIGN.md` | All |
| Currency extension codes | `OPEN-QUESTIONS.md` | §OQ-3 |
| Display schema block | `FRAME-SPEC.md` | §11 |
| Form schema block | `FRAME-SPEC.md` | §11.2 |
| field_flags4 template-defined bits | `FRAME-SPEC.md` | §14 |
| Role codebook for participants | `ROLE-CODEBOOK.md` | All |
