---
name: ownerrez-higgsfield-video
description: Turn an OwnerRez property's photo gallery into a first-person walkthrough video with Higgsfield (Seedance 2.0). Walks the user through connecting their Higgsfield and OwnerRez accounts, pulls the gallery, plans a camera move for each chosen photo, generates clips inside a credit budget the user approves, reviews every clip for invented features, and stitches a finished MP4. Use when someone wants a listing video, property tour or walkthrough made from their OwnerRez photos, or asks to set up or connect Higgsfield for OwnerRez videos.
---

# OwnerRez → Higgsfield walkthrough video

Turns one OwnerRez property's photo gallery into a finished, silent 1080p walkthrough MP4. That
is the whole job. It does not publish anywhere, edit OwnerRez, or add music or text.

It works because of **frame choice, camera moves that stay inside each photo, and stopping for the
user at the right moments**. It does not work by generating everything and hoping for the best.

## Where things are

- Scripts: `${CLAUDE_SKILL_DIR}/scripts/`. If that variable is not expanded, they are in
  `.claude/skills/ownerrez-higgsfield-video/scripts/` in this repo.
- Run every script **from the repo root** (or whatever folder the user wants videos in). `.env` is
  read from there, and all output goes to `videos/<property>/` there.
- How to write camera moves and spot a bad clip: `references/camera-moves.md` next to this file.
  Read it before step 3.

## Rules that outrank everything else

1. **Never show a feature the property does not have.** No invented pools, hoods, windows, doors,
   balconies, views, rooms, furniture or beach access. A clip that invents one is rejected and
   regenerated or dropped. Never trim around it. Guests book on what the video shows.
2. **No credits spent without the user's explicit OK on a number.** Show the estimate, get a
   budget, and pass it as `--budget`. The script enforces it against the live balance.
3. **One test clip first.** Get the user's reaction to it before generating the rest.
4. **Never ask for a password or token in chat.** The user types OwnerRez credentials into `.env`
   in their own editor, and signs in to Higgsfield in their own browser. Claude cannot and must not
   complete either login for them.

## Step 1: Connect the accounts

Run the checker and go through whatever it reports, **one item at a time**, re-running it after
each fix:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/check-setup.mjs"
```

| Item | What to do |
|---|---|
| Node.js 18+ | User installs the LTS release from nodejs.org. |
| Higgsfield CLI | Ask, then run `npm install -g @higgsfield/cli`. |
| Higgsfield login | The user runs `! higgsfield auth login` at the Claude Code prompt. The `!` runs it in their session, and it opens their browser to sign in. When they say they are done, re-run the check: it shows the account email and credit balance. Confirm it is the account they meant. |
| Higgsfield credits | A 4s 1080p clip costs about 36 credits and a 5s clip about 45. A 7-clip video is roughly 260–300 credits, plus re-rolls. If they are short, they top up at higgsfield.ai. |
| ffmpeg | Windows `winget install Gyan.FFmpeg` (then open a new terminal). macOS `brew install ffmpeg`. Linux `sudo apt install ffmpeg`. |
| OwnerRez API (optional) | Copy `.env.example` to `.env` (you may do the copy). The user then fills in `OWNERREZ_USERNAME` (their OwnerRez login email) and `OWNERREZ_TOKEN` (a Personal Access Token they create in OwnerRez under Settings → API) **in their own editor**. Never have them paste it into chat. |

OwnerRez API access is optional. Without it, step 2 can read the gallery from the property's public
OwnerRez-hosted listing page. When the checker prints `READY`, move on.

## Step 2: Pick the property and pull the gallery

```bash
node "${CLAUDE_SKILL_DIR}/scripts/fetch-photos.mjs" --list                    # needs OwnerRez API
node "${CLAUDE_SKILL_DIR}/scripts/fetch-photos.mjs" --property <ownerrez id>
node "${CLAUDE_SKILL_DIR}/scripts/fetch-photos.mjs" --url <public listing page>
node "${CLAUDE_SKILL_DIR}/scripts/fetch-photos.mjs" --folder <dir> --name "<property name>"
```

- `--list` then `--property` is the normal route.
- If `--property` exits with HTTP 402, that account does not expose listing photos through the API.
  Ask for the property's public OwnerRez-hosted page URL and use `--url`.
- `--folder` is the last resort, for photos the user downloaded from OwnerRez themselves.

Output: `videos/<property>/photos/` (full-resolution originals), `previews/` (800px copies) and
`photos.json`.

## Step 3: Choose frames and plan the tour

1. **Look at every preview** with the Read tool. Group them by space. Drop floor plans, maps,
   aerials with arrows or graphics, photos with people, near-duplicates and close-up details.
2. For each space, pick **the single strongest frame**: wide, bright, and facing *into* the space
   so the camera has visible floor to travel over. Note what is actually in it. That list is what
   the camera move and the negatives are written against.
3. Order a route. Typically: exterior → living → kitchen → dining → best bedrooms → outdoor
   (balcony, pool) → the view or the beach as the finale. Aim for **6–9 beats**. This is a
   highlight reel, not a room inventory. Skip ordinary bathrooms and hallways.
4. Write `videos/<property>/plan.json`:

```json
{
  "property": "Seaside Retreat",
  "aspectRatio": "16:9",
  "beats": [
    {
      "slug": "exterior",
      "room": "Exterior",
      "photo": "photos/03-a1b2c3d4.jpg",
      "duration": 5,
      "cameraMove": "Very slow, shallow push straight forward along the paver walkway toward the base of the entry stairs, facade held centered, palms at both edges drifting gently past - no tilt, no pan, and the move stops well before the front door.",
      "negatives": "Do not add or alter any windows, doors, balconies or neighbouring buildings."
    }
  ]
}
```

- `photo` is relative to the plan file. `duration` is 4, or 5 for the opening and the finale.
- `aspectRatio` is `16:9` (the default) or `9:16` for a vertical cut.
- `negatives` names the specific things this room tempts the model to add. The script already adds
  a general "do not alter anything" clause to every prompt.

5. Price it and **show the user the plan**: a table of beat, room, photo and move, plus the total.
   Flag any beat you expect to be risky. Get their OK on the route and a credit budget.

```bash
node "${CLAUDE_SKILL_DIR}/scripts/generate-clips.mjs" --plan videos/<property>/plan.json --estimate
```

## Step 4: One test clip

Pick the strongest interior beat and generate only that one:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/generate-clips.mjs" --plan videos/<property>/plan.json --budget 45 --only <slug>
node "${CLAUDE_SKILL_DIR}/scripts/review.mjs" --plan videos/<property>/plan.json --clips <slug>
```

