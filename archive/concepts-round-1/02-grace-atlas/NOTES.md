# Grace Atlas — notes

Elden Ring take B: the whole site is an interactive **constellation map**. Five
glowing "grace" waypoints are scattered across a dark starfield; clicking one
"travels" the camera toward it and its content panel rises into view. No
dropdown, no vertical scroll list (deliberately unlike archive/elden-grace-v1).

## Techniques
- **2D canvas starfield** (`#map-canvas`) with its own camera `{x,y,zoom}`,
  parallax layers, twinkling stars, drifting blue "spirit motes", a jagged
  terrain ridge, and a soft golden guidance glow. One shared `project()` maps
  pixel-space points through the camera. DPR capped at 2.
- **Waypoints are HTML buttons at responsive % positions** (separate
  landscape/portrait layouts) — this keeps them tappable/readable on any
  viewport. The starfield camera pans+zooms on "travel" to supply motion,
  decoupled from waypoint layout so it never breaks on small screens.
- **Route lines** are an SVG overlay connecting waypoint centres, traced in
  with GSAP via `stroke-dashoffset`.
- Crescent-and-cross grace glyph is one inline `<svg><symbol>` reused via
  `<use>` (also the favicon, as a data-URI, to keep the console clean).
- Piano: `buildKeyboard('C4','C6')` + `createPianoVoice()`; keys flash by MIDI
  (`keyByMidi` map) so flat-spelled Liebestraum notes still light the right
  key. Optional Liebestraum excerpt via `scheduleLiebestraum` (toggle button,
  stopped on panel return). Computer-keyboard row (a,w,s,e,d…) also plays.

## Good to know
- No Lenis: this concept is click-to-travel, not a scroll journey, so panels
  use native internal scroll (`html/body` are `overflow:hidden` → zero page
  overflow, incl. mobile).
- `prefers-reduced-motion` is checked **live** (`reduced()`), not once: camera
  pans become instant in-place reveals, motes/twinkle nearly freeze, star &
  mote counts drop, route trace + halo pulse are disabled via CSS.
- Escape closes a panel; focus moves to the panel heading on open and back to
  the triggering waypoint on return. `role=status` live region announces
  arrivals.
- Verified with Playwright (1440×900, reduced-motion, 390×844): 0 console/page
  errors, travel works to multiple waypoints, piano key active state fires,
  no horizontal overflow, min waypoint spacing ~199px on mobile.
