# Concepts round 1 — archived, with feedback

Five concepts were built and reviewed (see each folder's own `NOTES.md` for
build details). The user's actual feedback on each, verbatim in spirit,
recorded here since it directly shaped round 2:

- **01-fog-gate**: Liked — the cursor-follow ember glow, the intro text
  animation, very cinematic overall. Disliked — scroll wasn't smooth, some
  stretches were just background with nothing happening, and scrolling fast
  made text reveal weirdly/too quickly (the ScrollTrigger scrub was too
  literal/unsmoothed). **Round 2 lesson: fix scroll smoothness, don't let
  empty/idle stretches happen, tune scrub so fast scrolling doesn't break
  the reveal.**
- **02-grace-atlas**: Animations were great, but the site felt visually thin
  overall / not enough motion. **Lesson: more sustained visual richness, not
  just isolated animated moments.**
- **04-atelier-noir**: The strongest all-round entry — clean elegant font,
  noticeably smoother scroll than fog-gate, "very very good" overall; could
  have used more motion but was not a complaint, more a note. **This is the
  quality bar round 2 should meet or beat on polish/smoothness.**
- **03-kinetic-forge**: Style is powerful, the text slide animations were
  great execution — but the bold/duotone "punky" aesthetic itself wasn't to
  the user's taste. Execution quality wasn't the issue, the style direction
  was.
- **05-resonance**: Least favorite — visually overwhelming/busy. The
  audio-reactive background *concept* (piano notes visibly affecting a live
  canvas) was liked as an idea, just not this execution's visual intensity.

## What round 2 is

Two new concepts, `concepts/motion/` and `concepts/recital/` at the project
root, built directly from this feedback: one pushes hard on scroll-driven
motion/animation spectacle (fixing fog-gate's smoothness problems), the
other is a refined "entering a theatre for a piano recital" experience
prioritizing quality/elegance over motion density (continuing what worked
in atelier-noir). Both feature a shared 3D grand piano
(`shared/piano3d.js`) with a 3-song recital player
(`shared/recital.js`) instead of the old flat clickable-key widget.
