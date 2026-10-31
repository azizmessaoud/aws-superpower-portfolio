import { describe, expect, it } from "vitest";
import type { BufferAttribute, BufferGeometry } from "three";
import { buildBrain, PART } from "../../src/scene3d/brainGeometry";

/* A low detail keeps the test fast; proportions and anatomy do not depend on it. */
const brain = buildBrain({ seed: 7, detail: 24 });
const attr = (g: BufferGeometry, n: string) => g.getAttribute(n) as BufferAttribute;
const pos = attr(brain, "position"), part = attr(brain, "part"), hemi = attr(brain, "hemi");

function extent(filter: (i: number) => boolean) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.count; i++) if (filter(i)) {
    const v = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k]!, v[k]!); hi[k] = Math.max(hi[k]!, v[k]!); }
  }
  return { w: hi[0]! - lo[0]!, h: hi[1]! - lo[1]!, l: hi[2]! - lo[2]!, lo, hi };
}

describe("procedural brain: anatomy", () => {
  it("has the three parts, each non-empty", () => {
    for (const p of [PART.cerebrum, PART.cerebellum, PART.stem]) expect([...Array(pos.count).keys()].some((i) => part.getX(i) === p)).toBe(true);
  });
  it("has human-like proportions: longer than wide, wider than the cerebrum is tall, a short stem below", () => {
    const c = extent((i) => part.getX(i) === PART.cerebrum);
    expect(c.l).toBeGreaterThan(1.6); expect(c.l).toBeLessThan(1.95);
    expect(c.w).toBeGreaterThan(1.3); expect(c.w).toBeLessThan(1.6);
    expect(c.l / c.w).toBeGreaterThan(1.1); expect(c.l / c.w).toBeLessThan(1.4);
    expect(c.h / c.l).toBeGreaterThan(0.5); expect(c.h / c.l).toBeLessThan(0.75);
    const all = extent(() => true);
    expect(all.lo[1]!).toBeLessThan(c.lo[1]! - 0.15); /* the stem hangs below the cerebrum */
    expect(all.h).toBeLessThan(c.h + 0.5); /* ...but it is a stub, not a stalk */
  });
  it("is two hemispheres with a longitudinal fissure between them, and equal sides", () => {
    let left = 0, right = 0, minAbsX = Infinity;
    for (let i = 0; i < pos.count; i++) if (part.getX(i) === PART.cerebrum) {
      if (hemi.getX(i) > 0) { right++; expect(pos.getX(i)).toBeGreaterThan(0); }
      else { left++; expect(pos.getX(i)).toBeLessThan(0); }
      minAbsX = Math.min(minAbsX, Math.abs(pos.getX(i)));
    }
    expect(left).toBe(right);
    expect(minAbsX).toBeGreaterThan(0.004); /* the hemispheres never touch or cross */
    expect(minAbsX).toBeLessThan(0.03); /* and the fissure is tight */
  });
  it("puts the cerebellum behind and below the cerebrum's centre, on the midline", () => {
    const cb = extent((i) => part.getX(i) === PART.cerebellum);
    const mid = (cb.lo[0]! + cb.hi[0]!) / 2, midY = (cb.lo[1]! + cb.hi[1]!) / 2, midZ = (cb.lo[2]! + cb.hi[2]!) / 2;
    expect(Math.abs(mid)).toBeLessThan(0.02);
    expect(midZ).toBeLessThan(-0.3);
    expect(midY).toBeLessThan(-0.2);
  });
  it("is deterministic for a seed and different for another", () => {
    const sum = (g: BufferGeometry) => { const p = attr(g, "position"); let s = 0; for (let i = 0; i < p.count; i++) s += p.getX(i) * 1.3 + p.getY(i) * 2.1 + p.getZ(i) * 3.7; return s; };
    expect(sum(buildBrain({ seed: 7, detail: 16 }))).toBe(sum(buildBrain({ seed: 7, detail: 16 })));
    expect(sum(buildBrain({ seed: 8, detail: 16 }))).not.toBe(sum(buildBrain({ seed: 7, detail: 16 })));
  });
  it("is clean data: finite positions, unit normals, sulcus in range, a sensible size", () => {
    const nor = attr(brain, "normal"), sul = attr(brain, "sulcus");
    for (let i = 0; i < pos.count; i += 7) {
      expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true);
      expect(Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i))).toBeCloseTo(1, 1);
      expect(sul.getX(i)).toBeGreaterThanOrEqual(0); expect(sul.getX(i)).toBeLessThanOrEqual(1);
    }
    expect(pos.count).toBeLessThan(40000); /* detail 24; the production tiers are budgeted separately */
  });
  it("folds change the surface: bare lobes are smoother than the folded brain", () => {
    const bare = buildBrain({ seed: 7, detail: 24, foldDepth: 0 });
    const a = attr(bare, "position");
    let moved = 0;
    for (let i = 0; i < pos.count; i += 5) if (Math.hypot(pos.getX(i) - a.getX(i), pos.getY(i) - a.getY(i), pos.getZ(i) - a.getZ(i)) > 0.01) moved++;
    expect(moved).toBeGreaterThan(100);
  });
});
