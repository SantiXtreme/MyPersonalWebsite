// Hobbies section background — the user's own screen recording of "The
// Beauty of ELDEN RING" (a fan cinematic by DS Cinematics), played as a
// plain local <video> instead of a live YouTube embed.
//
// This is a deliberate, explicitly-confirmed exception to this project's
// standing "never rip or rehost YouTube video" rule: a screen recording of
// someone else's copyrighted video is still that creator's content, not
// footage the user has rights to redistribute, regardless of who did the
// recording. That tradeoff was flagged directly to the user before this
// file was written this way — they confirmed they want the local video
// anyway (reliability over the embed's occasional YouTube-chrome flash and
// this sandbox's YouTube reachability issues in earlier sessions). If this
// ever needs revisiting, the previous YouTube IFrame API version (with its
// own hard-won fixes — a stable wrapper div so the API's element-replacement
// doesn't orphan the visibility class, plus a fallback timer) is in git
// history on this file.
//
// The source recording (~104MB, 1918x1088, 8.8Mbps) was transcoded down to
// ~10MB (1280px wide, ~855kbps, audio stripped — it's muted anyway) via a
// one-off ffmpeg-static pass, same pattern as assets/volleyball's clips.
//
// Usage:
//   const bg = createEldenRingBackground(containerEl);
//   await bg.mount();
//   bg.play();
//   bg.pause();
//   bg.dispose();

import eldenRingVideoUrl from '../assets/hobbies/elden-ring-bg.mp4';

// Ranni's entrance in this clip lands around 0:11 — start (and loop) there
// instead of 0:00 rather than trim the source file itself, so the full
// recording stays intact if the start point ever needs retuning.
const START_TIME = 11;

export function createEldenRingBackground(container) {
  const frame = document.createElement('div');
  frame.className = 'eldenring-bg-frame';
  container.appendChild(frame);

  let video = null;

  async function mount() {
    if (video) return;
    video = document.createElement('video');
    video.src = eldenRingVideoUrl;
    video.muted = true;
    video.loop = false; // looping is handled manually below, seeking back to START_TIME not 0
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = START_TIME;
    }, { once: true });
    // Reveal only once the initial seek to START_TIME actually lands — using
    // 'canplay' here instead would fade the frame in while it's still
    // showing 0:00's thumbnail, a visible flash before the jump to 0:11.
    video.addEventListener('seeked', () => frame.classList.add('ready'), { once: true });
    video.addEventListener('ended', () => {
      video.currentTime = START_TIME;
      video.play().catch(() => {});
    });
    frame.appendChild(video);
  }

  return {
    mount,
    play() {
      if (video && video.currentTime < START_TIME) video.currentTime = START_TIME;
      video?.play().catch(() => {
        /* autoplay can be blocked before any user gesture — harmless,
           the section's own atmosphere gradient still reads fine */
      });
    },
    pause() {
      video?.pause();
    },
    dispose() {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      frame.remove();
    },
  };
}
