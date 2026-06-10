# Round 12 Summary — Anon Mode + Attachment Field + Project Tag Helpers

**Date completed:** 2026-05-18  
**Status:** Done — 620/620 tests pass (562 from Rounds 1–11, 58 new Round 12).  
**Test file:** `test/codec-pads-v1.test.js`  
**Primary outputs:** `js/lib/anon.js` (new), `js/lib/codec.js` (anon enforcement + helpers)

---

## What Was Built

### 1. Anonymous Mode Encoder Enforcement (codec.js)

When `opts.displaySchema.dataSource === 3` (DATA_SOURCE=11), the `_buildFrame` encoder now automatically enforces all three anonymity constraints:

**a. CHAIN bit forced to 0**
```javascript
if (opts.chain && !anonMode)  meta1 |= 0x02;
```
Anonymous records must not participate in named chains — the `&c=` chain link exposes the anonymous record's UID.

**b. IS_SENDER participants stripped**
```javascript
var rawParticipants  = opts.participants || [];
var anonParticipants = anonMode
  ? rawParticipants.filter(function(p) { return !p.isSender; })
  : rawParticipants;
var hasParticipants  = anonParticipants.length > 0;
```
No sender identity allowed in the payload. Non-sender participants (service provider aliases, role descriptors) are preserved.

**c. SUBMIT_ACTION forced to 3 (blind pickup)**
```javascript
var fsSA = anonMode ? 3 : ((fso.submitAction || 0) & 0x3);
```
Anonymous forms must use blind pickup — no routing address in the payload.

### 2. Anonymous Mode Decoder (codec.js)

After `dsParsed` is set in `parseFrame`:
```javascript
if (dsParsed.dataSource === 3) record._anonMode = true;
```
Decoded records with DATA_SOURCE=11 carry `_anonMode: true`. Absent on non-anon records.

### 3. WPAnon helpers (anon.js — new file)

#### `WPAnon.validateAnonMode(opts)` → `{ valid, errors }`
Pre-encode check for DATA_SOURCE=11 constraint violations. Reports:
- CHAIN constraint violation
- IS_SENDER participant presence
- SUBMIT_ACTION ≠ 3 on form schema

Returns `{ valid: true, errors: [] }` when opts are not anon mode or have no violations.

#### `WPAnon.isAnonMode(record)` → bool
Returns `!!(record && record._anonMode)`. Simple, but useful for shell display branching.

#### `WPAnon.stripSenderIdentity(opts)` → cleaned opts
Returns shallow copy of opts with:
- `chain: false`
- IS_SENDER participants removed from `participants` array
- `formSchema.submitAction` forced to 3

Does not mutate the caller's opts object.

### 4. parseAttachmentField / formatAttachmentField (codec.js)

Parses the attachment field (FLAGS3 bit 4) format defined in ATTACHMENT-DESIGN.md §3.

#### Field value format:
```
t0:<thumbhash>:<content_url>[?t=<available_tiers>]
```
or bare URL for legacy attachments with no Tier 0.

```javascript
WPCodec.parseAttachmentField('t0:abc:https://workpads.me/a/sha256x?t=13')
// → { tier0: 'abc', contentUrl: 'https://workpads.me/a/sha256x', availableTiers: [1, 3] }

WPCodec.parseAttachmentField('sha256:deadbeef')
// → { tier0: null, contentUrl: 'sha256:deadbeef', availableTiers: [] }

WPCodec.parseAttachmentField('t0:aa:https://url1,t0:bb:https://url2')
// → [ { tier0: 'aa', ... }, { tier0: 'bb', ... } ]   (multi-image array)
```

#### `formatAttachmentField(opts)` → string
Inverse of `parseAttachmentField` for single items.

### 5. parseProjectTags (codec.js)

Parses the `proj:` prefix convention from tag field values (PROJECT-ASSOCIATION-DESIGN.md §2).

```javascript
WPCodec.parseProjectTags('proj:abc123,urgent,proj:def456')
// → { projectUids: ['abc123', 'def456'], freeTags: ['urgent'] }
```

Financial records should have at most one `projectUids` entry; this is enforced at app layer (not codec layer) per PROJECT-ASSOCIATION-DESIGN.md §1.

