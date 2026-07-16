# Phase 3 — notes

Motion (the round-2 winner) promoted to the project root and expanded into
the actual site per a detailed user brief — no longer a "concept," this is
Santiago's real personal site, titled **"Off the hours."** `concepts/` and
`archive/` from earlier phases were deleted outright once the decision was
made.

## What changed from round-2 motion

- New section flow: hero → about (5 key-area nav cards) → machine-learning
  → math-physics → volleyball → recital (piano, mechanics unchanged) →
  reading → hobbies (Elden Ring video background) → contact (kept
  pixel-identical copy/fonts/colors per explicit request, only its cursor
  reactivity changed).
- **Architecture stayed vanilla** JS + Three.js + GSAP + Lenis — a React/
  R3F rewrite was considered and explicitly rejected: the page is a
  sequence of bespoke full-screen scroll scenes, not a widget-heavy app
  where React's component reuse would pay for itself.
- **Machine Learning** is a standalone 5th key area, not folded into Math &
  Physics — user confirmed explicitly.
- **Reading** ("favorite books") was a late addition — a falling-book-shelf
  GSAP animation (`sections/books.js`), all-TODO book list.
- **Piano upgraded** toward `design-reference/GRANDPIANO.jpeg`: tufted-
  leather bench, brass lid-edge trim (`TubeGeometry` traced along the lid
  curve), refined leg/caster hardware — still no manufacturer wordmark.
- **Hero got a new "darker blues" identity**, distinct from the rest of the
  site's gold/lacquer accents — a cursor "reactive cloud"
  (`sections/reactiveLetters.js`) lights up individual letters in the hero
  name and in contact's "Let's make something move," reused verbatim on
  both per the user's request. The old grace-sigil cursor-follow SVG and
  its gather-toward-a-point particle force were removed entirely; contact's
  ambient particle `cursorForce` moved from `'gather'` (its target was
  gone) to `'trail'`, matching the hero it bookends.
- **Cadenza (the falling-notes minigame) was removed entirely** — HTML/
  CSS/JS all deleted, not hidden. Starting a recital song now flies the
  piano camera straight to the `'keys'` preset (no minigame left to gate
  it).
- Video backgrounds now fall under the same "never rip/rehost" rule audio
  already had: hobbies uses a real YouTube embed
  (`sections/eldenRingBg.js`, "The Beauty of ELDEN RING," starts/loops at
  5:28); volleyball uses the user's own two clips
  (`assets/volleyball/clip-1.mp4`/`clip-2.mp4`, transcoded via a one-off
  `ffmpeg-static` pass — installed `--no-save`, used once, uninstalled
  afterward, confirmed gone from `package.json`/`package-lock.json`).
  Volleyball's clips get a CSS overscan-crop + blur
  (`.volleyball-clip`) to push a small `clideo.com` watermark on one clip
  out of frame — the one section deliberately less "clear" than the rest.

## Bugs found and fixed during browser verification (this session)

- **Contact/hero text-spacing bug**: `splitChars()` in `main.js` wrapped
  every character — including literal space characters — in a
  `display: inline-block` span. A space-only inline-block collapses to
  zero width under normal whitespace rules in Chromium, so contact's
  "Let's make / something move." was silently rendering as "Let'smake" /
  "somethingmove." — a real regression against the explicit "kept
  pixel-identical, SAME THE SAME" instruction for that section. Fixed by
  giving space characters a non-breaking space instead of a literal one.
  Verified via `element.innerText` plus a before/after screenshot.
- **`shared/content.js` books placeholder had swapped fields**: each entry
  was `{ title: 'TODO(santiago)', author: 'Title one' }` — the spine
  showed the generic "TODO(santiago)" where a title belongs and "Title
  one" where the author caption belongs. Fixed to
  `{ title: 'Title one', author: 'TODO(santiago)' }` so the placeholder at
  least reads sensibly per field.
- **ML section's neural net was reading as visually thin** — it drew and
  animated correctly (confirmed via pixel sampling + an isolated
  screenshot with `.wrap` hidden) but roughly half its nodes fell behind
  the opaque `.project-grid` cards and its connecting edges were nearly
  invisible (alpha capped at 0.07). Fixed: nodes now bias toward the
  section's upper third (clear of the cards), edge alpha raised to 0.16.
