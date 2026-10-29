/* One fixed canvas for the whole page. In the hero: a point-cloud brain inside a sphere of skill nodes
 * (soul of projectx0's NeuralField); the camera pulls back on open and dollies in with the pinned scroll.
 * At the end of the pin the brain shrinks and travels into the "Terminal Explorer" dock, where it stays for the
 * rest of the page; it moves there only while the dock is hovered or focused.
 * Never draws inside the hero text or behind fixed controls. The loop runs only while something visible moves
 * and the visitor has not paused; reduced motion draws still frames that follow the scroll. No preventDefault on touch. */
import type { MindState } from "../mind/state";
import { buildEdges, cameraZoom, DOCK_AT, placeSphere, seedBrain, seedShell, travelAt, TRAVEL_MS, type Box, type Edge, type ShellNode } from "./geometry";
import { mulberry32 } from "./rng";

const SETTINGS = {
  mobile: { shell: 34, brain: 420, neighbors: 2, fps: 30, labels: false, field: 20 },
  tablet: { shell: 48, brain: 800, neighbors: 3, fps: 45, labels: false, field: 32 },
  desktop: { shell: 64, brain: 1400, neighbors: 3, fps: 60, labels: true, field: 46 },
} as const;
/* the intro's full-background neural field (the prototype's drifting network, in token colours) */
const FIELD_COLORS = ["139,92,246", "6,182,212", "59,130,246", "167,139,250", "34,211,238"];
const FIELD_LINK = 150;
interface FieldNode { x: number; y: number; vx: number; vy: number; r: number; c: string; phase: number }
type Breakpoint = keyof typeof SETTINGS;
const BANDS = 4, MAX_HOPS = 4, MAX_PULSES = 28;
const BRAIN_HALF = 0.42; /* approximate half-width of the projected brain, in model units × depth */

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  hero: HTMLElement;
  stage: HTMLElement;
  runway: HTMLElement;
  textBlocks: () => Element[];
  /** viewport-fixed controls the scene must never draw behind */
  fixedAvoid: () => Element[];
  /** where the docked brain sits (a circle inside the dock button) */
  dockSlot: () => Element | null;
  labels: readonly string[];
  seed?: number;
  reducedMotion: boolean;
  intro: boolean;
  onDocked?: (docked: boolean) => void;
}

interface Proj { x: number; y: number; z: number; s: number; inf: number; ex: number; a: number }
interface Pulse { from: number; to: number; progress: number; speed: number; strength: number; hops: number }

