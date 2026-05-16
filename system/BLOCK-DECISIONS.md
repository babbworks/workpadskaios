# Block Design Decisions

**Status:** D25–D35 — post-MVP blocks settled in Rounds 13–27  
**Scope:** Sections 8–15 of FRAME-SPEC.md  
**Cross-reference:** CODEC-STATUS.md (full round log), CODEC-EVOLUTION.md (design session notes), FRAME-SPEC.md (wire layout)

---

## D25 — Compound Block: Line Flags Byte

**Decision:** Each compound line optionally carries a `compound_line_flags` byte, gated by `LINE_FLAGS_PRESENT=1` in the compound header. Simple compound records (uniform tax, no deductions) can omit the flags byte entirely.

**Rationale:** Multi-line records need per-line tax treatment and line type differentiation (deductions vs employer costs vs standard lines), but adding a byte per line to simple invoices wastes space. Gating on `LINE_FLAGS_PRESENT` keeps simple compound records lean.

**Wire layout:**
- `LINE_TYPE` (bits 7–6): `00`=standard, `01`=deduction, `10`=employer-add, `11`=summary
- `TAX_MODE` (bits 5–4): `00`=-- (none), `01`=standard, `10`=reduced, `11`=zero/exempt
- `QTY_LINE` (bit 3): `1`=qty and rate follow this line's amount

---

## D26 — TAX_MODE=00 Meaning: "--" Not "Inherit"

**Decision:** `TAX_MODE=00` on a compound line means "not applicable" — the dash/empty state. It does NOT mean "inherit the record's `TAX_CODE`." The `setup_byte TAX_CODE` is a rate definition only; it is never silently applied to any line.

**Rationale (correction of Round 21 error):** "Inherit" behaviour creates implicit side effects that are hard to audit and confusing for non-accountants. A worker who sets no tax on a line should see `--`, not a silently-applied rate. The UI collapses the tax column when all lines are `00`, so the common case (no tax) costs nothing in screen space.

**UI rule:** Tax column is hidden when all compound lines have `TAX_MODE=00`. If any line has `TAX_MODE≠00`, the full column appears for all lines.

---

## D27 — State Commit Block

**Decision:** Base template `101` records carry a 1-byte `state_commit` header (COMMIT_TYPE 2-bit + PERIOD_TYPE 2-bit + status flags) and no `transaction_byte`. The financial block may follow (for cumulative pay/income summaries) using `setup_byte` for context but without a directional transaction byte.

**Rationale:** State snapshots are not transactions — they have no I>O direction. A pay period close or year-end aggregate is a settled summary, not a new financial event. Omitting `transaction_byte` makes this explicit at the decode level and avoids misclassification.

**COMMIT_TYPE codes:**
- `00` = job close (finalised job, balance shown)
- `01` = pay period close (worker pay settled for period)
- `10` = period summary (income/expense/net for a date range)
- `11` = annual aggregate (full-year financial summary)

---

## D28 — Amendment Block: Overlay Approach

**Decision:** Base template `110` Amendment records carry a `changed_fields_mask` (mirroring `field_flags` layout) and only the values of changed fields. The receiver reconstructs the amended record by overlaying changed values onto the original. A `line_index` byte handles amendments to compound lines (`0xFF` = header-level change).

**Rationale:** Carrying only changed fields minimises payload size — a field correction on a 10-line invoice need not re-transmit all 10 lines. The overlay model keeps decoding deterministic: apply mask, replace matching fields, recalculate totals.

**Chain convention:** Amendment carries `CHAIN=1`; `&c=` suffix points to the original record UID. `ACK_REQUEST=1` on the original signals that an amendment reply is expected.

---

## D29 — KaiOS Correction Comparison: Inline Highlight

**Decision:** On KaiOS, when comparing an Amendment record against the original, use an inline highlight view — single view, changed fields marked with `●`, unchanged fields visible for context. D-pad navigates between `●` rows; centre key expands to diff detail.

**Rationale:** Side-by-side comparison is impractical on KaiOS screen sizes (240×320px typical) and D-pad-only navigation. The inline approach keeps the comparison in a single scrollable view with natural D-pad traversal.

---

## D30 — Presentation Record Blocks (Display Schema + Form Schema)

**Decision:** Presentation records (`#1pb/` URLs) carry a `display_schema` block controlling render mode (card/list/menu/form-only), data source, and accent colour. An optional `form_schema` block adds collect-and-reply capability with per-field definitions and a `SUBMIT_ACTION` byte.

**Rationale:** Separating display intent from data content allows the same record to be rendered differently by different receivers without duplicating data. The `DATA_SOURCE` field enables the ultra-minimal contact-resident card (OQ-25): payload is a contact ID; receiver fills the display from their own contact store.

**SUBMIT_ACTION codes:**
- `00` = reply record (receiver submits back as a new pads-v1 record)
- `01` = web endpoint
- `10` = email

