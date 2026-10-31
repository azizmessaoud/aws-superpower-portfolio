/* An original procedural human brain. No downloaded model, no traced reference: every vertex comes from this file.
 *
 * Axes: x = left(-)/right(+), y = up, z = front(+)/back(-). Units: about 1.7 long, 1.4 wide, 1.5 tall with the stem.
 *
 * Build order, so the silhouette is right before any detail is added:
 *   1. each hemisphere is a superellipsoid shaped by lobe proportions (narrow frontal, wide parietal, tapered occipital,
 *      a temporal lobe hanging below, a flattened medial wall that leaves the longitudinal fissure between the two);
 *   2. the lateral (Sylvian) and central sulci are cut in along fixed paths;
 *   3. the cortical folds are carved along the zero lines of layered noise, which gives wormy, branching grooves;
 *   4. cerebellum (fine parallel folia + a midline vermis cleft) and brainstem (pons swelling) are separate pieces.
 * The `sulcus` attribute (0 = crown of a fold, 1 = bottom of a groove) is kept for shading and, later, filament paths. */
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, IcosahedronGeometry, Vector3 } from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { createNoise3, type Noise3 } from "./noise";

export interface BrainOptions {
  seed?: number;
  /** icosphere subdivisions per cerebral hemisphere; 60 is about 37,000 vertices each */
  detail?: number;
  /** 1 = default fold depth, 0 = bare lobes */
  foldDepth?: number;
}

export const PART = { cerebrum: 0, cerebellum: 1, stem: 2 } as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const sp = (t: number, e: number) => Math.sign(t) * Math.pow(Math.abs(t), e);
const sq = (v: number) => v * v;
const softMax = (a: number, b: number, k: number) => 0.5 * (a + b + Math.sqrt(sq(a - b) + k * k));

function sphere(detail: number): BufferGeometry {
  const g = new IcosahedronGeometry(1, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  return mergeVertices(g, 1e-5);
}

/** distance from p to the polyline through pts (all [x, y, z]) */
function distToPolyline(px: number, py: number, pz: number, pts: number[][]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i]!, [bx, by, bz] = pts[i + 1]!;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const t = clamp01(((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / (dx * dx + dy * dy + dz * dz));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy), pz - (az + t * dz));
    if (d < best) best = d;
  }
  return best;
}

/* ── cerebrum ─────────────────────────────────────────────────────────────────────────────────── */

/** Smooth 1D profile through [t, value] knots (Catmull-Rom), so the outline has no corners. */
function profile(pts: number[][]) {
  return (t: number) => {
    if (t <= pts[0]![0]!) return pts[0]![1]!;
    const last = pts[pts.length - 1]!;
    if (t >= last[0]!) return last[1]!;
    let i = 0;
    while (pts[i + 1]![0]! < t) i++;
    const p1 = pts[i]!, p2 = pts[i + 1]!, p0 = pts[Math.max(0, i - 1)]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const k = (t - p1[0]!) / (p2[0]! - p1[0]!), k2 = k * k, k3 = k2 * k;
    return 0.5 * ((2 * p1[1]!) + (-p0[1]! + p2[1]!) * k + (2 * p0[1]! - 5 * p1[1]! + 4 * p2[1]! - p3[1]!) * k2 + (-p0[1]! + 3 * p1[1]! - 3 * p2[1]! + p3[1]!) * k3);
  };
}
/* Lateral outline, by position along the front-back axis (-1 back pole, +1 front pole):
 * how far out the hemisphere reaches, and where its top and its (medial) underside are. */
const OUTER = profile([[-1, 0.4], [-0.85, 0.54], [-0.55, 0.68], [-0.2, 0.72], [0.2, 0.67], [0.55, 0.57], [0.85, 0.46], [1, 0.36]]);
const TOP = profile([[-1, 0.28], [-0.85, 0.4], [-0.55, 0.58], [-0.2, 0.66], [0.15, 0.66], [0.5, 0.58], [0.8, 0.47], [1, 0.38]]);
const BOTTOM = profile([[-1, 0.0], [-0.85, -0.07], [-0.55, -0.15], [-0.2, -0.2], [0.15, -0.22], [0.5, -0.2], [0.8, -0.14], [1, -0.08]]);

/** Hemisphere-local point (u lateral from the midline, y up, z forward) for a direction on the unit sphere.
 *  Each cross-section along the front-back axis is a rounded square swept between the profiles above. */
