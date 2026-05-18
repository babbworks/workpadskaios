# Attachment and Image Quality Design

**Status:** design — 2026-05-17
**Depends on:** FRAME-SPEC.md (FLAGS3 bit 4), TRIG-DESIGN.md (CDN delivery)
**Maturity:** notes → **design** → draft-spec → spec → standard-doc

---

## 1. Philosophy: Early Internet / MMS-Era Progressive Delivery

The guiding philosophy for workpads attachments: **images should feel like the early internet and MMS phones felt** — fast, low-overhead, surprisingly usable on constrained connections. Not "mobile-first" in the modern bloated sense, but genuinely 2G-viable.

Core principles:
1. Something displays immediately (Tier 0 inline thumbnail — no network call)
2. Useful quality appears fast on any connection (Tier 1 in under 3 seconds on EDGE)
3. Full quality only when explicitly requested (Tier 2–3 on demand)
4. The wire frame is not bloated by images — the frame carries a REFERENCE, not the image bytes

This mirrors how early WAP / i-mode / MMS applications worked: thumbnails were embedded in the message; higher quality required an explicit fetch. The user saw something immediately and decided whether to download more.

---

## 2. Tier Architecture

```
TIER 0: Inline thumbnail (embedded in frame)
   ├── ~20–80 bytes, encoded as base64 within the attachment field URL
   ├── Displayed immediately from the frame — zero network calls
   └── BlurHash-style or quantized micro-thumbnail (8×8 to 16×16 pixels)

TIER 1: Low resolution (server / CDN fetch)
   ├── 320×240 pixels, JPEG quality 40–50
   ├── Target: 8–20 KB
   ├── Viable on 2G/EDGE (3-second load at 56 kbps)
   └── Sufficient for: job completion proof, receipt photo, signature scan

TIER 2: Medium resolution
   ├── 800×600 pixels, JPEG quality 65
   ├── Target: 60–120 KB
   ├── Viable on 3G (3-second load at 384 kbps)
   └── Good for: detailed damage photos, document scans, technical drawings

TIER 3: Full resolution
   ├── Original dimensions, original quality
   ├── Size: whatever the camera produced
   ├── Fetch on explicit user request only
   └── Use case: archival, print, legal evidence

```

---

## 3. Inline Thumbnail Encoding (Tier 0)

The attachment field (FLAGS3 bit 4) is a text field with `[u16 len][UTF-8]`, max 500B. For Tier 0, a micro-thumbnail is encoded directly in the URL string using a compact representation.

### Option A: BlurHash / ThumbHash (recommended)

BlurHash encodes a very low-resolution blur preview as a short ASCII string (~20–30 characters). ThumbHash is a newer variant that preserves more detail in ~28 bytes.

```
attachment field value:
  "t0:eW4KHW4OKS4RK_z5TW|W4Wq|:https://workpads.me/a/sha256:abc123"
   ^^^^^^^^^^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   ThumbHash base64 (28 bytes)  full-res URL (content-addressed)
```

Prefix `t0:` identifies the Tier 0 encoding. The app parser splits on `:` to extract the thumbnail and the full URL. The thumbnail is decoded and rendered immediately as a blurred colour preview.

**ThumbHash properties:**
- ~28 bytes ASCII-encoded
- Decodes to a coloured blur that approximates the image subject
- Looks like early digital camera preview screens
- Zero network latency — in the frame, always present

### Option B: Quantized micro-thumbnail

A 4×4 or 8×8 pixel image, quantized to 64 or 256 colours, encoded as hex or base85.

```
4×4 at 64 colours = 16 pixels × 6 bits = 96 bits = 12 bytes = 16 hex chars
8×8 at 256 colours = 64 pixels × 8 bits = 64 bytes = 86 base64 chars
```

8×8 at 256 colours in base64 = 86 chars, fitting within 500B. Decoder scales to display size using nearest-neighbour (gives the blocky pixel aesthetic that mirrors early MMS era).

**This aesthetic is intentional.** On a KaiOS 240×320 screen, a blocky 8×8 thumbnail scaled to 80×80 pixels looks like a mobile phone photo circa 2003. This is not a compromise — it's a design language that communicates "this is a field photo, not a polished asset." It fits the workpads visual identity.

### Attachment field URL format

```
"t0:<thumbhash>:<content_url>[?t=<available_tiers>]"
```

- `t0:` — Tier 0 prefix (inline thumbnail follows)
- `<thumbhash>` — ThumbHash or quantized micro-thumbnail string
- `:` — separator
- `<content_url>` — full content URL
- `?t=123` — optional: which tiers are available (1=Tier1, 2=Tier2, 3=Tier3; combined e.g. `t=13` = tiers 1 and 3 available, not 2)

When no Tier 0 available (legacy attachments): field value is just the content URL with no `t0:` prefix.

---

## 4. Content URL Formats

Three valid content URL formats in the attachment field:

### Workpads CDN (primary)
```
https://workpads.me/a/<sha256hash>
```
Content-addressed, immutable, served from edge CDN. The SHA-256 hash is the identity. Any node holding the content can serve it. Tier routing: CDN returns Tier 1 by default; `?q=2` or `?q=3` for higher quality.

### IPFS (decentralised long-term)
```
ipfs://bafybei<CID>
```
IPFS CID of the full-res image. Gateways: `https://ipfs.io/ipfs/<CID>` or local IPFS node. Tier 1 would need a separate CID for the resized version, or the client resizes after fetch.

### Bare hash (reference only)
```
sha256:<hex_hash>
```
Just the hash — no URL. The receiver fetches from whatever source they have. Useful for offline records where the image is in local storage keyed by hash.

