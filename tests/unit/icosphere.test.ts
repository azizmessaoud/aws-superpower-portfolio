import { describe, expect, it } from "vitest";
import { icosphereDirections, icosphereIndex, icosphereVertexCount } from "../../src/scene3d/icosphere";

describe("icosphere: deterministic indexed topology", () => {
  for (const n of [1, 2, 5, 12]) {
    it(`n=${n}: counts, shared vertices, outward winding, a closed surface`, () => {
      const V = icosphereVertexCount(n), idx = icosphereIndex(n), dir = icosphereDirections(n);
      expect(V).toBe(10 * n * n + 2);
      expect(idx.length).toBe(20 * n * n * 3);
      expect(dir.length).toBe(V * 3);
      const used = new Uint8Array(V);
      let outward = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
        expect(a).toBeLessThan(V); expect(b).toBeLessThan(V); expect(c).toBeLessThan(V);
        expect(new Set([a, b, c]).size).toBe(3);
        used[a] = used[b] = used[c] = 1;
        const p = (i: number) => [dir[i * 3]!, dir[i * 3 + 1]!, dir[i * 3 + 2]!];
        const A = p(a), B = p(b), C = p(c);
        const ux = B[0]! - A[0]!, uy = B[1]! - A[1]!, uz = B[2]! - A[2]!, vx = C[0]! - A[0]!, vy = C[1]! - A[1]!, vz = C[2]! - A[2]!;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (nx * (A[0]! + B[0]! + C[0]!) + ny * (A[1]! + B[1]! + C[1]!) + nz * (A[2]! + B[2]! + C[2]!) > 0) outward++;
      }
      expect(used.every((u) => u === 1)).toBe(true); /* every vertex is in some triangle */
      expect(outward).toBe(idx.length / 3); /* every triangle faces outward */
      for (let i = 0; i < V; i++) expect(Math.hypot(dir[i * 3]!, dir[i * 3 + 1]!, dir[i * 3 + 2]!)).toBeCloseTo(1, 5);
      /* closed 2-manifold: every undirected edge belongs to exactly two triangles, E = 30 n² */
      const edges = new Map<number, number>();
      for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) {
        const a = idx[t + k]!, b = idx[t + (k + 1) % 3]!;
        const key = Math.min(a, b) * V + Math.max(a, b);
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      expect(edges.size).toBe(30 * n * n);
      expect([...edges.values()].every((c) => c === 2)).toBe(true);
    });
  }
  it("distinct vertices are distinct points", () => {
    const n = 8, dir = icosphereDirections(n), V = icosphereVertexCount(n), seen = new Set<string>();
    for (let i = 0; i < V; i++) seen.add([dir[i * 3]!, dir[i * 3 + 1]!, dir[i * 3 + 2]!].map((v) => v.toFixed(5)).join(","));
    expect(seen.size).toBe(V);
  });
});