function cerebralPoint(dx: number, dy: number, dz: number): [number, number, number] {
  const tz = dz;
  const e = Math.max(0, (Math.abs(tz) - 0.7) / 0.3);
  const cap = Math.pow(Math.max(0, 1 - e * e), 0.5); /* the outline closes in an egg-like curve over the last 30% of the length */
  const r = Math.hypot(dx, dy);
  const cx = r > 1e-6 ? dx / r : 0, cy = r > 1e-6 ? dy / r : 0;
  const E2 = 0.86; /* below 1 is boxy; this keeps a flat-ish medial wall but rolls the dorsal edge over softly */

  const wHalf = ((OUTER(tz) - 0.011) / 2) * cap;
  let u = 0.011 + wHalf * (1 + sp(cx, E2));

  const yt = TOP(tz), yb = BOTTOM(tz), yc = (yt + yb) / 2;
  let y = yc + (cy >= 0 ? yt - yc : yc - yb) * cap * sp(cy, E2);
  const z = 0.03 + 0.86 * tz;

  /* the temporal lobe: the lateral underside hangs lower, a little forward of centre */
  const T = Math.exp(-sq((u - 0.56) / 0.16)) * Math.exp(-sq((tz - 0.12) / 0.36));
  y -= 0.27 * T * Math.pow(clamp01(-cy), 0.8);
  u = softMax(u, 0.011, 0.012);
  return [u, y, z];
}

const SYLVIAN = [[0.55, -0.14, 0.52], [0.66, -0.06, 0.3], [0.71, 0.0, 0.05], [0.7, 0.08, -0.22], [0.62, 0.2, -0.52]];
const CENTRAL = [[0.16, 0.56, 0.0], [0.32, 0.54, 0.05], [0.48, 0.42, 0.1], [0.62, 0.24, 0.16], [0.68, 0.1, 0.18]];

/** Groove strength (0..1) of the cortical folds at a point (hemisphere-local u, y, z) on a surface with normal (nx, ny, nz).
 *  Real gyri are long wandering stripes whose direction changes from patch to patch. Three stripe sets run top-to-bottom,
 *  front-to-back and across; each patch of surface favours the set whose stripes cross it obliquely (a set shows badly on a
 *  surface facing along its gradient) and one set wins per patch, so the grain turns like a real cortex, without crosshatching.
 *  A warp field makes the stripes wander and branch, and a fade mask lets them end. */
function fineFolds(noise: Noise3, u: number, y: number, z: number, nx: number, ny: number, nz: number) {
  const f = 7.4;
  const warp = noise(u * 1.7 + 6.1, y * 1.7 + 3.3, z * 1.7) * 1.05 + noise(u * 4.4 + 8, y * 4.4, z * 4.4) * 0.25;
  const psi = [
    f * (z * 0.95 + y * 0.32) + warp, /* grooves of constant z: they run top-to-bottom on the side */
    f * (y + z * 0.22 - u * 0.1) + warp * 0.9 + 0.5, /* run front-to-back, like the temporal gyri */
    f * (u + z * 0.3 + y * 0.2) + warp + 1.3, /* run across, from the midline outwards */
  ];
  const facing = [Math.abs(nz), Math.abs(ny), Math.abs(nx)];
  const wTemporal = smooth(0.03, -0.1, y) * smooth(0.34, 0.58, u);
  let sum = 0, g = 0;
  for (let i = 0; i < 3; i++) {
    let w = Math.pow(1 - 0.94 * facing[i]!, 3) * (0.5 + 0.5 * (noise(u * 2.2 + i * 17.3, y * 2.2 + i * 5.1, z * 2.2) * 0.5 + 0.5));
    if (i === 1) w *= 1 + 3 * wTemporal;
    w = Math.pow(w, 3); /* winner takes the patch */
    const p = psi[i]!;
    const d = Math.abs(p - Math.round(p)); /* distance to the nearest groove line, in stripe periods */
    const main = Math.exp(-sq(d / 0.15));
    const h = p * 0.5 + 0.23; /* half-period set, a different phase: branches off the main grooves */
    const d2 = Math.abs(h - Math.round(h));
    const branch = 0.5 * Math.exp(-sq(d2 / 0.12)) * smooth(-0.1, 0.5, noise(u * 3.1 + 21, y * 3.1, z * 3.1));
    g += w * (1 - (1 - main) * (1 - branch));
    sum += w;
  }
  g /= Math.max(sum, 1e-6);
  /* grooves fade in and out instead of running unbroken */
  return g * smooth(-1.05, -0.5, noise(u * 2.3 + 40, y * 2.3 + 7, z * 2.3));
}

