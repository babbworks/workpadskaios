# TRIG — Deep Design Document

**Purpose:** A thinking document. Not a spec — the spec lives in OQ-32. This is the place to contemplate the abstract and specific details of creating TRIG before implementation begins: what kind of machine this actually is, why each design choice was made, what the failure modes look like, what the implementation challenges are on KaiOS specifically, and what remains genuinely open.

**As of:** 2026-05-17  
**Spec reference:** OPEN-QUESTIONS.md § OQ-32  
**Status:** Pre-implementation contemplation — key decisions resolved (see Session Notes at end)

---

## Part 1 — The Abstract Problem

### What is TRIG actually solving?

A URL is public. Once a URL leaves your device it can be:
- Stored in WhatsApp servers
- Seen by link-preview bots (Telegram, iMessage, Slack all fetch previews)
- Indexed by search engines if it ever touches the web
- Screenshotted by a recipient and forwarded
- Scraped by data brokers that monitor SMS traffic

The standard answer to this is: encrypt the payload. And workpads does that — `1ps` and `1pt` tags encrypt the record content. But encryption doesn't solve the presentation problem. Even if the record is encrypted, you want the page that opens when someone taps the link to *behave differently for different audiences* — to be contextually aware of who is opening it.

The naive approach is: server-side logic. The URL hits a server, the server knows something about the requester (session cookie, phone number, login state), the server renders the right page. But workpads has a specific constraint: **the server must not know the record content, and ideally must not know the audience either.** The fragment (`#1pb/...`) is deliberately never sent to the server. The server serves one generic shell page. All intelligence is client-side.

So the problem becomes: **how do you give a generic client-side page conditional rendering intelligence without server involvement, without embedding full JavaScript in the URL (too long, exposable), and with the ability to survive being forwarded, scraped, or link-previewed?**

TRIG is the answer. A tiny bytecode program — 1 to 20 bytes — embedded in the payload, evaluated entirely client-side by the shell's JavaScript engine, after the page has loaded in a real browser. Bots and scrapers never run the JS. Link-preview fetchers never see the fragment. The programme executes only for a human in a browser with the app shell loaded, and its output is simply: *what to show, to whom, in which visual mode*.

---

### The three layers of the presentation stack

It helps to think of TRIG as one layer in a three-layer stack:

```
Layer 3 — Custom Logic          (OQ-26: inline JS / fetch-target JS)
Layer 2 — Conditional Display   (TRIG: conditions → display mode → CSS/JS load)
Layer 1 — Raw Record            (pads-v1 frame: data fields, financial block, etc.)
```

Layer 1 is always present. Layer 2 (TRIG) is optional — if absent, the shell defaults to SHOW_ALWAYS NATIVE, which means "render this record however is appropriate for its type." Layer 3 is only permitted on `1ps` and `1pt` tagged records, never on public `1pb` URLs.

TRIG sits at Layer 2. It does not manipulate data. It does not submit forms. It does not talk to servers. Its only job is to answer a single question before anything renders: **"Given the conditions present on this device, right now, what should this page show — and what CSS/JS module should it load to show it?"**

This separation is intentional. TRIG is the gatekeeper. Everything below (the record data) and everything above (the custom JS logic) only activates if TRIG says so.

---

### Why a bytecode language and not a JSON config?

The obvious simpler answer to conditional display is a small JSON object embedded in the payload:

```json
{ "show_if": "known_contact", "display_mode": "card", "theme": "dark" }
```

This would handle 80% of cases. Why go to the trouble of a stack machine?

**Reason 1 — Size.** A JSON fragment is 50–150 bytes before encoding. After base64url encoding it becomes 67–200 URL characters. TRIG handles 80% of cases in 1 byte. The most common program is a single pattern token. The most expressive general-purpose program is 5 bytes. For something that lives inside every URL you share, byte cost is a real concern — especially on slow networks and small screens.

**Reason 2 — Composability.** JSON configs with a single `show_if` condition can't express "show card if known contact AND has app, form if human but not known contact, blank otherwise." That's a compound conditional with two branches and three outcomes. You need either a deeply nested JSON schema (back to verbosity) or a tiny language that can compose conditions naturally. A stack machine handles this in 7–9 bytes.

**Reason 3 — Future extension.** A fixed-schema JSON config locks in the exact fields at version 1. A bytecode language can absorb new conditions, new display modes, new codebook entries, and new instructions via the EXTENDED opcode space and VER bits — without invalidating programs already written. Old shells reading unknown instructions degrade gracefully (BLANK). New shells reading v1 programs work identically forever.

**Reason 4 — Uniformity.** Pattern tokens are the compiled form of the most common bytecode programs. A single-byte pattern token IS a bytecode program — the shell expands it internally before evaluation. There is no second syntax to parse. One evaluator handles everything.

---

### The bot problem in detail

Understanding why TRIG's bot resistance works requires understanding how bots actually operate.

A link-preview bot (WhatsApp, Telegram, iMessage) works like this:
1. It receives a URL in a message before the human recipient even reads it
2. It makes an HTTP GET request to the URL
3. It reads the HTML `<title>`, `<meta description>`, `<og:image>` tags
4. It renders a preview card in the chat

What it does NOT do:
- Execute JavaScript
- Process URL fragments (the `#...` part is never sent in the HTTP request)
- Store cookies or session state
- Have a device that "has the app installed"

A simple web scraper operates similarly. Even a headless browser like Puppeteer in its default configuration does not:
- Run `requestAnimationFrame` at real-time intervals
- Generate `PointerEvent` or `TouchEvent` events from real hardware
- Have `IntersectionObserver` observe elements that are genuinely scrolled into view
- Produce realistic canvas fingerprint entropy

The TRIG evaluation model exploits this gap systematically:

1. **Fragment never sent to server** — the `#` character and everything after it is stripped by the browser before the HTTP request. The server never receives the TRIG bytes or the record data. Link-preview bots never see the payload.

2. **JS required for evaluation** — TRIG bytes are in the binary payload in the fragment. The shell's JavaScript unpacks the payload and evaluates the TRIG program. A bot that doesn't run JS never reaches TRIG evaluation — it renders whatever the generic shell page's HTML says (which should be a generic empty page).

3. **BLOOM instruction** — for cases where a bot does run headless JS, the BLOOM filter checks capability signals that bots typically can't fake: real rAF timing consistency, hardware touch events, realistic canvas entropy. This is not foolproof against a determined attacker with a full real browser instance, but it handles all commodity bots.

4. **Condition evaluation is local** — conditions like KNOWN_CONTACT, HAS_APP, CODE_VERIFIED are answered by the app shell using local device state. A bot has no app installed, no contacts database, no verified codes. These conditions all return false for a bot.

The net result: a bot opens the URL and sees a blank page (or the generic shell HTML). A human with the app sees the card, form, or menu — depending on what the TRIG program specifies.

---

## Part 2 — The Machine Model

### Why a stack machine?

TRIG is a **stack machine** — a type of virtual machine where operations consume their inputs from and push their outputs to an implicit stack. There are no named registers or variables. The program is a sequence of instructions that manipulate this stack.

This is not an arbitrary choice. Stack machines are:
- **Compact to encode** — operations don't need to specify register names or memory addresses. An instruction is just an opcode and sometimes a small immediate. This is why Forth, PostScript, and the Java Virtual Machine all use stack machines.
- **Simple to evaluate** — the evaluator is a linear scan through instruction bytes with a tiny array as the stack. No AST, no variable scope, no closures. You could implement the TRIG evaluator in under 100 lines of JavaScript.
- **Easy to reason about** — at any point in the program, the stack depth is known statically. A condition being evaluated means a bool is on top. A SHOW consumes that bool. Malformed programs are caught at evaluation time (stack underflow).

The TRIG stack is deliberately shallow — maximum 8 deep. This matches the constraint of the language: you are composing boolean conditions, not computing values. The deepest program you're likely to write pushes 3 conditions, ANDs them, then calls SHOW. That's a max stack depth of 3.

### Evaluation model

```
input:   TRIG byte stream
output:  (display_mode, css_ids[], theme_id, js_id | BLANK)
state:   stack[] of booleans, side-effect registers (css, theme, js)
```

The evaluator:
1. Reads bytes left to right
2. For each byte: extracts OP (high nibble) and ARG (low nibble)
3. If ARG = 15: reads next byte as extended ARG
4. Executes the operation
5. Terminates when the byte stream ends or a SHOW/SHOW_ALWAYS is reached

The evaluator does NOT loop. There are no jump-backward instructions. TRIG programs are always finite and always terminate. This is a critical security property — no infinite loops, no denial-of-service via TRIG.

The only forward-jump instruction is JZ (skip N bytes if top of stack is false). This allows if/else branching but not looping.

### Pattern tokens as macros

When the evaluator sees a byte with high nibble `0x0` (the PATTERN opcode), it looks up the pattern ID in a compile-time expansion table and inlines the equivalent instruction sequence before evaluating. This means:

- `0x01` (KNOWN_CONTACT_SHOW) expands to: `PUSH_COND(KNOWN_CONTACT) SHOW(CARD)`
- `0x04` (HUMAN_SHOW) expands to: `BLOOM(0xF000) SHOW(CARD)` — or alternatively `PUSH_COND(IS_HUMAN) SHOW(CARD)` depending on implementation choice

The pattern table is a fixed compile-time constant in the shell. Changing what a pattern token expands to would be a version change (new VER bits). v1 pattern expansions are locked.

This means pattern tokens are literally the most-compressed bytecode programs. `0x01` is a 1-byte program that evaluates identically to the 3-byte program `D1 30`. There is no loss of expressiveness — they are the same program, different encodings.

---

## Part 3 — Encoding Design

### The nibble split

The central encoding decision in TRIG is the nibble split: every instruction byte is `[OP:4][ARG:4]`. This gives 16 opcodes and inline immediates 0–14 (15 = extended).

Why not 8-bit opcodes with separate argument bytes? Three reasons:

1. **Most instructions have a small immediate.** SHOW needs a display mode (8 values). LOAD_CSS needs a codebook ID (max 15). PUSH_COND needs a condition ID (max 14 in v1). SET_THEME needs a theme ID. In all these cases the immediate fits in 4 bits — storing it inline saves a byte.

2. **The 4-bit immediate covers the common range.** For conditions: 12 defined, fits in 4 bits. For display modes: 7 defined, fits in 4 bits. For codebook IDs: 15 slots, fits in 4 bits. The 15 = "read next byte" escape covers anything larger.

3. **16 opcodes is enough.** Count the current opcodes in the v1 instruction set: 16 exactly (0x0–0xF). The EXTENDED opcode (0xF) can expand into a full 8-bit secondary space (256 additional opcodes) when needed. This gives v1 a natural ceiling and a clear extension path.

The tradeoff is that programs with many extended-range arguments become longer, but these are rare. The common case (pattern tokens, TERNARY, single-condition SHOW) stays extremely compact.

### ARG = 15: the extension escape

When the low nibble is `0xF` (= 15), the evaluator reads the next byte as the actual argument value. This byte can hold values 0–255, giving an extended range.

For condition IDs: v1 defines 12 conditions (0–11). Values 12–255 are available for future conditions via the extended ARG mechanism. A future PUSH_COND for a condition with ID 200 would encode as `0xDF 0xC8` — two bytes instead of one.

For codebook IDs: v1 defines 7 CSS modules (0–6). Values 7–255 are available for future modules. A CSS load for a v2 module with ID 100 would be `0x1F 0x64`.

