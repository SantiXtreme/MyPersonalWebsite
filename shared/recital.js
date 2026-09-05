// Shared "recital" player: three songs, one unified play/pause API, driving
// a host 3D piano's pressKey(midi) for each one.
//
// - The local file (fully in our control) gets REAL audio-reactive key
//   triggering via a WebAudio AnalyserNode reading the actual frequency
//   content as it plays.
// - YouTube / SoundCloud are official embeds (never rip/rehost their
//   audio — that's both against their ToS and just not something to do).
//   Cross-origin embeds give no access to the audio samples, so those two
//   get a tasteful generative "performance" pattern instead — clearly
//   documented here as generative, not pretending to be note-accurate.
//
// Usage:
//   const player = createRecitalPlayer({ onNote: (midi, opts) => piano.pressKey(midi, opts) });
//   await player.load('liebestraum');
//   player.play();

import liebestraumUrl from './audio/liebestraum-no3.mp3';

export const SONGS = [
  {
    id: 'liebestraum',
    title: 'Liebestraum No. 3',
    subtitle: 'Franz Liszt',
    type: 'local',
  },
  {
    id: 'experience',
    title: 'Experience',
    subtitle: 'Ludovico Einaudi (solo piano)',
    type: 'youtube',
    youtubeId: 'oXjrUUQYuww',
  },
  {
    id: 'ifiamwithyou',
    title: 'If I Am With You',
    subtitle: 'Jujutsu Kaisen Season 2 OST',
    type: 'soundcloud',
    soundcloudUrl: 'https://soundcloud.com/angvls/if-i-am-with-you',
  },
];

// A generic, always-pleasant pentatonic pool (not the real piece's key —
// this is a generative stand-in, see file header) spanning a few octaves.
const PENTATONIC = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];

// ---------------------------------------------------------------------
// Per-piece "reactive personality" — every song drives the piano the same
// way mechanically (onNote(midi, opts) -> piano.pressKey), but each one
// should *feel* distinct, not just play different notes. This is the one
// place that difference is authored, so both concepts (and any future one)
// automatically pick it up through the same onNote callback they already
// wire up.
//   - color: tints the host's accent-light/particle burst for this piece.
//   - sustainBase/sustainJitter: how long a struck key visually stays down
//     (piano3d.js's pressKey stretches its hold time from this) — the
//     cheap knob that makes a piece read as legato/spacious vs. brisk.
//   - velocityFloor/velocityCeil: the dynamic range notes are drawn from.
//   - bandTuning: only used by the real analyser (Liebestraum) — per-band
//     onset cooldown/threshold, so the *real* audio-reactivity still has a
//     distinct character rather than one fixed sensitivity for every piece.
//   - noteMs/spread: only used by the generative performer (Experience,
//     If I Am With You) — timing/register-drift of the virtual performance.
export const PERFORMANCE_PROFILES = {
  liebestraum: {
    color: 0xe9b56a, // warm amber — Romantic, rubato
    sustainBase: 1.55,
    sustainJitter: 0.9, // occasional notes held much longer (simulated pedal)
    velocityFloor: 0.4,
    velocityCeil: 1.0, // wide dynamic swing
    bandTuning: {
      bass: { cooldown: 190, threshold: 26 },
      mid: { cooldown: 130, threshold: 24 },
      treble: { cooldown: 95, threshold: 21 },
    },
  },
  experience: {
    color: 0x8fc7cf, // cool, spacious — Einaudi
    sustainBase: 2.0,
    sustainJitter: 0.25,
    velocityFloor: 0.35,
    velocityCeil: 0.68,
    noteMs: 460,
    spread: 2,
  },
  ifiamwithyou: {
    color: 0xdd93ab, // warmer, more emotive, denser — JJK OST
    sustainBase: 0.95,
    sustainJitter: 0.5,
    velocityFloor: 0.55,
    velocityCeil: 1.0,
    noteMs: 260,
    spread: 4,
  },
};
const DEFAULT_PROFILE = {
  color: 0xc9a86a,
  sustainBase: 1.1,
  sustainJitter: 0.3,
  velocityFloor: 0.5,
  velocityCeil: 0.9,
  noteMs: 340,
  spread: 3,
};

// ---------------------------------------------------------------------
// Generative "virtual performance" — used for youtube/soundcloud, and as
// a graceful fallback if WebAudio analysis can't start for the local file.
// ---------------------------------------------------------------------
function createGenerativePerformer(onNote, profile = DEFAULT_PROFILE) {
  const { noteMs, spread, color, sustainBase, sustainJitter, velocityFloor, velocityCeil } = {
    ...DEFAULT_PROFILE,
    ...profile,
  };
  let timer = null;
  let idx = Math.floor(PENTATONIC.length / 2);

  function step() {
    idx = Math.max(0, Math.min(PENTATONIC.length - 1, idx + Math.floor((Math.random() - 0.5) * (spread * 2 + 1))));
    const midi = PENTATONIC[idx];
    const velocity = velocityFloor + Math.random() * (velocityCeil - velocityFloor);
    const sustain = sustainBase + (Math.random() - 0.5) * 2 * sustainJitter;
    onNote(midi, { velocity, sustain, color });
    const jitter = noteMs * (0.75 + Math.random() * 0.5);
    timer = setTimeout(step, jitter);
  }

  return {
    start() {
      if (timer) return;
      step();
    },
    stop() {
      clearTimeout(timer);
      timer = null;
    },
  };
}

