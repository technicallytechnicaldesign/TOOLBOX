# Hype Goblin

An animated CSS familiar who has opinions about your tolerances. He is the one
page on this workbench that computes nothing, which only works as a joke because
everything around him is load-bearing.

Everything lives in `index.html`. No dependencies, no build step, no network
calls, no persistence. It shares the site's `assets/theme.js`, `assets/menu.js`
and `assets/reveal.js` like every other section.

---

## What he does

Three sources of speech:

| Source | Trigger | Behaviour |
|---|---|---|
| **Buttons** | user clicks one of four moods | cuts in immediately, one line |
| **Ambient** | timer, 11 to 28s after he finishes | never interrupts; single line or a routine |
| **Poke** | user clicks the goblin himself | cuts in, escalates on repeat |

The ambient roll decides what kind of thing he says:

| Roll | Result |
|---|---|
| 0.2% | psychic damage (the rare tier) |
| 9% | a late-night line, **only between 01:00 and 05:00** |
| ~34% | a routine ("bit") |
| ~12% | an UNPROVOKED TOLERANCE SCREAM |
| rest | a single ambient line |

---

## The speech controller

The thing worth understanding before you touch anything.

**Every timer goes through `later()` into one `timers` list, and every callback
checks a run token.** `cancelSpeech()` bumps `runToken` and clears the list, so
any callback belonging to a superseded utterance bails out on entry.

This exists because of a real bug: the original prototype scheduled its
fade-out from *inside* the hold timeout and never tracked it, so a stale
fade could fire mid-sentence and yank the bubble away while he was still
talking. If you add anything time-based, use `later()` or you will
reintroduce it.

**Interruption policy is deliberately asymmetric:**

- a **button press or poke** cuts in immediately, because the user asked
- the **ambient timer never interrupts**. `runAmbient()` checks `holdUntil` and
  reschedules if he is still mid-sentence; `scheduleAmbient()` measures its gap
  from the *end* of the current utterance, not from now

**Poses are applied with `classList` add/remove, never by reassigning
`className`.** Wholesale reassignment would restart a sustained CSS animation on
every beat, so he would visibly re-start scribbling five times in one routine.

Timing:

```js
FADE_MS  = 950                                  // matches .bubble.fade's transition
beatHold = clamp(text.length * 70, 2500, 5200)  // one beat inside a routine
lineHold = clamp(text.length * 80, 5400, 13000) // a standalone line
```

---

## Three layers of animation

They compose, and they are cleaned up from three arrays at the top of the
controller. **Anything you add must be registered in the matching array** or it
will never get removed and will leak into the next utterance.

| Layer | Array | Lifetime | Examples |
|---|---|---|---|
| **Mood / tint** | `MOODS` | one utterance | recolours ears + head |
| **Expression** | `EXPRESSIONS` | one shot, 0.9 to 2.4s | `wink`, `bigeyes`, `cackle`, `clipboard-rage` |
| **Pose** | `BIT_STATES` | the whole routine | `scribbling`, `weeping`, `smug` |

Bubble variants (`scream`, `whisper`) are in `BUBBLE_STYLES` and cleaned the
same way.

**Moods** — four are driven by buttons, three exist only for routines:

`ambient` (green, default) · `hype` (green) · `reality` (amber) · `fix` (blue) ·
`destroy` (red) · `awe` (teal) · `grief` (blue-grey) · `gold` (amber-gold)

**Poses** — `holding` (clipboard out) · `scribbling` (+ pencil, head bobbed
down, ink filling the page) · `reading` (pupils tracking line to line) ·
`rapture` (bouncing, blush, staggered sparkles) · `muttering` (half-lidded,
slow sway) · `weeping` (tear rolls off his chin) · `measuring` (calipers, jaw
sliding) · `conspiracy` (leans in, eyes darting) · `smug` (leans back,
satisfied)

`holding` composes with others: `state: 'holding scribbling'`.

---

## Content

