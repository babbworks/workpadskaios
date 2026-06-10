# Display layer — locked (Phase 6 port)
_2026-05-24. Glyph/card UI ships behind `ui-phase.js` flags — default **off** until enabled in Management._

**Implementation:** `js/lib/glyph-registry.js`, `js/lib/glyph-card.js`, `css/workpads-ui.css`, `UIPhase` flags.

---

## Registry v1

Inline registry in `glyph-registry.js` (taxonomy-aligned record + chain_mode glyphs). `GlyphRegistry.exportJson()` for tooling.

| Type | Glyph | Accent class |
|------|-------|--------------|
| need | ◉ | `wp-rt-need` |
| offer | ◎ | `wp-rt-offer` |
| connection | ⇄ | `wp-rt-connection` |
| invoice | ◼ | `wp-rt-invoice` |
| payment | ◆ | `wp-rt-payment` |
| work_record / job | ▲ | `wp-rt-work_record` |

Full BlockRegistry JSON import remains optional (display only; no wire bytes).

---

## KaiOS mapping (v0.3)

| Surface | Flag | Behaviour |
|---------|------|-----------|
| View + share preview | `card_frame` | Four-zone card + bilateral In/Out on need/offer |
| List row | `list_glyphs` | Prefix glyph before title |
| View margin | `chain_spine` | Accent bar when `chainRef` set |

Edit surfaces stay **PADS wizard** / optional **In/Out frame** (`in_out_frame`) — G-01.

---

## Phase 6 entry criteria (full port)

- [x] Glyph registry v1 (`glyph-registry.js`)  
- [x] KaiOS-themed `workpads-ui.css` (research zones, app CSS variables)  
- [ ] E-paper / print — deferred  
- [x] L0 strip — optional `list_l0_strip` flag  

---

## Enable in dev

Manage → Settings → **Display** → **Enable all** (or toggle `card_frame`, `list_glyphs`, `chain_spine`, `list_l0_strip`).

---

_End._