Review it (step 6), give the user the clip path to watch, and ask whether the pace and look are
right before spending the rest.

## Step 5: Generate the rest

```bash
node "${CLAUDE_SKILL_DIR}/scripts/generate-clips.mjs" --plan videos/<property>/plan.json --budget <approved credits>
```

It skips clips already generated, stops before exceeding the budget, spaces submissions 20s apart,
and records each clip in `clips/generated.json`. A failed beat is listed at the end. Re-running
retries only what is missing. Generation takes a few minutes per clip, so run it in the background
where you can.

## Step 6: Review every clip

```bash
node "${CLAUDE_SKILL_DIR}/scripts/review.mjs" --plan videos/<property>/plan.json
```

For each clip, Read `review/<clip>/compare.jpg`. Top-left is the source photo, and the other three
are frames at 5%, 50% and 96% of the clip. Compare them against the source, object by object:

- anything **added** (a sink, a vent hood, a window, a doorway, a railing, a second pool, a person)
- anything **removed or changed** (cabinet colour, a wall, the view out of a window)
- **warping**: bending door frames, melting furniture, rippling floor tiles
- the **end frame** especially: a push-in that goes too far invents what lies beyond the photo

Then record the decision:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/review.mjs" --plan videos/<property>/plan.json --approve <slug>,<slug>
node "${CLAUDE_SKILL_DIR}/scripts/review.mjs" --plan videos/<property>/plan.json --reject <slug> --reason "added a range hood"
```

To re-roll a rejected beat, first tighten its `cameraMove` (a shorter move, "near-static") and add
a named negative for what went wrong. Then tell the user the cost and run `generate-clips.mjs --only
<slug>` with a budget. After two failed re-rolls, drop the beat from the plan or pick a different
photo. When in doubt, reject: the user can always approve a clip you were unsure about. Show the
user the compare images for anything borderline.

## Step 7: Stitch and deliver

```bash
node "${CLAUDE_SKILL_DIR}/scripts/stitch.mjs" --plan videos/<property>/plan.json
```

It refuses to build while any clip is unreviewed. `--draft` builds a preview named `-DRAFT` that
must not be handed over as final. It normalises the clips, crossfades them, writes the MP4 and a
poster frame, and verifies codec, size and duration with ffprobe. It must print `verified`.

Give the user the full path to the finished `.mp4` and the poster. Tell them the clip count, the
length and the credits spent (`generated.json` has credits per clip). Delivery notes worth passing on:

- **Vrbo** accepts 1080p MP4, landscape or portrait, ideally under 60 seconds. Silent is safest,
  because unlicensed music gets videos rejected. Do not upscale to 4K.
- **Airbnb** does not host video on standard listings. Upload to YouTube or Vimeo (unlisted) and link it.
- OwnerRez itself can link a video URL on the listing. The user does that in OwnerRez.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Higgsfield CLI not found` after installing | Open a new terminal, or set `HIGGSFIELD_BIN` in `.env` to the `hf` binary inside `@higgsfield/cli/vendor/`. |
| Higgsfield calls fail with auth errors | `! higgsfield auth login` again. The token may have expired. |
| `ffmpeg not found` right after installing | Open a new terminal, or set `FFMPEG_BIN` and `FFPROBE_BIN` in `.env`. |
| OwnerRez 401/403 | Wrong email or a revoked token. Have the user make a new Personal Access Token. |
| OwnerRez 402 on `--property` | The account does not expose listing photos through the API. Use `--url`. |
| `STOPPING: next clip costs…` | The budget is used up. Ask before raising it. |
| `exists but has no generation record` | A file is sitting where a clip would go. Move it aside, then re-run. |
