/* A deterministic, indexed icosphere with a fixed vertex order.
 *
 * Why not Three's IcosahedronGeometry: it emits unshared triangles that must be welded afterwards, which is the slowest
 * step of building the brain. This builds shared vertices directly, and because the order is a pure function of `n`,
 * the triangle list never needs to be stored: the baked asset keeps only per-vertex data and the loader rebuilds the
 * index from `n` in a few milliseconds.
 *
 * n = subdivisions per edge. Vertices: 10 n² + 2. Triangles: 20 n². */

const T = (1 + Math.sqrt(5)) / 2;
const BASE: ReadonlyArray<readonly [number, number, number]> = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T],
  [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
].map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l] as const; });
const FACES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

export const icosphereVertexCount = (n: number) => 10 * n * n + 2;

/* Per-face edge ids, numbered once in a fixed order so every face agrees on a shared edge. */
const EDGES = (() => {
  const id = new Map<number, number>();
  const of = (a: number, b: number) => {
    const key = Math.min(a, b) * 12 + Math.max(a, b);
    let e = id.get(key);
    if (e === undefined) { e = id.size; id.set(key, e); }
    return e;
  };
  return FACES.map(([A, B, C]) => [of(A, B), of(A, C), of(B, C)] as const);
})();

/** Vertex id for grid point (i, j) of face f; pure arithmetic, no lookups. rowStart[i] = interior vertices before row i. */
function makeVid(n: number) {
  const interiorBase = 12 + 30 * (n - 1);
  const perFace = ((n - 1) * (n - 2)) / 2;
  const rowStart = new Int32Array(n + 1);
  /* interior row r (r >= 1) holds j = 1 .. n-1-r, i.e. n-1-r vertices */
  let acc = 0;
  for (let r = 1; r <= n; r++) { rowStart[r] = acc; acc += Math.max(0, n - 1 - r); }
  return (f: number, i: number, j: number): number => {
    const face = FACES[f]!, e = EDGES[f]!;
    const A = face[0], B = face[1], C = face[2];
    const k = n - i - j;
    if (k === n) return A; if (i === n) return B; if (j === n) return C;
    if (j === 0) return 12 + e[0] * (n - 1) + ((A < B ? i : n - i) - 1);
    if (i === 0) return 12 + e[1] * (n - 1) + ((A < C ? j : n - j) - 1);
    if (k === 0) return 12 + e[2] * (n - 1) + ((B < C ? j : n - j) - 1);
    return interiorBase + f * perFace + rowStart[i]! + (j - 1);
  };
}

/** Triangle indices for an icosphere with n subdivisions per edge (outward-facing winding). */
export function icosphereIndex(n: number): Uint32Array {
  const vid = makeVid(n);
  const out = new Uint32Array(20 * n * n * 3);
  let o = 0;
  for (let f = 0; f < 20; f++) for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
    const v00 = vid(f, i, j), v10 = vid(f, i + 1, j), v01 = vid(f, i, j + 1);
    out[o++] = v00; out[o++] = v10; out[o++] = v01;
    if (i + j < n - 1) { out[o++] = v10; out[o++] = vid(f, i + 1, j + 1); out[o++] = v01; }
  }
  return out;
}

/** Unit-sphere positions for an icosphere with n subdivisions per edge, in the same vertex order as icosphereIndex. */
export function icosphereDirections(n: number): Float32Array {
  const V = icosphereVertexCount(n);
  const pos = new Float32Array(V * 3);
  const vid = makeVid(n);
  for (let f = 0; f < 20; f++) {
    const [A, B, C] = FACES[f]!;
    const a = BASE[A]!, b = BASE[B]!, c = BASE[C]!;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const k = n - i - j;
      const x = a[0] * k + b[0] * i + c[0] * j, y = a[1] * k + b[1] * i + c[1] * j, z = a[2] * k + b[2] * i + c[2] * j;
      const l = Math.hypot(x, y, z), id = vid(f, i, j);
      pos[id * 3] = x / l; pos[id * 3 + 1] = y / l; pos[id * 3 + 2] = z / l;
    }
  }
  return pos;
}

/** Triangle indices for a tube of `rings` rings with `sides` vertices each (the brainstem). */
export function tubeIndex(rings: number, sides: number): Uint32Array {
  const out = new Uint32Array((rings - 1) * sides * 6);
  let o = 0;
  for (let r = 0; r < rings - 1; r++) for (let a = 0; a < sides; a++) {
    const a2 = (a + 1) % sides;
    const p = r * sides + a, q = r * sides + a2, p2 = (r + 1) * sides + a, q2 = (r + 1) * sides + a2;
    out[o++] = p; out[o++] = q; out[o++] = p2; out[o++] = q; out[o++] = q2; out[o++] = p2;
  }
  return out;
}