// ---------------------------------------------------------------------
// Real audio-reactive analysis — local file only.
// ---------------------------------------------------------------------
function createReactiveAnalyser(audioEl, onNote, profile = DEFAULT_PROFILE) {
  const { color, sustainBase, sustainJitter, bandTuning = {} } = { ...DEFAULT_PROFILE, ...profile };
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaElementSource(audioEl);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.55;
  source.connect(analyser);
  analyser.connect(ctx.destination);

  const data = new Uint8Array(analyser.frequencyBinCount);
  const bands = [
    { name: 'bass', from: 1, to: 10, ema: 0, last: 0, cooldown: 160, threshold: 28, range: [36, 52] },
    { name: 'mid', from: 10, to: 60, ema: 0, last: 0, cooldown: 110, threshold: 28, range: [53, 72] },
    { name: 'treble', from: 60, to: 160, ema: 0, last: 0, cooldown: 90, threshold: 28, range: [73, 93] },
  ];
  bands.forEach((b) => Object.assign(b, bandTuning[b.name]));

  let rafId = null;
  function bandEnergy(from, to) {
    let sum = 0;
    for (let i = from; i < to && i < data.length; i++) sum += data[i];
    return sum / (to - from);
  }

  function tick(t) {
    analyser.getByteFrequencyData(data);
    bands.forEach((b) => {
      const e = bandEnergy(b.from, b.to);
      b.ema = b.ema === 0 ? e : b.ema * 0.9 + e * 0.1;
      const onset = e > b.threshold && e > b.ema * 1.35 && t - b.last > b.cooldown;
      if (onset) {
        b.last = t;
        const midi = b.range[0] + Math.floor(Math.random() * (b.range[1] - b.range[0]));
        const velocity = Math.min(1, 0.5 + e / 255);
        const sustain = sustainBase + (Math.random() - 0.5) * 2 * sustainJitter;
        onNote(midi, { velocity, sustain, color });
      }
    });
    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (ctx.state === 'suspended') ctx.resume();
      if (!rafId) rafId = requestAnimationFrame(tick);
    },
    stop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    },
    dispose() {
      this.stop();
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        /* already disconnected */
      }
      ctx.close();
    },
  };
}

// ---------------------------------------------------------------------
// YouTube IFrame API loader (singleton — safe to call from both concepts
// if a page ever needed two players, though in practice each mounts one).
// ---------------------------------------------------------------------
let ytApiPromise = null;
export function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

let scApiPromise = null;
function loadSoundCloudAPI() {
  if (window.SC && window.SC.Widget) return Promise.resolve(window.SC);
  if (scApiPromise) return scApiPromise;
  scApiPromise = new Promise((resolve) => {
    const tag = document.createElement('script');
    tag.src = 'https://w.soundcloud.com/player/api.js';
    tag.onload = () => resolve(window.SC);
    document.head.appendChild(tag);
  });
  return scApiPromise;
}

// ---------------------------------------------------------------------
// Neither the YouTube IFrame API script nor the SoundCloud widget's READY
// event carry any built-in failure signal — if the API script never loads
// (blocked host, ad blocker, a flaky connection) the promises awaited below
// simply never settle. Without a bound on that wait, load() never resolves
// OR rejects, so main.js's click handler (loadingSong = true until its
// try/finally settles) gets stuck forever — every subsequent song click,
// including picking a totally unrelated local song, silently no-ops. This is
// the real cause behind "Liebestraum's background only works if it's picked
// first": whichever song is clicked first always works fine, but if an
// earlier click on Experience/If I Am With You ever hangs, nothing after it
// can ever load again without a full page reload. Confirmed via a live
// repro in this exact sequence before writing this fix.
const EMBED_TIMEOUT_MS = 9000;
function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), EMBED_TIMEOUT_MS)),
  ]);
}

