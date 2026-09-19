---
id: review-gate-before-stitch
title: "Every clip is reviewed against its source photo; stitch refuses unreviewed clips"
category: decision
status: active
tags: [accuracy, review]
created: "2026-09-18T18:06:09"
updated: "2026-09-18T18:06:09"
---

<!-- compiled_truth -->
No clip reaches the final video until it has been compared with its source photo and explicitly approved; the stitcher enforces this.

## Decision

- `review.mjs` stages every unapproved clip as a **2x2 compare grid**: source photo top-left, then frames at 5 %, 50 % and 96 % of the clip. Frames are proportional to real clip length; the last sits at 96 % because the end of a push-in is where a widened field of view invents the most.
- Claude checks each grid object by object for anything **added**, **removed or changed**, and **warping**, with special attention to the end frame. "When in doubt, reject" — the user can still approve a borderline clip after seeing its grid.
- Approval is stored against the Higgsfield **job id** in `clips/generated.json`. Rejecting moves the clip to `clips/rejected/` with a reason in `rejected.json` and clears its record, so a regenerated clip always starts unapproved.
- Batch approve/reject checks every named clip first and changes nothing if any is missing, so a half-applied decision cannot happen.
- `stitch.mjs` **refuses** to build the final video while any included clip is unreviewed. `--draft` builds a preview, but the file is named `-DRAFT` and must not be delivered as final.
- After encoding, the stitcher **proves the file** with ffprobe (codec, dimensions, duration against the expected crossfaded length) and prints `verified` only if all match.

## Alternatives rejected

- **Trim around a bad moment.** Explicitly forbidden in `SKILL.md`: a clip that invents a feature is rejected and re-rolled or dropped, never trimmed.
- **Trust generation output.** A code comment in `stitch.mjs` estimates that roughly every other AI clip invents something, which is why review is mandatory rather than spot-checked.

## Rationale

Guests book on what the video shows, and the README makes the user responsible for their listing; the gate keeps an invented feature from reaching a finished file.

## Re-roll policy

Tighten the move, add a named negative, state the cost, regenerate with a budget; after two failed re-rolls drop the beat or pick another photo ([[camera-moves-stay-inside-the-photo]], [[credit-budget-hard-ceiling]]).


## Timeline

- time: 2026-09-18T18:06:09
  kind: decision
  summary: "Created this page: Every clip is reviewed against its source photo; stitch refuses unreviewed clips"
  source: "SKILL.md, scripts/review.mjs, scripts/stitch.mjs"
  affects: [review-gate-before-stitch]

- time: 2026-09-18T18:06:09
  kind: decision
  summary: Seeded from repository contents during brain bootstrap
  source: "SKILL.md, references/, scripts/, README.md, git log"
  affects: [review-gate-before-stitch]