| Pool | Count | Register |
|---|---|---|
| `lines.ambient` | 104 | muttered unprompted; specific drawing crimes, observed with delight |
| `lines.hype` | 65 | the worst possible advice, delivered joyfully |
| `lines.reality` | 45 | the mode where he is right, still having a wonderful time |
| `lines.fix` | 45 | unhelpful, enthusiastic, occasionally accidentally correct |
| `lines.destroy` | 40 | every route by which the evidence survives deletion |
| `toleranceScreams` | 65 | drawing callouts that would end a career |
| `psychicDamage` | 30 | the 0.2% tier: quiet, personal, true |
| `nightLines` | 6 | 01:00 to 05:00 only |
| `pokeLines` | 22 | four escalation tiers |
| `BITS` | 29 routines / 115 beats | multi-beat, with a sustained pose |

**Tone.** A chaotic colleague who gives the worst advice and revels *joyously*
in the hacky shortcuts that actually make mech-eng and production design work.
He loves the horror of it. He is never sneering and never world-weary.

Two failure modes to avoid, both found in a previous audit:

1. **Generic where the good lines are specific.** The pool's best material names
   an actual crime ("somebody dimensioned to the edge of a fillet"), not a vague
   mood. If a line could apply to any part, it is not finished.
2. **Drift into sincere advice.** `fix` and `reality` accumulate lines that are
   just good engineering counsel, which kills the joke. He is meant to be
   confidently, delightedly wrong.

**`psychicDamage` lines must never also appear in `lines.ambient`.** The
original prototype had its one rare line in both pools, so the 0.2% gate did
nothing and the "secret" line fired constantly.

---

## Adding things

**A line** — push a string onto the pool. Nothing else to do.

**A routine:**

```js
{
  id: 'measure-crime',            // unique; used only for debugging
  state: 'measuring',             // space-separated poses, all in BIT_STATES
  mood: 'destroy',                // must be in MOODS
  bubbleClass: 'whisper',         // optional; must be in BUBBLE_STYLES
  rare: true,                     // optional; ~1/4 the normal frequency
  nightOnly: true,                // optional; only offered 01:00 to 05:00
  beats: [
    { text: "..." },                              // hold derived from length
    { text: "...", expression: 'cackle',          // optional one-shot
      hold: 4800 }                                // optional explicit ms
  ]
}
```

Put the punchline in the last beat and give it a longer `hold`; the routine
ends when its beats do.

**A pose:**

1. Add the class name to `BIT_STATES`.
2. Write the CSS in the "idle bits" block. Use `.goblin.<pose>.talking .head`
   to override the generic talk animation (higher specificity wins).
3. Add every new animated selector to the `prefers-reduced-motion` block, and
   give it a static fallback so the pose still *reads* when animation is off.
   `weeping` and `conspiracy` show the pattern: the tear holds visible, the
   lean holds leaning.

**A tint:** add the name to `MOODS` and write one rule setting the background on
`.goblin.<name> .ear, .goblin.<name> .head`.

---

## Easter eggs

Spoilers, kept here so they are not lost.

- **Poke him.** Clicking the goblin escalates through four tiers: startled (1-2),
  annoyed (3-5), resigned (6-9), devoted (10+). Each tier has its own lines and
  its own colour. The counter forgets after 60 quiet seconds, so the ladder is
  climbable again later. `pokeForgetTimer` is deliberately **not** in the
  `timers` list, because `cancelSpeech()` clears that on every utterance and the
  ladder has to survive him talking.
- **Small hours.** Between 01:00 and 05:00 local he unlocks `nightLines` and two
  night-only routines, one of which is also `rare`.
- **The rare routines** — `weep-tolerance`, `weep-deburr`, `conspiracy-supplier`,
  `latenight-2` — appear about a quarter as often as the rest.
- **`psychicDamage`** fires on 0.2% of ambient ticks. Most sessions never see one.

---

## Accessibility

- The bubble is `role="status"` `aria-live="polite"`, so his lines are announced.
  The goblin himself is `aria-hidden`; he is decoration, the bubble is the content.
- The poke target is a real `<button>` with an `aria-label`, not a click handler
  on the art, so it is keyboard reachable and skippable.
- `prefers-reduced-motion` stops every loop (float, halo, blink, and all nine
  poses) while keeping the poses legible as held positions. Nothing becomes
  unusable and no line becomes unreadable.
- He keeps a dark stage in both themes via `--stage-bg`, matching the site's
  convention for image viewports.
