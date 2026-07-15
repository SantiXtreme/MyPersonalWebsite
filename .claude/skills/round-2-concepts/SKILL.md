---
name: round-2-concepts
description: Use when working on concepts/motion/ or concepts/recital/ (the current, round-2 scroll-page architecture) — adding or adjusting a scroll "scene" in motion, adding/tuning a recital piece's reactive performance profile, or changing the shared 3D piano's material/geometry/floor. Not applicable to archive/elden-grace-v1 (round 1's menu-driven architecture — see grace-menu-section for that).
---

# Round 2 concepts: motion & recital

Both `concepts/motion/` and `concepts/recital/` are single scroll pages
(Lenis + GSAP ScrollTrigger), not the menu/panel-router architecture round 1
used. They share exactly three modules — `shared/piano3d.js`,
`shared/recital.js`, `shared/content.js` — and nothing else; every other
system (scroll mechanics, cursor reactivity, visual language) is
deliberately independent per concept. Keep it that way when extending
either one — don't reach into the other concept's files.

## Adding a scroll scene to `concepts/motion/`

Motion's atmosphere is one persistent Three.js particle field
(`concepts/motion/scene3d.js`) whose palette/behavior morphs per "scene," not
a separate system per section. To add a new section:

1. Add the section markup in `index.html`:
   `<section id="foo" class="scene" data-scene="foo" data-label="Foo">`.
   `main.js`'s existing `$$('.scene').forEach(...)` ScrollTrigger loop picks
   it up automatically (no new JS needed for the basic scene-switch/reveal).
2. Add a `foo: { mode, a, b, drift, turbulence, cursorForce, density }` entry
   to `SCENES` in `scene3d.js` — `mode` is `ember|ash|dust|leaf` (only
   affects ambient particle size/spin, re-skinned in place on scene change,
   see `setScene()`), `cursorForce` is `trail|stir|scatter|gather|none`.
   Reuse an existing `cursorForce` if it fits — the "cohesive, not five
   bolted-on gimmicks" rule the user asked for during the round-2 rebuild
   means new sections should draw on the same handful of forces rather than
   inventing a new one per section.
3. Add a `#foo::before` atmospheric gradient overlay in `style.css` (follow
   the existing per-scene blocks — same pattern as round 1's per-section
   backgrounds).
4. Only touch `main.js`'s `pointermove` handler if the section needs a
   bespoke DOM-level effect beyond what a `cursorForce` covers (the
   precedent: `#torch` for projects' torchlight, `#grace-sigil` for
   contact's cursor-follow rune — both deliberately kept as the *exception*,
   not the pattern, because a WebGL-only cursor force is cheaper and more
   consistent when it's expressive enough).

## Adding/adjusting a recital piece's performance profile

Every recital piece should *feel* different, not just sound different. This
lives in exactly one place: `PERFORMANCE_PROFILES` in `shared/recital.js`,
keyed by the song's `id` from `SONGS`. Fields: `color` (tints the host's
accent-light/particle burst), `sustainBase`/`sustainJitter` (how long a
struck key visually stays down — piano3d.js's `pressKey` reads this),
`velocityFloor`/`velocityCeil` (dynamic range), `bandTuning` (analyser
cooldown/threshold per band — Liebestraum only, since it's the one piece
driven by real audio), `noteMs`/`spread` (generative-performer timing —
Experience/If I Am With You only).

This flows through the existing `onNote(midi, opts)` callback both concepts
already implement — `opts.color` and `opts.sustain` are just new fields on
the same object, not a new API. **If you add a new concept or a new
accent-light/particle-burst call site, make sure it actually reads
`opts.color`** (pass it into the light/burst color) — the profile system is
silently inert otherwise, since `piano3d.js` itself only consumes
`opts.sustain` (for the key's hold time); the color side is each concept's
own responsibility to wire up (see `pulseAccent(v, color)` in either
concept's `main.js` for the pattern).

## The shared piano's material/geometry/floor knobs

All in `shared/piano3d.js`:

- Silhouette: `buildBodyShape()` / `buildLidShape()` (bezier outlines) /
  `buildPlateShape()` (the gold cast-iron plate, with hand-hole cutouts).
- "Shiny black" look: `makeEnvironment()` builds a small custom PMREM
  studio (a few bright panels against a mostly-dark room) — **don't**
  swap back to three.js's stock `RoomEnvironment`, it lights the room from
  ~6 directions at once and washes a near-black clearcoat to flat grey
  instead of true black with crisp highlights (this was the actual bug
  behind the piano looking "mid" before the round-2 rebuild).
  `lacquer`/`lacquerInner` materials' `clearcoat`/`roughness`/
  `envMapIntensity` are the other half of that look.
- Floor: a real-time mirror (`three/addons/objects/Reflector.js`) tinted by
  the `floorColor` option (recital passes a warm wood tone, motion a cool
  wet-stone tone), with a `ShadowMaterial` overlay so the mirror still
  shows a contact shadow.
- Camera: `CAMERA_PRESETS` (`hero`/`keys`/`stage`) is exported and meant to
  be the *only* place these numbers live — both concepts import it rather
  than duplicating position/look-at arrays. Retune here; re-verify all
  three presets (a `?preset=hero|keys|stage` query-param smoke-test page
  bypassing the concepts entirely is the fastest way to iterate on this in
  isolation, since going through a concept's scroll choreography to reach a
  given preset is much slower to check).

## Verifying changes here

`npm run dev`, then Playwright: load, scroll through every section, exercise
Cadenza, and re-check with `reducedMotion: 'reduce'` emulation. Watch for
console/page errors — that's a more reliable signal in this sandbox than
trying to time a screenshot to an exact mid-animation frame (WebGL renders
via software here and can take several seconds per frame; GSAP tweens can
appear to "jump" to completion when triggered right as the page is doing
heavy synchronous setup work). Check *constructed* state instead — e.g. read
`camera.position`/`root.position` back via `page.evaluate` rather than
eyeballing a screenshot's zoom level, and gate on final settled screenshots
rather than ones timed to catch a transition mid-flight.
