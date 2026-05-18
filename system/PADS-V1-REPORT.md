# Workpads pads-v1: System Report
## What Was Built, How It Works, and What It Means

**Date:** 2026-05-18  
**Audience:** Technical — implementors, architects, collaborators  
**Standard version covered:** v1.0 (SUI-001–020, all complete)

---

## Part 1 — The Problem This Solves

Most business software assumes you have a stable internet connection, a smartphone with a capable browser, and enough digital literacy to navigate forms, sign up for accounts, and wait for pages to load. Most field workers in emerging markets — electricians, plumbers, market vendors, site supervisors, casual labour — do not have all three of those things at once. They have a KaiOS feature phone, a 2G connection that drops in and out, and a WhatsApp group where business happens.

Workpads is designed to work in that gap. The core idea is radical in its simplicity: a business record is a URL. Not a link to a record on some server. The URL *is* the record. The data lives in the fragment — the part after the `#` — which browsers never send to any server. You can read it, decode it, display it, respond to it, and store it, all without an account, without a login, without a server knowing what you're looking at.

That URL fits in a WhatsApp message. It scans as a QR code. It works offline. It works on a phone that costs $30.

The pads-v1 codec is the binary encoding standard that makes this possible at scale — small enough to fit in a URL, expressive enough to represent invoices, job records, agreements, quotes, receipts, and site reports across thousands of trade types and market contexts.

---

## Part 2 — How a Record Becomes a URL

A workpads record starts as a binary frame — a carefully packed sequence of bytes. The frame is then deflate-compressed (the same algorithm used in ZIP files and PNG images), then base64url-encoded (a URL-safe alphabet, no padding), then embedded in a URL fragment with a three-character scheme tag.

The result looks like this:

```
workpads.me/p#1pa/eJyLjgUA_AAAA...
              ^^^  ^^^^^^^^^^^^^^^^
              tag  compressed record
```

The tag `1pa` identifies the codebook generation: pads version 1, package a. This is how the decoder knows which rulebook to apply. Legacy codebooks (`1ag`, `1bg`) are still decodable by routing on character 1 of the tag — a simple switch that keeps old records readable forever without any migration.

The critical privacy property: the URL fragment — everything after `#` — is never sent by the browser to any server. `workpads.me` sees only the path `/p`. It has no idea what record is in that URL. Every CDN log, every server access log, is blind to the record content. This is a browser specification guarantee, not a policy promise.

### Inside the frame

A pads-v1 binary frame is a sequence of conditional bytes. Every byte is there for a reason, and every byte is absent when it isn't needed. There is no fixed-length padding, no null-terminated strings, no wasted space.

The frame always starts with `meta1` — a single byte that tells the decoder what to expect next. It carries the template type (what kind of record this is), whether there's a second meta byte, whether the record is part of a chain, and whether a recipient acknowledgement is requested.

Most records also have `meta2` — a second header byte that enables optional features: binary time encoding, the financial block, the participants block, the TRIG program, and the DOMAIN mode (which determines whether this is a simple job note, a financial record, or a double-entry accounting record).

