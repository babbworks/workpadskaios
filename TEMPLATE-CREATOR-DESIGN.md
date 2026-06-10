# Branching Template Creator — Design Document

## 1. Purpose & Goals

The template creator exists to let a user define a reusable record skeleton that:

1. **Pre-fills any codec field** — every field the codec can encode becomes addressable in a template, so a created record arrives at the wizard already complete or near-complete.
2. **Extends beyond the codec** — custom fields with arbitrary keys and labels can be stored on a record and passed through to the wizard as user-defined data.
3. **Exposes field synonyms** — every standard codec field has a canonical label ("Customer", "Worker", "Job", etc.). A template can override each label with a synonym ("Client", "Contractor", "Project") that replaces it throughout the wizard UI when that template is applied.
4. **Encodes persona and workflow intent** — who is this template for, in which activity, at which routing setting, with which defaults already decided.
5. **Works on a 240×320 D-pad device** — the creator is a multi-step wizard, one focused topic per screen, navigated entirely by arrow keys + Enter + Backspace with no simultaneous-field overload.

---

## 2. Record Type Tree & Branching Map

The type chosen at step 1 gates which branch groups appear. Types map to record_class/record_type pairs in the codec.

```
TYPE SELECTED
│
├── Job (record_type='', record_class='job')
│   Branch groups: Identity → Parties → Financial → Lines → Routing → Custom → Synonyms → Review
│
├── Quote (record_type='quote', record_class='job')
│   Branch groups: Identity → Parties → Financial → Lines → Expiry → Routing → Custom → Synonyms → Review
│
├── Invoice (record_type='invoice', record_class='job')
│   Branch groups: Identity → Parties → Financial → Lines → Payment → Routing → Custom → Synonyms → Review
│
├── Receipt (record_type='receipt', record_class='job')
│   Branch groups: Identity → Parties → Financial → Routing → Custom → Synonyms → Review
│
├── Basic / Pad (record_type='pads', record_class='pads')
│   Branch groups: Identity → Content → Routing → Custom → Synonyms → Review
│
├── Business / NewEnt (record_type='newent', record_class='newent')
│   Branch groups: Identity → Parties → Contact Details → Routing → Custom → Synonyms → Review
│
└── Contact (record_type='contact', record_class='contact')
    Branch groups: Identity → Contact Details → Custom → Synonyms → Review
```

Each branch group is a single wizard screen. The step count shown at the top of the creator adapts based on the chosen type.

---

## 3. Step Inventory (All Possible Steps)

### Step 0 — Type Selection
Identical to the existing type picker overlay. Once a type is confirmed the creator begins step 1.
- Input: record type selection
- Output: sets `record_type`, `record_class`
- Navigation: list, D-pad up/down, Enter to confirm, Backspace to cancel entirely

---

### Step 1 — Template Identity
Who is this template, not what it creates.

| Field | Codec field | UI element | Notes |
|---|---|---|---|
| Template name | — (template metadata) | text input | Required. Not pre-filled into records. |
| Description | — (template metadata) | text input | Optional. Shown in template list. |
| Icon / tag colour | — (template metadata) | colour swatch picker | Optional. Visual identifier in template list. |
| Linked activity | activityId | select (list of WorkActivities) | Pre-assigns the record to an activity on creation. |

---

### Step 2 — Record Identity
The title and date shape of the record.

| Field | Codec field | Synonym-able | Notes |
|---|---|---|---|
| Title / Job name | `job` | Yes ("Project", "Task", "Service", "Matter") | Pre-fill or leave blank |
| Description | `description` | Yes ("Summary", "Scope") | Secondary title for some types |
| Record date | `date` | No | ISO date string; can pre-fill as "today" or leave blank |
| Due date | `due_date` | Yes ("Deadline", "Delivery date") | Relevant for Invoice/Quote |
| Tag | `tag` | Yes ("Category", "Code", "Label") | Short free-text classifier |
| Context label | `context_label` | Yes ("Phase", "Department", "Reference") | Longer contextual string |

---

### Step 3 — Parties
Who is involved. Applies to Job/Quote/Invoice/Receipt/Business.

**Primary party (customer side):**

| Field | Codec field | Synonym-able | Notes |
|---|---|---|---|
| Customer name | `customer` | Yes ("Client", "Buyer", "Patient", "Tenant", "Member") | Main counterparty |
| Customer phone | `customer_phone` | Yes ("Client phone", "Contact number") | Tel input |

**Worker / provider side:**

