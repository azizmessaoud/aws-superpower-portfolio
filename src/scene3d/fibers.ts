/* A branching fibre network grown over the cortex, as a river network.
 *
 *  - A root sits where each hemisphere meets the brainstem; leaf targets are scattered over the cortex (Poisson-disc).
 *  - Each leaf takes the cheapest route to the root along the mesh. Crowns of folds are cheap, groove bottoms are dear,
 *    so fibres trace the gyri and the folds read through the network.
 *  - Where routes merge, the shared edge carries many leaves: that count becomes thickness. So trunks near the root are
 *    thick and the twigs at the leaves hair-thin, and the branching is real, not drawn.
 *  - A few long root-to-leaf routes are marked so light pulses can travel along exactly those paths.
 *
 * Pure data in, typed arrays out: no rendering, no Three.js. Deterministic for a seed. */
import { mulberry32 } from "../scene/rng";

export interface FiberNetwork {
  /** node positions, xyz, in preorder: every parent comes before its children */
  pos: Float32Array;
  /** index of the parent node, -1 for a root */
  parent: Int32Array;
  /** thickness driver, 0..1 (the share of leaf routes that pass through the node) */
  flow: Float32Array;
  /** arc length from the root along the network */
  dist: Float32Array;
  /** bit k set: the node lies on pulse path k (bits 0-3 right hemisphere, 4-7 left) */
  mask: Uint8Array;
  /** length of each pulse path, 0 where unused */
  pulseLen: Float32Array;
}

export interface FiberInput {
  positions: Float32Array;
  normals: Float32Array;
  sulcus: Float32Array;
  index: Uint32Array;
  /** vertex ranges of the two hemispheres */
  hemispheres: Array<{ lo: number; hi: number; side: 1 | -1 }>;
  /** when given, the cerebellum gets fine arcs along its folia and the brainstem a cable of parallel strands */
  cerebellum?: { lo: number; hi: number };
  stem?: { lo: number; rings: number; sides: number };
}

export interface FiberOptions {
  seed?: number;
  /** spacing of the main leaf targets, in model units */
  primary?: number;
  /** spacing of the fine twig targets */
  secondary?: number;
  /** how much a twig target weighs against a main one (thin twigs) */
  secondaryWeight?: number;
  /** pulse paths per hemisphere */
  pulsePaths?: number;
  /** how far the fibres float above the crowns */
  lift?: number;
  /** long routes that become thick trunks, and medium routes that become branches, per hemisphere */
  trunks?: number;
  branches?: number;
}

const ROOT_POINT = [0.1, -0.18, 0.0] as const; /* hemisphere-local (u, y, z): the underside near the brainstem */

class MinHeap {
  private k: Float64Array; private v: Int32Array; size = 0;
  constructor(cap: number) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); }
  push(key: number, val: number) {
    if (this.size >= this.k.length) {
      const k = new Float64Array(this.k.length * 2); k.set(this.k); this.k = k;
      const v = new Int32Array(this.v.length * 2); v.set(this.v); this.v = v;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p]! <= key) break;
      this.k[i] = this.k[p]!; this.v[i] = this.v[p]!; i = p;
    }
    this.k[i] = key; this.v[i] = val;
  }
  popVal(): number {
    const top = this.v[0]!, key = this.k[--this.size]!, val = this.v[this.size]!;
    let i = 0;
    for (;;) {
      let c = i * 2 + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.k[c + 1]! < this.k[c]!) c++;
      if (this.k[c]! >= key) break;
      this.k[i] = this.k[c]!; this.v[i] = this.v[c]!; i = c;
    }
    this.k[i] = key; this.v[i] = val;
    return top;
  }
  popKey(): number { return this.k[0]!; }
}

interface Tree { pos: number[]; nrm: number[]; parent: number[]; flow: number[]; leafNode: Map<number, number>; primaryLeaves: number[] }