This keeps the common case cheap (1 byte per instruction) while the uncommon case pays a 1-byte extension cost. Never pays 2 bytes of overhead — just 1.

### The TERNARY shortcut

The most common complex program in TRIG is: "show X to audience A, show Y to audience B." This is the fundamental two-audience problem.

Without TERNARY, you'd write it as a JZ ladder:

```
PUSH_COND(A)       // 1 byte
JZ(skip=3)         // 1 byte — skip next 3 if false
SHOW_ALWAYS(X)     // 1 byte
JZ(skip=1)         // wait, this doesn't work cleanly...
```

JZ ladders for two-branch programs require careful byte-counting of skip offsets. It's error-prone to write and hard to read.

TERNARY collapses this to 4 bytes:
```
0x90  cond_id  mode_true  mode_false
```

The evaluator sees `0x9_`, reads the next 3 bytes as operands, and executes: "evaluate condition `cond_id`; if true, render `mode_true`; if false, render `mode_false`." No stack manipulation, no offset arithmetic. The entire "show card to contacts, form to others" program is written in one instruction.

With the 1-byte header, the full 5-byte program is:
```
0x14  0x90  0x01  0x00  0x02
```
(header: HAS_TERNARY=1, LEN=4) (TERNARY: KNOWN_CONTACT, CARD, FORM)

This is probably the single most-used non-trivial TRIG program. Worth 4 bytes of its own encoding shortcut.

### The header byte

Bytecode programs (anything longer than a pattern token) need a header byte. The header carries:
- **VER (2 bits)**: version field for graceful future upgrade
- **HAS_CSS (1 bit)**: hint that a LOAD_CSS instruction is present — the shell can pre-fetch the CSS module before TRIG evaluation completes, reducing render latency
- **HAS_TERNARY (1 bit)**: hint that a TERNARY instruction is present — evaluator can use a specialised fast path
- **PROG_LEN (4 bits)**: length of the instruction stream that follows (1–14 bytes directly; 15 = extended)

The HAS_CSS and HAS_TERNARY bits are **optimiser hints**, not correctness flags. A shell that ignores them will evaluate identically; it just won't pre-fetch. This matters because LOAD_CSS may cause a style recalculation that delays first paint. Pre-fetching the CSS module before evaluation eliminates that jank.

PROG_LEN is in the header rather than implied because it lets the shell skip unknown TRIG blocks without evaluating them. If VER is unknown, the shell reads PROG_LEN, skips that many bytes, and renders BLANK — without attempting to parse opcodes it doesn't understand. Safe degradation.

---

## Part 4 — The Condition System

### Conditions are synchronous local queries

Every condition in TRIG is a local query answered synchronously from device state. There are no network requests, no async operations. The evaluator asks the shell a question; the shell returns true or false immediately.

This is a fundamental constraint. TRIG evaluation happens during page load, before any UI is rendered. It must complete quickly — ideally in under 1ms. Any condition that requires a network round-trip, a database query, or significant computation is ruled out.

All 12 defined conditions are locally answerable:

| Condition | What the shell queries |
|-----------|----------------------|
| HAS_APP | `navigator.userAgent` check + installed app registry |
| KNOWN_CONTACT | Local contacts IndexedDB lookup by sender identifier |
| CODE_VERIFIED | Local scramble-code-verified-set lookup |
| IS_HUMAN | Interaction signal from `touchstart`/`mousemove` event recorded before shell evaluates |
| HAS_SAVED_RECORD | Local records IndexedDB lookup for records from this sender |
| ORG_MATCH | Local contacts IndexedDB lookup by org name |
| HAS_TEMPLATE | Local template registry lookup by template ID |
| DAYLIGHT_HOURS | `new Date().getHours()` — trivial |
| RECENT_CONTACT | Local contacts IndexedDB + last-interaction timestamp |
| APP_VERSION_OK | Compare app build version to floor declared in record |
| REPLY_PENDING | Local outbox queue lookup for this sender |
| LOCATION_NEAR | Cached last-known position vs geo block in record — no live GPS query |

**IS_HUMAN is the interesting case.** A human doesn't interact with a page before the page renders — so how does the shell know, before rendering, whether a human is present?

The answer is: the shell records interaction events from the moment the page loads. The first `touchstart`, `click`, `keydown`, or `mousemove` event sets an `isHuman` flag. TRIG evaluation happens on `DOMContentLoaded`, which fires before any UI element is visible. Most humans won't have interacted yet.

The resolution: IS_HUMAN should not be evaluated at DOMContentLoaded. Instead, the evaluator defers rendering until one of two things happens: (a) an interaction event fires, (b) a 500ms timeout expires. If an interaction fires within 500ms, IS_HUMAN = true. If the timeout expires without interaction, IS_HUMAN = false.

This adds a worst-case 500ms delay to rendering for IS_HUMAN-gated content. That's acceptable — the page shows a loading state in the meantime. The alternative (evaluating IS_HUMAN immediately and always returning false) makes the condition useless.

**Implication for TRIG evaluation order:** The evaluator must process all condition pushes first and identify whether IS_HUMAN is needed before executing. If IS_HUMAN is needed, defer. If not, evaluate immediately. This is a scan-ahead step in the evaluator, not a fundamental change to the stack machine model.

### Condition result caching

If the same condition appears twice in a program (not common but possible), the shell should cache the result for the duration of one TRIG evaluation. Contacting IndexedDB twice for KNOWN_CONTACT in the same 1ms window is wasteful and produces identical results.

Cache lifetime: one TRIG evaluation. Cleared after SHOW/SHOW_ALWAYS terminates.

### The BLOOM instruction as a condition

BLOOM is architecturally a condition, but it's implemented as its own instruction rather than a PUSH_COND codebook entry. Why?

1. **It has an operand.** BLOOM takes a 16-bit filter operand specifying which capability checks to run. No other condition has this — conditions are either true or false with no configuration. Encoding BLOOM as a PUSH_COND with a 3-byte extended argument (condition ID + 2-byte filter) would be messier than a dedicated instruction.

2. **It's computationally heavier.** BLOOM runs multiple synchronous capability tests. It shouldn't be treated the same as "look up a local database record." Having a distinct opcode signals to the evaluator that this is an expensive operation (relatively — still under 1ms, but measurably slower than a boolean lookup).

3. **It pushes the same bool.** From the stack machine's perspective, BLOOM pushes a bool just like PUSH_COND. AND, OR, NOT, JZ, SHOW all operate on it identically.

BLOOM is the most technically interesting condition. The capability filter approach draws from browser fingerprinting techniques, but inverted — instead of fingerprinting to track users, it fingerprints to distinguish real browsers from bots. The 16-bit operand selects which checks matter for the specific use case: a high-value financial form might demand all 6 checks; a simple service menu might demand only rAF timing (cheapest check).

---

## Part 5 — The Codebook System

### The core idea: payload-free styling

The LOAD_CSS, SET_THEME, and LOAD_JS instructions load content by a 1-byte ID. No CSS bytes, no JS bytes, no theme bytes travel in the URL or the frame. The content lives in the shell — either bundled with the shell code (for v1 built-ins) or installed as extension modules.

This is a crucial property. A URL that loads a full-screen presentation with animated content, a custom colour theme matching the business's brand, and a contact form with validation logic might do all of that with a 5-byte TRIG program. The heavy content (CSS: ~2–5KB, JS: ~10–50KB) is already on the device.

It also means the content can be updated server-side without changing any URLs. If a CSS module is improved, the updated CSS is deployed to the shell; all existing URLs automatically get the new version. This is the same model as web browser standard CSS properties — the rendering is defined by the engine, not the document.

### CSS modules as design primitives

The 7 CSS modules in v1 are designed as building blocks:

- **BASE**: Always loaded implicitly. Reset, font, spacing. Every page gets this.
- **CARD_LIGHT / CARD_DARK**: Card container, shadow, typography. Two themes of the same layout.
- **FORM_STD**: Input fields, labels, validation states, submit button.
- **SERVICE_LIST**: Name + price layout. Compact rows.
- **BILLBOARD**: Large-format. Title prominent, CTA button, accent colour support.
- **MINIMAL**: Literally just a name and a contact-action icon. Zero chrome.

These aren't arbitrary. They map directly to the 7 display modes (CARD, LIST, FORM, MINIMAL, TICKER, BLANK, NATIVE). A well-designed TRIG program loads the CSS module that matches the display mode it intends to show. SHOW(FORM) is almost always paired with LOAD_CSS(FORM_STD).

Should the shell automatically load the matching CSS module when SHOW is called, without an explicit LOAD_CSS? This is an open implementation question. Auto-loading would be convenient and reduce program length. Explicit LOAD_CSS gives the sender control (you might want BILLBOARD CSS but CARD display mode, for a full-width card presentation). The current spec requires explicit LOAD_CSS. The shell could implement a default fallback if LOAD_CSS is absent.

### Theme as an overlay

Themes are separate from CSS modules because a theme is an orthogonal dimension. You might want SERVICE_LIST layout in a WARM colour palette, or CARD_LIGHT layout in a DARK colour palette. Theme = CSS custom properties (`--accent-color`, `--bg-color`, `--text-color`) that override the defaults from the base module.

This is similar to how CSS custom properties work in real browsers. The theme module sets a handful of `--variable` declarations on `:root`, and the base CSS module uses those variables throughout. Swapping themes requires no structure changes — just different variable values.

The implication: theme modules are very small (a dozen custom property declarations, perhaps 200–500 bytes). The CSS codebook could realistically hold 15 themes with no meaningful storage cost.

### JS modules as named capabilities

The 3 v1 JS modules (CONTACT_FORM, BOOKING_FORM, REPLY_ROUTER) are functional units, not style. They encapsulate specific app-level behaviour:

- **CONTACT_FORM**: Renders a "tell me your name and number" form; on submit, creates a contact record on the viewer's device and optionally sends it back as a reply record.
- **BOOKING_FORM**: Date picker + service selector; on submit, sends a booking request record back to the sender.
- **REPLY_ROUTER**: Generic: takes the form data from any form schema block, packages it as a record, and routes it via the app's share mechanism.

These modules are essentially the "app logic" for specific use cases. They communicate with the shell via the postMessage API from OQ-26. They run in a sandboxed iframe. They can't access localStorage directly or talk to servers unless the shell approves the endpoint.

Note: JS modules are different from the inline/fetch-target JS of OQ-26. Codebook JS modules are shell-bundled, pre-vetted, version-pinned. OQ-26 inline/fetch-target JS is sender-provided and only permitted in `1ps`/`1pt` records. TRIG's LOAD_JS loads the vetted codebook version — no sender-provided code.

---

## Part 6 — Security Model

### What TRIG does not secure

TRIG is a *presentation gating* system, not a *security* system. It is important to be precise about this.

TRIG **does not prevent**:
- A determined attacker from reading the fragment manually and decoding the record
- Someone who has the URL from extracting the binary payload and parsing it with a custom decoder
- A motivated bot operator from using a real browser instance with the app installed to circumvent KNOWN_CONTACT checks

TRIG **does prevent**:
- Mass automated scraping of presentation content (link-preview bots, search engine crawlers)
- Casual privacy leakage from link-preview thumbnails showing business names, services, prices
- WhatsApp/Telegram auto-expanding a business card URL and showing the card image in a chat before the intended recipient reads it
- A forwarded URL immediately revealing the sender's business information to an unintended third party

