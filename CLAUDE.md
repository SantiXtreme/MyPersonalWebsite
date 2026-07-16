# Santiago — "Off the hours" (personal site)

This is Santiago's actual personal site, not a concept demo. It went
through three phases: a single Elden Ring "Site of Grace" build, then five
parallel concepts reviewed side by side (round 1), then two finalist
concepts sharing a 3D piano (round 2 — `motion` vs `recital`). The user
picked **motion** as the winner; it was promoted to the project root and
expanded into a full site per a detailed brief. `archive/` and `concepts/`
from earlier phases were deleted outright (not kept around) once the
decision was made, so this is now a single-concept codebase.

The most concrete taste signal this project has ever gotten — from the
round-1 side-by-side review, no longer on disk but still the standing
brief — remains: **liked** cursor reactivity, a cinematic intro, smooth
restrained scroll, clean serif type; **disliked** rough/jarring scroll,
visually-thin sections, "punky" bold styling, visual overwhelm. Keep
applying it to any new section or visual change.

## Structure

```
index.html            One scroll page — 9 sections (hero, about, machine-learning,
                       math-physics, volleyball, recital, reading, hobbies, contact).
main.js                 Entry point: Lenis smooth scroll + GSAP ScrollTrigger scene
                       system, cinematic intro, per-section wiring (numbered blocks
                       0–13 in the file, e.g. "6 · MACHINE LEARNING", "11 · THE 3D
                       PIANO STAGE"). Import content from shared/content.js — never
                       inline real-world facts here.
scene3d.js               Persistent Three.js GPU particle field (embers/ash/dust/leaf
                       depending on the active section, via `SCENES`) + UnrealBloomPass.
                       One system for the whole page, not per-section canvases — a
                       section's `cursorForce` (trail/stir/scatter/gather/none) is how
                       it gets a distinct feel without bolting on a new mechanism.
style.css                All styling. Notable shared patterns: `.scene::before` per-
                       section atmospheric gradient overlays, `.on-dark` text-shadow
                       treatment for text over busy/bright backgrounds, `.section-canvas-bg`
                       for the 2D-canvas section hero backgrounds (neuralNet.js/collision.js).
sections/
  neuralNet.js            Machine Learning hero background — a small flowing neural net
                         (Canvas 2D, layered nodes + traveling signal pulses). Biased
                         toward the section's upper third so it doesn't sit entirely
                         behind the opaque `.project-grid` cards below it.
  collision.js              Math & Physics hero background — two blocks doing a real
                         (computed, not scripted) elastic collision, momentum/KE readouts.
  equations.js              Floating DOM equation glyphs with scroll-linked parallax,
                         reused sparse (About) and dense (Math & Physics).
  volleyballPlayer.js        The user's own two clips (`assets/volleyball/`), crossfading
                         back-to-back and looping via two stacked `<video>` elements.
  eldenRingBg.js             Hobbies background — a real YouTube embed ("The Beauty of
                         ELDEN RING", starts/loops at 5:28), via `loadYouTubeAPI` from
                         shared/recital.js. Never rip/rehost — always the live embed.
  books.js                 Reading hero — a small shelf of book spines that drops in
                         and settles once, GSAP, no canvas.
  reactiveLetters.js         The cursor-reactive "glow cloud" used on the hero title and
                         reused verbatim on contact's "Let's make something move." —
                         splits text into per-character spans (`splitChars()` in
                         main.js) and lights up letters near the pointer. Space
                         characters get a non-breaking space, not a literal space —
                         a plain space inside a `display: inline-block` span collapses
                         to zero width under normal whitespace rules and silently eats
                         the gap between words. Don't "simplify" that back to `ch`.
shared/
  content.js                  SINGLE SOURCE OF TRUTH for real content (name, tagline,
                       projects, hobbies, links, volleyball stats, books, piano intro).
                       Still full of `TODO(santiago)` placeholders — the user has
                       repeatedly deferred providing specifics; leave them as
                       placeholders and never invent real names/links/achievements.
  piano3d.js                   The 3D grand piano — procedural Three.js geometry
                       (concert-grand silhouette, propped lid over a modeled interior:
                       gold cast-iron plate, fanned strings, warm soundboard, tufted-
                       leather bench, brass lid-edge trim and leg hardware), 88
                       individually-animatable keys. Glossy PBR lacquer via a small
                       custom "studio" PMREM environment (NOT three.js's stock
                       RoomEnvironment — that washes a near-black clearcoat to flat
                       grey) + ACESFilmicToneMapping. Floor is a real-time mirror
                       (`Reflector.js`) with a `ShadowMaterial` contact-shadow overlay.
                       Deliberately no manufacturer wordmark (trademark). Exports
                       `CAMERA_PRESETS` (`hero`/`keys`/`stage`) — retune camera numbers
                       here, not in main.js. `pressKey(midi, {velocity, sustain})`
                       animates one key; `flyTo(presetName, duration)` tweens the camera.
  recital.js                   Three-song player: `SONGS` (Liebestraum No. 3 = local
                       file with real WebAudio-analyser audio-reactive key triggering;
                       Einaudi "Experience" = YouTube embed; "If I Am With You"
                       (Jujutsu Kaisen S2 OST) = SoundCloud embed — both cross-origin
                       embeds get a generative "performance" pattern instead of real
                       audio-reactivity, since there's no sample access across origins;
                       documented in-file, a deliberate user-confirmed tradeoff).
                       `createRecitalPlayer({ mediaContainer, onNote, onStateChange })`.
                       `PERFORMANCE_PROFILES` (keyed by song id) gives each piece a
                       distinct color/sustain/velocity/timing feel, threaded through
                       `onNote(midi, opts)` so every consumer (piano key hold time,
                       accent lights, particle burst colors) reacts differently per
                       piece. `onStateChange` drives the piano camera: flies to `keys`
                       on play, back to `hero` on pause — see main.js block 12.
  audio/liebestraum-no3.mp3    The user's own recording, played locally as real audio
                       (not resynthesized) — never rip/rehost the YouTube/SoundCloud
                       songs to "complete the set," always their official embeds.
design-reference/            User-supplied original reference images (gitignored, not
                       tracked). Mixed vintage: `GRANDPIANO.jpeg` is still a live
                       modeling reference cited by name in piano3d.js — don't touch it.
                       Several other files are leftover Elden Ring mood-board images
                       the user called "kinda obsolete now" but are their own supplied
                       originals — flag before deleting, don't do it silently.
```

