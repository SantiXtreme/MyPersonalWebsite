# Santiago — Concept Review, Round 2

This repo is in a **design exploration phase**. Round 1 built five full
concepts and the user reviewed all five with specific feedback (recorded in
`archive/concepts-round-1/README.md` — read it before touching round 2,
it's the actual brief). Round 2 is two new concepts built directly from
that feedback, replacing round 1 as the active work:

- **`concepts/motion/`** — a full WebGL scroll spectacle, rebuilt a second
  time after the user reviewed the first pass: Elden-Ring-rooted atmosphere
  (golden Site-of-Grace sigils, foggy ruin-dusk palette, drifting embers)
  reimagined as an original portfolio piece rather than a literal reskin,
  with genuinely spectacular and *section-distinct* mouse reactivity and at
  least one polished minigame (Cadenza).
- **`concepts/recital/`** — refined elegance: "entering a theatre for a
  piano recital," continuing what worked in round 1's Atelier Noir
  (smoothness, restrained quality over motion density), with ML projects
  framed inside the theatre metaphor (e.g. as "the programme"). Reviewed
  after round 2's first pass and confirmed good apart from the piano
  (fixed by the shared rebuild below) and the curtain entrance (fixed —
  see `concepts/recital/NOTES.md`); everything else in it is untouched.

Both open on a **real 3D grand piano** (`shared/piano3d.js`, Three.js) that
can play one of three recital pieces via `shared/recital.js`, replacing
round 1's flat clickable-key widget entirely. Each piece has its own
"reactive personality" (color/sustain/velocity/timing — see
`PERFORMANCE_PROFILES` in `recital.js`) so the piano visibly reacts
differently depending on what's playing, on both sites.

## Structure

```
index.html                 Root gallery — 2 cards linking to concepts/motion/ and concepts/recital/
vite.config.js               Multi-page config; registers index.html + both concepts as build entries
shared/
  content.js                  SINGLE SOURCE OF TRUTH for real content (name/projects/hobbies/links). Still TODO(santiago) placeholders — don't invent specifics.
  piano3d.js                   The 3D grand piano — procedural Three.js geometry (concert-grand silhouette, propped lid over a modeled interior — gold cast-iron plate with hand-hole cutouts, strings fanning bass-to-treble, warm soundboard — 88 individually-animatable keys, legs, pedals). Glossy PBR lacquer via a small custom "studio" PMREM environment (a few bright panels against a mostly-dark room, NOT three.js's stock RoomEnvironment — that lights the whole room from ~6 directions at once, which washes a near-black clearcoat to flat grey instead of reading as glossy black with crisp highlights) + ACESFilmicToneMapping. Floor is a real-time mirror (`three/addons/objects/Reflector.js`) tinted per-concept via the `floorColor` option, with a `ShadowMaterial` overlay so it still catches a contact shadow. Deliberately does NOT render any manufacturer wordmark/logo (trademark). Exports `CAMERA_PRESETS` (`hero`/`keys`/`stage`) so both concepts read camera numbers from one place instead of duplicating them — retune here, not per-concept. `pressKey(midi, {velocity, sustain})` animates one key (sustain stretches how long it visually stays down — driven by the active recital piece's profile, see below); `flyTo(presetName, duration)` tweens the camera between presets.
  recital.js                   Three-song player: `SONGS` (Liebestraum No.3 = local file, Einaudi "Experience" = YouTube embed, "If I Am With You" (Jujutsu Kaisen S2 OST) = SoundCloud embed) + `createRecitalPlayer({ mediaContainer, onNote, onStateChange })`. The local file gets REAL audio-reactive key triggering (WebAudio AnalyserNode reading actual frequency bands); YouTube/SoundCloud get a generative "performance" pattern (cross-origin embeds give no access to their audio samples — documented in the file, this was a deliberate, user-confirmed tradeoff, not a shortcut to hide). `PERFORMANCE_PROFILES` (keyed by song id) gives each piece a distinct color/sustain/velocity-range/timing — threaded through `onNote(midi, opts)`'s `opts.color`/`opts.sustain` so every consumer (piano key hold time, accent lights, particle burst colors) reacts differently per piece without each concept re-implementing anything.
  audio/liebestraum-no3.mp3    The user's own file, played locally — never rip/rehost YouTube or SoundCloud audio to "complete the set," always use their official embeds for those two.
  liebestraum.js                Leftover from round 1 (the note-accurate Liebestraum transcription + rubato scheduler) — piano3d/recital.js don't use it (the local recording is played as real audio, not resynthesized), but it's harmless to keep for reference or a future synthesized-fallback need.
  pianoEngine.js                Round 1's WebAudio synth-piano engine. Not used by round 2 (round 2 plays real recordings), kept only in case a future concept wants synthesized playback again.
concepts/
  motion/                       index.html + main.js + style.css + scene3d.js + NOTES.md. `scene3d.js` is the persistent atmospheric field — ONE Three.js GPU particle system (embers/ash/dust/leaves depending on the active scene, via `SCENES` in that file) + `UnrealBloomPass`, replacing the old 2D canvas flow-field. Cursor reactivity is spectacular and distinct per section but stays one cohesive system: the field's per-scene `cursorForce` (trail/stir/scatter/gather/none) covers hero/piano-act/hobbies/contact, plus two lightweight DOM-only touches where a discrete effect fit better — a torchlight cursor reveal over `#projects` (`#torch` in the CSS) and a rune "grace sigil" that trails the cursor on `#contact` with an elastic lag. Cadenza (the falling-notes minigame) keeps its original mechanics, re-skinned to the gold/rune palette and driving `field.burst()` on hits.
  recital/                      index.html + main.js + style.css + NOTES.md
archive/
  concepts-round-1/              All five round-1 concepts, preserved, with the user's per-concept feedback in README.md — READ THIS before designing anything new, it's the most concrete signal available about taste (liked: cursor reactivity, cinematic intro animation, smooth restrained scroll, clean serif type; disliked: rough/jarring scroll, visually-thin sections, "punky" bold styling, visual overwhelm).
  elden-grace-v1/                 The original single-concept Elden Ring "Site of Grace" build, further back in the project's history.
```

## Ground rules

- **No fabricated personal facts.** All real content comes from
  `shared/content.js` (still full of `TODO(santiago)` placeholders — leave
  them as placeholders, the user has repeatedly deferred filling these in).
- **Never rip or rehost YouTube/SoundCloud audio.** Always their official
  embeds (`shared/recital.js` already does this correctly) — this is both a
  ToS matter and just the right way to do it.
- **The two concepts share `piano3d.js`/`recital.js`/`content.js` and
  nothing else.** Keep each concept's scroll/motion/visual system
  independent — that's the point of building two.
- **Respect `prefers-reduced-motion`** in both — these are animation-heavy
  by design and need a real fallback, not just a token check.
- **Verify in a real browser before calling either concept done** — WebGL,
  ScrollTrigger, and the audio embeds are all easy to get subtly wrong
  (silently-black canvas, a trigger that never fires, a z-index that
  swallows clicks). Screenshot it, don't just read the code back. `three`
  and `playwright` are both root dependencies already.
- **This sandbox's WebGL renders in software (SwiftShader)** — a single
  screenshot of either concept's piano/particle scenes can take up to ~25s,
  and GSAP tweens/ScrollTrigger scrubs triggered right as the page is doing
  heavy synchronous setup (constructing the piano, baking its PMREM
  environment) can appear to "jump" to completion almost instantly in this
  environment specifically — that's this sandbox's frame timing, not a bug.
  Prefer checking final/settled state and constructed values (camera
  position, DOM classes) over trying to catch an exact mid-animation frame.
- See `.claude/skills/round-2-concepts/SKILL.md` for the established
  patterns in this round — adding a scroll scene to `concepts/motion/`,
  adding/adjusting a recital piece's performance profile, and where the
  shared piano's material/geometry/floor knobs live.

## Commands

```bash
npm install        # first time only — if this hangs with a cert error, see the env-npm-tls-fix memory (NODE_OPTIONS=--use-system-ca)
npm run dev         # dev server; root gallery at /, concepts at /concepts/motion/ and /concepts/recital/
npm run build        # builds every registered entry in vite.config.js
```

## After a concept is chosen

Promote that concept's files to the project root (mirroring how
`archive/elden-grace-v1/` was created from the original root build), update
`vite.config.js` back to a single-entry config, move the other concept (and
`archive/concepts-round-1/` if the user doesn't want it kept around) into
storage, and replace this file with a CLAUDE.md describing just the winning
concept's architecture.