---

## 5. Image Capture and Processing Pipeline (App-Side)

When a user attaches a photo in the workpads app:

```
1. CAPTURE
   Camera API → raw JPEG buffer

2. PROCESS
   a. Generate ThumbHash from raw buffer (~50ms on KaiOS)
   b. Resize to 320×240, JPEG Q40 → Tier 1 buffer
   c. Resize to 800×600, JPEG Q65 → Tier 2 buffer
   d. Compute SHA-256 of original → content hash

3. ENCODE IN FRAME
   attachment field = "t0:<thumbhash>:<CDN_URL>?t=123"
   ThumbHash is embedded NOW — frame is self-contained for display

4. UPLOAD (when connected)
   POST /upload with [hash, tier1_bytes, tier2_bytes, tier3_bytes]
   Server stores all tiers, CDN distributes
   Upload can be deferred — frame is already shareable with Tier 0 from step 3

5. DISPLAY
   Immediate: render ThumbHash
   On open: fetch Tier 1 (default)
   On expand: fetch Tier 2 or 3 on user tap
```

**Offline-first implication:** a record with a photo attachment can be shared and displayed with Tier 0 preview BEFORE the upload completes. The receiver sees a blurred preview immediately. Tier 1 becomes available after the sender's next sync window.

---

## 6. KaiOS-Specific Constraints

| Constraint | Impact | Design response |
|------------|--------|-----------------|
| Screen: 240×320 px | Tier 1 (320×240) is full-screen quality | No need for Tier 2 on KaiOS cards view |
| RAM: 256MB typical | Cannot hold >1 full-res image in memory | Never auto-load Tier 3; explicit tap required |
| 2G/EDGE common | 56 kbps in rural areas | Tier 1 at 10–20KB loads in <3s on EDGE |
| Camera: 2–5MP typical | Original image 500KB–2MB | Tier 1 at 320px = ~90% size reduction |
| No WebP support (older KaiOS) | JPEG only for compatibility | All tiers encoded as JPEG |
| Limited local storage | Cannot cache all images | LRU cache with 10MB limit; Tier 0 always cached (in frame) |

---

## 7. Privacy Considerations for Photo Attachments

Photos taken on-site may contain:
- Location metadata (EXIF GPS coordinates)
- People (faces, bystanders)
- Sensitive business information (price boards, internal documents)

**EXIF stripping:** app strips all EXIF metadata before upload. GPS coordinates, device model, and timestamp are removed. Only image pixel data is retained.

**Face blurring (post-MVP):** automatic face detection + Gaussian blur on upload. Can be toggled off for explicit portrait records (contact photos).

**Attachment visibility in URL:** the attachment URL (content hash) is visible in plain `#1pa` records. An observer with the URL can fetch the image from the CDN. For sensitive attachments:
- Use `#1ps/` encrypted records — the attachment URL is inside the encrypted payload
- Or use a tokenised CDN URL (server generates a time-limited signed URL, not the raw hash)

---

## 8. Multi-Image Support

FLAGS3 bit 4 supports a single attachment field. For records needing multiple photos (e.g., before/after, site documentation):

**Option A: comma-separated in the attachment field** (same pattern as multi-tag)
```
"t0:<thumb1>:<url1>,t0:<thumb2>:<url2>"
```
Up to 500B allows approximately 2–3 URLs with ThumbHashes.

**Option B: compound block for media records** — `BASE_TEMPLATE=100` (Document/media) uses compound lines where each line is a media attachment. More structured, allows per-image captions.

**Option C: FLAGS4 media slot** — a second attachment field for the second image. Simple, no compound overhead.

MVP: Option A (comma-separated, up to ~3 images). Post-MVP: Option B for formal site documentation records.

---

## 9. Video and Audio (Future)

The same tier architecture applies:
- **Audio (voice memos):** Tier 0 = waveform thumbnail (amplitude bars encoded as compact byte array); Tier 1 = 8kbps Opus/AMR-NB (~10KB/min) — MMS-era quality; Tier 2 = 32kbps Opus; Tier 3 = original
- **Video:** Tier 0 = keyframe thumbnail (first frame ThumbHash); Tier 1 = 240p, 100kbps (~750KB/min) — early YouTube quality; higher tiers on demand

KaiOS has AMR-NB audio codec support. Tier 1 audio at 8kbps fits comfortably in low-bandwidth environments and is the natural starting point.

---

## 10. Open Design Questions

- **OQ-AT1** — ThumbHash vs quantized grid: ThumbHash requires a library (~3KB JS). Quantized micro-thumbnail requires no library. For KaiOS memory constraints, the no-library option may be preferable. Evaluate both.
- **OQ-AT2** — Tier 0 in frame vs separate: embedding ThumbHash in the attachment URL field uses ~40 of the 500B budget per image. Is 500B enough for 2 images with ThumbHashes? (Likely yes for typical URLs; test needed.)
- **OQ-AT3** — CDN tier routing: does the CDN serve multiple quality tiers from the same hash URL (with `?q=` parameter), or are Tier 1/2 separate content-addressed objects with their own hashes?
- **OQ-AT4** — Offline upload deferral: should the frame be transmitted with `?t=0` (Tier 0 only available) before upload, then updated to `?t=0123` after upload? This requires the attachment field to be mutable post-encoding, which conflicts with the immutable frame design.
- **OQ-AT5** — NTAG213 image storage: a 144-byte NFC Marker could optionally carry a Tier 0 thumbnail of the subject matter (e.g., a photo of the completed work). 40 bytes of ThumbHash leaves 104 bytes for the agreement frame — workable at Tier 1.