When a record has financial content, two more bytes follow: `setup_byte` (currency, decimal position, tax code) and `transaction_byte` (the I>O classification — the direction and timing of the money flow from the sender's perspective). These four header bytes — meta1, meta2, setup_byte, transaction_byte — together describe the entire context of the record before a single data field has been read.

Then come the field flags: a 16-bit presence map telling the decoder which data fields are actually populated, followed optionally by FLAGS3 (8 more fields: tags, attachments, UIDs, URLs) and FLAGS4 (template-specific custom fields plus two standard cross-template assignments: compact GPS coordinates and a security key context hint).

After the flags come the actual data fields, each present only if its flag bit is set. Text fields are length-prefixed with a two-byte big-endian integer. Date fields, when binary encoding is active, are two bytes: days since 2000-01-01. Amounts are three bytes: a 24-bit integer with the decimal position carried in the setup_byte. A full payment record with job title, customer name, date, and amount fits in 33–36 raw bytes — before compression.

After all text fields comes the financial block, then the participants block (a structured identity section for both parties), then the optional TRIG program, then optional security wrapper. Nothing is present unless needed. Every byte earns its place.

---

## Part 3 — The Financial Layer

The financial block is where pads-v1 makes its most significant departure from the older codebooks. In the legacy `1ag/` and `1bg/` codebooks, amounts were stored as UTF-8 strings — the characters "125.50" taking six bytes plus a two-byte length prefix. In pads-v1, the same value is stored as the integer 12550 in three bytes, with the decimal position (2 in this case) declared once in the setup_byte for the entire record. That single change saves five bytes per amount field and removes variable-length string parsing from every decode path.

The transaction_byte captures something that took four separate record types in older designs. It encodes the I>O state — a three-dimensional classification:

- **Direction** (I=income/O=outgoing from the sender's perspective)
- **Time** (past settlement or future expectation)
- **Effect** (whether the net effect is inflow or outflow)

Eight combinations describe the full space of financial events a field worker encounters: payment received, invoice sent, refund given, credit note, expense paid, bill received, reimbursement pending, reimbursement received. Four subtypes per state give 32 total classifications. The worker never sees this encoding — they see "Invoice sent" or "Cash received." The codec maps it.

The `fin_control` byte, added in the most recent generation, adds another dimension: whether a cost is billed to the customer (a job charge that appears on an invoice), absorbed by the worker (COGS, an internal cost), or a running cost unrelated to any specific job. This distinction is the accounting layer that makes workpads records usable for real double-entry bookkeeping — not just as a chat message that happens to contain a number.

For practitioners who need full accounting reconciliation, DOMAIN=10 activates the BitLedger Account Pair classification: 14 active pairs covering the full double-entry taxonomy from operating expense/asset through equity/equity. DOMAIN=11 carries both the simple I>O perspective and the full account pair in a single record, serving both the field worker's view and the accountant's integration simultaneously.

---

## Part 4 — Identity, Trust, and the Participants Block

A workpads record is shared between two parties. The participants block carries structured identity for both: name, phone number, role (customer, worker, supplier, or one of 240 named trade roles through an extended codebook), and optionally an alternate ID (app UID, trade licence number, national ID, or location label). Two bytes minimum per participant; typically 20–40 bytes for a named individual with a phone number and role.

The role system is worth examining. The top level has four quick-select codes: customer, worker, supplier/vendor, and extended. For the extended path, a single additional byte selects from 240 pre-defined roles across 16 groups — electrician, plumber, site manager, referred by, subcontractor, witness, and so on. A two-byte escape gives 224 specialist roles. Free-text role labels are available for contexts that don't fit any codebook entry. The whole system adds zero bytes for the 90% case (worker + customer), one extra byte for the 9% case (named trade role), and two bytes for the 1% case (specialist role or free text).

The security wrapper sits above the codec. A plain `#1pa/` record is readable by anyone with the URL — appropriate for public service menus, market price boards, or job notes being shared with a site manager. But the same codec supports four additional security profiles:

- **`#1ps/`** — full AES-128-CTR encryption with passphrase-derived key. Five-layer stack: deflate seed poisoning, field scramble, AES-CTR, receiver commitment HMAC, preamble byte. The preamble byte is a one-byte control structure that tells the receiver which layers are active without decrypting anything.
- **`#1pt/`** — template-keyed encryption: the SHA-256 of the template content IS the key. Share the template, share the ability to decrypt. Provides business confidentiality between trading partners without a shared passphrase.
- **`#1pb/`** — public billboard, no encryption, but combined with `DATA_SOURCE=11` for anonymous records.
- **`#1pm/`** — Marker records: sealed ratified agreements.

Every encryption variant uses the URL fragment as the key transport channel — the server never sees the key, and can never read the record content.

---

## Part 5 — Commitments, Markers, and Living Agreements

A workpads record can be more than a snapshot. Two records linked by a chain reference become a conversation: quote followed by acceptance, job note followed by completion certificate, invoice followed by payment confirmation. The chain is a 24-bit composite reference embedded as `&c=XXXX` in the URL — four base64url characters that carry device anchor, participant slot, and sequence position. The entire chain state lives on the parties' devices. No server stores or manages it.

When two parties both sign into a chain — one creates the offer record with `ACK_REQUEST=1`, the other replies with a State Commit carrying `COMMIT_TYPE=10` (terms agreed) — the chain becomes a ratified agreement. The app detects bilateral ratification by a simple algorithm: does the chain contain at least two records from different `IS_SENDER` parties, both with COMMIT_TYPE present? If yes, the agreement is confirmed. Green badge, timestamp.

For commitments that need a physical artifact — a signed receipt kept by both parties — there are Markers (Stones). A Marker is a small NFC tag, QR-linked card, or software token that accepts a one-time write from each party and then locks permanently. The RATIFIED_FRAME encoding is designed to fit in 94 bytes on an NTAG213 chip (a $0.20 off-the-shelf tag) — meta bytes, story summary, financial terms, two participant identities, and a cryptographically derived Stone UID in the `did:stone:` DID format. Once both parties have written, the chip's hardware lock bits prevent any further modification. The Marker IS the sealed contract.

Software Markers use server-enforced write-once semantics for devices without NFC, with a full peer-to-peer option (Option E) for contexts where both parties are offline — write tokens exchanged directly via QR code between devices, each signed with the device's HMAC key, with the `prev_stone_hash` chain providing cryptographic ordering when the parties later sync to a server.

The C-TRIG evaluator extends this into programmable obligations. C-TRIG is a 32-byte-maximum stack machine with 16 opcodes that evaluates commitment conditions against chain state: has the deposit been confirmed? Has the due date passed? Have all milestones been met? When a condition triggers, the evaluator calls `app.prefillRecord()` — it never auto-sends anything. The worker always reviews. The machine proposes; the human decides.

---

## Part 6 — TRIG, Templates, and the Display Layer

Separate from the commitment layer, every record can carry a TRIG display program — a 1–20 byte stack machine that governs how the record looks to different viewers. A market trader's service menu might show prices to customers, show cost prices to workers, and show a summary-only view to anyone else. This three-audience routing is a four-byte TERNARY instruction: `0x90 cond_id mode_true mode_false`. One instruction, three display outcomes, four bytes.

The BLOOM instruction (three bytes) runs browser capability fingerprinting — measuring frame rate, pointer events, clipboard access, intersection observer, canvas entropy — to distinguish human users from bots without any server involvement. The full TRIG instruction set has 16 opcodes covering condition evaluation, display mode selection, CSS/theme codebook loading, JavaScript module invocation, logical operations, branching, and anti-bot capability testing.

Templates are the visual layer. A template is a JSON object — HTML, CSS, label mappings, formula definitions, field order overrides — identified by the SHA-256 hash of its canonical serialisation. That hash is both the template's identity and, in the `#1pt/` scheme, its encryption key. Templates are distributed through a three-tier model: built into the app for core types, served from the Cloudflare CDN (24 African PoPs) for sector templates, or embedded inline in a Data Sync Bundle for offline/P2P sharing. The bundle is a deflate-compressed sequence of items — template, contact data, record — in a single URL. Partial failure is designed in: if the template doesn't install, the record renders in raw mode. Nothing blocks.

---

## Part 7 — Anonymous Mode and Attachments

The anonymous mode (`DATA_SOURCE=11`) removes sender identity entirely from the frame. No name, no phone, no routing address. The shell shows "Anonymous" and hides the contact button. For forms — market price boards, feedback forms, blind tender submissions, whistleblower reports — submissions go to a blind pickup slot. The pickup slot key is derived as `SHA256(form_uid || HMAC(master_secret, form_uid))`. The server stores AES-256-GCM ciphertext it cannot decrypt. The sender retrieves by presenting the slot key. The server cannot link the retrieval to any identity. IP correlation remains possible — but the design guidance for high-risk use cases includes VPN/Tor, cellular over WiFi, and rotating form UIDs.

Attachments use a progressive delivery model with a deliberately retro aesthetic. The Tier 0 thumbnail is an 8×8 pixel image, quantized to 256 colours, base64-encoded in 86 characters — embedded directly in the attachment field, requiring no network call. Decoded and scaled with nearest-neighbour interpolation, it produces a blocky pixel preview. This is intentional. On a KaiOS screen at 240×320 pixels, a blocky 8×8 preview scaled to 80×80 looks like a mobile phone photo from 2003. That aesthetic says "field photo" — not a polished marketing asset, but evidence of real work. Tier 1 (320×240, JPEG Q40, 8–20 KB) loads in under three seconds on EDGE. Tier 3 (original) never loads unless the user explicitly asks.

---

## Part 8 — What Version 1.0 of the Standard Means

The workpads-standard repository now contains normative documentation for every component of the pads-v1 system. Twenty Standard Update Items — SUI-001 through SUI-020 — were tracked from first identification through to completion. All twenty are done.

The thirteen new or rewritten documents cover:

- **codec.md** — the complete pads-v1 frame format, all seven URL tags, full DOMAIN mode table, worked encoding profiles, amount encoding with BitLedger lineage
- **security-wrapper.md** — the five-layer security stack, key derivation, IV reuse justification, all URL variants
- **participants-block.md** — 2-bit ROLE_TYPE, 240-code extended role system, HAS_ALT_ID path
- **financial-block.md** — fin_control byte with BILLED/EXPENSE_CAT/PARITY, DOMAIN=01 and DOMAIN=10 layouts
- **transaction-classification.md** — 24-entry type matching table, type-change reconciliation, accounting display
- **template-system.md** — wire encoding extensions: label_map, formula, formula_bytecode, FLAGS4 custom fields, EXT_TEMPLATE IDs
- **trig-spec.md** — complete TRIG specification: 16-opcode instruction set, 12-condition registry, pattern tokens, display modes, CSS/theme/JS codebooks, TERNARY and BLOOM instructions, C-TRIG relationship
- **markers-spec.md** — Stone/Marker hardware and software options, RATIFIED_FRAME encoding, did:stone: UID format, write tokens, offline matrix, lifecycle states
- **agreements-spec.md** — three-tier agreement model, clause block wire format, milestone table, bilateral ratification detection, dispute encoding, state machine
- **ctrig-evaluator-spec.md** — 16-opcode C-TRIG instruction set, eight-category extended condition registry, numeric stack, SUPPORTED_FEATURES bitmask, reference pseudocode
- **project-association.md** — `proj:` tag convention, single-project financial constraint, aggregation query pattern
- **anonymous-mode.md** — DATA_SOURCE=11 wire mechanism, blind pickup protocol, threat model
- **attachment-spec.md** — four-tier progressive delivery, 8×8 quantized Tier 0, `?q=` CDN routing, KaiOS constraints

The seven updated documents — chain-protocol.md (agreement chain extension), codec-sync.md (pads-v1 update), record-schema.md (FLAGS4 cross-template assignments), template-diffusion.md (three-tier distribution model), data-sync-bundle.md (new), server-systems-planning.md (new, non-normative) — complete the picture.

A third-party implementor reading only the standard can now build a correct pads-v1 encoder, decoder, agreement evaluator, Marker reader, template renderer, and anonymous form server without consulting the kaios implementation. That is what "normatively complete" means. The standard is the asset. The implementation is the proof.

---

## Closing Note

The whole system hangs together on one architectural decision made very early: the URL fragment is the record. Everything else — the binary encoding, the compression, the security layers, the chain protocol, the Marker hardware, the anonymous pickup server, the C-TRIG evaluator — is in service of that one idea.

When a plumber in Lagos shares a job note via WhatsApp, the recipient sees a link. They open it. The record decodes in the browser — no login, no app required, no server lookup. If the recipient has the workpads app, they can reply with an acknowledgement, chain a payment record, and eventually seal the whole job history into a Marker the size of a 10p coin.

The codec is the bottom of that stack. It earns every byte.
