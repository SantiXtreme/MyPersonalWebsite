// Math & Physics hero background — a small gravitational system, bodies
// actually orbiting a central mass under real Newtonian gravity (symplectic-
// Euler integration every frame, not a scripted ellipse). Each body leaves a
// fading trail that traces the literal conic-section curve its orbit
// describes — the math (the ellipse) and the physics (the gravity that
// produces it) are the same picture, computed live like the section's
// previous collision demo was.
//
// Usage:
//   const demo = createOrbitalDemo(canvasEl);
//   demo.activate();   // scrolled into view
//   demo.deactivate();  // scrolled away — stops the RAF loop
//   demo.dispose();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// G*M for the central mass, in canvas-pixel units — tuned so the innermost
// body completes an orbit in a handful of seconds (ambient, not glacial).
const K = 5200;
const TRAIL_LEN = 130;

const BODY_SEEDS = [
  { r: 92, angle: 0.4, color: [122, 178, 255], ecc: 1.0 },
  { r: 152, angle: 2.6, color: [220, 160, 255], ecc: 0.86 },
  { r: 208, angle: 4.6, color: [231, 184, 120], ecc: 0.92 },
];

export function createOrbitalDemo(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  let cx = 0;
  let cy = 0;
  let active = false;
  let raf = null;
  let last = 0;
  let bodies = [];

  function seed(b) {
    const vCirc = Math.sqrt(K / b.r);
    const speed = vCirc * b.ecc;
    return {
      ...b,
      x: cx + Math.cos(b.angle) * b.r,
      y: cy + Math.sin(b.angle) * b.r * 0.5,
      vx: -Math.sin(b.angle) * speed,
      vy: Math.cos(b.angle) * speed * 0.5,
      trail: [],
    };
  }

  function resetBodies() {
    bodies = BODY_SEEDS.map(seed);
  }

  function resize() {
    W = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
    H = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W * 0.64;
    cy = H * 0.52;
    resetBodies();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function drawTrail(b) {
    const [r, g, bl] = b.color;
    const n = b.trail.length;
    for (let i = 1; i < n; i++) {
      const p0 = b.trail[i - 1];
      const p1 = b.trail[i];
      const alpha = (i / n) * 0.4;
      ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Central mass — warm glow, standing in for the sun.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const starGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 48);
    starGlow.addColorStop(0, 'rgba(255,232,196,0.85)');
    starGlow.addColorStop(1, 'rgba(255,232,196,0)');
    ctx.fillStyle = starGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,244,224,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();

    bodies.forEach((b) => {
      drawTrail(b);
      const [r, g, bl] = b.color;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 13);
      glow.addColorStop(0, `rgba(${r},${g},${bl},0.75)`);
      glow.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = `rgba(${r},${g},${bl},0.95)`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Live readout — the innermost body's actual orbital speed, so it
    // reads as computed, not decorative.
    const inner = bodies[0];
    const speed = Math.hypot(inner.vx, inner.vy);
    const r = Math.hypot(inner.x - cx, inner.y - cy);
    ctx.font = '13px Fraunces, Georgia, serif';
    ctx.fillStyle = 'rgba(230,238,255,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(`v = ${speed.toFixed(1)}   r = ${r.toFixed(0)}`, cx - W * 0.3, cy + H * 0.32);
  }

  const SUBSTEPS = 6; // symplectic Euler loses energy on eccentric orbits at
  // a coarse timestep — subdividing per frame keeps close approaches accurate
  // without a fancier integrator.

  function step(now) {
    if (!active) {
      raf = null;
      return;
    }
    const frameDt = Math.min(32, now - last || 16) * 0.09;
    last = now;
    const dt = frameDt / SUBSTEPS;

    bodies.forEach((b, i) => {
      for (let s = 0; s < SUBSTEPS; s++) {
        const dx = cx - b.x;
        const dy = cy - b.y;
        const rr = Math.max(28, Math.hypot(dx, dy));
        const f = K / (rr * rr);
        b.vx += (dx / rr) * f * dt;
        b.vy += (dy / rr) * f * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      // Safety net: a decorative sim doesn't need to be a perfect
      // conservative integrator — if a body ever drifts loose (numerical
      // energy gain on a close pass), just reseed it rather than let it
      // escape to infinity and drag its trail across the whole section.
      const r = Math.hypot(cx - b.x, cy - b.y);
      if (r > BODY_SEEDS[i].r * 2.6) {
        bodies[i] = seed(BODY_SEEDS[i]);
        return;
      }
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > TRAIL_LEN) b.trail.shift();
    });

    draw();
    raf = requestAnimationFrame(step);
  }

  return {
    activate() {
      active = true;
      if (REDUCED) {
        draw();
        return;
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    },
    deactivate() {
      active = false;
    },
    resize,
    dispose() {
      active = false;
      ro.disconnect();
    },
  };
}
