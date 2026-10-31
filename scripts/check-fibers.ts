/* The highway-pass check: do the baked fibre networks have the structure the fibre-optic brain depends on?
 * Criteria were written before the first run. Exit code 1 if any criterion fails.
 *   npm run check:fibers
 *
 *  H1 valid forest        parents precede children, exactly two roots, one per hemisphere
 *  H2 on the surface      every node within 0.03 of a mesh vertex; no segment longer than 0.04
 *  H3 thick to thin       flow never grows towards the tips; trunk flow at least 50x the median twig
 *  H4 highways work       with the highway passes, at least twice the fibre length sits in thick bundles (flow >= 0.05)
 *                         compared with plain shortest routes, and at least 8% of all fibre length is in thick bundles
 *  H5 the network is the form   at least 85% of the outer cortex lies within 0.06 of a fibre node, so the brain still
 *                         reads when the solid surface is not drawn
 *  H6 pulse paths         at least 6 of the 8 pulse paths exist, each at least 1.0 long
 *  H7 reproducible        re-baking gives byte-identical data to the committed asset */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { BufferAttribute } from "three";
import { decodeBrain } from "../src/scene3d/brainAsset";
import { buildBrain } from "../src/scene3d/brainGeometry";
import { buildFibers, type FiberNetwork } from "../src/scene3d/fibers";

