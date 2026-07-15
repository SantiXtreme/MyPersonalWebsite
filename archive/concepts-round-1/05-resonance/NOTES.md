# 05 — Resonance

Generative, audio-reactive concept: a full-viewport 2D-canvas particle field
(`ResonanceField` in `main.js`) is the star; all content floats above it.

## Techniques

- **Canvas field**: ~110 soft glowing blobs (30 under reduced-motion) drifting on
  a cheap sine-based flow field, damped for a fluid feel. Rendered with
  `globalCompositeOperation='lighter'` over a translucent fill (motion-blur
  trails instead of a hard clear).
- **Performance**: glow blobs are drawn from **pre-rendered radial-gradient
  sprites** bucketed by hue (`_buildSprites`), not per-frame `createRadialGradient`
  — the reason it stays smooth at high particle/spark counts.
- **Cursor**: soft attraction + tangential swirl within a radius (listens on
  `window`, so the `pointer-events:none` canvas still reacts).
- **SIGNATURE — piano reactivity**: every note-on calls `field.pulse(midi)`.
  Pitch (`norm()` over C2–C6) maps to horizontal position, hue (low=magenta →
  high=cyan/green), ripple size/speed (low=large+slow, high=tight+fast), a
  one-time outward impulse on nearby particles, and a spark burst.
- **Piano**: `shared/pianoEngine.js` (`buildKeyboard('C3','C5')`, keyed by MIDI
  number not name). Click/tap + computer-keyboard (A W S E D … chromatic).
  Autoplay wires `shared/liebestraum.js`.
- **Scroll**: Lenis + GSAP ScrollTrigger reveals (`back.out` easing). Hero has
  its own staggered intro timeline (excluded from the generic reveal loop).

## Reduced motion

Fewer/slower particles, heavier trail-fade, weaker cursor pull, ripples scaled to
~45%, no large flashes; all `.reveal` elements shown instantly and Lenis is skipped.

## Notes for future sessions

Content is imported from `shared/content.js` (TODO placeholders kept verbatim —
don't invent). Verified via Playwright against the running dev server: no console/
page errors, canvas renders (litFraction ~0.27), note-on measurably brightens the
field, no mobile horizontal overflow at 390px. Pitch→position range is C2–C6 so
the low Liebestraum bass still maps on-screen even though the keyboard is C3–C5.