## Ground rules

- **No fabricated personal facts.** All real content comes from
  `shared/content.js` (full of `TODO(santiago)` placeholders) — leave them
  as placeholders, the user has repeatedly deferred filling these in.
- **Never rip or rehost YouTube/SoundCloud audio or video.** Always their
  official embeds (`shared/recital.js`, `sections/eldenRingBg.js`) — a ToS
  matter and just the right way to do it.
- **Respect `prefers-reduced-motion`** everywhere — every animation module
  in `sections/` checks a `REDUCED` flag and gives a real settled-state
  fallback, not just a token check. Keep that pattern for anything new.
- **Verify in a real browser before calling anything done** — WebGL,
  ScrollTrigger, and the audio/video embeds are all easy to get subtly
  wrong (silently-black canvas, a trigger that never fires, a z-index that
  swallows clicks, a whitespace-collapsing bug that eats a space between
  words). Screenshot it, don't just read the code back. `three` and
  `playwright` are both root dependencies already.
- **This sandbox's WebGL renders in software (SwiftShader)** — a single
  screenshot of the piano/particle scenes can take up to ~25s, and GSAP
  tweens/ScrollTrigger scrubs triggered right as the page is doing heavy
  synchronous setup can appear to "jump" to completion almost instantly —
  that's this sandbox's frame timing, not a bug. Prefer checking final/
  settled state (camera position, DOM classes, computed styles, an
  `innerText` check for text content) over trying to catch an exact
  mid-animation frame. Also: a plain Playwright `locator.click()` on
  elements near the piano/particle scenes can time out on actionability/
  stability checks here even when the element genuinely isn't moving —
  prefer `page.evaluate(() => el.click())` for those specifically.
- **This sandbox cannot reach `youtube.com`** (confirmed via `curl` — a
  sandbox network restriction, not an app bug; `google.com` and most other
  hosts work fine). That means the hobbies section's Elden Ring background
  and the recital's Einaudi "Experience" song can't be visually verified
  here — `loadYouTubeAPI()` just hangs with no network path. Don't chase
  that as a bug in this environment; note it as unverifiable and move on.
  The local Liebestraum song has no such dependency and should be the one
  you actually click through end-to-end when testing the recital player.

## Commands

```bash
npm install        # first time only — if this hangs with a cert error, see the env-npm-tls-fix memory (NODE_OPTIONS=--use-system-ca)
npm run dev         # dev server (single entry, port 5173)
npm run build        # production build
```
