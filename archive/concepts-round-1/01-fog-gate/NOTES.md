# Concept 01 — Fog Gate

Cinematic Elden Ring take: walking toward a fog gate into a boss arena. No menu,
no site-of-grace UI (that was the previous, now-archived build) — a full-bleed
scroll narrative instead.

## Techniques

- **Signature visual: raw WebGL (no Three.js) fragment-shader fog**, rendered
  to a full-screen triangle (`initFog` in `main.js`). Domain-warped fbm noise
  (the brief's hash/noise/fbm utility) drives drifting cool blue-charcoal fog
  with a warm ember pool low-and-center ("the fire beyond the gate"), a
  breathing vertical light seam, and a pointer-follow ember glow. Reacts to
  `u_time`, `u_scroll` (fog thickens as you descend), and `u_pointer`.
  Rendered at 0.6x device resolution (fog is soft/blurry, doesn't need full
  res) for performance. Falls back to a static CSS gradient if WebGL is
  unavailable.
- Canvas-2D ember particles drifting upward, independent of the shader.
- **Boss-arena title cards** (`initMotion`'s `.chapter` loop) — the signature
  interaction: each section is preceded by a pinned GSAP ScrollTrigger
  (`scrub: 0.6`) sequence where a "CHAPTER N / TITLE / subtitle" banner
  flashes up big and gold, holds, then recedes before the actual content
  reveals beneath it. Genuinely reads as a FromSoftware area-name moment, not
  a fade-in.
- Lenis smooth scroll wired to `gsap.ticker`; content within each chapter
  reveals via a second, non-pinned ScrollTrigger stagger.
- Piano: `buildKeyboard('C4','C6')` (2 octaves) from `shared/pianoEngine.js`,
  keyed by MIDI throughout (avoids the flat/sharp string-lookup pitfall).
  Pointer + Enter/Space + a one-octave computer-keyboard map (A row).
  "Play Liebestraum No. 3" wires `shared/liebestraum.js`.

## Verification

Built and largely self-verified by the original agent (zero console/page
errors across every section, screenshots of every chapter and the piano).
The agent was cut off mid-verification by a session/API limit before it
reached the reduced-motion and mobile passes — I (the orchestrating session)
completed those directly against the running dev server:
- `prefers-reduced-motion`: shader renders one frozen frame (no rAF loop),
  embers skipped, Lenis skipped, reveals set to instant opacity 1 — no
  scroll-jack pinning at all under reduced motion. Zero errors, screenshot
  confirmed correct.
- Mobile (390×844): zero horizontal overflow, title/fog scale correctly,
  zero errors.

No code changes were needed — everything the agent wrote was already correct
on inspection and re-verification.

## Gotchas / for a future session

- The fog shader's `RENDER_SCALE = 0.6` is deliberate for perf — don't bump
  it to 1.0 without checking frame time on lower-end hardware.
- Content imported from `shared/content.js` only; TODO placeholders (projects,
  hobbies, contact links) left verbatim, no fabricated specifics.