The distinction matters for implementation: TRIG should not be treated as a security boundary. It is a UX boundary — a presentation gate that makes the product behave more like a private business card than a public web page, without requiring login or authentication.

True security (encrypted content, access control) comes from the scrambling layer (`1ps`, `1pt`, `1ph` tags from OQ-14). TRIG is orthogonal to scrambling — a `1ps` encrypted record can have TRIG bytes to control presentation even for verified recipients.

### Adversarial evaluation

Consider an attacker who is determined to see the content of a TRIG-gated page and has significant resources. Their options:

1. **Headless browser with JS execution.** They run a headless Chrome instance against the URL. Result: IS_HUMAN = false (no real interaction), KNOWN_CONTACT = false (no contacts database), HAS_APP = false (app not installed). All common conditions fail. BLOOM check might also fail (rAF timing, canvas fingerprint). The page renders BLANK.

2. **Real browser with app installed.** They extract the URL and open it in a real device with the app installed. Result: HAS_APP = true. If KNOWN_CONTACT is required, they need to be in the sender's contacts on the sender's device — which means the sender added them. A determined attacker could create a new contact entry (some implementations might check a bilateral contact relationship), but this requires app-level access, not just HTTP access.

3. **Binary payload extraction.** They take the base64url fragment, decode it, and run their own decoder against the binary payload. If the record is unencrypted (`1pb`), this fully works — they read the record. If it's encrypted (`1ps`/`1pt`), they still can't read it without the key.

Conclusion: TRIG is highly effective against automated mass scraping. It is moderately effective against casual manual snooping. It is not effective against a determined attacker with physical access to a real browser. For sensitive content, the encryption layer is the right protection; TRIG handles the presentation surface.

---

## Part 7 — Implementation on KaiOS

### The KaiOS constraint

KaiOS is a Firefox OS derivative running on low-spec hardware (typically 256MB RAM, single-core CPU, often limited to 3G connectivity). The workpads app is built for this platform. TRIG must be designed for the KaiOS implementation as the primary target, with desktop browsers as secondary.

Key constraints:
- **JS engine**: SpiderMonkey (as in Firefox), generally capable but slower than V8 on modern hardware
- **Memory**: Tight. A TRIG evaluator that allocates unnecessary objects or closures will trigger GC pauses
- **Connectivity**: 3G typical. CSS/JS module fetch from a CDN may take 1–3 seconds. This makes the HAS_CSS hint (for pre-fetching) more valuable than on a desktop
- **IndexedDB**: Available but slower than desktop. Contact lookups, saved-record queries, and template registry checks may take 5–50ms on KaiOS vs <1ms on desktop

The IndexedDB latency for condition evaluation is the critical concern. If KNOWN_CONTACT requires an IndexedDB lookup, and that lookup takes 30ms, TRIG evaluation takes 30ms. For a page that should ideally first-paint in under 500ms, that's significant.

**Mitigation options:**
1. **In-memory condition cache.** When the app loads, pre-load a Set of known sender IDs into memory. KNOWN_CONTACT = senderSet.has(senderId). O(1) lookup, no IndexedDB during TRIG evaluation.
2. **Async evaluation with placeholder.** Render a loading state immediately, evaluate TRIG conditions asynchronously, replace the loading state with the real view when conditions resolve.
3. **Condition pre-evaluation on record load.** When a record is first opened from a URL, evaluate all conditions and cache the results as part of the record storage. Subsequent opens use the cached condition results.

Option 1 is the most robust for TRIG specifically. The sender ID set can be maintained as a lightweight in-memory Set derived from the contacts IndexedDB on app startup. For 1000 contacts, a Set of 1000 strings uses about 50KB of memory — acceptable on KaiOS.

### The IS_HUMAN 500ms wait on KaiOS

The 500ms deferral for IS_HUMAN-gated content is tolerable on a desktop browser but potentially problematic on KaiOS where users may already be waiting for the page to load. On a 3G connection, the page itself may take 2–3 seconds to load. A further 500ms wait for IS_HUMAN evaluation would be barely noticeable.

However, a KaiOS user opening a URL from a WhatsApp message is already in a "waiting" mental state. The interaction model is different from desktop: on KaiOS, the user typically opens a URL, waits for it to load, and then interacts. The first interaction event may fire within 100ms of DOMContentLoaded because the user is actively pressing a button to navigate to the URL. This suggests the 500ms timeout may actually fire quickly in practice.

**Recommendation:** Keep the 500ms timeout but start it only after DOMContentLoaded (not from page navigation start). Most KaiOS users will interact within that window.

### The evaluator implementation

The TRIG evaluator is a simple loop. Here is a rough JavaScript skeleton:

```javascript
function evalTrig(bytes) {
  if (bytes.length === 0) return { mode: 'native', css: 0, theme: 0 };
  
  // Pattern token (1 byte, high nibble = 0)
  if ((bytes[0] & 0xF0) === 0x00) {
    return expandPattern(bytes[0] & 0x0F, bytes[1]);
  }
  
  // Bytecode program
  const ver = (bytes[0] >> 6) & 0x03;
  if (ver !== 0) return { mode: 'blank' }; // unknown version — graceful degrade
  
  const hasCss = (bytes[0] >> 5) & 0x01;
  const hasTernary = (bytes[0] >> 4) & 0x01;
  let len = bytes[0] & 0x0F;
  let offset = 1;
  if (len === 15) { len = bytes[offset++] + 15; }
  
  const stack = [];
  const effects = { css: null, theme: null, js: null };
  
  while (offset <= len) {
    const byte = bytes[offset++];
    const op = (byte >> 4) & 0x0F;
    let arg = byte & 0x0F;
    if (arg === 15) { arg = bytes[offset++]; }
    
    switch (op) {
      case 0x0: return evalTrig(expandPattern(arg, null)); // inline pattern
      case 0xD: stack.push(evalCondition(arg)); break;     // PUSH_COND
      case 0x1: effects.css = arg; break;                  // LOAD_CSS
      case 0x2: effects.layout = arg; break;               // SET_LAYOUT
      case 0xB: effects.theme = arg; break;                // SET_THEME
      case 0xA: effects.js = arg; break;                   // LOAD_JS
      case 0x5: { const n=arg; const res=stack.splice(-n).every(Boolean); stack.push(res); break; } // AND
      case 0x6: { const n=arg; const res=stack.splice(-n).some(Boolean); stack.push(res); break; }  // OR
      case 0x7: stack.push(!stack.pop()); break;           // NOT
      case 0x3: return { mode: MODES[arg], show: stack.pop(), ...effects }; // SHOW
      case 0x4: return { mode: MODES[arg], show: true, ...effects };        // SHOW_ALWAYS
      case 0x8: if (!stack.pop()) { offset += arg; } break; // JZ
      case 0x9: { // TERNARY
        const cond = evalCondition(bytes[offset++]);
        const mTrue = bytes[offset++];
        const mFalse = bytes[offset++];
        return { mode: MODES[cond ? mTrue : mFalse], show: true, ...effects };
      }
      case 0xC: { // BLOOM
        const hi = bytes[offset++];
        const lo = bytes[offset++];
        stack.push(evalBloom((hi << 8) | lo));
        break;
      }
    }
  }
  
  return { mode: 'blank', ...effects }; // no SHOW reached — default blank
}
```

This is approximately 60 lines. The real implementation needs error handling (stack underflow, out-of-bounds reads, unknown opcodes) but the evaluator itself is this simple. KaiOS can run this in under 0.5ms for any valid 20-byte program.

---

## Part 8 — Design Questions Still Worth Thinking Through

These are not blockers — the v1 spec is complete and implementable. But they are worth contemplating before writing the evaluator, because some have implementation consequences.

### 8.1 — Where exactly in the frame do TRIG bytes live?

The spec says TRIG bytes are in the TRIG block within the display_schema block. This means TRIG is only present in records that also have a display schema. But there might be a case for TRIG to gate records that have no display schema — just a raw data record — where TRIG controls whether the record is shown at all.

Should TRIG have its own block presence bit in meta2? Currently meta2 has EXTENDED_FIELDS and PARTICIPANTS flags. A HAS_TRIG flag would let TRIG appear in any record type, not just presentation records. This would allow, for example, a plain `1pa` data record to carry TRIG bytes that control whether the app presents a notification — "only show a notification to this user if they have the app and the code is verified."

This is a non-trivial frame change and probably post-MVP. But it's worth naming so it doesn't come as a surprise.

### 8.2 — Can TRIG programs be nested or composed?

The current spec has no mechanism for TRIG program composition — one frame, one TRIG program. But the PATTERN instruction inside a bytecode program splices in the pattern expansion. That's a limited form of composition (inline macro expansion).

Could you have a CALL instruction that invokes a named sub-program stored in the shell's pattern codebook? This would let the sender define a reusable TRIG program as a template-level property, and individual records reference it by ID. Records would just contain `CALL(program_id)` — one or two bytes.

This is essentially a user-defined extension of the pattern token space. Pattern tokens 0x0C–0x0F are reserved — they could be assigned as "user-defined pattern" slots, where the shell resolves the ID against a locally-stored custom program. Template-keyed programs (`1pt` records) could define their own TRIG programs that apply to all records using that template.

Worth thinking through before implementing the evaluator, because if you want this, the `0x0F` reserved pattern token slots should be designated for it now.

### 8.3 — Should BLOOM be a first-class condition or stay as a dedicated instruction?

The current design has BLOOM as its own opcode. An alternative: promote IS_HUMAN (condition ID 3) to implicitly run the BLOOM test, and remove the dedicated BLOOM instruction. "Is human" and "passes Bloom filter" are semantically the same question — IS_HUMAN = "this environment exhibits signals of a real human using a real browser."

The benefit: simpler instruction set (15 opcodes instead of 16), IS_HUMAN becomes more meaningful (it's not just an interaction event check, it's a full capability check).

The cost: IS_HUMAN becomes slower (runs the capability checks every time), and you lose the ability to tune which checks to run via the filter operand.

Middle path: IS_HUMAN runs a lightweight interaction check (any pointer/touch event fired). BLOOM runs the capability filter. Two distinct questions. The current spec takes this path.

### 8.4 — What does a TRIG program do after SHOW?

The spec says evaluation terminates when SHOW or SHOW_ALWAYS is reached. Any remaining bytes after SHOW are not evaluated. This means:

```
SHOW(CARD)      // terminates
LOAD_CSS(DARK)  // never reached
```

Is this the right model? Alternative: evaluation continues after SHOW, but only side-effect instructions are honoured (LOAD_CSS, SET_THEME, LOAD_JS). This would let you structure programs with SHOW first (for clarity) followed by CSS/theme/JS loading.

The current model requires side effects to precede SHOW:
```
LOAD_CSS(CARD_DARK)   // side effect first
SET_THEME(DARK)       // side effect
PUSH_COND(KNOWN)      // condition
SHOW(CARD)            // terminates — side effects already registered
```

This is slightly awkward — you must write CSS loads before the condition logic. The alternative (continue after SHOW for side effects) would read more naturally. But it complicates the evaluator (don't halt at SHOW — continue to scan for side-effect instructions). Not a big deal either way, but decide before writing the evaluator.

### 8.5 — How do TRIG programs compose with encryption?

An encrypted record (`1ps`, `1pt`) has its data encrypted. But TRIG bytes — being presentation logic, not data — are arguably part of the frame metadata rather than the encrypted payload. Should TRIG bytes be:

a) **Inside the encrypted blob** — fully protected, not visible until decrypted. This means the page looks completely blank to anyone without the key. But it also means the shell can't even show a "enter your code" prompt without first knowing TRIG is present.