| Field | Codec field | Synonym-able | Notes |
|---|---|---|---|
| Worker | `worker` | Yes ("Contractor", "Staff", "Provider", "Rep") | Who does the work |
| Internal cost | `worker_amount` | Yes ("Cost price", "Labour cost") | uint24 in codec financial block |

**Participants block** (zero or more, each is a codec participant entry):

Each participant row stores:
| Sub-field | Codec mapping | Notes |
|---|---|---|
| Name | `participants[n].name` | |
| Role type | `participants[n].roleType` | Integer 0–15 from role codebook |
| Role text | `participants[n].roleText` | Free text override |
| Phone | `participants[n].phone` | |
| Email | `participants[n].email` | Extended field |
| Trading name | `participants[n].tradingName` | Extended field |
| Is organisation | `participants[n].isOrg` | Boolean flag |

In the template creator, participants pre-filled in a template appear as seed rows in the wizard's participant list. They can be named placeholders ("Add client here") or actual fixed entries (e.g., always cc: a specific partner).

---

### Step 4 — Contact Details
Applies to Contact and Business types, and available as an optional sub-step for any type.

| Field | Codec field | Synonym-able | Notes |
|---|---|---|---|
| Location / address | `location` | Yes ("Address", "Site", "Office") | Free text |
| URL | `url` | Yes ("Website", "Profile link") | |
| Attachment | `attachment` | Yes ("Document", "File link") | URL pointing to file |
| Meeting time | `meeting_time` | Yes ("Appointment", "Session time") | ISO datetime |
| Start time | `start_time` | Yes ("From") | |
| End time | `end_time` | Yes ("To", "Until") | |

---

### Step 5 — Financial Settings
Applies to Job/Quote/Invoice/Receipt.

**Amounts & currency:**

| Field | Codec field | Synonym-able | Notes |
|---|---|---|---|
| Currency | `currency` | No | Select from supported list |
| VAT / tax mode | `vat` | Yes ("GST", "Sales tax", "VAT rate") | Preset: none / standard / zero / custom |
| Custom tax rate | `custom_tax_rate` | No | Percentage, only if vat=custom |
| Service reference | `service_ref` | Yes ("PO number", "Contract ref", "Auth code") | FIELDS4_FINANCIAL bit 0 |
| Expiry date | `expiry_date` | Yes ("Valid until", "Quote expires") | FIELDS4_FINANCIAL bit 1 |

**Compound lines meta:**

| Field | Codec field | Notes |
|---|---|---|
| Has total summary row | `hasTotalSummary` | Boolean. Adds a total row in codec. |
| Has subtotals | `hasSubtotals` | Boolean. Adds subtotal grouping in codec. |

---

### Step 6 — Line Items
Applies to Job/Quote/Invoice. Template can pre-define zero or more seed line items.

Each line item:

| Sub-field | Codec mapping | Notes |
|---|---|---|
| Label | `compound_lines[n].label` | Description of the line |
| Quantity | `compound_lines[n].qty` | Numeric |
| Rate | `compound_lines[n].rate` | Numeric |
| Line type | `compound_lines[n].lineType` | 0=standard, 1=discount, 2=tax, 3=header |
| Tax mode | `compound_lines[n].taxMode` | 0=none, 1=inclusive, 2=exclusive, 3=compound |
| Unit | `qty_unit` (record-level) | e.g. hrs, days, units |

Template seed lines are useful for standard service packages: "Consultation – 1hr @ rate", "Travel – fixed fee", etc.

---

### Step 7 — Routing Defaults
Share-time settings that the template encodes as defaults (user can override at share time).

| Field | Codec mapping | Notes |
|---|---|---|
| Request read receipt | `ackRequest` | meta1 bit 2 |
| Restrict forwarding | `restrictForward` | meta2 bit 0 |

These become default checked/unchecked states on the share screen whenever this template's records are shared.

---

### Step 8 — Content (Basic / Pad type only)
For record_class='pads' records.

| Field | Codec field | Synonym-able | Notes |
|---|---|---|---|
| Story / body text | `story` | Yes ("Notes", "Memo", "Minutes") | Pre-fill default body |
| Details | `details` | Yes ("Additional info", "Notes 2") | Secondary text block |

---

### Step 9 — Custom Fields
Fields that have no codec equivalent. Stored in a `customFields` array on the template object and injected into the wizard as additional input rows.

Each custom field definition:

