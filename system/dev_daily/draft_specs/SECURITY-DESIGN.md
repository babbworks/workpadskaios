# Security Layer Design (OQ-14)

**Status:** draft-spec — 2026-05-17
**Depends on:** FRAME-SPEC.md §12, TAG-REFERENCE.md, ANON-MODE-DESIGN.md
**Maturity:** notes → design → **draft-spec** → spec → standard-doc

---

## 1. Purpose

The security wrapper sits outside the pads-v1 frame. It is applied after the frame is assembled and before base64url encoding for the URL fragment. Security level is signalled by the URL tag (`#1pa/`, `#1ps/`, `#1ph/`, `#1pt/`).

The wrapper must satisfy:
1. Privacy for financial and internal data shared via URLs (WhatsApp, SMS, QR codes)
2. Sender anonymity (no passphrase transmitted; key derived locally)
3. Receiver-targeted encryption (only the named receiver can verify)
4. Obfuscation of record structure to passive observers
5. Compatibility with KaiOS and low-compute environments (AES-CTR, not AES-GCM)

---

## 2. URL Tag Dispatch

| Tag | Name | Encryption | Field Scramble | HMAC |
|-----|------|-----------|----------------|------|
| `#1pa/` | Plain | None | No | No |
| `#1pb/` | Public billboard | None | No | No |
| `#1pf/` | Financial presentation | None | No | No |
| `#1ps/` | Full scramble | AES-CTR (full frame) | Yes | Optional |
| `#1ph/` | Partial scramble | AES-CTR (fields only) | Yes | No |
| `#1pt/` | Template-keyed | AES-CTR (full frame) | Yes | Optional |
| `#1pm/` | Marker record | Inherits write-phase security | Marker-specific | Yes |

`#1pf/` should always be combined with `#1ps/` or `#1pt/` before sharing sensitive financial views. The codec does not enforce this — the share sheet enforces it at app layer.

---

## 3. Key Hierarchy

### 3.1 Master Secret

```
passphrase        (user-entered, UTF-8, min 8 chars)
salt              (4 random bytes, embedded in URL — see §4.1)
master            = SHA-256(passphrase || salt)    [32 bytes]

cipher_key        = master[0:16]    [128-bit AES key]
scramble_seed     = master[16:32]   [field scramble seed]
```

The passphrase never leaves the device. The salt is embedded in the URL fragment (visible in the link but not a secret — it is a derivation nonce, not the key).

### 3.2 Per-Contact Passphrase Derivation

Each sender-receiver pair has a distinct key, derived from a device-held master secret:

```
device_master_secret    (stored encrypted on device, unlocked by PIN/biometric)

per_contact_passphrase  = HMAC-SHA256(device_master_secret, contact_phone_hash)
contact_phone_hash      = SHA-256(E164_phone_number)
```

This means:
- Sender never manually manages per-contact passphrases
- If device_master_secret changes (new device), all prior links become unreadable to new device — forward secrecy by design
- Contact must know the passphrase independently (e.g. shared via a secure side-channel on first contact, or via a `#1pt/` template-keyed exchange)

### 3.3 Template-Keyed Derivation (`#1pt/`)

```
template_content_hash   = SHA-256(canonical_template_bytes)
salt                    (4 random bytes, in URL)
master                  = SHA-256(template_content_hash || salt)
cipher_key              = master[0:16]
scramble_seed           = master[16:32]
```

The template content acts as the passphrase. Anyone with the template can decrypt. Anyone without it sees encrypted bytes. This model is suitable for semi-public records where the template is the access credential (e.g. a supplier price list distributed to trade partners who all hold the same template).

### 3.4 IV Derivation

```
iv = master[0:16]   (same as cipher_key bytes, reused as IV for CTR mode)
```

AES-CTR with a random salt-derived IV is safe when the salt is fresh per record. The salt (4 random bytes) provides sufficient IV uniqueness. The IV does NOT come from a record UID — record UIDs are optional and may be content-derived (anonymous mode), making UID-based IV unreliable.