b) **Outside the encrypted blob** — visible to the shell before decryption. TRIG can control the "enter code" UX (show a specific prompt, a specific message). But TRIG bytes themselves are visible to anyone with the URL.

For `1pb` records (always unencrypted), this is moot. For `1ps`/`1pt` records, option b makes more sense: TRIG controls the pre-decryption UX ("enter code to view details of this record"), while the record data itself is encrypted. TRIG bytes are 1–20 bytes of presentation logic — revealing them doesn't reveal the record content.

The spec implies option b (TRIG is in the display_schema block which is part of the frame wrapper, not the encrypted payload). But this should be explicitly confirmed in FRAME-SPEC.md when the security block layout is finalised.

### 8.6 — Error behaviour and robustness

What does the evaluator do when:
- Stack underflow (AND with 2 args but only 1 item on stack)
- PROG_LEN is 15 but the extended length byte pushes total bytes past 20
- An unknown opcode is encountered (0xE_, before it's assigned)
- JZ skip count would jump past end of program

The spec says max 20 bytes; violation = render BLANK. But the evaluator needs to handle all these cases without throwing an uncaught exception (which would crash the shell on KaiOS).

The robust implementation wraps the entire evaluator in a try/catch, returns BLANK on any exception. Inside the evaluator, boundary checks before every bytes[] access. An invalid TRIG program should be a visible but safe failure (BLANK page), not an app crash.

---

## Part 9 — What the Receiver Actually Experiences

It's easy to think about TRIG from the sender's perspective (writing programs) and miss the receiver's experience. Consider how TRIG changes the receiver's world:

### The known contact experience

A person in your contacts opens a `1pb` URL you've shared. Your TRIG program is `0x01` (KNOWN_CONTACT_SHOW). What happens:

1. They tap the link from WhatsApp.
2. KaiOS opens the workpads shell page.
3. Shell loads; fragment is read; binary payload is decoded.
4. TRIG bytes: `0x01` — pattern token expands to `PUSH_COND(KNOWN_CONTACT) SHOW(CARD)`.
5. Shell queries local contacts for sender's phone number — finds a match.
6. Condition = true. SHOW(CARD) executes.
7. Receiver sees the full business card with your service menu.

A bot that scraped the same link: step 5 returns false. Step 6 never executes. The bot sees a blank HTML page with no content in the `<og:...>` tags, no preview thumbnail, nothing useful.

### The anonymous form experience

A person follows a `1pb` URL to an anonymous contact form. Your TRIG program gating: `0x09` (FORM_IF_HUMAN). What happens:

1. They tap the link.
2. Shell loads.
3. TRIG: `0x09` — PUSH_COND(IS_HUMAN) SHOW(FORM).
4. Shell defers 500ms, records their first keypress or touch.
5. IS_HUMAN = true.
6. SHOW(FORM) executes with FORM_STD CSS loaded (auto or explicit).
7. Receiver sees the form. They fill it in. They submit.
8. Their submission is routed via blind pickup — back to the sender without revealing the sender's identity.

The page has no title, no business name visible, no identifiable content before they interact. The form appears only when they touch the screen. To a casual observer over their shoulder before they interact: just a blank page.

### The wrong-audience experience

A person NOT in your contacts opens the same `0x01` URL. What happens:

1. They tap the link.
2. Shell loads.
3. TRIG: PUSH_COND(KNOWN_CONTACT) returns false.
4. SHOW(CARD) is called with `show = false` → renders BLANK.
5. They see a blank page. No content. No error message. No indication anything is wrong.

This is the intended behaviour: no information leakage, no explanation. The URL was clearly sent to the wrong person (or forwarded by a known contact to someone else). Revealing "this is a workpads record, you just don't have access" is more than the wrong-audience needs to know.

The UX question: should the blank page include any guidance? Options:
- Completely blank (current spec)
- Generic brand message: "This link is personalised. Download workpads to continue." — reveals the platform
- A hint text from the TRIG program itself (future: a TEXT_HINT instruction that sets a message shown on BLANK)

The third option is interesting and not in v1. A future TEXT_HINT instruction could let the sender set what text appears when all conditions fail. "Ask [name] for the link directly" — a short message that reveals nothing about the content but gives the recipient a path forward.

---

## Part 10 — Questions to Decide Before Writing Code

A checklist of design questions that should be explicitly resolved before the TRIG evaluator is written, in approximate priority order:

**Evaluator architecture:**
- [ ] Does evaluation continue after SHOW for side effects, or halt completely? (§8.4)
- [ ] How are IndexedDB lookups handled — pre-cached in memory, or async with placeholder? (§7, KaiOS)
- [ ] What is the exact error behaviour for malformed programs? (§8.6)

**Frame integration:**
- [ ] Are TRIG bytes inside or outside the encrypted payload for `1ps` records? (§8.5)
- [ ] Does TRIG get its own block presence bit in meta2, or stays inside display_schema? (§8.1)

**Pattern and codebook:**
- [ ] Are pattern tokens 0x0C–0x0F reserved for user-defined programmes? (§8.2)
- [ ] Does SHOW(mode) auto-load the matching CSS module, or require explicit LOAD_CSS? (§5, CSS modules)

**Condition system:**
- [ ] IS_HUMAN: 500ms wait — what is the loading state shown during the wait?
- [ ] Should BLOOM and IS_HUMAN be unified into a single condition? (§8.3)
- [ ] KNOWN_CONTACT: unilateral (viewer has sender in contacts) or bilateral (both have each other)? Unilateral is simpler; bilateral is more meaningful but requires sender info in the record.

**Version upgrade:**
- [ ] The four VER values (00=v1, 01–11=future). Should there be a VER negotiation mechanism, or pure graceful degrade (unknown VER = BLANK)?

---

## Summary

TRIG is a small thing that solves a significant UX and privacy problem elegantly. The hard problems are not in the bytecode language itself — the stack machine evaluator is 60 lines of JavaScript — but in:

1. **The condition system**: ensuring local queries are fast enough on KaiOS hardware, particularly the in-memory KNOWN_CONTACT cache and the IS_HUMAN deferral model.

2. **The codebook system**: designing the CSS modules and JS modules so they cover the real use cases in the real shell, and committing to their content being stable (changing them is a version bump).

3. **The integration with the rest of the frame**: where TRIG bytes live relative to encryption, whether TRIG gets its own presence flag, how it interacts with the display_schema block.

4. **The user experience of BLANK**: what does a blank page feel like for a recipient who received the wrong link, and whether any guidance is appropriate.

The language design is done. The implementation decisions above are what remain.

---

## Design Notes — Ongoing Contemplation

*This section accumulates observations, proposals, and analysis as thinking develops. Each note records what was considered and what conclusion was reached.*

---

### Note A — Lazy loading shell resources from the server after payload is read

**Prompt:** Is it possible to lazy load various resources (CSS modules, JS modules, display assets) from the workpads server after the fragment/payload has been read by the shell, rather than bundling them into the shell upfront? Could this speed up page load time?

---

#### What the proposal is

The shell page — the generic page served at `workpads.me/p` — currently needs to support all possible display modes. In a fully-bundled model that means shipping: BASE CSS + CARD_LIGHT + CARD_DARK + FORM_STD + SERVICE_LIST + BILLBOARD + MINIMAL + all JS modules, all baked into the shell download. A user opening a link that only ever shows a service menu pays to download the form CSS they will never use.

The lazy load alternative: ship the shell with almost nothing — just the TRIG evaluator, the codec parser, and BASE CSS. After the fragment is read and TRIG evaluated, the shell knows exactly which CSS module and which JS module (if any) it needs for *this specific record*. Only then does it request them from the server.

---

#### The sequence, compared

**Fully-bundled (current assumed model):**
```
T=0ms      User taps link
T=50ms     TCP connection established
T=50ms     Request shell bundle (HTML + JS + ALL CSS, ~50KB)
T=650ms    Shell received at 3G speeds (~8Mbps = ~6ms/KB, but real throughput ~0.8MB/s)
T=651ms    Fragment read, TRIG evaluated, codec parsed
T=652ms    CSS already present — render immediately
```
One round trip. One download. Larger.

**Lazy-loaded shell:**
```
T=0ms      User taps link
T=50ms     TCP connection established
T=50ms     Request shell bundle (HTML + JS + BASE CSS only, ~12KB)
T=170ms    Shell received (12KB at same rate)
T=171ms    Fragment read
T=171ms    TRIG header byte parsed: HAS_CSS=1 — fire CSS module request immediately
T=172ms    Full TRIG evaluation + codec parse completes (~1ms)
T=172ms    Render loading state (BASE CSS, no module CSS yet)
T=372ms    CSS module received (200ms RTT + ~7ms for 6KB) — apply styles, full render
```
Two round trips. But the second one starts at T=171ms and the first download finishes earlier. Total time to full render: ~372ms vs ~652ms.

**On warm cache (subsequent visits):**
Both approaches serve everything from the browser cache. Lazy loading wins by the size difference of the initial shell download — a 12KB cache read is faster than a 50KB cache read. On constrained KaiOS hardware where cache reads have non-trivial cost, this compounds over every link open.

---

#### Why the HAS_CSS flag already anticipates this

The `HAS_CSS` bit in the TRIG bytecode header byte (bit 5) was described as an "optimiser hint — shell can pre-fetch the CSS module." This is exactly the pre-fetch hook for lazy loading. The moment the shell reads byte 0 of a bytecode program, it can know whether a CSS load is coming. It fires the request immediately — before even finishing TRIG evaluation, before parsing the record data. The CSS round trip runs in parallel with local processing.

In the lazy loading model, HAS_CSS is not just a hint — it is a performance-critical signal. The evaluator should treat it as: "start the CSS fetch NOW, before anything else."

The same logic applies to HAS_TERNARY (evaluator hint), and could extend to a HAS_JS flag if added to the header byte. A single-bit pre-fetch hint per resource type, all readable from byte 0.

---

#### The privacy tradeoff

There is a small privacy cost to lazy loading that doesn't exist in the fully-bundled model.

When the shell bundles everything, no module-specific requests ever leave the device. The server serves one generic shell page; it sees nothing about what the user is viewing.

With lazy loading, the server receives a request for a specific module: `GET /shell/css/4` (SERVICE_LIST). The server now knows:
- At timestamp T, someone opened a link that displays a service menu
- It does NOT know who the sender is, who the viewer is, or what the record contains (fragment not sent to server)
- But it knows the display mode — which is a mild inference about record type

For most use cases this is acceptable — the content is still private. For high-privacy scenarios (`1ps` scrambled records), the display mode being inferrable from a CSS module request is a minor leak. Worth noting but not blocking: a scrambled record is already encrypting its data. A server seeing "someone fetched the CARD_LIGHT CSS module" reveals less than nothing.

Mitigation if needed: the shell could request all modules in a randomised or fixed pattern on every page load, masking which one is actually needed. This defeats the performance benefit entirely so it would only be appropriate for the highest-sensitivity use cases. Not recommended as default behaviour.

---

#### The versioning and cache invalidation model

Lazy-loaded resources need stable URLs that can be cached aggressively. Options:

**Option 1 — Version path:** `/shell/v1/css/card-light.css`  
Simple. When a module changes, increment the version path. Old cached files serve until TTL expires or new path is used. Problem: version changes require updating references throughout.

**Option 2 — Content-addressed:** `/shell/css/{sha256_hex}.css`  
Files are immutable — URL is derived from content hash. Perfect cache: set TTL to one year. When module content changes, new hash = new URL. Old URL stays valid indefinitely for old shell versions that reference it. This is the model already used for OQ-26 fetch-target JS.

**Option 3 — Codebook ID with shell-version prefix:** `/shell/v1/m/4` where `v1` is the shell codebook version and `4` is the CSS module ID.  
Simplest for the shell to construct (just the module ID integer from the LOAD_CSS operand). Version prefix ensures new module definitions don't collide with old caches.

**Recommended: Option 3 for initial implementation, Option 2 for long-term.** The codebook ID is what TRIG carries (a single nibble). The shell knows the base URL prefix. Constructing the request is one string concatenation. Content-addressing can be layered on later (the LOAD_CSS extended ARG, ARG=15, could carry a URL or hash reference for a bespoke module not in the standard codebook).

---

#### What gets bundled vs lazy-loaded: a proposed split

| Resource | Bundle or lazy? | Rationale |
|----------|----------------|-----------|
| TRIG evaluator | Bundle | Always needed; tiny (~60 lines JS) |
| Codec parser | Bundle | Always needed; core functionality |
| BASE CSS | Bundle | Every page uses it; tiny reset + font |
| CARD_LIGHT CSS | Bundle | Most common display mode; pays for itself |
| CARD_DARK CSS | Lazy | Less common; save for dark-mode requesters |
| FORM_STD CSS | Lazy | Only form records; no cost for non-form links |
| SERVICE_LIST CSS | Lazy | Only service menus |
| BILLBOARD CSS | Lazy | Only marketing/advertising records |
| MINIMAL CSS | Lazy | Only contact-resident records |
| Theme overlays | Lazy | Only when SET_THEME called with non-zero ID |
| JS modules (all) | Lazy | Only interactive records; never needed for display-only |

This makes the shell download approximately: TRIG evaluator (~3KB) + codec parser (~8KB) + BASE CSS (~2KB) + CARD_LIGHT CSS (~4KB) = ~17KB. Every other resource is fetched only when a specific record type demands it.

For the majority of records opened by a typical user (financial records shared as cards), no lazy fetch is ever triggered — CARD_LIGHT is already in the bundle, and no JS is needed for display-only records. The lazy load mechanism exists entirely for the less-common display modes.

---

#### A note on Service Workers

A Service Worker registered at the shell origin could:
1. Pre-cache all CSS/JS modules on first shell install (background prefetch)
2. Serve all subsequent module requests from local cache without network
3. Update modules in the background when shell version changes

This would make lazy loading effectively free for all repeat visits — no network request, instant cache read. Service Worker support on KaiOS is limited and inconsistent across device generations. Design the lazy loading mechanism to work correctly without SW. Treat SW as a progressive enhancement that can be added to reduce latency further on supporting devices.

---

#### Conclusion

Yes — lazy loading shell resources from the server after payload evaluation is architecturally sound, likely improves page load time on 3G (the primary KaiOS use case), aligns with how the HAS_CSS hint was already designed, and introduces only a minor and acceptable privacy tradeoff.

The core model to adopt:
1. Shell bundle = evaluator + codec + BASE + CARD_LIGHT only (~17KB)
2. All other modules = lazy-fetched by module ID after TRIG evaluation
3. HAS_CSS=1 in TRIG header → fire CSS fetch request at header-byte parse time (before full TRIG evaluation)
4. Module URLs = versioned by codebook version + module ID; aggressive cache headers
5. Loading state rendered immediately with BASE CSS while lazy resources arrive
6. No module request masks needed unless building `1ps`-specific high-privacy shell variant

**New checklist item for Part 10:**
- [ ] Shell bundle composition: exactly which CSS modules are bundled vs lazy-fetched? (§Note A recommendation: bundle BASE + CARD_LIGHT only)
- [ ] Module URL scheme: codebook-version + ID path, or content-addressed? (§Note A recommendation: v-prefix + ID for v1)
- [ ] Does HAS_CSS trigger an immediate fetch before full TRIG evaluation? (§Note A: yes — this is the key performance win)

---

### Note B — Server privacy principles for module delivery: obscuring, minimising, and eliminating server knowledge of what each record needs

**Prompt:** What server operation principles can be used to obscure, clear, and otherwise strongly protect user privacy when fetching display modules from the server? Is it possible to grant access to a server folder and then shut off the server's listening/logging for that session?

---

#### The problem being solved

When the shell fetches a CSS module after TRIG evaluation — say `GET /shell/v1/m/4` — the server receives a request that, however innocent, carries inference potential: the IP address of the viewer, the timestamp, and the module ID. From module ID 4 (SERVICE_LIST), a log-reading adversary could infer "this person at this IP opened a service menu record at this time." The content itself is safe — the record data never hits the server — but the display mode is a mild fingerprint of the record type.

Separately: if the server keeps access logs at all, those logs accumulate over time into a pattern that could be subpoenaed, breached, or sold. The question is whether server architecture and protocol choices can eliminate or render useless that pattern — not just obscure it, but structurally prevent it from existing.

Below is a full taxonomy of the relevant techniques, from policy-level choices through to cryptographic approaches. They are not mutually exclusive — the recommended model at the end combines several of them.

---

#### Technique 1 — Log minimisation policy (the foundation)

Before any technical measure: configure the server to log as little as possible, for as short a time as possible.

A standard web server (nginx, Apache, Caddy) logs: IP address, timestamp, HTTP method, URL path, response code, bytes sent. Of these, the URL path is what reveals the module ID. Three options:

**a) Log without path:** Record only that a request was served (IP + timestamp + bytes). Strip the path from access logs. The server has no record of which module was fetched, only that *something* was fetched from the shell origin.

