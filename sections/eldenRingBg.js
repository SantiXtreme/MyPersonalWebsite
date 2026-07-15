// Hobbies section background — "The Beauty of ELDEN RING" (a4XWVqXhBRI), a
// third-party fan cinematic, used via a real YouTube embed rather than a
// downloaded/rehosted file (same reasoning as shared/recital.js's YouTube
// song: never rip/rehost someone else's video — user-confirmed this embed
// approach is fine here since it's just representing "this is a hobby," not
// claiming the footage). Muted/autoplay, starts at 5:28 and loops back to
// 5:28 (not 0:00) on end, styled full-bleed via CSS with pointer-events:none
// so it reads as scenery, not a video player.
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

  async function mount() {
    const YT = await loadYouTubeAPI();
    player = await new Promise((resolve) => {
      const p = new YT.Player(holder, {
        videoId: VIDEO_ID,
        playerVars: {
          start: START_S,
          autoplay: 0,
          mute: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          fs: 0,
        },
        events: {
          onReady: () => {
            ready = true;
            resolve(p);
            if (wantsPlaying) p.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) {
              p.seekTo(START_S, true);
              if (wantsPlaying) p.playVideo();
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
      if (ready) player.playVideo();
    },
    pause() {
      wantsPlaying = false;
      if (ready) player.pauseVideo();
    },
    dispose() {
      player?.destroy?.();
      holder.remove();
    },
  };
}
