---
id: credentials-stay-with-the-user
title: "Users enter all credentials themselves; never in chat, never printed, never committed"
category: decision
status: active
tags: [credentials, security]
created: "2026-09-18T18:06:09"
updated: "2026-09-18T18:06:10"
---

<!-- compiled_truth -->
The user enters every credential themselves, outside the chat; the skill never asks for, sees in chat, or prints a password or token.

## Decision

- **Higgsfield:** the user signs in by running `! higgsfield auth login` at the Claude Code prompt, which opens their own browser. The CLI stores its own login; nothing Higgsfield-related lives in the repo. The setup check then shows which account is signed in so the user can confirm it is the intended one.
- **OwnerRez (optional):** Claude may copy `.env.example` to `.env`, but the user types the login email and a personal access token into `.env` **in their own editor**. `.env` is git-ignored.
- `lib.mjs` loads `.env` without printing it; shell environment variables override the file. `check-setup.mjs` is read-only, spends nothing and never prints a token.
- Claude cannot and must not complete either login for the user.

## Alternatives rejected

- **Pasting a token or password into chat** — forbidden by the skill's top-priority rules.
- **Storing credentials in the repo** — excluded by `.gitignore` and the README.

## Rationale

The skill runs on the user's own accounts, one of which spends money. Keeping credentials out of the conversation and out of Git means neither the transcript nor a published fork can leak them.

Related: [[gallery-sources-and-originals]], [[credit-budget-hard-ceiling]].


## Timeline

- time: 2026-09-18T18:06:09
  kind: decision
  summary: "Created this page: Users enter all credentials themselves; never in chat, never printed, never committed"
  source: "SKILL.md, README.md, scripts/lib.mjs, .gitignore"
  affects: [credentials-stay-with-the-user]

- time: 2026-09-18T18:06:10
  kind: decision
  summary: Seeded from repository contents during brain bootstrap
  source: "SKILL.md, references/, scripts/, README.md, git log"
  affects: [credentials-stay-with-the-user]