**b) Purge logs on a short rotation:** Log everything, but run a cron job that deletes logs older than 24 hours. An adversary must act within 24 hours of an event to find it. Long-term correlation is impossible.

**c) No logging at all for the module namespace:** Configure the server to log requests to `/shell/v1/m/*` with a custom log format that omits the path and replaces it with a fixed string. Access logs show `GET /shell/module (masked)` — no inference possible.

This is a deployment policy decision, not a code change. It should be the first thing established before any other technique is layered on, because it is the structural foundation: no data stored = no data to leak, breach, or subpoena.

---

#### Technique 2 — Module bundle endpoint (hiding the specific module in a collective request)

Instead of the shell fetching individual modules by ID (`/m/4`, `/m/1`), the server exposes a single bundle endpoint: `GET /shell/v1/bundle` that returns all CSS modules in one response — a zip, a multipart body, or a single concatenated CSS file.

The server log for this request shows `GET /shell/v1/bundle`. It carries no information about which module was needed. The server cannot infer the display mode. The viewer gets all modules in one download; the shell applies only the one TRIG called for; the rest sits in cache.

**Performance cost on first visit:** Downloads all modules (~30–35KB) instead of just the needed one (~5KB). On 3G, that's roughly 230ms vs 40ms of transfer time — a one-time cost.

**Subsequent visits:** Bundle is cached with a long TTL. Every subsequent link open is a cache hit. No server request at all. The module fetch cost becomes zero after the first visit.

**Privacy gain:** Server can never distinguish a service-menu link from a financial-card link from a contact-form link, because every first visit fetches the same bundle. All record types look identical at the network layer.

**This is the cleanest technique for the workpads use case.** The privacy is perfect. The performance penalty is a one-time first-visit cost that disappears entirely after that. For a device that receives many workpads links over its lifetime, the bundle is fetched once per shell version update and cached forever in between.

---

#### Technique 3 — Capability tokens with ephemeral server-side state (the "grant access then shut off" model)

This is closest to what was described in the prompt: grant the shell access to a folder of resources, then eliminate the server's record of that session.

The mechanism:

**Step 1 — Token request:** When the shell first loads (before TRIG evaluation), it sends a lightweight anonymous request to the server: `POST /shell/token`. The server responds with a single-use capability token — a random string like `v1_a3f7c9...` — that grants access to the module namespace for the next 60 seconds. The server records in memory (not on disk): "token `v1_a3f7c9` is valid until T+60s." No user identity, no IP association in this record.

**Step 2 — Module fetch under token:** The shell fetches modules using the token: `GET /shell/v1/m/4?t=v1_a3f7c9`. The server validates the token (it is currently valid) and serves the module. The server does NOT log which module was fetched — only that the token was used (or not even that). On use, the token is removed from memory.

**Step 3 — Token expires:** After 60 seconds (or on first use), the token is deleted from server memory. No record remains — not on disk, not in a database. The access event is gone.

**What the server knows after this sequence:**
- That a token was issued to some IP at some time (if /shell/token requests are logged — they need not be)
- Nothing about what module was fetched under the token
- Nothing about the record that was displayed
- Nothing about the viewer

**What an adversary who subpoenas server records finds:** No module fetch records. Possibly a token-issuance log (if enabled), showing only that *some* shell page was loaded — identical to the server log for the generic shell page load itself.

This is the "grant access to a folder, then shut off listening" model. The server grants access via the token; the token acts as a temporary unlocked door; when the token expires, the door is gone and the server has no memory of what passed through it.

**Implementation notes:**
- Token store is in server RAM (e.g. Redis with TTL, or an in-process Map). Never written to disk.
- Token issuance endpoint does not require authentication and does not log the requesting IP.
- Tokens are single-use: first successful module fetch invalidates the token.
- Token generation: `crypto.randomBytes(32)` — 256 bits of entropy. Not guessable.
- Servers behind a load balancer: token must be stored in shared in-memory store (Redis), or sticky sessions used for the token lifetime.

---

#### Technique 4 — Content-addressed delivery: removing the workpads server from the picture entirely

This is the most structurally private option, and the most technically complex.

Each CSS/JS module is published by its content hash. The module file's URL is derived from its content: `/shell/css/sha256-{hash}`. Because the content never changes (changing the module means a new hash = new URL), these files are permanently cacheable.

Once published, the module files can be replicated to:
- A CDN (Cloudflare, Fastly, BunnyCDN) with no-log settings
- IPFS (InterPlanetary File System) — a decentralized content network where files are fetched by content hash from the nearest peer, with no central server involved
- Multiple mirrors simultaneously

The workpads server is responsible for publishing new module versions. After publication, it is entirely out of the delivery path. A shell fetching `/shell/css/sha256-abc123` from a CDN edge node in Lagos is not contacting the workpads server at all. The CDN node sees: an IP fetched a file with this hash. It does not know what that file is for, who created it, or what record displayed it.

**With IPFS:** The request resolves through the IPFS DHT (distributed hash table). No single server sees the request. The content comes from whatever IPFS node has it — potentially another workpads user's device that already cached it. The workpads server is structurally uninvolved.

This technique combines well with Technique 2 (bundle endpoint): publish the entire module bundle as a single content-addressed file. Every workpads device that opens a link fetches the same bundle by the same hash. After the first fetch, every subsequent request is a cache hit — no server, no CDN, no network at all.

---

#### Technique 5 — HTTP/2 and HTTP/3 multiplexing (reducing fingerprint granularity)

Under HTTP/1.1, each resource request is a separate TCP connection (or sequential on a keep-alive connection). A server log can distinguish `GET /m/4` from `GET /m/1` from `GET /m/7` — each is a separate log line.

Under HTTP/2 and HTTP/3, multiple requests are multiplexed over a single connection. A server configured to log only at the connection level (rather than per-request) sees one connection and knows: "someone connected and fetched some resources." The individual module IDs are not separately recorded.

