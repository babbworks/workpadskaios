# NewEnt Business Template v2

Full-depth business plan creation template for Workpads KaiOS.
Ported from the v2-newent CLI tool's complete framework system.

## URI
`urn:workpads:tpl:newent:business:v1` (schema version 2)

## Schema
Type B (multi-slot) — renders business data in named slots: identity, plan, ent, contact.

## Wizard Screens (7 total)

| # | Tab | Name     | Fields                                                    |
|---|-----|----------|-----------------------------------------------------------|
| 0 | I   | Identity | Business Name*, Slug, Industry, Stage, Website            |
| 1 | C   | Contact  | Contact Name, Email, Phone, Role                          |
| 2 | L   | Location | Country, City, Region, Timezone                           |
| 3 | P   | Plan     | Plan Title, Industry Framework, Audience Framework, Type, Status, Target Audience |
| 4 | E   | Ent      | Purpose, Value Prop, Customer, Differentiation            |
| 5 | Pr  | Profile  | Vision, Mission, Founding Story                           |
| 6 | Co  | Coach    | Coach Voice, Coach Intent, Edge, Moat, Proof, Blocker     |

## Industry Frameworks (determines plan structure)

| ID | Name | Focus |
|---|---|---|
| `generic` | Generic Startup | Neutral baseline — exec summary, problem, solution |
| `saas` | SaaS | Recurring revenue, unit economics, product-led growth |
| `consumer-product` | Consumer Product | DTC/retail, SKU economics, channel mix |
| `professional-services` | Professional Services | Utilisation, retainer/project, delivery model |
| `manufacturing` | Manufacturing | BOM, CapEx, supply chain, quality/compliance |
| `nonprofit` | Nonprofit | Mission-driven, grants/donations, impact metrics |

Each framework scaffolds a specific set of plan sections (visible in the wizard when selected).

## Audience Frameworks (determines tone and packaging)

| ID | Name | Focus |
|---|---|---|
| `investor-seed` | Seed Investor | Traction-forward, concise, use-of-funds |
| `investor-growth` | Growth Investor | Three-statement financials, cohort analysis |
| `hbs-plan` | HBS Full Plan | Academic-style, 20-50 pages, full appendix |
| `bank-loan` | Bank Loan | Downside analysis, debt service, collateral |
| `internal-ops` | Internal Operations | Team-facing, execution milestones |
| `grant-application` | Grant Application | Mission, impact metrics, budget justification |

## Ent Intelligence Layer

100 structured fields across 7 groups (subset captured in wizard, full set via API):

- **overview** (12): purpose, value, customer, diff, revenue, star, focus, commit, model, thesis, pitch, promise
- **intel** (8): edge, timing, unfair, risks, moat, anchor, scenario, exit
- **landscape** (8): rival, threat, market, window, myth, category, niche, trend
- **demand** (8): pain, channel, wedge, switch, retain, cac, ltv, core
- **ops** (8): constraint, unit, runway, margin, tech, data, depend, network
- **self** (6): founder, proof, story, blocker, horizon, ask

Plus: Assumptions (with confidence tracking), Decisions (with rationale logging).

## Coaching Configuration

- **Voices**: quiet (title only), partial (title + hint), full (title + hint + context)
- **Intents**: orient, discover, decide, plan, narrate, prove, capital, expand, review

## Plan Configuration

- **Types**: startup | operations | custom
- **Statuses**: early | active | rough | archived
- **Stages**: idea | pre-seed | seed | series-a | growth | established

## Warmup Questions (7 default)

1. What problem does your business solve, and who experiences it most acutely?
2. How are people solving this problem right now, and why is that not good enough?
3. What is your proposed solution, and what makes it meaningfully different?
4. Who is your target customer, and how big is that market?
5. How will you make money, and what does one unit of revenue look like?
6. What is the single biggest risk to this business?
7. What does success look like in 12 months?

## Access

- List screen shortcut: `6` (New Business)
- App API: `App.showNewEntWizard()` or `App.showNewEntWizard(existingSlug)` for edit
- Data API: `NewEntTemplate.create(fields)`, `.list()`, `.get(slug)`, `.update(slug, fields)`, `.delete(slug)`
- Ent API: `NewEntTemplate.setEntField(slug, fieldId, value)`, `.getEntField(slug, fieldId)`, `.getEntGroupStatus(slug)`
- Intelligence: `NewEntTemplate.addAssumption(slug, body, confidence)`, `.addDecision(slug, description, rationale)`

## Storage

Businesses stored in localStorage under key `wp_newent_businesses` as a JSON array.
Each business also creates a linked record in RecordService with `record_class: 'newent'`.
Framework sections are scaffolded at creation time based on the selected industry framework.