function growHemisphere(inp: FiberInput, range: { lo: number; hi: number; side: 1 | -1 }, o: Required<FiberOptions>, rand: () => number): Tree {
  const { lo, hi, side } = range;
  const V = hi - lo;
  const P = inp.positions, N = inp.normals, S = inp.sulcus;

  /* adjacency (CSR) of this hemisphere's own triangles */
  const deg = new Int32Array(V + 1);
  const idx = inp.index;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]!;
    if (a < lo || a >= hi) continue;
    /* each triangle corner stores two neighbours below, so it counts twice here */
    deg[a - lo]! += 2; deg[idx[t + 1]! - lo]! += 2; deg[idx[t + 2]! - lo]! += 2;
  }
  const start = new Int32Array(V + 1);
  for (let i = 0; i < V; i++) start[i + 1] = start[i]! + deg[i]!;
  const fill = new Int32Array(V);
  const adj = new Int32Array(start[V]!);
  const add = (a: number, b: number) => { adj[start[a]! + fill[a]!++] = b; };
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]!;
    if (a < lo || a >= hi) continue;
    const x = a - lo, y = idx[t + 1]! - lo, z = idx[t + 2]! - lo;
    add(x, y); add(y, x); add(y, z); add(z, y); add(z, x); add(x, z);
  }

  /* root: the vertex nearest the brainstem side of this hemisphere */
  const rx = ROOT_POINT[0] * side, ry = ROOT_POINT[1], rz = ROOT_POINT[2];
  let root = 0, best = Infinity;
  for (let i = 0; i < V; i++) {
    const g = (lo + i) * 3, d = (P[g]! - rx) ** 2 + (P[g + 1]! - ry) ** 2 + (P[g + 2]! - rz) ** 2;
    if (d < best) { best = d; root = i; }
  }

  /* shortest routes from the root: crowns cheap, groove bottoms dear. Highway edges (trunks, then branches) are cheaper
     still, so later routes prefer to join an existing bundle instead of running beside it. */
  const K = 4;
  const hw = new Uint8Array(V); /* 0 plain, 1 branch, 2 trunk */
  const MUL = [1, 0.36, 0.1];
  let dist = new Float64Array(V), par = new Int32Array(V), order: number[] = [], settled = new Uint8Array(V);
  const runRoutes = () => {
    dist = new Float64Array(V).fill(Infinity); par = new Int32Array(V).fill(-1); order = []; settled = new Uint8Array(V);
    const heap = new MinHeap(V * 2);
    dist[root] = 0; heap.push(0, root);
    while (heap.size) {
      const d0 = heap.popKey(), u = heap.popVal();
      if (settled[u] || d0 > dist[u]!) continue;
      settled[u] = 1; order.push(u);
      const gu = (lo + u) * 3;
      for (let e = start[u]!; e < start[u + 1]!; e++) {
        const w = adj[e]!;
        if (settled[w]) continue;
        const gw = (lo + w) * 3;
        const len = Math.hypot(P[gu]! - P[gw]!, P[gu + 1]! - P[gw + 1]!, P[gu + 2]! - P[gw + 2]!);
        const m = hw[u]! && hw[w]! ? MUL[Math.min(hw[u]!, hw[w]!)]! : 1;
        const nd = d0 + len * (1 + K * (S[lo + u]! + S[lo + w]!) * 0.5) * m;
        if (nd < dist[w]!) { dist[w] = nd; par[w] = u; heap.push(nd, w); }
      }
    }
  };
  runRoutes();

  /* leaf targets: Poisson-disc on the outer cortex, main ones first, then fine twigs */
  const cand: number[] = [];
  for (let i = 0; i < V; i++) {
    const g = (lo + i) * 3;
    if (Math.abs(P[g]!) > 0.05 && S[lo + i]! < 0.55 && settled[i]) cand.push(i); /* off the medial wall, off groove bottoms */
  }
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = cand[i]!; cand[i] = cand[j]!; cand[j] = t; }
  const cellP = o.primary, cellA = o.secondary;
  const gridP = new Map<number, number[]>(), gridA = new Map<number, number[]>();
  const key = (cx: number, cy: number, cz: number) => ((cx + 128) * 512 + (cy + 128)) * 512 + (cz + 128);
  const near = (grid: Map<number, number[]>, cell: number, v: number, r: number) => {
    const g = (lo + v) * 3, x = P[g]!, y = P[g + 1]!, z = P[g + 2]!;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const list = grid.get(key(cx + a, cy + b, cz + c));
      if (list) for (const w of list) {
        const h = (lo + w) * 3;
        if ((P[h]! - x) ** 2 + (P[h + 1]! - y) ** 2 + (P[h + 2]! - z) ** 2 < r * r) return true;
      }
    }
    return false;
  };
  const put = (grid: Map<number, number[]>, cell: number, v: number) => {
    const g = (lo + v) * 3;
    const k = key(Math.floor(P[g]! / cell), Math.floor(P[g + 1]! / cell), Math.floor(P[g + 2]! / cell));
    const l = grid.get(k); if (l) l.push(v); else grid.set(k, [v]);
  };
  const weight = new Float64Array(V);
  const primaryLeaves: number[] = [];
  for (const v of cand) if (!near(gridP, cellP, v, o.primary)) { put(gridP, cellP, v); put(gridA, cellA, v); weight[v] = 1; primaryLeaves.push(v); }
  for (const v of cand) if (weight[v] === 0 && !near(gridA, cellA, v, o.secondary)) { put(gridA, cellA, v); weight[v] = o.secondaryWeight; }

  /* highways: a few long, well-spread trunks first, then medium branches that join them */
  const spread = (pool: number[], count: number, sep: number) => {
    const chosen: number[] = [];
    for (const v of pool) {
      if (chosen.length >= count) break;
      const g = (lo + v) * 3;
      if (chosen.every((c) => { const h = (lo + c) * 3; return (P[h]! - P[g]!) ** 2 + (P[h + 1]! - P[g + 1]!) ** 2 + (P[h + 2]! - P[g + 2]!) ** 2 > sep * sep; })) chosen.push(v);
    }
    return chosen;
  };
  const mark = (leaf: number, level: number) => { for (let v = leaf; v >= 0 && v !== root; v = par[v]!) hw[v] = Math.max(hw[v]!, level); hw[root] = 2; };
  const farthest = [...primaryLeaves].sort((x, y) => dist[y]! - dist[x]!);
  for (const v of spread(farthest.slice(0, Math.ceil(farthest.length * 0.6)), o.trunks, 0.5)) mark(v, 2);
  runRoutes();
  for (const v of spread(primaryLeaves.filter((x) => hw[x] === 0), o.branches, 0.26)) mark(v, 1);
  runRoutes();

  /* flow: each leaf's weight travels to the root; the sum along an edge is its thickness */
  const flow = new Float64Array(V);
  for (let i = 0; i < V; i++) flow[i] = weight[i]!;
  for (let k = order.length - 1; k > 0; k--) { const v = order[k]!; const p = par[v]!; if (p >= 0) flow[p] = flow[p]! + flow[v]!; }

  /* children, then a preorder walk, main trunk first */
  const kids = new Map<number, number[]>();
  for (let v = 0; v < V; v++) if (v !== root && flow[v]! > 0 && par[v]! >= 0) { const p = par[v]!; const l = kids.get(p); if (l) l.push(v); else kids.set(p, [v]); }
  const pre: number[] = [], preIdx = new Int32Array(V).fill(-1);
  const stack = [root];
  while (stack.length) {
    const v = stack.pop()!;
    preIdx[v] = pre.length; pre.push(v);
    const c = kids.get(v);
    if (c) { c.sort((a, b) => flow[a]! - flow[b]!); for (const w of c) stack.push(w); }
  }

  const tree: Tree = { pos: [], nrm: [], parent: [], flow: [], leafNode: new Map(), primaryLeaves: [] };
  const rootFlow = flow[root]!;
  for (const v of pre) {
    const g = (lo + v) * 3;
    tree.pos.push(P[g]!, P[g + 1]!, P[g + 2]!);
    tree.nrm.push(N[g]!, N[g + 1]!, N[g + 2]!);
    tree.parent.push(par[v]! >= 0 && v !== root ? preIdx[par[v]!]! : -1);
    tree.flow.push(flow[v]! / rootFlow);
  }
  for (const v of primaryLeaves) if (preIdx[v]! >= 0) { tree.leafNode.set(v, preIdx[v]!); tree.primaryLeaves.push(preIdx[v]!); }
  return tree;
}