HTTP/2 multiplexing is available on KaiOS in newer versions (Firefox-based, SpiderMonkey). HTTP/3 (QUIC) is less certain on older KaiOS hardware.

This is a supplementary technique, not a primary one. Its privacy benefit depends entirely on server log configuration — a server logging per-request under HTTP/2 still sees each module request individually.

---

#### Technique 6 — Request anonymisation via a privacy-preserving proxy

The shell's module fetches could route through an anonymising proxy layer before reaching the module server. Options:

**a) Tor:** The shell makes module requests through the Tor network. The exit node contacts the module server; the module server sees the Tor exit node's IP, not the viewer's. Not practical for KaiOS in production — Tor adds significant latency (500ms–2000ms) and is not available as a library on KaiOS.

**b) Workpads-operated relay:** The workpads server operates a relay endpoint. Module requests go through the relay, which strips the IP and forwards to the CDN. The CDN sees the relay IP. The relay is a single point of trust — workpads operates it and commits to not logging the viewer IP + module ID pairing. This is a trust-based, not cryptographic, protection.

**c) Mix network:** A more sophisticated version of the relay that batches and mixes requests from many users before forwarding, making it impossible to correlate a specific user request with a specific resource fetch. Extremely complex to implement; useful only if the threat model includes a compromised workpads server.

These are escalating measures appropriate for very high threat models (political dissidents, journalist sources, medical workers in repressive environments). For the typical workpads use case, Techniques 1–4 are sufficient.

---

#### Technique 7 — Forward secrecy at the server level

This term is borrowed from cryptography (where forward secrecy means compromising today's keys doesn't expose past sessions), but it applies to server logs too: if logs are not retained, a future server compromise cannot reveal past access events.

Operationally: configure all servers in the module delivery path to retain access logs for 1 hour maximum. After 1 hour, logs are overwritten (rolling buffer, not archival). A subpoena served today reveals nothing about access events from yesterday. A server breach exposes only the last hour of activity.

This requires:
- nginx/Caddy log rotation configured to 1-hour segments with immediate deletion of the previous segment
- No log aggregation service (e.g. no Datadog, Splunk, CloudWatch log streaming that archives everything)
- No CDN log retention beyond 1 hour

Combined with Technique 1 (log minimisation, strip paths), the logs that DO survive the 1-hour window contain no useful information anyway — no module IDs, just byte counts and timestamps.

---

#### Technique 8 — Private Information Retrieval (theoretical note)

Private Information Retrieval (PIR) is a cryptographic protocol where a client can fetch item N from a server's database without the server learning which item was fetched. The server sees a request but mathematically cannot determine which module the client wanted.

This is the gold standard for theoretical privacy against an adversarial server. It exists as academic research and has experimental implementations, but the computational overhead is high (the server must do work proportional to the entire database size per query). For a 7-module CSS codebook, a PIR implementation would be unusual and novel — but theoretically possible.

Not recommended for production. Noted because it represents the theoretical limit of what is achievable. If module delivery privacy ever becomes a regulatory or high-stakes requirement, PIR is where the research literature points.

---

#### Recommended model for workpads

Combining the above, a pragmatic architecture that achieves strong privacy without excessive complexity:

**Layer 1 — Policy (immediate, no code required):**
- Server logging for module namespace strips path: logs record bytes served, not module IDs
- Access logs on all servers purged on 24-hour rolling rotation
- No third-party log aggregation services receive module request data

**Layer 2 — Bundle endpoint (primary privacy mechanism):**
- All CSS and JS modules served as a single bundle from `GET /shell/v1/bundle`
- Shell fetches bundle on first load (or first cache miss), caches with 30-day TTL
- Server sees only: "someone fetched the bundle." No record type inference possible.

**Layer 3 — Ephemeral capability tokens (for sensitive contexts):**
- For `1ps`/`1pt` records where even the display mode should be protected, the shell obtains a short-lived token before any module fetch
- Token is in-memory only on the server, expires in 60 seconds, deleted on first use
- After token use, the server's record of the session is gone

**Layer 4 — Content-addressed CDN delivery (long-term):**
- Module bundles published by content hash to a CDN or IPFS
- Workpads server exits the delivery path after publication
- CDN edge nodes serve modules; CDN configured with no-log or minimal-log policy
- Long-term: workpads server is structurally uninvolved in every module fetch that hits CDN cache

**What remains on the server after all of this:**
- A log entry showing the shell HTML page was served (same as any web page visit)
- Nothing about the record type, display mode, or content

**Threat model this covers:**
- Link-preview bots: defeated by fragment privacy (server never sees the fragment)
- Server subpoena: logs contain no useful information (paths stripped, short retention)
- Server breach: same — attackers find no module access logs
- CDN subpoena: CDN sees content-addressed hash requests with no semantic meaning
- Long-term pattern analysis: logs purged, no archive, pattern cannot accumulate

**Threat model this does NOT cover:**
- A nation-state adversary with access to the CDN infrastructure (use IPFS or multi-CDN)
- A viewer's ISP or mobile carrier observing encrypted HTTPS traffic metadata (use Tor — impractical for KaiOS)
- A compromised device (the shell JS itself can be inspected — but this is true of all web apps)

---

**New checklist items for Part 10:**
- [ ] Which logging policy is adopted for the module namespace? (§Note B, Technique 1: strip paths from logs)
- [ ] Bundle endpoint vs individual module fetch — decision on primary delivery model? (§Note B recommendation: bundle endpoint)
- [ ] Are ephemeral capability tokens implemented for `1ps`/`1pt` module fetches? (§Note B, Technique 3)
- [ ] Module delivery CDN selected and no-log policy confirmed? (§Note B, Layer 4)
- [ ] Log retention window — 24-hour purge or 1-hour? (§Note B, Technique 7: 1-hour if high threat model)

---

### Note C — The CDN approach at scale, aligned with the workpads philosophy

**Prompt:** Elaborate in great detail what the CDN approach would look like at scale for a project with our philosophy.

---

#### What "our philosophy" means for infrastructure

Before describing the architecture, it is worth being explicit about what philosophy demands of the infrastructure layer, because it rules out entire classes of conventional choices.

Workpads' philosophy, as it applies to the server side:

- **Records travel in URLs, not servers.** The server is not the store of truth. It has never seen the record content. It should not acquire knowledge of record content as a side effect of delivering display resources.
- **Appropriate for the real user.** The primary user is on a KaiOS device, on 3G, in West or East Africa. Infrastructure decisions that work well in Frankfurt and fail in Lagos are wrong decisions regardless of their technical elegance.
- **The user's actions belong to the user.** The server should not accumulate a picture of which user opened which record type at which time. Structural amnesia — not just policy promises — is the goal.
- **Lean and survivable.** The system should continue to function even if the workpads origin server is offline, overloaded, or unreachable. A user in Accra with a cached shell should be able to open a link without touching a European data centre.
- **No coordination required between users.** Each user's experience is self-contained. The CDN is a read-only cache network, not a coordination layer.

These principles, taken together, point toward a content-addressed, edge-cached, origin-minimal architecture — which is exactly what a well-designed CDN deployment becomes when pushed in this direction.

---

#### The content-addressed model: why it is the right foundation

Every file the shell needs to display a record — a CSS module, a JS module, a theme overlay — is **immutable by definition**. Once CARD_LIGHT.css has been written and tested, its content does not change. If the CSS is improved, that is a new file with new content and a new identity.

Content addressing makes this explicit: the file's URL is derived from its content hash. A SHA-256 hash of the file's bytes becomes part of the URL:

```
https://cdn.workpads.me/m/sha256-a3f7c94e1b0d.css
```

This one decision cascades into an entire set of desirable properties:

**Immutability.** A file at a content-addressed URL never changes. The CDN can cache it forever — `Cache-Control: immutable, max-age=31536000`. No expiry, no revalidation, no cache invalidation across hundreds of edge nodes. The URL is the integrity guarantee.

**No cache invalidation problem.** Conventional CDNs require cache purges when files change. Purging a file across hundreds of edge nodes takes time, costs money (some CDNs charge per purge), and introduces race conditions (some nodes serve the old version, some serve the new). With content-addressed files, this problem does not exist. Old content stays at the old URL. New content gets a new URL. Every edge node caches what it caches; nothing is ever invalidated.

**Subresource integrity for free.** The hash in the URL IS the integrity check. If the CDN edge node serves a file that doesn't match the hash in the URL (due to corruption, tampering, or a misconfigured CDN), the shell can verify this and reject it. No separate SRI attribute needed, though one can be added for defense-in-depth.

**Backward compatibility forever.** Old shell versions reference old content hashes. Those hashes remain valid at the CDN indefinitely — the files are immutable, the CDN edge nodes cache them for a year, and the storage cost is negligible (~35KB per module bundle × N versions = trivial). A user running a shell version from 18 months ago opens a link; the old module bundle URL is fetched from CDN cache. It works. No deprecation, no migration, no "sorry this feature is no longer supported."

**The workpads server exits the delivery path.** After a module file is published to origin and the CDN has cached it, the workpads server is structurally uninvolved in serving it to any user. The CDN edge node in Lagos serves the file; the workpads origin server in (say) Frankfurt is never contacted. A request that never reaches the origin is a request the origin cannot log, cannot correlate, and cannot leak.

---

#### The publishing pipeline: from developer edit to global edge cache

Here is the full lifecycle of a module update, from the moment a developer changes a CSS file to the moment a user in Nairobi gets the update:

```
Step 1 — Developer edits FORM_STD.css
        ↓
Step 2 — Build system computes SHA-256 of new file content
         new hash: b9e3a17f2c04...
        ↓
Step 3 — Deploy new file to workpads origin at content-addressed path:
         PUT /m/sha256-b9e3a17f2c04.css  → origin server stores it
        ↓
Step 4 — Build system also builds new module bundle (all modules concatenated)
         Bundle hash: d5f1c82a0b3e... (changed because FORM_STD changed)
         PUT /m/sha256-d5f1c82a0b3e.bundle → origin stores it
        ↓
Step 5 — Update manifest.json on origin:
         { "version": "1.4", "bundle": "sha256-d5f1c82a0b3e", "modules": { "4": "sha256-b9e3a17f2c04", ... } }
         manifest.json has short TTL (1 hour) — NOT content-addressed, intentionally mutable
        ↓
Step 6 — CDN edge nodes in Lagos, Nairobi, Johannesburg, Mumbai etc. currently hold:
         old bundle sha256-8c2d0e9b... (version 1.3) — still valid, served to old shell versions
         new bundle sha256-d5f1c82a0b3e — not yet cached (no one has requested it yet)
        ↓
Step 7 — First user in Lagos with new shell version (1.4) opens a workpads link
         Shell requests: GET https://cdn.workpads.me/m/sha256-d5f1c82a0b3e.bundle
         Lagos edge node: cache miss → requests from origin → origin serves it → edge caches it
         All subsequent Lagos users with new shell: served by Lagos edge, origin not contacted
        ↓
Step 8 — Users with old shell (1.3) continue requesting sha256-8c2d0e9b (old bundle)
         Lagos edge: cache hit — serves immediately, origin not contacted
         Both shell versions coexist. No conflict. No forced migration.
```

The workpads origin server is contacted exactly **once per edge node per module version** — the first cache miss. After that, the edge node serves all requests from cache for the full TTL (1 year). At scale with a well-distributed CDN, the origin may see fewer than 1% of total user requests.

