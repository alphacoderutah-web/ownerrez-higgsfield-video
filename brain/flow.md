---
slug: flow
title: Key flows
role: key flows
updated: "2026-09-18T18:06:10"
---

# Key flows

## End-to-end path of a typical request

"Make a walkthrough video of one of my OwnerRez properties":

```mermaid
sequenceDiagram
  participant U as User
  participant C as Claude (skill)
  participant S as Scripts
  participant O as OwnerRez
  participant H as Higgsfield
  C->>S: check-setup.mjs
  S-->>C: missing items, one at a time, until READY
  U->>H: Signs in via own browser (! higgsfield auth login)
  U->>U: Fills .env in own editor (optional API access)
  C->>S: fetch-photos.mjs --list, then --property (or --url / --folder)
  S->>O: GET listing photos (read-only)
  S-->>C: originals, 800px previews, photos.json
  C->>C: Read every preview, pick one frame per space, 6-9 beats
  C->>C: Write plan.json (camera move + negatives per beat)
  C->>S: generate-clips.mjs --estimate
  C-->>U: Plan table + credit estimate
  U-->>C: Approves route and a budget
  C->>S: generate-clips.mjs --only one beat (test clip)
  S->>H: upload photo, generate, wait, download
  C->>S: review.mjs (compare grid)
  C-->>U: Test clip to watch; OK to continue?
  C->>S: generate-clips.mjs --budget approved
  S->>H: Remaining beats, budget checked before each
  C->>S: review.mjs, then --approve / --reject per clip
  C->>S: stitch.mjs
  S-->>C: MP4 + poster, verified
  C-->>U: Paths, clip count, length, credits spent, delivery notes
```

## Other important flows

- **Re-roll a rejected clip.** Tighten the camera move (shorter, or near-static), add a named negative for what went wrong, tell the user the cost, regenerate that beat with a budget. After two failed re-rolls, drop the beat or choose another photo. See [[review-gate-before-stitch]].
- **API returns HTTP 402.** The account does not expose listing photos through the API; switch to the property's public OwnerRez-hosted page (`--url`). See [[gallery-sources-and-originals]].
- **Budget reached mid-run.** Generation stops with `STOPPING: next clip costs…`; Claude asks before any increase. See [[credit-budget-hard-ceiling]].
- **Draft preview.** `stitch.mjs --draft` includes unreviewed clips but names the file `-DRAFT`; it must not be handed over as final.
- **Delivery.** The skill passes on channel notes: Vrbo takes 1080p MP4 and silent is safest; Airbnb standard listings need an external video link; the OwnerRez listing link is set by the user.
