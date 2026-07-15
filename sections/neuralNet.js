// Machine Learning hero background — a layered neural net, signal pulses
// flowing left (input) to right (output) on drifting, gently breathing
// nodes. Canvas 2D (not WebGL): a diagram like this is just circles + lines
// + traveling dots, and 2D's 'lighter' composite gives the same glow-y read
// the rest of the site uses (scene3d.js's particles, the old Cadenza canvas)
// without spinning up a second renderer for something this simple.
//
// Usage:
//   const net = createNeuralNet(canvasEl);
//   net.activate();   // scrolled into view — runs the build-in, then loops
//   net.deactivate();  // scrolled away — stops the RAF loop
//   net.dispose();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const LAYER_SIZES = [4, 6, 7, 6, 3];
const COLOR_IN = [122, 178, 255]; // cool blue — matches the site's ML/math palette
const COLOR_OUT = [200, 226, 255];

export function createNeuralNet(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  let layers = []; // [{x, nodes:[{y, phase, r}]}]
  let edges = []; // {a, b} node refs, with a persistent pulse pool
  let pulses = []; // {edge, t, speed, color}
  let builtIn = 0; // 0..1 layer-by-layer reveal progress
  let active = false;
  let raf = null;
  let last = 0;
  let spawnAcc = 0;

  function layout() {
    layers = LAYER_SIZES.map((count, li) => {
      const x = W * (0.1 + (li / (LAYER_SIZES.length - 1)) * 0.8);
      const nodes = Array.from({ length: count }, (_, i) => {
        const y = H * (0.5 + (i - (count - 1) / 2) * (0.62 / Math.max(count - 1, 1)));
        return { x, y, baseY: y, phase: Math.random() * Math.PI * 2, r: 3.2 + Math.random() * 1.6, li };
      });
      return { x, nodes };
    });
    edges = [];
    for (let li = 0; li < layers.length - 1; li++) {
      for (const a of layers[li].nodes) {
        for (const b of layers[li + 1].nodes) {
          if (Math.random() < 0.72) edges.push({ a, b });
        }
      }
    }
  }

  function resize() {
    W = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
    H = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layout();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function mixColor(t) {
    return [
      Math.round(lerp(COLOR_IN[0], COLOR_OUT[0], t)),
      Math.round(lerp(COLOR_IN[1], COLOR_OUT[1], t)),
      Math.round(lerp(COLOR_IN[2], COLOR_OUT[2], t)),
    ];
  }

  function spawnPulse() {
    const startLayer = Math.floor(Math.random() * (layers.length - 1));
    const candidates = edges.filter((e) => e.a.li === startLayer);
    if (!candidates.length) return;
    const edge = candidates[Math.floor(Math.random() * candidates.length)];
    pulses.push({ edge, t: 0, speed: 0.9 + Math.random() * 0.6, color: mixColor(startLayer / (layers.length - 2 || 1)) });
  }

  function draw(dt, tGlobal) {
    ctx.clearRect(0, 0, W, H);

    // gentle node breathing (idle drift), gated by per-layer reveal progress
    layers.forEach((layer, li) => {
      const layerReveal = clamp(builtIn * layers.length - li, 0, 1);
      layer.nodes.forEach((n) => {
        n.y = n.baseY + Math.sin(tGlobal * 0.0006 + n.phase) * 5 * layerReveal;
      });
    });

    // edges
    ctx.lineWidth = 1;
    for (const e of edges) {
      const revealA = clamp(builtIn * layers.length - e.a.li, 0, 1);
      const revealB = clamp(builtIn * layers.length - e.b.li, 0, 1);
      const reveal = Math.min(revealA, revealB);
      if (reveal <= 0) continue;
      ctx.strokeStyle = `rgba(140,180,255,${0.07 * reveal})`;
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    }

    // traveling pulses
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    pulses.forEach((p) => {
      p.t += dt * 0.001 * p.speed;
      const { a, b } = p.edge;
      const x = lerp(a.x, b.x, clamp(p.t, 0, 1));
      const y = lerp(a.y, b.y, clamp(p.t, 0, 1));
      const [r, g, bl] = p.color;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 9);
      grad.addColorStop(0, `rgba(${r},${g},${bl},0.9)`);
      grad.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    pulses = pulses.filter((p) => p.t < 1);

    // nodes
    layers.forEach((layer, li) => {
      const reveal = clamp(builtIn * layers.length - li, 0, 1);
      if (reveal <= 0) return;
      layer.nodes.forEach((n) => {
        const [r, g, b] = mixColor(li / (layers.length - 1));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.4);
        glow.addColorStop(0, `rgba(${r},${g},${b},${0.55 * reveal})`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = `rgba(${r + 30},${g + 30},${b + 10},${reveal})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  function step(now) {
    if (!active) {
      raf = null;
      return;
    }
    const dt = Math.min(48, now - last || 16);
    last = now;

    if (builtIn < 1) builtIn = Math.min(1, builtIn + dt * 0.00028);

    spawnAcc -= dt;
    if (spawnAcc <= 0 && builtIn > 0.15) {
      spawnPulse();
      spawnAcc = 90 + Math.random() * 140;
    }

    draw(dt, now);
    raf = requestAnimationFrame(step);
  }

  return {
    activate() {
      active = true;
      if (REDUCED) {
        builtIn = 1;
        draw(16, performance.now());
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