---

#### The edge network: geographic priorities for this project

A CDN is not a monolithic thing. It is a network of **Points of Presence (PoPs)** — data centres distributed globally that cache and serve content. The privacy and performance benefits of the CDN are proportional to how close an edge node is to the user.

For workpads' primary markets, edge coverage in sub-Saharan Africa and South Asia is the deciding factor in CDN selection. A CDN with strong North American and European coverage but no African PoPs is wrong for this project regardless of its pricing.

**PoPs that matter most for workpads:**

| City | Region | Importance | Notes |
|------|--------|------------|-------|
| Lagos | West Africa | Critical | Largest city in Africa; major KaiOS market |
| Nairobi | East Africa | Critical | Tech hub; large smartphone/KaiOS user base |
| Johannesburg | Southern Africa | High | Major internet exchange for sub-Saharan Africa |
| Accra | West Africa | High | Growing tech community; good internet backbone |
| Dar es Salaam | East Africa | Medium | Tanzania market; SEACOM undersea cable endpoint |
| Abidjan | West Africa | Medium | Francophone West Africa gateway |
| Mumbai | South Asia | High | India KaiOS market; BSNL 4G users |
| Delhi / Chennai | South Asia | High | Additional Indian market coverage |
| Cairo | North Africa | Medium | MENA gateway |

**CDN providers and their Africa coverage as of 2026:**

