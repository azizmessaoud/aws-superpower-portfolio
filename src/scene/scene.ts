/* Hero scene runtime: a point-cloud brain inside a sphere of skill nodes (soul of projectx0's NeuralField).
 * On open the camera pulls back from the brain; while the hero is pinned, scroll dollies back in.
 * Signals hop along links; a click or tap sends one. The loop stops when paused, offscreen or the tab
 * is hidden; reduced motion draws one still frame. Never calls preventDefault on touch. */
import { buildEdges, cameraZoom, placeSphere, seedBrain, seedShell, type Box, type Edge, type ShellNode } from "./geometry";
import { mulberry32 } from "./rng";

const SETTINGS = {
  mobile: { shell: 34, brain: 420, neighbors: 2, fps: 30, labels: false },
  tablet: { shell: 48, brain: 800, neighbors: 3, fps: 45, labels: false },
  desktop: { shell: 64, brain: 1400, neighbors: 3, fps: 60, labels: true },
} as const;
type Breakpoint = keyof typeof SETTINGS;
const BANDS = 4, MAX_HOPS = 4, MAX_PULSES = 28;

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  hero: HTMLElement;
  runway: HTMLElement;
  textBlocks: () => Element[];
  /** controls the scene must not draw behind (pause button, hints) */
  avoid?: () => Element[];
  labels: readonly string[];
  seed?: number;
  reducedMotion: boolean;
  intro: boolean;
  onFrame?: () => void;
}

interface Proj { x: number; y: number; z: number; s: number; inf: number; ex: number; a: number }
interface Pulse { from: number; to: number; progress: number; speed: number; strength: number; hops: number }

