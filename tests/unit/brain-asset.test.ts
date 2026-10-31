import { describe, expect, it } from "vitest";
import type { BufferAttribute } from "three";
import { decodeBrain, encodeBrain } from "../../src/scene3d/brainAsset";
import { buildBrain } from "../../src/scene3d/brainGeometry";
import { buildFibers, childCounts } from "../../src/scene3d/fibers";

/* small detail keeps the test fast; the properties do not depend on it */
const detail = 20, stem = { rings: 16, sides: 12 };
const g = buildBrain({ seed: 7, detail, stem });
const A = (n: string) => (g.getAttribute(n) as BufferAttribute).array as Float32Array;
const positions = A("position"), normals = A("normal"), sulcus = A("sulcus"), hemi = A("hemi"), part = A("part");
const index = g.getIndex()!.array as Uint32Array;
const V = positions.length / 3, Vh = hemi.reduce((n, h) => n + (h > 0 ? 1 : 0), 0), Vc = part.reduce((n, p) => n + (p === 1 ? 1 : 0), 0);
const fibers = buildFibers({ positions, normals, sulcus, index, hemispheres: [{ lo: 0, hi: Vh, side: 1 }, { lo: Vh, hi: 2 * Vh, side: -1 }] }, { seed: 7, primary: 0.2, secondary: 0.1 });
const bytes = encodeBrain({
  meta: { v: 1, tier: "test", seed: 7, generator: "t", subdivHemi: detail + 1, subdivCereb: Math.max(14, Math.round(detail * 0.62)) + 1, stem, counts: { hemi: Vh, cereb: Vc, stem: V - 2 * Vh - Vc, total: V } },
  positions, sulcus, fibers,
});
const back = decodeBrain(bytes);

describe("baked brain asset", () => {
  it("rebuilds exactly the triangles, part tags and hemisphere tags the generator made (nothing stored for them)", () => {
    expect(back.index.length).toBe(index.length);
    expect(Array.from(back.index)).toEqual(Array.from(index));
    expect(Array.from(back.part)).toEqual(Array.from(part));
    expect(Array.from(back.hemi)).toEqual(Array.from(hemi));
  });
  it("keeps positions within half a quantisation step (13-bit grid)", () => {
    const [x0, y0, z0, x1, y1, z1] = back.meta.bbox;
    const step = Math.max(x1 - x0, y1 - y0, z1 - z0) / 8191;
    let worst = 0;
    for (let i = 0; i < positions.length; i++) worst = Math.max(worst, Math.abs(positions[i]! - back.positions[i]!));
    expect(worst).toBeLessThanOrEqual(step * 0.55);
  });
  it("round-trips the fold depth and the fibre network", () => {
    for (let i = 0; i < V; i += 11) expect(Math.abs(sulcus[i]! - back.sulcus[i]!)).toBeLessThan(1 / 255);
    expect(back.fibers.parent).toEqual(fibers.parent);
    expect(back.fibers.mask).toEqual(fibers.mask);
    for (let i = 0; i < fibers.dist.length; i += 7) expect(Math.abs(back.fibers.dist[i]! - fibers.dist[i]!)).toBeLessThan(back.meta.maxDist / 60000);
    for (let i = 0; i < fibers.flow.length; i += 7) expect(Math.abs(back.fibers.flow[i]! - fibers.flow[i]!)).toBeLessThan(1 / 255);
  });
  it("decodes from a view that does not start on a 4-byte boundary", () => {
    const padded = new Uint8Array(bytes.length + 3); padded.set(bytes, 3);
    expect(decodeBrain(padded.subarray(3)).index.length).toBe(index.length);
  });
});

describe("fibre network", () => {
  it("is a forest in preorder: every parent precedes its children, roots are marked -1", () => {
    let roots = 0;
    for (let i = 0; i < fibers.parent.length; i++) { const p = fibers.parent[i]!; if (p < 0) roots++; else expect(p).toBeLessThan(i); }
    expect(roots).toBe(2); /* one per hemisphere */
  });
  it("gets thinner towards the tips: flow never grows from parent to child, and trunks are far thicker than twigs", () => {
    let maxFlow = 0, minFlow = 1;
    for (let i = 0; i < fibers.parent.length; i++) {
      const p = fibers.parent[i]!;
      if (p >= 0) expect(fibers.flow[i]!).toBeLessThanOrEqual(fibers.flow[p]! + 1e-6);
      maxFlow = Math.max(maxFlow, fibers.flow[i]!); minFlow = Math.min(minFlow, fibers.flow[i]!);
    }
    expect(maxFlow).toBeGreaterThan(0.95);
    expect(minFlow).toBeLessThan(maxFlow / 20);
  });
  it("branches (nodes with 2+ children exist) and arc length increases away from the root", () => {
    const kids = childCounts(fibers.parent);
    expect(kids.some((c) => c >= 2)).toBe(true);
    for (let i = 0; i < fibers.parent.length; i++) { const p = fibers.parent[i]!; if (p >= 0) expect(fibers.dist[i]!).toBeGreaterThan(fibers.dist[p]!); }
  });
  it("marks pulse paths from root to a leaf, with lengths that match the leaf's arc length", () => {
    let marked = 0;
    for (let b = 0; b < 8; b++) {
      if (fibers.pulseLen[b] === 0) continue;
      marked++;
      let n = 0, deepest = 0;
      for (let i = 0; i < fibers.mask.length; i++) if (fibers.mask[i]! & (1 << b)) { n++; deepest = Math.max(deepest, fibers.dist[i]!); }
      expect(n).toBeGreaterThan(5);
      expect(deepest).toBeCloseTo(fibers.pulseLen[b]!, 4);
    }
    expect(marked).toBeGreaterThanOrEqual(4);
  });
  it("floats at or just above the surface: every node is within 0.03 of some mesh vertex", () => {
    const near = (x: number, y: number, z: number) => { for (let i = 0; i < V; i++) if ((positions[i * 3]! - x) ** 2 + (positions[i * 3 + 1]! - y) ** 2 + (positions[i * 3 + 2]! - z) ** 2 < 0.0009) return true; return false; };
    for (let i = 0; i < fibers.parent.length; i += 9) expect(near(fibers.pos[i * 3]!, fibers.pos[i * 3 + 1]!, fibers.pos[i * 3 + 2]!)).toBe(true);
  });
});
