// Math & Physics hero background — two blocks colliding on a track, real
// elastic-collision math (momentum + kinetic energy both conserved, not a
// scripted bounce), redrawing live velocity vectors and a momentum readout
// so the physics is actually being computed, not just animated to look like
// it. Loops: blocks reset off-screen and re-approach after separating.
//
// Usage:
//   const demo = createCollisionDemo(canvasEl);
//   demo.activate();
//   demo.deactivate();
//   demo.dispose();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createCollisionDemo(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  let trackY = 0;
  let active = false;
  let raf = null;
  let last = 0;

  // Masses in arbitrary units — block SIZE scales with mass so "heavier"
  // reads visually, not just numerically.
  const M1 = 2.2;
  const M2 = 1.4;
  let collided = false;
  let blocks;

  function resetBlocks() {
    collided = false;
    blocks = [
      { m: M1, x: -0.18, v: 0.16, w: 0.11, h: 0.11 * 0.8, color: [122, 178, 255] },
      { m: M2, x: 1.18, v: -0.12, w: 0.085, h: 0.085 * 0.8, color: [220, 200, 160] },
    ];
  }
  resetBlocks();

  function resize() {
    W = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
    H = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    trackY = H * 0.56;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // 1D elastic collision: both momentum (sum m*v) and kinetic energy
  // (sum 1/2 m v^2) are conserved. Standard closed-form solution.
  function resolveElasticCollision(b1, b2) {
    const { m: m1, v: v1 } = b1;
    const { m: m2, v: v2 } = b2;
    const v1f = ((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2);
    const v2f = ((m2 - m1) * v2 + 2 * m1 * v1) / (m1 + m2);
    b1.v = v1f;
    b2.v = v2f;
  }

  function px(x) {
    return W * (0.5 + (x - 0.5) * 0.72);
  }

  function drawArrow(x, y, len, color, label) {
    if (Math.abs(len) < 0.001) return;
    const dir = Math.sign(len);
    const ax = x + len * 220;
    ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.85)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ax, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax, y);
    ctx.lineTo(ax - dir * 8, y - 5);
    ctx.lineTo(ax - dir * 8, y + 5);
    ctx.closePath();
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.85)`;
    ctx.fill();
    if (label) {
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.85)`;
      ctx.fillText(label, ax + dir * 10 + (dir < 0 ? -46 : 0), y + 4);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // track line
    ctx.strokeStyle = 'rgba(200,215,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(-0.3), trackY + 40);
    ctx.lineTo(px(1.3), trackY + 40);
    ctx.stroke();

    blocks.forEach((b) => {
      const x = px(b.x);
      const w = b.w * W * 0.55;
      const h = b.h * W * 0.55;
      const [r, g, bl] = b.color;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(x, trackY, 0, x, trackY, w * 1.4);
      glow.addColorStop(0, `rgba(${r},${g},${bl},0.28)`);
      glow.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - w * 1.4, trackY - w * 1.4, w * 2.8, w * 2.8);
      ctx.restore();

      ctx.fillStyle = `rgba(${r},${g},${bl},0.16)`;
      ctx.strokeStyle = `rgba(${r},${g},${bl},0.75)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, trackY - h, w, h, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = `rgba(${r},${g},${bl},0.9)`;
      ctx.textAlign = 'center';
      ctx.fillText(`m = ${b.m.toFixed(1)}`, x, trackY - h - 10);

      drawArrow(x, trackY - h / 2, b.v, b.color, `p = ${(b.m * b.v).toFixed(2)}`);
    });
    ctx.textAlign = 'left';

    // total momentum readout — should read (near) constant across the collision
    const totalP = blocks[0].m * blocks[0].v + blocks[1].m * blocks[1].v;
    ctx.font = '13px Fraunces, Georgia, serif';
    ctx.fillStyle = 'rgba(230,238,255,0.55)';
    ctx.fillText(`Σp = ${totalP.toFixed(2)}`, px(-0.3), trackY + 70);
  }

  function step(now) {
    if (!active) {
      raf = null;
      return;
    }
    const dt = Math.min(32, now - last || 16);
    last = now;

    const [b1, b2] = blocks;
    b1.x += b1.v * dt * 0.001;
    b2.x += b2.v * dt * 0.001;

    if (!collided) {
      const gap = b2.x - b1.x;
      const touchDist = (b1.w + b2.w) / 2;
      if (gap <= touchDist) {
        resolveElasticCollision(b1, b2);
        collided = true;
      }
    }

    if (b1.x < -0.3 || b1.x > 1.3 || b2.x < -0.3 || b2.x > 1.3) {
      resetBlocks();
    }

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
