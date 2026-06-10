# App screens implied by codec v2 + execution locks
_2026-05-24. Companion to [`CHAIN-EXECUTION-LOCKED.md`](CHAIN-EXECUTION-LOCKED.md), [`PRODUCT-SURFACE-LOCKED.md`](PRODUCT-SURFACE-LOCKED.md), [`CODEC-V2-SCOPE-LOCKED.md`](CODEC-V2-SCOPE-LOCKED.md)._

**Codec status:** `#1pv/` native G0–G6 field slices live (`pathc-native.js`, `native-v1-split.js`). Legacy bridge decode only.

---

## Already in app (wire-up only)

| Screen / module | Implied work |
|---|---|
| `share.js` | **Done** — `1pv` tag in picker; default v2 for new shares |
| `RecordService.encodeUrl` / `decodeUrl` | **Done** — `tag: '1pv'` |
| `link-lab/p/` | **Done** — decode `1pv` for local QA |
| `view.js` / `list.js` | **Done** — codec badge; open-obligation pill on list |

---

## New screens (Phase D — required for locks)

### 1. Action receive screen — **CE-08** (high) — **Done**

**Trigger:** Incoming share or notification with `action_required` / non-empty action list (Doc 6).

**Behaviour:** Full-screen D-pad list; toggle accept/decline per action; softkey confirm → create ack record (`relationship: acknowledges`, 16-bit masks).

**Wire:** `WPCodec.encode` ack with `padsV2` optional; store via `RecordService.storeReceived`.

**Not:** Modal or glyph zone-only for v0.3.

---

### 2. Open obligations surfacing — **CE-11, CE-12** (high) — **Done**

| Surface | Behaviour |
|---|---|
| **List filter** | Filter chip “Open obligations” — flow records with pending conservation |
| **List row badge** | Half-I/O / “◐ Open” on matching rows (glyph when `ui.list_glyphs`) |
| **Panel entry** | Strip or menu row → filtered list (not home strip v0.3) |
| **Chain screen** | Same pending state on timeline steps |

**Data:** Decode chain + conservation flags from record; no new wire beyond `1pv` decode.

---

### 3. Pending conservation on chain — **CE-11** (medium) — **Done**

Extend `chain.js` (not new spine UI Phase 6):

- Highlight step that left bilateral leg open  
- Link to payment / confirming record if present in local store  

---

## Extended screens (medium)

### 4. Share — `changedMask` + ratified frame — **CE-16, CE-17**

**`share.js` / `RecordService`:** When sharing amendment or ratified record, set `changedMask` on amend; append `_ratifiedFrame` / `&r=` suffix (codec helpers exist).

**UI:** No new screen — confirm copy on amend share (“supersedes fields marked changed”).

---

### 5. Encoder balance warning — **CE-13** (medium) — **Done**

**Where:** `share.js` pre-encode or `wizard.js` save on flow records.

**Behaviour:** If conservation declared and legs don’t balance → warn block or soft block with override.

**New UI:** Inline banner on share screen, not a new route.

---

### 6. Need / Offer / Connection — **PRODUCT-SURFACE** (medium) — **Done**

| Item | Screen |
|---|---|
| Default create | **Done** — `io-create.js` → `record_type: need`, `1pv` on share |
| Power user | **Done** — `io-record.js` wizards + save/share step → `1pv` |
| Connection context | **Done** — view menu **Create offer** (**NOC-05**) |
| Connections screen | **Done** — key **4** → list filter by contact (**NOC-14**) |

Ack gatekeeper (**NOC-06**) — `gatekeeper-receive.js` light ack + relay confirm + policies on IO/share.

---

## Phase 6 display — **Done (A6)**

| Item | Screen / component |
|---|---|
| Glyph registry v1 | `glyph-registry.js` |
| Glyph card view | `glyph-card.js` + `workpads-ui.css` + `ui.card_frame` |
| List glyph strip | `list.js` + `ui.list_glyphs` (+ optional `list_l0_strip`) |
| Chain spine + timeline glyphs | `view.js`, `chain.js` + `ui.chain_spine` |
| I/O bilateral layout | need/offer in card renderer |
| Enable all | Management → Display → **Enable all** |

---

## Deferred (v0.4+)

| Feature | Why deferred |
|---|---|
| Relational / symbol decode UI | COMPRESSION-ROADMAP — v0.4 |
| Dedicated chain spine timeline | CE-15 — extend existing first |
| Full Path C group payload (no v1 embed) | **Done** — native 2b/3 |
| Social ledger obligations UI | IO-DECISIONS — scaffold only |

---

## Suggested implementation order (app)

1. Share defaults + decode `1pv` on receive (done)  
2. List badge + filter for open obligations  
3. Action receive screen  
4. Chain screen pending state  
5. changedMask / ratified at share  
6. Balance warn on encode  
7. NOC create path alignment (`io-create` → minimal need)  
8. Phase 6 display flags  

---

_End._
