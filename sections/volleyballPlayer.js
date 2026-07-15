// Volleyball hero background — the user's own two clips (assets/volleyball/),
// played back to back and looped, crossfading between two stacked <video>
// elements instead of a hard cut on each swap. Muted/autoplay/loop, exactly
// like any other "video as ambient background" element on this site.
//
// Usage:
//   const player = createVolleyballPlayer(containerEl);
//   player.start();
//   player.stop();
//   player.dispose();

import clip1Url from '../assets/volleyball/clip-1.mp4';
import clip2Url from '../assets/volleyball/clip-2.mp4';

const CLIPS = [clip1Url, clip2Url];

export function createVolleyballPlayer(container) {
  const videos = CLIPS.map((src, i) => {
    const v = document.createElement('video');
    v.src = src;
    v.muted = true;
    v.playsInline = true;
    v.preload = i === 0 ? 'auto' : 'metadata';
    v.className = 'volleyball-clip';
    v.style.opacity = i === 0 ? '1' : '0';
    container.appendChild(v);
    return v;
  });

  let current = 0;
  let running = false;

  function playCurrent() {
    const v = videos[current];
    v.currentTime = 0;
    v.play().catch(() => {
      /* autoplay can be blocked before any user gesture — the section's
         static poster frame (first frame, still painted) degrades fine */
    });
  }

  function advance() {
    if (!running) return;
    const next = (current + 1) % videos.length;
    videos[next].currentTime = 0;
    videos[next].play().catch(() => {});
    videos[next].style.opacity = '1';
    videos[current].style.opacity = '0';
    current = next;
  }

  videos.forEach((v) => v.addEventListener('ended', advance));

  return {
    start() {
      if (running) return;
      running = true;
      playCurrent();
    },
    stop() {
      running = false;
      videos.forEach((v) => v.pause());
    },
    dispose() {
      running = false;
      videos.forEach((v) => {
        v.pause();
        v.removeAttribute('src');
        v.load();
        v.remove();
      });
    },
  };
}
