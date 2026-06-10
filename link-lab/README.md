# Workpads Link Lab (local)

Decode and test **real** `workpads.me/p#…` links in the browser using the same codec as the KaiOS app (`js/lib/codec.js` — pads-v1 `#1pa/`, `#1pb/`, `#1pf/`, legacy tags, `#1ps/` with passphrase).

## Run locally

From `repos/workpadskaios/`:

```bash
npm run link-lab
```

Open (server root is **`workpadskaios/`**, not `link-lab/` alone — so `js/lib/codec.js` resolves):

| URL | Role |
|---|---|
| http://localhost:8765/link-lab/ | Hub — paste a link, docs |
| http://localhost:8765/link-lab/p/ | Decode shell — paste fragment |
| http://localhost:8765/link-lab/round-trip.html | Decode → re-encode → field diff |
| http://localhost:8765/link-lab/template.html | 1pb / 1dt / `#t/` template |
| http://localhost:8765/link-lab/obligations.html | Open obligation walkthrough |
| http://localhost:8765/link-lab/ack-masks.html | Ack mask encode/verify |
| http://localhost:8765/link-lab/relational.html | Relational size compare |
| http://localhost:8765/link-lab/written-code.html | Short code alias registry |
| http://localhost:8765/link-lab/encode.html | JSON → tag |

### Test a link

1. Copy a share URL from the KaiOS app (or encode page).
2. Open `http://localhost:8765/link-lab/p/#1pa/…` (paste full URL in browser — hash is preserved).
3. Or paste on the hub and click **Open in shell**.

### Mimic `workpads.me/p`

Production: `https://workpads.me/p#1pa/<payload>`

Local shell: `http://localhost:8765/link-lab/p/#1pa/<payload>` (same fragment, different host).

If you see **WPCodec not loaded**, the server is probably rooted at `link-lab/` only — use `npm run link-lab` from `repos/workpadskaios/` (see `package.json`).

Set **Link base** on the shell page to preview the canonical URL string you will deploy.

## Deploy to workpads.me

Upload this folder (or `p/` + shared assets) to your host as named pages, e.g.:

- `workpads.me/p` → `p/index.html` (+ relative paths to scripts or a built bundle)
- `workpads.me/link-lab` → hub `index.html`

Ensure script paths resolve (adjust `../../js/lib/` if you flatten the tree).

## Codec authority

| Layer | File |
|---|---|
| **Fullest encoder today** | `workpadskaios/js/lib/codec.js` (this lab) |
| npm package | `workpads-codec` — subset; port per `CODEC-PORT-CHECKLIST.md` |
| **#1pv/** | Path C bridge in `codec.js` + `pathc-v2.js`; v0.4 ext flag `0x08` (relational/profile/symbol) |
| **Metrics** | `js/lib/compression-metrics.js` — `npm test` includes `compression-metrics.test.js` |

## Related docs

- `system/dev_refs/TAG-REFERENCE.md`
- `system/dev_daily/CODEC-PORT-CHECKLIST.md`
- `system/dev_refs/FRAME-SPEC-1pv-ADDENDUM.md`
