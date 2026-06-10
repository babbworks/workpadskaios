# Closing tasks — after codec + templates are stable
_Gate: template QR + pads-v2/`1pv` variations in **strong state** (tests green, vectors published)._

| ID | Task | Owner track |
|----|------|-------------|
| CT-1 | **Binary QR** path (raw bytes, scheme magic) | **Scaffold done** — `binary-qr.js`, `#bq1/`, lab; full spec → `workpads-standard` |
| CT-2 | Human **10–30 char** written code ↔ wire (spec + lab L6) | **Scaffold done** — `written-code.js`, `@alias` receive |
| CT-3 | **Printed record** service (options: full QR, short code, human summary) | **Scaffold done** — local `print-record.js` + view; hosted service TBD |
| CT-4 | `1df/` split mode if concatenated SMS insufficient in target markets | transmission |

**In flight before closing gate:** template QR (`1pb` + `1dt/`), NFC high-value flows, `spec-tests/` per repo.

---

_End._