export function createScene(o: SceneOptions) {
  const ctx = o.canvas.getContext("2d")!;
  const rand = mulberry32(o.seed ?? 7);
  let W = 0, H = 0, bp: Breakpoint = "desktop";
  let nodes: ShellNode[] = [], proj: Proj[] = [], edges: Edge[] = [], adj: Edge[][] = [];
  let brain = new Float32Array(0), brainXY = new Float32Array(0);
  let pulses: Pulse[] = [], flash = 0, frame = 0, raf = 0, last = 0;
  let progress = 0, text: Box | null = null, keepOut: Box[] = [], sphere = { cx: 0, cy: 0, R: 0 };
  let visible = true, paused = false, destroyed = false;
  const introStart = o.intro && !o.reducedMotion ? performance.now() : 0;
  const excitation = new Map<number, number>();
  const pointer = { tx: -999, ty: -999, x: -999, y: -999, active: false };
  const view = { cosY: 1, sinY: 0, bCosY: 0, bSinY: 1, cosX: 1, sinX: 0 };
  const out = { x: 0, y: 0, z: 0, s: 1 };
  const cfg = () => SETTINGS[bp];
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);
  const inBox = (b: Box, x: number, y: number) => x > b.l && x < b.r && y > b.t && y < b.b;
  const inText = (x: number, y: number) => (!!text && inBox(text, x, y)) || keepOut.some((b) => inBox(b, x, y));

  function measure() {
    const c = o.canvas.getBoundingClientRect(), range = document.createRange();
    let box: Box | null = null;
    for (const el of o.textBlocks()) {
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (!r.width) continue;
      const b = { l: r.left - c.left, t: r.top - c.top, r: r.right - c.left, b: r.bottom - c.top };
      box = box ? { l: Math.min(box.l, b.l), t: Math.min(box.t, b.t), r: Math.max(box.r, b.r), b: Math.max(box.b, b.b) } : b;
    }
    text = box && { l: box.l - 20, t: box.t - 20, r: box.r + 20, b: box.b + 20 };
    keepOut = (o.avoid?.() ?? []).map((el) => el.getBoundingClientRect()).filter((r) => r.width)
      .map((r) => ({ l: r.left - c.left - 8, t: r.top - c.top - 8, r: r.right - c.left + 8, b: r.bottom - c.top + 8 }));
    sphere = placeSphere(W, H, text, cfg().labels);
  }

  function resize() {
    const w = o.canvas.offsetWidth, h = o.canvas.offsetHeight;
    if (!w || !h) return;
    const next: Breakpoint = w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
    const dpr = Math.min(window.devicePixelRatio || 1, next === "mobile" ? 1.5 : 2);
    o.canvas.width = Math.round(w * dpr);
    o.canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = w; H = h;
    if (next !== bp || !nodes.length) {
      bp = next;
      nodes = seedShell(cfg().shell, o.labels);
      proj = nodes.map(() => ({ x: 0, y: 0, z: 0, s: 1, inf: 0, ex: 0, a: 1 }));
      brain = seedBrain(cfg().brain);
      brainXY = new Float32Array(brain.length);
      edges = buildEdges(nodes, cfg().neighbors);
      adj = nodes.map(() => []);
      edges.forEach((e) => { adj[e.from].push(e); adj[e.to].push(e); });
      pulses = []; excitation.clear();
    }
    measure();
    readScroll();
  }

  function readScroll() {
    const run = o.runway.offsetHeight;
    progress = run ? clamp(-o.hero.getBoundingClientRect().top / run, 0, 1) : 0;
  }

  function project(x: number, y: number, z: number, zoom: number, cosY: number, sinY: number) {
    const rx = x * cosY - z * sinY, rz0 = x * sinY + z * cosY;
    const ry = y * view.cosX - rz0 * view.sinX, rz = y * view.sinX + rz0 * view.cosX;
    const depth = 1.15 / (1.15 + rz * 0.42 + 0.55), k = (sphere.R * zoom) / (1.15 / 1.7);
    out.x = sphere.cx + rx * depth * k; out.y = sphere.cy + ry * depth * k; out.z = rz; out.s = depth;
  }

  function draw(now: number) {
    const still = o.reducedMotion, t = frame * 0.016;
    const intro = introStart ? clamp((now - introStart) / 1800, 0, 1) : 1;
    const zoom = cameraZoom(intro, progress);
    const shell = clamp((1.9 - zoom) / 0.9, 0, 1);
    const tags = span(1 - Math.pow(1 - intro, 3), 0.7, 1) * (1 - span(progress, 0, 0.25));
    const orbit = still ? 0.55 : t * 0.11, tilt = 0.32 + (still ? 0 : Math.sin(t * 0.07) * 0.05);
    const yaw = Math.PI / 2 + (still ? 0.35 : Math.sin(t * 0.18) * 0.45);
    view.cosY = Math.cos(orbit); view.sinY = Math.sin(orbit);
    view.bCosY = Math.cos(yaw); view.bSinY = Math.sin(yaw);
    view.cosX = Math.cos(tilt); view.sinX = Math.sin(tilt);
    pointer.x += (pointer.tx - pointer.x) * (pointer.active ? 0.18 : 0.08);
    pointer.y += (pointer.ty - pointer.y) * (pointer.active ? 0.18 : 0.08);
    excitation.forEach((v, i) => (v * 0.95 < 0.03 ? excitation.delete(i) : excitation.set(i, v * 0.95)));
    flash *= 0.93;

    const wob = still ? 0 : 0.03, live = pointer.active && !still;
    nodes.forEach((n, i) => {
      project(n.x + Math.sin(t * 0.42 * n.drift + n.phase) * wob, n.y + Math.cos(t * 0.31 * n.drift + n.phase) * wob,
        n.z + Math.sin(t * 0.24 * n.drift + n.phase) * wob, zoom, view.cosY, view.sinY);
      const p = proj[i], inf = live ? Math.max(0, 1 - Math.hypot(out.x - pointer.x, out.y - pointer.y) / (180 * out.s)) : 0;
      p.x = out.x + (pointer.x - out.x) * inf * 0.1; p.y = out.y + (pointer.y - out.y) * inf * 0.1;
      p.z = out.z; p.s = out.s; p.inf = inf; p.ex = excitation.get(i) ?? 0;
      p.a = shell * (inText(p.x, p.y) ? 0.15 : 1);
    });
    for (let i = 0; i < brain.length; i += 3) {
      project(brain[i], brain[i + 1], brain[i + 2], zoom, view.bCosY, view.bSinY);
      brainXY[i] = out.x; brainXY[i + 1] = out.y; brainXY[i + 2] = out.s;
    }

    ctx.clearRect(0, 0, W, H);
    const order = proj.map((_, i) => i).sort((a, b) => proj[b].z - proj[a].z);
    for (const e of edges) {
      const a = proj[e.from], b = proj[e.to], d = (a.s + b.s) / 2, boost = Math.max(a.inf, b.inf, a.ex, b.ex);
      const alpha = (0.05 + d * 0.2 + boost * 0.35) * Math.min(a.a, b.a);
      if (alpha < 0.01) continue;
      ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
      ctx.lineWidth = 0.5 + d * 1.1 + boost * 0.8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    drawNodes(order, false);

    const grow = Math.min(zoom, 2.2), fade = 1 - span(progress, 0.8, 1) * 0.6;
    for (let band = 0; band < BANDS; band++) {
      ctx.fillStyle = `rgba(34,211,238,${Math.min(1, 0.32 + band * 0.2 + flash * 0.3) * fade})`;
      ctx.beginPath();
      for (let i = 0; i < brainXY.length; i += 3) {
        const s = brainXY[i + 2], x = brainXY[i], y = brainXY[i + 1];
        if (clamp(Math.floor((s - 0.52) * 14), 0, BANDS - 1) !== band) continue;
        if (x < -4 || x > W + 4 || y < -4 || y > H + 4 || inText(x, y)) continue;
        let size = (1 + s * 1.7) * grow;
        if (live && Math.abs(x - pointer.x) < 90 && Math.abs(y - pointer.y) < 90) size += 0.6;
        ctx.rect(x - size / 2, y - size / 2, size, size);
      }
      ctx.fill();
    }

    for (const p of pulses) {
      p.progress += p.speed;
      if (p.progress >= 1) { propagate(p); continue; }
      if (p.progress < 0) continue;
      const a = proj[p.from], b = proj[p.to], k = p.progress;
      ctx.globalAlpha = Math.min(a.a, b.a);
      ctx.fillStyle = `rgba(248,250,252,${0.4 + p.strength * 0.45})`;
      ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 2 + (a.s + (b.s - a.s) * k) * 2.4 + p.strength * 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    pulses = pulses.filter((p) => p.progress < 1);
    drawNodes(order, true);
    if (cfg().labels && tags > 0.02) drawLabels(tags);
    if (!still && !paused && pulses.length <= 9 && edges.length && rand() <= (bp === "desktop" ? 0.025 : 0.012)) {
      const e = edges[Math.floor(rand() * edges.length)];
      pulses.push({ from: e.from, to: e.to, progress: 0, speed: 0.012, strength: 0.7, hops: 0 });
    }
  }

  function drawNodes(order: number[], near: boolean) {
    for (const i of order) {
      const p = proj[i], n = nodes[i];
      if (near !== p.z < 0 || p.a < 0.02) continue;
      const glow = p.ex * 0.5 + p.inf * 0.3;
      const r = (1.2 + p.s * 3.2 + glow * 3) * (near ? 1 : 0.8);
      const a = Math.min(1, 0.2 + p.s * 0.6 + glow * 0.4) * p.a;
      if (n.bright || n.label || glow > 0.2) {
        ctx.fillStyle = `rgba(167,139,250,${(0.06 + glow * 0.14) * (near ? 1 : 0.6) * p.a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * (n.bright ? 3.2 : 2.4), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = n.bright || n.label ? `rgba(248,250,252,${a})` : `rgba(34,211,238,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawLabels(fade: number) {
    ctx.font = "500 12px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textBaseline = "middle";
    const placed: { x0: number; x1: number; y: number }[] = [];
    nodes.map((n, i) => ({ n, p: proj[i] })).filter((o2) => o2.n.label).sort((a, b) => b.p.s - a.p.s).forEach(({ n, p }) => {
      const facing = clamp((p.s - 0.62) * 9, 0, 1), lit = p.ex;
      const side = p.x < sphere.cx ? -1 : 1, w = ctx.measureText(n.label!).width, tx = p.x + side * 10;
      const x0 = side > 0 ? tx : tx - w, x1 = side > 0 ? tx + w : tx;
      const alpha = Math.min(1, facing * 0.75 + lit * 0.6) * fade * p.a;
      if (alpha < 0.05 || x0 < 4 || x1 > W - 4) return;
      if (text && x0 < text.r && x1 > text.l && p.y > text.t && p.y < text.b) return;
      if (placed.some((b) => Math.abs(b.y - p.y) < 16 && x0 < b.x1 + 8 && x1 > b.x0 - 8)) return;
      placed.push({ x0, x1, y: p.y });
      ctx.textAlign = side > 0 ? "left" : "right";
      ctx.strokeStyle = `rgba(34,211,238,${alpha * 0.5})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x + side * 4, p.y); ctx.lineTo(tx - side * 2, p.y); ctx.stroke();
      ctx.fillStyle = lit > 0.25 ? `rgba(167,139,250,${alpha})` : `rgba(248,250,252,${alpha})`;
      ctx.fillText(n.label!, tx, p.y);
    });
  }

  function excite(i: number, s: number) { excitation.set(i, Math.min(1, (excitation.get(i) ?? 0) + s)); }
  function propagate(p: Pulse) {
    excite(p.to, p.strength);
    if (p.hops >= MAX_HOPS || pulses.length >= MAX_PULSES) return;
    const onward = adj[p.to].filter((e) => e.from !== p.from && e.to !== p.from);
    if (!onward.length) return;
    const e = onward[Math.floor(rand() * onward.length)];
    pulses.push({ from: p.to, to: e.from === p.to ? e.to : e.from, progress: 0, speed: p.speed * 1.08, strength: p.strength * 0.58, hops: p.hops + 1 });
  }

  const shouldRun = () => visible && !paused && !document.hidden && !o.reducedMotion && !destroyed;
  function loop(now: number) {
    raf = 0;
    if (!shouldRun()) return;
    if (now - last >= 1000 / cfg().fps - 1) { last = now; frame++; draw(now); o.onFrame?.(); }
    raf = requestAnimationFrame(loop);
  }
  const still = () => { if (!shouldRun() && !destroyed) draw(performance.now()); };
  function sync() {
    if (shouldRun()) { if (!raf) raf = requestAnimationFrame(loop); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  /* listeners */
  const onScroll = () => { readScroll(); still(); };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const r = o.canvas.getBoundingClientRect();
    pointer.tx = e.clientX - r.left; pointer.ty = e.clientY - r.top; pointer.active = true;
  };
  const onLeave = () => { pointer.active = false; pointer.tx = pointer.ty = -999; };
  const onClick = (e: MouseEvent) => {
    if (paused || o.reducedMotion || (e.target as Element).closest("a, button, input, h1, p, li, dd, dt, label")) return;
    const r = o.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = Infinity;
    proj.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (p.a > 0.1 && d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    adj[best].slice().sort((a, b) => a.d - b.d).slice(0, bp === "desktop" ? 4 : 2).forEach((e2, k) =>
      pulses.push({ from: best, to: e2.from === best ? e2.to : e2.from, progress: k * -0.04, speed: 0.016 + k * 0.002, strength: 1, hops: 0 }));
    excite(best, 1);
    flash = 1;
  };
  const ro = new ResizeObserver(() => { resize(); still(); });
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); });
  ro.observe(o.canvas);
  io.observe(o.hero);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", sync);
  o.hero.addEventListener("pointermove", onMove);
  o.hero.addEventListener("pointerleave", onLeave);
  o.hero.addEventListener("click", onClick);
  document.fonts?.ready.then(() => { measure(); still(); });

  resize();
  draw(performance.now());

  return {
    pause() { paused = true; still(); sync(); },
    resume() { paused = false; sync(); },
    get paused() { return paused; },
    get frames() { return frame; },
    destroy() {
      destroyed = true; sync();
      ro.disconnect(); io.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", sync);
      o.hero.removeEventListener("pointermove", onMove);
      o.hero.removeEventListener("pointerleave", onLeave);
      o.hero.removeEventListener("click", onClick);
    },
  };
}
export type Scene = ReturnType<typeof createScene>;
