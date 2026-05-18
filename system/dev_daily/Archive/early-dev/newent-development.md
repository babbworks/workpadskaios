# NewEnt Feature — Development Notes
_Covers the full vision and outstanding design work for the New Business Entity feature._

---

## Current State (v0.1)

### What's wired and working
- `INDUSTRY_FRAMEWORKS` — 6 frameworks: generic, saas, consumer-product, professional-services, manufacturing, nonprofit
- `AUDIENCE_FRAMEWORKS` — 7 audience overlays (investor-seed, bank-loan, etc.)
- `STAGES`, `PLAN_TYPES`, `PLAN_STATUSES` — configuration option sets
- `FRAMEWORK_SECTIONS` — per-framework section lists (used for plan structure)
- `ENT_GROUPS` — 6 groups × 50+ intelligence fields (defined, partially wired to wizard)
- Business CRUD — `create()`, `list()`, `get()`, `update()`, `delete()`
- Slug validation — `toSlug()`, `isValidSlug()`, `isSlugUnique()`
- `WIZARD_SCREENS` — 7-screen definition (Identity / Contact / Location / Plan / Ent / Profile / Coach)
- `TEMPLATE_ENTRY` + `TEMPLATE_PAYLOAD` (Schema B) — registered on load, 4 named slots
- `setEntField()`, `getEntField()` — ent intelligence field helpers
- `COACH_VOICES`, `COACH_INTENTS` — referenced in WIZARD_SCREENS Coach tab

### What's in newent-wizard.js
The wizard renders the Identity, Contact, Location, Plan, and Ent screens from WIZARD_SCREENS. 
The Profile and Coach screens (screens 5 and 6) are defined but not confirmed to be reached
by current navigation — verify before extending.

---

## Removed from NewEntTemplate.js (v0.1 trim)

These were moved here because they have no current UI surface. When building the coaching
and assumption/decision tracking features, restore them to NewEntTemplate.js.

### WARMUP_QUESTIONS
A set of 7 structured warmup prompts used to help founders articulate their business before
filling in the plan. Intended for an onboarding/guided mode where the app asks one question
at a time before revealing the full NewEnt wizard.

```javascript
var WARMUP_QUESTIONS = [
  { body: 'What problem does your business solve, and who experiences it most acutely?',
    follow_up: 'Describe a specific person who would pay for this today.' },
  { body: 'How are people solving this problem right now, and why is that not good enough?',
    follow_up: 'What workaround are they using before they find you?' },
  { body: 'What is your proposed solution, and what makes it meaningfully different?',
    follow_up: 'What is the single most important thing it does better?' },
  { body: 'Who is your target customer, and how big is that market?',
    follow_up: 'Can you name three specific companies or people who would buy this week?' },
  { body: 'How will you make money, and what does one unit of revenue look like?',
    follow_up: 'What is your rough price point and why?' },
  { body: 'What is the single biggest risk to this business, and how do you plan to address it?',
    follow_up: 'If this risk materialises, what is your fallback?' },
  { body: 'What does success look like in 12 months?',
    follow_up: 'What is the one metric you would track above all others?' },
];
```

**Design intent:** Show these before the wizard. Each question has a `follow_up` that appears
after the user answers the main question. After all 7, the wizard opens with fields pre-filled
from warmup answers. On KaiOS: one question per screen, CSK = Next, RSK = Skip.

### addAssumption(slug, body, confidence)
Tracks business assumptions with confidence levels ('low' / 'medium' / 'high') and a status
field ('active' / 'tested' / 'invalidated'). Each assumption gets its own id and created_at.

**Design intent:** A separate Assumptions tab in the NewEnt view screen (or WorkpadsPanel
record mode for a business). The user lists assumptions they're operating on. As they test
them, they update the status. Investors look for founders who know their assumptions.

```javascript
// Stored on business.assumptions[]
{ id, body, confidence, status, created_at }
```