/* Strands that are not part of the cortex tree: the brainstem as a cable of parallel strands, and the cerebellum as fine
 * arcs following its horizontal folia. Without them the form would lose exactly the parts that make it read as a brain
 * once the solid surface is not drawn. Each chain is a root plus a run of children. */
interface Chain { pts: number[]; flow: number }
function extraChains(inp: FiberInput, lift: number): Chain[] {
  const P = inp.positions, N = inp.normals, S = inp.sulcus, out: Chain[] = [];
  if (inp.stem) {
    const { lo, rings, sides } = inp.stem;
    const strands = 8, stepA = Math.max(1, Math.round(sides / strands)), stepR = Math.max(1, Math.round(rings / 22));
    for (let a = 0; a < sides; a += stepA) {
      const pts: number[] = [];
      for (let r = 0; r < rings - 2; r += stepR) {
        const g = (lo + r * sides + a) * 3;
        pts.push(P[g]! + N[g]! * lift, P[g + 1]! + N[g + 1]! * lift, P[g + 2]! + N[g + 2]! * lift);
      }
      if (pts.length >= 6) out.push({ pts, flow: 0.5 });
    }
  }
  if (inp.cerebellum) {
    const { lo, hi } = inp.cerebellum;
    let yMin = Infinity, yMax = -Infinity, cx = 0, cz = 0, n = 0;
    for (let v = lo; v < hi; v++) { yMin = Math.min(yMin, P[v * 3 + 1]!); yMax = Math.max(yMax, P[v * 3 + 1]!); cx += P[v * 3]!; cz += P[v * 3 + 2]!; n++; }
    cx /= n; cz /= n;
    const band = 0.03, bands = new Map<number, number[]>();
    /* a coarser mesh has fewer vertices near each band, so the band is as wide as the mesh is coarse */
    const spacing = Math.sqrt(1.2 / (hi - lo)), tol = Math.max(0.0055, 0.55 * spacing);
    for (let v = lo; v < hi; v++) {
      if (S[v]! > 0.25) continue; /* on the crowns of the folia, not in the grooves */
      const k = Math.round((P[v * 3 + 1]! - yMin) / band);
      if (Math.abs(P[v * 3 + 1]! - (yMin + k * band)) > tol) continue;
      const l = bands.get(k); if (l) l.push(v); else bands.set(k, [v]);
    }
    for (const verts of bands.values()) {
      verts.sort((a, b) => Math.atan2(P[a * 3 + 2]! - cz, P[a * 3]! - cx) - Math.atan2(P[b * 3 + 2]! - cz, P[b * 3]! - cx));
      let pts: number[] = [];
      const flush = () => { if (pts.length >= 18) out.push({ pts, flow: 0.07 }); pts = []; };
      let prev = -1;
      for (let i = 0; i < verts.length; i += 2) {
        const v = verts[i]!, g = v * 3;
        if (prev >= 0 && Math.hypot(P[g]! - P[prev * 3]!, P[g + 1]! - P[prev * 3 + 1]!, P[g + 2]! - P[prev * 3 + 2]!) > 0.038) flush();
        pts.push(P[g]! + N[g]! * lift, P[g + 1]! + N[g + 1]! * lift, P[g + 2]! + N[g + 2]! * lift);
        prev = v;
      }
      flush();
    }
  }
  /* smooth every chain (moving average, ends fixed) so arcs are clean curves and not vertex jitter */
  for (const c of out) {
    const n = c.pts.length / 3;
    for (let pass = 0; pass < 3; pass++) {
      const q = c.pts.slice();
      for (let i = 1; i < n - 1; i++) for (let k = 0; k < 3; k++) c.pts[i * 3 + k] = 0.25 * q[(i - 1) * 3 + k]! + 0.5 * q[i * 3 + k]! + 0.25 * q[(i + 1) * 3 + k]!;
    }
  }
  return out;
}

