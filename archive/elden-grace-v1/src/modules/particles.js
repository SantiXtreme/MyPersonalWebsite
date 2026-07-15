import { motionPrefs } from './motionPrefs.js';

const MAX_PARTICLES_DESKTOP = 90;
const MAX_PARTICLES_MOBILE = 36;
const MAX_PARTICLES_REDUCED = 16;

function makeSprite(core, mid, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, core);
  g.addColorStop(0.4, mid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/**
 * A self-contained rising-ember canvas field, evoking the Site of Grace
 * flame's sparks. Spawns mostly near a settable emitter point (the grace
 * symbol) plus a thin ambient scatter across the whole scene.
 */
export function createEmberField(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let emitter = { x: 0.5, y: 0.82 };
  let running = false;
  let rafId = null;
  let lastSpawn = 0;
  let lastT = 0;

  const spriteGold = makeSprite('rgba(255,244,214,0.95)', 'rgba(255,190,110,0.55)', 64);
  const spriteEmber = makeSprite('rgba(255,205,160,0.9)', 'rgba(255,110,40,0.45)', 64);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.max(1, width * dpr);
    canvas.height = Math.max(1, height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function maxCount() {
    if (motionPrefs.reduced) return MAX_PARTICLES_REDUCED;
    return width < 760 ? MAX_PARTICLES_MOBILE : MAX_PARTICLES_DESKTOP;
  }

  function spawn() {
    const nearEmitter = Math.random() < 0.6;
    const x = nearEmitter
      ? emitter.x * width + (Math.random() - 0.5) * width * 0.1
      : Math.random() * width;
    const y = nearEmitter ? emitter.y * height : height + 10;
    const speed = motionPrefs.reduced ? 5 : 9 + Math.random() * 17;
    particles.push({
      x,
      y,
      vy: -speed,
      vx: (Math.random() - 0.5) * 5,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.4 + Math.random() * 1.1,
      size: 3.5 + Math.random() * 6.5,
      life: 0,
      maxLife: 4200 + Math.random() * 4200,
      sprite: Math.random() < 0.5 ? spriteGold : spriteEmber,
      flicker: Math.random() * Math.PI * 2,
    });
  }

  function step(t, dt) {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    const spawnInterval = motionPrefs.reduced ? 650 : 150;
    if (t - lastSpawn > spawnInterval && particles.length < maxCount()) {
      spawn();
      lastSpawn = t;
    }

    particles = particles.filter((p) => {
      p.life += dt;
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio >= 1) return false;

      p.sway += p.swaySpeed * dt * 0.001;
      p.x += (p.vx + Math.sin(p.sway) * 8) * dt * 0.001;
      p.y += p.vy * dt * 0.001;
      p.flicker += dt * 0.006;

      const fadeIn = lifeRatio < 0.15 ? lifeRatio / 0.15 : 1;
      const fadeOut = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 1;
      const flicker = 0.7 + Math.sin(p.flicker) * 0.3;
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut) * flicker);
      const size = p.size * (0.8 + fadeIn * 0.4);

      ctx.globalAlpha = alpha;
      ctx.drawImage(p.sprite, p.x - size, p.y - size, size * 2, size * 2);

      return p.y > -20 && p.x > -20 && p.x < width + 20;
    });

    ctx.globalAlpha = 1;
  }

  function loop(t) {
    if (!running) return;
    const dt = lastT ? Math.min(t - lastT, 48) : 16;
    lastT = t;
    step(t, dt);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setEmitter(xNorm, yNorm) {
    emitter = { x: xNorm, y: yNorm };
  }

  resize();
  window.addEventListener('resize', resize);

  return { start, stop, setEmitter, resize };
}
