---
id: camera-moves-stay-inside-the-photo
title: Camera moves stay inside the space the photo shows
category: concept
status: active
tags: [accuracy, prompting]
created: "2026-09-18T18:06:09"
updated: "2026-09-18T18:06:09"
---

<!-- compiled_truth -->
Image-to-video can only move the camera through space the photo already shows; asking it to go further is how invented features appear.

## Definition

The governing constraint of the whole skill (from `references/camera-moves.md`): a start frame contains a fixed amount of real space. Any move that turns a corner, walks through a door, pans to reveal off-frame space or pushes past the far wall forces the model to **invent** what lies beyond, and invented space is where fake windows, hoods and pools come from.

## How it shapes the design

- **Frame choice.** Prefer frames that face *into* the space with visible floor to travel over, with the far side already in frame, in even daylight, showing the selling point. Reject wall-flat shots, aerials, images with burned-in graphics, people, close-ups and near-duplicates.
- **Move pattern.** Short, one direction, stops early, names what stays in frame: a very slow, shallow dolly toward something clearly visible, no pan or tilt, ending well before the far object.
- **Negatives name the temptation.** The script adds a general preservation clause to every prompt; each beat's `negatives` names what *that* room tempts the model to add (for example a range hood over a kitchen that has a microwave). A rejection reason becomes the next negative.
- **Near-static fallback.** If a room keeps failing, ask for almost no motion. A still with slight life beats an inaccurate move.
- **Durations.** 4 s for normal beats, 5 s for the opening and finale; 0.5 s crossfades make a video of roughly half a minute from about seven beats.

## Boundaries and counter-examples

- A whole-house one-take tour **cannot** be built from stills; the output is a series of believable short moves crossfaded to *read* as continuous.
- Known trouble spots: front-door approaches, mirrors and glass, small rooms, views through windows.

Related: [[review-gate-before-stitch]] (catching what slips through).


## Timeline

- time: 2026-09-18T18:06:09
  kind: decision
  summary: "Created this page: Camera moves stay inside the space the photo shows"
  source: "references/camera-moves.md, scripts/generate-clips.mjs"
  affects: [camera-moves-stay-inside-the-photo]

- time: 2026-09-18T18:06:09
  kind: decision
  summary: Seeded from repository contents during brain bootstrap
  source: "SKILL.md, references/, scripts/, README.md, git log"
  affects: [camera-moves-stay-inside-the-photo]