| Property | Type | Notes |
|---|---|---|
| `key` | string | Machine key, e.g. `cf_project_code`. Namespaced with `cf_` prefix. |
| `label` | string | Display label shown in wizard, e.g. "Project code" |
| `type` | enum | `text` / `number` / `date` / `url` / `phone` / `textarea` / `toggle` |
| `defaultValue` | string | Pre-filled value, or empty |
| `required` | boolean | Whether the wizard should mark this field mandatory |
| `placeholder` | string | Hint text inside the input |
| `position` | enum | `after_identity` / `after_parties` / `after_financial` / `before_review` — where in the wizard this field group appears |

Custom fields are stored on the record under their `key` and survive round-trips (the wizard saves them, view.js renders them if present).

---

### Step 10 — Field Synonyms
A synonym map lets the template rename any standard codec field label across the entire wizard UI when this template is active.

The synonym editor presents a two-column list:
- Left column: canonical codec label (read-only)
- Right column: synonym input (editable, empty = use default)

**All synonym-able fields (canonical → example synonyms):**

| Canonical | Example synonyms |
|---|---|
| Job | Project, Task, Service, Engagement, Matter, Case, Event |
| Customer | Client, Buyer, Patient, Tenant, Member, Subscriber |
| Customer phone | Client phone, Contact number |
| Worker | Contractor, Staff member, Provider, Agent, Rep |
| Internal cost | Cost price, Labour cost, Buy rate |
| Due date | Deadline, Delivery date, Payment due |
| Tag | Category, Code, Segment, Department |
| Context label | Phase, Reference, Stage, Campaign |
| Location | Address, Site, Venue, Office |
| Meeting time | Appointment, Session, Scheduled time |
| Start time | From, Open, Check-in |
| End time | To, Close, Check-out |
| URL | Website, Link, Profile |
| Attachment | Document, File, Spec |
| VAT | GST, Sales tax, VAT, Tax rate |
| Service ref | PO number, Contract ref, Auth code, Booking ref |
| Expiry date | Valid until, Quote expires, Offer ends |
| Story | Notes, Memo, Minutes, Brief |
| Details | Additional info, Notes 2, Follow-up |
| Unit | Units, Hours, Days |

Synonyms are stored as `fieldSynonyms: { job: 'Project', customer: 'Client', ... }` on the template object.

When a record is created from this template and opened in the wizard, the wizard reads the active template ID, loads its synonyms, and substitutes all labels before rendering.

---

### Step 11 — Field Visibility & Required
Control which fields appear at all and which are mandatory.

Two toggleable lists:
1. **Hidden fields** — codec fields that should never appear in the wizard for this template type. Example: a Receipt template hiding `expiry_date` and `meeting_time`.
2. **Required fields** — fields the wizard should refuse to proceed without. Example: an Invoice template requiring `due_date` and `customer`.

Stored as:
- `hiddenFields: ['expiry_date', 'meeting_time']`
- `requiredFields: ['due_date', 'customer']`

---

### Step 12 — Review & Save
A read-only summary screen listing:
- Template name, type, linked activity
- Count of pre-filled fields, custom fields, synonyms overridden
- Hidden fields, required fields
- Seed participants count, seed line items count

Soft-left: Back (to last step). Center: Save. Backspace: Back.

On save the template is written to RecordTemplateService and the user is returned to the template list.

---

## 4. Navigation Model (D-Pad)

### Within each step
- **ArrowUp / ArrowDown**: move focus between fields in the step
- **ArrowLeft / ArrowRight**: cycle through select options or toggle booleans when a select/toggle is focused
- **Enter**: confirm current field value and advance focus; on last field, advance to next step
- **Backspace**: if any input is focused and empty → go back to previous step; if input has content → clear it first (standard browser behaviour)
- **SoftRight** (KaiOS right softkey): advance to next step immediately
- **SoftLeft** (KaiOS left softkey): back one step

### Step progress bar
At the top of each step: `Step N of M — Step Name`
Where M is the total count for this type's branch. Rendered as a thin segmented bar.

### Step transition animation
Simple CSS `translateX` slide. Current step slides out left, next step slides in from right. Reverse for back navigation. Pure CSS, no JS animation library.

---

## 5. Synonym System — Technical Detail

### Storage on template object
```
{
  id: 'rtpl_...',
  name: 'Consulting Job',
  record_type: '',
  record_class: 'job',
  fieldSynonyms: {
    job:          'Project',
    customer:     'Client',
    worker:       'Consultant',
    service_ref:  'PO number',
    due_date:     'Deadline'
  },
  hiddenFields: ['meeting_time', 'attachment'],
  requiredFields: ['customer', 'due_date'],
  customFields: [
    { key: 'cf_po_ref', label: 'Purchase order', type: 'text', defaultValue: '', required: false, position: 'after_financial' }
  ],
  ...
}
```

