# Motion — notes

Scroll spectacle, rebuilt a second time after the user reviewed round 2's
first pass. The brief for this rebuild: Elden-Ring-rooted atmosphere (golden
Site-of-Grace sigils, foggy ruin-dusk palette, drifting embers) reimagined
as an original WebGL portfolio piece — not a literal reskin — with
genuinely spectacular, *distinct-per-section* mouse reactivity (the first
pass only had one generic cursor glow, same as round 1), full freedom to
pull in whatever else fit, and at least one polished minigame kept.

## What changed from the first pass

- The 2D canvas flow-field (purple/teal/gold aurora — unrelated to Elden
  Ring, and only one undifferentiated cursor glow) is gone. In its place:
  `scene3d.js`, one persistent Three.js GPU particle system (embers / ash /
  dust / leaves depending on the active scene) plus `UnrealBloomPass`, so
  bright accents get real light bloom instead of CSS radial-gradients.
- Cursor reactivity is now spectacular *and* distinct per section, but
  still one cohesive system rather than five bolted-on gimmicks: the same
  particle field's per-scene `cursorForce` covers an ember trail (hero), a
  dust stir (recital/cadenza), leaf scatter (hobbies), and ember gathering
  toward the sigil (contact) — see `SCENES` in `scene3d.js`. Two sections
  get an additional lightweight DOM-only touch because a discrete effect
  suited them better: a torchlight cursor reveal over the project cards
  (`#torch`), and a rune "grace sigil" (an SVG evoking, not reproducing, the
  reference Site-of-Grace icon) that trails the cursor on contact with an
  elastic lag.
- The shared piano inherited a full rebuild (see `shared/piano3d.js` /
  `CLAUDE.md`) — glossy black lacquer that actually reads black, a modeled
  gold-plate/string/soundboard interior, and a real-time mirror floor
  (`floorColor: 0x0d1013` here — a cool wet-dark-stone tint, distinct from
  recital's warm wood). Camera anchors now come from `piano3d.js`'s
  exported `CAMERA_PRESETS` instead of duplicated numbers.
- Cadenza (the falling-notes minigame) keeps its original mechanics —
  they were already solid — re-skinned to the gold/rune palette (rune-tablet
  hit targets, four gold/sky/violet/rose lanes) and now drives
  `field.burst()` at the hit position on every hit instead of a separate
  canvas-only spark system.
- Each recital piece now has a distinct color/sustain/velocity "reactive
  personality" (`PERFORMANCE_PROFILES` in `shared/recital.js`), flowing
  through into the piano's key-hold time, the accent point-light color, and
  the field burst color on every note.
- Lenis + ScrollTrigger scroll mechanics (numeric-eased scrub, `once: true`
  fixed reveals) are unchanged from the first pass — that's the proven
  round-1 fix and wasn't part of what needed rebuilding.

## A bug caught and fixed during this rebuild

The first draft of the piano's scroll-dolly (`applyDolly` in `main.js`)
carried over the old version's `piano.root.position.y` "sink while far,
rise as it nears" shift. That shift was tuned against the *old* (wider)
camera presets; against the rebuilt piano's new, closer "keys legible"
framing, the same absolute shift put the camera at an absurdly
close/broken-looking angle during the recital section. Fixed by dropping
the root-position shift entirely (the position/look-at dolly alone gives a
perfectly good approach without it) — confirmed via direct inspection of
`piano.camera.position`/`root.position` at the recital scroll position
after the fix (exactly `CAMERA_PRESETS.hero`, root at origin, as expected).

A second bug: the piano stage was still visible after scrolling past
Cadenza into Hobbies (its fade-out `ScrollTrigger` uses `#cadenza` as an
`endTrigger`, which apparently had a stale cached boundary from before
web fonts finished loading). Fixed by adding a
`document.fonts.ready.then(() => ScrollTrigger.refresh())` call (recital
already had this; motion didn't) — confirmed fixed via re-screenshotting.

## Verified in browser (Playwright, this session)

- No console/page errors on load, through a full scroll pass covering every
  section, or under `prefers-reduced-motion: reduce` emulation.
- The particle field's tone mapping needed a fix during development: without
  `ACESFilmicToneMapping` (the renderer defaulted to `NoToneMapping`), the
  additive-blended bright particle cores clipped straight to flat white
  instead of reading as warm gold — the same class of bug the piano's
  lacquer had. Fixed, confirmed via an isolated smoke-test page.
- Per-scene particle re-skinning (e.g. hobbies' larger, tumbling "leaf"
  particles) confirmed working — `setScene()` re-skins the ambient
  population's size/spin in place when the mode changes, since a scene
  switch alone never triggers the pool-rebuild path.
- The torchlight reveal (`#projects`) and the grace-sigil cursor-follow
  (`#contact`) both confirmed rendering and tracking the pointer correctly.
- Cadenza confirmed with real gameplay, not just a code read: clicking
  "Begin cadenza" then sustained D/F/J/K presses over ~7s of real play
  landed real hits — score 933, 44 judged notes, 55% accuracy, zero console
  errors.
- The piano (all three `CAMERA_PRESETS`), its mirror floor, and its
  interior detail were also smoke-tested in isolation before wiring into
  this concept — see `shared/piano3d.js`'s notes in `CLAUDE.md`.

## Known tradeoffs (shared, not motion-specific)

Same as always: YouTube ("Experience") and SoundCloud ("If I Am With You")
can't be sample-analyzed cross-origin, so they drive the piano with a
generative pattern (now per-piece-tuned via `PERFORMANCE_PROFILES`) instead
of true audio-reactivity. Documented in `shared/recital.js`.

## A note on verifying in this sandbox

WebGL renders via software (SwiftShader) here, and both the piano and the
particle field are non-trivial scenes — a single screenshot can take up to
~25s. GSAP tweens/ScrollTrigger scrubs triggered right as the page is doing
heavy synchronous setup (constructing the piano, baking its environment)
can appear to "jump" to their end state almost instantly in wall-clock
terms — confirmed separately, in isolation, that GSAP's own timing is
correct; it's this sandbox's frame pacing under heavy synchronous load, not
a code bug. When something looks wrong after a scroll/animation, prefer
reading back actual constructed values (`camera.position`, DOM classes,
computed styles) over trying to time a screenshot to an exact frame.