**Why not GCM?** AES-GCM produces a 16-byte authentication tag and requires the full ciphertext before authentication. AES-CTR is streaming-friendly and produces no overhead — important for KaiOS's constrained JS environment and for fitting within URL length limits.

---

## 4. Wrapper Format

### 4.1 URL Structure

```
Full scramble:
  workpads.me/p#1ps/<b64url(salt)>.<b64url(preamble + inner)>
                     4 raw bytes     1 + variable bytes

Partial scramble:
  workpads.me/p#1ph/<b64url(salt)>.<b64url(preamble + clear_header + inner)>

Template-keyed:
  workpads.me/p#1pt/<template_id_b64url>.<b64url(salt)>.<b64url(preamble + inner)>
```

The `.` separator between salt and payload is literal — it is not part of the base64url content. The salt is base64url-encoded separately (6 chars for 4 bytes) so it can be extracted without decoding the full payload.

### 4.2 Preamble Byte

The first byte of the encoded payload (after the salt, before the encrypted content):

```
bit 7: SCRAMBLE         1=field scramble applied (scramble_seed active)
bit 6: AES              1=AES-CTR encryption applied
bit 5: HMAC             1=receiver commitment HMAC present (last 8B of inner)
bit 4: SEED_POISON      1=deflate seed poisoning applied
bits 3-0: KEY_HINT      lower 4 bits of cipher_key[0] (helps receiver select key)
```

KEY_HINT is NOT the salt and NOT the key — it is a 4-bit fingerprint of the derived key, so a receiver with multiple possible passphrases can rule out wrong ones without trying them all. It leaks ≤4 bits of the derived key, which is not a security concern.

### 4.3 Inner Payload Construction

Encode path (innermost first):

```
1. frame              raw pads-v1 frame bytes
2. deflate_seeded     deflate(frame, seed=scramble_seed[0:4])
                      — seed changes the LZ77 back-reference table init
                      — wrong seed produces invalid output on decompress
3. field_scramble     permute field_flags byte positions per scramble_seed[4:8]
                      — field data bytes are NOT moved; only the flag-offset mapping changes
                      — applied to the compressed output (structural obfuscation)
4. commitment         if HMAC=1: append HMAC-SHA256(cipher_key, scrambled_deflated_frame)[0:8]
                      — 8 bytes appended BEFORE encryption
                      — receiver verifies this after decryption, proving correct key was used
5. aes_ctr            AES-CTR(cipher_key, iv=master[0:16], plaintext = steps 2-4 output)
```

Full inner layout:

```
[AES-CTR(
  [deflate_seeded([field_scramble([frame])])][commitment_8B?]
)]
```

Decode path (reverse):

```
1. Extract salt from URL (first segment before `.`)
2. Derive master, cipher_key, scramble_seed from passphrase + salt
3. Compute KEY_HINT from cipher_key[0] — compare with preamble; abort if mismatch
4. AES-CTR decrypt using cipher_key, iv=master[0:16]
5. If HMAC=1: extract last 8 bytes; verify HMAC-SHA256(cipher_key, inner_without_hmac)[0:8]
   — wrong passphrase → HMAC mismatch → reject (display "Wrong passphrase" to user)
6. Un-field-scramble using scramble_seed[4:8]
7. Inflate with seed=scramble_seed[0:4]
8. Parse pads-v1 frame
```

### 4.4 Partial Scramble Layout (`#1ph/`)

Header bytes are NOT encrypted — they are prepended in clear before the encrypted inner:

```
[preamble_byte][clear_header][AES-CTR([deflate_seeded([field_data])])]

clear_header = meta1 [1B] + meta2 [0-1B] + setup_byte [0-1B] + transaction_byte [0-1B]
```