### How the wizard reads synonyms
When `App.showWizard(rec)` is called and `rec._templateId` is set, the wizard:
1. Calls `RecordTemplateService.get(rec._templateId)`
2. Stores `tpl.fieldSynonyms` in a module-level `activeSynonyms` map
3. A helper `synLabel(fieldKey, fallback)` checks `activeSynonyms[fieldKey]` first
4. Every field label call goes through `synLabel()` instead of a hardcoded string

This means: no change to field storage keys, only display labels change.

---

## 6. Custom Fields — Technical Detail

### Wizard injection points
The wizard has four named injection points where custom fields are inserted:

| Position constant | After which wizard section |
|---|---|
| `after_identity` | After the main title/date fields |
| `after_parties` | After customer/worker/participants |
| `after_financial` | After the financial block |
| `before_review` | At the very end before the sign-off section |

### Rendering
Custom field rows render identically to standard field rows. The only visual distinction: a small `[custom]` marker in the label (optional, can be hidden by a setting).

### Saving to record
Custom field values are written to the record object under their `cf_` key alongside all other fields. RecordService stores them transparently. The view screen renders any `cf_` prefixed key it finds as a plain labelled field row, using the template's custom field label if the template is linked.

### Codec behaviour
Custom fields are NOT encoded by the codec. They exist only in the local record store. When a record is shared via codec URL, only the codec-defined fields are transmitted. Custom fields stay local. This is by design: the codec is a compact wire format, not a general-purpose schema.

---

## 7. Extended RecordTemplateService Schema

Current `TEMPLATE_FIELDS` expands to include all codec-reachable fields plus the new metadata fields:

```
TEMPLATE_FIELDS (wire fields pre-filled into record):
  record_type, record_class,
  job, description,
  customer, customer_phone, worker, worker_amount,
  location, meeting_time, start_time, end_time,
  vat, custom_tax_rate, currency,
  service_ref, expiry_date,
  qty_unit, tag, context_label, url, attachment,
  details, story,
  compound_lines, participants,
  activityId,
  hasTotalSummary, hasSubtotals,
  due_date

TEMPLATE_METADATA (stored on template, not pre-filled into record):
  id, name, description, createdAt, updatedAt,
  iconColor,
  fieldSynonyms: {},
  hiddenFields: [],
  requiredFields: [],
  customFields: [],
  routingDefaults: { ackRequest: false, restrictForward: false }
```

The `_templateId` field is stamped on created records so the wizard and view can reload synonyms and custom field labels.

---

## 8. Entry Points Into the Creator

### A — From type picker (pressing "1" on list screen)
The type picker gains a mode toggle: **New Record** | **New Template**.
Switching to "New Template" mode changes the picker header and causes `selectType()` to call `TemplateCreatorScreen.open({ recordType: value })` instead of `App.showWizard()`.

### B — From management screen → Templates tab → "+ New template"
Opens the creator at step 0 (type selection) with no pre-filled type.

### C — From view screen → Options → "Save as template"
Opens the creator at step 1 (template identity) with all record fields pre-populated as defaults and the type already set from the record.

### D — From management screen → Templates tab → Edit an existing template
Opens the creator at step 1 with all saved template values loaded, in edit mode.

---

## 9. Screen Architecture

A new screen module: `js/screens/template-creator.js`

Exposes: `window.TemplateCreatorScreen`

Public API:
```
TemplateCreatorScreen.open(opts)
  opts.recordType  — pre-select type, skip step 0
  opts.fromRecord  — record object, pre-populate all fields
  opts.editId      — template id to edit (loads existing template)
  opts.returnTo    — 'list' | 'management' (where Backspace on step 0 goes)

TemplateCreatorScreen.onKey(key)
TemplateCreatorScreen.onShow(opts)
```

The creator renders into the same `#wizard-content` container as the record wizard, using the same outer chrome (header, softkey bar). It is registered as a screen in `App.js` alongside the others.

---

## 10. Step Object Model

Each step is defined as a plain object:

```javascript
{
  id:       'parties',
  title:    'Parties',
  applies:  ['job', 'quote', 'invoice', 'receipt', 'newent'],  // or 'all'
  fields:   [ ... ],     // field descriptor list (see below)
  onEnter:  function(state) {},   // called when step becomes active
  onLeave:  function(state) {},   // called when advancing past this step
  validate: function(state) {}    // returns error string or null
}
```

