# Process animation

Scroll-driven particle animation for the website's client process section.

Open `index.html` in a browser and scroll to see it.

## Order

| Position | Eyebrow | Stage | Shape |
|---|---|---|---|
| 0 | What you get | Running and maintained | All four shapes together: Sound, Control, System, Team |
| 1 | Where most start | Tangled | Scattered dashes |
| 2 | 01 | Questionnaire | Voice waveform (approved) |
| 3 | 02 | Audit | Wall of level meters (approved) |
| 4 | 03 | Build | Signal figure locking in (**placeholder, not final**) |
| 5 | 04 | Train | Ripples spreading out (approved) |
| 6 | 05 | Running and maintained | Same as position 0 |

The page opens on the finished system so the client sees the end result first,
then it breaks apart into the tangle and the stages rebuild it.

## How it works

- 150 short dashes. Every formation is a function returning `[x, y, angle, length, alpha]` for each dash.
- Scroll position (0 to 6) picks the two formations to blend and how far between them. No timers drive the story, so scrolling back up reverses cleanly.
- Step five uses all 150 dashes: 40 sound, 36 control, 40 system, 34 team. Dashes shorter than 4px or nearly transparent are not drawn, so no stray dots.
- `prefers-reduced-motion` freezes the looping motion inside each shape.

## Colours

Matched by eye to the gold stage reference image. Swap for exact values if the designer has them.

| Use | Hex |
|---|---|
| Background | `#0E0E10` |
| Lines | `#E2C68E` |
| Glow | `#F2B85F` |
| Headings | `#F2F2F4` |
| Eyebrow labels | `#9A9AA0` |

## Open decisions

- Build (03) shape is still undecided.
- Where the hero line sits: over the opening "What you get" picture is the current suggestion.