- **Cloudflare** — strongest Africa presence; PoPs in Lagos, Nairobi, Johannesburg, Accra, Cairo, and more. Free tier available but no-log policy requires Business plan ($200/month+). Excellent performance, highly recommended.
- **Bunny.net** — strong Africa coverage; Lagos and Nairobi PoPs. Significantly cheaper than Cloudflare (~€0.01/GB for Africa). No-log option available. Good choice for cost-sensitive early-stage.
- **Fastly** — excellent performance but limited Africa coverage. Not suitable as the primary CDN for this project.
- **AWS CloudFront** — has African edge in Cape Town and Johannesburg; Lagos added recently. Pricing higher for Africa egress (~$0.08/GB vs Bunny's ~€0.01/GB). Amazon retains logs by default — requires configuration to disable.
- **IPFS gateways (Cloudflare IPFS, Protocol Labs)** — emerging African IPFS gateway presence. Not yet reliable enough for production. Worth monitoring.

**Recommended for workpads:** Bunny.net as primary (cost-efficient, strong Africa PoPs, no-log configurable), Cloudflare as secondary/failover (wider Africa coverage, proven reliability). Multi-CDN ensures no single provider has the full picture of user activity.

---

#### Multi-CDN: distributing trust as well as load

Using two CDN providers simultaneously is standard practice for large-scale deployments (resilience, no single point of failure). For workpads, the privacy argument for multi-CDN is equally compelling: **no single CDN sees all user traffic.**

How it works:

The shell is configured to prefer CDN-A for module fetches. If CDN-A is unreachable or slow, it falls back to CDN-B, then to origin. Both CDNs serve the same content-addressed files (same URLs, same hashes, different host prefixes):

```
CDN-A: https://a.cdn.workpads.me/m/sha256-{hash}.bundle
CDN-B: https://b.cdn.workpads.me/m/sha256-{hash}.bundle
Origin fallback: https://origin.workpads.me/m/sha256-{hash}.bundle
```

CDN-A sees roughly half of all requests. CDN-B sees the other half. Neither sees the full picture. A subpoena of CDN-A yields an incomplete dataset — half the access events, no way to know which half. Correlation across both CDNs would require simultaneous legal action in two jurisdictions against two separate companies with different legal teams. The practical barrier to privacy violation is much higher.

As the project scales, a third CDN in a third jurisdiction extends this further. The content is identical everywhere (same immutable files); only the delivery path differs.

---

#### The manifest: the one mutable piece

All the content-addressed module files are immutable, but something needs to tell the shell which hash corresponds to which module ID. That something is the **manifest** — a small JSON document at a stable, predictable URL:

```json
{
  "v": "1.4",
  "bundle": "sha256-d5f1c82a0b3e",
  "modules": {
    "css": {
      "0": "sha256-a1b2c3d4e5f6",
      "1": "sha256-f6e5d4c3b2a1",
      "2": "sha256-1a2b3c4d5e6f",
      "3": "sha256-c9d8e7f6a5b4",
      "4": "sha256-b9e3a17f2c04",
      "5": "sha256-7f8e9d0c1b2a",
      "6": "sha256-3b4c5d6e7f8a"
    },
    "js": {
      "0": "sha256-9c8d7e6f5a4b",
      "1": "sha256-2e3f4a5b6c7d",
      "2": "sha256-8b9c0d1e2f3a"
    }
  }
}
```

The manifest lives at `/shell/manifest.json` with a short TTL — 1 hour. It is not content-addressed (it is intentionally mutable — it changes with each release). The shell caches it for 1 hour, then re-fetches. If it hasn't changed, the CDN returns a `304 Not Modified` with no body — essentially free.

The manifest is small enough (~300–500 bytes) that its privacy cost is trivial: the server sees "someone fetched manifest.json" — no record type inference possible.

**The manifest also enables module updates without shell code updates.** If a CSS module needs a patch, the developer publishes the new file (new hash), updates the manifest to point to the new hash, and within 1 hour all shells have the new module URL. No app update, no release cycle, no user action required.

---

#### Cache hierarchy: the full stack from CDN to device

Understanding the full cache hierarchy shows how few requests ever reach the workpads origin in a mature deployment:

```
Level 1 — Device browser/app cache (strongest privacy: no network request)
    TTL: 1 year for content-addressed modules; 1 hour for manifest
    Hit rate: high for repeat users (same shell version, same modules)
    If hit: zero network activity, zero server visibility

Level 2 — CDN edge node in user's region (Lagos, Nairobi, etc.)
    TTL: 1 year for content-addressed modules; 1 hour for manifest
    Hit rate: very high after first user in region fetches a module
    If hit: request stays within the region, workpads origin not contacted

Level 3 — CDN mid-tier / shield node (optional, CDN-internal)
    Some CDNs have a mid-tier layer that aggregates cache misses from multiple edge nodes
    before contacting origin. Reduces origin load by 10–100×.
    Workpads-invisible: handled entirely within CDN infrastructure.

Level 4 — Workpads origin server
    Only reached on true cache miss: new module version, new edge node, expired manifest
    In steady state: receives <1% of total user requests
    This is the only point where the workpads team has any visibility into traffic
```

For a user in Lagos opening their fifth workpads link this week: request resolved at Level 1 (device cache). No network. Workpads sees nothing.

For a user in a new region opening the first workpads link on a new shell version: resolved at Level 2 (CDN edge) for the manifest, then Level 2 again for the bundle. Workpads origin sees only the Level 4 cache misses (if any) — and only for a short window until the edge node has cached the module.

---

#### Bandwidth and cost at scale

Estimating what this infrastructure costs as the project grows:

**Assumptions:**
- 100,000 active users per month (early scale)
- Each user opens an average of 10 workpads links per month
- Bundle size: ~35KB
- Cache hit rate for bundle: 80% (device or CDN cache)
- 20% of sessions require a network bundle fetch

**Monthly bandwidth:**
```
Total link opens:      100,000 users × 10 links = 1,000,000 link opens
Bundle fetches needed: 1,000,000 × 20% = 200,000 fetches
Bundle data:           200,000 × 35KB = 7,000,000 KB = ~7 GB/month
Manifest fetches:      1,000,000 × 1 (one per session) × 0.5KB = ~500MB/month
Total CDN egress:      ~7.5 GB/month
```

**CDN cost at Bunny.net pricing (~€0.01/GB Africa egress):**
~€0.075/month at 100K users. Effectively free.

**At 1,000,000 active users:**
```
CDN egress: ~75 GB/month
Cost: ~€0.75/month
```

**At 10,000,000 active users:**
```
CDN egress: ~750 GB/month
Cost: ~€7.50/month
```

The economics are dramatic because content-addressed immutable files achieve extremely high cache hit rates. The CDN is doing nearly all the work; the origin is idle. Bandwidth costs scale sub-linearly with user growth because the cache hit rate improves as the user base grows (more users means higher probability the nearest edge node already has the bundle cached).

---

#### The IPFS horizon: removing the CDN itself from the picture

The CDN model replaces the workpads origin server with a global cache network. IPFS takes this one step further: it replaces the cache network itself with a peer-to-peer content network where the files are served by whoever has them — which could be other workpads users' devices.

**How IPFS works for this use case:**

Each module bundle is published to IPFS. IPFS generates a Content Identifier (CID) — a hash of the content in a self-describing multihash format:

```
QmXf7bR9... (IPFS CIDv1 of the module bundle)
```

This CID is functionally equivalent to the SHA-256 content address used above — just a different encoding. The shell can fetch the bundle via an IPFS gateway:

```
https://cloudflare-ipfs.com/ipfs/QmXf7bR9...
https://ipfs.io/ipfs/QmXf7bR9...
```

Or, in a native IPFS-aware environment, directly from the IPFS DHT without a gateway.

**The privacy advantage over CDN:**

A CDN edge node is operated by a company (Cloudflare, Bunny.net) that — however privacy-friendly — is a legal entity subject to court orders. IPFS retrieval from the DHT has no single operator. The content is served by whichever IPFS node has it and is closest. There is no company to subpoena.

**The local mesh advantage:**

On a local network — two workpads users in the same office, school, or household — if one device has cached the module bundle and has IPFS running, the second device can fetch the bundle directly from the first over WiFi. No internet required. No CDN involved. No server involved. The files propagate through the human network the same way workpads records do.

This maps perfectly to the workpads philosophy. In an area with poor internet connectivity but good local WiFi (a market, a workshop, a community centre), the module bundle becomes available to all devices the moment one device has fetched it.

**The practical path:**

IPFS as a primary delivery mechanism is not yet mature enough for a production service targeting KaiOS in 2026. Gateway reliability, latency, and KaiOS browser support are all limitations. The pragmatic path:

1. Now: CDN delivery with content-addressed URLs. CDN handles 99% of traffic.
2. Soon: Publish all module bundles to IPFS in parallel with CDN. Shell attempts IPFS gateway as secondary fallback.
3. Later: Native IPFS in-app (when workpads has a dedicated app binary, not just a shell page). App stores and serves the module bundle to the local mesh.
4. Long-term: IPFS becomes the primary delivery mechanism; CDN is a thin gateway layer for non-IPFS clients.

At each stage, the content-addressing is the same. The CID and the SHA-256 hash refer to the same bytes. The transition from CDN to IPFS is a delivery path change, not a content change.

---

#### What the workpads origin server becomes

In a mature CDN + IPFS deployment, the workpads origin server's role transforms entirely:

**What it stops doing:**
- Serving module files to users (CDN handles this)
- Seeing which module was fetched (CDN edge intercepts all requests)
- Accumulating user traffic logs (no user requests reach origin in steady state)

**What it continues doing:**
- Serving the shell HTML page (the generic `workpads.me/p` page) — this is lightweight and unavoidable
- Publishing new module versions to CDN origin
- Serving the manifest.json (with 1-hour TTL — CDN caches this too, origin sees only 1/CDN-cache-hit-ratio of manifest requests)
- Handling ephemeral capability token issuance (Note B, Technique 3) if implemented
- Serving any truly dynamic content (account management, if applicable in future)

**What it becomes:**
A publishing and orchestration server, not a delivery server. It produces content; it does not serve it to end users in the hot path. An outage of the workpads origin server does not prevent any user from opening any workpads link — the shell is cached, the modules are cached, the records are in the URL. The origin is out of the critical path entirely.

This is resilience as a privacy property. A server that cannot be pressured to reveal user data because it simply does not have any.

---

#### Subresource integrity as the final integrity layer

The content-addressed URL is an integrity check, but it requires the shell to implement the check (fetch the URL, compute the hash, compare). A complementary approach is **Subresource Integrity (SRI)** — a browser standard where the HTML can declare the expected hash of a fetched resource, and the browser enforces it automatically:

```html
<link rel="stylesheet"
      href="https://a.cdn.workpads.me/m/sha256-a3f7c94e.css"
      integrity="sha256-a3f7c94e...==">
```

If a CDN edge node (whether compromised, misconfigured, or legally compelled) serves a different file than expected, the browser detects the hash mismatch and refuses to apply the stylesheet. The tampered CSS is silently discarded. The user sees the page without styling rather than with malicious styling.

For dynamically-fetched resources (where the `<link>` tag is generated by JavaScript, not the HTML), SRI can be enforced via the `fetch()` API's integrity option:

```javascript
fetch(moduleUrl, {
  integrity: `sha256-${expectedHash}`
}).then(r => r.text()).then(css => applyCSS(css));
```

The codebook in the shell maps module ID → (URL, expectedHash). The shell knows the expected hash at compile time (it was hardcoded when the shell was built). Any CDN-level tampering is detected and rejected at the client.

Combined with the content-addressed URL (where the hash is in the URL itself), this creates two independent integrity checks. A tampered module must simultaneously appear at the correct content-addressed URL AND produce the correct hash — which is impossible if the content has been altered.

---

#### The full picture: a deployment diagram

```
                        ┌─────────────────┐
                        │  Developer's    │
                        │  workstation    │
                        └────────┬────────┘
                                 │ edits module, runs build
                                 ↓
                        ┌─────────────────┐
                        │  workpads CI/CD │
                        │  pipeline       │
                        │                 │
                        │  1. hash files  │
                        │  2. push to CDN │
                        │  3. push to IPFS│
                        │  4. update      │
                        │     manifest    │
                        └────────┬────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ↓                  ↓                   ↓
    ┌─────────────────┐  ┌─────────────┐   ┌─────────────────┐
    │  CDN-A (Bunny)  │  │ CDN-B (CF)  │   │  IPFS network   │
    │  Lagos PoP      │  │ Lagos PoP   │   │  (distributed)  │
    │  Nairobi PoP    │  │ Nairobi PoP │   │                 │
    │  Johannesburg   │  │ Joburg PoP  │   │                 │
    │  Mumbai PoP     │  │ Mumbai PoP  │   │                 │
    └────────┬────────┘  └──────┬──────┘   └────────┬────────┘
             │                  │                    │
             └──────────────────┴────────────────────┘
                                │
                    ┌───────────┴────────────┐
                    │     User's device      │
                    │  (KaiOS, 3G, Lagos)    │
                    │                        │
                    │  1. loads shell page   │
                    │  2. reads fragment     │
                    │  3. evaluates TRIG     │
                    │  4. fetches bundle     │◄── from nearest PoP
                    │     (if not cached)   │    or device cache
                    │  5. renders record     │
                    └────────────────────────┘

workpads origin server: only contacted by CDN for cache misses
                        never contacted by user devices directly
```

---

#### Summary and philosophy alignment

The CDN architecture described here is not conventional "put your files on a CDN for speed." It is a deliberate architectural choice that converts the infrastructure layer into an expression of the product's values:

- **No user knowledge accumulates at origin.** The origin publishes; the CDN delivers; the origin sees almost nothing. What it cannot see, it cannot leak or be compelled to reveal.
- **Content addresses are integrity guarantees.** The hash IS the file. A file that doesn't match its hash is not the file. No trusted authority needed — the math enforces integrity.
- **Immutability eliminates operational complexity.** No cache invalidation. No migration paths. No breaking changes for old shell versions. The past is preserved; the future is additive.
- **Geographic distribution is equity.** A user in Lagos deserves the same sub-100ms response time as a user in London. Edge nodes in Lagos are not a luxury — they are the design requirement.
- **Decentralisation is the long-term direction.** IPFS is the natural extension of content addressing into a world without servers. The CDN is a transitional structure that becomes unnecessary as the network of devices grows.
- **The server that knows nothing cannot betray anyone.** This is the strongest privacy guarantee available. Not encryption of what the server holds — elimination of what it holds in the first place.

**New checklist items for Part 10:**
- [ ] CDN provider selection: Bunny.net primary + Cloudflare secondary? Confirm Africa PoP coverage meets requirements.
- [ ] Multi-CDN: two providers from different jurisdictions confirmed as policy?
- [ ] Manifest TTL: 1 hour confirmed? Shorter (15 min) for faster module update propagation?
- [ ] SRI enforcement: hardcoded hashes in shell codebook, verified on every module fetch?
- [ ] IPFS parallel publishing: at which milestone does IPFS become a delivery path (not just a backup)?
- [ ] Log policy on CDN providers: confirm no-log setting is available and enabled at the chosen plan tier.
- [ ] Origin's role post-CDN: confirm origin is not in the hot path; only CI/CD pipeline touches origin for publishing.

---

## Session Notes — 2026-05-17 Decisions

### Decisions Made

**TRIG block placement → Option B (meta2 bit 5)**
TRIG is now a top-level block gated by meta2 bit 5 (`HAS_TRIG_BLOCK`), appearing after the participants block. No longer inside display_schema. display_flags2 bit 2 freed. This enables TRIG on any record type — chain records, State Commits, Markers — not just presentation records. FRAME-SPEC §2 and §13 updated.

**C-TRIG MODE bit (header byte bit 5)**
The TRIG header byte's bit 5 distinguishes display TRIG (MODE=0) from commitment C-TRIG (MODE=1). Both programs use the same block position (meta2 bit 5 → trig_block). One record can carry both by chaining trig_len+trig_bytes pairs. See AGREEMENTS-DESIGN.md §3 for C-TRIG instruction set.

**Condition registry extensions for C-TRIG**
Four new conditions added (codes 0x0C–0x0F): DATE_REACHED, ACK_RECEIVED, PAYMENT_CONFIRMED, MILESTONE_MET. These extend the existing 12-condition TRIG registry and are valid in both display TRIG (condition checks) and C-TRIG (obligation triggers).

**Markers TRIG integration**
TRIG programs in Markers (RATIFIED_FRAME records) use ROLE_TYPE conditions to show different views to each party at read time. Worker sees full financial detail; Client sees terms + amounts; unrecognised reader sees summary only. This is display TRIG (MODE=0), not C-TRIG.

**Anonymous mode TRIG constraints**
TRIG programs in DATA_SOURCE=11 (anonymous) records MUST NOT use identity-revealing conditions (HAS_PHONE not permitted — exposes receiver). Safe: IS_ORG, ROLE_TYPE, HAS_FINANCIAL_BLOCK, DATE_REACHED. ANON-MODE-DESIGN.md §7.

### Checklist Consolidation

The checklist items scattered across Notes A, B, C are consolidated here. Items already decided above are struck through.

**Evaluator architecture:**
- [ ] TRIG evaluator: stack machine, max depth 8, overflow → BLANK
- [x] Program length max: 20 bytes for display TRIG; 32 bytes for C-TRIG (decided 2026-05-17)
- [ ] Evaluator must be synchronous (no async during evaluation — conditions read from device state snapshot at eval start)
- [ ] Error handling: any malformed opcode or stack underflow → BLANK (fail-closed)
- [x] MODE bit in header byte (bit 5): 0=display, 1=commitment C-TRIG

**Frame integration:**
- [x] TRIG placement: meta2 bit 5 (HAS_TRIG_BLOCK), top-level block (OQ-32c resolved 2026-05-17)
- [x] display_flags2 bit 2 freed
- [ ] trig_len byte precedes trig_bytes; trig_len=0 = block present but program empty (SHOW_ALWAYS NATIVE default)
- [ ] Multiple programs in one block (chained trig_len+trig_bytes): define parsing loop terminator

**Pattern token table:**
- [ ] Final 12 pattern tokens locked (OQ-32 has the table; confirm against FRAME-SPEC)
- [ ] Pattern tokens 0x0–0x0B: high nibble=0x0 identifies single-byte pattern mode

**Condition system:**
- [ ] 12 base conditions (HAS_PHONE, IS_ORG, ROLE_TYPE_*, etc.) finalised in OQ-32
- [x] Extensions 0x0C–0x0F added (DATE_REACHED, ACK_RECEIVED, PAYMENT_CONFIRMED, MILESTONE_MET)
- [ ] Conditions are read from device state AT EVAL START (snapshot, not live)

**Display modes and CSS/JS codebook:**
- [ ] 8 display modes finalised (OQ-32)
- [ ] CSS codebook IDs 0–15 defined and documented in TECH-REFERENCE.md
- [ ] JS codebook IDs 0–15 defined
- [ ] Theme codebook IDs 0–15 defined

**Lazy loading (Note A decisions):**
- [ ] BASE bundle = shell + CARD_LIGHT only (~17KB); all other modules lazy-fetched
- [ ] HAS_CSS flag in TRIG triggers immediate pre-fetch of CSS module before rendering
- [ ] Module URL scheme: versioned by codebook-version + module ID
- [ ] Module cache: keyed by content hash, never expires

**Privacy / server (Note B decisions):**
- [ ] Bundle endpoint: single GET /shell/v1/bundle returns all CSS/JS; server cannot infer display mode
- [ ] Ephemeral capability tokens: in-memory only, deleted on use
- [ ] All module files content-addressed (SHA-256 hash in URL); immutable
- [ ] HTTP/2 server push: disabled (reveals which modules are needed)
- [ ] Forward secrecy: TLS 1.3 only on server connections

**CDN (Note C decisions):**
- [ ] CDN-A: Bunny.net (Africa/Asia PoP coverage); CDN-B: Cloudflare (secondary, different jurisdiction)
- [ ] Critical PoPs: Lagos, Nairobi, Johannesburg, Mumbai
- [ ] manifest.json TTL: 1 hour (reconsider 15 min for faster module propagation?)
- [ ] SRI: hardcoded hashes in shell codebook, verified on every module fetch
- [ ] IPFS: parallel publishing from v0.5; primary delivery path post-v1.0
- [ ] CDN log policy: no-log confirmed at chosen plan tier
- [ ] Origin not in hot path: CDN pulls from origin on cache miss only; users never contact origin

### Open Sub-Questions (OQ-32a, OQ-32b, C-TRIG)

- **OQ-32a**: BLOOM bit definitions versioned with TRIG VER or separate capability codebook version? Low priority for v1; can hardcode in v1.
- **OQ-32b**: EXTENDED opcode space (0xF_): reserve range for user-defined opcodes, or entirely for future spec revisions?
- **C-TRIG-1**: Multiple programs in one TRIG block — define the parsing terminator. Option: trig_len=0 as end marker after the last program.
- **C-TRIG-2**: Can a single frame carry both a display TRIG and a C-TRIG program simultaneously? Current answer: yes, via chained trig_len+trig_bytes pairs with different MODE bits. Confirm frame size budget allows this.
- **C-TRIG-3**: C-TRIG max program length 32 bytes — verify this is sufficient for a 5-milestone payment release sequence.
