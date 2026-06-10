# P1 research confirmations — locked (v0.4 gate)
_Signed off 2026-05-24. Locks Phase 0 **P1** rows for Docs 7, 11, 12, 13. Strategic source: [`COMPRESSION-ROADMAP-LOCKED.md`](COMPRESSION-ROADMAP-LOCKED.md), [`ROUND-A4-COMPRESSION-ROADMAP.md`](ROUND-A4-COMPRESSION-ROADMAP.md)._

**v0.3 is unaffected** — relational compression ships in v0.4 per [`V04-COMPRESSION-SCOPE.md`](V04-COMPRESSION-SCOPE.md).

---

## Doc 7 — Semantic Compression

| Section | Decision |
|---------|----------|
| §4–5 | **Accept** — relational mode + dictionary interning; **wire in v0.4 only** (CR-01/02) |
| §6 standalone vs relational | **Accept** — mode bit in flag byte (Doc 3 §8.3); v0.3 stays standalone |
| §10.2 delta records | **Defer** v0.4+ evaluate (CR-09) |
| §7 predictive decoding | **Defer** — horizon only |

---

## Doc 11 — Symbol Table Synchronization

| Section | Decision |
|---------|----------|
| §4–6 | **Accept** — peer-scoped relationship tables; baseline domain tables |
| §4.1 sync transport | **Accept** — inline `TABLE_ENTRY_ADD` in record stream first (CR-06); dedicated `1ds/` deferred |
| §3.3 token immutability | **Accept** |
| §6 resolution blocks | **Accept** for third-party relay of relational records |
| §9 open items | **Defer** scheme tag `1ds/`, probability weights — track in `OPEN-QUESTIONS.md` if needed |

---

## Doc 12 — Relational Context and Micro-Ledgers

| Section | Decision |
|---------|----------|
| §3–4 | **Accept** — micro-ledger holds symbol table, sequence, obligations, stats profile |
| §4.2 auto-transition | **Accept** proposal (3 exchanges + sync); **UI suggest only** in v0.4 |
| §8 BitPads leg | **Defer** — not in v0.4 scope (PC-19 / CODEC-V2) |
| §9.2 micro-ledger UI | **Defer** — no dedicated screen in v0.4 |

---

## Doc 13 — Domain Profiles

| Section | Decision |
|---------|----------|
| §2.2 generic profile | **Accept** — required fallback on decode |
| §2.3 domain examples | **Accept** — first wire profile **`service_work.v1`** only (CR-03); `produce.v1` deferred (CR-04) |
| §4 selection rules | **Accept** — per-record + activity default; mismatch → generic + warn |
| §5 stewardship | **Accept** — Babb Works ships bundled defaults; stewards extend without fork |
| §9 open (wire cost, steward process) | **Defer** to v0.4 beta docs |

---

## Unblocks

- v0.4 implementation per `V04-COMPRESSION-SCOPE.md` (after v0.3 deploy)  
- Standard paragraphs for relational flag, symbol inline sync, profile id wire slot (draft in v0.4 train)

---

_End._
