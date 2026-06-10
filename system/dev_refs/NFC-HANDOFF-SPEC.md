# NFC handoff — spec (v1)
_2026-05-24. High-value tap flows per `P2-CONFIRMATIONS-LOCKED.md`._

---

## Principle

NFC carries a **Workpads URL** (NDEF URI record). The record bytes are unchanged; tap is a dumb channel (Doc 5).

---

## Scenarios

| ID | When | Payload |
|----|------|---------|
| `invoice_handoff` | Share screen after encode | Full `#1pv/` or `#1pa/` URL |
| `ack_return` | After action receive → ack share | Ack record URL |
| `pos_confirm` | View on payment/invoice | Same URL + optional short label in UI |

---

## API (`js/lib/nfc-handoff.js`)

| Method | Purpose |
|--------|---------|
| `isAvailable()` | Web NFC (`NDEFReader`) or future KaiOS bridge |
| `writeUrl(url, opts, onOk, onErr)` | Push URI to peer device |
| `readUrl(onOk, onErr)` | One-shot read → callback(url) |
| `listenIncoming(onUrl)` | Poll/read while screen open (lab + app) |

---

## Platform notes

| Platform | Support |
|----------|---------|
| Link-lab (Chrome) | Web NFC when `NDEFReader` present |
| KaiOS | `navigator.mozNfc` tag read/write + P2P tap; requires `nfc` / `nfc-share` in manifest |

---

## App wiring

- **Share:** key **2** = Tap NFC (when URL ready + NFC available); scenario from record (`invoice_handoff` / `ack_return` / `pos_confirm`)
- **Action receive / gatekeeper:** ack share opens share with `nfcScenario: ack_return`
- **Home + list:** background NFC listen → same decode path as URL hash receive

---

## Tests

- `test/nfc-handoff.test.js` — scenario constants + URL normalisation (no hardware)

---

_End._