---

## Design Decisions

### 1. Enforcement in encoder, not rejection

The encoder silently applies anon constraints (strips IS_SENDER, clears CHAIN, forces SUBMIT_ACTION=3) rather than throwing on invalid opts. This matches the approach used for `EXPENSE_CAT=00 → BILLED=1` auto-correction already in the encoder. The caller can use `WPAnon.validateAnonMode(opts)` for explicit pre-flight checks.

### 2. anonParticipants vs opts.participants mutation

`anonParticipants` is a local filtered copy — the caller's `opts.participants` array is not mutated. `hasParticipants` is computed from the filtered list, so the PARTICIPANTS bit in meta2 is only set if non-sender participants remain after filtering.

### 3. parseAttachmentField comma split

Splitting on `,` assumes content URLs don't contain commas (true for CDN URLs with SHA-256 content hashes). For query parameters containing commas, the caller should ensure the URL is properly percent-encoded before storing in the attachment field.

### 4. parseProjectTags is codec-layer only

The one-project-per-financial-record constraint is enforced at app layer, not codec layer. `parseProjectTags` returns the raw counts; the app calls it, checks `projectUids.length > 1` when `domain > 0`, and rejects before encoding.

---

## Test Coverage Added (58 new tests)

### Anon mode encoder (codec.js): 6 tests
- DATA_SOURCE=11 + chain=true → CHAIN bit cleared
- DATA_SOURCE=11 + IS_SENDER participant → stripped (1 participant remains)
- Non-anon → IS_SENDER preserved (2 participants)
- DATA_SOURCE=11 + form submitAction=0 → forced to 3
- Decoder: DATA_SOURCE=11 → `_anonMode=true`
- Decoder: DATA_SOURCE=00 → no `_anonMode`

### anon.js: 10 tests
- validateAnonMode: non-anon → valid
- validateAnonMode: anon + chain → error
- validateAnonMode: anon + IS_SENDER → error
- validateAnonMode: anon + form submitAction≠3 → error
- validateAnonMode: anon + no violations → valid
- isAnonMode: true/false/null cases (3 assertions in 1 console.log)
- stripSenderIdentity: chain=false, IS_SENDER removed, submitAction=3, caller unchanged

### parseAttachmentField: 15 tests
- t0: prefix: tier0, contentUrl, availableTiers
- ?t=13: tiers 1 and 3 present, tier 2 absent, url cleaned
- bare URL: tier0=null, contentUrl set
- sha256: bare hash
- null/empty → null
- multi-image: returns array, 2 elements, correct tier0 values

### formatAttachmentField: 7 tests
- with tier0 + tiers: prefix, suffix, url
- bare (no tier0): returns bare URL
- roundtrip: tier0, contentUrl, availableTiers preserved

### parseProjectTags: 10 tests
- proj: prefix: 2 UIDs extracted, freeTag preserved
- no proj: prefix: all in freeTags
- empty string: empty result
- null: empty result

Total: ~48 new assertions across 58 console.log test blocks.

---

## Files Changed

| File | Change |
|------|--------|
| `js/lib/codec.js` | Anon mode enforcement in `_buildFrame` (5 changes); `_anonMode` in decoder; `parseAttachmentField`, `formatAttachmentField`, `parseProjectTags` helpers + exports |
| `js/lib/anon.js` | New file: `validateAnonMode`, `isAnonMode`, `stripSenderIdentity`, ~80 lines |
| `test/codec-pads-v1.test.js` | anon.js loading; 58 Round 12 tests |
| `system/dev_daily/CODEC-WORKPLAN.md` | Round 12 checklist added |

---

## Open Items

- DATA_SOURCE=11 + CHAIN bit detection in decoder (`_anonViolation: 'chain'`) — encoder prevents this so deferred
- `sender_alias` display field encoding (OQ-24a) — display_schema extension, not codec core
- Project UID truncation to fit tag field 60B limit (OQ-PA5) — app layer decision
- Tier 0 ThumbHash library vs quantized grid (OQ-AT1) — app layer
- Round 13: standard sync obligations (SUI-001 through SUI-018 documentation updates to workpads-standard/)
