# OwnerRez → Higgsfield walkthrough video

A [Claude Code](https://claude.com/claude-code) skill that turns an OwnerRez property's photo
gallery into a first-person walkthrough video, using [Higgsfield](https://higgsfield.ai)
(Seedance 2.0) image-to-video.

You pick a property. Claude pulls its gallery from OwnerRez, chooses the strongest photo for each
space, writes a camera move for each one, generates short clips inside a credit budget you approve,
checks every clip for anything the AI made up, and stitches the approved clips into one silent
1080p MP4.

That is all it does. It does not publish the video, change anything in OwnerRez, or add music or
text.

## What you need

- **Claude Code** ([install](https://docs.claude.com/en/docs/claude-code/overview))
- **A Higgsfield account with credits.** A 4-second 1080p clip costs about 36 credits and a
  5-second one about 45. A typical 7-clip video is roughly 260–300 credits, plus a few re-rolls.
- **An OwnerRez account.** API access (a Personal Access Token) is the easiest route, but the
  skill can also read the gallery from your property's public OwnerRez-hosted listing page.
- **Node.js 18+** and **ffmpeg**. The skill checks for both and tells you how to install them.

## Quick start

```bash
git clone https://github.com/YOUR-GITHUB-USER/ownerrez-higgsfield-video.git
cd ownerrez-higgsfield-video
claude
```

Then ask:

> Make a walkthrough video of one of my OwnerRez properties

or run `/ownerrez-higgsfield-video`.

The first time, Claude walks you through connecting everything:

1. Installing the Higgsfield CLI (`npm install -g @higgsfield/cli`).
2. Signing in to Higgsfield. You run `! higgsfield auth login`, and it opens your browser.
3. Installing ffmpeg if you don't have it.
4. Optionally, OwnerRez API access. You copy `.env.example` to `.env` and put in your OwnerRez
   login email and a Personal Access Token (OwnerRez → Settings → API).

You can check your setup at any time:

```bash
npm run check
```

## How a video gets made

1. **Gallery.** Downloads the full-resolution originals for the property you pick.
2. **Plan.** Claude looks at every photo, picks 6–9 beats (exterior → living → kitchen →
   bedrooms → outdoor → view), and writes a camera move for each one that stays inside what that
   photo shows. You see the plan and the credit estimate before anything is spent.
3. **Test clip.** It generates one clip first, so you can judge the look before paying for the rest.
4. **Generate.** It generates the remaining clips and stops before going over your budget.
5. **Review.** Each clip is compared frame by frame against its source photo. Clips that add a
   window, a vent hood, a second pool or anything else that is not really there are rejected and
   re-rolled or dropped.
6. **Stitch.** It crossfades the approved clips into one MP4 and a poster image, and verifies both.

Everything for a property lands in `videos/<property>/`. The finished file is
`videos/<property>/<property>-walkthrough-1080p.mp4`.

## Using it outside this folder

To have the skill available in any project, copy the skill folder into your personal skills:

```bash
cp -r .claude/skills/ownerrez-higgsfield-video ~/.claude/skills/
```

On Windows the destination is `%USERPROFILE%\.claude\skills\`. Your `.env` and the `videos/`
output are then read from, and written to, whichever folder you start Claude Code in.

## Your credentials

- Higgsfield: the CLI stores its own login on your machine. Nothing Higgsfield-related goes in
  this repo.
- OwnerRez: your token lives only in `.env`, which is git-ignored. The skill never asks you to
  paste it into chat and never prints it.

## Accuracy

AI video can invent things. This skill is built to catch that: every clip is reviewed against its
source photo, and nothing is stitched until it has been approved. Still, **you are responsible for
what your listing shows**. Watch the finished video before you publish it anywhere.

## Troubleshooting

See the table at the end of [`SKILL.md`](.claude/skills/ownerrez-higgsfield-video/SKILL.md#troubleshooting).
The most common cases:

- **`higgsfield` or `ffmpeg` not found right after installing.** Open a new terminal.
- **OwnerRez returns HTTP 402 for a property.** Your account does not expose listing photos
  through the API. Give Claude the public listing page URL instead.

## Not affiliated

This is an independent project. It is not made by, endorsed by or affiliated with OwnerRez or
Higgsfield. You pay Higgsfield directly for the credits it uses.

## License

MIT
