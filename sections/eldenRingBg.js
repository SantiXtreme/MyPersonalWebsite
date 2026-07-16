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
// The iframe stays invisible (`.ready` class not yet added) until
// onStateChange actually reports PLAYING — YouTube's "unstarted/cueing"
// state shows its own title-card + big play/pause icon UI regardless of
// `controls:0` (that param only hides the persistent control bar during
// real playback), and on a real network that loading window is visible
// long enough to read as "YouTube chrome is stuck on this background."
// Hiding the iframe until truly playing sidesteps that outright instead of
// trying to shrink the loading window.
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

export function createEldenRingBackground(container) {
  const holder = document.createElement('div');
  holder.className = 'eldenring-bg-frame';
  container.appendChild(holder);

  let player = null;
  let ready = false;
  let wantsPlaying = false;

  function requestPlay(p) {
    // Belt-and-suspenders: autoplay:1 + mute:1 in playerVars should be
    // enough, but an explicit JS-level mute() immediately before
    // playVideo() has proven more reliable against strict autoplay
    // policies in the wild than the URL param alone in some browsers.
    p.mute();
    p.playVideo();
  }

  async function mount() {
    const YT = await loadYouTubeAPI();
    player = await new Promise((resolve) => {
      const p = new YT.Player(holder, {
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
              holder.classList.add('ready');
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
      holder.classList.remove('ready');
      if (ready) player.pauseVideo();
    },
    dispose() {
      player?.destroy?.();
      holder.remove();
    },
  };
}
