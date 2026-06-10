# Template QR — wire spec (draft)
_2026-05-24. In scope per `P2-CONFIRMATIONS-LOCKED.md` — not limited to business cards._

---

## Tags (current)

| Tag | Status | Use |
|-----|--------|-----|
| `#1pb/` | **Live** | Presentation / billboard / form — `displaySchema` + optional `formSchema` |
| `#t/` | **Live** | Template **install** payload (TemplateRegistry) |
| `#1dt/` | **Draft** | Same presentation frame as `#1pb/`; tag distinguishes template-QR intent. Decoder sets `_templateQr: true`. |

Formal `#1dt/` body (required-fields mask, interaction hints) ships before **CT-1** binary QR — see `CLOSING-TASKS.md`.

---

## Lab

- `link-lab/template.html` — one-click billboard, form, draft `1dt`, `#t/` install
- Round-trip: `link-lab/round-trip.html`

---

## App

- Share: **Template (`1dt`)** tag default when `displaySchema` / `is_template`; boot encodes selected tag (not legacy `1pa` only).
- **Template QR** section: presets Billboard / Form / Form+QR, live preview, `#1dt/` note, QR when link ready.
- `1dt` encode always includes presentation (`displayType` ≥ 1); persists `displaySchema` on saved records.
- Receive `#1dt/`: form mode → wizard (same as `1pb`); optional **Save as My Template** → `RecordTemplateService.receiveExternal` → Management pending import.
- View banner when `record._templateQr`.

Helpers: `js/lib/template-qr.js` (`WPTemplateQr`).

---

_End._
