# Project Association Design

**Status:** design — 2026-05-17
**Depends on:** FRAME-SPEC.md, STANDARD-FIELDS.md (tag field §3.1)
**Maturity:** notes → **design** → draft-spec → spec → standard-doc

---

## 1. The Core Constraint

**Financial items: maximum 1 project.**
A financial record (invoice, payment, expense, COGS) may belong to at most one project. Associating a single financial item with two projects creates an accounting split problem: which project absorbs the cost or recognises the revenue? Without an explicit allocation, double-counting or omission is guaranteed.

**Service/job records: 1 or more projects.**
A service record (job note, visit record, activity log) describes work. Work can legitimately span multiple projects — a site visit covering two concurrent contracts, a meeting about three ongoing engagements. No accounting implications; the record is descriptive.

**This constraint is enforced at the app layer, not the wire format.** The wire format carries whatever is in the tag field. The app refuses to encode more than one `proj:` prefix on a financial record and warns if a service record has more than N (TBD) project associations.

---

## 2. Current Wire Mechanism (MVP)

Via tag field (FLAGS3 bit 1), comma-separated string:

```
Financial record (max 1 project):
  tag = "proj:uid_alpha,urgent"          ✓ valid
  tag = "proj:uid_alpha,proj:uid_beta"   ✗ app rejects (financial + 2 projects)

Service record (multiple projects OK):
  tag = "proj:uid_alpha,proj:uid_beta,site-visit"   ✓ valid
```

**Parsing rule:** prefix `proj:` identifies a project association. App extracts all `proj:` prefixed segments and treats the rest as free-form tags.

**Limitation:** project names are not in the record — only project UIDs. To display "Westfield Mall" instead of `proj:abc123`, the app must have the project record in local storage or fetch it. On first encounter with an unknown UID, app displays the UID truncated.

---

## 3. Project Record Type

A project IS a workpads record. Specifically: `BASE_TEMPLATE=101` (State Commit) or `BASE_TEMPLATE=000` (Service record) with a specific template variant that marks it as a project container.

**Project record fields:**
- `job` (bit 0): project name — "Westfield Mall Fit-Out"
- `date` (bit 2): project start date
- `date_end` (FLAGS3 bit 3): project end date (expected)
- `uid` (FLAGS3 bit 5): project UID — this is what other records reference via `proj:uid`
- `customer` (bit 1): client name
- `ref_number` (bit 13): project code / contract number
- `story` (bit 11): project description / scope
- `tag` (FLAGS3 bit 1): project category tags

**Template marker:** the project record uses a specific `BASE_TEMPLATE=000` (Service) with a dedicated template ID in the template registry that marks it as `project_container`. Decoder recognises this and treats the record as a project index entry rather than a single-event record.

---

## 4. Project-Financial Item Allocation (Post-MVP)

For cases where a cost genuinely spans two projects and must be explicitly allocated:

**Split record pattern:**
- Original expense record: total amount, `tag = "proj:uid_alpha"` (primary project absorbs)
- Companion amendment or second record: the portion allocated to the second project
- The split can be arbitrary (60/40, 50/50, or specific amounts)

**Allocation field (FLAGS4 future):**
A future `allocation_pct` field (uint8, 1–99 as percentage, 100=full, 0=unallocated) could signal partial allocation. A financial record with `allocation_pct=60` means "60% of this cost belongs to the associated project; 40% is unallocated or belongs to the overhead pool."

Wire encoding: FLAGS5 bit 3 (post-MVP reserve). Not in current FLAGS4 layout.

---

## 5. Project Summary Records

A project accumulates records over time. The aggregation mechanism:

**Job close State Commit:** `BASE_TEMPLATE=101`, `COMMIT_TYPE=00` — closes a project phase. The compound block carries:
- Line 1: total revenue (all `I>I` financial records in chain)
- Line 2: total expenses (all `O<O` financial records in chain)
- Line 3: net margin
- Summary line: project status summary

The chain link `&c=<project_uid>` ties the State Commit to the project record. Chain depth signals which phase close this is (1st = phase close, final = project close with `CHAIN_COMPLETE=1`).

**App-side project view:** the app aggregates all records with `tag` containing `proj:<uid>` and presents:
- Revenue total
- Expense total
- COGS total
- Net margin
- Outstanding invoices / unpaid bills
- Linked workers and clients

---

## 6. Multi-Project Scenario Examples

**Scenario: worker has two concurrent contracts**

```
Record A: "Electrical inspection, Westfield" (service note)
  tag = "proj:uid_westfield,inspection"
  No financial block → multiple projects OK

Record B: "Cable purchase, £45" (expense, O<O)
  tag = "proj:uid_westfield"
  Financial block present → max 1 project enforced
  This cost absorbed by Westfield project

Record C: "Cable purchase, £30" (expense, O<O)
  tag = "proj:uid_eastgate"
  Separate record for different project
```

Worker does NOT encode a £75 total expense with two project tags. They create two records: £45 to Westfield, £30 to Eastgate. Each record is a clean, auditable entry.

**Scenario: project manager reviewing all site costs**

1. Fetch all records where `tag CONTAINS proj:uid_westfield`
2. Filter: `financial_block=1` → cost records only
3. Sum `customer_amount` where `EXPENSE_CAT=00` → billed items
4. Sum `worker_amount` where `EXPENSE_CAT=01` → absorbed COGS
5. Sum both where `EXPENSE_CAT=10` → running costs allocated to project

Clean accounting, no ambiguity. The one-project-per-financial-item constraint is what makes this aggregation reliable.

---

## 7. Open Design Questions

- **OQ-PA1** — Project record BASE_TEMPLATE: is `000` (Service) right for a project container, or should it use `111` (Generic) + DOMAIN bits? Generic allows financial context (budget tracking) on the project record itself.
- **OQ-PA2** — Project hierarchy: can a project have sub-projects? (E.g., Phase 1 and Phase 2 of a large contract.) Chain linking supports this: a sub-project record chains to its parent project UID. But the tag-based lookup would only find direct associations, not transitive ones.
- **OQ-PA3** — Project UID stability: if a project record is amended, the UID stays the same (it's in the original record). Does FLAGS3 `uid` refer to the original record UID or a stable project identifier? Recommendation: the project UID is stored in a dedicated `project_uid` field (FLAGS4 slot, future) separate from the record UID, so amendments don't change the project's identifier.
- **OQ-PA4** — App-side project directory: should the app maintain a local project directory (project UIDs → project names) so names display immediately without a fetch? Yes — project names are fetched once and cached permanently (project names are stable; changes produce amendments).
- **OQ-PA5** — Tag field size with project UID: a UUID v4 is 36 chars. `proj:` prefix = 5 chars. Total = 41 chars. tag field max = 60B. One project + one category tag = ~52 chars — fits. Two projects (service records) = ~87 chars — exceeds 60B. Need to decide: increase tag max, or truncate UIDs to ~12 chars (collision-low enough at typical project counts).
