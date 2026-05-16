# TRIG — Deep Design Document

**Purpose:** A thinking document. Not a spec — the spec lives in OQ-32. This is the place to contemplate the abstract and specific details of creating TRIG before implementation begins: what kind of machine this actually is, why each design choice was made, what the failure modes look like, what the implementation challenges are on KaiOS specifically, and what remains genuinely open.

**As of:** 2026-05-16  
**Spec reference:** OPEN-QUESTIONS.md § OQ-32  
**Status:** Pre-implementation contemplation

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