function hemisphere(side: 1 | -1, seed: number, detail: number, foldDepth: number): BufferGeometry {
  const g = sphere(detail);
  const pos = g.getAttribute("position") as BufferAttribute;
  const n = pos.count;
  const local = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [u, y, z] = cerebralPoint(pos.getX(i), pos.getY(i), pos.getZ(i));
    local[i * 3] = u; local[i * 3 + 1] = y; local[i * 3 + 2] = z;
  }
  pos.array.set(local);
  g.computeVertexNormals();
  const nor = g.getAttribute("normal") as BufferAttribute;

  /* snap the two sulcus paths onto the actual surface */
  const snap = (path: number[][]) => path.map(([px, py, pz]) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = sq(local[i * 3]! - px!) + sq(local[i * 3 + 1]! - py!) + sq(local[i * 3 + 2]! - pz!);
      if (d < bd) { bd = d; best = i; }
    }
    return [local[best * 3]!, local[best * 3 + 1]!, local[best * 3 + 2]!];
  });
  const sylvian = snap(SYLVIAN), central = snap(CENTRAL);

  const noise = createNoise3(seed + (side > 0 ? 0 : 101));
  const sulcus = new Float32Array(n);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = local[i * 3]!, y = local[i * 3 + 1]!, z = local[i * 3 + 2]!;
    const mask = smooth(-0.93, -0.55, nor.getX(i)); /* none on the medial wall that faces the other hemisphere */
    const groove = fineFolds(noise, u, y, z, nor.getX(i), nor.getY(i), nor.getZ(i));
    const depth = 0.02 + 0.008 * (noise(u * 2.1, y * 2.1 + 40, z * 2.1) * 0.5 + 0.5);
    const dSyl = distToPolyline(u, y, z, sylvian), dCen = distToPolyline(u, y, z, central);
    const gSyl = Math.exp(-sq(dSyl / 0.04)), gCen = Math.exp(-sq(dCen / 0.028));
    const insula = u > 0.4 ? Math.exp(-sq(dSyl / 0.11)) : 0;

    const disp = foldDepth * (-depth * groove * mask + 0.008 * (1 - groove) * mask - 0.062 * gSyl - 0.04 * gCen - 0.03 * insula);
    out[i * 3] = u + nor.getX(i) * disp;
    out[i * 3 + 1] = y + nor.getY(i) * disp;
    out[i * 3 + 2] = z + nor.getZ(i) * disp;
    sulcus[i] = clamp01(Math.max(groove * mask, gSyl, gCen));
  }
  /* mirror for the left hemisphere (x flips, so the triangle winding must flip too) */
  for (let i = 0; i < n; i++) { out[i * 3] = out[i * 3]! * side; }
  pos.array.set(out);
  if (side < 0) {
    const idx = g.getIndex()!;
    const a = idx.array as Uint32Array | Uint16Array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]!; a[i + 1] = a[i + 2]!; a[i + 2] = t; }
  }
  g.setAttribute("sulcus", new BufferAttribute(sulcus, 1));
  g.setAttribute("part", new BufferAttribute(new Float32Array(n).fill(PART.cerebrum), 1));
  g.setAttribute("hemi", new BufferAttribute(new Float32Array(n).fill(side), 1));
  g.computeVertexNormals();
  return g;
}

/* ── cerebellum ───────────────────────────────────────────────────────────────────────────────── */

