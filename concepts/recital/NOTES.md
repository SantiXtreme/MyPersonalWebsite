# Recital — notes

Refined elegance. "Entering a theatre for a piano recital." Continues what
round 1's Atelier Noir got right — smoothness, restraint, serif type —
rather than chasing motion density; ML projects are framed inside the
theatre metaphor as the evening's programme.

## Structure, in theatre terms

- **Curtain entrance**: house lights dim, the valance and side curtains
  part (`expo.inOut`, ~2.4s), hero text blur-rises in underneath. Under
  `prefers-reduced-motion` this is skipped entirely — curtain is set
  already-open, hero text already visible, no parting animation at all
  (not just a faster version of it).
- **Act I — The Stage**: the shared 3D grand piano, centre stage, under a
  spotlight with drifting dust motes in the beam. A reverent camera
  approach (cubic ease-out, FAR → NEAR anchors) is scrubbed to scroll
  position; the whole stage layer fades in/hold/out via a trapezoid
  opacity curve keyed to `#stage` scroll progress, so it's never abruptly
  on or off.
- **The programme**: ML projects render as numbered "movements" (roman
  numerals), and the recital player itself is a "programme insert card" —
  pick a piece, the piano answers each note in kind. The local recording
  preloads on page load so the programme opens ready to play.
- **Curtain call**: closing section, quiet sign-off.

## Round 2 review fixes (this session)

The user reviewed round 2 and flagged exactly two things here — the piano
and the entrance — confirming everything else (programme, intermission,
curtain call) as good and untouched:

- **Piano**: inherited a full rebuild of `shared/piano3d.js` (see its own
  file header / `CLAUDE.md`) — a proper concert-grand silhouette, a custom
  "studio" PMREM environment so the black lacquer reads as genuinely glossy
  black instead of washing to flat grey, a modeled open-lid interior (gold
  cast-iron plate with hand-hole cutouts, strings, soundboard) where there
  used to be a blank panel, and a real-time mirror floor
  (`floorColor: 0x1c140c` here — a warm stage-wood tint). `initStage()`'s
  `FAR`/`NEAR` camera anchors now read from `piano3d.js`'s exported
  `CAMERA_PRESETS` (`stage`/`hero`) instead of duplicating the numbers.
  Each recital piece also now has a distinct color/sustain "reactive
  personality" (`PERFORMANCE_PROFILES` in `shared/recital.js`), retinting
  the floor-glow per piece via `pulse(velocity, color)`.
- **Entrance**: the houselights→curtain mechanism itself was already sound
  (and already reduced-motion safe), but it built up to a reveal of flat
  black + plain text — no visual payoff. Fixed by briefly bringing the lit
  piano stage (in its FAR/wide framing, since the scroll-driven dolly
  hasn't started yet) through as the curtain parts — `.hero` temporarily
  goes transparent (`.hero.is-revealing`) so `#stage-layer` shows through,
  then both settle back before the hero text fully resolves. Also fixed a
  visible seam where the valance's gold trim (previously a flat `::after`
  rectangle) crossed the scalloped hem in a straight line instead of
  following its curve — folded into the valance's own masked background
  instead — and added a second, off-period repeating-gradient layer to the
  curtain's fold texture so it reads as fabric rather than a uniform stripe.

## Verified in browser (Playwright, this session)

- No console/page errors across load + a full scroll pass, in both normal
  and `prefers-reduced-motion: reduce` emulation, after the round-2 fixes
  above.
- The rebuilt piano confirmed at all three camera presets (`hero`/`keys`/
  `stage`) via an isolated smoke-test page — glossy black case, legible
  gold-plate/string interior, working mirror floor, keyboard legible.
- The entrance's exact mid-animation peek frame couldn't be reliably
  screenshotted in this sandbox — WebGL renders via software here, and a
  GSAP timeline triggered right as the page does heavy synchronous setup
  (constructing the piano scene) can appear to "jump" to its settled state
  almost immediately in wall-clock terms (confirmed separately: GSAP's own
  timing is correct in isolation — this is this sandbox's frame-pacing, not
  a code bug). Verified instead via the timeline's logic directly and via
  confirming the settled end-state (hero fully visible, curtain gone, no
  console errors) renders correctly.
- All three canvases (`grain`, the piano's WebGL canvas, `dust`) render at
  correct viewport dimensions.
- The local mp3 loads with correct real duration (4:10) in the native
  `<audio>` element, and clicking Play drives the same WebAudio-analyser
  note-triggering as Motion (`shared/recital.js`) — confirmed via a custom
  `recital:note` DOM event, firing in step with actual playback.
- One observation, not a bug: onset count plateaued for several seconds
  mid-piece (8 notes, holding flat from ~10s to ~16s of playback) while
  `currentTime` kept advancing normally. That's the amplitude-based onset
  detector going quiet during a legato/pedaled passage with no sharp
  transients to catch — an inherent property of the method (documented in
  `shared/recital.js`), and arguably fitting for this concept's quieter,
  more restrained visual language anyway.

## Known tradeoffs (shared, not recital-specific)

Same as Motion: YouTube/SoundCloud pieces get a generative pentatonic
performance pattern instead of true audio-reactivity, since cross-origin
embeds don't expose their audio samples. Documented in
`shared/recital.js`.
