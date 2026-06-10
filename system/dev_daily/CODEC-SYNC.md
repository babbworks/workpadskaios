# Codec Sync — workpadskaios

_KaiOS-specific notes for keeping the inlined codec aligned with the ecosystem._

**Normative checklist:** [`workpads-standard/codec-sync.md`](../../../workpads-standard/codec-sync.md) — read and follow that document for any wire-format change.

**Process entry:** [`../project-process.md`](../project-process.md)

---

## Active wire format (2026-05-24)

| Item | Value |
|------|-------|
| Encode scheme (default) | `#1pv/` (Path C + native G0–G6 groups) |
| Encode scheme (legacy plain) | `#1pa/` (pads-v1, codebook `a`) |
| Compression | fflate `deflateSync` level 9, base64url |
| Normative spec | `workpads-standard/codec.md` v2.1 |
| KaiOS wire reference | `FRAME-SPEC.md` + `FRAME-SPEC-1pv-ADDENDUM.md` |
| Path C + native | `pathc-v2.js` → `native-groups-table.js` → `native-v1-split.js` → `pathc-native.js` → `codec.js` |
| Vectors regen | `node scripts/regen-1pv-vectors.js` |

Legacy decode-only tags remain in `js/lib/codec.js` for interoperability: `1ag/`, `1bg/`, `1cg/`, `1dg/`, `1eg/`, and `alg=bitpad-v1` query URLs. **Do not emit** legacy tags from new share paths.

---

## Codec copies

| Location | Role | Lines (approx.) |
|----------|------|-----------------|
| `workpads-standard/codec.md` | Normative spec | — |
| `workpads-codec/src/codec.js` | Canonical JS for npm / CLI | ~800 |
| `workpadskaios/js/lib/codec.js` | KaiOS runtime (UMD `WPCodec`) | ~1650 |
| `workpads-cli` | Consumes `@workpads/codec` | — |

**Change order:** standard → `workpads-codec` (tests pass) → port to `js/lib/codec.js` → `npm test` in this repo.

There is no automated diff between kaios and npm copies. Use `project-process.md` §8 commands after substantive edits.

---

## KaiOS-only encode paths

These are implemented in `js/lib/codec.js` but not necessarily in `@workpads/codec`:

| Feature | Tag / API | Documented in |
|---------|-----------|---------------|
| Presentation layer | `#1pb/`, `#1pf/` | `dev_refs/TAG-REFERENCE.md` |
| Security wrapper | `#1ps/` (+ passphrase) | `workpads-standard/security-wrapper.md` |
| Legacy codebooks | decode-only | DEV-WP-URL-001 (fixed) |

Records shared as plain `#1pa/` from CLI must decode in kaios without passphrase. Records using `#1ps/` require kaios share options.

---

## Sync checklist (short)

After any codec change:

1. Update `workpads-standard/codec.md` (and SUI if needed).
2. Update `workpads-codec` — run `node test/codec.test.js`.
3. Port to `workpadskaios/js/lib/codec.js`.
4. Run `npm test` in workpadskaios.
5. Update `DEVIATIONS.md` only if app behaviour intentionally diverges.
6. Refresh snapshot in `project-process.md` §7 if cross-repo state changed.

---

## Historical note

Pre–pads-v1 docs in `dev_daily/Archive/` (codec rounds 01–14, old `1eg/` vs `1dg/` notes) describe superseded generations. **Do not use** archived round docs as current wire truth.