The receiver sees record type (template ID in meta1) and DOMAIN (financial vs service) before entering a passphrase. They know what they're about to decrypt. This allows the UI to show "Invoice — enter code to view" rather than a generic "Encrypted record."

`#1ph/` does NOT include the HMAC layer (HMAC=0 in preamble). The clear header already leaks metadata — receiver targeting is moot when structure is visible.

### 4.5 Decoy Bytes (optional, `#1ps/` only)

If the sender wants the payload size to be uninformative (timing/size correlation attack), a random decoy suffix can be appended inside the AES-CTR envelope. Signalled by a future preamble bit (currently reserved). Not v1.0 scope.

---

## 5. Receiver Commitment HMAC

When HMAC=1 in the preamble:

```
hmac_input  = cipher_key || receiver_phone_hash
                           receiver_phone_hash = SHA-256(E164_phone)
hmac_tag    = HMAC-SHA256(hmac_input, scrambled_deflated_frame)[0:8]
```

This tag is embedded inside the encrypted envelope (last 8 bytes before AES-CTR). After decryption, the receiver recomputes the HMAC using their own phone hash. If it matches, the record was explicitly targeted at them.

Requires `RECIPIENT_TYPE=1` in meta1 (specific named recipient) and the receiver's phone number present in the participants block OR derivable from context.

Use: pay slips, cost-sharing records, confidential quotes. Prevents a record from being forwarded and silently read by unintended recipients.

---

## 6. Marker Security Model

Markers (`#1pm/`) have a distinct security model. The RATIFIED_FRAME written to a Marker is NOT encrypted in the security wrapper sense — the Marker is the physical access control. Instead:

1. **Write-phase integrity**: each party's write is signed:
   ```
   write_sig = HMAC-SHA256(party_secret, marker_uid || slot_index || frame_bytes)[0:8]
   ```
   Written alongside the frame bytes. Verifiable by any reader who knows the party's public key (if PKI used) or by the app holding the party secret.

2. **Read-phase**: Marker content is plaintext (Markers must be readable without network/passphrase by any NFC reader). Security comes from WORM — the data cannot be altered, only read.

3. **Anonymous Marker** (OQ-M4/OQ-M5): if both parties are anonymous, the write_sig derives from an anonymous device secret, not a named identity. The Marker proves both parties agreed (WORM evidence) without naming them.

---

## 7. Error Handling

| Error condition | Shell response |
|----------------|----------------|
| KEY_HINT mismatch | "Wrong passphrase" — do not attempt decrypt |
| AES-CTR decrypt produces non-deflate output | "Corrupted or wrong passphrase" |
| Inflate seed mismatch (produces garbage) | "Corrupted link or wrong passphrase" |
| HMAC mismatch after successful decrypt | "This record was not addressed to you" |
| HMAC present but receiver phone unknown | Prompt: "Enter your phone number to verify" |
| `#1ph/` clear header truncated | "Damaged link" — cannot recover |

The shell MUST NOT reveal which specific check failed (KEY_HINT vs HMAC vs inflate) — a generic "wrong passphrase or corrupted link" message prevents oracle attacks.

---

## 8. Security Guarantees and Non-Guarantees

### Guaranteed
| Threat | Protection |
|--------|-----------|
| URL observer reads financial data | AES-CTR encryption; observer sees random bytes |
| Forwarded link read by wrong person | HMAC receiver commitment detects this |
| Field structure inference from byte pattern | Field scramble + deflate seed; field boundaries are unintelligible |
| Brute-force passphrase from URL alone | Salt-derived key; 128-bit key space with 4-byte random salt |
| Replay: old URL re-shared after key change | Per-record salt ensures old and new URLs use different keys |

### Not Guaranteed
| Threat | Note |
|--------|------|
| Device compromise | If device_master_secret is extracted, all per-contact keys are derivable |
| Passphrase interception during setup | Side-channel for initial passphrase exchange not specified here |
| Anonymous record sender identity (IP) | See ANON-MODE-DESIGN.md — IP visible to server on pickup |
| Link metadata (length, timing) | URL fragment length leaks approximate payload size |
| KaiOS memory side channels | JS crypto implementations may leak timing; not in scope for v1.0 |

