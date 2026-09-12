# Choosing frames and writing camera moves

## The one constraint that decides everything

Image-to-video can only move the camera **through the space the photo already shows**. Ask it to
turn a corner, walk through a door or reveal the other side of a room, and it will invent that
space. Invented space is exactly where fake features come from: a vent hood the kitchen does not
have, a window that is not there, a second pool.

A true one-take tour of a whole house cannot be built from still photos. What you can build is a
series of short, believable moves, crossfaded so the result *reads* as continuous.

## Picking the frame for each space

Prefer, in order:

1. **Faces into the space**, with visible floor in the foreground for the camera to travel over.
2. **The far side is already in frame**: the back wall, the sliding doors, the view. Nothing has
   to be invented ahead of the lens.
3. **Bright, even daylight**, no blown-out windows, no heavy lens flare.
4. **Shows the selling point**: the ocean through the sliders, the pool and spa together, the
   open-plan kitchen.

Reject frames that are:

- flat against a wall (the camera has nowhere to go)
- aerial or top-down drone shots (nothing believable to move through)
- carrying arrows, text, logos or marker graphics burned into the image
- showing people
- close-ups, details or near-duplicates of a better shot
- mostly a neighbouring property

## Writing the move

A good move is **short, one direction, and stops early**. Name what stays in frame.

Pattern:

> Very slow, shallow dolly forward across the *[floor]* toward *[a thing clearly in frame]*,
> holding *[the anchor: doors, view, table]* centered, *[what drifts past the edges]* - no pan,
> no tilt, and the move stops well before *[the far object]*.

Good:

- "Very slow, shallow dolly straight forward across the tile floor toward the dining table,
  holding the chandelier and the sliding glass doors centered - the push stops well before the
  table, no pan, no tilt, and nothing new enters frame."
- "Very slow, shallow dolly forward along the balcony deck, tracking parallel to the railing, so
  the columns drift gently past and the ocean opens slightly wider on the right - no rotation, and
  the move stops well before the seating at the far end."
- "Very slow, shallow dolly forward along the boardwalk, rails staying just inside the left and
  right edges, ending well before the end of the visible decking so the ocean already in frame
  simply grows slightly larger."

Bad, and why:

- "The camera walks through the front door into the living room." The living room is not in
  the photo, so it will be invented.
- "Pan left to reveal the kitchen." Same problem: it reveals space that is off-frame.
- "Sweeping drone orbit around the house." It invents the sides and back of the building.
- "Push in toward the window and out onto the balcony." It goes past what the photo shows.

**Near-static fallback.** If a room keeps producing bad clips, ask for almost no motion: "The
camera holds the framing of the photograph and creeps forward an almost imperceptible amount.
Near-static shot." A beautiful still with slight life beats an inaccurate move.

## Negatives: name the temptation

The script adds a general "do not add or alter anything" clause to every prompt. The beat's own
`negatives` should name the specific thing *this* room tempts the model to add:

| Space | Typical negative |
|---|---|
| Kitchen with an over-range microwave | "This kitchen has an over-range microwave and no vent hood; do not add a range hood." |
| Clean island | "Keep the island countertop bare; do not add a sink or faucet." |
| Pool deck | "Do not add or remove any pool or spa, add water features, or change the fence line." |
| Exterior | "Do not add or alter windows, doors, balconies, fences, cars or neighbouring buildings." |
| Beach walkover | "Do not extend or alter the boardwalk, and do not add structures on the beach." |
| Room with shutters closed | "Keep the shutters closed; do not reveal a view through them." |

When a clip gets rejected, the reason becomes the new negative for the re-roll.

## Beats that fight you

- **Front door approach.** The model tends to drive into the garage or invent an entry. Use a
  frame that already faces the entrance, keep the move short, or skip the beat.
- **Mirrors and glass.** Reflections can come alive or change what they show. Keep the move tiny.
- **Small rooms.** There is too little depth to travel through. Near-static, or leave the room out.
- **Views through windows.** The model may "improve" the view. Name what is out there.

## Reading a review grid

Compare the source (top-left) with the three frames, object by object:

| You see | Fix |
|---|---|
| Something new appears (sink, hood, doorway, window, railing, person) | Reject. Add a named negative and shorten the move. |
| Something changes colour or shape | Reject. Say "keep exact colours and materials of X". |
| Bending door frames, rippling tiles, melting furniture | Reject. Use a slower, shorter move, or near-static. |
| Only the last frame goes wrong | The move is too long. End it earlier ("stops well before…"). |
| Shaky or wobbly motion | Use 5s instead of 4s, add "perfectly stabilized", and reduce the movement. |
| It looks like a different house | Wrong or ambiguous photo. Pick another frame. |

## Durations

4 seconds for normal beats, 5 for the opening establishing shot and the finale. At 0.5s crossfades,
seven 4–5 second beats make a video of about 25–30 seconds, which suits a listing.