function cerebellum(seed: number, detail: number, foldDepth: number): BufferGeometry {
  const g = sphere(detail);
  const pos = g.getAttribute("position") as BufferAttribute;
  const n = pos.count;
  const base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = 0.45 * sp(pos.getX(i), 0.9);
    let y = 0.2 * sp(pos.getY(i), 0.9);
    if (y > 0) y *= 0.7; /* the upper face tucks flat under the occipital lobes */
    base[i * 3] = x; base[i * 3 + 1] = y - 0.26; base[i * 3 + 2] = 0.32 * sp(pos.getZ(i), 0.9) - 0.47;
  }
  pos.array.set(base);
  g.computeVertexNormals();
  const nor = g.getAttribute("normal") as BufferAttribute;
  const noise = createNoise3(seed + 303);
  const sulcus = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = base[i * 3]!, y = base[i * 3 + 1]!, z = base[i * 3 + 2]!;
    /* folia: fine, almost parallel ridges across the surface, wandering a little */
    const psi = y * 185 + z * 16 + noise(x * 2.6, y * 2.6, z * 2.6) * 2.2;
    const stripe = 0.5 + 0.5 * Math.sin(psi);
    const groove = smooth(0.35, 1, stripe) * smooth(-0.6, 0.3, noise(x * 4 + 9, y * 4, z * 4));
    const vermis = Math.exp(-sq(x / 0.028)); /* the cleft down the middle */
    const disp = foldDepth * (-0.0085 * groove - 0.018 * vermis);
    pos.setXYZ(i, x + nor.getX(i) * disp, y + nor.getY(i) * disp, z + nor.getZ(i) * disp);
    sulcus[i] = clamp01(Math.max(groove * 0.85, vermis));
  }
  g.setAttribute("sulcus", new BufferAttribute(sulcus, 1));
  g.setAttribute("part", new BufferAttribute(new Float32Array(n).fill(PART.cerebellum), 1));
  g.setAttribute("hemi", new BufferAttribute(new Float32Array(n), 1));
  g.computeVertexNormals();
  return g;
}

/* ── brainstem ────────────────────────────────────────────────────────────────────────────────── */

function brainstem(): BufferGeometry {
  const L = 48, A = 40;
  const curve = new CatmullRomCurve3([new Vector3(0, -0.1, 0.0), new Vector3(0, -0.3, -0.05), new Vector3(0, -0.5, -0.12), new Vector3(0, -0.7, -0.2)], false, "centripetal");
  const position = new Float32Array(L * A * 3);
  const sulcus = new Float32Array(L * A);
  const c = new Vector3(), tg = new Vector3();
  for (let r = 0; r < L; r++) {
    const t = r / (L - 1);
    curve.getPointAt(t, c); curve.getTangentAt(t, tg);
    /* sideways is x; "forward" is perpendicular to the tangent in the y-z plane */
    const ny = tg.z, nz = -tg.y;
    const pons = Math.exp(-sq((t - 0.3) / 0.13));
    let radius = 0.16 - 0.07 * smooth(0.3, 1, t) + 0.03 * pons;
    const e = clamp01((t - 0.92) / 0.08);
    radius *= Math.sqrt(Math.max(0, 1 - e * e)); /* hemispherical tip */
    for (let a = 0; a < A; a++) {
      const th = (a / A) * Math.PI * 2;
      const sn = Math.sin(th), co = Math.cos(th);
      const fwd = radius * sn * (1 + 0.3 * pons * Math.max(0, sn));
      const side = radius * co * (1 + 0.08 * pons);
      const o = (r * A + a) * 3;
      position[o] = c.x + side;
      position[o + 1] = c.y + ny * fwd;
      position[o + 2] = c.z + nz * fwd;
      sulcus[r * A + a] = 0.2 * pons * Math.max(0, -sn);
    }
  }
  const index: number[] = [];
  for (let r = 0; r < L - 1; r++) for (let a = 0; a < A; a++) {
    const a2 = (a + 1) % A;
    const p = r * A + a, q = r * A + a2, p2 = (r + 1) * A + a, q2 = (r + 1) * A + a2;
    index.push(p, q, p2, q, q2, p2);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(position, 3));
  g.setIndex(index);
  g.setAttribute("sulcus", new BufferAttribute(sulcus, 1));
  g.setAttribute("part", new BufferAttribute(new Float32Array(L * A).fill(PART.stem), 1));
  g.setAttribute("hemi", new BufferAttribute(new Float32Array(L * A), 1));
  g.computeVertexNormals();
  return g;
}

/** The whole brain as one indexed geometry with attributes: position, normal, sulcus, part, hemi. */
export function buildBrain(opts: BrainOptions = {}): BufferGeometry {
  const seed = opts.seed ?? 7, detail = opts.detail ?? 60, foldDepth = opts.foldDepth ?? 1;
  const parts = [
    hemisphere(1, seed, detail, foldDepth),
    hemisphere(-1, seed, detail, foldDepth),
    cerebellum(seed, Math.max(20, Math.round(detail * 0.62)), foldDepth),
    brainstem(),
  ];
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("brain parts could not be merged");
  return merged;
}
