---
id: credit-budget-hard-ceiling
title: Credits are spent only within a user-approved budget enforced against the live balance
category: decision
status: active
tags: [spend, safeguard]
created: "2026-09-18T18:06:09"
updated: "2026-09-18T18:06:09"
---

<!-- compiled_truth -->
No Higgsfield credits are spent without the user's explicit OK on a number, and the script enforces that number against the live balance.

## Decision

- Claude shows the plan and an estimate (`generate-clips.mjs --estimate`) and gets a **credit budget** from the user before anything is generated.
- `generate-clips.mjs` **refuses to run without `--budget`**. Before every submission it reads the live account balance, computes what this run has spent, and stops (`STOPPING: next clip costs…`) rather than exceed the approved amount. A mid-run top-up is clamped so it never reads as negative spend.
- **One test clip first**, generated alone, so the user judges pace and look before the rest is spent.
- Per-clip cost is **asked of Higgsfield** for each duration and cached, not hardcoded, so the estimate tracks the provider's current pricing.
- Raising the budget, and each re-roll, needs the user's OK again.

## Supporting mechanics

- The plan is validated up front (slugs, photo paths, camera move present, duration 4 or 5) so a typo cannot surface halfway through a paid run.
- Already-generated beats (recorded job id + file) are skipped, so re-running retries only what is missing. A file without a generation record blocks that slot instead of being trusted or overwritten.
- Submissions are staggered (20 s apart) to stay clear of rate limits; a failed beat is recorded and skipped, and the script exits non-zero so nothing chained behind it stitches a partial set.
- Credits spent per clip are recorded in `generated.json` and reported at delivery.

## Rationale

Generation costs real money on the user's own account, and a loop can spend quickly. A hard ceiling checked against the live balance means an approval is a bound, not a guess.

Related: [[review-gate-before-stitch]].


## Timeline

- time: 2026-09-18T18:06:09
  kind: decision
  summary: "Created this page: Credits are spent only within a user-approved budget enforced against the live balance"
  source: "SKILL.md, scripts/generate-clips.mjs"
  affects: [credit-budget-hard-ceiling]

- time: 2026-09-18T18:06:09
  kind: decision
  summary: Seeded from repository contents during brain bootstrap
  source: "SKILL.md, references/, scripts/, README.md, git log"
  affects: [credit-budget-hard-ceiling]