export function createRecitalPlayer({ mediaContainer, onNote = () => {}, onStateChange = () => {} }) {
  let activeSongId = null;
  let cleanupFns = [];
  let performer = null; // generative or reactive-analyser instance
  let isPlaying = false;
  // Bumped on every teardown so a late-firing event from an embed that was
  // still spinning up when the user moved on (e.g. a YouTube player whose
  // onReady/onStateChange fires well after its load() already timed out)
  // can tell it's orphaned and ignore itself, instead of stomping the
  // currently active song's status/tint with stale data.
  let loadToken = 0;

  function teardown() {
    loadToken++;
    performer?.stop();
    performer?.dispose?.();
    performer = null;
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    if (mediaContainer) mediaContainer.innerHTML = '';
    isPlaying = false;
  }

  async function load(songId) {
    teardown();
    const myToken = loadToken;
    const song = SONGS.find((s) => s.id === songId);
    if (!song) throw new Error(`Unknown song: ${songId}`);
    activeSongId = songId;
    const profile = PERFORMANCE_PROFILES[songId] || DEFAULT_PROFILE;

    if (song.type === 'local') {
      const audio = new Audio(liebestraumUrl);
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      if (mediaContainer) {
        audio.controls = true;
        audio.style.width = '100%';
        mediaContainer.appendChild(audio);
      }
      audio.addEventListener('ended', () => {
        isPlaying = false;
        onStateChange({ playing: false, ended: true, songId });
      });
      cleanupFns.push(() => audio.pause());

      return {
        song,
        el: audio,
        play: () => {
          audio.play();
          if (!performer) {
            // Real audio-reactive analysis for the file we fully control;
            // fall back to the generative performer if AnalyserNode setup
            // ever fails (e.g. a browser blocking AudioContext for some
            // reason) so the piano still animates either way.
            try {
              performer = createReactiveAnalyser(audio, onNote, profile);
            } catch {
              performer = createGenerativePerformer(onNote, { ...profile, noteMs: 260 });
            }
          }
          performer.start();
          isPlaying = true;
          onStateChange({ playing: true, songId });
        },
        pause: () => {
          audio.pause();
          performer?.stop();
          isPlaying = false;
          onStateChange({ playing: false, songId });
        },
      };
    }

    if (song.type === 'youtube') {
      const holder = document.createElement('div');
      if (mediaContainer) mediaContainer.appendChild(holder);
      const YT = await withTimeout(loadYouTubeAPI(), 'YouTube API');
      const player = await withTimeout(
        new Promise((resolve) => {
          const p = new YT.Player(holder, {
            videoId: song.youtubeId,
            width: '100%',
            height: '220',
            playerVars: { rel: 0, modestbranding: 1 },
            events: {
              onReady: () => resolve(p),
              onStateChange: (e) => {
                if (myToken !== loadToken) return; // orphaned player, superseded — see file header note
                if (e.data === YT.PlayerState.PLAYING) {
                  performer?.start();
                  isPlaying = true;
                  onStateChange({ playing: true, songId });
                } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                  performer?.stop();
                  isPlaying = false;
                  onStateChange({ playing: false, ended: e.data === YT.PlayerState.ENDED, songId });
                }
              },
            },
          });
        }),
        'YouTube player'
      );
      cleanupFns.push(() => player.destroy?.());
      performer = createGenerativePerformer(onNote, profile); // Einaudi-esque: sparse, spacious (see PERFORMANCE_PROFILES.experience)

      return {
        song,
        play: () => player.playVideo(),
        pause: () => player.pauseVideo(),
      };
    }

    if (song.type === 'soundcloud') {
      const iframe = document.createElement('iframe');
      iframe.width = '100%';
      iframe.height = '166';
      iframe.frameBorder = '0';
      iframe.allow = 'autoplay';
      iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(song.soundcloudUrl)}&color=%23e8c873&auto_play=false&show_teaser=false`;
      if (mediaContainer) mediaContainer.appendChild(iframe);
      const SC = await withTimeout(loadSoundCloudAPI(), 'SoundCloud API');
      const widget = SC.Widget(iframe);
      await withTimeout(new Promise((resolve) => widget.bind(SC.Widget.Events.READY, resolve)), 'SoundCloud widget');
      widget.bind(SC.Widget.Events.PLAY, () => {
        if (myToken !== loadToken) return; // orphaned widget, superseded — see file header note
        performer?.start();
        isPlaying = true;
        onStateChange({ playing: true, songId });
      });
      widget.bind(SC.Widget.Events.PAUSE, () => {
        if (myToken !== loadToken) return;
        performer?.stop();
        isPlaying = false;
        onStateChange({ playing: false, songId });
      });
      widget.bind(SC.Widget.Events.FINISH, () => {
        if (myToken !== loadToken) return;
        performer?.stop();
        isPlaying = false;
        onStateChange({ playing: false, ended: true, songId });
      });
      cleanupFns.push(() => iframe.remove());
      performer = createGenerativePerformer(onNote, profile); // more emotive/dense (see PERFORMANCE_PROFILES.ifiamwithyou)

      return {
        song,
        play: () => widget.play(),
        pause: () => widget.pause(),
      };
    }

    throw new Error(`Unhandled song type: ${song.type}`);
  }

  let handle = null;
  return {
    songs: SONGS,
    async load(songId) {
      handle = await load(songId);
      return handle;
    },
    play() {
      handle?.play();
    },
    pause() {
      handle?.pause();
    },
    get isPlaying() {
      return isPlaying;
    },
    get activeSongId() {
      return activeSongId;
    },
    dispose: teardown,
  };
}
