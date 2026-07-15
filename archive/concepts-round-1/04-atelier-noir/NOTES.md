# Atelier Noir — notes

Atmospheric/editorial concept: drifting fog over a pine treeline, film grain,
elegant serif, quiet scroll storytelling. No Elden Ring theming.

## Techniques
- **Scene** (`#scene` canvas, `initScene`): hand-built, no assets. Vertical sky
  gradient + a faint desaturated-warm "moon" radial glow + 3 seeded pine-ridge
  silhouettes (mulberry32 PRNG so ridgelines are stable) at increasing darkness,
  parallaxed by scroll. Fog = 18 soft radial "puffs" drifting horizontally,
  composited with `lighter`. A scroll-driven `mood` (0..1) thickens fog and
  darkens the sky as you descend.
- **Grain** (`#grain` canvas, `initGrain`): a 110px noise tile regenerated ~11fps
  and tiled via `createPattern`; `mix-blend-mode: overlay`, opacity 0.07. Flicker
  gives the analog feel. Sits above content (pointer-events none).
- **Type**: Fraunces (display/name) + Newsreader (body), both Google Fonts.
  Hero fades/blurs in on load; sections blur-rise on scroll (GSAP ScrollTrigger,
  expo/power2 easing, ~1.1–1.6s).
- **Smooth scroll**: Lenis + `gsap.ticker`. `lenis.on('scroll')` also drives
  `ScrollTrigger.update()` and the scene mood.
- **Ambient drone** (`initAmbient`): opt-in, default OFF. Built only on the first
  toggle click (autoplay-safe): 3 detuned oscillators (A1/E2/A2) → lowpass with a
  slow LFO, master gain ramps 0→0.05. Very quiet.
- **Piano** (`initPiano`): shared `pianoEngine` (`buildKeyboard` C3–C5 = 2 octaves,
  `createPianoVoice`). Keys are `<button>`s (pointer + Enter/Space), keyed/looked-up
  by **MIDI** to dodge the flat/sharp naming pitfall. "Play a phrase" reuses
  `scheduleLiebestraum` and flashes keys via MIDI lookup.

## Reduced motion
`prefers-reduced-motion` freezes the scene to one frame, makes the grain a single
static frame, disables Lenis (native scroll), and shows all sections at opacity 1
(no blur/rise, no scroll-jacking).

## Good to know
- Content is injected from `shared/content.js` in `fillContent()` (single source of
  truth); TODO placeholders are intentionally kept.
- Mobile: `.piano-scroll` is the only horizontal scroller (keeps the page overflow
  at 0); `--wk`/`--bk` shrink under 620px. Verified 1280px + 390×844 with Playwright:
  no console/page errors, canvases non-blank, reveals fire, sound toggles, no overflow.