Field descriptor:
```javascript
{
  key:         'customer',           // storage key on template / record
  label:       'Customer',           // canonical label (synonym-able)
  synonymKey:  'customer',           // key into fieldSynonyms map
  type:        'text',               // text|number|date|tel|url|textarea|select|boolean|participants|lines|color
  options:     [],                   // for select type
  defaultVal:  '',
  placeholder: 'Customer name...',
  required:    false,
  hint:        'Will be pre-filled into the record'
}
```

Steps are assembled into a pipeline at `open()` time based on the chosen record type. The active pipeline is stored in state and iterated by the navigation logic.

---

## 11. Codec Field Coverage Matrix

This matrix tracks which codec capabilities are addressable by a template, for reference during implementation:

| Codec section | Field | In template? | Notes |
|---|---|---|---|
| Header | version | No | Always pads-v1 |
| Header | record_type | Yes | Set at type selection |
| Header | record_class | Yes | Derived from type |
| FIELDS1 | customer | Yes | Step 3 |
| FIELDS1 | customer_phone | Yes | Step 3 |
| FIELDS1 | worker | Yes | Step 3 |
| FIELDS1 | location | Yes | Step 4 |
| FIELDS1 | meeting_time | Yes | Step 4 |
| FIELDS1 | start_time | Yes | Step 4 |
| FIELDS1 | end_time | Yes | Step 4 |
| FIELDS2 | vat | Yes | Step 5 |
| FIELDS2 | custom_tax_rate | Yes | Step 5 |
| FIELDS2 | currency | Yes | Step 5 |
| FIELDS2 | qty_unit | Yes | Step 6 |
| FIELDS2 | tag | Yes | Step 2 |
| FIELDS2 | context_label | Yes | Step 2 |
| FIELDS2 | url | Yes | Step 4 |
| FIELDS3 | attachment | Yes | Step 4 |
| FIELDS4 | service_ref | Yes | Step 5 |
| FIELDS4 | expiry_date | Yes | Step 5 |
| FIELDS4 | gps_binary | No | Geolocation API needed, runtime only |
| Financial block | amount | No | Runtime only (calculated from lines or input) |
| Financial block | due_date | Yes | Step 5 |
| Financial block | workerAmount | Yes | Step 3 (internal cost) |
| Compound lines | label, qty, rate | Yes | Step 6 |
| Compound lines | lineType | Yes | Step 6 |
| Compound lines | taxMode | Yes | Step 6 |
| Compound lines | hasTotalSummary | Yes | Step 5 |
| Compound lines | hasSubtotals | Yes | Step 5 |
| Participants | name, phone | Yes | Step 3 |
| Participants | roleType, roleText | Yes | Step 3 |
| Participants | email | Yes | Step 3 |
| Participants | tradingName | Yes | Step 3 |
| Participants | isOrg | Yes | Step 3 |
| Meta1 | ackRequest | Yes | Step 7 |
| Meta2 | restrictForward | Yes | Step 7 |
| Story | story | Yes | Step 8 (Basic) / always available |
| Details | details | Yes | Step 8 (Basic) / always available |
| description | description | Yes | Step 2 |
| job | job | Yes | Step 2 |

Not in codec (custom field territory): project codes, internal references, custom date fields, approval status, linked record IDs.

---

## 12. Pared-Down Mobile Version

After the full field set is designed, a second pass reduces each step to KaiOS-optimal density:

| Full step | Mobile simplification |
|---|---|
| Step 0 Type | Unchanged — already a compact list |
| Step 1 Template identity | Name + Activity only (description and color moved to "More" sub-menu) |
| Step 2 Record identity | Title field + Tag only (all time fields collapsed to "Schedule" sub-step, only shown if user expands) |
| Step 3 Parties | Customer name + phone only on main screen; "Add participant +" as a single button that opens participant editor |
| Step 4 Contact details | Location only on main screen; URL and attachment behind "More" toggle |
| Step 5 Financial | Currency + VAT only; expiry/service_ref behind "Advanced" toggle |
| Step 6 Lines | Max 3 seed lines visible; scroll for more; tap + to add |
| Step 7 Routing | Two toggles only, no explanation text |
| Step 8 Content | Story text area only; Details behind "More" |
| Step 9 Custom fields | Name + type + default only; position and required collapsed |
| Step 10 Synonyms | Show only the 5 most frequently renamed fields; "Show all" to expand |
| Step 11 Visibility | Shown as two compact toggle lists with "select all" shortcut |
| Step 12 Review | 3-line summary: type / fields set / synonyms overridden |