- **Recital's intro paragraph had a legibility problem** sitting directly
  over the piano's bright gold soundboard/strings, worse once the camera
  flies in on song-play. Added a left-biased radial scrim layer to
  `.piano-act::before` (on top of the existing vignette) behind the text
  column — a real, if modest, improvement; worth a further look if it
  still reads as weak in a real (non-software-rendered) browser.

## Verified in browser (Playwright, this session)

- All 9 sections screenshotted at rest; 0 console errors, 0 page errors,
  0 errors under `prefers-reduced-motion: reduce` emulation.
- Recital player fully exercised end-to-end on the local Liebestraum song:
  select → "Now cued" state → Play → real audio timestamp advancing
  (`0:00 → 0:07` observed) → piano camera flying `hero → keys` → transport
  status updating to "playing," zero errors throughout.
- Volleyball crossfade and the collision-demo/floating-equations canvases
  were code-reviewed and spot-screenshotted (render correctly) but not
  watched through a full loop cycle — low risk, logic is straightforward.
- **Not verifiable in this sandbox**: the hobbies section's Elden Ring
  YouTube background and the recital's Einaudi "Experience" song — this
  sandbox cannot reach `youtube.com` at all (confirmed via `curl`; a
  sandbox network restriction, not an app bug). Both depend on
  `loadYouTubeAPI()`, which just hangs here with no network path. Should
  work fine in the user's real browser; re-verify there if in doubt.
- A plain Playwright `locator.click()` on the recital song buttons
  reliably timed out on actionability/stability checks here even though
  the button was topmost, visible, and not moving between two samples
  500ms apart — most likely this sandbox's heavy synchronous WebGL frame
  pacing confusing Playwright's stability polling, not a real
  interactivity bug. `page.evaluate(() => el.click())` worked instantly.

## Cleanup done this session

- Deleted `shared/liebestraum.js` and `shared/pianoEngine.js` — round-1
  leftovers (note-accurate transcription/rubato scheduler, WebAudio synth
  engine) confirmed via grep to have zero references anywhere in the
  current build.
- Deleted `.claude/skills/round-2-concepts/SKILL.md` — described
  `concepts/motion/`/`concepts/recital/` as live directories; both are
  gone (motion promoted to root, recital deleted), so the skill was
  actively misleading rather than just outdated.
- `CLAUDE.md` rewritten for the current single-concept architecture
  (previously still described round 2's dual-concept setup — confirmed via
  diff that it hadn't been touched since before this phase's promotion
  commit).
- **Not deleted, flagged instead** (user-supplied originals — ask before
  removing): `Classicals.de - Liszt - Liebestraum No. 3 (Love Dream) - S.
  541.zip` and `Steinway-Sons-Grand-Piano-Hamburg-scaled.jpg` at the repo
  root (zero code references, likely superseded source material); several
  `design-reference/` images from the original Elden Ring mood-board era
  (`20220216164942_1-scaled.jpg`, `3600.webp`, `Games-Elden-Ring-2.webp`,
  `GRACE_OPTIONS.jpeg`, `MOST_IMPORTANT_REFERENCE.webp`,
  `SECOND_MOST_IMPORTANT_REFERENCE.jpeg`) plus three more with unclear
  provenance (`NEW_REFERENCE2.png`, `NEW_RFERENCE.webp`, `RECREATE.webp`).
  **Do not touch `design-reference/GRANDPIANO.jpeg`** — still a live
  modeling reference cited by name in `shared/piano3d.js`.
- `.claude/agents/design-reviewer.md` and `.claude/agents/project-janitor.md`
  created per the user's request (one reviews design decisions against the
  taste brief, one sweeps for obsolete files). Note: this harness snapshots
  available subagent types at session start, so they weren't callable via
  the Agent tool in the same session they were created — should be
  available from a fresh session onward.

## A note on verifying in this sandbox

WebGL renders via software (SwiftShader) here — a single screenshot of the
piano/particle scenes can take up to ~25s, and GSAP tweens/ScrollTrigger
scrubs triggered right as the page does heavy synchronous setup can appear
to "jump" to their end state almost instantly in wall-clock terms. That's
this sandbox's frame pacing under heavy synchronous load, not a code bug.
Prefer reading back actual constructed values (`camera.position`, DOM
classes, computed styles, `innerText`) over trying to time a screenshot to
an exact frame. Separately: this sandbox cannot reach `youtube.com` at all
(works for most other hosts, including `google.com`) — treat both YouTube-
dependent features as untestable here specifically, not broken.
