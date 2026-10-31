/* Seeded 3D simplex noise (after Stefan Gustavson's public-domain reference). Original code, no assets.
 * Same seed, same brain, on every load and in every test. */
import { mulberry32 } from "../scene/rng";

const GRAD: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1],
  [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

export type Noise3 = (x: number, y: number, z: number) => number;

/** Returns a noise function with values in about [-1, 1]. */
export function createNoise3(seed: number): Noise3 {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i]!; p[i] = p[j]!; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
  const F3 = 1 / 3, G3 = 1 / 6;

  const corner = (gi: number, x: number, y: number, z: number) => {
    const t = 0.6 - x * x - y * y - z * z;
    if (t < 0) return 0;
    const g = GRAD[gi]!;
    const t2 = t * t;
    return t2 * t2 * (g[0] * x + g[1] * y + g[2] * z);
  };

  return (xin, yin, zin) => {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const gi = (a: number, b: number, c: number) => perm[ii + a + perm[jj + b + perm[kk + c]!]!]! % 12;
    const n0 = corner(gi(0, 0, 0), x0, y0, z0);
    const n1 = corner(gi(i1, j1, k1), x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3);
    const n2 = corner(gi(i2, j2, k2), x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3);
    const n3 = corner(gi(1, 1, 1), x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3);
    return 32 * (n0 + n1 + n2 + n3);
  };
}
