# Closing tasks CT-1–CT-3 — scaffold locked

**Gate:** Full binary QR spec + hosted print service remain future; app + link-lab scaffolds are in-tree.

| ID | Deliverable | Module / surface |
|----|-------------|------------------|
| CT-1 | `WPQ1` packet + `#bq1/` bridge | `js/lib/binary-qr.js`, `app.js` `resolveIncomingHash`, link-lab `binary-qr.html` |
| CT-2 | `@alias` / `written:` → fragment | `js/lib/written-code.js` (`wp_written_aliases_v1`), link-lab `written-code.html`, receive resolve |
| CT-3 | Human print summary (local) | `js/lib/print-record.js`, view **Print summary**, link-lab `print-record.html` |

## Tests

- `test/binary-qr.test.js`
- `test/written-code.test.js`
- `test/print-record.test.js`

## Not in this slice

- CT-4 `1df/` split mode
- Hosted print microservice
- Camera binary QR decode (lab encode/decode + shell receive only)

---

_End._
