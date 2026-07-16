// Hobbies section background — "The Beauty of ELDEN RING" (a4XWVqXhBRI), a
// third-party fan cinematic, used via a real YouTube embed rather than a
// downloaded/rehosted file (same reasoning as shared/recital.js's YouTube
// song: never rip/rehost someone else's video — user-confirmed this embed
// approach is fine here since it's just representing "this is a hobby," not
// claiming the footage). Muted/autoplay, starts at 5:28 and loops back to
// 5:28 (not 0:00) on end, styled full-bleed via CSS with pointer-events:none
// so it reads as scenery, not a video player. `mount()` is deferred until
// the section is actually scrolled into view.
//
// `frame` (class `eldenring-bg-frame`) is a stable wrapper that YouTube's
// API never touches; a plain inner `target` div is what's actually passed
// to `new YT.Player()`. This matters because the IFrame API *replaces* the
// element you hand it with a brand-new <iframe> node (per YouTube's own
// docs) — an earlier version of this file passed the classed element
// itself as the target, so every later `holder.classList.add('ready')`
// call was silently writing to a detached, invisible node while the real
// iframe living in the document never got the class. That's what made the
// background disappear outright rather than just show YouTube's chrome
// briefly. Keeping `frame` outside of what the API can replace fixes that
// at the source.
//
// `frame` stays invisible (`.ready` class not yet added) until
// onStateChange actually reports PLAYING — YouTube's "unstarted/cueing"
// state shows its own title-card + big play/pause icon UI regardless of
// `controls:0` (that param only hides the persistent control bar during
// real playback), and on a real network that loading window is visible
// long enough to read as "YouTube chrome is stuck on this background."
// Hiding the frame until truly playing sidesteps that outright instead of
// trying to shrink the loading window. But PLAYING is never guaranteed to
// fire (API script blocked, onReady never called, autoplay stuck) — so
// mount() also carries a hard timeout (READY_FALLBACK_MS) that reveals the
// frame regardless, so the background can't end up permanently blank.
//
// Usage:
//   const bg = createEldenRingBackground(containerEl);
//   await bg.mount();
//   bg.play();
//   bg.pause();
//   bg.dispose();

import { loadYouTubeAPI } from '../shared/recital.js';

const VIDEO_ID = 'a4XWVqXhBRI';
const START_S = 5 * 60 + 28; // 5:28

// Upper bound on how long we wait for a confirmed PLAYING state before
// showing the frame anyway. The YT API script can fail to load (network,
// ad-blocker), onReady can simply never fire, or autoplay can stay stuck
// in CUED/PAUSED — any of those left `.ready` permanently unset before
// this fallback existed, i.e. a section with no background at all. That's
// worse than occasionally showing YouTube's own cued-state chrome for a
// moment, so past this timeout we show the frame regardless of state.
const READY_FALLBACK_MS = 5000;

export function createEldenRingBackground(container) {
  const frame = document.createElement('div');
  frame.className = 'eldenring-bg-frame';
  container.appendChild(frame);

  // Passed to new YT.Player() — the API replaces THIS node with its own
  // <iframe>, so `frame` (above) must never be the node handed to it.
  const target = document.createElement('div');
  frame.appendChild(target);

  let player = null;
  let ready = false;
  let wantsPlaying = false;
  let fallbackTimer = null;

  function requestPlay(p) {
    // Belt-and-suspenders: autoplay:1 + mute:1 in playerVars should be
    // enough, but an explicit JS-level mute() immediately before
    // playVideo() has proven more reliable against strict autoplay
    // policies in the wild than the URL param alone in some browsers.
    p.mute();
    p.playVideo();
  }

  async function mount() {
    fallbackTimer = setTimeout(() => frame.classList.add('ready'), READY_FALLBACK_MS);

    // Bound the API load itself — a bare `loadYouTubeAPI()` await can hang
    // forever if the script never loads, which would also stall the
    // `await eldenRingBg.mount()` caller in main.js and skip play() entirely.
    const YT = await Promise.race([
      loadYouTubeAPI(),
      new Promise((resolve) => setTimeout(() => resolve(null), READY_FALLBACK_MS)),
    ]);
    if (!YT) return; // fallbackTimer above still fires; nothing to mount

    player = await new Promise((resolve) => {
      const p = new YT.Player(target, {
        videoId: VIDEO_ID,
        playerVars: {
          start: START_S,
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          iv_load_policy: 3,
          rel: 0,
          playsinline: 1,
          fs: 0,
        },
        events: {
          onReady: () => {
            ready = true;
            resolve(p);
            if (wantsPlaying) requestPlay(p);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              clearTimeout(fallbackTimer);
              frame.classList.add('ready');
            }
            if (e.data === YT.PlayerState.ENDED) {
              p.seekTo(START_S, true);
              if (wantsPlaying) requestPlay(p);
            }
            // If it lands in PAUSED/CUED while we still want it playing
            // (a stalled autoplay attempt), give it one more nudge rather
            // than sitting there showing YouTube's own paused-state UI.
            if (wantsPlaying && (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.CUED)) {
              requestPlay(p);
            }
          },
        },
      });
    });
  }

  return {
    mount,
    play() {
      wantsPlaying = true;
      if (ready) requestPlay(player);
    },
    pause() {
      wantsPlaying = false;
      frame.classList.remove('ready');
      if (ready) player.pauseVideo();
    },
    dispose() {
      clearTimeout(fallbackTimer);
      player?.destroy?.();
      frame.remove();
    },
  };
}
