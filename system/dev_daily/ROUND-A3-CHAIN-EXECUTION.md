# Round A3 — Chain, conservation & execution (questionnaire)
_Status: **locked** — consolidated in [`CHAIN-EXECUTION-LOCKED.md`](CHAIN-EXECUTION-LOCKED.md)._  
_Read: Doc 4, 6, 8; [`CODEC-V2-SCOPE-LOCKED.md`](CODEC-V2-SCOPE-LOCKED.md)._

---

## 1. Relationship enum on `chainRef`

| ID | Question | **Answer** |
|---|---|---|
| CE-01 | Minimum relationship types for v0.3 wire? | **All 8 core** from Doc 8 §3.1: creates, amends, acknowledges, pays, disputes, reverses, responds, confirms |
| CE-02 | Store as uint8 on wire or nibble inside Path C `chain_mode` only? | **Both, different jobs** — see § CE-02 explained |
| CE-03 | Unknown relationship on receive — reject frame or decode as informational? | **Decode** — treat as generic `responds`, flag in UI |

### CE-02 explained

- **`chain_mode` (3 bits in invoice/quote byte 1):** “What stage is this invoice/quote in?” — for list rows, glyphs, quick scan.  
- **`relationship` (on `chainRef`):** “What did this record do to the previous one?” — amend, pay, ack, dispute, etc.

Example: a **payment** record has `relationship: pays` on its `chainRef` to the invoice, while the invoice header might show `chain_mode: CLOSING`.

---

## 2. `chain_mode` (invoice/quote byte 1 — ties to PC-09)

| ID | Question | **Answer** |
|---|---|---|
| CE-04 | Confirm day-one trio: INITIATING, LIVE, CLOSING? | **Yes** — plus full set below |
| CE-05 | DISPUTING / WITNESSING — v0.3 or defer to v0.4? | **v0.3** — do not defer |
| CE-06 | INFORMATIONAL — for Connection/NOC chains (NOC-10)? | **Yes** — see § CE-06 explained |

### CE-06 explained

**INFORMATIONAL** = chained update that **does not create a new obligation** (no “you owe” beat). Examples:

- Connection relay: “pointing you to Jo for parts”  
- Status note on an open quote: “delayed until Tuesday”  
- Progress log on a job chain  

Use with **light ack** (NOC-11): receiver can acknowledge receipt without confirming a full action list. Contrasts with **LIVE** (active money/work obligation) and **CLOSING** (wrapping up legs).

---

## 3. Action list (Doc 6)

| ID | Question | **Answer** |
|---|---|---|
| CE-07 | Partial confirmation bitmask width (Doc 6 §8.2)? | **16-bit** confirmed + **16-bit** declined (up to 16 actions per record in v0.3) |
| CE-08 | Receive UI — confirm dedicated screen (PRODUCT-SURFACE G-11)? | **Yes — dedicated screen** — see § CE-08 explained |
| CE-09 | Which record types always emit action list on share? | **invoice, quote** (when actions present), **payment**, **need**, **offer**; not full list on **connection** |
| CE-10 | Connection — light ack only (NOC-11) — wire flag name? | `acknowledges` + empty masks + **`informational_ack`** FLAGS bit (FRAME-SPEC name TBD) |

### CE-08 explained

When someone **shares** a record that says “please do these steps,” the receiver opens the app and lands on a **full screen** (like wizard or list), not a small popup:

```
┌─────────────────────────┐
│ Actions requested       │
│ ┌─────────────────────┐ │
│ │ ☑ Confirm delivery  │ │  ← D-pad move, center to toggle
│ │ ☐ Approve amount    │ │
│ │ ☐ Schedule visit    │ │
│ └─────────────────────┘ │
│ Back    Accept selected │
└─────────────────────────┘
```

**Why not a modal:** KaiOS modals are easy to miss and bad for D-pad focus. **Why not zone expansion only:** Phase 6 glyph cards can add zone dive later; v0.3 needs a reliable confirmation path on receive.

After confirm, app creates return record with `relationship: acknowledges` + masks (CE-07).

---

## 4. Conservation UX (Doc 4)

| ID | Question | **Answer** |
|---|---|---|
| CE-11 | Pending conservation — list badge, chain screen, both? | **Both** |
| CE-12 | Obligation-bearing flag — surface on home strip? | **List filter + panel** — no home strip v0.3 |
| CE-13 | Encoder balance check for flow records — v0.3 or defer? | **v0.3** |
| CE-14 | Scaled integer amounts (Doc 4 §5) — v0.3 or defer? | **Include in v0.3** |

### CE-11 explained

**Pending conservation** = flow record (invoice, payment chain) where **one bilateral leg is still open** (Doc 4 — money or goods not fully matched).

| Surface | What user sees |
|---|---|
| **List badge** | e.g. “◐ Open” / half I/O glyph on row — spot open jobs without opening record |
| **Chain screen** | Same state on timeline — which chain step left obligation open |

Both use the **same** pending marker (PRODUCT-SURFACE G-06).

---

## 5. Existing kaios screens

| ID | Question | **Answer** |
|---|---|---|
| CE-15 | Dispute/amendment — extend `chain.js` / `dispute.js` or new spine UI? | **Extend existing** v0.3 — see § CE-15 explained |
| CE-16 | Wire `_ratifiedFrame` on outbound share now? | **Yes** |
| CE-17 | `changedMask` at share time — implement in v0.3? | **Yes** |

### CE-15 explained

| Approach | Meaning |
|---|---|
| **Extend existing** | Add relationship enum + pending state to screens you already have (`chain.js`, `dispute.js`, amendment from view) — **less UI risk** |
| **New spine UI** | Separate timeline screen driven by glyph chain spine (margin `⊳ → ◼`) — **Phase 6** with display layer |

v0.3: improve **logic and wire** on current screens; don’t block codec port on a new timeline UX.

---

## 6. Phase 0 tie-in

| ID | Question | **Answer** |
|---|---|---|
| CE-18 | Which Doc 4 / Doc 6 / Doc 8 sections to confirm first? | **Doc 8 §3 → Doc 6 §4–6, §8.2 → Doc 4 §4.2, §5, §6** |

---

## After A3

- [x] `CHAIN-EXECUTION-LOCKED.md`  
- [x] `CODEC-V2-SCOPE-LOCKED.md` § chain_mode updated (full 3-bit table)  
- [x] G2 gate (A2 + A3)  
- [ ] SUI-021–027 standard write → codec port  

---

_End._