### addDecision(slug, description, rationale)
Logs irreversible or significant decisions with a rationale. Acts as a decision log for the
business — useful for founders reviewing why they chose a direction.

**Design intent:** A Decisions tab alongside Assumptions. Lightweight — just description +
rationale + timestamp. No status field since decisions are final (can be superseded but not
invalidated).

```javascript
// Stored on business.decisions[]
{ id, description, rationale, decided_at }
```

### getEntGroupStatus(slug)
Returns filled/total counts for each ENT_GROUP, used for a progress indicator showing how
complete the ent intelligence profile is.

```javascript
// Returns: { overview: { total: 12, filled: 3 }, intel: { total: 8, filled: 1 }, ... }
```

**Design intent:** A progress bar or completion badge in the business list and at the top
of the NewEnt view screen. Motivates users to fill in more ent fields. Could also trigger
coaching prompts when a group is empty.

---

## Schema B — Named Slot Rendering (TemplateRegistry)

NewEntTemplate registers a Schema B template (`urn:workpads:tpl:newent:business:v1`) with
4 named slots: `identity`, `plan`, `ent`, `contact`.

**Schema B design intent:** Each slot is independently addressable. A panel preview can render
only the `identity` slot. A full view renders all 4. This avoids re-rendering the entire
template just to update one section.

When newent-wizard.js or a future newent-view.js calls `TemplateRegistry.render(uri, data)`,
`renderB()` in TemplateRegistry will compose all slots with shared CSS. Currently the wizard
renders inline — migrating it to use Schema B is a Phase 2 task.

---

## Schema P — Section-Based Rendering (TemplateRegistry)

**Schema P design intent:** Renders a document as ordered independent sections, each with its
own CSS. Maps directly to `FRAMEWORK_SECTIONS` — a professional-services business plan has
10 sections (Executive Summary, Client Problem, Service Offering, etc.), each becoming its
own `<section>` element with self-contained styling.

**Primary use case:** Business plan document export or in-app "presentation view" where the
user scrolls through plan sections like a deck. Not applicable to the KaiOS main UI (too
small). Most relevant if the app ever renders to a print/share surface.

`renderP()` is 10 lines in TemplateRegistry.js. No Schema P payload exists in the codebase.
Keep it — it will be needed when document export is built.

---

## ENT_GROUPS — Full Intelligence Field Map

The full ENT_GROUPS map has 6 groups × 50+ fields. Currently the Ent wizard tab (screen 4)
only captures 4 fields: purpose, value, customer, diff. The remaining fields are defined
but not surfaced.

### Roadmap for ent fields
- **Phase 2 (v0.2):** Add remaining `overview` group fields to Ent wizard tab
- **Phase 3 (v0.3):** Add `intel` group fields (edge, timing, moat, risks, etc.)
- **Phase 4:** Add remaining groups (landscape, demand, ops, self) as additional wizard screens
- **Endgame:** Full ent intelligence profile browsable via WorkpadsPanel record mode for businesses

### COACH_VOICES & COACH_INTENTS
Currently defined and exposed in WIZARD_SCREENS (Coach tab, screen 6). Verify whether the
coach tab is actually reachable in newent-wizard.js before building the coaching UI.

Coach voice controls verbosity of coaching prompts:
- `quiet` — heading title only
- `partial` — title + hint
- `full` — title + hint + context

Coach intent orients the coaching questions toward a specific goal (orient, discover, decide,
plan, narrate, prove, capital, expand, review).

---

## Development Priorities

1. Verify which WIZARD_SCREENS are actually rendered (screens 5 Profile, 6 Coach)
2. Add `getEntGroupStatus()` back once a progress indicator is designed
3. Implement WARMUP_QUESTIONS as a pre-wizard guided mode
4. Build Assumptions and Decisions UI (tabs in newent view or WorkpadsPanel)
5. Migrate newent-wizard.js to use TemplateRegistry.render() for display (Schema B)
6. Design Schema P export surface (print / WhatsApp share as formatted document)
