---
id: gallery-sources-and-originals
title: "Three gallery sources (API, public page, folder); always full-resolution originals"
category: decision
status: active
tags: [ownerrez, input]
created: "2026-09-18T18:06:09"
updated: "2026-09-18T18:06:10"
---

<!-- compiled_truth -->
Galleries come from the OwnerRez API, a public OwnerRez-hosted listing page, or a local folder, and the full-resolution original of every photo is always used.

## Decision

`fetch-photos.mjs` supports three sources, in order of preference:

1. **OwnerRez v2 API** (`--list`, then `--property <id>`): read-only GETs with HTTP Basic auth (login email + personal access token). Optional.
2. **Public OwnerRez-hosted listing page** (`--url`): reads the page's JSON-LD `image` array as the ordered gallery; if absent, scans the HTML for OwnerRez photo URLs and warns that some may belong to other properties shown on the page.
3. **Local folder** (`--folder`, `--name`): last resort, for photos the user exported themselves.

Whatever the source, each photo is re-downloaded as the **untouched full-resolution original** (by its 32-hex photo id), never a sized variant, with retries. With ffmpeg present, 800 px previews are made for Claude to look at.

## Alternatives and why

- **API only.** Some accounts get **HTTP 402** from the listings endpoint (photos not exposed through the API); the public page covers them, and makes API access optional overall.
- **Thumbnails / sized variants.** Rejected: per the script, OwnerRez's sized variants are missing for a sizeable share of photos, and the video model needs every pixel of its start frame.

## Blast radius

Output is `videos/<property>/photos/`, `previews/` and `photos.json` (name, source, per-photo file, preview, id, caption), which the planning step reads.

Related: [[credentials-stay-with-the-user]].


## Timeline

- time: 2026-09-18T18:06:09
  kind: decision
  summary: "Created this page: Three gallery sources (API, public page, folder); always full-resolution originals"
  source: "scripts/fetch-photos.mjs, scripts/lib.mjs, README.md"
  affects: [gallery-sources-and-originals]

- time: 2026-09-18T18:06:10
  kind: decision
  summary: Seeded from repository contents during brain bootstrap
  source: "SKILL.md, references/, scripts/, README.md, git log"
  affects: [gallery-sources-and-originals]
