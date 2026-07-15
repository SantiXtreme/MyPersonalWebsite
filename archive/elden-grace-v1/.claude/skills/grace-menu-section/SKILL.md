---
name: grace-menu-section
description: Use when adding, removing, or reordering an option in the Site of Grace menu on this personal site (e.g. a new "Reading" or "Speedruns" entry alongside ML Projects/Piano/Hobbies). Also use when a section's content needs updating but you're unsure where the data lives. Covers the content.js registry, the section module contract, icon authoring, and the visual/motion rules that keep new sections consistent with the Elden Ring theme.
---

# Adding a Grace Menu section

This site's menu (`src/modules/menu.js`) and panel router
(`src/modules/panels.js`) are both driven by one registry in
`src/data/content.js`. You should almost never need to touch `menu.js` or
`panels.js` to add a section — they just render whatever is registered.

## Steps

1. **Register the option in `src/data/content.js`.**
   Add an entry to the `graceMenu` array:
   ```js
   {
     id: 'reading',              // kebab-case, used as the DOM id + localStorage scoping
     label: 'Reading',           // shown in the menu list, Cinzel small-caps styling is automatic
     icon: 'reading',            // matches src/assets/icons/reading.svg (see step 3)
     summary: 'Books that shaped the build.', // one-liner, used for the hover/focus description row
   }
   ```
   Order in the array is order in the menu. `leave` is always injected last
   by `menu.js` — don't add it yourself.

2. **Create the section module** at
   `src/modules/sections/reading.js`:
   ```js
   export function render(container) {
     container.innerHTML = `
       <header class="panel-header">
         <h2>Reading</h2>
         <p class="panel-summary">Books that shaped the build.</p>
       </header>
       <div class="panel-body">
         <!-- section markup -->
       </div>
     `;
     // wire up any listeners here
   }

   export function cleanup() {
     // optional: remove listeners/intervals/audio nodes started in render()
   }
   ```
   Register it in the `sectionModules` map at the top of
   `src/modules/panels.js` (`id -> () => import('./sections/reading.js')`).
   Panels are lazy-loaded on first open, so this is a dynamic import, not a
   static one — follow the existing entries' pattern exactly.

3. **Add an icon** at `src/assets/icons/reading.svg`. Rules for consistency:
   - Single color, `stroke="currentColor"`, no fills baked in — color comes
     from CSS so it inherits the current flask/accent theme.
   - ~24x24 viewBox, ~1.5px stroke weight, matches the rest of the set (open
     `src/assets/icons/flask.svg` or `rune.svg` as a template).
   - Simple/geometric "rune tablet" feel — not a literal brand logo, not
     skeuomorphic detail. If the option links to a real platform (GitHub,
     Instagram, email), a recognizable minimal glyph is fine; keep the line
     weight and simplicity consistent with the rest of the set so it reads
     as "one system," not a mixed icon pack.

4. **Style it.** Layout rules for each section type live in
   `src/style/sections.css`, one block per section id
   (`#panel-reading { ... }`). Reuse the shared `.panel-header`,
   `.panel-summary`, `.card`, `.medallion`, `.rune-button` classes from
   `src/style/panel.css` before inventing new ones — the whole site should
   look hand-cut from the same stone, not like six different pages.
   Always reference `var(--accent-*)` for any "highlight" color, never a
   literal hex — this is what makes Adjust Flasks re-theme the whole site
   instead of just the menu.

5. **Respect motion + a11y defaults.** If the section animates anything on
   its own (like the Level Up rune burst or the Piano key press glow), guard
   it with `motionPrefs.reduced` from `src/modules/motionPrefs.js` and make
   sure every interactive element is a real `<button>`/`<a>` (not a `<div
   onclick>`) so the existing focus-trap and keyboard nav in `menu.js`/
   `panels.js` keep working without extra wiring.

6. **Placeholder content.** If you don't have real copy (bio text, a real
   project link, a real photo), write a short placeholder and prefix it with
   `TODO(santiago):` in a comment right above where it's rendered, e.g.
   `<!-- TODO(santiago): replace with real project link -->`. Don't invent
   specifics (numbers, dates, achievements) — vague-but-honest placeholder
   copy is fine, fabricated facts are not.

## If the section needs to apply before first paint or feed the HUD

Sections like Adjust Flasks and Pass Time change something visible the
instant the page loads (a returning visitor's saved theme/time), and Level
Up feeds the HUD rune counter — none of that can wait for a lazy-loaded
panel module. The pattern: put the actual state (localStorage read/write +
the DOM mutation, e.g. `flaskTheme.js`, `timeOfDay.js`, `levelupState.js`)
in a small **always-loaded** module imported directly by `main.js`, and have
the lazy `sections/*.js` panel module import from *that* module rather than
owning the state itself. Don't duplicate persistence logic inside a lazy
section module if the effect needs to be visible outside of it.

## Removing or reordering

Just edit/remove the `graceMenu` array entry in `content.js`. Delete the
matching section module and icon if the entry is gone for good — don't leave
orphaned files. Currently there are 9 options + Leave (10 total), matching
the count in `design-reference/NEW_RFERENCE.webp` — that count was a
deliberate choice, not a coincidence, so if you add/remove one, mention it
to the user rather than silently drifting from the reference.

## Quick sanity check after any change

Run `npm run dev`, open the grace, and confirm:
- The new row appears in the menu with correct label + icon.
- ↑/↓ reaches it and Enter opens it; Esc/Back returns to the menu.
- The panel matches the stone/gold shell of every other section (no stray
  white backgrounds, no off-theme fonts/colors).
- No console errors on open/close/reopen (checks `cleanup()` is correct).
