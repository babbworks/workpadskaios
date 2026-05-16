// NewEntTemplate — Business creation template class (ported from v2-newent)
// Full-depth framework system, ent intelligence, coaching, and plan configuration.
// Integrates with TemplateRegistry as schema 'B' (multi-slot) template.
// Exposes: window.NewEntTemplate

(function(global) {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  var TEMPLATE_URI = 'urn:workpads:tpl:newent:business:v1';

  // ── Industry Frameworks (determines plan structure) ────────────────────────

  var INDUSTRY_FRAMEWORKS = [
    { value: 'generic',               label: 'Generic Startup',       desc: 'Neutral baseline — exec summary, problem, solution, market' },
    { value: 'saas',                  label: 'SaaS',                  desc: 'Recurring revenue, unit economics, product-led growth' },
    { value: 'consumer-product',      label: 'Consumer Product',      desc: 'DTC/retail, SKU economics, channel mix, supply chain' },
    { value: 'professional-services', label: 'Professional Services', desc: 'Utilisation, retainer/project pricing, delivery model' },
    { value: 'manufacturing',         label: 'Manufacturing',         desc: 'BOM, CapEx, supply chain, quality/compliance' },
    { value: 'nonprofit',             label: 'Nonprofit',             desc: 'Mission-driven, grants/donations, impact metrics' },
  ];

  // ── Audience Frameworks (determines tone and packaging) ────────────────────

  var AUDIENCE_FRAMEWORKS = [
    { value: '',                 label: '— None —',            desc: 'No audience overlay' },
    { value: 'investor-seed',   label: 'Seed Investor',       desc: 'Traction-forward, concise, use-of-funds' },
    { value: 'investor-growth', label: 'Growth Investor',     desc: 'Three-statement financials, cohort analysis' },
    { value: 'hbs-plan',        label: 'HBS Full Plan',       desc: 'Academic-style, 20-50 pages, full appendix' },
    { value: 'bank-loan',       label: 'Bank Loan',           desc: 'Downside analysis, debt service, collateral' },
    { value: 'internal-ops',    label: 'Internal Operations', desc: 'Team-facing, execution milestones' },
    { value: 'grant-application', label: 'Grant Application', desc: 'Mission, impact metrics, budget justification' },
  ];

  // ── Plan configuration options ─────────────────────────────────────────────

  var STAGES = [
    { value: 'idea',        label: 'Idea' },
    { value: 'pre-seed',    label: 'Pre-Seed' },
    { value: 'seed',        label: 'Seed' },
    { value: 'series-a',    label: 'Series A' },
    { value: 'growth',      label: 'Growth' },
    { value: 'established', label: 'Established' },
  ];

  var PLAN_TYPES = [
    { value: 'startup',    label: 'Startup' },
    { value: 'operations', label: 'Operations' },
    { value: 'custom',     label: 'Custom' },
  ];

  var PLAN_STATUSES = [
    { value: 'early',    label: 'Early' },
    { value: 'active',   label: 'Active' },
    { value: 'rough',    label: 'Rough' },
    { value: 'archived', label: 'Archived' },
  ];

  // ── Coaching configuration (options referenced in WIZARD_SCREENS Coach tab) ─

  var COACH_VOICES = [
    { value: 'quiet',   label: 'Quiet',   desc: 'Heading title only' },
    { value: 'partial', label: 'Partial', desc: 'Title + hint' },
    { value: 'full',    label: 'Full',    desc: 'Title + hint + context' },
  ];

  var COACH_INTENTS = [
    { value: 'orient',   label: 'Orient',   desc: 'Understand the landscape' },
    { value: 'discover', label: 'Discover', desc: 'Find insights and gaps' },
    { value: 'decide',   label: 'Decide',   desc: 'Make key decisions' },
    { value: 'plan',     label: 'Plan',     desc: 'Structure the approach' },
    { value: 'narrate',  label: 'Narrate',  desc: 'Write the story' },
    { value: 'prove',    label: 'Prove',    desc: 'Build evidence' },
    { value: 'capital',  label: 'Capital',  desc: 'Prepare for funding' },
    { value: 'expand',   label: 'Expand',   desc: 'Grow and scale' },
    { value: 'review',   label: 'Review',   desc: 'Assess and refine' },
  ];

  // ── Ent Intelligence Fields (grouped) ──────────────────────────────────────

  var ENT_GROUPS = {
    overview: [
      { id: 'purpose',  label: 'Purpose',       prompt: 'Why does this company exist?' },
      { id: 'value',    label: 'Value Prop',     prompt: 'What specific problem do you solve, for whom?' },
      { id: 'customer', label: 'Customer',       prompt: 'Who is the most important person to serve right now?' },
      { id: 'diff',     label: 'Differentiation', prompt: 'What makes you genuinely different from every alternative?' },
      { id: 'revenue',  label: 'Revenue',        prompt: 'How does money flow in?' },
      { id: 'star',     label: 'North Star',     prompt: 'What is the one number that predicts success?' },
      { id: 'focus',    label: 'Focus',          prompt: 'What is the single most important thing right now?' },
      { id: 'commit',   label: 'Commitments',    prompt: 'What decisions are no longer up for debate?' },
      { id: 'model',    label: 'Model',          prompt: 'Describe the business model in plain language.' },
      { id: 'thesis',   label: 'Thesis',         prompt: 'What is the investment thesis in one paragraph?' },
      { id: 'pitch',    label: 'Pitch',          prompt: 'What is the one-sentence pitch that always lands?' },
      { id: 'promise',  label: 'Promise',        prompt: 'What is the implicit promise to every customer?' },
    ],
    intel: [
      { id: 'edge',      label: 'Edge',          prompt: 'What do you have that a well-funded competitor doesn\'t?' },
      { id: 'timing',    label: 'Timing',        prompt: 'Why is now the right moment?' },
      { id: 'unfair',    label: 'Unfair Adv.',   prompt: 'What advantage isn\'t yet visible from outside?' },
      { id: 'risks',     label: 'Risks',         prompt: 'What are the honest risks you don\'t surface publicly?' },
      { id: 'moat',      label: 'Moat',          prompt: 'What makes this defensible over time?' },
      { id: 'anchor',    label: 'Anchor',        prompt: 'What single assumption does the entire plan depend on?' },
      { id: 'scenario',  label: 'Scenarios',     prompt: 'Base case, best case, worst case in a sentence each.' },
      { id: 'exit',      label: 'Exit',          prompt: 'Where does this end up if everything works?' },
    ],
    landscape: [
      { id: 'rival',      label: 'Rival',        prompt: 'Who is the one competitor you watch most closely?' },
      { id: 'threat',     label: 'Threat',       prompt: 'What non-obvious player could make you irrelevant?' },
      { id: 'market',     label: 'Market',       prompt: 'How do you define and bound your market?' },
      { id: 'window',     label: 'Window',       prompt: 'How long before this opportunity closes?' },
      { id: 'myth',       label: 'Myth',         prompt: 'What widely held belief about this market is wrong?' },
      { id: 'category',   label: 'Category',     prompt: 'New category or competing in existing one?' },
      { id: 'niche',      label: 'Niche',        prompt: 'What specific niche are you owning first?' },
      { id: 'trend',      label: 'Trends',       prompt: 'What macro trends are working in your favour?' },
    ],
    demand: [
      { id: 'pain',    label: 'Pain',         prompt: 'Describe the specific frustration your customer lives with.' },
      { id: 'channel', label: 'Channel',      prompt: 'How do you reach the people who need this?' },
      { id: 'wedge',   label: 'Wedge',        prompt: 'What gets the customer in the door for the first time?' },
      { id: 'switch',  label: 'Switch Cost',  prompt: 'What does it take to get someone to leave their current solution?' },
      { id: 'retain',  label: 'Retention',    prompt: 'What keeps customers engaged over time?' },
      { id: 'cac',     label: 'CAC',          prompt: 'What is your customer acquisition cost?' },
      { id: 'ltv',     label: 'LTV',          prompt: 'What is your lifetime value?' },
      { id: 'core',    label: 'Core Job',     prompt: 'What must your product do perfectly above all else?' },
    ],
    ops: [
      { id: 'constraint', label: 'Constraint',  prompt: 'What is the binding constraint right now?' },
      { id: 'unit',       label: 'Unit Econ',   prompt: 'What are your unit economics in plain language?' },
      { id: 'runway',     label: 'Runway',      prompt: 'How much time and runway do you have?' },
      { id: 'margin',     label: 'Margin',      prompt: 'Where does the real margin live in your model?' },
      { id: 'tech',       label: 'Tech',        prompt: 'What are your key technology decisions?' },
      { id: 'data',       label: 'Data',        prompt: 'What data are you accumulating and its strategic value?' },
      { id: 'depend',     label: 'Dependencies', prompt: 'What key vendors or partners does the business depend on?' },
      { id: 'network',    label: 'Network Fx',  prompt: 'What network effects exist or could exist?' },
    ],
    self: [
      { id: 'founder',   label: 'Founder Fit',  prompt: 'Why are you specifically the person building this?' },
      { id: 'proof',     label: 'Proof',        prompt: 'What is your strongest validation right now?' },
      { id: 'story',     label: 'Origin',       prompt: 'What is the founding insight in one sentence?' },
      { id: 'blocker',   label: 'Blocker',      prompt: 'What is most likely to kill this?' },
      { id: 'horizon',   label: 'Horizon',      prompt: 'What does this look like in 3-5 years?' },
      { id: 'ask',       label: 'The Ask',      prompt: 'What do you need most right now that you don\'t have?' },
    ],
  };

  // ── Framework section definitions (what each industry framework contains) ──

  var FRAMEWORK_SECTIONS = {
    'generic': [
      { slug: 'executive-summary', title: 'Executive Summary' },
      { slug: 'problem',           title: 'Problem' },
      { slug: 'solution',          title: 'Solution' },
    ],
    'saas': [
      { slug: 'executive-summary', title: 'Executive Summary' },
      { slug: 'problem',           title: 'Problem' },
      { slug: 'solution',          title: 'Product' },
      { slug: 'market',            title: 'Market' },
      { slug: 'business-model',    title: 'Business Model' },
      { slug: 'go-to-market',      title: 'Go-to-Market' },
      { slug: 'competition',       title: 'Competition' },
      { slug: 'team',              title: 'Team' },
      { slug: 'financials',        title: 'Financials' },
      { slug: 'risk',              title: 'Risk' },
    ],
    'consumer-product': [
      { slug: 'executive-summary', title: 'Executive Summary' },
      { slug: 'consumer-problem',  title: 'Consumer Problem' },
      { slug: 'product',           title: 'Product & SKU Strategy' },
      { slug: 'market',            title: 'Market & Segments' },
      { slug: 'channels',          title: 'Channel Mix' },
      { slug: 'operations',        title: 'Supply & Operations' },
      { slug: 'business-model',    title: 'Unit Economics' },
      { slug: 'team',              title: 'Team' },
      { slug: 'financials',        title: 'Financial Plan' },
      { slug: 'risk',              title: 'Risk' },
    ],
    'professional-services': [
      { slug: 'executive-summary', title: 'Executive Summary' },
      { slug: 'client-problem',    title: 'Client Problem' },
      { slug: 'service-offering',  title: 'Service Offering' },
      { slug: 'market',            title: 'Target Market' },
      { slug: 'delivery-model',    title: 'Delivery Model' },
      { slug: 'pricing',           title: 'Pricing & Retainer' },
      { slug: 'operations',        title: 'Operations' },
      { slug: 'team',              title: 'Team & Staffing' },
      { slug: 'financials',        title: 'Financial Plan' },
      { slug: 'risk',              title: 'Risk' },
    ],
    'manufacturing': [
      { slug: 'executive-summary',  title: 'Executive Summary' },
      { slug: 'problem',            title: 'Problem' },
      { slug: 'product',            title: 'Product Definition' },
      { slug: 'production',         title: 'Production Model' },
      { slug: 'supply-chain',       title: 'Supply Chain' },
      { slug: 'quality-compliance', title: 'Quality & Compliance' },
      { slug: 'market',             title: 'Market & Channels' },
      { slug: 'team',               title: 'Team' },
      { slug: 'financials',         title: 'Financial Plan' },
      { slug: 'risk',               title: 'Risk' },
    ],
    'nonprofit': [
      { slug: 'executive-summary', title: 'Executive Summary' },
      { slug: 'mission-problem',   title: 'Mission & Problem' },
      { slug: 'programs',          title: 'Program Strategy' },
      { slug: 'beneficiaries',     title: 'Beneficiaries & Community' },
      { slug: 'impact',            title: 'Impact Model' },
      { slug: 'operations',        title: 'Operations' },
      { slug: 'team',              title: 'Team' },
      { slug: 'financials',        title: 'Financial Plan' },
      { slug: 'risk',              title: 'Risk' },
    ],
  };

  // ── Business name validation ───────────────────────────────────────────────

  var SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/;

  var RESERVED_WORDS = [
    'doctor', 'coach', 'warmup', 'warmups', 'develop', 'document', 'export',
    'status', 'migrate', 'update', 'browser', 'notes', 'finance', 'config',
    'init', 'help', 'version', 'spaces', 'cloud', 'name', 'new', 'ent',
    'list', 'plan', 'framework', 'archive',
  ];

  // ── Storage ────────────────────────────────────────────────────────────────

  var STORE_KEY = 'wp_newent_businesses';

  function loadBusinesses() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function saveBusinesses(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  // ── Slug generation ────────────────────────────────────────────────────────

  function toSlug(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  function isValidSlug(slug) {
    if (!slug || slug.length < 2 || slug.length > 60) return false;
    if (!SLUG_REGEX.test(slug)) return false;
    var normalised = slug.replace(/-/g, '').toLowerCase();
    for (var i = 0; i < RESERVED_WORDS.length; i++) {
      if (normalised === RESERVED_WORDS[i]) return false;
    }
    return true;
  }

  function isSlugUnique(slug) {
    var businesses = loadBusinesses();
    for (var i = 0; i < businesses.length; i++) {
      if (businesses[i].slug === slug) return false;
    }
    return true;
  }

  // ── Business CRUD ──────────────────────────────────────────────────────────

  function createBusiness(fields) {
    var slug = fields.slug || toSlug(fields.name || '');
    if (!isValidSlug(slug)) {
      return { ok: false, error: 'invalid-slug', detail: 'Business name must be 2-60 chars, lowercase alphanumeric and hyphens.' };
    }
    if (!isSlugUnique(slug)) {
      return { ok: false, error: 'slug-exists', detail: 'A business with slug "' + slug + '" already exists.' };
    }

    var now = nowIso();
    var business = {
      id:             genId(),
      slug:           slug,
      name:           fields.name || slug.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }),
      industry_hint:  fields.industry_hint || null,
      stage:          fields.stage || 'idea',
      website:        fields.website || null,
      created_at:     now,
      updated_at:     now,
      // Contact
      contact: {
        name:  fields.contact_name || null,
        email: fields.contact_email || null,
        phone: fields.contact_phone || null,
        role:  fields.contact_role || null,
      },
      // Location
      location: {
        city:     fields.location_city || null,
        region:   fields.location_region || null,
        country:  fields.location_country || null,
        timezone: fields.location_timezone || null,
      },
      // Profile (long-form narrative)
      profile: {
        founding_story: fields.founding_story || null,
        vision:         fields.vision || null,
        mission:        fields.mission || null,
      },
      // Plan configuration
      plan: {
        title:              fields.plan_title || 'Startup Plan',
        type:               fields.plan_type || 'startup',
        status:             fields.plan_status || 'early',
        stage:              fields.stage || 'idea',
        target_audience:    fields.target_audience || null,
        industry_framework: fields.industry_framework || 'generic',
        audience_framework: fields.audience_framework || '',
        coach_voice:        fields.coach_voice || 'partial',
        coach_intent:       fields.coach_intent || 'orient',
      },
      // Ent intelligence fields
      ent: {
        purpose:  fields.ent_purpose || null,
        value:    fields.ent_value || null,
        customer: fields.ent_customer || null,
        diff:     fields.ent_diff || null,
        revenue:  fields.ent_revenue || null,
        star:     fields.ent_star || null,
        focus:    fields.ent_focus || null,
        edge:     fields.ent_edge || null,
        timing:   fields.ent_timing || null,
        moat:     fields.ent_moat || null,
        pain:     fields.ent_pain || null,
        channel:  fields.ent_channel || null,
        founder:  fields.ent_founder || null,
        proof:    fields.ent_proof || null,
        story:    fields.ent_story || null,
        blocker:  fields.ent_blocker || null,
      },
      // Assumptions tracking
      assumptions: [],
      // Decisions log
      decisions: [],
      // Framework sections (scaffolded from industry framework)
      sections: FRAMEWORK_SECTIONS[fields.industry_framework || 'generic'] || FRAMEWORK_SECTIONS['generic'],
    };

    var businesses = loadBusinesses();
    businesses.push(business);
    saveBusinesses(businesses);

    return { ok: true, business: business };
  }

  function listBusinesses() {
    return loadBusinesses();
  }

  function getBusiness(slug) {
    var businesses = loadBusinesses();
    for (var i = 0; i < businesses.length; i++) {
      if (businesses[i].slug === slug) return businesses[i];
    }
    return null;
  }

  function updateBusiness(slug, fields) {
    var businesses = loadBusinesses();
    for (var i = 0; i < businesses.length; i++) {
      if (businesses[i].slug === slug) {
        var biz = businesses[i];
        if (fields.name !== undefined)          biz.name = fields.name;
        if (fields.industry_hint !== undefined) biz.industry_hint = fields.industry_hint;
        if (fields.stage !== undefined)         biz.stage = fields.stage;
        if (fields.website !== undefined)       biz.website = fields.website;
        if (fields.contact)   merge(biz.contact, fields.contact);
        if (fields.location)  merge(biz.location, fields.location);
        if (fields.profile)   merge(biz.profile, fields.profile);
        if (fields.plan)      merge(biz.plan, fields.plan);
        if (fields.ent)       merge(biz.ent, fields.ent);
        biz.updated_at = nowIso();
        // Re-scaffold sections if framework changed
        if (fields.plan && fields.plan.industry_framework) {
          biz.sections = FRAMEWORK_SECTIONS[fields.plan.industry_framework] || FRAMEWORK_SECTIONS['generic'];
        }
        saveBusinesses(businesses);
        return { ok: true, business: biz };
      }
    }
    return { ok: false, error: 'not-found' };
  }

  function deleteBusiness(slug) {
    var businesses = loadBusinesses();
    var filtered = businesses.filter(function(b) { return b.slug !== slug; });
    if (filtered.length === businesses.length) return { ok: false, error: 'not-found' };
    saveBusinesses(filtered);
    return { ok: true };
  }

  // ── Ent field helpers ──────────────────────────────────────────────────────

  function setEntField(slug, fieldId, value) {
    var businesses = loadBusinesses();
    for (var i = 0; i < businesses.length; i++) {
      if (businesses[i].slug === slug) {
        if (!businesses[i].ent) businesses[i].ent = {};
        businesses[i].ent[fieldId] = value;
        businesses[i].updated_at = nowIso();
        saveBusinesses(businesses);
        return { ok: true };
      }
    }
    return { ok: false, error: 'not-found' };
  }

  function getEntField(slug, fieldId) {
    var biz = getBusiness(slug);
    return biz && biz.ent ? biz.ent[fieldId] || null : null;
  }

  // ── Template Registration ──────────────────────────────────────────────────

  var TEMPLATE_ENTRY = {
    uri:      TEMPLATE_URI,
    name:     'New Business',
    schema:   'B',
    type:     'newent',
    scope:    ['newent', 'business'],
    domain:   'enterprise',
    source:   null,
    version:  3,
    cached:   true,
    trust:    'built-in',
    origin:   null,
    addedAt:  0,
    usedAt:   0,
    platforms: ['kaios', 'mobile'],
    lineage:  { derivedFrom: null, supersedes: null, components: [] },
  };

  var TEMPLATE_PAYLOAD = {
    uri:    TEMPLATE_URI,
    schema: 'B',
    slots: {
      identity: '<div class="ne-slot ne-identity">' +
        '<div class="ne-field"><span class="ne-label">Name</span><span class="ne-val">{{name}}</span></div>' +
        '<div class="ne-field"><span class="ne-label">Slug</span><span class="ne-val">{{slug}}</span></div>' +
        '<div class="ne-field"><span class="ne-label">Stage</span><span class="ne-val">{{stage}}</span></div>' +
        '<div class="ne-field"><span class="ne-label">Industry</span><span class="ne-val">{{industry_hint}}</span></div>' +
        '{{#website}}<div class="ne-field"><span class="ne-label">Web</span><span class="ne-val">{{website}}</span></div>{{/website}}' +
        '</div>',
      plan: '<div class="ne-slot ne-plan">' +
        '<div class="ne-field"><span class="ne-label">Plan</span><span class="ne-val">{{plan.title}}</span></div>' +
        '<div class="ne-field"><span class="ne-label">Framework</span><span class="ne-val">{{plan.industry_framework}}</span></div>' +
        '{{#plan.audience_framework}}<div class="ne-field"><span class="ne-label">Audience</span><span class="ne-val">{{plan.audience_framework}}</span></div>{{/plan.audience_framework}}' +
        '<div class="ne-field"><span class="ne-label">Type</span><span class="ne-val">{{plan.type}}</span></div>' +
        '<div class="ne-field"><span class="ne-label">Status</span><span class="ne-val">{{plan.status}}</span></div>' +
        '</div>',
      ent: '<div class="ne-slot ne-ent">' +
        '{{#ent.purpose}}<div class="ne-field ne-narrative"><span class="ne-label">Purpose</span><div class="ne-val">{{ent.purpose}}</div></div>{{/ent.purpose}}' +
        '{{#ent.value}}<div class="ne-field ne-narrative"><span class="ne-label">Value</span><div class="ne-val">{{ent.value}}</div></div>{{/ent.value}}' +
        '{{#ent.diff}}<div class="ne-field ne-narrative"><span class="ne-label">Diff</span><div class="ne-val">{{ent.diff}}</div></div>{{/ent.diff}}' +
        '</div>',
      contact: '<div class="ne-slot ne-contact">' +
        '{{#contact.name}}<div class="ne-field"><span class="ne-label">Contact</span><span class="ne-val">{{contact.name}}</span></div>{{/contact.name}}' +
        '{{#contact.email}}<div class="ne-field"><span class="ne-label">Email</span><span class="ne-val">{{contact.email}}</span></div>{{/contact.email}}' +
        '{{#contact.phone}}<div class="ne-field"><span class="ne-label">Phone</span><span class="ne-val">{{contact.phone}}</span></div>{{/contact.phone}}' +
        '</div>',
    },
    css: '.ne-slot{padding:8px 12px;}' +
         '.ne-field{display:flex;align-items:baseline;padding:3px 0;border-bottom:1px solid #1e2a3a;}' +
         '.ne-label{font-size:9px;color:#5a7a9a;text-transform:uppercase;letter-spacing:0.4px;width:60px;flex-shrink:0;}' +
         '.ne-val{font-size:12px;color:#c8d8e8;flex:1;}' +
         '.ne-narrative .ne-val{font-size:11px;line-height:1.5;margin-top:2px;display:block;}' +
         '.ne-identity{border-bottom:1px solid #2a3a4a;}' +
         '.ne-plan{border-bottom:1px solid #2a3a4a;}' +
         '.ne-ent{border-bottom:1px solid #2a3a4a;}' +
         '.ne-contact{border-bottom:1px solid #2a3a4a;}',
  };

  function registerTemplate() {
    if (!global.TemplateRegistry) return;
    // Merge entry metadata with payload fields (slots, css) into one object.
    // ingest() expects a single object containing both; TEMPLATE_ENTRY and
    // TEMPLATE_PAYLOAD are kept separate only for readability in this file.
    var tplObj = {};
    var k;
    for (k in TEMPLATE_ENTRY)  { if (TEMPLATE_ENTRY.hasOwnProperty(k))  tplObj[k] = TEMPLATE_ENTRY[k]; }
    for (k in TEMPLATE_PAYLOAD){ if (TEMPLATE_PAYLOAD.hasOwnProperty(k)) tplObj[k] = TEMPLATE_PAYLOAD[k]; }
    global.TemplateRegistry.ingest(tplObj, 'built-in');
  }

  // ── Wizard screen definitions ──────────────────────────────────────────────
  // 7 screens: Identity / Contact / Location / Plan Config / Ent Core / Profile / Coaching

  var WIZARD_SCREENS = [
    { name: 'Identity', tab: 'I', fields: [
      { id: 'name',          label: 'Business Name *', type: 'text' },
      { id: 'slug',          label: 'Slug (auto)',     type: 'text', derived: true },
      { id: 'industry_hint', label: 'Industry',        type: 'text' },
      { id: 'stage',         label: 'Stage',           type: 'select', options: STAGES },
      { id: 'website',       label: 'Website',         type: 'url' },
    ]},
    { name: 'Contact', tab: 'C', fields: [
      { id: 'contact_name',  label: 'Contact Name',  type: 'text' },
      { id: 'contact_email', label: 'Email',         type: 'email' },
      { id: 'contact_phone', label: 'Phone',         type: 'tel' },
      { id: 'contact_role',  label: 'Role',          type: 'text' },
    ]},
    { name: 'Location', tab: 'L', fields: [
      { id: 'location_country',  label: 'Country',   type: 'text' },
      { id: 'location_city',     label: 'City',      type: 'text' },
      { id: 'location_region',   label: 'Region',    type: 'text' },
      { id: 'location_timezone', label: 'Timezone',  type: 'text' },
    ]},
    { name: 'Plan', tab: 'P', fields: [
      { id: 'plan_title',          label: 'Plan Title',          type: 'text' },
      { id: 'industry_framework',  label: 'Industry Framework',  type: 'select', options: INDUSTRY_FRAMEWORKS },
      { id: 'audience_framework',  label: 'Audience Framework',  type: 'select', options: AUDIENCE_FRAMEWORKS },
      { id: 'plan_type',           label: 'Plan Type',           type: 'select', options: PLAN_TYPES },
      { id: 'plan_status',         label: 'Status',              type: 'select', options: PLAN_STATUSES },
      { id: 'target_audience',     label: 'Target Audience',     type: 'text' },
    ]},
    { name: 'Ent', tab: 'E', fields: [
      { id: 'ent_purpose',  label: 'Purpose',        type: 'textarea', placeholder: 'Why does this company exist?' },
      { id: 'ent_value',    label: 'Value Prop',     type: 'textarea', placeholder: 'What problem do you solve, for whom?' },
      { id: 'ent_customer', label: 'Customer',       type: 'textarea', placeholder: 'Who is the most important person to serve?' },
      { id: 'ent_diff',     label: 'Differentiation', type: 'textarea', placeholder: 'What makes you genuinely different?' },
    ]},
    { name: 'Profile', tab: 'Pr', fields: [
      { id: 'vision',         label: 'Vision',         type: 'textarea' },
      { id: 'mission',        label: 'Mission',        type: 'textarea' },
      { id: 'founding_story', label: 'Founding Story', type: 'textarea' },
    ]},
    { name: 'Coach', tab: 'Co', fields: [
      { id: 'coach_voice',   label: 'Coach Voice',  type: 'select', options: COACH_VOICES },
      { id: 'coach_intent',  label: 'Coach Intent', type: 'select', options: COACH_INTENTS },
      { id: 'ent_edge',      label: 'Edge',         type: 'textarea', placeholder: 'What do you have that a well-funded competitor doesn\'t?' },
      { id: 'ent_moat',      label: 'Moat',         type: 'textarea', placeholder: 'What makes this defensible over time?' },
      { id: 'ent_proof',     label: 'Proof',        type: 'textarea', placeholder: 'What is your strongest validation right now?' },
      { id: 'ent_blocker',   label: 'Blocker',      type: 'textarea', placeholder: 'What is most likely to kill this?' },
    ]},
  ];

  // ── Public API ─────────────────────────────────────────────────────────────

  global.NewEntTemplate = {
    // Template metadata
    TEMPLATE_URI:         TEMPLATE_URI,
    TEMPLATE_ENTRY:       TEMPLATE_ENTRY,
    TEMPLATE_PAYLOAD:     TEMPLATE_PAYLOAD,
    WIZARD_SCREENS:       WIZARD_SCREENS,

    // Configuration options
    STAGES:               STAGES,
    PLAN_TYPES:           PLAN_TYPES,
    PLAN_STATUSES:        PLAN_STATUSES,
    INDUSTRY_FRAMEWORKS:  INDUSTRY_FRAMEWORKS,
    AUDIENCE_FRAMEWORKS:  AUDIENCE_FRAMEWORKS,
    COACH_VOICES:         COACH_VOICES,
    COACH_INTENTS:        COACH_INTENTS,
    ENT_GROUPS:           ENT_GROUPS,
    FRAMEWORK_SECTIONS:   FRAMEWORK_SECTIONS,
    RESERVED_WORDS:       RESERVED_WORDS,

    // Business CRUD
    create:          createBusiness,
    list:            listBusinesses,
    get:             getBusiness,
    update:          updateBusiness,
    delete:          deleteBusiness,

    // Ent intelligence
    setEntField:     setEntField,
    getEntField:     getEntField,

    // Validation
    toSlug:          toSlug,
    isValidSlug:     isValidSlug,
    isSlugUnique:    isSlugUnique,

    // Template registration
    register:        registerTemplate,
  };

  // Auto-register on load
  registerTemplate();

}(window));
