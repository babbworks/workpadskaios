# Template Catalogue

**As of:** 2026-05-15  
**Source:** Inferred from codec design sessions (Rounds 1–26) and existing app templates  
**Format:** Obsidian checkboxes — `- [x]` exists / `- [ ]` needed / `- [~]` nice-to-have  
**Cross-reference:** FRAME-SPEC.md (wire layout), CODEC-STATUS.md (decisions), OPEN-QUESTIONS.md

---

## Group A — Core Financial Records (BASE_TEMPLATE=001)

Single-line, single-party, single transaction. The everyday worker record.

- [ ] **Job / Work done** — standard service record, no financial breakdown. `I>I` or `I<I` transaction byte. The default record type. #template #template/financial
- [ ] **Quote / Estimate** — `I>I` sub=01. Customer-facing, not yet settled. #template #template/financial
- [ ] **Invoice** — `I>I` sub=00. Formal payment request with due date. #template #template/financial
- [ ] **Receipt / Payment received** — `I<I` sub=00. Settlement confirmation. #template #template/financial
- [ ] **Deposit received** — `I<I` sub=01. Partial payment, balance outstanding. #template #template/financial
- [ ] **Expense paid** — `O<O` sub=00. Worker paid for something outright. #template #template/financial
- [ ] **Bill pending / Payable** — `O>O` sub=00. Supplier invoice not yet settled. #template #template/financial
- [ ] **Reimbursement claim** — `O>I` sub=00. Worker expects recovery of outlay. #template #template/financial
- [ ] **Reimbursed** — `O<I` sub=00. Outlay recovered. #template #template/financial
- [ ] **Refund given** — `I<O` sub=00. Money returned to customer. #template #template/financial
- [ ] **Credit note** — `I>O` sub=00. Future credit issued. #template #template/financial

---

## Group B — Compound Financial Records (BASE_TEMPLATE=001, COMPOUND_VALUE=1)

Multi-line, itemised. Uses compound line flags byte (OQ-29).

- [ ] **Multi-line invoice** — itemised charge lines, uniform tax treatment. #template #template/compound
- [ ] **Mixed T&M invoice** — time-and-materials lines (QTY_LINE=1) alongside fixed-price lines. #template #template/compound
- [ ] **Invoice with mixed tax** — line items with different TAX_MODE values (some standard, some exempt). Requires LINE_FLAGS_PRESENT=1. #template #template/compound
- [ ] **Compound expense record** — multiple cost lines in one record (e.g. fuel + materials + toll). #template #template/compound
- [ ] **Pay record with deduction breakdown** — gross + employee deductions + employer costs. LINE_TYPE=01/10 lines. Full pay mode. Requires OQ-29 compound line flags. #template #template/compound
- [~] **Split payment invoice** — single charge split across multiple payment methods (cash + card + credit). #template #template/compound
- [~] **Group invoice** — single job, multiple customers sharing the cost (e.g. shared accommodation cleaning). #template #template/compound
- [~] **Recurring charge record** — subscription or regular billing with period reference. #template #template/compound

---

## Group C — Period Report / Statement Records (BASE_TEMPLATE=001, 1pb presentation)

Aggregated views over a date range. Shareable as `#1pb/` URLs.

- [ ] **Customer account statement** — all charge records for a contact in a period. Invoiced / received / outstanding summary. Compound line items one per job. #template #template/report
- [ ] **Worker pay summary** — all cost/pay records for a worker in a period. Hours / gross / net totals. QTY_LINE=1 for hourly records. #template #template/report
- [ ] **Activity income summary** — all charge records for one activity in a period. Grouped by service type or customer. #template #template/report
- [ ] **Activity expense summary** — all cost records for one activity in a period. Grouped by category (job cost / running cost). #template #template/report
- [~] **Cross-activity period report** — income and expense across all activities. Year-end view. #template #template/report
- [~] **Tax summary report** — VAT/tax collected and paid in a period, by rate band. #template #template/report

---

## Group D — Contact / Entity Records (BASE_TEMPLATE=011)

Identity and relationship records. Not financial.

- [ ] **Personal contact card** — individual person. Name, phone/email, role, optional alt_id (for no-phone users). #template #template/contact
- [ ] **Business / Activity card** — organisation or trading entity. Name, trade name, location label, phone/email, services offered. #template #template/contact
- [ ] **Worker profile** — person in a worker role. Name, role, rate, activity associations. Shareable as `#1pb/` for roster import. #template #template/contact
- [ ] **Vendor / supplier card** — organisation supplying materials or services. Name, trade name, typical expense categories. #template #template/contact
- [~] **Subcontractor card** — person or entity providing specialist labour. Role codebook entry, typical rate. #template #template/contact
- [~] **Authority / regulator card** — tax authority, licensing body. Relevant for compliance record-keeping. #template #template/contact

---

## Group E — Presentation / Advertisement Records (`#1pb/`, BASE_TEMPLATE=001 or 011)

Micro-billboard records designed for display rather than transaction. (OQ-20–26)