The mobile build uses the same step pipeline but each step descriptor carries a `mobileFields` array that is used instead of `fields` when the screen width is below 260px (KaiOS breakpoint).

---

## 13. Design Decisions — Resolved

### 13.1 Synonym Scope
Synonyms exist at two levels:

**Global synonyms** — set in Management → Settings → "Field labels". Apply to every record and every template that doesn't override them. Stored under `wp_global_synonyms` in localStorage as `{ customer: 'Client', worker: 'Contractor', ... }`. If a user always calls their counterparty "Client", they set it once here and never see "Customer" again anywhere in the app.

**Per-template overrides** — the template's own `fieldSynonyms` map. If a field is set here it takes precedence over the global synonym. If a template synonym is blank, fall through to global. If global is also blank, use the canonical codec label.

Resolution chain: `template.fieldSynonyms[key]` → `globalSynonyms[key]` → canonical label.

The `synLabel(key, canonical)` helper implements this chain. It is the single point of label resolution used everywhere in the wizard and view screens.

---

### 13.2 Codec Extension for Custom Fields
Custom (`cf_` prefixed) fields are NOT transmitted by the current codec — this is known and accepted. A future codec version adding a variable-length custom-fields block is noted as a planned extension. Custom fields are therefore local-only: they live in the record store, appear in the wizard, and render in view, but are stripped at share time. Records shared via codec URL carry only the standard codec fields. This is by design for v1 — the codec is a compact wire format, not a general schema.

When the extension is built, the custom fields block will be opt-in per template (a flag: `encodeCustomFields: true`) so templates whose custom fields are internal-only remain private.

---

### 13.3 Template Versioning
Two mechanisms, both implemented:

**Snapshot at creation** — when a record is created from a template, a snapshot of the template's `fieldSynonyms`, `hiddenFields`, `requiredFields`, and `customFields` is serialised and stored directly on the record under `_templateSnapshot`. This means the wizard and view always use the state of the template at the moment the record was made, regardless of subsequent template edits.

**Variant identifier** — the template's `id` remains stable (`rtpl_xxx`). Each edit increments a `version` integer on the template object. The `_templateId` stored on the record is `rtpl_xxx:v3`, encoding which variant was applied. This allows a future "compare to current template version" feature without requiring a full snapshot diff. For now the variant suffix is informational only.

---

### 13.4 Participant Mini-Wizard
Participants are a first-class sub-object within the template creator, not a flat field row. The Parties step contains a participant list section that functions as a self-contained mini-wizard within the step:

**Participant list view (within Parties step):**
- Scrollable list of already-added seed participants, each showing name + role badge
- "Add participant" row at the bottom, press Enter to enter edit mode
- D-pad up/down moves between participants; Enter opens edit mode; Delete/Backspace on a row removes it

**Participant edit mode (overlays the Parties step):**
A single-field-per-screen sub-sequence within the Parties step. Steps:
1. Name (text)
2. Role — choose from codebook (0=Witness, 1=Guarantor, 2=Signatory, 3=Observer, 4=Approver… up to 15) or "Custom" which unlocks role text
3. Role text (only shown if role=Custom)
4. Phone (tel)
5. Email (text)
6. Trading name (text, "company name if org")
7. Is organisation (boolean toggle)
8. Confirm → returns to participant list

Backspace at any sub-step goes back one sub-step. Backspace at step 1 of edit mode discards and returns to list. Enter on "Confirm" saves the participant and returns to list.

Seed participants in a template serve as placeholders. A name of `"[Customer]"` signals to the wizard that this slot should be highlighted for the user to fill in. Fixed participants (e.g. a permanent CC: partner) have their name pre-filled and appear locked (not editable) in the wizard — controlled by a `locked: true` flag on the participant object.

---

### 13.5 Compound Lines Mini-Wizard
Line items follow the same pattern as participants: a list within the Lines step with an add/edit sub-sequence.

**Line list view (within Lines step):**
- Each row shows: label (truncated) · qty × rate · type badge
- "Add line" at bottom
- D-pad to navigate, Enter to edit, Delete to remove

**Line edit mode (overlays the Lines step):**
1. Label (text, e.g. "Consultation fee")
2. Line type — Standard / Discount / Tax / Header
3. Quantity (number, can be left blank for template)
4. Rate (number, can be left blank for template)
5. Tax mode — None / Inclusive / Exclusive / Compound
6. Confirm

Record-level line settings (hasTotalSummary, hasSubtotals, qty_unit) are shown at the top of the Lines step as three quick toggles before the line list.