export function createScene(o: SceneOptions) {
  const ctx = o.canvas.getContext("2d")!;
  const rand = mulberry32(o.seed ?? 7);
  let W = 0, H = 0, stageH = 0, bp: Breakpoint = "desktop";
  let nodes: ShellNode[] = [], proj: Proj[] = [], edges: Edge[] = [], adj: Edge[][] = [];
  let brain = new Float32Array(0), brainXY = new Float32Array(0);
  let field: FieldNode[] = [];
  let pulses: Pulse[] = [], flash = 0, frame = 0, raf = 0, last = 0;
  let progress = 0, stageTop = 0, text: Box | null = null, lines: Box[] = [], fixedOut: Box[] = [], sphere = { cx: 0, cy: 0, R: 0 };
  let dock = { cx: 0, cy: 0, r: 0 }, dockAllowed = true, dockActive = false, docked = false;
  /* interface state of the question lifecycle (see src/mind/state.ts); it only tints and paces the animation */
  let mind: MindState = "idle";
  const tint = { r: 34, g: 211, b: 238 };
  const TINTS: Record<MindState, [number, number, number]> = { idle: [34, 211, 238], listening: [34, 211, 238], retrieving: [34, 211, 238], answering: [34, 211, 238], uncertain: [254, 188, 46], error: [255, 95, 87] };
  const mindLive = () => mind !== "idle";
  let heroVisible = true, paused = false, destroyed = false, pausedAt = 0;
  let travelFrom = 0, travelTo = 0, travelStart = 0;
  const introStart = o.intro && !o.reducedMotion ? performance.now() : 0;
  const excitation = new Map<number, number>();
  const pointer = { tx: -999, ty: -999, x: -999, y: -999, active: false };
  const view = { cosY: 1, sinY: 0, bCosY: 0, bSinY: 1, cosX: 1, sinX: 0 };
  const out = { x: 0, y: 0, z: 0, s: 1 };
  const cfg = () => SETTINGS[bp];
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);
  const inBox = (b: Box, x: number, y: number) => x > b.l && x < b.r && y > b.t && y < b.b;
  /* x, y in viewport coordinates */
  const blocked = (x: number, y: number, heroText = true) =>
    (heroText && veil(x, y) > 0.5) || fixedOut.some((b) => inBox(b, x, y));
  /* how much hero text covers a viewport point: 1 on a line of text, fading to 0 within FEATHER px.
     Lines, not the text column: the network flows between and beside the words instead of around a box. */
  const FEATHER = 28;
  function veil(x: number, y: number) {
    const sy = y - stageTop;
    if (!text || !inBox({ l: text.l - FEATHER, t: text.t - FEATHER, r: text.r + FEATHER, b: text.b + FEATHER }, x, sy)) return 0;
    let v = 0;
    for (const b of lines) {
      const d = Math.hypot(Math.max(b.l - x, 0, x - b.r), Math.max(b.t - sy, 0, sy - b.b));
      if (d < FEATHER) v = Math.max(v, 1 - d / FEATHER);
      if (v === 1) break;
    }
    return v;
  }

  function measure() {
    const s = o.stage.getBoundingClientRect(), range = document.createRange();
    let box: Box | null = null;
    lines = [];
    for (const el of o.textBlocks()) {
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (!r.width) continue;
      const b = { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top };
      box = box ? { l: Math.min(box.l, b.l), t: Math.min(box.t, b.t), r: Math.max(box.r, b.r), b: Math.max(box.b, b.b) } : b;
      /* buttons keep their whole surface; text keeps each line it actually draws */
      const parts = el.querySelector("a, button") ? Array.from(el.querySelectorAll("a, button"), (c) => c.getBoundingClientRect()) : Array.from(range.getClientRects());
      for (const q of parts) if (q.width > 2) lines.push({ l: q.left - s.left - 6, t: q.top - s.top - 4, r: q.right - s.left + 6, b: q.bottom - s.top + 4 });
    }
    text = box && { l: box.l - 20, t: box.t - 20, r: box.r + 20, b: box.b + 20 };
    stageH = s.height;
    sphere = placeSphere(W, Math.min(stageH, H), text, cfg().labels);
    measureFixed();
  }
  function measureFixed() {
    /* visually hidden labels (1×1 px) are not on screen: don't keep out around them */
    fixedOut = o.fixedAvoid().map((el) => el.getBoundingClientRect()).filter((r) => r.width > 2 && r.height > 2)
      .map((r) => ({ l: r.left - 6, t: r.top - 6, r: r.right + 6, b: r.bottom + 6 }));
    const slot = o.dockSlot()?.getBoundingClientRect();
    if (slot && slot.width) dock = { cx: slot.left + slot.width / 2, cy: slot.top + slot.height / 2, r: slot.width / 2 - 6 };
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
      field = [];
    }
    measure();
    const fh = Math.max(stageH, 1);
    if (!field.length) field = Array.from({ length: cfg().field }, (_, i) => ({
      x: rand() * W, y: rand() * fh, vx: (rand() - 0.5) * 0.22, vy: (rand() - 0.5) * 0.22,
      r: 1.6 + rand() * 2.4, c: FIELD_COLORS[i % FIELD_COLORS.length], phase: rand() * Math.PI * 2,
    }));
    readScroll();
  }

  function readScroll() {
    const run = o.runway.offsetHeight;
    stageTop = o.stage.getBoundingClientRect().top;
    if (run) progress = clamp(-o.hero.getBoundingClientRect().top / run, 0, 1);
    else progress = 0;
    if (run) {
      /* past DOCK_AT the brain flies to the nav by itself and always lands; above it, it flies back */
      const to = progress >= DOCK_AT ? 1 : 0;
      if (to !== travelTo) {
        const t = performance.now();
        /* paused, or the visitor jumped past the hero (e.g. a nav link): land instantly, nothing to watch */
        travelFrom = paused || stageTop + stageH <= 0 ? to : travelNow(t);
        travelTo = to; travelStart = t;
        if (to === 0) setDocked(false);
        sync();
      }
    } else setDocked(stageTop + stageH < H * 0.35); /* reduced motion: docked once the hero has mostly left */
  }
  const travelNow = (t: number) => (travelStart ? travelAt(travelFrom, travelTo, ((paused && pausedAt) ? pausedAt : t) - travelStart) : travelTo);
  const travelling = (t: number) => travelStart !== 0 && t - travelStart < TRAVEL_MS && travelFrom !== travelTo;
  function setDocked(d: boolean) { if (d !== docked) { docked = d; o.onDocked?.(docked); sync(); } }

  /* project a model point; (cx, cy, k) place and scale it on screen */
  function project(x: number, y: number, z: number, cx: number, cy: number, k: number, cosY: number, sinY: number) {
    const rx = x * cosY - z * sinY, rz0 = x * sinY + z * cosY;
    const ry = y * view.cosX - rz0 * view.sinX, rz = y * view.sinX + rz0 * view.cosX;
    const depth = 1.15 / (1.15 + rz * 0.42 + 0.55);
    out.x = cx + rx * depth * k; out.y = cy + ry * depth * k; out.z = rz; out.s = depth;
  }

  function draw(now: number) {
    const still = o.reducedMotion, t = frame * 0.016;
    const intro = introStart ? clamp((now - introStart) / 1800, 0, 1) : 1;
    const zoom = cameraZoom(intro, progress);
    const travel = o.reducedMotion ? 0 : travelNow(now);
    if (!o.reducedMotion && travelTo === 1 && travel >= 1) setDocked(true);
    const heroOn = stageTop + stageH > 0 && travel < 1;
    const shell = clamp((1.9 - zoom) / 0.9, 0, 1) * (1 - span(travel, 0, 0.4));
    const tags = span(1 - Math.pow(1 - intro, 3), 0.7, 1) * (1 - span(progress, 0, 0.25));
    const sway = still || (docked && !dockActive && !mindLive()) ? 0 : 1;
    const orbit = still ? 0.55 : t * 0.11, tilt = 0.32 + Math.sin(t * 0.07) * 0.05 * sway;
    const yaw = Math.PI / 2 + (still ? 0.35 : Math.sin(t * 0.18) * 0.45 * (docked ? sway : 1));
    view.cosY = Math.cos(orbit); view.sinY = Math.sin(orbit);
    view.bCosY = Math.cos(yaw); view.bSinY = Math.sin(yaw);
    view.cosX = Math.cos(tilt); view.sinX = Math.sin(tilt);
    pointer.x += (pointer.tx - pointer.x) * (pointer.active ? 0.18 : 0.08);
    pointer.y += (pointer.ty - pointer.y) * (pointer.active ? 0.18 : 0.08);
    excitation.forEach((v, i) => (v * 0.95 < 0.03 ? excitation.delete(i) : excitation.set(i, v * 0.95)));
    flash *= 0.93;
    const tt = TINTS[mind];
    tint.r += (tt[0] - tint.r) * 0.12; tint.g += (tt[1] - tint.g) * 0.12; tint.b += (tt[2] - tint.b) * 0.12;
    ctx.clearRect(0, 0, W, H);

    /* full-background neural field behind everything in the hero */
    const fieldAlpha = heroOn ? (1 - span(travel, 0, 0.5)) * (0.35 + 0.65 * intro) : 0;
    if (fieldAlpha > 0.01) drawField(fieldAlpha, t);

    /* the sphere and its skills: hero only */
    const kHero = (sphere.R * zoom) / (1.15 / 1.7), cyHero = sphere.cy + stageTop;
    const order: number[] = [];
    if (heroOn && shell > 0.01) {
      const wob = still ? 0 : 0.03, live = pointer.active && !still;
      nodes.forEach((n, i) => {
        project(n.x + Math.sin(t * 0.42 * n.drift + n.phase) * wob, n.y + Math.cos(t * 0.31 * n.drift + n.phase) * wob,
          n.z + Math.sin(t * 0.24 * n.drift + n.phase) * wob, sphere.cx, cyHero, kHero, view.cosY, view.sinY);
        const p = proj[i], inf = live ? Math.max(0, 1 - Math.hypot(out.x - pointer.x, out.y - pointer.y) / (180 * out.s)) : 0;
        p.x = out.x + (pointer.x - out.x) * inf * 0.1; p.y = out.y + (pointer.y - out.y) * inf * 0.1;
        p.z = out.z; p.s = out.s; p.inf = inf; p.ex = excitation.get(i) ?? 0;
        p.a = shell * (fixedOut.some((b) => inBox(b, p.x, p.y)) ? 0.15 : 1 - 0.8 * veil(p.x, p.y));
        order.push(i);
      });
      order.sort((a, b) => proj[b].z - proj[a].z);
      for (const e of edges) {
        const a = proj[e.from], b = proj[e.to], d = (a.s + b.s) / 2, boost = Math.max(a.inf, b.inf, a.ex, b.ex);
        const alpha = (0.05 + d * 0.2 + boost * 0.35) * Math.min(a.a, b.a);
        if (alpha < 0.01) continue;
        ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
        ctx.lineWidth = 0.5 + d * 1.1 + boost * 0.8;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      drawNodes(order, false);
    }

    /* the brain: in the hero, travelling, or docked */
    const kDock = dock.r / (BRAIN_HALF * 0.67 * 1.4);
    const docking = docked || travel > 0;
    if (heroOn || (docked && dockAllowed)) {
      const tt = docked ? 1 : travel;
      const cx = sphere.cx + (dock.cx - sphere.cx) * tt;
      const cy = cyHero + (dock.cy - cyHero) * tt;
      const k = Math.exp(Math.log(kHero) + (Math.log(kDock) - Math.log(kHero)) * tt);
      /* fewer points on small screens: bigger dots when docked so it still reads as a brain */
      const dockDot = Math.min(0.9, 0.45 * Math.sqrt(1400 / Math.max(1, brain.length / 3)));
      const grow = Math.min(zoom, 2.2) * (1 - tt) + dockDot * tt;
      const heroText = tt < 1; /* once docked the hero has scrolled away; only the nav's controls block */
      const fade = docked && !dockAllowed ? 0 : 1;
      for (let i = 0; i < brain.length; i += 3) {
        project(brain[i], brain[i + 1], brain[i + 2], cx, cy, k, view.bCosY, view.bSinY);
        brainXY[i] = out.x; brainXY[i + 1] = out.y; brainXY[i + 2] = out.s;
      }
      const live = pointer.active && !still && !docking;
      for (let band = 0; band < BANDS; band++) {
        const dim = mind === "uncertain" ? 0.7 : 1;
        ctx.fillStyle = `rgba(${tint.r | 0},${tint.g | 0},${tint.b | 0},${Math.min(1, 0.32 + band * 0.2 + flash * 0.3 + (mind === "listening" ? 0.08 : 0)) * fade * dim})`;
        ctx.beginPath();
        for (let i = 0; i < brainXY.length; i += 3) {
          const s = brainXY[i + 2], x = brainXY[i], y = brainXY[i + 1];
          if (clamp(Math.floor((s - 0.52) * 14), 0, BANDS - 1) !== band) continue;
          if (x < -4 || x > W + 4 || y < -4 || y > H + 4 || blocked(x, y, heroText)) continue;
          let size = (1 + s * 1.7) * grow;
          if (live && Math.abs(x - pointer.x) < 90 && Math.abs(y - pointer.y) < 90) size += 0.6;
          ctx.rect(x - size / 2, y - size / 2, size, size);
        }
        ctx.fill();
      }
    }

    if (heroOn && shell > 0.01) {
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
      if (cfg().labels && tags > 0.02 && travel === 0) drawLabels(tags);
      const rate = mind === "retrieving" ? 0.3 : mind === "listening" ? 0.06 : mind === "uncertain" || mind === "error" ? 0 : bp === "desktop" ? 0.025 : 0.012;
      if (!still && !paused && pulses.length <= (mind === "retrieving" ? 16 : 9) && edges.length && rand() <= rate) {
        const e = edges[Math.floor(rand() * edges.length)];
        pulses.push({ from: e.from, to: e.to, progress: 0, speed: 0.012, strength: 0.7, hops: 0 });
      }
    }
  }

  function drawField(alpha: number, t: number) {
    const lim = FIELD_LINK * FIELD_LINK;
    /* behind the words the field fades to a third: still one continuous network, never competing with the text */
    const dim = (x: number, y: number) => (fixedOut.some((b) => inBox(b, x, y + stageTop)) ? 0.12 : 1 - 0.68 * veil(x, y + stageTop));
    ctx.lineWidth = 1;
    for (let i = 0; i < field.length; i++) {
      const a = field[i];
      for (let j = i + 1; j < field.length; j++) {
        const b = field[j], dx = a.x - b.x, dy = a.y - b.y, dd = dx * dx + dy * dy;
        if (dd >= lim) continue;
        const k = (1 - dd / lim) * 0.32 * alpha * Math.min(dim(a.x, a.y), dim(b.x, b.y), dim((a.x + b.x) / 2, (a.y + b.y) / 2));
        if (k < 0.01) continue;
        ctx.strokeStyle = `rgba(${a.c},${k})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y + stageTop); ctx.lineTo(b.x, b.y + stageTop); ctx.stroke();
      }
    }
    for (const n of field) {
      const y = n.y + stageTop, d = dim(n.x, n.y) * alpha, r = n.r * (1 + 0.2 * Math.sin(t * 0.9 + n.phase));
      ctx.fillStyle = `rgba(${n.c},${0.12 * d})`;
      ctx.beginPath(); ctx.arc(n.x, y, r * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${n.c},${0.85 * d})`;
      ctx.beginPath(); ctx.arc(n.x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function stepField() {
    const fh = Math.max(stageH, 1);
    for (const n of field) {
      const dx = n.x - pointer.x, dy = n.y + stageTop - pointer.y, dd = dx * dx + dy * dy;
      if (pointer.active && dd < 160 * 160 && dd > 0) { const d = Math.sqrt(dd), f = (1 - d / 160) * 0.06; n.vx += (dx / d) * f; n.vy += (dy / d) * f; }
      n.vx *= 0.992; n.vy *= 0.992;
      const sp = Math.hypot(n.vx, n.vy);
      if (sp > 0.66) { n.vx *= 0.66 / sp; n.vy *= 0.66 / sp; }
      if (sp < 0.08) { n.vx += (rand() - 0.5) * 0.02; n.vy += (rand() - 0.5) * 0.02; }
      n.x += n.vx; n.y += n.vy;
      if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = fh + 20; else if (n.y > fh + 20) n.y = -20;
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
      if (blocked(x0, p.y) || blocked(x1, p.y) || blocked((x0 + x1) / 2, p.y)) return;
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

  /* the loop runs only while something visible moves: the hero on screen, or a hovered/focused dock */
  const shouldRun = () => !paused && !document.hidden && !o.reducedMotion && !destroyed && ((heroVisible && !docked) || travelling(performance.now()) || (docked && (dockActive || mindLive()) && dockAllowed));
  function loop(now: number) {
    raf = 0;
    if (!shouldRun()) { still(); return; }
    if (now - last >= 1000 / cfg().fps - 1) { last = now; frame++; if (!docked) stepField(); draw(now); }
    raf = requestAnimationFrame(loop);
  }
  const still = () => { if (!destroyed && !raf) draw(performance.now()); };
  function sync() {
    if (shouldRun()) { if (!raf) raf = requestAnimationFrame(loop); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; still(); }
  }

  const onScroll = () => { readScroll(); if (!raf) still(); };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    pointer.tx = e.clientX; pointer.ty = e.clientY; pointer.active = true;
  };
  const onLeave = () => { pointer.active = false; pointer.tx = pointer.ty = -999; };
  const onClick = (e: MouseEvent) => {
    /* Only real controls and a text selection in progress keep their click; plain text no longer blocks the pulse. */
    if (paused || o.reducedMotion || (e.target as Element).closest("a, button, input, label") || String(getSelection())) return;
    let best = -1, bd = Infinity;
    proj.forEach((p, i) => { const d = Math.hypot(p.x - e.clientX, p.y - e.clientY); if (p.a > 0.1 && d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    adj[best].slice().sort((a, b) => a.d - b.d).slice(0, bp === "desktop" ? 4 : 2).forEach((e2, k) =>
      pulses.push({ from: best, to: e2.from === best ? e2.to : e2.from, progress: k * -0.04, speed: 0.016 + k * 0.002, strength: 1, hops: 0 }));
    excite(best, 1);
    flash = 1;
  };
  const ro = new ResizeObserver(() => { resize(); still(); });
  const io = new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; sync(); });
  ro.observe(o.canvas);
  ro.observe(o.stage);
  io.observe(o.stage);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", sync);
  o.hero.addEventListener("pointermove", onMove);
  o.hero.addEventListener("pointerleave", onLeave);
  o.hero.addEventListener("click", onClick);
  document.fonts?.ready.then(() => { measure(); still(); });

  resize();
  draw(performance.now());

  return {
    pause() {
      if (paused) return;
      paused = true;
      pausedAt = performance.now();
      sync(); still();
    },
    resume() {
      if (!paused) return;
      if (pausedAt && travelStart) travelStart += performance.now() - pausedAt;
      pausedAt = 0;
      paused = false;
      sync();
    },
    /** dock hovered or focused: the docked brain may move (if not paused) */
    /** The question lifecycle changed. Tints and paces the animation; maps to no model internals. */
    setMindState(next: MindState) {
      if (next === mind) return;
      mind = next;
      if (next === "answering") flash = 1;
      if (next === "error") flash = 0.8;
      sync(); still();
    },
    get mindState() { return mind; },
    setDockActive(on: boolean) { dockActive = on; if (on && !paused) flash = 0.6; sync(); still(); },
    /** dock hidden (e.g. the visitor is already at the Terminal Explorer): don't draw the docked brain */
    setDockAllowed(on: boolean) { dockAllowed = on; measureFixed(); sync(); still(); },
    remeasure() { measure(); still(); },
    get paused() { return paused; },
    get frames() { return frame; },
    get pulseCount() { return pulses.length; },
    get running() { return raf !== 0; },
    destroy() {
      destroyed = true; if (raf) cancelAnimationFrame(raf); raf = 0;
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