---

## 9. KaiOS Implementation Notes

- **AES-CTR**: available in WebCrypto API (`AES-CTR` algorithm). Supported in KaiOS 2.5+ via Gecko 48's SubtleCrypto. For KaiOS 2.0, a polyfill using aes-js (MIT) is ~6KB gzipped.
- **SHA-256 / HMAC-SHA256**: available in SubtleCrypto. Fallback: sha.js polyfill.
- **Deflate with seed**: standard deflate (pako.js) does not support seeded init. The seed poisoning layer uses a lightweight alternative: XOR the first 256 bytes of the input with a seed-derived mask before deflating. This provides the "wrong seed = garbage" property using standard deflate for the actual compression.
- **Memory**: AES-CTR is streaming — the full payload does not need to be in memory simultaneously. For records up to ~4KB (typical), this is not a concern on KaiOS (min 256MB RAM).

---

## 10. Open Questions

- **OQ-14l** — Passphrase setup UX: how does Party A communicate the passphrase to Party B on first contact? Options: (a) verbal/phone, (b) template-keyed bootstrap record, (c) QR code exchange. The protocol does not specify this — it is a UX decision.
- **OQ-14m** — Key rotation: if a passphrase is compromised, all prior records encrypted with it are readable. Should there be a versioned key rotation path? The KEY_HINT (4 bits) could serve as a version indicator — incremented on rotation.
- **OQ-14n** — `#1pt/` template key distribution: if the template content hash is the key, how are template updates handled? New template version → different hash → old links unreadable. Versioned template hashes must be pinned at share time.
- **OQ-14o** — Decoy byte signalling: reserve preamble bit 3 (currently reserved) for `HAS_DECOY=1`? Or is size obfuscation out of scope for v1.0?
- **OQ-14p** — AES-128 vs AES-256: cipher_key is 128-bit. For whistleblower / high-risk use cases, is 128 sufficient? Expanding to 256-bit would require master = SHA-512(passphrase || salt) and cipher_key = master[0:32].

---

## 11. Resolved Decisions (from OQ-14 sessions)

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| OQ-14a: Encryption algorithm | AES-CTR 128-bit | KaiOS WebCrypto compatible, streaming-friendly, no auth-tag overhead |
| OQ-14b: Key derivation | SHA-256(passphrase \|\| salt) | Simple, no PBKDF2 cost (passphrase is strong; PBKDF2 not needed for short records) |
| OQ-14c: Salt placement | 4 random bytes, URL segment before `.` | Visible nonce; not a secret; enables per-record unique key |
| OQ-14d: Per-contact keys | HMAC(device_master_secret, contact_phone_hash) | Device-managed; no manual per-contact passphrase |
| OQ-14e: IV source | master[0:16] (same bytes as cipher_key) | salt ensures freshness; no need for separate UID-based IV |
| OQ-14f: Field scramble | Permute flag-offset mapping using scramble_seed[4:8] | Structural obfuscation without moving data bytes |
| OQ-14g: Deflate seed poisoning | XOR first 256B of plaintext with seed mask before deflate | Lightweight; uses standard deflate; wrong seed → garbage output |
| OQ-14h: HMAC position | Inside AES-CTR envelope (last 8 bytes before encrypt) | Verified after decrypt; protects identity info from oracle attacks |
| OQ-14i: Partial scramble | Clear: meta1 + meta2 + setup + transaction; encrypted: everything else | Receiver sees record type before decryption prompt |
| OQ-14j: Template-keyed | template_content_hash replaces passphrase | Template content = access credential; holders of template can decrypt |
| OQ-14k: HMAC binding | Bound to receiver phone hash | Detects forwarded record opened by wrong recipient |
