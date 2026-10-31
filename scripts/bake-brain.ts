/* Bakes the procedural brain into small gzipped assets (one per quality tier) plus a manifest of real sizes.
 * Run by hand: `npm run bake:brain`. The page loads these lazily; it never generates the brain itself. */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { BufferAttribute } from "three";
import { encodeBrain } from "../src/scene3d/brainAsset";
import { buildBrain } from "../src/scene3d/brainGeometry";
import { buildFibers } from "../src/scene3d/fibers";

const OUT = new URL("../src/scene3d/assets/", import.meta.url);
const GENERATOR = "brain-v2";
const SEED = 7;

const TIERS = {
  full: { detail: 60, stem: { rings: 48, sides: 40 }, fibers: { primary: 0.1, secondary: 0.042, trunks: 9, branches: 70 } },
  mobile: { detail: 34, stem: { rings: 28, sides: 24 }, fibers: { primary: 0.16, secondary: 0.085, trunks: 6, branches: 36 } },
} as const;

mkdirSync(OUT, { recursive: true });
const manifest: Record<string, unknown> = { generator: GENERATOR, seed: SEED, tiers: {} };

for (const [name, t] of Object.entries(TIERS)) {
  const t0 = performance.now();
  const g = buildBrain({ seed: SEED, detail: t.detail, stem: t.stem });
  const positions = (g.getAttribute("position") as BufferAttribute).array as Float32Array;
  const normals = (g.getAttribute("normal") as BufferAttribute).array as Float32Array;
  const sulcus = (g.getAttribute("sulcus") as BufferAttribute).array as Float32Array;
  const hemi = (g.getAttribute("hemi") as BufferAttribute).array as Float32Array;
  const part = (g.getAttribute("part") as BufferAttribute).array as Float32Array;
  const index = g.getIndex()!.array as Uint32Array;
  const V = positions.length / 3;
  const Vh = hemi.reduce((n, h) => n + (h > 0 ? 1 : 0), 0);
  const Vc = part.reduce((n, p) => n + (p === 1 ? 1 : 0), 0);
  const Vs = V - 2 * Vh - Vc;

  const fibers = buildFibers(
    {
      positions, normals, sulcus, index, hemispheres: [{ lo: 0, hi: Vh, side: 1 }, { lo: Vh, hi: 2 * Vh, side: -1 }],
      cerebellum: { lo: 2 * Vh, hi: 2 * Vh + Vc }, stem: { lo: 2 * Vh + Vc, rings: t.stem.rings, sides: t.stem.sides },
    },
    { seed: SEED, ...t.fibers },
  );
  const raw = encodeBrain({
    meta: {
      v: 1, tier: name, seed: SEED, generator: GENERATOR,
      subdivHemi: t.detail + 1, subdivCereb: Math.max(14, Math.round(t.detail * 0.62)) + 1, stem: t.stem,
      counts: { hemi: Vh, cereb: Vc, stem: Vs, total: V },
    },
    positions, sulcus, fibers,
  });
  const gz = gzipSync(raw, { level: 9 });
  writeFileSync(new URL(`brain-${name}.brain`, OUT), gz);
  (manifest.tiers as Record<string, unknown>)[name] = {
    file: `brain-${name}.brain`, bytesGzip: gz.length, bytesRaw: raw.length, vertices: V, triangles: index.length / 3,
    fiberNodes: fibers.parent.length, sha256Raw: createHash("sha256").update(raw).digest("hex"), bakeMs: Math.round(performance.now() - t0),
  };
  console.log(`${name}: ${V} vertices, ${index.length / 3} triangles, ${fibers.parent.length} fibre nodes, ${raw.length} B raw, ${gz.length} B gzip, ${Math.round(performance.now() - t0)} ms`);
}
writeFileSync(new URL("manifest.json", OUT), JSON.stringify(manifest, null, 2) + "\n");