---

## D31 — Security Wrapper: Five-Layer Stack

**Decision:** Security is a post-frame wrapper, not embedded in the frame. URL tags signal security level: `#1pv/` (plaintext), `#1ps/` (full), `#1ph/` (field scramble only), `#1pt/` (template-keyed). The preamble byte (1 byte prepended before base64url) carries flags for each active layer.

**Five layers (outermost first):**
1. Deflate seed poisoning — lightweight obfuscation; decompression fails without shared seed
2. Field scramble — field_flags order permuted by key-derived shuffle
3. AES-CTR encryption — full frame encrypted; IV = record UID hash; key = sender+receiver identity pair
4. Receiver commitment HMAC — 8-byte truncated HMAC-SHA256; verifiable only by named receiver
5. Preamble byte — signals which layers are active; carries 4-bit key hint

**Rationale:** Layering allows graduated security without changing the wire format. A customer-facing invoice needs no security (`#1pv/`); a cost record or internal pay summary needs full protection (`#1ps/`). The app share sheet enforces the appropriate level; the codec does not refuse to encode without a wrapper.

---

## D32 — alt_id Extension for No-Phone Users

**Decision:** Participants block extended with an `alt_id` block (type byte + compact UTF-8 value) for users without a phone number. Four types: `app_uid` (device-generated, SIM-stable), `trade_name`, `national_id`, `location_label`.

**Rationale (OQ-31):** African and South/Southeast Asian markets commonly have users without stable phone numbers. The app_uid is generated on install and tied to the SIM or device, shared by QR code. Trade names and location labels are often more stable than phone numbers in informal market contexts.

**Match order:** phone → email → app_uid → trade_name + location_label

**Unresolved (OQ-31):** `HAS_ALT_ID` requires a 9th bit in `part_flags`. Pending resolution: Option A = pack `ROLE_TYPE` into 2 bits (6 roles fit; Authority drops to `role_code` path). Option B = extend to 2-byte `part_flags`.

---

## D33 — field_flags4: Template-Defined Extension

**Decision:** `field_flags3` bit 7 (`FLAGS4_PRESENT`) chains to a `field_flags4` byte whose bits are template-defined. The decoder must know the active template to interpret them. Contact/entity template owns bits 0–4 (vCard extended fields: org, title, address, website, note).

**Rationale:** The 7 slots in `field_flags3` are insufficient for domain templates (electrician, medical, construction) which need custom data fields. `field_flags4` provides 8 additional slots without changing the base wire format — it is absent when not needed.

---

## D34 — Period Reports: date_end Gap

**Decision (pending):** Period summary records (State Commit `10`) and period report presentation records need both a start date and end date. `field_flags3` bit 3 is currently assigned `expiry_date`, which conflicts.

**Proposed resolution:** Swap `expiry_date` to `field_flags4` (Contact/entity template does not need it; Financial template can use a FLAGS4 slot). Reassign `field_flags3` bit 3 to `date_end`.

**Impact:** Requires updating STANDARD-FIELDS.md and any existing decoder that relies on FLAGS3 bit 3 as `expiry_date` (none yet — codec.js not yet implemented).

---

## D35 — Two-Tier Contact ID System

**Decision:** Contact IDs are maintained at two levels: app-global sequential integer (`001`, `002`, ...) and optional activity-level alias (e.g. `AH-2023`). Both are app-side only. On the wire, IDs are carried via the `ref_number` field (field_flags bit 13), with the activity alias used in customer-facing records and the global ID in internal records.

**Rationale:** Activity-level aliases give workers a natural, short reference within their trade context (e.g. "Customer AH-2023" in their car-washing activity). The global ID avoids collisions when the same contact appears across multiple activities.

---

## D36 — Contact Multi-Role Model

**Decision:** A contact's role (Customer, Worker, Supplier, Subcontractor) is a per-record attribute encoded in the participants block `ROLE_TYPE` field — not a property of the contact itself. The same contact can appear as Worker on one record and Supplier on another. The contact dashboard aggregates by role across all records.

**Rationale:** Field workers frequently work with people who play multiple roles (a supplier who is also a subcontractor; a customer who later becomes a worker). Storing role on the contact forces a choice that may be wrong later. Storing it on the record is authoritative and auditable.

---

## D37 — Customer View Levels (Share-Time Decision)

**Decision:** Three customer-facing view levels, chosen at share time:

- **Simple** — flattened single-line total, no compound lines visible
- **Standard** (default) — compound lines where `BILLED=1`; deduction lines (LINE_TYPE=01) hidden
- **Detailed** — full compound record, all lines

The stored record always contains the complete compound block. View level is an app-side rendering decision, not a codec property. The share sheet selects which fields to include when generating the customer URL.

**Rationale:** Progressive disclosure — customers see what they need; workers retain full internal detail without creating multiple records.