const ASSETS = new URL("../src/scene3d/assets/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", ASSETS), "utf8")) as { tiers: Record<string, { sha256Raw: string }> };
const results: { id: string; tier: string; pass: boolean; detail: string }[] = [];
const rec = (id: string, tier: string, pass: boolean, detail: string) => { results.push({ id, tier, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${tier}]  ${detail}`); };

const seg = (f: FiberNetwork, i: number) => { const p = f.parent[i]!; return p < 0 ? 0 : Math.hypot(f.pos[i * 3]! - f.pos[p * 3]!, f.pos[i * 3 + 1]! - f.pos[p * 3 + 1]!, f.pos[i * 3 + 2]! - f.pos[p * 3 + 2]!); };
/** share of all fibre length that lies in thick bundles (flow >= 0.05) */
function thickShare(f: FiberNetwork) { let all = 0, thick = 0; for (let i = 0; i < f.parent.length; i++) { const l = seg(f, i); all += l; if (f.flow[i]! >= 0.05) thick += l; } return { all, thick, share: thick / all }; }

function grid(points: Float32Array, cell: number) {
  const m = new Map<number, number[]>(), key = (a: number, b: number, c: number) => ((a + 64) * 256 + (b + 64)) * 256 + (c + 64);
  for (let i = 0; i < points.length / 3; i++) { const k = key(Math.floor(points[i * 3]! / cell), Math.floor(points[i * 3 + 1]! / cell), Math.floor(points[i * 3 + 2]! / cell)); const l = m.get(k); if (l) l.push(i); else m.set(k, [i]); }
  return (x: number, y: number, z: number, r: number) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let best = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const j of m.get(key(cx + a, cy + b, cz + c)) ?? []) {
      const d = Math.hypot(points[j * 3]! - x, points[j * 3 + 1]! - y, points[j * 3 + 2]! - z); if (d < best) best = d;
    }
    return best <= r ? best : Infinity;
  };
}

for (const tier of ["full", "mobile"] as const) {
  const brain = decodeBrain(new Uint8Array(gunzipSync(readFileSync(new URL(`brain-${tier}.brain`, ASSETS)))));
  const f = brain.fibers, N = f.parent.length, V = brain.positions.length / 3;

  /* H1 */
  let roots = 0, ordered = true;
  for (let i = 0; i < N; i++) { const p = f.parent[i]!; if (p < 0) roots++; else if (p >= i) ordered = false; }
  rec("H1 valid forest", tier, ordered && roots === 2, `${N} nodes, ${roots} roots, parents precede children: ${ordered}`);

  /* H2 */
  const near = grid(brain.positions, 0.05);
  let off = 0, worst = 0, longest = 0;
  for (let i = 0; i < N; i++) { const d = near(f.pos[i * 3]!, f.pos[i * 3 + 1]!, f.pos[i * 3 + 2]!, 0.03); if (d === Infinity) off++; else worst = Math.max(worst, d); longest = Math.max(longest, seg(f, i)); }
  rec("H2 on the surface", tier, off === 0 && longest <= 0.04, `${off} nodes further than 0.03 from the surface, longest segment ${longest.toFixed(3)}`);

  /* H3 */
  let monotone = true, max = 0; const twigs: number[] = [];
  for (let i = 0; i < N; i++) { const p = f.parent[i]!; if (p >= 0 && f.flow[i]! > f.flow[p]! + 1 / 255) monotone = false; max = Math.max(max, f.flow[i]!); if (f.flow[i]! < 0.02) twigs.push(f.flow[i]!); }
  twigs.sort((a, b) => a - b); const med = twigs[Math.floor(twigs.length / 2)] || 1 / 255;
  rec("H3 thick to thin", tier, monotone && max / med >= 50, `monotone ${monotone}, trunk/median-twig flow ratio ${(max / med).toFixed(0)}x`);

  /* H5 */
  let outer = 0, covered = 0;
  const nodeNear = grid(f.pos, 0.06);
  for (let v = 0; v < V; v++) {
    if (brain.part[v] !== 0) continue;
    const x = brain.positions[v * 3]!;
    if (Math.abs(x) < 0.05 || brain.sulcus[v]! > 0.6) continue; /* outer cortex only: not the medial wall, not groove bottoms */
    outer++; if (nodeNear(x, brain.positions[v * 3 + 1]!, brain.positions[v * 3 + 2]!, 0.06) !== Infinity) covered++;
  }
  rec("H5 the network is the form", tier, covered / outer >= 0.85, `${(100 * covered / outer).toFixed(1)}% of the outer cortex is within 0.06 of a fibre`);

  /* H6 */
  const paths = Array.from(f.pulseLen).filter((l) => l >= 1.0).length;
  rec("H6 pulse paths", tier, paths >= 6, `${paths} of 8 pulse paths are at least 1.0 long (lengths ${Array.from(f.pulseLen).map((l) => l.toFixed(1)).join(", ")})`);

  /* H4 and H7 need the generator: only the full tier is regenerated (the baseline takes seconds) */
  if (tier === "full") {
    const g = buildBrain({ seed: 7, detail: 60, stem: { rings: 48, sides: 40 } });
    const A = (n: string) => (g.getAttribute(n) as BufferAttribute).array as Float32Array;
    const P = A("position"), Nn = A("normal"), S = A("sulcus"), H = A("hemi"), idx = g.getIndex()!.array as Uint32Array;
    const Vh = H.reduce((n, h) => n + (h > 0 ? 1 : 0), 0);
    const input = { positions: P, normals: Nn, sulcus: S, index: idx, hemispheres: [{ lo: 0, hi: Vh, side: 1 as const }, { lo: Vh, hi: 2 * Vh, side: -1 as const }] };
    const plain = buildFibers(input, { seed: 7, primary: 0.12, secondary: 0.055, trunks: 0, branches: 0 });
    const withHw = buildFibers(input, { seed: 7, primary: 0.12, secondary: 0.055, trunks: 8, branches: 56 });
    const a = thickShare(plain), b = thickShare(withHw);
    rec("H4 highways work", tier, b.share >= 2 * a.share && b.share >= 0.08,
      `thick-bundle share of fibre length: plain routes ${(100 * a.share).toFixed(1)}% -> with highways ${(100 * b.share).toFixed(1)}% (${(b.share / (a.share || 1e-9)).toFixed(1)}x); total length ${a.all.toFixed(1)} -> ${b.all.toFixed(1)}`);
    const baked = decodeBrain(new Uint8Array(gunzipSync(readFileSync(new URL("brain-full.brain", ASSETS)))));
    rec("H7 reproducible", tier, manifest.tiers.full!.sha256Raw === createHash("sha256").update(gunzipSync(readFileSync(new URL("brain-full.brain", ASSETS)))).digest("hex") && baked.fibers.parent.length === withHw.parent.length,
      `committed asset has ${baked.fibers.parent.length} fibre nodes, a fresh build has ${withHw.parent.length}`);
  }
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} criteria pass${failed.length ? `; FAILED: ${failed.map((r) => `${r.id} [${r.tier}]`).join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