Blank qty/rate in a seed line means the wizard will prompt the user to fill that value in — a partial template line that scaffolds structure without locking the price.

---

### 13.6 Hidden Field Behaviour
"Hidden" does not mean hidden from the wizard user. It means hidden from the **record recipient**. This distinction drives the full semantics:

**Two visibility modes per field, settable in the template:**

| Mode | Wizard (creator) | View (creator's own view) | Shared / Received view |
|---|---|---|---|
| `visible` (default) | Shown, editable | Shown | Shown |
| `internal` | Shown, editable | Shown with "internal" marker | **Not shown** — excluded from share |
| `locked` | Shown, **not editable** | Shown | Shown (value fixed) |
| `locked-internal` | Shown, not editable | Shown with "internal" marker | **Not shown** — excluded from share |
| `hidden` | **Not shown** at all | Not shown | Not shown — excluded from share |

"Internal" fields are pre-filled, the creator can see and use them for workflow, but they are stripped from the codec URL at share time and do not appear in view.js for a received record. This is the main use case: tracking internal cost (`worker_amount`), internal reference codes, approval status, private notes.

"Locked" fields are pre-filled and visible in the wizard but greyed out — the user cannot change them. Useful for templates that enforce a fixed tax rate or a mandatory service reference.

"Hidden" is for fields that are set by the template and never shown to anyone — they silently shape routing and classification without appearing in any UI.

The field descriptor gains a `visibility` property: `'visible' | 'internal' | 'locked' | 'locked-internal' | 'hidden'`.

The share screen's `encodeWithTag()` reads the applied template snapshot and strips `internal`, `locked-internal`, and `hidden` fields from the codec payload before encoding.

---

### 13.7 Required Fields & Share Gate
Templates can mark fields as required. The enforcement is split:

**Saving the template itself**: Always allowed even if required fields have no default value. A template is a skeleton, not a complete record.

**Saving the record (wizard "Done")**: Required fields that are still blank produce a warning banner listing them, but do NOT block saving. The record is saved in an incomplete state.

**Generating a share link**: The share screen checks required fields against the current record. If any required field is blank, the "Share" action is replaced with a "⚠ Incomplete" indicator that lists the missing fields. The user cannot generate a codec URL until all required fields are filled. They can still go back to the wizard and fill them.

This means a template can enforce a workflow gate — "you may not send this invoice until you've set a due date and a service reference" — without preventing the record from existing in draft.

---

### 13.8 Core Design Philosophy — Custom Fields as Primary Canvas
The template creator does **not** present itself as "configure a standard record type". It presents itself as **"design a form"**, with standard codec field groups available as insertable building blocks.

The creator UI has two mental modes:

**Canvas mode (primary)**
The user is building a sequence of questions/fields that will appear when this template is used. Custom fields are first-class: add a field, give it a label, pick a type, set a default. This feels like building a questionnaire or a small business form.

**Insert block (secondary)**
At any point in the canvas, the user can press a designated key (e.g. `*`) to open a "Insert standard block" menu. Blocks are pre-defined groups of codec fields at different granularities:

| Block name | Fields included | Size |
|---|---|---|
| Identity (small) | job, date, tag | 3 fields |
| Identity (full) | job, description, date, due_date, tag, context_label | 6 fields |
| Parties (compact) | customer, customer_phone | 2 fields |
| Parties (full) | customer, customer_phone, worker, worker_amount | 4 fields |
| Participants | Participant mini-list (seed rows) | 1 block |
| Schedule | meeting_time, start_time, end_time | 3 fields |
| Location | location, url, attachment | 3 fields |
| Financial (basic) | currency, vat | 2 fields |
| Financial (full) | currency, vat, custom_tax_rate, service_ref, expiry_date, due_date | 6 fields |
| Line items | Compound lines mini-list + hasTotalSummary + hasSubtotals | 1 block |
| Content | story, details | 2 fields |
| Routing | ackRequest, restrictForward | 2 fields |

Inserting a block drops its fields at the current canvas position. Fields from blocks are identical in behaviour to manually added fields — they carry their canonical label (overridable by synonym), codec key, and visibility mode. The user can reorder, remove, or rename them after insertion.

This model means a "Job" template is not automatically loaded with all Job fields. The user starts from either a blank canvas or a type-specific starter preset, and builds deliberately. The result is templates that match actual workflows rather than a generic field dump.

**Starter presets** — when a type is chosen at step 0, the creator offers:
- "Start blank" — empty canvas
- "Start from [Type] preset" — pre-loads the standard block set for that type, replicating the current wizard behaviour as a starting point to edit from

---

## 14. Template Snapshot Schema (Complete)

```javascript
// Stored on the template object in RecordTemplateService
{
  // Metadata (not pre-filled into records)
  id:           'rtpl_abc123:v2',
  version:      2,
  name:         'Consulting Job',
  description:  'Standard consulting engagement template',
  iconColor:    '#4a9eff',
  createdAt:    1716000000000,
  updatedAt:    1716100000000,

  // Codec wire fields (pre-filled into record on apply)
  record_type:  '',
  record_class: 'job',
  activityId:   'act_xyz',
  customer:     '',            // blank = user fills in wizard
  currency:     'GBP',
  vat:          'standard',
  service_ref:  '',
  due_date:     '',
  worker:       'Jane Smith',  // fixed value
  worker_amount: '',
  hasTotalSummary: true,
  hasSubtotals:    false,
  compound_lines: [
    { label: 'Consultation', qty: '', rate: '', lineType: 0, taxMode: 1 },
    { label: 'Travel',       qty: 1,  rate: 50, lineType: 0, taxMode: 0 },
  ],
  participants: [
    { name: '[Client contact]', roleType: 3, locked: false },
    { name: 'Admin',            roleType: 4, locked: true  },
  ],

  // Routing defaults
  routingDefaults: { ackRequest: true, restrictForward: false },

  // Synonym overrides (layered over global synonyms)
  fieldSynonyms: {
    job:         'Project',
    customer:    'Client',
    worker:      'Consultant',
    service_ref: 'PO number',
    due_date:    'Deadline',
  },

  // Visibility overrides per field
  fieldVisibility: {
    worker_amount: 'internal',    // creator sees it, receiver does not
    service_ref:   'locked',      // shown in wizard but not editable
    worker:        'locked',      // pre-filled fixed worker, not editable
  },

  // Required field gate (blocks share link until filled)
  requiredFields: ['customer', 'due_date', 'service_ref'],

  // Custom fields (local only, not codec-encoded)
  customFields: [
    {
      key:          'cf_po_number',
      label:        'Purchase order',
      type:         'text',
      defaultValue: '',
      required:     true,
      placeholder:  'e.g. PO-2026-001',
      position:     'after_financial',
      visibility:   'internal',
    },
    {
      key:          'cf_approved_by',
      label:        'Approved by',
      type:         'text',
      defaultValue: '',
      required:     false,
      placeholder:  'Manager name',
      position:     'before_review',
      visibility:   'internal',
    },
  ],

  // Canvas field order (ordered list of field keys as they appear in the wizard)
  // Includes both codec keys and cf_ keys. Controls rendering order.
  fieldOrder: [
    'job', 'date', 'tag',
    'customer', 'customer_phone',
    'participants',
    'currency', 'vat', 'service_ref', 'due_date',
    'cf_po_number',
    'compound_lines',
    'worker', 'worker_amount',
    'cf_approved_by',
    'story',
    'routingDefaults',
  ],
}
```

The `fieldOrder` array is the canonical rendering sequence. Any field not in `fieldOrder` is appended at the end in canonical order. This gives the user full control over where custom fields appear relative to codec fields.

---

## 15. Global Synonyms Schema

Stored in localStorage under `wp_global_synonyms`:

```javascript
{
  job:            'Project',
  customer:       'Client',
  customer_phone: 'Client phone',
  worker:         '',            // empty = use canonical
  due_date:       'Deadline',
  tag:            'Category',
  story:          'Notes',
}
```

Editable in Management → Settings → "Field labels" section, using the same two-column list as the per-template synonym editor. The global editor shows all synonym-able fields. Per-template editor shows only the fields present in that template's `fieldOrder`.

---

## 16. Share Gate — Internal Field Stripping

At share time, `encodeWithTag()` receives the record plus its `_templateSnapshot`. Before encoding:

1. Load `_templateSnapshot.fieldVisibility`
2. For each field with visibility `'internal'`, `'locked-internal'`, or `'hidden'`: remove that field's value from the payload passed to `WPCodec.encode()`
3. For `customFields` with `visibility: 'internal'` or `'hidden'`: do not include them (they are already not encoded, but make explicit)
4. The codec URL is generated from the stripped payload only
5. The creator's own local record object retains all field values — stripping is payload-only, never mutates the stored record

The received record on the other end has no trace of the internal fields. view.js for a received record only renders fields that are present in the decoded payload.
