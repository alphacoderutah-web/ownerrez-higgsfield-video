---
slug: background
title: Project background
role: project background
updated: "2026-09-18T18:06:10"
---

# Project background

## Why

Vacation-rental listings sell on what guests see. A walkthrough video is more engaging than a photo gallery, but AI image-to-video models readily **invent** things that are not in the house: an extra window, a vent hood, a second pool. Guests book on what the video shows, so a flattering but false clip is worse than no clip.

This project is a Claude Code skill that turns one OwnerRez property's existing photo gallery into a short first-person walkthrough video with Higgsfield (Seedance 2.0) image-to-video. Its design is built around **accuracy, a spend limit the user approves, and stopping for the user at the right moments**, rather than generating everything and hoping for the best.

## Goals

- Produce one **finished, silent 1080p MP4** (optionally 9:16 vertical) plus a poster frame, verified with ffprobe.
- **Never show a feature the property does not have.** Every clip is reviewed against its source photo before it can be used (see [[review-gate-before-stitch]] and [[camera-moves-stay-inside-the-photo]]).
- **Never spend credits without the user's explicit OK on a number** (see [[credit-budget-hard-ceiling]]).
- Work for any OwnerRez host, with or without API access (see [[gallery-sources-and-originals]]).
- Keep account credentials entirely in the user's hands (see [[credentials-stay-with-the-user]]).

## Non-goals

- Publishing the video anywhere, or changing anything in OwnerRez. The skill only reads from OwnerRez; linking the video on a listing is left to the user.
- Music, voice-over, or on-screen text.
- A true one-take tour of the whole house. The camera-move reference says this cannot be built from stills; the result is short moves crossfaded so they *read* as continuous.
- Any affiliation with OwnerRez or Higgsfield. The README says it is independent and that users pay Higgsfield directly.

## Target user

Short-term-rental hosts and managers whose listings live in OwnerRez, who use Claude Code and have (or will create) a Higgsfield account with credits. They need no video-editing skills; Claude walks them through setup one item at a time.

**Open question:** the repo does not say how success is judged beyond a verified file and approved clips (for example, a target rejection rate or cost per video).