- [ ] **Service menu advertisement** — activity name + list of services with prices. COMPOUND_VALUE=1, IS_ORG participant. Shareable as marketing URL or QR code. #template #template/presentation
- [ ] **Business card display** — branded contact card. Activity name, trade name, phone, services, accent_color. `data_source=10` (Activity profile). #template #template/presentation
- [ ] **Contact-resident card** — identifier only in payload; receiver's device fills contact data on match. Ultra-minimal (~15–20 bytes). (OQ-25) #template #template/presentation
- [ ] **Price list** — service catalog display with unit prices. DISPLAY_MODE=01 (list). No financial transaction. #template #template/presentation
- [~] **Appointment / booking display** — date, time, service, worker name. Display-only confirmation. #template #template/presentation
- [~] **Location card** — map link, address, operating hours. Activity or contact branded. #template #template/presentation
- [~] **Portfolio record** — showcase of past jobs with photos (attachment references). Post-MVP. #template #template/presentation

---

## Group F — Interactive / Form Records (`#1pb/` with form schema)

Presentation records with a collect-and-reply capability. (OQ-23)

- [ ] **Contact request form** — receiver fills their details and submits back as a contact card. `SUBMIT_ACTION=00` (reply record). #template #template/form
- [ ] **Job enquiry form** — customer describes what they need; submits back as a service request. #template #template/form
- [ ] **Booking / appointment request** — customer selects service + preferred date; submits back. #template #template/form
- [~] **Quote request form** — customer specifies scope; worker receives as a structured quote request. #template #template/form
- [~] **Feedback / review form** — post-job customer response. Submits back as a note record. #template #template/form

---

## Group G — State Records (BASE_TEMPLATE=101 — State Commit)

Snapshots, not transactions. No transaction byte.

- [ ] **Job completion state** — marks a job as closed. Summarises outstanding balance. Links child records via chain. #template #template/state
- [ ] **Pay period close** — pay period finalised. Cumulative pay summary for a worker in the period. #template #template/state
- [~] **Annual / year-end aggregate** — full-year income, expense, net. Useful for tax year summary. #template #template/state
- [~] **Activity snapshot** — point-in-time summary of an activity's financial position. #template #template/state

---

## Group H — Amendment Records (BASE_TEMPLATE=110)

Correction and dispute records. Carry only changed fields + flag mask. (Round 26)

- [ ] **Simple field correction** — corrects one or more scalar fields (date, description, amount) on a single-line record. #template #template/amendment
- [ ] **Compound line correction** — corrects qty, rate, or description on a specific compound line item. Carries `line_index` byte. #template #template/amendment
- [ ] **Dispute record** — formal disagreement lodged; does not propose specific values. ACK_REQUEST=1 on the original triggers this path. #template #template/amendment
- [~] **Counter-proposal** — Amendment proposing a different correction than the one received (counter to a customer's correction). #template #template/amendment

---

## Group I — Domain / Sector Templates (EXT_TEMPLATE=1, codebook extensions)

Domain-specific field schemas for sector workers. Use extended template bytes for routing.

- [~] **Electrician job record** — certification number, installation type, test results. #template #template/sector
- [~] **Plumber / gas engineer** — gas safe registration, appliance details, pressure test. #template #template/sector
- [~] **Cleaning service** — area (sqft/m²), product list, recurring schedule. #template #template/sector
- [~] **Transport / delivery** — route, distance (km), vehicle, load type. #template #template/sector
- [~] **Agricultural service** — crop type, area treated, input materials, seasonal reference. #template #template/sector
- [~] **Medical / health consultation** — practitioner ID, patient ref (anonymised), service category. #template #template/sector
- [~] **Construction / building** — site ref, phase, materials schedule, compliance ref. #template #template/sector
- [~] **Market trader record** — stall number, market name, produce/goods category. #template #template/sector
- [~] **Domestic worker record** — household ref, hours, recurring or one-off. #template #template/sector

---

## Group J — Template Infrastructure (App-side, not codec records)

Template definitions, not wire records — but affect how wire records are built.

- [ ] **System template definition** — JSON schema for a built-in template. Canonical serialisation for `1pt` hashing. (OQ-15) #template #template/infra
- [ ] **Protected custom template** — user-built template, immutable once shared. Content-addressed. (OQ-18) #template #template/infra
- [ ] **Open form builder template** — user-built from scratch using the form builder field vocabulary. (OQ-17) #template #template/infra
- [~] **Sector template package** — installable bundle of domain templates for a specific trade. Delivered via `#t/` fragment URL. #template #template/infra

---

## Summary counts

| Group | Must-have | Nice-to-have |
|---|---|---|
| A — Core financial | 11 | 0 |
| B — Compound financial | 5 | 3 |
| C — Period reports | 4 | 2 |
| D — Contact / entity | 4 | 2 |
| E — Presentation / ad | 4 | 3 |
| F — Interactive / form | 3 | 2 |
| G — State commit | 2 | 2 |
| H — Amendment | 3 | 1 |
| I — Sector / domain | 0 | 9 |
| J — Template infra | 3 | 1 |
| **Total** | **39** | **25** |

MVP scope ([ ] items): 39 templates.  
Full scope including nice-to-haves: 64.