export function buildFibers(inp: FiberInput, opts: FiberOptions = {}): FiberNetwork {
  const o: Required<FiberOptions> = { seed: 7, primary: 0.12, secondary: 0.055, secondaryWeight: 0.12, pulsePaths: 4, lift: 0.004, trunks: 8, branches: 56, ...opts };
  const rand = mulberry32(o.seed + 5150);
  const trees = inp.hemispheres.map((h) => growHemisphere(inp, h, o, rand));
  const extra = extraChains(inp, o.lift);
  const treeN = trees.reduce((s, t) => s + t.parent.length, 0);
  const N = treeN + extra.reduce((s, c) => s + c.pts.length / 3, 0);
  const pos = new Float32Array(N * 3), parent = new Int32Array(N), flow = new Float32Array(N), dist = new Float32Array(N), mask = new Uint8Array(N);
  const pulseLen = new Float32Array(8);
  let base = 0;
  trees.forEach((t, h) => {
    const n = t.parent.length;
    /* smooth the zig-zag of mesh edges along the tree; keep the points at or above the surface */
    const orig = Float32Array.from(t.pos), p = Float32Array.from(t.pos);
    for (let iter = 0; iter < 4; iter++) {
      const acc = new Float32Array(n * 3), cnt = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const q = t.parent[i]!;
        if (q < 0) continue;
        for (let c = 0; c < 3; c++) { acc[i * 3 + c] = acc[i * 3 + c]! + p[q * 3 + c]!; acc[q * 3 + c] = acc[q * 3 + c]! + p[i * 3 + c]!; }
        cnt[i] = cnt[i]! + 1; cnt[q] = cnt[q]! + 1;
      }
      for (let i = 0; i < n; i++) {
        if (t.parent[i]! < 0 || cnt[i]! < 2) continue; /* root and tips stay put */
        const k = cnt[i]!;
        for (let c = 0; c < 3; c++) p[i * 3 + c] = p[i * 3 + c]! * 0.4 + (acc[i * 3 + c]! / k) * 0.6;
        const nx = t.nrm[i * 3]!, ny = t.nrm[i * 3 + 1]!, nz = t.nrm[i * 3 + 2]!;
        const dn = (p[i * 3]! - orig[i * 3]!) * nx + (p[i * 3 + 1]! - orig[i * 3 + 1]!) * ny + (p[i * 3 + 2]! - orig[i * 3 + 2]!) * nz;
        if (dn < 0) { p[i * 3] = p[i * 3]! - nx * dn; p[i * 3 + 1] = p[i * 3 + 1]! - ny * dn; p[i * 3 + 2] = p[i * 3 + 2]! - nz * dn; }
      }
    }
    for (let i = 0; i < n; i++) {
      const g = (base + i) * 3;
      pos[g] = p[i * 3]! + t.nrm[i * 3]! * o.lift; pos[g + 1] = p[i * 3 + 1]! + t.nrm[i * 3 + 1]! * o.lift; pos[g + 2] = p[i * 3 + 2]! + t.nrm[i * 3 + 2]! * o.lift;
      parent[base + i] = t.parent[i]! < 0 ? -1 : t.parent[i]! + base;
      flow[base + i] = t.flow[i]!;
    }
    for (let i = 0; i < n; i++) {
      const q = parent[base + i]!;
      dist[base + i] = q < 0 ? 0 : dist[q]! + Math.hypot(pos[(base + i) * 3]! - pos[q * 3]!, pos[(base + i) * 3 + 1]! - pos[q * 3 + 1]!, pos[(base + i) * 3 + 2]! - pos[q * 3 + 2]!);
    }
    /* pulse paths: long routes to far-apart leaves, so a pulse crosses a good part of the hemisphere */
    const leaves = t.primaryLeaves.map((i) => i + base).sort((a, b) => dist[b]! - dist[a]!);
    const chosen: number[] = [];
    for (const l of leaves) {
      if (chosen.length >= o.pulsePaths) break;
      const far = chosen.every((c) => Math.hypot(pos[l * 3]! - pos[c * 3]!, pos[l * 3 + 1]! - pos[c * 3 + 1]!, pos[l * 3 + 2]! - pos[c * 3 + 2]!) > 0.5);
      if (far) chosen.push(l);
    }
    chosen.forEach((leaf, k) => {
      const bit = h * 4 + k;
      pulseLen[bit] = dist[leaf]!;
      for (let v = leaf; v >= 0; v = parent[v]!) mask[v] = mask[v]! | (1 << bit);
    });
    base += n;
  });
  /* the extra chains: a root, then each point a child of the one before */
  let at = treeN;
  for (const c of extra) {
    const n = c.pts.length / 3;
    for (let i = 0; i < n; i++, at++) {
      pos.set([c.pts[i * 3]!, c.pts[i * 3 + 1]!, c.pts[i * 3 + 2]!], at * 3);
      parent[at] = i === 0 ? -1 : at - 1;
      flow[at] = c.flow;
      dist[at] = i === 0 ? 0 : dist[at - 1]! + Math.hypot(pos[at * 3]! - pos[(at - 1) * 3]!, pos[at * 3 + 1]! - pos[(at - 1) * 3 + 1]!, pos[at * 3 + 2]! - pos[(at - 1) * 3 + 2]!);
    }
  }
  return { pos, parent, flow, dist, mask, pulseLen };
}

/** How many children each node has (branch points have two or more). */
export function childCounts(parent: Int32Array): Uint16Array {
  const c = new Uint16Array(parent.length);
  for (let i = 0; i < parent.length; i++) if (parent[i]! >= 0) c[parent[i]!]!++;
  return c;
}
