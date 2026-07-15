# Concept 03 — Kinetic Forge

Bold, high-contrast technical-editorial direction (wodniack.dev mood). Duotone:
near-black ink `#0a0a0b` + one loud accent, acid lime `#c6ff00`. No Elden Ring theming.

## Techniques

- **Signature visual: raw WebGL wireframe terrain** (`initTerrain` in `main.js`, no
  Three.js). A CPU-built grid of points (96×68 desktop / 60×48 mobile). Each frame the
  Y of every vertex is recomputed from 3-octave fBm (`noise2D` = the brief's hash/smooth
  noise) and re-uploaded via `bufferSubData`; drawn as `gl.LINES` with a static index
  buffer. Own tiny column-major mat4 lib (`perspective`/`lookAt`/`mul`) → a perspective
  camera looking across the dunes. Fragment shader fades far lines (fog) and brightens
  ridges. Noise drifts over time + reacts to pointer (offsets sample origin + parallaxes
  the camera). Amplitude grows with depth so the near/type area stays calm/readable.
- **Type:** Anton (huge condensed display) + Space Grotesk (body) + Space Mono (labels/
  ticker). Hero has a stroked accent "echo" duplicate that parallaxes with the cursor.
- **Piano (`initPiano`):** `buildKeyboard('C3','C6')` (~3 oct). Real white/black key
  proportions, CSS-only depth (layered box-shadows, gradient key faces, accent felt strip,
  `perspective()+rotateX` keybed tilt). Delegated pointer handling + computer-keyboard map
  (A W S E D F T G Y H U J K … = C4 up). Audio via `shared/pianoEngine.js`
  (`createPianoVoice`, lazy-init on first gesture). "Hear it played" = `scheduleLiebestraum`;
  keys are keyed/highlighted by MIDI number (flats vs sharps — see CLAUDE.md pitfall).
- Lenis smooth scroll driven by `gsap.ticker`; GSAP ScrollTrigger reveals + progress bar;
  magnetic buttons via `gsap.quickTo`.

## Gotchas / for a future session

- `prefers-reduced-motion`: terrain draws ONE static frame (verified frozen), magnetic +
  echo + Lenis disabled, reveals shown instantly. All handled at load via `REDUCE`.
- Verifying the canvas by copying it into a 2D canvas reads BLANK — WebGL uses
  `preserveDrawingBuffer:false`, so confirm the terrain with a real screenshot, not pixel
  readback. It genuinely renders (see hero screenshots).
- Content is imported from `shared/content.js` only; TODO placeholders left verbatim.
- Piano may horizontally scroll on narrow screens (keybed `min-width:720px`) — intentional;
  page itself has zero horizontal overflow at 390px.
